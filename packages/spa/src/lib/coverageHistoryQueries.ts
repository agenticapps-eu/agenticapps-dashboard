import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import {
  parseCoverageHistoryResponse,
  type CompatibleCoverageHistoryResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

export const COVERAGE_HISTORY_STALE_TIME_MS = 60 * 60 * 1000

export interface UseCoverageHistoryOptions {
  enabled?: boolean
}

export function useCoverageHistory(
  repoId: string,
  opts: UseCoverageHistoryOptions = {},
): UseQueryResult<CompatibleCoverageHistoryResponse, Error> {
  return useQuery({
    queryKey: ['coverageHistory', repoId],
    queryFn: async (): Promise<CompatibleCoverageHistoryResponse> => {
      const result = await apiFetch(
        `/api/coverage/history?repoId=${encodeURIComponent(repoId)}`,
        z.unknown(),
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      try {
        return parseCoverageHistoryResponse(result.data)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const path = error.issues[0]?.path
          throw new Error(
            `schema_drift:${path && path.length > 0 ? path.map(String).join('.') : '(root)'}`,
          )
        }
        throw new Error('schema_drift:coverage-history')
      }
    },
    staleTime: COVERAGE_HISTORY_STALE_TIME_MS,
    enabled: opts.enabled ?? true,
  })
}
