/**
 * registryPathDrift.ts — Phase 12 registry-entry drift detector + suggested-path
 * inference (D-12-18, D-12-21).
 *
 * Compares each `registry.json` entry against the on-disk reality, emitting a
 * `PathDriftEntry[]` for the conformance scan to surface in the SPA's
 * collapsible drift panel.
 *
 * Three drift reasons (PathDriftReasonSchema, Wave 0):
 *   - `missing` — existsSync(storedPath) === false
 *   - `symlink-target-changed` — realpath(storedPath) differs from
 *     canonicaliseRoot(storedPath) (i.e. a symlink was re-pointed since
 *     registration, or the stored value was never a canonical path)
 *   - `git-remote-changed` — the stored path does not live under any of the
 *     three family roots (agenticapps/factiv/neuroflash), so the project
 *     either moved between families or the family root itself drifted
 *
 * Suggested-path inference is best-effort: scan each family root one level
 * deep, read each candidate's `.git/config`, regex-parse the
 * `[remote "origin"]` url, and return the first match's realpath. Inference
 * never throws — failures yield `suggestedPath: null` and the SPA prompts
 * the user to paste the corrected path (D-12-21).
 *
 * Per-cycle index reuse (F9): `detectPathDrift` builds an origin-URL →
 * realpath index ONCE per drift cycle via `buildOriginIndex` and reuses it
 * for every drifted entry's lookup. Total work is O(F × M × readFile) per
 * cycle regardless of how many entries drifted. The standalone
 * `inferSuggestedPath(url)` form remains for callers that look up a single
 * URL and rebuilds the index per call.
 *
 * THREAT BOUNDARIES (see plan §threat_model):
 *   - T-12-SUPPLY-CHAIN: NO subprocess. `.git/config` is read via fs.readFile
 *     + regex parsing only — matches RESEARCH §Environment availability
 *     fallback. Zero new runtime deps.
 *   - T-12-PATH-TRAVERSAL: family-root scan is one level deep (matches Phase
 *     10 repo discovery cadence) — no recursive readdir.
 *   - Symlink candidates inside a family root are skipped via `lstat`
 *     before any `readFile`/`realpath` runs against them (F10). An attacker
 *     who can write inside a family root cannot trick the detector into
 *     surfacing an out-of-family path via a symlink whose target carries a
 *     chosen origin URL.
 *   - Defence-in-depth: every fs call is wrapped in try/catch returning a
 *     defensive default. The detector NEVER throws — registry-read failure
 *     yields [], per-entry probe failure is silently skipped.
 *
 * Implementation note: this file deliberately avoids any unbounded raise
 * pathway. Errors from helpers are caught at the boundary and converted to
 * defensive return values. Validation failures (which would be programmer
 * errors) are not expected here — this is pure read-side observability.
 */
import { existsSync, readdirSync } from 'node:fs'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'

import type { PathDriftEntry } from '@agenticapps/dashboard-shared'

import { readRegistry, canonicaliseRoot } from './registry.js'
import { COVERAGE_ROOTS } from './paths.js'

/** Family roots scanned by inferSuggestedPath. Order is irrelevant (first URL match wins). */
const SCANNED_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
type ScannedFamily = (typeof SCANNED_FAMILIES)[number]

/**
 * Section header detection — a `.git/config` section begins with `[` at the
 * start of a line. We split on this anchor and scan the section whose header
 * is `remote "origin"`; the url key MUST live inside that section.
 *
 * A previous single-regex version (`/\[remote "origin"\][\s\S]*?url\s*=\s*…/`)
 * was vulnerable to cross-section overrun: a config with `[remote "origin"]`
 * (no url) followed by `[remote "upstream"]\n\turl = …` returned the upstream
 * URL as origin's. Per-section parsing is the only correctness-preserving fix.
 */
