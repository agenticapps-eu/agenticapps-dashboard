import { z } from 'zod'

export const PhaseFileStatusSchema = z.object({
  name: z.string(),
  present: z.boolean(),
  mtimeIso: z.string().nullable(),
})
export type PhaseFileStatus = z.infer<typeof PhaseFileStatusSchema>

const CommitRefSchema = z.object({
  sha: z.string(),
  subject: z.string(),
  isoDate: z.string(),
})

export const ExecutionTimelineEntrySchema = z.object({
  taskId: z.string(),
  redCommit: CommitRefSchema.nullable(),
  greenCommit: CommitRefSchema.nullable(),
})
export type ExecutionTimelineEntry = z.infer<typeof ExecutionTimelineEntrySchema>

/**
 * Phase 4 four-bucket severity counts (distinct from the three-bucket
 * FindingCountsSchema in overview.ts — the home-page card uses the legacy
 * red/yellow/green shape; the detail-page ReviewStatus uses spec
 * <finding severity="..."> values verbatim).
 */
export const ReviewFindingCountsSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
})
export type ReviewFindingCounts = z.infer<typeof ReviewFindingCountsSchema>

const ReviewStageSchema = z.object({
  present: z.boolean(),
  findings: ReviewFindingCountsSchema,
})

export const ReviewStatusPayloadSchema = z.object({
  stage1: ReviewStageSchema.nullable(),
  stage2: ReviewStageSchema.nullable(),
})
export type ReviewStatusPayload = z.infer<typeof ReviewStatusPayloadSchema>

export const VerificationStatusPayloadSchema = z.object({
  mustHavesTotal: z.number().int().nonnegative(),
  mustHavesEvidenced: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      text: z.string(),
      evidenced: z.boolean(),
    }),
  ),
})
export type VerificationStatusPayload = z.infer<typeof VerificationStatusPayloadSchema>

export const PhaseProgressResponseSchema = z.object({
  phase: z.string().nullable(),
  paddedPhase: z.string().nullable(),
  files: z.array(PhaseFileStatusSchema),
  tdd: z.object({
    greenPairs: z.number().int().nonnegative(),
    totalTasks: z.number().int().nonnegative(),
    timeline: z.array(ExecutionTimelineEntrySchema),
  }),
  review: ReviewStatusPayloadSchema,
  verification: VerificationStatusPayloadSchema,
})
export type PhaseProgressResponse = z.infer<typeof PhaseProgressResponseSchema>
