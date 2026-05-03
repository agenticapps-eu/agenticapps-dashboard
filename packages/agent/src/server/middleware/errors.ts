import type { Context, ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { agentError } from '../../lib/logging.js'
import { PathViolation } from '../../lib/paths.js'
import { GitNotAllowedError } from '../../lib/git.js'

/**
 * D-16: Outbound schema-drift defense.
 *
 * Wrap every route's response in this helper instead of a bare c.json(Schema.parse(payload)).
 * If Schema.parse throws (indicates the route's output shape drifted from the contract),
 * returns 500 with error='schema_drift'. This avoids the outbound-parse loop described in
 * RESEARCH Pitfall 8 — errors from this helper are NOT passed through Schema.parse again.
 */
export function outbound<T>(
  c: Context,
  parse: (payload: unknown) => T,
  payload: unknown,
): Response {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  try {
    const validated = parse(payload)
    return c.json(validated as Parameters<typeof c.json>[0])
  } catch (err) {
    agentError(`schema_drift requestId=${requestId} ${String(err)}`)
    return c.json({ ok: false, error: 'schema_drift', requestId }, 500)
  }
}

/**
 * D-06: NODE_ENV-gated error verbosity.
 * - development: 422 includes Zod issue tree (path, message for each issue)
 * - production (or unset): 422 omits issues field
 *
 * Always logs full Zod error server-side. Error response shape follows
 * ErrorResponseSchema (ok: false, error, requestId, issues?).
 *
 * D-16 Pitfall 8: ErrorHandler constructs the response directly without calling
 * outbound() — that would cause infinite recursion on Zod failures in error paths.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  const isDev = process.env.NODE_ENV === 'development'

  if (err instanceof ZodError) {
    agentError(`zod validation failed requestId=${requestId} ${JSON.stringify(err.flatten())}`)
    const body: Record<string, unknown> = { ok: false, error: 'invalid_request', requestId }
    if (isDev) {
      body.issues = err.errors.map((e) => ({
        path: e.path.map(String),
        message: e.message,
      }))
    }
    return c.json(body, 422)
  }

  if (err instanceof PathViolation) {
    agentError(`path violation requestId=${requestId} ${err.message}`)
    return c.json(
      { ok: false, error: 'path_not_allowed', requestId, ...(isDev && { detail: err.message }) },
      422,
    )
  }

  if (err instanceof GitNotAllowedError) {
    return c.json(
      {
        ok: false,
        error: 'git_cmd_not_allowed',
        requestId,
        ...(isDev && { detail: err.message }),
      },
      422,
    )
  }

  if (err instanceof HTTPException) {
    return c.json({ ok: false, error: err.message || 'http_exception', requestId }, err.status)
  }

  agentError(`unhandled error requestId=${requestId} ${(err as Error).stack ?? String(err)}`)
  return c.json({ ok: false, error: 'internal_server_error', requestId }, 500)
}
