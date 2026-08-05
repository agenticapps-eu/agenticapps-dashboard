export { HealthResponseSchema } from './schemas/health.js'
export type { HealthResponse } from './schemas/health.js'
export { TokenSchema, AuthFileSchema } from './schemas/auth.js'
export type { AuthFile } from './schemas/auth.js'
export {
  RegistryEntrySchema,
  RegistryFileSchema,
  RegistryListItemSchema,
  OpenChangeSummarySchema,
  ProjectConditionSchema,
  RegistryListResponseSchema,
  RegisterResponseSchema,
  StatusResponseSchema,
  RegisterPrepareRequestSchema,
  RegisterPrepareResponseSchema,
  RegisterConfirmRequestSchema,
  RegisterConfirmResponseSchema,
  RenameRequestSchema,
  TagsRequestSchema,
} from './schemas/registry.js'
export type {
  RegistryEntry,
  RegistryFile,
  RegistryListItem,
  OpenChangeSummary,
  ProjectCondition,
  RegistryListResponse,
  RegisterResponse,
  StatusResponse,
  RegisterPrepareRequest,
  RegisterPrepareResponse,
  RegisterPrepareAllowed,
  RegisterPrepareBlocked,
  RegisterPrepareAlreadyRegistered,
  RegisterConfirmRequest,
  RegisterConfirmResponse,
  RenameRequest,
  TagsRequest,
} from './schemas/registry.js'
export { ProjectOverviewSchema, MarkersSchema } from './schemas/overview.js'
export type { ProjectOverview, Markers } from './schemas/overview.js'
// `OpenspecArchivedChangeSchema` is gone with the reader's archive enumeration
// — see the note on OpenspecProjectStateSchema. The lifecycle change board has
// its own archived-entry shape in ./schemas/changes.js.
export {
  OpenspecProjectStateSchema,
  OpenspecChangeDetailSchema,
  OpenspecCapabilitySchema,
} from './schemas/openspec.js'
export type {
  OpenspecProjectState,
  OpenspecChangeDetail,
  OpenspecCapability,
} from './schemas/openspec.js'
export {
  CHECK_IDS,
  CHECK_STATUSES,
  CheckIdSchema,
  CheckStatusSchema,
  CheckSourceSchema,
  CheckResultSchema,
  ReadinessNoticeSchema,
  RepoFamilySchema,
  RepoRelativePathSchema,
  RepoSummarySchema,
  RepoDetailSchema,
  FleetResponseSchema,
  RepoDetailResponseSchema,
  ReadinessFileSchema,
  computeReady,
  carriesAbsolutePath,
  wireSafeText,
  ADVISORY_WHEN_UNDECLARED,
  isAdvisoryCheck,
} from './schemas/readiness.js'
export type {
  CheckId,
  CheckStatus,
  CheckSource,
  CheckResult,
  ReadinessNotice,
  AdvisoryCheckId,
  RepoFamily,
  RepoSummary,
  RepoDetail,
  FleetResponse,
  RepoDetailResponse,
  ReadinessFile,
  ReadinessDeclaration,
} from './schemas/readiness.js'
export {
  ALLOWED_SUBDIRS,
  isReadableProjectPath,
  ReadResponseSchema,
} from './schemas/read.js'
export type { ReadResponse } from './schemas/read.js'
export { GitResponseSchema } from './schemas/git.js'
export type { GitResponse } from './schemas/git.js'
export { ErrorResponseSchema } from './schemas/errors.js'
export type { ErrorResponse } from './schemas/errors.js'
export { ServerInfoSchema } from './schemas/server.js'
export type { ServerInfo } from './schemas/server.js'
export {
  PairingSchema,
  AgentUrlSchema,
  AGENT_URL_REGEX,
} from './schemas/pairing.js'
export type { Pairing } from './schemas/pairing.js'
export { CommitmentBlockResponseSchema } from './schemas/commitment.js'
export type { CommitmentBlockResponse } from './schemas/commitment.js'
export {
  HookFiringSchema,
  ObservationsRecentResponseSchema,
} from './schemas/observations.js'
export type {
  HookFiring,
  ObservationsRecentResponse,
} from './schemas/observations.js'
export {
  RationalizationRowSchema,
  DisciplineResponseSchema,
} from './schemas/discipline.js'
export type {
  RationalizationRow,
  DisciplineResponse,
} from './schemas/discipline.js'
/*
 * `phaseDetail` and `security` schemas are gone with the GSD phase reader. Both
 * described the centre column's phase-artifact payloads — the checklist, the
 * TDD timeline, two-stage review findings, the /cso + database-sentinel
 * summaries, and verification detail — and every one of them was parsed out of
 * `.planning/phases/<N>/`. The `Phase Progress Column` requirement they served
 * is REMOVED by this change; `Change Progress Column` replaces it.
 */
