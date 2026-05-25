/**
 * gitnexusScan.test.ts — GREEN tests for lib/gitnexusScan.ts job registry.
 *
 * Plan 13-02 (Wave 2) — GREENed the Wave 0 RED scaffold.
 *
 * Test inventory (7 cases):
 *   1. startScan() registers a job and returns ok:true with scanId
 *   2. startScan() returns ok:false code='SCAN_IN_FLIGHT' on per-repo collision
 *   3. getScanJob() returns null for unknown id
 *   4. getScanJob() returns the job within 60s TTL window
 *   5. _resetForTests() clears in-memory state
 *   6. withGlobalScanLock() serialises concurrent invocations (D-13-EXT-01)
 *   7. Job is evicted from Map 60s after settle (vi.useFakeTimers + advanceTimersByTime)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { homedir } from 'node:os'
import { sep } from 'node:path'

import {
  startScan,
  getScanJob,
  _resetForTests,
  _setGitnexusBinForTests,
  withGlobalScanLock,
} from '../lib/gitnexusScan.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── Mock setup ─────────────────────────────────────────────────────────────────
// Mock coverageSpawn so tests don't invoke a real subprocess.
vi.mock('./coverageSpawn.js', () => ({
  spawnGitNexusAnalyze: vi.fn().mockResolvedValue({ kind: 'ok', stdout: '' }),
  resolveGitNexusBin: vi.fn().mockResolvedValue('/usr/local/bin/gitnexus'),
  // Re-export non-spawn exports as undefined stubs (used by other modules)
  buildWikiCompileClipboardString: vi.fn(),
  buildWorkflowUpdateClipboardString: vi.fn(),
  buildClaudeMdHelpUrl: vi.fn(),
  buildGitnexusInstallClipboardString: vi.fn(),
}))

// Mock registry so we can control which repos are "registered"
vi.mock('./registry.js', () => ({
  readRegistry: vi.fn(),
  writeRegistry: vi.fn(),
  withRegistryLock: vi.fn(),
  assertRegistrationAllowed: vi.fn(),
  RegistrationPathBlocked: class RegistrationPathBlocked extends Error {},
}))

import { readRegistry } from './registry.js'

const HOME = homedir()
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

describe('startScan()', () => {
  beforeEach(() => {
    _resetForTests()
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [fakeEntry('agenticapps', 'foo-repo')],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetForTests()
  })

  it('registers a job and returns ok:true with a UUID scanId', async () => {
    const scanId = crypto.randomUUID()
    const result = await startScan(scanId, { scope: 'repo', target: 'agenticapps/foo-repo' })
    expect(result.ok).toBe(true)
    // scanId was pre-generated; job should be in the map as 'running'
    const job = getScanJob(scanId)
    expect(job).not.toBeNull()
    expect(job?.kind).toBe('repo')
    expect(job?.state).toBe('running')
    // scanId in job should match
    expect(job?.scanId).toBe(scanId)
    expect(job?.scanId).toMatch(UUID_REGEX)
  })

  it("returns ok:false code='SCAN_IN_FLIGHT' on per-repo collision (D-13-03)", async () => {
    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()

    // First call acquires the per-repo lock
    const first = await startScan(id1, { scope: 'repo', target: 'agenticapps/foo-repo' })
    expect(first.ok).toBe(true)

    // Second call on the SAME repo should return SCAN_IN_FLIGHT
    const second = await startScan(id2, { scope: 'repo', target: 'agenticapps/foo-repo' })
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.code).toBe('SCAN_IN_FLIGHT')
    }
  })

  it('returns ok:false REPO_NOT_REGISTERED for unknown repoId', async () => {
    const scanId = crypto.randomUUID()
    const result = await startScan(scanId, { scope: 'repo', target: 'agenticapps/unknown-repo' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('REPO_NOT_REGISTERED')
    }
  })
})

// ── Phase 13 D-13-EXT-08: deterministic ~/Sourcecode/{family}/{repo} fallback ──
// Supersedes D-13-EXT-07. When the target repo is not in the dashboard registry,
// startScan falls back to resolving ~/Sourcecode/{family}/{repo}. If that
// directory exists on disk, the scan proceeds against it. Otherwise REPO_NOT_REGISTERED.
// T-13-02-01 mitigation preserved by the schema regex on req.target.

describe('startScan() — D-13-EXT-08 deterministic ~/Sourcecode/{family}/{repo} fallback', () => {
  let tmpHome: string
  let origHome: string | undefined

  beforeEach(async () => {
    _resetForTests()
    // Registry is EMPTY — no projects registered with the dashboard.
    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] })

    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    tmpHome = mkdtempSync(join(tmpdir(), 'gitnexus-fallback-test-'))
    origHome = process.env.HOME
    process.env.HOME = tmpHome
  })

  afterEach(async () => {
    if (origHome !== undefined) {
      process.env.HOME = origHome
    } else {
      delete process.env.HOME
    }
    const { rmSync } = await import('node:fs')
    rmSync(tmpHome, { recursive: true, force: true })
    _resetForTests()
  })

  it('resolves ~/Sourcecode/{family}/{repo} when not in registry but directory exists (D-13-EXT-08)', async () => {
    const { mkdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const repoPath = join(tmpHome, 'Sourcecode', 'agenticapps', 'foo-repo')
    mkdirSync(repoPath, { recursive: true })

    const scanId = crypto.randomUUID()
    const result = await startScan(scanId, { scope: 'repo', target: 'agenticapps/foo-repo' })

    expect(result.ok).toBe(true)
    // Job registered, spawn (mocked) settles ok
    const job = getScanJob(scanId)
    expect(job).not.toBeNull()
    expect(job?.kind).toBe('repo')
  })

  it('returns REPO_NOT_REGISTERED when both registry miss AND ~/Sourcecode/{family}/{repo} does not exist', async () => {
    // Note: tmpHome contains no Sourcecode/ tree at all
    const scanId = crypto.randomUUID()
    const result = await startScan(scanId, { scope: 'repo', target: 'agenticapps/does-not-exist' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('REPO_NOT_REGISTERED')
    }
  })
})

describe('getScanJob()', () => {
  beforeEach(() => {
    _resetForTests()
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [fakeEntry('agenticapps', 'foo-repo')],
    })
  })

  it('returns null for an unknown id', () => {
    const result = getScanJob('no-such-id')
    expect(result).toBeNull()
  })

  it('returns the job after registration (within 60s TTL window)', async () => {
    const scanId = crypto.randomUUID()
    await startScan(scanId, { scope: 'repo', target: 'agenticapps/foo-repo' })
    const job = getScanJob(scanId)
    expect(job).not.toBeNull()
    expect(job?.scanId).toBe(scanId)
  })
})

describe('_resetForTests()', () => {
  it('clears in-memory scan state and resets global lock', async () => {
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [fakeEntry('factiv', 'bar-repo')],
    })
    const scanId = crypto.randomUUID()
    await startScan(scanId, { scope: 'repo', target: 'factiv/bar-repo' })
    expect(getScanJob(scanId)).not.toBeNull()

    _resetForTests()
    expect(getScanJob(scanId)).toBeNull()
  })
})

describe('withGlobalScanLock() — D-13-EXT-01 global serialisation lock', () => {
  beforeEach(() => {
    _resetForTests()
  })

  it('serialises concurrent invocations — maxConcurrent === 1', async () => {
    let inFlight = 0
    let maxConcurrent = 0

    async function work() {
      await withGlobalScanLock(async () => {
        inFlight++
        maxConcurrent = Math.max(maxConcurrent, inFlight)
        await new Promise<void>((r) => setTimeout(r, 10))
        inFlight--
      })
    }

    await Promise.all([work(), work(), work()])
    expect(maxConcurrent).toBe(1)
  })

  it('Job is evicted from Map 60s after settle (vi.useFakeTimers + advanceTimersByTime)', async () => {
    vi.useFakeTimers()
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [fakeEntry('agenticapps', 'foo-repo')],
    })

    const { spawnGitNexusAnalyze } = await import('./coverageSpawn.js')
    // Mock spawn to resolve immediately so the job settles and schedules eviction
    vi.mocked(spawnGitNexusAnalyze).mockResolvedValue({ kind: 'ok', stdout: '' })

    const scanId = crypto.randomUUID()
    await startScan(scanId, { scope: 'repo', target: 'agenticapps/foo-repo' })

    // Job is 'running' immediately
    expect(getScanJob(scanId)).not.toBeNull()

    // Let the fire-and-forget spawn settle by running all pending microtasks
    await vi.runAllTimersAsync()

    // Job still exists (within the 60s window)
    // advance past the 60s eviction window
    vi.advanceTimersByTime(60_001)

    // Job should be evicted now
    expect(getScanJob(scanId)).toBeNull()

    vi.useRealTimers()
  })
})
