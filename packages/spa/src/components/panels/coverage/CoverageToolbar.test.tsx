/**
 * Test scaffold for CoverageToolbar.tsx — filter chips + search + URL state.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 *
 * CODEX MED-15: at least one test must use REAL useNavigate + useSearch via TanStack Router
 *   test harness rather than mocking URL state.
 */

import { describe, it } from 'vitest'

describe('CoverageToolbar', () => {
  it.todo('renders with "All" chip selected by default (no status filter active)')
  it.todo(
    'toggling "missing" chip deselects the "all" chip and applies the missing status filter'
  )
  it.todo('toggling all 4 status chips off auto-re-selects the "all" chip')
  it.todo('search input applies debounce of 200ms before updating URL ?q= param')
  it.todo('URL ?status=stale&q=neuro round-trip: Toolbar reads from and writes to URL search params')
  it.todo(
    'INTEGRATION: URL ?status=&q= round-trip uses REAL useNavigate + useSearch (not mocks) via TanStack Router test harness (CODEX MED-15)'
  )
})
