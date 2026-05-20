/**
 * registryFixPath.ts — POST /api/admin/registry/fix-path
 *
 * THE Phase 12 daemon write surface (D-12-19, D-12-26). Repairs registry
 * entries whose stored `root` has drifted from on-disk reality, surfaced
 * by the conformance scan's drift detector (Task 2).
 *
 * Bearer-auth + CORS lock inherited from app.ts middleware.
 *
 * Validation pipeline (ALL must pass; first failure short-circuits):
 *   1. Zod body parse (RegistryFixPathRequestSchema.strict)        → 422 invalid_request
 *   2. Rate limit per token-hash (10 req / 10s — Phase 1 A-01)     → 429 rate_limited
 *   3. canonicaliseRoot(newPath) — realpath + abs                  → 422 newPath_unresolvable
 *   4. assertRegistrationAllowed(canonical) — system + secret bl   → 422 newPath_blocked
 *   5. Family-root containment check (realpath of each COVERAGE_ROOT,
 *      compare canonical === r || canonical.startsWith(r + sep))   → 422 newPath_outside_family_roots
 *   6. readRegistry + find by id                                   → 404 project_not_found
 *   7. Mutate + writeRegistry (atomic via atomicWriteFile)
 *   8. invalidateConformanceCache + invalidateCoverageCache
 *   9. outbound(RegistryEntrySchema.parse, updatedEntry)
 *
 * Threat-model mappings (see Plan 12-02 §threat_model):
 *   - T-12-PATH-TRAVERSAL: steps 3 + 4 + 5
 *   - T-12-SYMLINK-ESCAPE: realpath in step 3 + family realpath in step 5
 *     + atomicWriteFile O_NOFOLLOW in step 7
 *   - T-12-CONCURRENT-WRITE: atomicWriteFile rename + rate limiter (step 2)
 *   - T-12-CSRF: CORS lock + bearer auth (NOT cookie auth → no CSRF surface)
 *   - T-12-AUTH: bearer middleware (constant-time compare)
 *   - T-12-INFO-DISCLOSURE: structured error codes only; never echo paths
 *   - T-12-REGISTRY-CORRUPTION: writeRegistry → atomicWriteFile 0o600
 *   - T-12-DENIAL-OF-SERVICE: rate limiter step 2
 *   - T-12-SUPPLY-CHAIN: no new runtime deps
 *   - T-12-IDEMPOTENT-FAIL: idempotent — same payload yields same final state
 *   - T-12-CACHE-STALE: step 8 cache invalidation
 *
 * A4 ratified (see RESEARCH §Pitfall 6): NO `proper-lockfile`. Concurrent
 * writes serialize via atomicWriteFile's POSIX-rename + rate limiter.
 *
 * A7 ratified: assertRegistrationAllowed's existing blocklist (18 system
 * roots + 9 secret dirs + CONFIG_DIR) is sufficient for newPath validation.
 */
import { realpath } from 'node:fs/promises'
import { sep } from 'node:path'

import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  RegistryEntrySchema,
  RegistryFixPathRequestSchema,
} from '@agenticapps/dashboard-shared'

import {
  readRegistry,
  writeRegistry,
  canonicaliseRoot,
  assertRegistrationAllowed,
  RegistrationPathBlocked,
} from '../lib/registry.js'
import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import { COVERAGE_ROOTS } from '../lib/paths.js'
import { invalidateConformanceCache } from '../lib/conformanceCache.js'
import { invalidateCoverageCache } from '../lib/coverageCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

/** Pull the trimmed bearer token from Authorization header — null when absent. */
function tokenFromAuthHeader(c: Context): string | null {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice('Bearer '.length).trim()
}

/** Family roots whose realpath bounds the legal newPath set. */
const FAMILY_ROOTS = ['agenticapps', 'factiv', 'neuroflash'] as const

/**
 * Resolve all family roots to realpath form for the containment check.
 * Tolerates absent dirs (returns null entries so containment check just
 * skips them — a non-existent family root cannot contain anything anyway).
 */
async function realFamilyRoots(): Promise<Array<string | null>> {
  return Promise.all(
    FAMILY_ROOTS.map(async (family) => {
      try {
        return await realpath(COVERAGE_ROOTS[family]())
      } catch {
        return null
      }
    }),
  )
}

export const registryFixPathRoute = new Hono<Env>()

registryFixPathRoute.post(
  '/registry/fix-path',
  zValidator('json', RegistryFixPathRequestSchema, (result, c) => {
    if (!result.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestId = (((c as any).get?.('requestId') as string | undefined) ?? 'unknown')
      return c.json({ ok: false, error: 'invalid_request', requestId }, 422)
    }
  }),
  async (c) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'

    // ── Step 2: rate limit ──────────────────────────────────────────────
    const token = tokenFromAuthHeader(c)
    const tokHash = token ? tokenHashOf(token) : 'no-token'
    const rl = rlConsume(tokHash)
    if (!rl.allowed) {
      return c.json(
        { ok: false, error: 'rate_limited', requestId },
        429,
        { 'Retry-After': String(rl.retryAfter) },
      )
    }

    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined

    // ── Step 3: canonicalise newPath (realpath + abs) ───────────────────
    // canonicaliseRoot is defensive — falls back to plain resolve() when
    // realpath fails (e.g. dangling symlink). Either way the result is an
    // absolute path that the blocklist + containment checks can reason about.
    let canonical: string
    try {
      canonical = canonicaliseRoot(body.newPath)
    } catch {
      return c.json({ ok: false, error: 'newPath_unresolvable', requestId }, 422)
    }

    // ── Step 4: blocklist defence ───────────────────────────────────────
    try {
      assertRegistrationAllowed(canonical)
    } catch (err) {
      if (err instanceof RegistrationPathBlocked) {
        // Echo the blocked reason — it's about the user-supplied input,
        // NOT a server internal (matches Phase 1 register-prepare pattern).
        return c.json(
          { ok: false, error: 'newPath_blocked', reason: err.reason, requestId },
          422,
        )
      }
      throw err
    }

    // ── Step 5: family-root containment (Pitfall 7 — realpath-everywhere) ─
    const roots = (await realFamilyRoots()).filter((r): r is string => r !== null)
    const insideFamily = roots.some(
      (r) => canonical === r || canonical.startsWith(r + sep),
    )
    if (!insideFamily) {
      return c.json(
        { ok: false, error: 'newPath_outside_family_roots', requestId },
        422,
      )
    }

    // ── Step 6: lookup project by id ───────────────────────────────────
    const reg = readRegistry(registryFile)
    const entry = reg.projects.find((p) => p.id === body.id)
    if (!entry) {
      return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
    }

    // ── Step 7: mutate + atomic write ───────────────────────────────────
    entry.root = canonical
    writeRegistry(reg, registryFile)

    // ── Step 8: cache invalidation (T-12-CACHE-STALE) ──────────────────
    invalidateConformanceCache()
    invalidateCoverageCache()

    // ── Step 9: outbound — schema-drift defence ─────────────────────────
    return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), entry)
  },
)
