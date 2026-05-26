/**
 * gitnexusFamilyScan.test.ts — Family-scan orchestration tests.
 *
 * Plan 13-02 (Wave 2) — original orchestration coverage.
 * Plan 13-08 (D-13-EXT-09) — refactored to source repos from the filesystem
 *   instead of the registry; tests now create real dirs under a tmpdir HOME
 *   so deriveFamilyReposFromFs + deterministicRepoRoot find them.
 *
 * Test inventory:
 *   1. iterates repos in alphabetical order (D-13-04)
 *   2. serially awaits each per-repo scan (D-13-EXT-01)
 *   3. partial failure: completed/failed counters correct (D-13-05)
 *   4. perRepoResults carries error code for failed entries (Pitfall 7 guard)
 *   5. currentRepoId + currentScanId update as the family progresses
 *   6. short-poll contract — synchronous register, fire-and-forget body (D-13-02)
 *   7. body runs the loop to completion (D-13-02)
 *   8. D-13-EXT-09: scans every FS-discovered repo, not just registered subset
 *   9. D-13-EXT-09: returns FAMILY_HAS_NO_REPOS when ~/Sourcecode/{family}/ is empty
 *  10. WARNING #3: rejects a second family scan for the same family while one runs
 *  11. WARNING #3: allows different-family scans to overlap
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

import { startFamilyScan } from '../lib/gitnexusFamilyScan.js'
import { _resetForTests, getScanJob } from '../lib/gitnexusScan.js'

// ── Mock setup ─────────────────────────────────────────────────────────────────
// Mock coverageSpawn so tests don't invoke a real subprocess.
vi.mock('./coverageSpawn.js', () => ({
  spawnGitNexusAnalyze: vi.fn().mockResolvedValue({ kind: 'ok', stdout: '' }),
  resolveGitNexusBin: vi.fn().mockResolvedValue('/usr/local/bin/gitnexus'),
  buildWikiCompileClipboardString: vi.fn(),
  buildWorkflowUpdateClipboardString: vi.fn(),
  buildClaudeMdHelpUrl: vi.fn(),
  buildGitnexusInstallClipboardString: vi.fn(),
}))

// Mock registry — startScan still calls readRegistry as a first lookup before
// falling back to deterministicRepoRoot. Tests rely on the FS fallback path
// after D-13-EXT-09, so the registry can stay empty.
vi.mock('./registry.js', () => ({
  readRegistry: vi.fn().mockReturnValue({ version: 1, projects: [] }),
  writeRegistry: vi.fn(),
  withRegistryLock: vi.fn(),
  assertRegistrationAllowed: vi.fn(),
  RegistrationPathBlocked: class RegistrationPathBlocked extends Error {},
}))

import { spawnGitNexusAnalyze } from './coverageSpawn.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

interface FakeHomeFixture {
  fakeHome: string
  stashedHome: string | undefined
  cleanup: () => void
}

/** Create a tmpdir, override HOME, mkdir the per-family repo dirs. */
function setupFakeHomeWithRepos(family: string, repos: readonly string[]): FakeHomeFixture {
  const fakeHome = mkdtempSync(join(tmpdir(), 'family-scan-test-'))
  const stashedHome = process.env.HOME
  process.env.HOME = fakeHome
  for (const repo of repos) {
    mkdirSync(join(fakeHome, 'Sourcecode', family, repo), { recursive: true })
  }
  return {
    fakeHome,
    stashedHome,
    cleanup: () => {
      if (stashedHome !== undefined) process.env.HOME = stashedHome
      else delete process.env.HOME
      try { rmSync(fakeHome, { recursive: true, force: true }) } catch { /* best-effort */ }
    },
  }
}

/** Legacy stub: the third argument to startFamilyScan is deprecated post-D-13-EXT-09.
 *  Tests still pass it for positional-compat; the value is ignored by the implementation. */
