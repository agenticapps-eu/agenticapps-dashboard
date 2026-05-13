/**
 * coverage.ts — Hono route exposing GET /api/coverage and POST /api/coverage/refresh.
 *
 * This route is a thin pass-through; all business logic lives in Plan 03's
 * orchestrator + cache + spawn modules.
 *
 * Security contracts:
 * - T-10-04-01: Bearer-auth + CORS inherited from app.ts middleware chain (no per-route auth).
 * - T-10-04-02: POST body validated by CoverageRefreshRequestSchema — only 'gitnexus-analyze'
 *               accepted (D-10-09 + CODEX HIGH-5). Any other action is rejected at parse.
 * - T-10-04-03: Error responses use standard c.json() — errorHandler provides NODE_ENV-gated verbosity.
 * - T-10-04-04: CODEX MED-14 — in-memory per-repo refreshLocks Map serializes concurrent POSTs.
 * - T-10-04-06: CODEX HIGH-3 TOCTOU — realpathSync re-canonicalisation + family-root assertion
 *               IMMEDIATELY before spawn. Symlink swap between discovery and spawn is rejected.
 * - T-10-04-07: CODEX HIGH-1 — absPath already stripped by orchestrator (InternalCoverageRow ≠ CoverageRow).
 *               Public response carries no absPath. Structural guarantee via Zod schema shapes.
 * - T-10-04-08: CODEX HIGH-5 — updatedRow REQUIRED on kind='ok'. Route re-invokes
 *               scanCoverageInternal() after spawn success to populate it.
 */

import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'

import { Hono } from 'hono'

import {
  CoverageResponseSchema,
  CoverageRefreshRequestSchema,
  CoverageRefreshResponseSchema,
  type CoverageRefreshResponse,
} from '@agenticapps/dashboard-shared'

import { scanCoverage, scanCoverageInternal } from '../lib/coverageScan.js'
import {
  getCoverageCache,
  setCoverageCache,
  invalidateCoverageCache,
} from '../lib/coverageCache.js'
import { spawnGitNexusAnalyze } from '../lib/coverageSpawn.js'
import { discoverRepos } from '../lib/repoDiscovery.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const coverageRoute = new Hono<Env>()

// ── GET /coverage ─────────────────────────────────────────────────────────────
//
// Cache lookup → orchestrator on miss → outbound() schema-drift defense on response.
// Public response carries NO absPath (CODEX HIGH-1 strip happens in scanCoverageInternal).
coverageRoute.get('/coverage', async (c) => {
  const cached = getCoverageCache()
  if (cached) {
    return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), cached)
  }
  const value = await scanCoverage()
  setCoverageCache(value)
  return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), value)
})

// ── CODEX MED-14: per-repo refresh lock ───────────────────────────────────────
//
// Concurrent POSTs against the same {family, repo} serialise on the same promise.
// Resolved promises are cleaned up so the Map stays bounded.
// Different repos refresh in parallel — no global lock.
const refreshLocks = new Map<string, Promise<CoverageRefreshResponse>>()

/**
 * Test-only: reset the per-repo refresh lock map so tests don't bleed into each other.
 */
export function _resetRefreshLocksForTests(): void {
  refreshLocks.clear()
}