/*
 * The `agentlinter`, `integrations`, `sentry`, `linear`, `observability` and
 * `secrets` schemas are gone with the eleven withdrawn daemon route modules.
 * Each described the wire shape of an endpoint `retire-v1-surfaces` removes,
 * and none had a second reader. `env.ts` (EnvFileSchema) was never re-exported
 * here (T-08-01/INV-05/D-08-13) and is reached through `daemon.ts`.
 */
export {
  SkillFrontmatterSchema,
  SkillEntrySchema,
  GlobalSkillsResponseSchema,
  LocalSkillsResponseSchema,
} from './schemas/skills.js'
export type {
  SkillFrontmatter,
  SkillEntry,
  GlobalSkillsResponse,
  LocalSkillsResponse,
} from './schemas/skills.js'
/*
 * The `coverage`, `coverageHistory` and `skillDrift` schemas are gone with the
 * fleet-coverage and skills-and-linting surfaces. The conformance surface's
 * tier, day-point and response shapes went with it; its path-drift and
 * fix-path shapes did not, because `retire-v1-surfaces` §2 retains registry
 * drift detection and the strict atomic repair endpoint. Those three moved to
 * `schemas/pathDrift.ts`, which is where they always belonged.
 */
export {
  PathDriftReasonSchema,
  PathDriftEntrySchema,
  RegistryFixPathRequestSchema,
} from './schemas/pathDrift.js'
export type {
  PathDriftReason,
  PathDriftEntry,
  RegistryFixPathRequest,
} from './schemas/pathDrift.js'

export {
  WorkflowResponseSchema,
  WorkflowHarnessRequestSchema,
  WorkflowHarnessResultSchema,
} from './schemas/workflow.js'
export type {
  WorkflowResponse,
  WorkflowHarnessRequest,
  WorkflowHarnessResult,
} from './schemas/workflow.js'

export { buildUnderstandCommand } from './clipboard.js'
export type { UnderstandCommand } from './clipboard.js'

// add-agent-change-board — the fleet OpenSpec change board's wire contract.
export {
  CHANGE_STAGES,
  CHANGE_SOURCES,
  CHANGE_NOTICE_KINDS,
  CHANGE_READ_FAILURES,
  ChangeStageSchema,
  ChangeSourceSchema,
  ChangeArtifactsSchema,
  ChangeChecklistRowSchema,
  ChangeCardSchema,
  ChangeNoticeKindSchema,
  ChangeNoticeSchema,
  ChangeReadFailureSchema,
  ChangeRepositoryStatusSchema,
  ChangesFleetResponseSchema,
  cardKey,
  compareChangeCards,
  fleetReadState,
} from './schemas/changes.js'
export type {
  ChangeStage,
  ChangeSource,
  ChangeArtifacts,
  ChangeChecklistRow,
  ChangeCard,
  ChangeNoticeKind,
  ChangeNotice,
  ChangeReadFailure,
  ChangeRepositoryStatus,
  ChangesFleetResponse,
} from './schemas/changes.js'
