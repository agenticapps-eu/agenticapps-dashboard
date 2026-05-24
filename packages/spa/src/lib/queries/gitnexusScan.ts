/**
 * gitnexusScan.ts — TanStack Query hooks for Phase 13 gitnexus scan routes.
 *
 * Plan 13-03 (Wave 3): SPA query bindings for POST /api/gitnexus/scan
 * and GET /api/gitnexus/scan/:id (short-poll progress).
 *
 * Design decisions:
 * - useGitnexusScan: mutation only — no embedded invalidation. Consumers manage cache.
 * - useGitnexusScanProgress: refetchInterval as a function that reads q.state.data?.state.
 *   Polls every 1500ms while state='running'; returns false on terminal states (done/error).
 * - scanErrorCodeToMessage: exhaustive switch — TypeScript will fail compilation if a code
 *   is missed (D-13-EXT-06). Maps 11 error codes to user-friendly strings.
 * - Cache invalidation of ['coverage'] and ['conformance'] is the CONSUMER's responsibility
 *   (ScanPill / CoverageFamilySection via useEffect on terminal state). NOT in these hooks.
 *
 * Mirrors Phase 12 useRegistryFixPath shape from conformanceQueries.ts:100-124.
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import {
  GitnexusScanRequestSchema,
  GitnexusScanResponseSchema,
  GitnexusScanProgressSchema,
  type GitnexusScanRequest,
  type GitnexusScanErrorCode,
} from '@agenticapps/dashboard-shared'
import { apiFetch } from '../api.js'

// ── useGitnexusScan ───────────────────────────────────────────────────────────

/**
 * useGitnexusScan — wraps POST /api/gitnexus/scan.
 *
 * Returns a TanStack mutation. The mutationFn validates the request body against
 * GitnexusScanRequestSchema before sending, then parses the response against
 * GitnexusScanResponseSchema.
 *
 * On ok:false response: throws an Error with a `code` property carrying the
 * GitnexusScanErrorCode. Consumer can read `(err as { code }).code` for toast.
 *
 * Cache invalidation is NOT performed here — the consumer (ScanPill) does it
 * via useEffect after polling reaches a terminal state (D-13-09).
 */
export function useGitnexusScan() {
  return useMutation({
    mutationFn: async (body: GitnexusScanRequest) => {
      const r = await apiFetch('/api/gitnexus/scan', GitnexusScanResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(GitnexusScanRequestSchema.parse(body)),
      })
      if (!r.ok) throw new Error(`schema_drift:${r.drift.path}`)
      if (!r.data.ok) {
        const err = new Error(r.data.error) as Error & { code: GitnexusScanErrorCode }
        err.code = r.data.error
        throw err
      }
      return r.data    // { ok: true, scanId }
    },
    // Coverage invalidation happens at the consumer (after polling reaches 'done'), NOT here.
  })
}

// ── useGitnexusScanProgress ───────────────────────────────────────────────────

/**
 * useGitnexusScanProgress — wraps GET /api/gitnexus/scan/:id.
 *
 * Polls every 1500ms while the job state is 'running'. Stops polling when the
 * state transitions to 'done' or 'error' (refetchInterval returns false).
 * Disabled entirely when scanId is null.
 *
 * gcTime: 60s — keeps the completed job in cache so consumers can read the
 * terminal state for toast generation after the interval stops.
 * staleTime: 0 — always re-fetch (progress is inherently transient).
 * refetchOnWindowFocus: false — polling cadence is sufficient.
 *
 * NOTE: invalidation of ['coverage'] and ['conformance'] is triggered by the
 * CONSUMER via useEffect on terminal state, not inside this hook.
 */
export function useGitnexusScanProgress(scanId: string | null) {
  return useQuery({
    queryKey: ['gitnexusScan', scanId],
    queryFn: async () => {
      const r = await apiFetch(`/api/gitnexus/scan/${scanId}`, GitnexusScanProgressSchema)
      if (!r.ok) throw new Error(`schema_drift:${r.drift.path}`)
      if (!r.data.ok) {
        const err = new Error(r.data.error) as Error & { code: GitnexusScanErrorCode }
        err.code = r.data.error
        throw err
      }
      return r.data.job
    },
    enabled: scanId !== null,
    refetchInterval: (q) => {
      // Halt polling on terminal error (e.g. 404 SCAN_NOT_FOUND after TTL eviction)
      // to avoid infinite re-fetch when the scan ID has been evicted server-side.
      if (q.state.status === 'error') return false
      const job = q.state.data
      if (!job) return 1500
      return job.state === 'running' ? 1500 : false
    },
    staleTime: 0,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

// ── scanErrorCodeToMessage ────────────────────────────────────────────────────

/**
 * scanErrorCodeToMessage — maps GitnexusScanErrorCode to user-friendly string.
 *
 * Exhaustive switch: TypeScript will fail compilation if a new error code is
 * added to GitnexusScanErrorCodeSchema without updating this function (D-13-EXT-06).
 * T-13-03-01: raw error.message from the daemon is NEVER passed through — only
 * the code enum is used, preventing file path / stderr disclosure via toast.
 */
export function scanErrorCodeToMessage(code: GitnexusScanErrorCode): string {
  switch (code) {
    case 'BINARY_NOT_FOUND':     return 'GitNexus is not installed — install and try again'
    case 'REPO_NOT_REGISTERED':  return 'Repo not found in registry — re-register and try again'
    case 'FAMILY_HAS_NO_REPOS':  return 'No repos in this family'
    case 'SCAN_IN_FLIGHT':       return 'A scan is already running for this repo'
    case 'BIND_REFUSED':         return 'Scan disabled — connect from the host device'
    case 'RATE_LIMITED':         return 'Too many requests — try again in a few seconds'
    case 'SCAN_NOT_FOUND':       return 'Scan was interrupted'
    case 'SCAN_FAILED':          return 'Scan failed — see daemon logs'
    case 'SCAN_TIMEOUT':         return 'Scan timed out after 5 minutes'
    case 'INVALID_REQUEST':      return 'Invalid request — please reload'
    case 'INTERNAL_ERROR':       return 'Scan failed — see daemon logs'
  }
}
