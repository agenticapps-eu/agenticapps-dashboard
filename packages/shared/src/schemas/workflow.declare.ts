import type { ZodType } from 'zod'

export type WorkflowHostId =
  | 'claude-workflow'
  | 'codex-workflow'
  | 'opencode-workflow'
  | 'pi-agentic-apps-workflow'

export type WorkflowArtifactId =
  | 'change-gate'
  | 'reviewer-cli'
  | 'change-gate-harness'
  | 'reviewer-cli-harness'

export interface WorkflowSkillWire {
  id: string
  name: string
  state: 'known' | 'unknown' | 'missing'
  version: string | null
  reason?: string
}

export interface WorkflowArtifactWire {
  artifactId: WorkflowArtifactId
  state: 'identical' | 'divergent' | 'missing' | 'unavailable'
  sha256: string | null
  referenceSha256: string | null
  marker: {
    state: 'valid' | 'absent' | 'invalid' | 'not-applicable'
    version: string | null
  }
  provenance: {
    state: 'valid' | 'absent' | 'invalid'
    commit: string | null
  }
}

export interface WorkflowHostWire {
  hostId: WorkflowHostId
  state: 'available' | 'missing'
  primary: WorkflowSkillWire | null
  skills: WorkflowSkillWire[]
  minimum: string | null
  maximum: string | null
  laggards: Array<{ id: string; name: string; version: string }>
  unknowns: WorkflowSkillWire[]
  internallyConsistent: boolean
  coreState: 'current' | 'behind' | 'ahead' | 'unavailable'
  divergent: boolean
  artifacts: WorkflowArtifactWire[]
  migration: {
    kind: 'offered'
    highest: string | null
  }
}

export interface WorkflowMachineRootWire {
  rootId:
    | 'agenticapps-bin'
    | 'claude-skills'
    | 'codex-skills'
    | 'opencode-skills'
    | 'pi-skills'
  state: 'present' | 'absent'
  entries: Array<{
    id: string
    state: 'present' | 'missing'
    artifact?: WorkflowArtifactWire
  }>
}

export interface WorkflowResponse {
  schemaVersion: 1
  generatedAtIso: string
  core: {
    repoId: 'agenticapps-workflow-core'
    state: 'available' | 'missing'
    specVersion: string | null
  }
  hosts: WorkflowHostWire[]
  machineRoots: WorkflowMachineRootWire[]
}

export declare const WorkflowResponseSchema: ZodType<WorkflowResponse>

export type WorkflowHarnessId = 'change-gate' | 'reviewer-cli'

export interface WorkflowHarnessRequest {
  hostId: WorkflowHostId
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
  hostId: WorkflowHostId
  harnessId: WorkflowHarnessId
  state: WorkflowHarnessResultState
  passed: boolean | null
  completedAtIso: string | null
  ageMs: number | null
  output: string
  cached: boolean
  reason?: WorkflowHarnessResultReason
}

export declare const WorkflowHarnessRequestSchema: ZodType<WorkflowHarnessRequest>
export declare const WorkflowHarnessResultSchema: ZodType<WorkflowHarnessResult>
