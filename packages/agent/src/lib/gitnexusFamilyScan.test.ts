/**
 * gitnexusFamilyScan.test.ts — GREEN tests for lib/gitnexusFamilyScan.ts.
 *
 * Plan 13-02 (Wave 2) — GREENed the Wave 0 RED scaffold.
 *
 * Test inventory (5 cases — family orchestration concerns, D-13-04/05):
 *   1. startFamilyScan() iterates repos in alphabetical order (D-13-04)
 *   2. startFamilyScan() serially awaits each per-repo scan (no overlap — D-13-EXT-01)
 *   3. On partial failure (3 repos, 1 fails): state.completed=2 and state.failed=1 (D-13-05)
 *   4. perRepoResults carries error code for the failed entry
 *   5. currentRepoId + currentScanId update as the family progresses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { homedir } from 'node:os'
import { sep } from 'node:path'
import { randomUUID } from 'node:crypto'

import { startFamilyScan } from '../lib/gitnexusFamilyScan.js'
import { _resetForTests, getScanJob } from '../lib/gitnexusScan.js'

const HOME = homedir()

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

// Mock registry — startScan calls readRegistry to resolve repoId → root
vi.mock('./registry.js', () => ({
  readRegistry: vi.fn(),
  writeRegistry: vi.fn(),
  withRegistryLock: vi.fn(),
  assertRegistrationAllowed: vi.fn(),
  RegistrationPathBlocked: class RegistrationPathBlocked extends Error {},
}))

import { readRegistry } from './registry.js'
import { spawnGitNexusAnalyze } from './coverageSpawn.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeEntry(family: string, repo: string) {
  return {
    id: `${family}-${repo}`,
    name: repo,
    root: `${HOME}${sep}Sourcecode${sep}${family}${sep}${repo}`,
    client: null,
    addedAt: new Date().toISOString(),
    tags: [],
  }
}

function fakeRegistry(entries: ReturnType<typeof fakeEntry>[]) {
  return { version: 1 as const, projects: entries }
}

function fakeRegistryForFamily(family: 'agenticapps' | 'factiv' | 'neuroflash', repos: string[]) {
  return fakeRegistry(repos.map((r) => fakeEntry(family, r)))
}

/** Build the registry shape expected by startFamilyScan */
function toRegistryArg(family: string, repos: string[]) {
  return {
    entries: repos.map((repo) => ({
      id: `${family}-${repo}`,
      root: `${HOME}${sep}Sourcecode${sep}${family}${sep}${repo}`,
      client: null,
    })),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('startFamilyScan() — D-13-04 sequential family scan orchestration', () => {
  beforeEach(() => {
    _resetForTests()
    vi.mocked(spawnGitNexusAnalyze).mockResolvedValue({ kind: 'ok', stdout: '' })
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetForTests()
  })

  it('iterates repos in alphabetical order (D-13-04)', async () => {
    const repos = ['zzz-repo', 'aaa-repo', 'mmm-repo']
    // Registry must have all three repos for startScan to find them
    vi.mocked(readRegistry).mockReturnValue(fakeRegistryForFamily('agenticapps', repos))

    const spawnOrder: string[] = []
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async (repoPath: string) => {
      // Extract repo name from path
      const parts = repoPath.split(sep)
      spawnOrder.push(parts[parts.length - 1] ?? repoPath)
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    const result = await startFamilyScan(
      familyScanId,
      'agenticapps',
      toRegistryArg('agenticapps', repos),
    )

    expect(result.ok).toBe(true)
    // Verify alphabetical order
    expect(spawnOrder).toEqual(['aaa-repo', 'mmm-repo', 'zzz-repo'])

    // Check final family job state
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
    vi.mocked(readRegistry).mockReturnValue(fakeRegistryForFamily('factiv', repos))

    let inFlight = 0
    let maxConcurrent = 0

    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      inFlight++
      maxConcurrent = Math.max(maxConcurrent, inFlight)
      // Small delay to simulate real work
      await new Promise<void>((r) => setTimeout(r, 5))
      inFlight--
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    await startFamilyScan(familyScanId, 'factiv', toRegistryArg('factiv', repos))

    // Sequential execution means max 1 concurrent spawn at a time
    expect(maxConcurrent).toBe(1)
  })

  it('partial failure (3 repos, 1 fails): state.completed=2 and state.failed=1 (D-13-05)', async () => {
    const repos = ['alpha', 'beta', 'gamma']
    vi.mocked(readRegistry).mockReturnValue(fakeRegistryForFamily('neuroflash', repos))

    let callCount = 0
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      callCount++
      // 2nd invocation (beta) fails
      if (callCount === 2) {
        return { kind: 'error' as const, exitCode: 1, stderr: '' }
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    const result = await startFamilyScan(
      familyScanId,
      'neuroflash',
      toRegistryArg('neuroflash', repos),
    )

    expect(result.ok).toBe(true)

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      expect(job.state).toBe('done')       // family never reports 'error' — D-13-05
      expect(job.completed).toBe(2)
      expect(job.failed).toBe(1)
    }
  })

  it('perRepoResults carries error code for the failed entry (D-13-05 Pitfall 7 guard)', async () => {
    const repos = ['alpha', 'beta', 'gamma']
    vi.mocked(readRegistry).mockReturnValue(fakeRegistryForFamily('neuroflash', repos))

    let callCount = 0
    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      callCount++
      if (callCount === 2) {
        return { kind: 'error' as const, exitCode: 1, stderr: '' }
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    const familyScanId = randomUUID()
    await startFamilyScan(familyScanId, 'neuroflash', toRegistryArg('neuroflash', repos))

    const job = getScanJob(familyScanId)
    expect(job?.kind).toBe('family')
    if (job?.kind === 'family') {
      // Alphabetical order: alpha (0), beta (1), gamma (2)
      expect(job.perRepoResults[0]?.state).toBe('done')
      expect(job.perRepoResults[1]?.state).toBe('error')
      expect(job.perRepoResults[1]?.error?.code).toBe('SCAN_FAILED')
      expect(job.perRepoResults[2]?.state).toBe('done')
    }
  })

  it('currentRepoId + currentScanId update as the family progresses', async () => {
    const repos = ['alpha', 'beta']
    vi.mocked(readRegistry).mockReturnValue(fakeRegistryForFamily('agenticapps', repos))

    const observedCurrentRepoIds: (string | null)[] = []

    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      // Capture currentRepoId from the family job at spawn time
      const allJobs = [...Array.from({ length: 0 })].map(() => null) // dummy
      // We can't directly enumerate scans, so we poll getScanJob with the familyScanId
      // which is captured in the closure below.
      return { kind: 'ok' as const, stdout: '' }
    })

    // Re-implement with family scan ID captured
    const familyScanId = randomUUID()

    vi.mocked(spawnGitNexusAnalyze).mockImplementation(async () => {
      const job = getScanJob(familyScanId)
      if (job?.kind === 'family') {
        observedCurrentRepoIds.push(job.currentRepoId)
      }
      return { kind: 'ok' as const, stdout: '' }
    })

    await startFamilyScan(familyScanId, 'agenticapps', toRegistryArg('agenticapps', repos))

    // During each spawn, currentRepoId should be the active repo
    expect(observedCurrentRepoIds).toEqual([
      'agenticapps/alpha',
      'agenticapps/beta',
    ])

    // After completion, currentRepoId should be null
    const finalJob = getScanJob(familyScanId)
    if (finalJob?.kind === 'family') {
      expect(finalJob.currentRepoId).toBeNull()
      expect(finalJob.currentScanId).toBeNull()
      expect(finalJob.state).toBe('done')
    }
  })
})
