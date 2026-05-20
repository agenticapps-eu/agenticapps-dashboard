import type { z } from 'zod'
import { ErrorResponseSchema } from '@agenticapps/dashboard-shared'

import { getPairing } from './pairing.js'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly requestId: string | undefined,
    message: string,
    /**
     * Daemon-supplied error code from ErrorResponseSchema.error (e.g.
     * `newPath_blocked`, `newPath_outside_family_roots`). Undefined when
     * the response body is not JSON or does not match the error schema.
     * Consumers map this to user-facing copy.
     */
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type DriftIssue = {
  /** First failing field path joined by `.` — D-09 surface */
  path: string
  expected: string
  got: string
  /** Full Zod issue tree, available behind [Show full diff] disclosure (D-09) */
  issues: z.ZodIssue[]
}

export type ParseOrDrift<T> =
  | { ok: true; data: T }
  | { ok: false; drift: DriftIssue }

export function parseOrDrift<S extends z.ZodTypeAny>(
  schema: S,
  json: unknown,
): ParseOrDrift<z.infer<S>> {
  const result = schema.safeParse(json)
  if (result.success) return { ok: true, data: result.data }
  // D-08: log full tree to console.error for DevTools follow-up
  console.error('[schema-drift]', result.error.issues)
  const first = result.error.issues[0]
  // Zod always produces at least one issue on a failed parse; the undefined guard
  // satisfies strict-mode without being reachable at runtime.
  const path = first?.path.length ? first.path.map(String).join('.') : '(root)'
  const expected =
    first !== undefined
      ? ('expected' in first ? String((first as { expected: unknown }).expected) : first.code)
      : '(unknown)'
  const got =
    first !== undefined
      ? ('received' in first ? String((first as { received: unknown }).received) : 'unknown')
      : 'unknown'
  return {
    ok: false,
    drift: {
      path,
      expected,
      got,
      issues: result.error.issues,
    },
  }
}

export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<ParseOrDrift<z.infer<S>>> {
  // D-12 (Phase 3): SPA must use prepare/confirm flow, not the legacy CLI route.
  if (path === '/api/registry/register') {
    throw new Error(
      'SPA must use /api/registry/register-prepare and /api/registry/register-confirm. ' +
        '/api/registry/register is CLI-only (D-12).',
    )
  }
  const pairing = getPairing()
  if (!pairing) throw new ApiError(401, undefined, 'unpaired')

  const url = `${pairing.agentUrl.replace(/\/$/, '')}${path}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${pairing.token}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401) {
    let requestId: string | undefined
    try {
      const body = await res.clone().json()
      const parsed = ErrorResponseSchema.safeParse(body)
      if (parsed.success) requestId = parsed.data.requestId
    } catch {
      /* body might not be JSON; ignore */
    }
    throw new ApiError(401, requestId, 'unauthorized')
  }
  if (!res.ok) {
    // Read the body and surface the daemon-supplied error code if present.
    // Without this, callers see only `HTTP 422` and cannot distinguish e.g.
    // newPath_blocked from newPath_outside_family_roots — the daemon ships
    // structured codes for exactly this reason (PathDriftPanel maps them
    // to user-friendly toast copy).
    let requestId: string | undefined
    let code: string | undefined
    try {
      const body = await res.clone().json()
      const parsed = ErrorResponseSchema.safeParse(body)
      if (parsed.success) {
        requestId = parsed.data.requestId
        code = parsed.data.error
      }
    } catch {
      /* body might not be JSON; leave code/requestId undefined */
    }
    throw new ApiError(res.status, requestId, `HTTP ${res.status}`, code)
  }
  const json = await res.json()
  return parseOrDrift(schema, json)
}
