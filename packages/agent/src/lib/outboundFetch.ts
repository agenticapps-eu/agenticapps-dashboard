/**
 * Outbound HTTP primitives for Phase 8 integration routes.
 *
 * - fetchWithTimeout: wraps Node 22 global fetch with AbortController timeout.
 *   No retry (D-08-08). Timer cleared in finally (mirrors atomicWrite.ts discipline).
 * - classifyError: collapses every upstream error to one of 3 fixed categories
 *   (INV-05 / D-08-11). Raw body never returned to the SPA.
 * - CacheEntry<T>: extends the inline cache shape from routes/integrations.ts
 *   with an optional lastGood sub-entry for D-08-09 last-good retention.
 *
 * Node 22 globals used directly (INV-02 — no import, no new dependency):
 *   fetch, AbortController, AbortSignal
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutboundErrorCategory = 'unreachable' | 'unauthorized' | 'rate-limited'

/**
 * Cache entry shape used by all Phase 8 route Maps.
 * Extends the integrations.ts inline shape with an optional lastGood sub-entry
 * so a failed refresh does not evict the previous good value (D-08-09).
 */
export interface CacheEntry<T> {
  value: T
  cachedAtMs: number
  /** Retained across TTL expiry — serves as fallback when upstream is unreachable. */
  lastGood?: { value: T; cachedAtMs: number }
}

// ---------------------------------------------------------------------------
// fetchWithTimeout
// ---------------------------------------------------------------------------

/**
 * Fetch with a hard timeout via AbortController.
 *
 * - Aborts after timeoutMs (default 5 000 ms). D-08-08: no retry.
 * - clearTimeout runs in finally — timer never leaks even if fetch throws.
 * - The AbortError propagates to the caller for classifyError to handle.
 * - Logging rule (INV-05): this helper does not log; callers may log
 *   status codes but NEVER token values or raw upstream body.
 *
 * @param url       Upstream endpoint URL
 * @param init      fetch RequestInit (headers, method, body, …). signal is
 *                  overwritten — do not pass signal in init.
 * @param timeoutMs Abort deadline in milliseconds (default 5 000).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 5_000,
): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

/**
 * Returns true when a Linear GraphQL response body carries the non-standard
 * RATELIMITED extensions code (Pitfall 1 — Linear uses HTTP 400, not 429).
 */
function isLinearRateLimited(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (!Array.isArray(b['errors'])) return false
  const first = (b['errors'] as unknown[])[0]
  if (first === null || typeof first !== 'object') return false
  const extensions = (first as Record<string, unknown>)['extensions']
  if (extensions === null || typeof extensions !== 'object') return false
  return (extensions as Record<string, unknown>)['code'] === 'RATELIMITED'
}

/**
 * Map an upstream error or HTTP status to one of three fixed categories.
 *
 * Mapping table (D-08-11 / Research Finding 6):
 *   AbortError                              → unreachable  (timeout)
 *   TypeError (fetch failed / DNS)          → unreachable
 *   401 / 403                               → unauthorized
 *   429                                     → rate-limited
 *   400 + errors[0].extensions.code=RATELIMITED → rate-limited  (Linear, Pitfall 1)
 *   404 / 5xx / any other non-2xx           → unreachable
 *   no status, unrecognised error           → unreachable
 *
 * @param err    The thrown error (AbortError, TypeError, …) or null when
 *               the HTTP response itself was received but non-2xx.
 * @param status HTTP status code, if a response was received.
 * @param body   Parsed response body (for Linear 400+RATELIMITED detection).
 */
export function classifyError(
  err: unknown,
  status?: number,
  body?: unknown,
): OutboundErrorCategory {
  // Network-layer errors (timeout or connection failure)
  if (err instanceof Error && err.name === 'AbortError') return 'unreachable'
  if (err instanceof TypeError) return 'unreachable'

  // HTTP status classification
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (status === 400 && isLinearRateLimited(body)) return 'rate-limited'

  return 'unreachable'
}