function deprecatedRegistryArg() {
  return { entries: [] as ReadonlyArray<{ id: string; root: string; client: string | null }> }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('startFamilyScan() — D-13-04 sequential family scan orchestration', () => {
  let fixture: FakeHomeFixture | undefined

  beforeEach(() => {
    _resetForTests()
    vi.mocked(spawnGitNexusAnalyze).mockResolvedValue({ kind: 'ok', stdout: '' })
  })

  afterEach(() => {
    vi.useRealTimers()
    fixture?.cleanup()
    fixture = undefined
    _resetForTests()
  })

  it('iterates repos in alphabetical order (D-13-04)', async () => {
    const repos = ['zzz-repo', 'aaa-repo', 'mmm-repo']
    fixture = setupFakeHomeWithRepos('agenticapps', repos)

    const spawnOrder: string[] = []
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async (repoPath: string) => {
      const parts = repoPath.split(sep)
      spawnOrder.push(parts[parts.length - 1] ?? repoPath)
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    const result = startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())

    expect(result.ok).toBe(true)
    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })
    expect(spawnOrder).toEqual(['aaa-repo', 'mmm-repo', 'zzz-repo'])

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.perRepoResults.map((r) => r.repoId.split('/')[1])).toEqual([
        'aaa-repo',
        'mmm-repo',
        'zzz-repo',
      ])
    }
  })

  it('serially awaits each per-repo scan — no temporal overlap between spawns', async () => {
    const repos = ['repo-a', 'repo-b', 'repo-c']
    fixture = setupFakeHomeWithRepos('factiv', repos)

    let inFlight = 0
    let maxConcurrent = 0

    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      inFlight++
      maxConcurrent = Math.max(maxConcurrent, inFlight)
      await new Promise<void>((r) => setTimeout(r, 5))
      inFlight--
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    startFamilyScan(familyScanId, 'factiv', deprecatedRegistryArg())

    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })

    expect(maxConcurrent).toBe(1)
  })

  it('partial failure (3 repos, 1 fails): state.completed=2 and state.failed=1 (D-13-05)', async () => {
    const repos = ['alpha', 'beta', 'gamma']
    fixture = setupFakeHomeWithRepos('neuroflash', repos)

    let callCount = 0
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      callCount++
      if (callCount === 2) {
        return { kind: 'error' as const, exitCode: 1, stderr: '' }
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    const result = startFamilyScan(familyScanId, 'neuroflash', deprecatedRegistryArg())

    expect(result.ok).toBe(true)

    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.state).toBe('done')
      expect(job.completed).toBe(2)
      expect(job.failed).toBe(1)
    }
  })

  it('perRepoResults carries error code for the failed entry (D-13-05 Pitfall 7 guard)', async () => {
    const repos = ['alpha', 'beta', 'gamma']
    fixture = setupFakeHomeWithRepos('neuroflash', repos)

    let callCount = 0
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      callCount++
      if (callCount === 2) {
        return { kind: 'error' as const, exitCode: 1, stderr: '' }
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    startFamilyScan(familyScanId, 'neuroflash', deprecatedRegistryArg())

    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.perRepoResults[0]?.state).toBe('done')
      expect(job.perRepoResults[1]?.state).toBe('error')
      expect(job.perRepoResults[1]?.error?.code).toBe('SCAN_FAILED')
      expect(job.perRepoResults[2]?.state).toBe('done')
    }
  })

  it('currentRepoId + currentScanId update as the family progresses', async () => {
    const repos = ['alpha', 'beta']
    fixture = setupFakeHomeWithRepos('agenticapps', repos)

    const observedCurrentRepoIds: (string | null)[] = []
    const familyScanId = randomUUID()

    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      const job = getScanJob(familyScanId)
      if (job?.kind === 'family') {
        observedCurrentRepoIds.push(job.currentRepoId)
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())

    await vi.waitFor(() => {
      const job = getScanJob(familyScanId)
      expect(job?.kind === 'family' && job.state === 'done').toBe(true)
    }, { timeout: 10_000 })

    expect(observedCurrentRepoIds).toEqual([
      'agenticapps/alpha',
      'agenticapps/beta',
    ])

    const finalJob = getScanJob(familyScanId)
    if (finalJob?.kind === 'family') {
      expect(finalJob.currentRepoId).toBeNull()
      expect(finalJob.currentScanId).toBeNull()
      expect(finalJob.state).toBe('done')
    }
  })
})

// ── Gap 2 / D-13-02 short-poll contract ───────────────────────────────────────

