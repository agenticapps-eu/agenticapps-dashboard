import { z } from 'zod'

// 4-state freshness vocabulary (UI-SPEC §4 + COV-11)
export const CoverageStateSchema = z.enum(['fresh', 'stale', 'missing', 'not-applicable'])
export type CoverageState = z.infer<typeof CoverageStateSchema>

// 3 family identifiers (D-10-05)
export const CoverageFamilySchema = z.enum(['agenticapps', 'factiv', 'neuroflash'])
export type CoverageFamily = z.infer<typeof CoverageFamilySchema>

// Base per-column state for claudeMd / gitNexus / wiki (CODEX HIGH-4 scope: workflow column gets richer variant)
export const CoverageBasicColumnSchema = z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,
  label: z.string().optional(), // human-readable detail e.g. "stale 22d", "never compiled"
  daysSince: z.number().optional(), // gitNexus + wiki only
  degraded: z.boolean().optional(), // AGREED-2: marks per-column scan failures
  degradedReason: z.string().optional(), // AGREED-2: error reason when degraded=true
})

// Workflow column variant — richer metadata for COV-08 sub-states (CODEX HIGH-4)
export const CoverageWorkflowColumnSchema = z.object({
  kind: z.literal('workflow'),
  state: CoverageStateSchema,
  installedVersion: z.string().nullable(), // null when SKILL.md absent or version field missing
  headVersion: z.string().nullable(), // null when migrations dir absent / no to_version found
  detail: z.enum(['equal', 'behind', 'ahead', 'version-unknown', 'skill-missing']).optional(),
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
  gitNexus: CoverageBasicColumnSchema,
  wiki: CoverageBasicColumnSchema,
  workflowVersion: CoverageWorkflowColumnSchema,
  overrideCount: z.number().int().nonnegative(),
  overrides: z.array(OverrideEntrySchema),
  degraded: z
    .object({
      reason: z.string(), // e.g. "claudeMd scanner threw: ENOENT"
    })
    .optional(),
})
export type CoverageRow = z.infer<typeof CoverageRowSchema>

// Full /api/coverage response
export const CoverageResponseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAtIso: z.string(),
  gitNexusInstalled: z.boolean(), // global signal — drives per-family hint per COV-10 Option A
  workflowHeadVersion: z.string().nullable(),
  rows: z.array(CoverageRowSchema),
})
export type CoverageResponse = z.infer<typeof CoverageResponseSchema>

// POST /api/coverage/refresh request body — CODEX HIGH-5 contract pin
// Clipboard actions are SPA-side only and NEVER appear here. Daemon rejects at parse.
export const CoverageRefreshActionSchema = z.enum(['gitnexus-analyze'])
export type CoverageRefreshAction = z.infer<typeof CoverageRefreshActionSchema>

export const CoverageRefreshRequestSchema = z.object({
  family: CoverageFamilySchema,
  repo: z.string(),
  action: CoverageRefreshActionSchema,
})
export type CoverageRefreshRequest = z.infer<typeof CoverageRefreshRequestSchema>

// CODEX HIGH-5: updatedRow REQUIRED when kind='ok' (was optional). Encoded via discriminated union.
const CoverageRefreshOkSchema = z.object({
  ok: z.literal(true),
  kind: z.literal('ok'),
  updatedRow: CoverageRowSchema,
})
const CoverageRefreshFailSchema = z.object({
  ok: z.literal(false),
  kind: z.enum(['not-installed', 'timeout', 'error']),
  exitCode: z.number().int().optional(),
  stderr: z.string().optional(),
})
export const CoverageRefreshResponseSchema = z.discriminatedUnion('ok', [
  CoverageRefreshOkSchema,
  CoverageRefreshFailSchema,
])
export type CoverageRefreshResponse = z.infer<typeof CoverageRefreshResponseSchema>
