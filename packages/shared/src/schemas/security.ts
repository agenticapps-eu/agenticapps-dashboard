import { z } from 'zod'

/**
 * /cso audit summary parsed from <phase>/*-SECURITY.md.
 * content is capped at 4096 chars by the parser (RESEARCH "Common Pitfalls" /
 * Resource exhaustion). Schema does not enforce the cap so legitimate
 * larger audits validate; the cap is a parser-side performance defense.
 */
export const CsoSummarySchema = z.object({
  fileName: z.string(),
  content: z.string(),
})
export type CsoSummary = z.infer<typeof CsoSummarySchema>

export const DbSentinelSummarySchema = z.object({
  fileName: z.string(),
  content: z.string(),
})
export type DbSentinelSummary = z.infer<typeof DbSentinelSummarySchema>

export const SecurityResponseSchema = z.object({
  cso: CsoSummarySchema.nullable(),
  dbSentinel: DbSentinelSummarySchema.nullable(),
})
export type SecurityResponse = z.infer<typeof SecurityResponseSchema>
