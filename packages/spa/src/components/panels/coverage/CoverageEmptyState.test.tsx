/**
 * Test scaffold for CoverageEmptyState.tsx — 4 empty-state branch renderer.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 *
 * Empty-state kinds:
 * - no-repos: No family roots found or all families missing
 * - no-gitnexus: GitNexus not installed globally (full-page treatment; per-family hint is inline in CoverageFamilySection)
 * - scan-failed: Daemon scan returned an error/degraded response
 * - no-results: Filter/search produced 0 matching rows
 */

import { describe, it } from 'vitest'

describe('CoverageEmptyState', () => {
  it.todo("renders no-repos empty state when kind='no-repos'")
  it.todo(
    "renders no-gitnexus empty state when kind='no-gitnexus' (full-page treatment; per-family inline hint rendered in CoverageFamilySection)"
  )
  it.todo("renders scan-failed empty state when kind='scan-failed' with retry CTA")
  it.todo("renders no-results empty state when kind='no-results' with clear-filter CTA")
})