// ── POST /coverage/refresh ────────────────────────────────────────────────────
//
// Validate body via CoverageRefreshRequestSchema (D-10-09 + CODEX HIGH-5: only
// 'gitnexus-analyze' accepted). Resolve {family, repo} → absPath via synchronous
// discoverRepos() (AGREED-3 perf — not a full scanCoverage() loop). Re-canonicalise
// absPath via realpathSync IMMEDIATELY before spawn (CODEX HIGH-3 TOCTOU mitigation).
// Dispatch to spawn module, invalidate cache, re-scan to populate updatedRow (CODEX HIGH-5).
coverageRoute.post('/coverage/refresh', async (c) => {
  // 1. Validate request body — D-10-09 + CODEX HIGH-5: only gitnexus-analyze accepted.
  let body: ReturnType<typeof CoverageRefreshRequestSchema.parse>
  try {
    const raw = await c.req.json()
    body = CoverageRefreshRequestSchema.parse(raw)
  } catch {
    return c.json({ ok: false, error: 'invalid_request_body' }, 400)
  }

  // 2. AGREED-3: resolve {family, repo} → absPath via SYNCHRONOUS discoverRepos().
  // No full scanCoverage() loop here — direct path lookup only.
  // Do this BEFORE the lock check so we can return 400 for unknown repos early.
  const repos = discoverRepos()
  const match = repos.find((r) => r.family === body.family && r.name === body.repo)
  if (!match) {
    return c.json({ ok: false, error: 'repo_not_found' }, 400)
  }

  const lockKey = `${body.family}/${body.repo}`

  // 3. CODEX MED-14: if a refresh for this {family, repo} is already in flight, await it.
  const existing = refreshLocks.get(lockKey)
  if (existing) {
    const resp = await existing
    return outbound(c, CoverageRefreshResponseSchema.parse.bind(CoverageRefreshResponseSchema), resp)
  }

  // 4. Build and register the in-flight promise.
  const inflight = (async (): Promise<CoverageRefreshResponse> => {
    // CODEX HIGH-3 TOCTOU mitigation: re-canonicalise absPath via realpathSync IMMEDIATELY
    // before spawn. Re-assert that the realpath stays under the family root + sep.
    // A symlink swap between discovery and spawn is rejected here — spawn never invoked.
    let canonicalAbs: string
    try {
      canonicalAbs = realpathSync(match.absPath)
    } catch {
      return { ok: false, kind: 'error', exitCode: -1, stderr: 'repo path no longer accessible' }
    }

    let familyRoot: string
    try {
      familyRoot = realpathSync(join(homedir(), 'Sourcecode', body.family))
    } catch {
      familyRoot = join(homedir(), 'Sourcecode', body.family)
    }

    if (!(canonicalAbs === familyRoot || canonicalAbs.startsWith(familyRoot + sep))) {
      return {
        ok: false,
        kind: 'error',
        exitCode: -1,
        stderr: `repo path escapes family root after canonicalisation (TOCTOU): ${canonicalAbs} does not start with ${familyRoot + sep}`,
      }
    }

    // 5. Dispatch to spawn module — the only allowed action is gitnexus-analyze
    //    (enforced at schema parse above; D-10-09 wiki-compile rejected before reaching here).
    let result: Awaited<ReturnType<typeof spawnGitNexusAnalyze>>
    try {
      result = await spawnGitNexusAnalyze(canonicalAbs)
    } catch (err) {
      return {
        ok: false,
        kind: 'error',
        exitCode: -1,
        stderr: err instanceof Error ? err.message : String(err),
      }
    }

    // 6. Invalidate cache so the next GET re-scans with fresh data.
    invalidateCoverageCache()

    if (result.kind === 'ok') {
      // CODEX HIGH-5: updatedRow REQUIRED on success.
      // Re-invoke scanCoverageInternal() after spawn to populate updatedRow.
      // (AGREED-3: this post-spawn re-scan is the ONLY scanCoverage call — not called before spawn.)
      const { response: fresh } = await scanCoverageInternal()
      const updatedRow = fresh.rows.find(
        (r) => r.family === body.family && r.repo === body.repo,
      )
      if (!updatedRow) {
        // Defensive path — should not happen since repo was discovered above.
        return {
          ok: false,
          kind: 'error',
          exitCode: -1,
          stderr: 'updated row missing after re-scan',
        }
      }
      return { ok: true, kind: 'ok', updatedRow }
    }

    if (result.kind === 'not-installed') return { ok: false, kind: 'not-installed' }
    if (result.kind === 'timeout') return { ok: false, kind: 'timeout' }
    // result.kind === 'error'
    return { ok: false, kind: 'error', exitCode: result.exitCode, stderr: result.stderr }
  })()

  // CODEX MED-14: register the lock for the lifetime of the spawn; clean up after settle.
  refreshLocks.set(lockKey, inflight)
  try {
    const resp = await inflight
    return outbound(c, CoverageRefreshResponseSchema.parse.bind(CoverageRefreshResponseSchema), resp)
  } finally {
    refreshLocks.delete(lockKey)
  }
})
