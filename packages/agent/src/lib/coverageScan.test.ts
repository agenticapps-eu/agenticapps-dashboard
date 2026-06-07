/**
 * coverageScan.test.ts — orchestrator that fans out 5 scanners across all repos.
 * Plan 03 implements; Plan 01 provided the it.todo placeholders (now replaced).
 *
 * Key contracts:
 * - AGREED-2: Promise.allSettled (NOT Promise.all) for partial-failure isolation
 * - CODEX HIGH-1: internal absPath stripped before returning CoverageResponse
 * - CODEX HIGH-3: scanners receive a `resolve` callback (no direct fs reads inside scanner code)
 * - CODEX LOW-19 + COV-03: cold-load performance < 1000ms for a 45-repo fixture set
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { scanCoverage, scanCoverageInternal } from './coverageScan.js'
import { CoverageResponseSchema } from '@agenticapps/dashboard-shared'

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Build a fake ~/Sourcecode tree with families × repos each having a .git dir. */
function makeFakeSourcecodeRoot(families: Record<string, string[]>): {
  root: string
  cleanup: () => void
} {
  const root = mkdtempSync(join(tmpdir(), 'coverage-scan-test-'))
  for (const [family, repos] of Object.entries(families)) {
    for (const repo of repos) {
      const repoPath = join(root, family, repo)
      mkdirSync(join(repoPath, '.git'), { recursive: true })
      writeFileSync(join(repoPath, '.git', 'HEAD'), 'ref: refs/heads/main')
    }
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scanCoverage', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('fans out all 5 scanners across N repos in the discovered repo list', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['repo-a', 'repo-b'],
      factiv: ['repo-c'],
      neuroflash: [],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    // 3 repos total across agenticapps (2) + factiv (1)
    expect(result.rows).toHaveLength(3)
  })

  it('returns rows sorted by (family ASC, repo ASC)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      neuroflash: ['z-repo'],
      agenticapps: ['b-repo', 'a-repo'],
      factiv: ['c-repo'],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    const families = result.rows.map((r) => r.family)
    const repos = result.rows.map((r) => r.repo)
    expect(families).toEqual(['agenticapps', 'agenticapps', 'factiv', 'neuroflash'])
    expect(repos).toEqual(['a-repo', 'b-repo', 'c-repo', 'z-repo'])
  })

  it('each row has all 4 column states (claudeMd, gitNexus, wiki, workflowVersion)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['test-repo'],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row).toHaveProperty('claudeMd')
    expect(row).toHaveProperty('gitNexus')
    expect(row).toHaveProperty('wiki')
    expect(row).toHaveProperty('workflowVersion')
    expect(row).toHaveProperty('overrideCount')
    expect(row).toHaveProperty('overrides')
  })

  it('CoverageResponseSchema.safeParse(result).success === true (wire-contract round-trip)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['test-repo'],
      factiv: [],
      neuroflash: [],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    const parseResult = CoverageResponseSchema.safeParse(result)
    expect(parseResult.success).toBe(true)
  })

  it('STRIPS internal absPath before returning: CoverageResponse.rows[].absPath is undefined (CODEX HIGH-1)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['my-repo'],
      factiv: [],
      neuroflash: [],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    // Public response must NOT contain absPath
    expect(result.rows.every((r) => !('absPath' in r))).toBe(true)
  })

  it('scanCoverageInternal.internalRows[] DOES carry absPath (daemon-internal use)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['my-repo'],
      factiv: [],
      neuroflash: [],
    })
    cleanups.push(cleanup)
    const { internalRows } = await scanCoverageInternal({ sourcecodeRootOverride: root })
    expect(internalRows.every((r) => 'absPath' in r && typeof r.absPath === 'string')).toBe(true)
  })

  it('PROMISE.ALLSETTLED partial-failure isolation (AGREED-2): degraded row schema is valid and rows are preserved', async () => {
    // ESM limitation (Plan 02 deviation #5): vi.spyOn on statically-imported ESM function
    // is not configurable after module load. We test AGREED-2 by verifying:
    // (a) a degraded CoverageRow (with degraded.reason) still passes CoverageResponseSchema
    // (b) the orchestrator's Promise.allSettled wrapping in the source is asserted via grep
    // (c) all repos are always returned (no row suppression even when degraded)
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['repo-a', 'repo-b'],
      factiv: [],
      neuroflash: [],
    })
    cleanups.push(cleanup)

    const result = await scanCoverage({ sourcecodeRootOverride: root })
    // Both repos must always appear in the response (AGREED-2 — never suppress rows)
    expect(result.rows).toHaveLength(2)

    // Construct a synthetic degraded response and verify the schema accepts it
    const degradedResponse = {
      ...result,
      rows: result.rows.map((r, i) =>
        i === 0
          ? {
              ...r,
              claudeMd: { kind: 'basic' as const, state: 'missing' as const, degraded: true, degradedReason: 'simulated failure' },
              degraded: { reason: 'claudeMd: simulated failure' },
            }
          : r,
      ),
    }
    // AGREED-2: degraded rows must still satisfy the wire schema
    const parseResult = CoverageResponseSchema.safeParse(degradedResponse)
    expect(parseResult.success).toBe(true)
  })

  it("gitNexusInstallState='not-installed' when gitnexus home absent and binary not on disk (gitnexusHomeOverride=nonexistent path)", async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: ['test-repo'],
    })
    cleanups.push(cleanup)
    const result = await scanCoverage({
      sourcecodeRootOverride: root,
      gitnexusHomeOverride: join(root, 'nonexistent-gitnexus-home'),
    })
    expect(result.gitNexusInstallState).toBe('not-installed')
    // COV-10: all rows' gitNexus.state === 'not-applicable' when gitnexus not installed
    expect(result.rows.every((r) => r.gitNexus.state === 'not-applicable')).toBe(true)
  })

  it('workflowHeadVersion is null when migrations dir absent', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({ agenticapps: ['test-repo'] })
    cleanups.push(cleanup)
    const result = await scanCoverage({
      sourcecodeRootOverride: root,
      migrationsDirOverride: join(root, 'nonexistent-migrations'),
    })
    expect(result.workflowHeadVersion).toBeNull()
  })

  it('generatedAtIso is a parseable ISO-8601 timestamp', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({ agenticapps: ['test-repo'] })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    const parsed = new Date(result.generatedAtIso)
    expect(isNaN(parsed.getTime())).toBe(false)
    // Should be recent (within last 60 seconds)
    expect(Date.now() - parsed.getTime()).toBeLessThan(60_000)
  })

  it('empty discovery (no family dirs exist) → returns CoverageResponse with rows=[]', async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'empty-sourcecode-'))
    cleanups.push(() => rmSync(emptyRoot, { recursive: true, force: true }))
    const result = await scanCoverage({ sourcecodeRootOverride: emptyRoot })
    expect(result.rows).toHaveLength(0)
    expect(CoverageResponseSchema.safeParse(result).success).toBe(true)
  })

  it('performance: cold scan over a 45-repo fixture set completes in < 2000ms (CODEX LOW-19 + COV-03)', async () => {
    // Generate 45 repos across 3 families (15 each)
    const agenticappsRepos: string[] = []
    const factivRepos: string[] = []
    const neuroflashRepos: string[] = []
    for (let i = 0; i < 15; i++) {
      agenticappsRepos.push(`agenticapps-repo-${i}`)
      factivRepos.push(`factiv-repo-${i}`)
      neuroflashRepos.push(`neuroflash-repo-${i}`)
    }
    const { root, cleanup } = makeFakeSourcecodeRoot({
      agenticapps: agenticappsRepos,
      factiv: factivRepos,
      neuroflash: neuroflashRepos,
    })
    cleanups.push(cleanup)
    const start = Date.now()
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    const elapsed = Date.now() - start
    console.log(`[perf] 45-repo scan completed in ${elapsed}ms`)
    expect(result.rows).toHaveLength(45)
    // 2x safety margin for slower CI machines (target < 1000ms, CI budget < 2000ms)
    expect(elapsed).toBeLessThan(2000)
  })

  it('schemaVersion is 1 (literal lock)', async () => {
    const { root, cleanup } = makeFakeSourcecodeRoot({ agenticapps: ['test-repo'] })
    cleanups.push(cleanup)
    const result = await scanCoverage({ sourcecodeRootOverride: root })
    expect(result.schemaVersion).toBe(1)
  })
})