const SECTION_SPLIT_RE = /^\[/m
const ORIGIN_SECTION_HEADER = 'remote "origin"]'
const SECTION_URL_RE = /^\s*url\s*=\s*([^\s]+)/m

/**
 * Best-effort parse — returns the trimmed origin URL or null on no match.
 * Scans only inside the `[remote "origin"]` section; will not borrow a `url`
 * from a sibling `[remote "*"]` section.
 */
function parseOriginUrl(configText: string): string | null {
  // SECTION_SPLIT_RE eats the leading `[`, so each chunk after the first
  // starts with the section header content (e.g. `remote "origin"]\n…`).
  const chunks = configText.split(SECTION_SPLIT_RE)
  for (const chunk of chunks) {
    if (!chunk.startsWith(ORIGIN_SECTION_HEADER)) continue
    const body = chunk.slice(ORIGIN_SECTION_HEADER.length)
    const match = body.match(SECTION_URL_RE)
    if (!match || !match[1]) return null
    return match[1].trim()
  }
  return null
}

/**
 * Read `<rootPath>/.git/config` and extract the `[remote "origin"]` URL.
 * Returns null on ANY failure (file missing, unreadable, malformed) — caller
 * treats null as "no remote known", which is the safest default.
 *
 * Exported so other modules (registryFixPath.ts) can verify the fix-path
 * target matches the entry's current origin without duplicating the parser.
 */
export async function readGitOrigin(rootPath: string): Promise<string | null> {
  try {
    const text = await readFile(join(rootPath, '.git', 'config'), 'utf8')
    return parseOriginUrl(text)
  } catch {
    return null
  }
}

/**
 * Resolve a family root to its realpath, tolerating absent dirs (returns null
 * so the caller can `.filter(Boolean)` the result list).
 */
async function realFamilyRoot(family: ScannedFamily): Promise<string | null> {
  try {
    return await realpath(COVERAGE_ROOTS[family]())
  } catch {
    return null
  }
}

/**
 * Returns true iff `path` is itself a symlink (lstat does NOT follow links).
 * Failure (e.g. ENOENT between readdir and lstat) returns false so the caller
 * still attempts the readGitOrigin — a missing/unreadable candidate is then
 * harmlessly skipped by readGitOrigin's own try/catch.
 *
 * F10 defence: a symlink candidate planted in a family root could otherwise
 * be followed by `readFile(<candidate>/.git/config)` + `realpath(candidate)`,
 * surfacing an out-of-family path as a suggestion. We refuse to descend into
 * any symlinked candidate.
 */
async function isSymlink(path: string): Promise<boolean> {
  try {
    const st = await lstat(path)
    return st.isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Build an origin-URL → realpath(candidate) index by scanning every family
 * root one level deep ONCE. Symlink candidates are skipped (F10). First URL
 * match wins (mirrors the previous per-call first-hit semantics of
 * inferSuggestedPath). NEVER raises.
 *
 * F9 defence: the previous shape made `inferSuggestedPath` re-scan every
 * family root on every drifted entry, yielding O(D × F × M × readFile) per
 * drift cycle. With the index built once and reused for each lookup, work
 * collapses to O(F × M × readFile) per drift cycle regardless of D.
 *
 * Threat boundaries are unchanged from the per-call form:
 *   - NO recursive descent — one level deep per family root.
 *   - NO subprocess — fs.readFile + regex (T-12-SUPPLY-CHAIN).
 *   - Symlink candidates filtered before any readFile/realpath touches them.
 */
export async function buildOriginIndex(): Promise<Map<string, string>> {
  const idx = new Map<string, string>()
  for (const family of SCANNED_FAMILIES) {
    const familyRoot = await realFamilyRoot(family)
    if (!familyRoot) continue

    let entries: string[]
    try {
      entries = readdirSync(familyRoot)
    } catch {
      continue
    }

    for (const entry of entries) {
      const candidate = join(familyRoot, entry)
      if (await isSymlink(candidate)) continue
      const candidateOrigin = await readGitOrigin(candidate)
      if (!candidateOrigin) continue
      if (idx.has(candidateOrigin)) continue // first hit wins
      try {
        idx.set(candidateOrigin, await realpath(candidate))
      } catch {
        // realpath failed even though readdir + lstat-not-symlink succeeded
        // (e.g. permissions race). Fall back to the joined path so the
        // index still answers — the caller can attempt the path and the
        // SPA will surface the suggested-path read failure if it now
        // breaks.
        idx.set(candidateOrigin, candidate)
      }
    }
  }
  return idx
}

/**
 * Best-effort: find a directory inside any family root whose `.git/config`
 * carries the given origin URL. Returns the matched candidate's realpath, or
 * null if nothing matches. Symlink candidates are skipped.
 *
 * Thin wrapper over `buildOriginIndex` — preserves the standalone API for
 * callers that look up a single URL. For batched lookups across N drifted
 * entries, `detectPathDrift` builds the index ONCE and queries it directly.
 */
export async function inferSuggestedPath(originUrl: string): Promise<string | null> {
  const idx = await buildOriginIndex()
  return idx.get(originUrl) ?? null
}

/**
 * Internal probe result — either a drift reason + the origin URL (for
 * inference) or null when the entry is healthy.
 */
type ProbeResult =
  | { reason: PathDriftEntry['reason']; originUrl: string | null }
  | null

/**
 * Probe one registry entry, returning a drift reason or null if the entry is
 * healthy. ALL filesystem operations are try/catch-bounded so a partial
 * failure surfaces as "no drift" (defensive default) rather than a raise.
 */
async function probeEntry(storedPath: string): Promise<ProbeResult> {
  // 1. missing — existsSync returned false
  if (!existsSync(storedPath)) {
    return { reason: 'missing', originUrl: null }
  }

  // 2. symlink-target-changed — realpath(storedPath) differs from the
  //    stored path string itself. Registration canonicalises before storing
  //    (registry.ts:addProject → canonicaliseRoot → realpathSync), so the
  //    stored value SHOULD already equal its own realpath. Divergence here
  //    means the symlink was re-pointed since registration OR the registry
  //    was tampered with to store a non-canonical path.
  let real: string | null = null
  try {
    real = await realpath(storedPath)
  } catch {
    // realpath failed despite existsSync passing — most likely a symlink
    // loop or a permissions problem. Treat as missing to surface in the
    // drift panel (caller will see reason='missing').
    return { reason: 'missing', originUrl: null }
  }

  if (real !== storedPath) {
    const originUrl = await readGitOrigin(real)
    return { reason: 'symlink-target-changed', originUrl }
  }

  // canonicaliseRoot is defensive (try/catch internally) — falls back to
  // plain resolve() when realpath fails. With existsSync passing + realpath
  // already resolved, this is a sanity reference for the containment check.
  let canonical: string
  try {
    canonical = canonicaliseRoot(storedPath)
  } catch {
    return null
  }

  // 3. git-remote-changed — stored path is NOT under any family root
  const familyRoots = (await Promise.all(SCANNED_FAMILIES.map(realFamilyRoot))).filter(
    (r): r is string => r !== null,
  )

  const insideAnyFamily = familyRoots.some(
    (root) => canonical === root || canonical.startsWith(root + sep),
  )

  if (!insideAnyFamily) {
    const originUrl = await readGitOrigin(canonical)
    return { reason: 'git-remote-changed', originUrl }
  }

  // Healthy — no drift.
  return null
}

export interface DetectPathDriftOptions {
  /** Override registry.json path for testability. Defaults to REGISTRY_FILE. */
  registryFile?: string
}

/**
 * Detect drift across all registry entries. NEVER raises.
 *
 * @returns Array of `PathDriftEntry` (shape matches PathDriftEntrySchema).
 *   Empty array on registry-read failure or no projects.
 */
export async function detectPathDrift(
  opts: DetectPathDriftOptions = {},
): Promise<PathDriftEntry[]> {
  let projects: ReturnType<typeof readRegistry>['projects']
  try {
    projects = readRegistry(opts.registryFile).projects
  } catch {
    return []
  }

  const result: PathDriftEntry[] = []

  // F9: build the origin-URL → realpath index LAZILY exactly once per drift
  // cycle. Most scans return zero drifted entries; the index build (which
  // touches every candidate `.git/config`) should not run in the happy path.
  // Once built, every subsequent drift lookup is an O(1) Map.get.
  let originIndex: Map<string, string> | null = null
  const lookupSuggestedPath = async (originUrl: string): Promise<string | null> => {
    if (!originIndex) {
      try {
        originIndex = await buildOriginIndex()
      } catch {
        originIndex = new Map()
      }
    }
    return originIndex.get(originUrl) ?? null
  }

  for (const project of projects) {
    let probe: ProbeResult
    try {
      probe = await probeEntry(project.root)
    } catch {
      // Defence-in-depth — probeEntry is itself try/catch-bounded but a
      // future refactor could leak. Silently skip rather than fail the scan.
      continue
    }
    if (!probe) continue

    let suggestedPath: string | null = null
    if (probe.originUrl) {
      try {
        suggestedPath = await lookupSuggestedPath(probe.originUrl)
      } catch {
        suggestedPath = null
      }
    }

    result.push({
      id: project.id,
      storedPath: project.root,
      suggestedPath,
      reason: probe.reason,
    })
  }
  return result
}
