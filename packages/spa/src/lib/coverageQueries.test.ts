/**
 * Test scaffold for coverageQueries.ts — useCoverage + useCoverageRefresh TanStack Query hooks.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 */

import { describe, it } from 'vitest'

describe('useCoverage', () => {
  it.todo('fetches /api/coverage via apiFetch + parseOrDrift — returns CoverageResponse on success')
  it.todo('staleTime === 30_000ms (30s TTL matching daemon cache)')
  it.todo('surfaces SchemaDriftState when daemon response fails CoverageResponseSchema.parse')
})

describe('useCoverageRefresh', () => {
  it.todo('POSTs to /api/coverage/refresh with body { family, repo, action: "gitnexus-analyze" }')
  it.todo('onSuccess: invalidates useCoverage query key to trigger refetch')
})