describe('startFamilyScan — D-13-02 short-poll contract (Gap 2)', () => {
  let fixture: FakeHomeFixture | undefined

  beforeEach(() => {
    _resetForTests()
  })

  afterEach(() => {
    fixture?.cleanup()
    fixture = undefined
    _resetForTests()
  })

  it('returns synchronously (NOT a Promise) and registers the family job immediately', async () => {
    fixture = setupFakeHomeWithRepos('agenticapps', ['repoA', 'repoB'])
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 500))
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    const t0 = Date.now()
    const result = startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())
    const t1 = Date.now()

    expect(t1 - t0).toBeLessThan(50)
    expect(result).not.toBeInstanceOf(Promise)
    expect(result.ok).toBe(true)

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    expect(job?.state).toBe('running')

    await vi.waitFor(
      () => { expect(getScanJob(familyScanId)?.state).toBe('done') },
      { timeout: 10_000 },
    )
  })

  it('startFamilyScanBody runs the for-of loop to completion (observable via scans Map transition)', async () => {
    fixture = setupFakeHomeWithRepos('agenticapps', ['repoA', 'repoB'])
    vi.mocked(spawnGitNexusAnalyze).mockResolvedValue({ kind: 'ok', stdout: '' })

    const familyScanId = randomUUID()
    const result = startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())
    expect(result.ok).toBe(true)

    await vi.waitFor(
      () => {
        const job = getScanJob(familyScanId)
        expect(job?.state).toBe('done')
      },
      { timeout: 10_000 },
    )
    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.completed + job.failed).toBe(job.total)
    }
  })
})

// ── D-13-EXT-09: FS-aligned source-of-truth (Codex WARNING #1) ────────────────

describe('startFamilyScan — D-13-EXT-09 FS-aligned source (Codex WARNING #1)', () => {
  let fixture: FakeHomeFixture | undefined

  beforeEach(() => {
    _resetForTests()
    vi.mocked(spawnGitNexusAnalyze).mockResolvedValue({ kind: 'ok', stdout: '' })
  })

  afterEach(() => {
    fixture?.cleanup()
    fixture = undefined
    _resetForTests()
  })

  it('scans every FS-discovered repo, NOT just the registered subset', async () => {
    fixture = setupFakeHomeWithRepos('agenticapps', ['alpha', 'beta', 'gamma'])

    const familyScanId = randomUUID()
    const result = startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())
    expect(result.ok).toBe(true)

    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.total).toBe(3)
      const ids = job.perRepoResults.map((r) => r.repoId).sort()
      expect(ids).toEqual([
        'agenticapps/alpha',
        'agenticapps/beta',
        'agenticapps/gamma',
      ])
    }
  })

  it('returns FAMILY_HAS_NO_REPOS when ~/Sourcecode/{family}/ is empty', () => {
    fixture = setupFakeHomeWithRepos('agenticapps', []) // creates HOME but no repos under family/
    // Also ensure the family dir itself exists but is empty
    mkdirSync(join(fixture.fakeHome, 'Sourcecode', 'agenticapps'), { recursive: true })

    const result = startFamilyScan(randomUUID(), 'agenticapps', deprecatedRegistryArg())
    expect(result).toEqual({ ok: false, code: 'FAMILY_HAS_NO_REPOS' })
  })

  it('returns FAMILY_HAS_NO_REPOS when ~/Sourcecode/{family}/ does not exist at all', () => {
    fixture = setupFakeHomeWithRepos('factiv', ['some-repo']) // create some OTHER family
    // Scanning a different family with no dir
    const result = startFamilyScan(randomUUID(), 'neuroflash', deprecatedRegistryArg())
    expect(result).toEqual({ ok: false, code: 'FAMILY_HAS_NO_REPOS' })
  })

  it('skips dotfile entries (.git, .DS_Store) under the family root', async () => {
    fixture = setupFakeHomeWithRepos('agenticapps', ['real-repo'])
    // Add a hidden entry that should be skipped
    mkdirSync(join(fixture.fakeHome, 'Sourcecode', 'agenticapps', '.git'), { recursive: true })
    mkdirSync(join(fixture.fakeHome, 'Sourcecode', 'agenticapps', '.DS_Store'), { recursive: true })

    const familyScanId = randomUUID()
    const result = startFamilyScan(familyScanId, 'agenticapps', deprecatedRegistryArg())
    expect(result.ok).toBe(true)

    await vi.waitFor(() => {
      expect(getScanJob(familyScanId)?.state).toBe('done')
    }, { timeout: 10_000 })

    const job = getScanJob(familyScanId)
    if (job?.kind === 'family') {
      expect(job.total).toBe(1)
      expect(job.perRepoResults[0]?.repoId).toBe('agenticapps/real-repo')
    }
  })
})
