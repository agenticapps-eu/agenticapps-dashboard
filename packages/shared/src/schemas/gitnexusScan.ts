/**
 * gitnexusScan.ts — Phase 13 wire contracts for gitnexus scan routes.
 *
 * Source of truth for both daemon (packages/agent) and SPA (packages/spa).
 * Schema drift surfaces as a Zod parse error at the route boundary (INV-04).
 *
 * D-13-01: Daemon spawns gitnexus as a subprocess; these schemas describe
 *   the POST + GET API surface that the SPA drives.
 * D-13-02: Short-poll `GET /api/gitnexus/scan/{id}` uses GitnexusScanProgressSchema.
 * D-13-03: Per-repo lock; 409 SCAN_IN_FLIGHT.
 * D-13-EXT-01: Global scan-serialisation lock (registry.json race guard).
 * D-13-EXT-03: Job state shape — discriminated union by kind ('repo' | 'family').
 * D-13-EXT-06: Error code taxonomy — copy verbatim from 13-RESEARCH.md §D-13-EXT-06.
 *
 * Phase 12 invariant inherited: every nested object is `.strict()` so extra
 * keys are rejected at the wire boundary (T-13-00-01).
 */

import { z } from 'zod'

/**
 * Exhaustive error code taxonomy (D-13-EXT-06).
 * Codes are OPAQUE — they do NOT carry stderr, file paths, or subprocess output.
 * Wave 2 route maps each code to a human-readable message internally.
 */
export const GitnexusScanErrorCodeSchema = z.enum([
  'BINARY_NOT_FOUND',        // 503 — gitnexus not on PATH at POST time
  'REPO_NOT_REGISTERED',     // 404 — repoId not in daemon registry
  'FAMILY_HAS_NO_REPOS',     // 404 — familyId resolves to empty repo set
  'SCAN_IN_FLIGHT',          // 409 — per-repo lock held
  'BIND_REFUSED',            // 403 — bindMode !== 'loopback' (D-13-11)
  'RATE_LIMITED',            // 429 — rate limiter rejected
  'SCAN_NOT_FOUND',          // 404 — GET id after TTL eviction
  'SCAN_FAILED',             // GET 200 + state='error' — gitnexus exit non-zero
  'SCAN_TIMEOUT',            // GET 200 + state='error' — execa 5min timeout
  'INVALID_REQUEST',         // 422 — Zod parse failure
  'INTERNAL_ERROR',          // 500 — uncaught
])
export type GitnexusScanErrorCode = z.infer<typeof GitnexusScanErrorCodeSchema>

/**
 * POST /api/gitnexus/scan request body (D-13-EXT-03).
 * Discriminated union on 'scope':
 *   - 'repo':   target is a 'family/repo' slug (regex guards against path traversal)
 *   - 'family': target is one of the three known family names
 */
export const GitnexusScanRequestSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('repo'),   target: z.string().regex(/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/) }).strict(),
  z.object({ scope: z.literal('family'), target: z.enum(['agenticapps','factiv','neuroflash']) }).strict(),
])
export type GitnexusScanRequest = z.infer<typeof GitnexusScanRequestSchema>

/**
 * POST /api/gitnexus/scan 200 response (D-13-EXT-03).
 * ok:true  → scanId (UUID v4) returned immediately; SPA polls GET.
 * ok:false → error code + requestId (+ optional human message for 503/500).
 */
export const GitnexusScanResponseSchema = z.union([
  z.object({ ok: z.literal(true),  scanId: z.string().uuid() }).strict(),
  z.object({ ok: z.literal(false), error: GitnexusScanErrorCodeSchema, requestId: z.string(), message: z.string().optional() }).strict(),
])
export type GitnexusScanResponse = z.infer<typeof GitnexusScanResponseSchema>

// ── Job shapes (D-13-EXT-03) ─────────────────────────────────────────────────

/**
 * Per-repo scan job state.
 * family never surfaces 'error' at the top level — partial-success (D-13-05).
 */
const RepoScanShape = z.object({
  kind: z.literal('repo'),
  scanId: z.string().uuid(),
  repoId: z.string(),
  state: z.enum(['running','done','error']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.object({ code: GitnexusScanErrorCodeSchema, message: z.string() }).strict().optional(),
}).strict()

/**
 * Family scan job state — sequential per-repo orchestration (D-13-04).
 * 'state' is never 'error' at the family level — partial-success per D-13-05.
 * perRepoResults carries individual state per repo so the SPA can surface
 * "retry failed" with the precise failing set (Pitfall 7 guard).
 */
const FamilyScanShape = z.object({
  kind: z.literal('family'),
  scanId: z.string().uuid(),
  familyId: z.enum(['agenticapps','factiv','neuroflash']),
  state: z.enum(['running','done']),         // family never reports 'error' top-level — partial-success per D-13-05
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  currentRepoId: z.string().nullable(),
  currentScanId: z.string().uuid().nullable(),
  perRepoResults: z.array(z.object({
    repoId: z.string(),
    state: z.enum(['done','error']),
    error: z.object({ code: GitnexusScanErrorCodeSchema, message: z.string() }).strict().optional(),
  }).strict()),
}).strict()

/**
 * GET /api/gitnexus/scan/{id} response (D-13-02 short-poll shape).
 * ok:true  → job (discriminated union on kind: 'repo' | 'family').
 * ok:false → scan not found (TTL evicted) or bind-refused.
 */
export const GitnexusScanProgressSchema = z.union([
  z.object({ ok: z.literal(true),  job: z.discriminatedUnion('kind', [RepoScanShape, FamilyScanShape]) }).strict(),
  z.object({ ok: z.literal(false), error: GitnexusScanErrorCodeSchema, requestId: z.string() }).strict(),
])
export type GitnexusScanProgress = z.infer<typeof GitnexusScanProgressSchema>
