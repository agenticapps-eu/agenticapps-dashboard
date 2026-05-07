import { z } from 'zod'

/**
 * AgentLinter severity.
 * EXACTLY 3 values as confirmed by RESEARCH.md §Standard Stack:
 * agentlinter@0.3.3 emits info | warning | error — NOT medium/low/critical.
 */
export const AgentLinterSeveritySchema = z.enum(['info', 'warning', 'error'])
export type AgentLinterSeverity = z.infer<typeof AgentLinterSeveritySchema>

/**
 * A single diagnostic from AgentLinter.
 */
export const AgentLinterDiagnosticSchema = z.object({
  severity: AgentLinterSeveritySchema,
  category: z.string(),
  rule: z.string(),
  file: z.string(),
  line: z.number().optional(),
  message: z.string(),
  fix: z.string().optional(),
})
export type AgentLinterDiagnostic = z.infer<typeof AgentLinterDiagnosticSchema>

/**
 * Per-category score breakdown from AgentLinter.
 */
export const AgentLinterCategoryScoreSchema = z.object({
  name: z.string(),
  score: z.number(),
  weight: z.number(),
  issues: z.number(),
})
export type AgentLinterCategoryScore = z.infer<typeof AgentLinterCategoryScoreSchema>

/**
 * Full AgentLinter report (output of `npx agentlinter --local --json`).
 * Uses passthrough so future AgentLinter version bumps don't trigger schema
 * drift per D-4-06 philosophy.
 */
export const AgentLinterReportSchema = z
  .object({
    score: z.number(),
    categories: z.array(AgentLinterCategoryScoreSchema),
    diagnostics: z.array(AgentLinterDiagnosticSchema),
    files: z.array(z.string()),
    timestamp: z.string(),
  })
  .passthrough()
export type AgentLinterReport = z.infer<typeof AgentLinterReportSchema>

/**
 * GET /api/projects/:id/agentlinter response.
 * D-5-15: 5-class discriminated union on `kind` covering all failure modes.
 */
export const AgentLinterResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ok'),
    report: AgentLinterReportSchema,
    cachedAt: z.string(),
  }),
  z.object({
    kind: z.literal('not-installed'),
  }),
  z.object({
    kind: z.literal('timeout'),
  }),
  z.object({
    kind: z.literal('error'),
    exitCode: z.number(),
    stderr: z.string(),
  }),
  z.object({
    kind: z.literal('unparseable'),
    exitCode: z.number(),
    rawStdout: z.string(),
  }),
])
export type AgentLinterResponse = z.infer<typeof AgentLinterResponseSchema>
