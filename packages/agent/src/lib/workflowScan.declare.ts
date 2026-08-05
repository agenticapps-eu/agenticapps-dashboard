import type { WorkflowResponse } from '@agenticapps/dashboard-shared'

import type { WorkflowMachineRootId } from './scanners/workflowArtifactScanner.declare.js'

export interface WorkflowScanOptions {
  sourceFamilyRoot?: string
  machineRoots?: Partial<Record<WorkflowMachineRootId, string>>
  now?: () => Date
}

/**
 * Compose the fixed workflow fleet using settled reads.
 *
 * Missing repositories and machine roots are returned as data rather than
 * rejecting the whole scan.
 */
export declare function scanWorkflowFleet(
  options?: WorkflowScanOptions,
): Promise<WorkflowResponse>
