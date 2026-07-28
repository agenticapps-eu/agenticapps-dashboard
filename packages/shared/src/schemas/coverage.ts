import { z } from 'zod'

// Current live freshness vocabulary. The retired `not-applicable` value is
// accepted only by the private v1 compatibility schemas below.
export const CoverageStateSchema = z.enum(['fresh', 'stale', 'missing'])
export type CoverageState = z.infer<typeof CoverageStateSchema>

// 3 family identifiers (D-10-05)
export const CoverageFamilySchema = z.enum(['agenticapps', 'factiv', 'neuroflash'])
export type CoverageFamily = z.infer<typeof CoverageFamilySchema>

// Base per-column state for CLAUDE.md (the workflow column gets a richer variant).
export const CoverageBasicColumnSchema = z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,
  label: z.string().optional(),
  degraded: z.boolean().optional(), // AGREED-2: marks per-column scan failures
  degradedReason: z.string().optional(), // AGREED-2: error reason when degraded=true
}).strict()

// Workflow column variant — richer metadata for COV-08 sub-states (CODEX HIGH-4)
export const CoverageWorkflowColumnSchema = z.object({
  kind: z.literal('workflow'),
  state: CoverageStateSchema,
  installedVersion: z.string().nullable(), // null when SKILL.md absent or version field missing
  headVersion: z.string().nullable(), // null when migrations dir absent / no to_version found
  detail: z.enum(['equal', 'behind', 'ahead', 'version-unknown', 'skill-missing']).optional(),
  degraded: z.boolean().optional(),
  degradedReason: z.string().optional(),
}).strict()

export const CoverageUnderstandColumnSchema = z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,
  lastAnalyzedAt: z.string().optional(),
  analyzedCommit: z.string().optional(),
  analyzedFiles: z.number().int().nonnegative().optional(),
  viewerToken: z.string().optional(),
  degraded: z.boolean().optional(),
  degradedReason: z.string().optional(),
})

// Discriminated union — TS narrows per cell type
export const CoverageColumnStateSchema = z.discriminatedUnion('kind', [
  CoverageBasicColumnSchema,
  CoverageWorkflowColumnSchema,
])
export type CoverageColumnState = z.infer<typeof CoverageColumnStateSchema>

// Sentinel entry surfaced by override chip
export const OverrideEntrySchema = z.object({
  phaseSlug: z.string(),
  sinceIso: z.string().optional(),
  source: z.enum(['git-log', 'mtime']),
})
export type OverrideEntry = z.infer<typeof OverrideEntrySchema>

// Per-row matrix entry — PUBLIC (SPA-bound) shape. (CODEX HIGH-1)
// Local filesystem paths are stripped before emission; they live only in the daemon-internal type.
// AGREED-2: row carries an optional degraded marker for partial-failure isolation
export const CoverageRowSchema = z.object({
  family: CoverageFamilySchema,
  repo: z.string(),
  claudeMd: CoverageBasicColumnSchema,
  workflowVersion: CoverageWorkflowColumnSchema,
  overrideCount: z.number().int().nonnegative(),
  overrides: z.array(OverrideEntrySchema),
  /** D-13-EXT-07 / D-13-EXT-10: is this repo's absolute path in the dashboard
   *  project registry? Optional (D-13-EXT-10) — older daemons omit it and the
   *  SPA must render gracefully without the field. Metadata only since
   *  D-13-EXT-08 removed the render gate; not used to gate UI affordances.
   *  Closes Codex WARNING #6. */
  inRegistry: z.boolean().optional(),
  /** Phase 14 D-14-08 staleness + D-14-03 per-repo scoped viewer token.
   *  Optional (D-13-EXT-10 precedent) — pre-Phase-14 daemons omit it.
   *  viewerToken is minted daemon-side (HMAC-bound to repoId, lower privilege
   *  than bearer token). Set only when state is fresh or stale (viewer link
   *  is renderable); absent on missing rows. */
  understand: CoverageUnderstandColumnSchema.strict(),
  degraded: z
    .object({
      reason: z.string(), // e.g. "claudeMd scanner threw: ENOENT"
    })
    .optional(),
}).strict()
export type CoverageRow = z.infer<typeof CoverageRowSchema>

// Full current /api/coverage response.
export const CoverageResponseSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAtIso: z.string(),
  workflowHeadVersion: z.string().nullable(),
  rows: z.array(CoverageRowSchema),
}).strict()
export type CoverageResponse = z.infer<typeof CoverageResponseSchema>
export type CompatibleCoverageRow = Omit<CoverageRow, 'understand'> & {
  understand?: CoverageRow['understand']
}
export type CompatibleCoverageResponse = Omit<CoverageResponse, 'schemaVersion' | 'rows'> & {
  schemaVersion: 1 | 2
  rows: CompatibleCoverageRow[]
}

const LegacyCoverageStateSchema = z.enum(['fresh', 'stale', 'missing', 'not-applicable'])
type LegacyCoverageState = z.infer<typeof LegacyCoverageStateSchema>