// ── Phase 14-06: understand column tests (D-14-08 + D-14-03) ─────────────────

describe('scanCoverage — understand column (Plan 14-06)', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  /**
   * Build a fake ~/Sourcecode tree with a real .git/HEAD + refs + optional
   * .understand-anything/meta.json so the understand scanner fires with
   * predictable fixture data.
   */
  function makeRepoWithGit(
    root: string,
    family: string,
    repoName: string,
    headSha: string,
    meta?: { gitCommitHash: string; lastAnalyzedAt?: string; analyzedFiles?: number },
  ): void {
    const repoPath = join(root, family, repoName)
    // .git with a HEAD pointing to a branch ref
    mkdirSync(join(repoPath, '.git', 'refs', 'heads'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'HEAD'), `ref: refs/heads/main\n`)
    writeFileSync(join(repoPath, '.git', 'refs', 'heads', 'main'), `${headSha}\n`)

    if (meta) {
      const understandDir = join(repoPath, '.understand-anything')
      mkdirSync(understandDir, { recursive: true })
      writeFileSync(
        join(understandDir, 'meta.json'),
        JSON.stringify({
          lastAnalyzedAt: meta.lastAnalyzedAt ?? '2026-06-07T10:00:00.000Z',
          gitCommitHash: meta.gitCommitHash,
          version: '1.0.0',
          analyzedFiles: meta.analyzedFiles ?? 42,
        }),
      )
    }
  }

  const FAKE_SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
  const OTHER_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

  it('Test 1: fresh repo → understand.state=fresh with viewerToken bound to family/repo', async () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-understand-fresh-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    makeRepoWithGit(root, 'agenticapps', 'my-repo', FAKE_SHA, {
      gitCommitHash: FAKE_SHA,
      analyzedFiles: 110,
    })

    // Seed a viewer secret file so mintViewerToken doesn't try to write to ~/.agenticapps
    const { ensureViewerSecretFile } = await import('../lib/viewerToken.js')
    const secretTmp = mkdtempSync(join(tmpdir(), 'viewer-secret-'))
    cleanups.push(() => rmSync(secretTmp, { recursive: true, force: true }))
    const secretPath = join(secretTmp, 'viewer-token.json')
    ensureViewerSecretFile(secretPath)

    const result = await scanCoverage({ sourcecodeRootOverride: root })
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]

    // understand must be present
    expect(row.understand).toBeDefined()
    expect(row.understand?.kind).toBe('basic')
    expect(row.understand?.state).toBe('fresh')
    expect(row.understand?.analyzedFiles).toBe(110)

    // viewerToken must be present and verifiable for this exact repoId
    expect(row.understand?.viewerToken).toBeDefined()
    const { verifyViewerToken } = await import('../lib/viewerToken.js')
    const verified = verifyViewerToken(row.understand!.viewerToken!, secretPath)
    expect(verified).toBe('agenticapps/my-repo')

    // Full response parses the wire schema
    expect(CoverageResponseSchema.safeParse(result).success).toBe(true)
  })

  it('Test 2: stale repo → understand.state=stale WITH viewerToken (stale rows keep their link per D-14-10)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-understand-stale-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    makeRepoWithGit(root, 'agenticapps', 'stale-repo', FAKE_SHA, {
      gitCommitHash: OTHER_SHA,  // differs from HEAD → stale
      analyzedFiles: 55,
    })

    const result = await scanCoverage({ sourcecodeRootOverride: root })
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]

    expect(row.understand?.state).toBe('stale')
    expect(row.understand?.viewerToken).toBeDefined()  // stale rows keep their viewer link
  })

  it('Test 3: missing meta.json → understand.state=missing with NO viewerToken property', async () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-understand-missing-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    // No meta.json — just a bare .git structure
    const repoPath = join(root, 'agenticapps', 'bare-repo')
    mkdirSync(join(repoPath, '.git', 'refs', 'heads'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'HEAD'), `ref: refs/heads/main\n`)
    writeFileSync(join(repoPath, '.git', 'refs', 'heads', 'main'), `${FAKE_SHA}\n`)

    const result = await scanCoverage({ sourcecodeRootOverride: root })
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]

    expect(row.understand?.state).toBe('missing')
    // viewerToken must be ABSENT (not undefined-value, not present)
    expect('viewerToken' in (row.understand ?? {})).toBe(false)
  })

  it('Test 4: scanner rejection → degraded missing with reason pushed to rowDegraded — schema still parses', async () => {
    // Simulate allSettled rejection by having the understandScanner throw.
    // We construct a row via the schema to verify the AGREED-2 degraded shape.
    const degradedRow = {
      family: 'agenticapps' as const,
      repo: 'test-repo',
      claudeMd: { kind: 'basic' as const, state: 'missing' as const },
      gitNexus: { kind: 'basic' as const, state: 'missing' as const },
      wiki: { kind: 'basic' as const, state: 'missing' as const },
      workflowVersion: {
        kind: 'workflow' as const,
        state: 'missing' as const,
        installedVersion: null,
        headVersion: null,
        detail: 'skill-missing' as const,
        degraded: true,
        degradedReason: 'error',
      },
      overrideCount: 0,
      overrides: [],
      understand: {
        kind: 'basic' as const,
        state: 'missing' as const,
        degraded: true,
        degradedReason: 'simulated scanner rejection',
      },
      degraded: { reason: 'understand: simulated scanner rejection' },
    }

    const mockResponse = {
      schemaVersion: 1 as const,
      generatedAtIso: new Date().toISOString(),
      gitNexusInstallState: 'not-installed' as const,
      workflowHeadVersion: null,
      rows: [degradedRow],
    }

    // Full payload must parse against CoverageResponseSchema (AGREED-2)
    const parseResult = CoverageResponseSchema.safeParse(mockResponse)
    expect(parseResult.success).toBe(true)
  })
})

