/**
 * conformance.ts — GET /api/observability/conformance (D-12-14, D-12-16, D-12-17).
 *
 * Bulk-per-family payload: one fetch per page load returns the entire
 * conformance surface (today scores + 14-day delta + 90-day per-family
 * series + drifted registry entries). Mirrors the Phase 11 coverageHistory
 * route pattern — bearer-auth + CORS lock inherited from app.ts middleware,
 * outbound() schema-drift defence on the response.
 *
 * Caching: 30s TTL singleton via conformanceCache. The cache short-circuits
 * the orchestrator on hot paths; POST /api/admin/registry/fix-path (Task 5)
 * invalidates the cache so the next GET re-scans against the fresh registry.
 *
 * NO query params (D-12-16 — bulk-per-family is single-fetch). Adding a
 * `?family=` filter would compromise the cache-friendly pattern and is
 * out of scope for v1.2.0.
 */
import { Hono } from 'hono'

import { ConformanceResponseSchema } from '@agenticapps/dashboard-shared'

import { scanConformance } from '../lib/conformanceScan.js'
import {
  getConformanceCache,
  setConformanceCache,
} from '../lib/conformanceCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const conformanceRoute = new Hono<Env>()

conformanceRoute.get('/observability/conformance', async (c) => {
  // 30s cache short-circuit (D-12-17).
  const cached = getConformanceCache()
  const data = cached ?? (await scanConformance())
  if (!cached) setConformanceCache(data)

  // outbound() applies ConformanceResponseSchema.parse — schema drift in the
  // route's output surfaces as 500 schema_drift rather than a leaked-shape 200.
  return outbound(
    c,
    ConformanceResponseSchema.parse.bind(ConformanceResponseSchema),
    data,
  )
})