const LegacyCoverageBasicColumnSchema = z
  .object({
    kind: z.literal('basic'),
    state: LegacyCoverageStateSchema,
    label: z.string().optional(),
    daysSince: z.number().optional(),
    degraded: z.boolean().optional(),
    degradedReason: z.string().optional(),
  })
  .passthrough()

const LegacyCoverageWorkflowColumnSchema = z
  .object({
    kind: z.literal('workflow'),
    state: LegacyCoverageStateSchema,
    installedVersion: z.string().nullable(),
    headVersion: z.string().nullable(),
    detail: z.enum(['equal', 'behind', 'ahead', 'version-unknown', 'skill-missing']).optional(),
    degraded: z.boolean().optional(),
    degradedReason: z.string().optional(),
  })
  .passthrough()

const LegacyCoverageUnderstandColumnSchema = z
  .object({
    kind: z.literal('basic'),
    state: LegacyCoverageStateSchema,
    lastAnalyzedAt: z.string().optional(),
    analyzedCommit: z.string().optional(),
    analyzedFiles: z.number().int().nonnegative().optional(),
    viewerToken: z.string().optional(),
    degraded: z.boolean().optional(),
    degradedReason: z.string().optional(),
  })
  .passthrough()

const CoverageRowV1CompatibilitySchema = z
  .object({
    family: CoverageFamilySchema,
    repo: z.string(),
    claudeMd: LegacyCoverageBasicColumnSchema,
    workflowVersion: LegacyCoverageWorkflowColumnSchema,
    overrideCount: z.number().int().nonnegative(),
    overrides: z.array(OverrideEntrySchema),
    inRegistry: z.boolean().optional(),
    understand: LegacyCoverageUnderstandColumnSchema.optional(),
    degraded: z.object({ reason: z.string() }).optional(),
  })
  .passthrough()

const CoverageResponseV1CompatibilitySchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAtIso: z.string(),
    workflowHeadVersion: z.string().nullable(),
    rows: z.array(CoverageRowV1CompatibilitySchema),
  })
  .passthrough()

function normaliseLegacyState(state: LegacyCoverageState): CoverageState {
  return state === 'not-applicable' ? 'missing' : state
}

/**
 * Parse the deployed v1 coverage wire shape while deliberately tolerating
 * fields that the current SPA discards. The returned rows contain only data
 * retained by the post-removal surface.
 */
export function parseCoverageResponse(input: unknown): CompatibleCoverageResponse {
  const version = z.object({ schemaVersion: z.union([z.literal(1), z.literal(2)]) }).parse(input)
  if (version.schemaVersion === 2) {
    return CoverageResponseSchema.parse(input)
  }

  const parsed = CoverageResponseV1CompatibilitySchema.parse(input)

  return {
    schemaVersion: parsed.schemaVersion,
    generatedAtIso: parsed.generatedAtIso,
    workflowHeadVersion: parsed.workflowHeadVersion,
    rows: parsed.rows.map((row) => ({
      family: row.family,
      repo: row.repo,
      claudeMd: {
        kind: row.claudeMd.kind,
        state: normaliseLegacyState(row.claudeMd.state),
        ...(row.claudeMd.label !== undefined ? { label: row.claudeMd.label } : {}),
        ...(row.claudeMd.degraded !== undefined ? { degraded: row.claudeMd.degraded } : {}),
        ...(row.claudeMd.degradedReason !== undefined
          ? { degradedReason: row.claudeMd.degradedReason }
          : {}),
      },
      workflowVersion: {
        kind: row.workflowVersion.kind,
        state: normaliseLegacyState(row.workflowVersion.state),
        installedVersion: row.workflowVersion.installedVersion,
        headVersion: row.workflowVersion.headVersion,
        ...(row.workflowVersion.detail !== undefined ? { detail: row.workflowVersion.detail } : {}),
        ...(row.workflowVersion.degraded !== undefined
          ? { degraded: row.workflowVersion.degraded }
          : {}),
        ...(row.workflowVersion.degradedReason !== undefined
          ? { degradedReason: row.workflowVersion.degradedReason }
          : {}),
      },
      overrideCount: row.overrideCount,
      overrides: row.overrides,
      ...(row.inRegistry !== undefined ? { inRegistry: row.inRegistry } : {}),
      ...(row.understand !== undefined
        ? {
            understand: {
              kind: row.understand.kind,
              state: normaliseLegacyState(row.understand.state),
              ...(row.understand.lastAnalyzedAt !== undefined
                ? { lastAnalyzedAt: row.understand.lastAnalyzedAt }
                : {}),
              ...(row.understand.analyzedCommit !== undefined
                ? { analyzedCommit: row.understand.analyzedCommit }
                : {}),
              ...(row.understand.analyzedFiles !== undefined
                ? { analyzedFiles: row.understand.analyzedFiles }
                : {}),
              ...(row.understand.viewerToken !== undefined
                ? { viewerToken: row.understand.viewerToken }
                : {}),
              ...(row.understand.degraded !== undefined
                ? { degraded: row.understand.degraded }
                : {}),
              ...(row.understand.degradedReason !== undefined
                ? { degradedReason: row.understand.degradedReason }
                : {}),
            },
          }
        : {}),
      ...(row.degraded !== undefined ? { degraded: row.degraded } : {}),
    })),
  }
}
