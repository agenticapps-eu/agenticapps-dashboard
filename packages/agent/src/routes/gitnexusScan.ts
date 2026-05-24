/**
 * gitnexusScan.ts — POST /api/gitnexus/scan + GET /api/gitnexus/scan/:id
 *
 * THREAT MODEL (Plan 13-02):
 * ── T-13-02-02: Elevation of Privilege — bind-mode refusal returned BEFORE
 *    rate-limit and BEFORE body parse to minimise attack surface. 403 BIND_REFUSED
 *    when bindMode !== 'loopback', regardless of valid bearer token (D-13-11).
 *    Defence in depth: SPA also gates via `canScan` to prevent the click.
 * ── T-13-02-03: DoS — rate limiter (10/10s per token-hash, Phase 1 reuse).
 * ── T-13-02-04: Information Disclosure — success responses wrapped in outbound()
 *    (INV-04 schema-drift defence). Error responses carry only code + requestId.
 *    No raw stderr, no file paths in any response.
 * ── T-13-02-07: ~/.gitnexus/ carve-out documented in lib/gitnexusScan.ts.
 *
 * Bearer-auth + CORS lock inherited from app.ts middleware chain.
 * Route mounted at /api/gitnexus (NOT /api/admin/gitnexus — see 13-RESEARCH.md Q1).
 */
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import {
  GitnexusScanRequestSchema,
  GitnexusScanResponseSchema,
  GitnexusScanProgressSchema,
} from '@agenticapps/dashboard-shared'

import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import { startScan, getScanJob } from '../lib/gitnexusScan.js'
import { startFamilyScan } from '../lib/gitnexusFamilyScan.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const gitnexusScanRoute = new Hono<Env>()

// ── POST /scan ────────────────────────────────────────────────────────────────

gitnexusScanRoute.post(
  '/scan',
  // Zod validation with custom result hook for 422 INVALID_REQUEST
  // Note: the validator callback context is untyped w.r.t. Variables, so we
  // cast via unknown to read requestId without a TS2769 "never" error.
  zValidator('json', GitnexusScanRequestSchema, (result, c) => {
    if (!result.success) {
      const ctx = c as unknown as { get(k: string): unknown }
      const requestId = (ctx.get('requestId') as string | undefined) ?? 'unknown'
      return c.json({ ok: false, error: 'INVALID_REQUEST', requestId }, 422)
    }
  }),
  async (c) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    const bindMode = c.get('bindMode')

    // 1. bindMode refusal FIRST (D-13-11 / T-13-02-02)
    //    Returned before rate-limit and before body parse to minimise attack surface.
    if (bindMode !== 'loopback') {
      return c.json({ ok: false, error: 'BIND_REFUSED', requestId }, 403)
    }

    // 2. Rate limit (Phase 12 reuse — 10/10s per token-hash)
    const token = c.req.header('Authorization')?.slice('Bearer '.length).trim() ?? ''
    const rl = rlConsume(tokenHashOf(token))
    if (!rl.allowed) {
      return c.json(
        { ok: false, error: 'RATE_LIMITED', requestId },
        429,
        { 'Retry-After': String(rl.retryAfter ?? 1) },
      )
    }

    // 3. Body already parsed by zValidator — c.req.valid('json') returns the validated body
    const body = c.req.valid('json')  // GitnexusScanRequest

    // 4. Dispatch to per-repo or family scan
    const scanId = randomUUID()
    // Use the registryFile override from context (set by createApp for isolated tests)
    const registryFile = c.get('registryFile') as string | undefined

    const scanOpts = registryFile ? { registryFile } : {}

    let result: { ok: true } | { ok: false; code: string; message?: string }
    if (body.scope === 'repo') {
      result = await startScan(scanId, body, scanOpts)
    } else {
      // scope === 'family'
      const reg = readRegistry(registryFile)
      result = await startFamilyScan(
        scanId,
        body.target as 'agenticapps' | 'factiv' | 'neuroflash',
        { entries: reg.projects },
        scanOpts,
      )
    }

    if (!result.ok) {
      const status =
        result.code === 'SCAN_IN_FLIGHT' ? 409
        : result.code === 'REPO_NOT_REGISTERED' ? 404
        : result.code === 'FAMILY_HAS_NO_REPOS' ? 404
        : result.code === 'BINARY_NOT_FOUND' ? 503
        : 500
      return c.json(
        {
          ok: false,
          error: result.code,
          requestId,
          ...(result.message ? { message: result.message } : {}),
        },
        status,
      )
    }

    // 5. outbound() schema-drift defence (INV-04)
    return outbound(
      c,
      GitnexusScanResponseSchema.parse.bind(GitnexusScanResponseSchema),
      { ok: true, scanId },
    )
  },
)

// ── GET /scan/:id ─────────────────────────────────────────────────────────────

gitnexusScanRoute.get('/scan/:id', (c) => {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  const bindMode = c.get('bindMode')

  // bindMode refusal FIRST (D-13-11 / T-13-02-02)
  if (bindMode !== 'loopback') {
    return c.json({ ok: false, error: 'BIND_REFUSED', requestId }, 403)
  }

  const id = c.req.param('id')
  const job = getScanJob(id)
  if (!job) {
    return c.json({ ok: false, error: 'SCAN_NOT_FOUND', requestId }, 404)
  }

  // outbound() schema-drift defence (INV-04)
  return outbound(
    c,
    GitnexusScanProgressSchema.parse.bind(GitnexusScanProgressSchema),
    { ok: true, job },
  )
})
