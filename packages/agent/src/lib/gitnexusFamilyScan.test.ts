/**
 * gitnexusFamilyScan.test.ts — RED scaffold for lib/gitnexusFamilyScan.ts.
 *
 * Wave 2 (Plan 13-02) will GREEN these by creating:
 *   packages/agent/src/lib/gitnexusFamilyScan.ts  (sequential family-scan orchestrator)
 *
 * These tests import from the not-yet-existing module and intentionally fail
 * with "Cannot find module" — that is the RED state expected by Wave 0.
 *
 * Test inventory (5 cases — family orchestration concerns, D-13-04/05):
 *   1. startFamilyScan() iterates repos in alphabetical order (D-13-04)
 *   2. startFamilyScan() serially awaits each per-repo scan (no overlap — D-13-EXT-01)
 *   3. On partial failure (3 repos, 1 fails): state.completed=2 and state.failed=1 (D-13-05)
 *   4. perRepoResults carries error code for the failed entry
 *   5. currentRepoId + currentScanId update as the family progresses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── The module below does NOT exist yet (Wave 2 creates it). ─────────────────
// Importing it here produces "Cannot find module" — that is the RED state.
import { startFamilyScan } from '../lib/gitnexusFamilyScan.js'

describe('startFamilyScan() — D-13-04 sequential family scan orchestration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('iterates repos in alphabetical order (D-13-04)', async () => {
    // Wave 2 Plan 13-02 implements lib/gitnexusFamilyScan.ts.
    // Full assertion: capture spawn call order; verify localCompare alphabetical.
    expect(startFamilyScan).toBeDefined()
  })

  it('serially awaits each per-repo scan — no temporal overlap between spawns', async () => {
    // Wave 2 Plan 13-02 implements this.
    // Assertion: stub binary captures start timestamps; verify spawn[i+1].start >= spawn[i].end.
    // This exercises the D-13-EXT-01 global scan lock correctness.
    expect(startFamilyScan).toBeDefined()
  })

  it('partial failure (3 repos, 1 fails): state.completed=2 and state.failed=1 (D-13-05)', async () => {
    // Wave 2 Plan 13-02 implements this.
    // Uses stub-gitnexus-failing.sh with STUB_FAIL_ON_INVOCATION=2 to make the 2nd repo fail.
    // Final family job state: { completed: 2, failed: 1, state: 'done' }
    expect(startFamilyScan).toBeDefined()
  })

  it("perRepoResults carries error code for the failed entry (D-13-05 Pitfall 7 guard)", async () => {
    // Wave 2 Plan 13-02 implements this.
    // Assertion: perRepoResults[1].state === 'error' && perRepoResults[1].error.code === 'SCAN_FAILED'
    expect(startFamilyScan).toBeDefined()
  })

  it('currentRepoId + currentScanId update as the family progresses', async () => {
    // Wave 2 Plan 13-02 implements this.
    // Assertion: capture intermediate job state via getScanJob() during each iteration;
    // verify currentRepoId matches the active repo slug.
    expect(startFamilyScan).toBeDefined()
  })
})
