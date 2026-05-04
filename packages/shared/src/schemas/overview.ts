import { z } from 'zod'

export const FindingCountsSchema = z.object({
  red: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  green: z.number().int().nonnegative(),
})
export type FindingCounts = z.infer<typeof FindingCountsSchema>

export const DbAuditFindingsSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
})
export type DbAuditFindings = z.infer<typeof DbAuditFindingsSchema>

export const MarkersSchema = z.object({
  gitRepo: z.boolean(),
  planning: z.boolean(),
  claudeSkills: z.boolean(),
})
export type Markers = z.infer<typeof MarkersSchema>

export const ProjectOverviewSchema = z.object({
  phaseStatus: z.enum(['Pending', 'In Progress', 'Complete']),
  stage1: z
    .object({
      ran: z.boolean(),
      findings: FindingCountsSchema,
    })
    .nullable(),
  stage2: z
    .object({
      ran: z.boolean(),
      findings: FindingCountsSchema,
    })
    .nullable(),
  dbAudit: z
    .object({
      findings: DbAuditFindingsSchema,
    })
    .nullable(),
  tdd: z
    .object({
      greenPairs: z.number().int().nonnegative(),
      totalTasks: z.number().int().nonnegative(),
    })
    .nullable(),
  verification: z
    .object({
      evidence: z.number().int().nonnegative(),
      mustHaves: z.number().int().nonnegative(),
    })
    .nullable(),
  branch: z.string().nullable(),
  markers: MarkersSchema,
})
export type ProjectOverview = z.infer<typeof ProjectOverviewSchema>
