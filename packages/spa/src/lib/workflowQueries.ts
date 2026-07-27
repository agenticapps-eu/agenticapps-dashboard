import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  WorkflowHarnessResultSchema,
  WorkflowResponseSchema,
  type WorkflowHarnessRequest,
  type WorkflowHarnessResult,
  type WorkflowResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

export const WORKFLOW_QUERY_KEY = ['workflow'] as const
const WORKFLOW_HARNESS_RESULTS_QUERY_KEY = [
  'workflow',
  'harness-results',
] as const

export function useWorkflow(): UseQueryResult<WorkflowResponse, Error> {
  return useQuery({
    queryKey: WORKFLOW_QUERY_KEY,
    queryFn: async () => {
      const result = await apiFetch('/api/v2/workflow', WorkflowResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useWorkflowHarnessResults(): UseQueryResult<
  WorkflowHarnessResult[],
  Error
> {
  return useQuery({
    queryKey: WORKFLOW_HARNESS_RESULTS_QUERY_KEY,
    queryFn: async () => {
      const result = await apiFetch(
        '/api/v2/workflow/harness',
        WorkflowHarnessResultSchema.array(),
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useRunWorkflowHarness(): UseMutationResult<
  WorkflowHarnessResult,
  Error,
  WorkflowHarnessRequest
> {
  return useMutation({
    mutationFn: async (request) => {
      const result = await apiFetch('/api/v2/workflow/harness', WorkflowHarnessResultSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
  })
}
