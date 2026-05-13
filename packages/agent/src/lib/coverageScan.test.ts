/**
 * Test scaffold for coverageScan.ts — orchestrator that fans out 5 scanners across all repos.
 * Plan 03 implements; Plan 01 provides the it.todo placeholders.
 *
 * Key contracts encoded as todos:
 * - AGREED-2: Promise.allSettled (NOT Promise.all) for partial-failure isolation
 * - CODEX HIGH-1: internal absPath stripped before returning CoverageResponse
 * - CODEX HIGH-3: scanners receive a `resolve` callback (no direct fs reads inside scanner code)
 * - CODEX LOW-19 + COV-03: cold-load performance < 1000ms for a 45-repo fixture set
 */

import { describe, it } from 'vitest'

describe('scanCoverage', () => {
  it.todo('fans out all 5 scanners across N repos in the discovered repo list')
  it.todo(
    'PROMISE.ALLSETTLED partial-failure isolation (AGREED-2): one scanner throwing yields a degraded row with reason, NOT a 500 crash'
  )
  it.todo(
    'STRIPS internal absPath before returning: CoverageResponse.rows[].absPath is undefined (CODEX HIGH-1)'
  )
  it.todo(
    'USES path-resolution helper: scanners receive a `resolve` callback for safe file access rather than direct fs reads (CODEX HIGH-3 — prevents scanner-level path traversal)'
  )
  it.todo('sets gitNexusInstalled=false in response when GitNexus binary is not detected')
  it.todo(
    'performance: cold scan over a 45-repo fixture set completes in < 1000ms (CODEX LOW-19 + COV-03)'
  )
})
