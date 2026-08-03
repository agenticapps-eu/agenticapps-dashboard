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
export {
  OpenspecProjectStateSchema,
  OpenspecChangeDetailSchema,
  OpenspecCapabilitySchema,
  OpenspecArchivedChangeSchema,
} from './schemas/openspec.js'
export type {
  OpenspecProjectState,
  OpenspecChangeDetail,
  OpenspecCapability,
  OpenspecArchivedChange,
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
export {
  AgentLinterSeveritySchema,
  AgentLinterDiagnosticSchema,
  AgentLinterCategoryScoreSchema,
  AgentLinterReportSchema,
  AgentLinterResponseSchema,
} from './schemas/agentlinter.js'
export type {
  AgentLinterSeverity,
  AgentLinterDiagnostic,
  AgentLinterCategoryScore,
  AgentLinterReport,
  AgentLinterResponse,
} from './schemas/agentlinter.js'
export {
  IntegrationStateSchema,
  IntegrationsResponseSchema,
} from './schemas/integrations.js'
export type {
  IntegrationState,
  IntegrationsResponse,
} from './schemas/integrations.js'
// Phase 8 — Sentry + Linear shared wire schemas (INV-04)
// Note: env.ts (EnvFileSchema) is intentionally NOT re-exported here (T-08-01/INV-05/D-08-13)
export {
  SentryIssueSchema,
  SentryRecentResponseSchema,
} from './schemas/sentry.js'
export type {
  SentryIssue,
  SentryRecentResponse,
} from './schemas/sentry.js'
export {
  LinearIssueSchema,
  LinearIssuesResponseSchema,
} from './schemas/linear.js'
export type {
  LinearIssue,
  LinearIssuesResponse,
} from './schemas/linear.js'
export {
  ObservabilitySignalSchema,
  ObservabilityToolStateSchema,
  ObservabilityResponseSchema,
} from './schemas/observability.js'
export type {
  ObservabilitySignal,
  ObservabilityToolState,
  ObservabilityResponse,
} from './schemas/observability.js'
export { SecretsResponseSchema } from './schemas/secrets.js'
export type { SecretsResponse } from './schemas/secrets.js'
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
export {
  CoverageStateSchema,
  CoverageFamilySchema,
  CoverageBasicColumnSchema,
  CoverageWorkflowColumnSchema,
  CoverageColumnStateSchema,
  OverrideEntrySchema,
  CoverageRowSchema,
  CoverageResponseSchema,
  parseCoverageResponse,
} from './schemas/coverage.js'
export type {
  CoverageState,
  CoverageFamily,
  CoverageColumnState,
  CoverageRow,
  CoverageResponse,
  CompatibleCoverageRow,
  CompatibleCoverageResponse,
  OverrideEntry,
} from './schemas/coverage.js'
// Phase 11 — coverage trends + skill drift (D-11-12)
export {
  CoverageDriftDirectionSchema,
  CoverageCellDriftSchema,
  CoverageHistoryResponseSchema,
  parseCoverageHistoryResponse,
} from './schemas/coverageHistory.js'
export type {
  CoverageDriftDirection,
  CoverageCellDrift,
  CoverageHistoryResponse,
  CompatibleCoverageHistoryResponse,
} from './schemas/coverageHistory.js'

export {
  SkillDriftCellSchema,
  SkillDriftRowSchema,
  SkillDriftResponseSchema,
} from './schemas/skillDrift.js'
export type {
  SkillDriftCell,
  SkillDriftRow,
  SkillDriftResponse,
} from './schemas/skillDrift.js'

// Phase 12 — observability conformance surface (D-12-14/15/16)
export {
  ConformanceTierSchema,
  tierOf,
  ConformanceDayPointSchema,
  PathDriftReasonSchema,
  PathDriftEntrySchema,
  ConformanceResponseSchema,
  RegistryFixPathRequestSchema,
} from './schemas/conformance.js'
export type {
  ConformanceTier,
  ConformanceDayPoint,
  PathDriftReason,
  PathDriftEntry,
  ConformanceResponse,
  RegistryFixPathRequest,
} from './schemas/conformance.js'

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
