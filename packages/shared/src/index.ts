export { HealthResponseSchema } from './schemas/health.js'
export type { HealthResponse } from './schemas/health.js'
export { TokenSchema, AuthFileSchema } from './schemas/auth.js'
export type { AuthFile } from './schemas/auth.js'
export {
  RegistryEntrySchema,
  RegistryFileSchema,
  RegistryListItemSchema,
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
export {
  ProjectOverviewSchema,
  FindingCountsSchema,
  DbAuditFindingsSchema,
  MarkersSchema,
} from './schemas/overview.js'
export type {
  ProjectOverview,
  FindingCounts,
  DbAuditFindings,
  Markers,
} from './schemas/overview.js'
export { ReadResponseSchema } from './schemas/read.js'
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
export {
  PhaseFileStatusSchema,
  ExecutionTimelineEntrySchema,
  ReviewFindingCountsSchema,
  ReviewStatusPayloadSchema,
  VerificationStatusPayloadSchema,
  PhaseProgressResponseSchema,
} from './schemas/phaseDetail.js'
export type {
  PhaseFileStatus,
  ExecutionTimelineEntry,
  ReviewFindingCounts,
  ReviewStatusPayload,
  VerificationStatusPayload,
  PhaseProgressResponse,
} from './schemas/phaseDetail.js'
export {
  CsoSummarySchema,
  DbSentinelSummarySchema,
  SecurityResponseSchema,
} from './schemas/security.js'
export type {
  CsoSummary,
  DbSentinelSummary,
  SecurityResponse,
} from './schemas/security.js'
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
  GitNexusInstallStateSchema,
  CoverageFamilySchema,
  CoverageBasicColumnSchema,
  CoverageWorkflowColumnSchema,
  CoverageColumnStateSchema,
  OverrideEntrySchema,
  CoverageRowSchema,
  CoverageResponseSchema,
  CoverageRefreshActionSchema,
  CoverageRefreshRequestSchema,
  CoverageRefreshResponseSchema,
} from './schemas/coverage.js'
export type {
  CoverageState,
  GitNexusInstallState,
  CoverageFamily,
  CoverageColumnState,
  CoverageRow,
  CoverageResponse,
  CoverageRefreshAction,
  CoverageRefreshRequest,
  CoverageRefreshResponse,
  OverrideEntry,
} from './schemas/coverage.js'
// Phase 11 — coverage trends + skill drift (D-11-12)
export {
  CoverageDriftDirectionSchema,
  CoverageCellDriftSchema,
  CoverageHistoryResponseSchema,
} from './schemas/coverageHistory.js'
export type {
  CoverageDriftDirection,
  CoverageCellDrift,
  CoverageHistoryResponse,
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
  buildWikiCompileClipboardString,
  buildWorkflowUpdateClipboardString,
  buildClaudeMdHelpUrl,
  buildGitnexusInstallClipboardString,
  buildGitnexusIndexClipboardString,
} from './clipboard.js'
export type { GitnexusIndexCommand } from './clipboard.js'
