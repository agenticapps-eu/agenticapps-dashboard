export type WorkflowHarnessHostId =
  | 'claude-workflow'
  | 'codex-workflow'
  | 'opencode-workflow'
  | 'pi-agentic-apps-workflow'

export type WorkflowHarnessId = 'change-gate' | 'reviewer-cli'

export interface WorkflowHarnessRequest {
  hostId: WorkflowHarnessHostId
  harnessId: WorkflowHarnessId
}

export type WorkflowHarnessResultState =
  | 'completed'
  | 'refused'
  | 'busy'
  | 'timeout'
  | 'bounded-out'

export type WorkflowHarnessResultReason =
  | 'unknown-selection'
  | 'repo-unavailable'
  | 'path-not-allowed'
  | 'harness-missing'
  | 'harness-not-executable'
  | 'harness-divergent'
  | 'spawn-failed'
  | 'host-busy'
  | 'capacity-busy'
  | 'time-limit'
  | 'memory-limit'
  | 'output-limit'
  | 'scratch-limit'

export interface WorkflowHarnessResult {
  schemaVersion: 1
  hostId: WorkflowHarnessHostId
  harnessId: WorkflowHarnessId
  state: WorkflowHarnessResultState
  passed: boolean | null
  completedAtIso: string | null
  ageMs: number | null
  output: string
  cached: boolean
  reason?: WorkflowHarnessResultReason
}

export interface WorkflowHarnessLimits {
  timeoutMs: number
  memoryBytes: number
  outputBytes: number
  scratchBytes: number
  sampleIntervalMs: number
}

export interface WorkflowHarnessRunOptions {
  /** Relocates the fixed workflow source family; it cannot add repository IDs. */
  sourceFamilyRoot?: string
  /** Overrides the daemon-owned state root for isolated tests. */
  stateRoot?: string
  now?: () => Date
  limits?: Partial<WorkflowHarnessLimits>
  /**
   * Test-only seam used to replace a mapped path between the initial check and
   * the mandatory spawn-time revalidation.
   */
  beforeSpawn?: () => void | Promise<void>
}

export declare const WORKFLOW_HARNESS_LIMITS: Readonly<WorkflowHarnessLimits>

/** Execute exactly one fixed host/harness command after all preflight checks. */
export declare function runWorkflowHarness(
  request: WorkflowHarnessRequest,
  options?: WorkflowHarnessRunOptions,
): Promise<WorkflowHarnessResult>

/** Read a current content-keyed result without spawning a process. */
export declare function readWorkflowHarnessResult(
  request: WorkflowHarnessRequest,
  options?: WorkflowHarnessRunOptions,
): Promise<WorkflowHarnessResult | null>

/** Clear in-memory concurrency state between isolated tests. */
export declare function resetWorkflowHarnessStateForTests(): void
