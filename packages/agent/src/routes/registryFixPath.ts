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
 *   3. realpath(newPath) — explicit existence + symlink resolution → 422 newPath_unresolvable
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
import { existsSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'

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
  withRegistryLock,
  assertRegistrationAllowed,
  RegistrationPathBlocked,
} from '../lib/registry.js'
import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import { COVERAGE_ROOTS } from '../lib/paths.js'
import { readGitOrigin } from '../lib/registryPathDrift.js'
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
    // Explicit realpath check at the route boundary. canonicaliseRoot
    // (registry.ts) silently falls back to plain resolve() on ENOENT,
    // which would let a non-existent path land in registry.json (silent
    // corruption, dead-code 422 branch). Here we resolve first and require
    // the path to actually exist on disk before delegating to the helper.
    let canonical: string
    try {
      canonical = await realpath(body.newPath)
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

    // ── Steps 6/6a/7: read-modify-write under an advisory cross-process
    //    lock. Without this, a concurrent CLI mutation (register/unregister/
    //    rename/tag) landing between readRegistry and writeRegistry would
    //    clobber the daemon's change last-writer-wins. withRegistryLock
    //    acquires `<registry>.lock` with O_EXCL, retries on contention,
    //    times out after 5s. writeRegistry inside handles cache invalidation.
    type Entry = ReturnType<typeof readRegistry>['projects'][number]
    type EarlyExit =
      | { kind: 'project_not_found' }
      | { kind: 'newPath_not_a_repo' }
      | { kind: 'newPath_origin_mismatch' }
    type Result = { kind: 'ok'; entry: Entry } | EarlyExit
    let lockResult: Result
    try {
      lockResult = await withRegistryLock(async (): Promise<Result> => {
        // Step 6: lookup project by id.
        const reg = readRegistry(registryFile)
        const entry = reg.projects.find((p) => p.id === body.id)
        if (!entry) return { kind: 'project_not_found' }

        // Step 6a: target-is-a-repo check. Prevent silent misdirection —
        // a token holder could otherwise repoint project-A to project-B's
        // directory, or to project-B/src.
        if (!existsSync(join(canonical, '.git'))) {
          return { kind: 'newPath_not_a_repo' }
        }
        const oldOrigin = await readGitOrigin(entry.root)
        if (oldOrigin) {
          const newOrigin = await readGitOrigin(canonical)
          if (!newOrigin || newOrigin !== oldOrigin) {
            return { kind: 'newPath_origin_mismatch' }
          }
        }

        // Step 7: mutate + atomic write. writeRegistry invalidates caches.
        entry.root = canonical
        writeRegistry(reg, registryFile)
        return { kind: 'ok', entry }
      })
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.startsWith('registry_lock_timeout')) {
        return c.json({ ok: false, error: 'registry_lock_timeout', requestId }, 503)
      }
      throw err
    }

    if (lockResult.kind === 'project_not_found') {
      return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
    }
    if (lockResult.kind === 'newPath_not_a_repo') {
      return c.json({ ok: false, error: 'newPath_not_a_repo', requestId }, 422)
    }
    if (lockResult.kind === 'newPath_origin_mismatch') {
      return c.json({ ok: false, error: 'newPath_origin_mismatch', requestId }, 422)
    }

    // ── Step 8: outbound — schema-drift defence ─────────────────────────
    return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), lockResult.entry)
  },
)
