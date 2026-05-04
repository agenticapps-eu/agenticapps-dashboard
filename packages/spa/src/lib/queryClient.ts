import { QueryCache, QueryClient } from '@tanstack/react-query'

import { ApiError } from './api.js'
import type { RepairBus } from './repair.js'

export function createQueryClient(repair: Pick<RepairBus, 'setNeedsRepair'>): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Pitfall 4: only ApiError(401) flips the repair signal.
        // TypeError("Failed to fetch") is daemon-down, NOT re-pair — handled per-panel.
        // Pitfall 5: do NOT add a stale-data guard here (tk-dodo anti-pattern) —
        // the first 401 is the most important signal; it must never be silenced.
        if (error instanceof ApiError && error.status === 401) {
          repair.setNeedsRepair(true)
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: false, // D-07: no auto-retry
        refetchOnWindowFocus: false,
        staleTime: 5_000,
      },
    },
  })
}
