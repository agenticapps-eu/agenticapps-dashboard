/**
 * coverageScan.ts — Orchestrator that fans out 5 scanners across all discovered repos.
 *
 * CODEX HIGH-1: Internal type InternalCoverageRow carries absPath for daemon-internal
 *   refresh routing. stripInternal() removes absPath before the public CoverageResponse
 *   is returned. The SPA never sees filesystem paths.
 *
 * CODEX HIGH-3: A single PathResolver is constructed once per scan and passed to every
 *   scanner call. No scanner receives filesystem paths without resolver mediation.
 *
 * AGREED-2: Per-repo scanner fan-out uses Promise.allSettled — a rejected scanner yields
 *   a degraded row (state='missing', degraded=true, degradedReason=<err>), NOT a 500.
 *   The full row is still included in the response.
 *
 * COV-03 / CODEX LOW-19: Promise.all at the repo level parallelises work across all repos.
 *   45 repos × 6 syscalls each ≈ 270 stats — well within the 1s cold-load target.
 *
 * T-10-03-06: 30s memo cache absorbs repeat reads after the cold scan.
 */
import { join } from 'node:path'
import { homedir } from 'node:os'

import type { CoverageResponse, CoverageRow } from '@agenticapps/dashboard-shared'

import { discoverRepos } from './repoDiscovery.js'
import { scanClaudeMd } from './scanners/claudeMdScanner.js'
import { scanGitNexusGlobal, rateGitNexusRepo } from './scanners/gitNexusScanner.js'
import { scanWikiForFamily } from './scanners/wikiScanner.js'
import {
  readWorkflowHeadVersion,
  scanWorkflowVersionForRepo,
} from './scanners/workflowVersionScanner.js'
import { scanOverrideSentinelsForRepo } from './scanners/overrideSentinelScanner.js'
import { makeCoverageResolver, type PathResolver } from './coverageResolver.js'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * CODEX HIGH-1: daemon-internal type. absPath is used for cache-key / refresh-routing.
 * NEVER emitted in the public CoverageResponse (stripped by stripInternal).
 */
export interface InternalCoverageRow extends CoverageRow {
  absPath: string
}

/**
 * WARNING-04 clarification: the `*Override` suffix marks test/CI overrides.
 * Production code passes `undefined` and the resolver picks up production defaults.
 * These are NOT inputs that callers normally supply.
 */
export interface ScanCoverageOptions {
  sourcecodeRootOverride?: string // tests pass tmpdir
  gitnexusHomeOverride?: string   // tests pass tmpdir
  migrationsDirOverride?: string  // tests pass tmpdir
}

// ── Internal scan ─────────────────────────────────────────────────────────────

/**
 * Full scan — returns both the public CoverageResponse and the daemon-internal rows
 * (with absPath) for use by the refresh route (Plan 04).
 *
 * Internal-only export. Plan 04 uses internalRows to look up absPath when handling
 * POST /api/coverage/refresh.
 */
export async function scanCoverageInternal(opts: ScanCoverageOptions = {}): Promise<{
  response: CoverageResponse
  internalRows: InternalCoverageRow[]
}> {
  const sourcecodeRoot = opts.sourcecodeRootOverride ?? join(homedir(), 'Sourcecode')
  const gitnexusHome = opts.gitnexusHomeOverride
  const migrationsDir = opts.migrationsDirOverride

  // Step 1: Discover repos (synchronous — readdir-based)
  const repos = discoverRepos(sourcecodeRoot)

  // Step 2: CODEX HIGH-3 — construct the resolver ONCE; pass to every scanner.
  // Only pass defined override values to satisfy exactOptionalPropertyTypes.
  const resolverOpts: Parameters<typeof makeCoverageResolver>[0] = { sourcecodeRoot }
  if (gitnexusHome !== undefined) resolverOpts.gitnexusHome = gitnexusHome
  if (migrationsDir !== undefined) resolverOpts.migrationsDir = migrationsDir
  const resolve: PathResolver = makeCoverageResolver(resolverOpts)

  // Step 3: One-shot singleton reads (gitnexus global state + workflow head version)
  // scanGitNexusGlobal signature: (homeOverride: string | undefined, resolve: PathResolver)
  const gnGlobal = scanGitNexusGlobal(gitnexusHome, resolve)

  // readWorkflowHeadVersion signature: (migrationsDirOverride?: string)
  const workflowHead = readWorkflowHeadVersion(migrationsDir)

  // Step 4: Per-repo fan-out using Promise.all across repos (parallelism per Claude's Discretion).
  // Each repo's 5 scanners use Promise.allSettled internally (AGREED-2 partial-failure isolation).
  const internalRows: InternalCoverageRow[] = await Promise.all(
    repos.map((repo) =>
      buildRow(repo.absPath, repo.family, repo.name, sourcecodeRoot, gnGlobal, workflowHead, resolve),
    ),
  )

  // Step 5: Sort deterministically by (family ASC, repo ASC)
  internalRows.sort((a, b) => {
    if (a.family !== b.family) return a.family < b.family ? -1 : 1
    return a.repo < b.repo ? -1 : a.repo > b.repo ? 1 : 0
  })

  // Step 6: CODEX HIGH-1 strip — public response carries CoverageRow (no absPath).
  const response: CoverageResponse = {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    gitNexusInstallState: gnGlobal.installState, // 10.6: 3-state replaces boolean
    workflowHeadVersion: workflowHead,
    rows: internalRows.map(stripInternal),
  }

  return { response, internalRows }
}

/**
 * PUBLIC: returns the SPA-bound CoverageResponse with absPath stripped (CODEX HIGH-1).
 * This is the function Plan 04's route handler calls.
 */
