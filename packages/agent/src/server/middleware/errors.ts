import type { Context, ErrorHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { agentError } from '../../lib/logging.js'
import { PathViolation } from '../../lib/paths.js'
import { GitNotAllowedError } from '../../lib/git.js'
import { RegistrationPathBlocked } from '../../lib/registry.js'
import { StateCorruptionError } from '../../lib/stateCorruption.js'

/**
 * D-16: Outbound schema-drift defense.
 *
 * Wrap every route's response in this helper instead of a bare c.json(Schema.parse(payload)).
 * If Schema.parse throws (indicates the route's output shape drifted from the contract),
 * returns 500 with error='schema_drift'. This avoids the outbound-parse loop described in
 * RESEARCH Pitfall 8 — errors from this helper are NOT passed through Schema.parse again.
 *
 * `status` defaults to 200; pass 201 (created) etc. on routes that need a different success code.
 */
export function outbound<T>(
  c: Context,
  parse: (payload: unknown) => T,
  payload: unknown,
  status: ContentfulStatusCode = 200,
): Response {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  try {
    const validated = parse(payload)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json(validated as any, status)
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

  if (err instanceof StateCorruptionError) {
    agentError(
      `schema_drift requestId=${requestId} source=${err.source} ${JSON.stringify(err.cause.flatten())}`,
    )
    return c.json({ ok: false, error: 'schema_drift', requestId }, 500)
  }

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

  if (err instanceof RegistrationPathBlocked) {
    agentError(`registration blocked requestId=${requestId} target=${err.target} reason=${err.reason}`)
    return c.json(
      {
        ok: false,
        error: 'registration_path_blocked',
        requestId,
        // Always include reason — it's about the user-supplied path, not server internals.
        detail: err.reason,
      },
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
