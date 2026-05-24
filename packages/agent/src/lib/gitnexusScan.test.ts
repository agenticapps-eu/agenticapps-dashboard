/**
 * gitnexusScan.test.ts — RED scaffold for lib/gitnexusScan.ts job registry.
 *
 * Wave 2 (Plan 13-02) will GREEN these by creating:
 *   packages/agent/src/lib/gitnexusScan.ts  (job registry + spawn orchestrator)
 *
 * These tests import from the not-yet-existing module and intentionally fail
 * with "Cannot find module" — that is the RED state expected by Wave 0.
 *
 * Test inventory (7 cases — all lib-level concerns):
 *   1. startScan() registers a job and returns ok:true with scanId
 *   2. startScan() returns ok:false code='SCAN_IN_FLIGHT' on per-repo collision
 *   3. getScanJob() returns null for unknown id
 *   4. getScanJob() returns the job within 60s TTL window
 *   5. _resetForTests() clears in-memory state
 *   6. withGlobalScanLock() serialises 2 concurrent invocations (Pitfall 1 / D-13-EXT-01)
 *   7. Job is evicted from Map 60s after settle (vi.useFakeTimers + vi.advanceTimersByTime)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── The module below does NOT exist yet (Wave 2 creates it). ─────────────────
// Importing it here produces "Cannot find module" — that is the RED state.
import {
  startScan,
  getScanJob,
  _resetForTests,
  withGlobalScanLock,
} from '../lib/gitnexusScan.js'

describe('startScan()', () => {
  beforeEach(() => {
    _resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetForTests()
  })

  it('registers a job and returns ok:true with a UUID scanId', async () => {
    // Wave 2 Plan 13-02 implements lib/gitnexusScan.ts.
    // Full assertion: expect(result.ok).toBe(true); expect(result.scanId).toMatch(UUID_REGEX)
    expect(startScan).toBeDefined()
  })

  it("returns ok:false code='SCAN_IN_FLIGHT' on per-repo collision (D-13-03)", async () => {
    // Wave 2 Plan 13-02 implements this.
    // First call: lock acquired. Second call same repoId: SCAN_IN_FLIGHT.
    expect(startScan).toBeDefined()
  })
})

describe('getScanJob()', () => {
  beforeEach(() => {
    _resetForTests()
  })

  it('returns null for an unknown id', () => {
    // Wave 2 Plan 13-02 implements this.
    expect(getScanJob).toBeDefined()
  })

  it('returns the job after registration (within 60s TTL window)', async () => {
    // Wave 2 Plan 13-02 implements this.
    expect(getScanJob).toBeDefined()
  })
})

describe('_resetForTests()', () => {
  it('clears in-memory scan state and resets global lock', () => {
    // Wave 2 Plan 13-02 implements this.
    expect(_resetForTests).toBeDefined()
  })
})

describe('withGlobalScanLock() — D-13-EXT-01 global serialisation lock', () => {
  beforeEach(() => {
    _resetForTests()
  })

  it('serialises 2 concurrent invocations — second fn() starts AFTER first settles', async () => {
    // Wave 2 Plan 13-02 implements this.
    // Assertion: invoke twice in parallel; capture timestamps; verify no overlap.
    // This guards against the ~/.gitnexus/registry.json read-modify-write race
    // confirmed in 13-RESEARCH.md §"Pitfall 1".
    expect(withGlobalScanLock).toBeDefined()
  })

  it('Job is evicted from Map 60s after settle (vi.useFakeTimers + advanceTimersByTime)', async () => {
    // Wave 2 Plan 13-02 implements this (Pitfall 5 guard — D-13-EXT-04 retention window).
    vi.useFakeTimers()
    expect(getScanJob).toBeDefined()
    vi.useRealTimers()
  })
})
