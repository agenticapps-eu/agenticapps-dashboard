import type { PathResolver } from '../coverageResolver.js'

export type WorkflowRepoId =
  | 'agenticapps-workflow-core'
  | 'claude-workflow'
  | 'codex-workflow'
  | 'opencode-workflow'
  | 'pi-agentic-apps-workflow'

export type WorkflowHostId = Exclude<WorkflowRepoId, 'agenticapps-workflow-core'>

export type WorkflowArtifactId =
  | 'change-gate'
  | 'reviewer-cli'
  | 'change-gate-harness'
  | 'reviewer-cli-harness'

export interface WorkflowSkillPath {
  id: string
  relativePath: string
  primary?: true
}

export type WorkflowSkillSource =
  | {
      kind: 'directory'
      relativeRoot: string
      primaryId: string
    }
  | {
      kind: 'explicit'
      skills: readonly WorkflowSkillPath[]
    }

export interface WorkflowFleetEntry {
  id: WorkflowRepoId
  role: 'core' | 'host'
  directoryName: WorkflowRepoId
  artifacts: Readonly<Record<WorkflowArtifactId, string>>
  skillSource?: WorkflowSkillSource
}

export declare const WORKFLOW_FLEET: readonly WorkflowFleetEntry[]

export type WorkflowSkillReason =
  | 'expected-skill-missing'
  | 'frontmatter-missing'
  | 'implements-spec-missing'
  | 'implements-spec-duplicate'
  | 'implements-spec-malformed'

export interface WorkflowSkillVersion {
  id: string
  name: string
  state: 'known' | 'unknown' | 'missing'
  version: string | null
  reason?: WorkflowSkillReason
}

export interface WorkflowSkillLaggard {
  id: string
  name: string
  version: string
}

export interface WorkflowHostSkillSummary {
  hostId: WorkflowHostId
  primary: WorkflowSkillVersion
  skills: WorkflowSkillVersion[]
  minimum: string | null
  maximum: string | null
  laggards: WorkflowSkillLaggard[]
  unknowns: WorkflowSkillVersion[]
  internallyConsistent: boolean
  coreState: 'current' | 'behind' | 'ahead' | 'unavailable'
  divergent: boolean
  explanationId?: string
}

export declare function requireWorkflowRepoId(identifier: string): WorkflowRepoId

export declare function scanWorkflowHostSkills(
  hostId: WorkflowHostId,
  hostRepoRoot: string,
  coreSpecVersion: string | null,
  resolve: PathResolver,
  options?: { explanationId?: string },
): WorkflowHostSkillSummary
