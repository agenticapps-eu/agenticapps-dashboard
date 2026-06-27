import { z } from 'zod'

/**
 * URL constrained to http(s) schemes only (CR-01 — defense against javascript:/data: injection).
 * z.string().url() accepts any valid URL scheme; this refine rejects non-http(s) at parse time
 * so a hostile permalink from upstream surfaces as schema-drift instead of a live link.
 */
const HttpUrl = z
  .string()
  .url()
  .refine((u: string) => /^https?:\/\//i.test(u), { message: 'must be http(s)' })

/**
 * A single Sentry issue from the org-level issues endpoint.
 * A2 defensive: `count` is returned as a JSON string by the Sentry API
 * but may also arrive as a number — transform to string in either case.
 * D-08-02: title, level badge, event count, last-seen relative time, permalink link-out.
 */
export const SentryIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.enum(['fatal', 'error', 'warning', 'info', 'debug']),
  count: z.union([z.string(), z.number()]).transform(String),
  lastSeen: z.string(),
  permalink: HttpUrl,
  shortId: z.string(),
})
export type SentryIssue = z.infer<typeof SentryIssueSchema>

/**
 * GET /api/projects/:id/sentry/recent response.
 * D-08-02: top-5 recent unresolved issues.
 * D-08-09: stale metadata for last-good fallback display.
 */
export const SentryRecentResponseSchema = z.object({
  issues: z.array(SentryIssueSchema).max(5),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type SentryRecentResponse = z.infer<typeof SentryRecentResponseSchema>
