import { z } from 'zod'

/**
 * URL constrained to http(s) schemes only (CR-01 — defense against javascript:/data: injection).
 * z.string().url() accepts any valid URL scheme; this refine rejects non-http(s) at parse time
 * so a hostile url from upstream surfaces as schema-drift instead of a live link.
 */
const HttpUrl = z
  .string()
  .url()
  .refine((u: string) => /^https?:\/\//i.test(u), { message: 'must be http(s)' })

/**
 * A single Linear issue fetched by human-readable identifier (e.g. "ACME-123").
 * Fields mapped from the GraphQL response: state.name → stateName, state.type → stateType,
 * assignee.name → assigneeName (nullable when unassigned).
 * D-08-07: LinearIssuesResponse caps at 3 detected issues.
 */
export const LinearIssueSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  url: HttpUrl,
  stateName: z.string(),
  stateType: z.enum(['started', 'completed', 'cancelled', 'backlog', 'unstarted']),
  assigneeName: z.string().nullable(),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type LinearIssue = z.infer<typeof LinearIssueSchema>

/**
 * GET /api/projects/:id/linear/issues response.
 * The daemon aggregates branch/commit detection + multi-fetch into one response.
 * D-08-07: issues capped at 3.
 * D-08-09: top-level stale metadata for whole-panel outage display.
 */
export const LinearIssuesResponseSchema = z.object({
  issues: z.array(LinearIssueSchema).max(3),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type LinearIssuesResponse = z.infer<typeof LinearIssuesResponseSchema>
