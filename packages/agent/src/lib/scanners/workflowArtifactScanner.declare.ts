import type { PathResolver } from '../coverageResolver.js'
import type {
  WorkflowArtifactId,
  WorkflowHostId,
} from './workflowFleetScanner.declare.js'

export type WorkflowArtifactState =
  | 'identical'
  | 'divergent'
  | 'missing'
  | 'pinned'
  | 'unavailable'

/**
 * How a host distributes a shared artefact it does not vendor.
 *
 * - `intact`   the manifest's recorded digest equals core's CURRENT reference
 * - `behind`   it does not — the host is pinned to something other than the
 *              current reference. Deliberately not "wrong": a stale pin and a
 *              dishonest one are indistinguishable without reading core at the
 *              pinned commit, which needs git and is out of scope.
 * - `unlisted` the manifest is valid but omits an artefact this host publishes
 * - `invalid`  no `core_commit`, more than one, or not a full commit id
 * - `not-declared` the host carries no manifest — it vendors, which is fine
 */
export type WorkflowPinState =
  | 'intact'
  | 'behind'
  | 'unlisted'
  | 'invalid'
  | 'not-declared'

export interface WorkflowPin {
  state: WorkflowPinState
  commit: string | null
  recordedSha256: string | null
}

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
  pin: WorkflowPin
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
  coreRepoRoot: string | undefined,
  resolve: PathResolver,
): WorkflowHostArtifactSummary

export declare function scanWorkflowMachineRoot(
  rootId: WorkflowMachineRootId,
  rootPath: string,
  resolve: PathResolver,
  options?: WorkflowMachineRootOptions,
): WorkflowMachineRootResult
