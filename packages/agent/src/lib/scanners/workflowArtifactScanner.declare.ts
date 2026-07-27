import type { PathResolver } from '../coverageResolver.js'
import type {
  WorkflowArtifactId,
  WorkflowHostId,
} from './workflowFleetScanner.declare.js'

export type WorkflowArtifactState =
  | 'identical'
  | 'divergent'
  | 'missing'
  | 'unavailable'

export type WorkflowMarkerState =
  | 'valid'
  | 'absent'
  | 'invalid'
  | 'not-applicable'

export interface WorkflowVersionMarker {
  state: WorkflowMarkerState
  version: string | null
}

export interface WorkflowProvenance {
  state: 'valid' | 'absent' | 'invalid'
  commit: string | null
}

export interface WorkflowArtifactResult {
  artifactId: WorkflowArtifactId
  state: WorkflowArtifactState
  sha256: string | null
  referenceSha256: string | null
  marker: WorkflowVersionMarker
  provenance: WorkflowProvenance
}

export interface WorkflowHostArtifactSummary {
  hostId: WorkflowHostId
  artifacts: WorkflowArtifactResult[]
  migration: {
    kind: 'offered'
    highest: string | null
  }
}

export type WorkflowMachineRootId =
  | 'agenticapps-bin'
  | 'claude-skills'
  | 'codex-skills'
  | 'opencode-skills'
  | 'pi-skills'

export interface WorkflowMachineRootDefinition {
  id: WorkflowMachineRootId
  kind: 'artifacts' | 'skills'
  hostId?: WorkflowHostId
  skillTargetNames?: Readonly<Record<string, readonly string[]>>
}

export declare const WORKFLOW_MACHINE_ROOTS: readonly WorkflowMachineRootDefinition[]

export interface WorkflowMachineEntry {
  id: string
  state: 'present' | 'missing'
  artifact?: WorkflowArtifactResult
}

export interface WorkflowMachineRootResult {
  rootId: WorkflowMachineRootId
  state: 'present' | 'absent'
  entries: WorkflowMachineEntry[]
}

export interface WorkflowMachineRootOptions {
  coreRepoRoot?: string
  expectedSkillIds?: readonly string[]
}

export declare function scanWorkflowHostArtifacts(
  hostId: WorkflowHostId,
  hostRepoRoot: string,
  coreRepoRoot: string,
  resolve: PathResolver,
): WorkflowHostArtifactSummary

export declare function scanWorkflowMachineRoot(
  rootId: WorkflowMachineRootId,
  rootPath: string,
  resolve: PathResolver,
  options?: WorkflowMachineRootOptions,
): WorkflowMachineRootResult
