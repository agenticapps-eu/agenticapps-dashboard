/**
 * Test scaffold for CoveragePage.tsx — top-level coverage matrix page.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 *
 * Key contracts:
 * - CODEX HIGH-6 Option A: per-family GitNexus install hint inside family header (NO page-level banner)
 * - AGREED-4: batch-progress state { status, current, total } for RefreshAllStaleButton
 */

import { describe, it } from 'vitest'

describe('CoveragePage', () => {
  it.todo('renders PageHeader + CoverageToolbar + 3 family sections when data is available')
  it.todo('renders SchemaDriftState component when query returns schema drift error')
  it.todo('renders CoverageEmptyState with kind="no-repos" when rows array is empty')
  it.todo(
    'PER-FAMILY install hint when gitNexusInstalled=false rendered inside each family section (CODEX HIGH-6 Option A) — NO separate page-level banner component'
  )
  it.todo(
    'RefreshAllStaleButton is disabled (aria-disabled) when 0 stale rows are present in the current filter'
  )
  it.todo(
    'RefreshAllStaleButton: batch-progress state { status: "idle"|"running", current, total } drives "Refreshing N of M…" indicator (AGREED-4)'
  )
  it.todo(
    'RefreshAllStaleButton displays "Refreshing N of M…" text indicator while sequential for-of await loop runs through stale repos (AGREED-4)'
  )
  it.todo(
    'RefreshAllStaleButton uses for-of await sequential loop — NEVER Promise.all over spawnable actions (AGREED-4: avoids concurrent gitnexus-analyze overload)'
  )
})
