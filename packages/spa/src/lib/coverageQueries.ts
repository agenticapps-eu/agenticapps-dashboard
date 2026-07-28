import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import {
  parseCoverageResponse,
  type CompatibleCoverageResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

export const COVERAGE_QUERY_KEYS = {
  matrix: ['coverage'] as const,
} as const

export const COVERAGE_STALE_TIME_MS = 30_000

export function useCoverage(): UseQueryResult<CompatibleCoverageResponse, Error> {
  return useQuery({
    queryKey: COVERAGE_QUERY_KEYS.matrix,
    queryFn: async (): Promise<CompatibleCoverageResponse> => {
      const result = await apiFetch('/api/coverage', z.unknown())
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      try {
        return parseCoverageResponse(result.data)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const path = error.issues[0]?.path
          throw new Error(
            `schema_drift:${path && path.length > 0 ? path.map(String).join('.') : '(root)'}`,
          )
        }
        throw new Error('schema_drift:coverage')
      }
    },
    staleTime: COVERAGE_STALE_TIME_MS,
    refetchInterval: COVERAGE_STALE_TIME_MS,
  })
}