export async function scanCoverage(opts: ScanCoverageOptions = {}): Promise<CoverageResponse> {
  const { response } = await scanCoverageInternal(opts)
  return response
}

// ── Row builder ───────────────────────────────────────────────────────────────

/**
 * Build one InternalCoverageRow for a single repo.
 *
 * AGREED-2: scanner fan-out uses Promise.allSettled — each scanner failure yields
 *   a degraded column (state='missing', degraded=true) and adds to row.degraded.reason.
 *   The row is ALWAYS included in the response.
 */
async function buildRow(
  repoAbsPath: string,
  family: 'agenticapps' | 'factiv' | 'neuroflash',
  repoName: string,
  sourcecodeRoot: string,
  gnGlobal: ReturnType<typeof scanGitNexusGlobal>,
  workflowHead: string | null,
  resolve: PathResolver,
): Promise<InternalCoverageRow> {
  const familyRoot = join(sourcecodeRoot, family)

  // AGREED-2: Promise.allSettled isolates scanner failures — one failure does not
  // poison the whole row. Failures yield degraded columns.
  //
  // Each scanner is sync — wrapping with `Promise.resolve(scanX(...))` would let
  // a sync throw escape the array literal before allSettled gets a chance to
  // catch it. Wrap in an async IIFE so the throw resolves to a rejected promise
  // that allSettled handles.
  const [cmS, gnS, wkS, wfS, ovS] = await Promise.allSettled([
    (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
    (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
    (async () => scanWikiForFamily(familyRoot, repoName, resolve))(),
    (async () => scanWorkflowVersionForRepo(repoAbsPath, workflowHead, resolve))(),
    (async () => scanOverrideSentinelsForRepo(repoAbsPath, resolve))(),
  ])

  const rowDegraded: string[] = []

  // ── claudeMd column (CoverageBasicColumnSchema) ───────────────────────────
  const claudeMd =
    cmS.status === 'fulfilled'
      ? {
          kind: 'basic' as const,
          state: cmS.value.state,
          ...(cmS.value.via !== 'none' ? { label: `via ${cmS.value.via}` } : {}),
        }
      : (() => {
          rowDegraded.push(`claudeMd: ${String(cmS.reason)}`)
          return { kind: 'basic' as const, state: 'missing' as const, degraded: true, degradedReason: String(cmS.reason) }
        })()

  // ── gitNexus column (CoverageBasicColumnSchema) ───────────────────────────
  const gitNexus =
    gnS.status === 'fulfilled'
      ? {
          kind: 'basic' as const,
          state: gnS.value.state,
          ...(gnS.value.daysSinceIndex !== undefined
            ? { label: `${gnS.value.daysSinceIndex}d ago`, daysSince: gnS.value.daysSinceIndex }
            : {}),
        }
      : (() => {
          rowDegraded.push(`gitNexus: ${String(gnS.reason)}`)
          return { kind: 'basic' as const, state: 'missing' as const, degraded: true, degradedReason: String(gnS.reason) }
        })()

  // ── wiki column (CoverageBasicColumnSchema) ───────────────────────────────
  const wiki =
    wkS.status === 'fulfilled'
      ? {
          kind: 'basic' as const,
          state: wkS.value.state,
          ...(wkS.value.hint
            ? { label: wkS.value.hint }
            : wkS.value.daysSinceCompile !== undefined
            ? { label: `${wkS.value.daysSinceCompile}d ago`, daysSince: wkS.value.daysSinceCompile }
            : {}),
        }
      : (() => {
          rowDegraded.push(`wiki: ${String(wkS.reason)}`)
          return { kind: 'basic' as const, state: 'missing' as const, degraded: true, degradedReason: String(wkS.reason) }
        })()

  // ── workflowVersion column (CoverageWorkflowColumnSchema) ─────────────────
  const workflowVersion =
    wfS.status === 'fulfilled'
      ? {
          kind: 'workflow' as const,
          state: wfS.value.state,
          installedVersion: wfS.value.installedVersion ?? null,
          headVersion: workflowHead,
          ...(wfS.value.detail ? { detail: wfS.value.detail } : {}),
        }
      : (() => {
          rowDegraded.push(`workflowVersion: ${String(wfS.reason)}`)
          return {
            kind: 'workflow' as const,
            state: 'missing' as const,
            installedVersion: null,
            headVersion: workflowHead,
            detail: 'skill-missing' as const,
            degraded: true,
            degradedReason: String(wfS.reason),
          }
        })()

  // ── overrides ─────────────────────────────────────────────────────────────
  const overrides = ovS.status === 'fulfilled' ? ovS.value : []
  if (ovS.status === 'rejected') {
    rowDegraded.push(`overrides: ${String(ovS.reason)}`)
  }

  // ── Assemble CoverageRow (public shape) ───────────────────────────────────
  const publicRow: CoverageRow = {
    family,
    repo: repoName,
    claudeMd,
    gitNexus,
    wiki,
    workflowVersion,
    overrideCount: overrides.length,
    overrides: overrides.map((o) => ({
      phaseSlug: o.phaseSlug,
      sinceIso: o.sinceIso,
      source: o.source,
    })),
    ...(rowDegraded.length > 0 ? { degraded: { reason: rowDegraded.join('; ') } } : {}),
  }

  // CODEX HIGH-1: InternalCoverageRow extends CoverageRow with daemon-internal absPath.
  return { ...publicRow, absPath: repoAbsPath }
}

// ── stripInternal ─────────────────────────────────────────────────────────────

/**
 * CODEX HIGH-1: remove daemon-internal absPath before emitting the public CoverageRow.
 * The SPA never receives filesystem paths.
 */
function stripInternal(internal: InternalCoverageRow): CoverageRow {
  const { absPath: _omit, ...publicRow } = internal
  return publicRow
}
