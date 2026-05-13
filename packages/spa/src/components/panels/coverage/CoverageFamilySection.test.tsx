/**
 * Test scaffold for CoverageFamilySection.tsx — sticky family header + rows + GitNexus install hint.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 *
 * CODEX HIGH-6 Option A: GitNexus install hint is rendered INSIDE each family header
 *   (not as a separate page-level banner). CoverageGitNexusBanner component is removed.
 * CODEX MED: aggregate counts semantics — each row counts ONCE in the highest-priority bucket only
 *   (worst-state-wins per row: missing > stale > fresh > not-applicable).
 */

import { describe, it } from 'vitest'

describe('CoverageFamilySection', () => {
  it.todo('renders sticky family header with family name and aggregate counts')
  it.todo(
    'aggregate counts reflect FILTERED rows using worst-state-wins per row (missing → stale → fresh → not-applicable)'
  )
  it.todo(
    'aggregate count semantics: each row counts ONCE in the highest-priority bucket only (CODEX MED — avoids double-counting rows with mixed column states)'
  )
  it.todo('collapse toggle button hides the table body when clicked')
  it.todo(
    "localStorage 'coverage:section-collapsed:<family>' key is written on collapse/expand toggle"
  )
  it.todo(
    "collapsed state is restored from localStorage 'coverage:section-collapsed:<family>' on mount"
  )
  it.todo(
    'renders GitNexus install hint inside family header when gitNexusInstalled=false (CODEX HIGH-6 Option A — was page-level banner before replan; now per-family inline)'
  )
})
