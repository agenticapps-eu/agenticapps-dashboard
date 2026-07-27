import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type {
  WorkflowHarnessRequest,
  WorkflowHarnessResult,
  WorkflowResponse,
} from '@agenticapps/dashboard-shared'

export declare const WORKFLOW_QUERY_KEY: readonly ['workflow']

/** Read the fixed workflow fleet. This query never starts a harness process. */
export declare function useWorkflow(): UseQueryResult<WorkflowResponse, Error>

/** Read current content-keyed harness results without starting a process. */
export declare function useWorkflowHarnessResults(): UseQueryResult<
  WorkflowHarnessResult[],
  Error
>

/** Run one fixed harness selection in direct response to a user action. */
export declare function useRunWorkflowHarness(): UseMutationResult<
  WorkflowHarnessResult,
  Error,
  WorkflowHarnessRequest
>