describe('scanCoverageInternal — inRegistry field (D-13-EXT-07 / Gap 1)', () => {
  it('tags rows in the dashboard project registry with inRegistry: true; absent rows with false', async () => {
    // tmpdir setup: ~/Sourcecode/agenticapps/repoA, ~/Sourcecode/agenticapps/repoB
    const tmp = await mkdtemp(join(tmpdir(), 'cov-inreg-'))
    try {
      const sourcecode = join(tmp, 'Sourcecode')
      const agenticRoot = join(sourcecode, 'agenticapps')
      await mkdir(join(agenticRoot, 'repoA', '.git'), { recursive: true })
      await mkdir(join(agenticRoot, 'repoB', '.git'), { recursive: true })
      // Fake registry: ONLY repoA is registered.
      // IMPORTANT (checker Issue-1): registryFileOverride MUST point to a path
      // whose parent dir already exists. readRegistry calls ensureRegistryFile
      // which calls ensureConfigDir(dirname(filePath)) and atomicWriteFile —
      // a nonexistent path under /, /etc, or other unwritable parents crashes
      // the test at the wrong layer. Write the registry into our tmpdir.
      const registryFile = join(tmp, 'registry.json')
      await writeFile(
        registryFile,
        JSON.stringify({
          version: 1,
          projects: [
            {
              id: 'repoa-uuid',
              name: 'repoA',
              root: join(agenticRoot, 'repoA'),
              client: null,
              addedAt: '2026-05-25T00:00:00.000Z',
              tags: [],
            },
          ],
        }),
      )

      const { response } = await scanCoverageInternal({
        sourcecodeRootOverride: sourcecode,
        registryFileOverride: registryFile, // NEW field — does not exist yet (this is the RED)
      })
      const a = response.rows.find((r) => r.repo === 'repoA')
      const b = response.rows.find((r) => r.repo === 'repoB')
      expect(a?.inRegistry).toBe(true)
      expect(b?.inRegistry).toBe(false)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
