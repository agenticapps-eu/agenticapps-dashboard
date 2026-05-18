/**
 * skillDrift.ts — Cross-repo Skill drift route surface (Plan 11-03).
 *
 * Routes:
 *   GET  /api/skills/drift               — per-skill matrix across all registered projects
 *   POST /api/skills/drift/agentlinter   — on-demand AgentLinter run for ONE project
 *
 * Inherits bearer-auth + CORS from app.ts middleware chain. No new auth code.
 *
 * D-11-04: GET returns the per-skill matrix (rows = skills, columns = projects).
 * D-11-14: POST runs AgentLinter for EXACTLY ONE projectId per request — single-
 *   project-per-request enforced structurally by a `.strict()` Zod schema. The
 *   POST handler reuses Phase 5's `runAgentLinter` + `agentLinterCache` UNCHANGED
 *   (same binary, same args, same 30s timeout, same cache key).
 *
 * Trust-boundary contract (T-11-03-01..12):
 *   - Body Zod-validated; `projectId` is single-string only — arrays / extras reject.
 *   - Route NEVER trusts request input as a filesystem path. `runAgentLinter` is
 *     invoked with `entry.root` resolved from `readRegistry()` — the registry is
 *     the explicit consent boundary.
 *   - Same supply-chain invariant as Phase 5 (D-5-21): the spawn target is the
 *     locked `@agenticapps/agentlinter` package; this is a new CALL-SITE, not a
 *     new spawn surface.
 *
 * REVIEWS action item 10: POST response uses the SHARED `AgentLinterResponseSchema`
 * from `@agenticapps/dashboard-shared` (NOT a local copy). The wrap shape mirrors
 * Phase 5's `routes/agentlinter.ts` — `enrichWithCachedAt` adds the `cachedAt`
 * timestamp to `ok` results so the discriminated union parses.
 */
import { Hono } from 'hono'
import { z } from 'zod'

import {
  AgentLinterResponseSchema,
  SkillDriftResponseSchema,
} from '@agenticapps/dashboard-shared'

import {
  computeMaxMtime,
  getAgentLinterCached,
  setAgentLinterCached,
} from '../lib/agentLinterCache.js'
import { runAgentLinter } from '../lib/agentLinterRunner.js'
import { readRegistry } from '../lib/registry.js'
import {
  getSkillDriftCached,
  setSkillDriftCached,
} from '../lib/skillDriftCache.js'
import { scanSkillDrift } from '../lib/skillDriftScan.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const skillDriftRoute = new Hono<Env>()

// ── GET /skills/drift ─────────────────────────────────────────────────────────

skillDriftRoute.get('/skills/drift', async (c) => {
  const cached = getSkillDriftCached()
  const response = cached ?? (await scanSkillDrift())
  if (!cached) setSkillDriftCached(response)
  return outbound(
    c,
    SkillDriftResponseSchema.parse.bind(SkillDriftResponseSchema),
    response,
  )
})

// ── POST /skills/drift/agentlinter ────────────────────────────────────────────

/**
 * D-11-14 — single-project-per-request enforced structurally.
 *
 * `.strict()` rejects extra fields so a typo or smuggled `projectIds: [...]`
 * surfaces as 400 invalid_request_body, NOT silent acceptance. `projectId` is
 * a non-empty string — arrays don't satisfy `z.string()`.
 */
const AgentLinterDriftRequestSchema = z
  .object({
    projectId: z.string().min(1),
  })
  .strict()

skillDriftRoute.post('/skills/drift/agentlinter', async (c) => {
  // 1. Body Zod-parse — invalid JSON, missing field, empty string, extra fields,
  //    or array smuggle ALL surface as 400 invalid_request_body. The empty-body
  //    path produces a `SyntaxError` from `c.req.json()`, caught below.
  let body: { projectId: string }
  try {
    const raw = await c.req.json()
    body = AgentLinterDriftRequestSchema.parse(raw)
  } catch {
    return c.json({ ok: false, error: 'invalid_request_body' }, 400)
  }

  // 2. Registry lookup — fails closed (404) when project is unknown. The
  //    registry is the explicit consent boundary (Threat T-11-03-05).
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === body.projectId)
  if (!entry) {
    return c.json({ ok: false, error: 'project_not_found' }, 404)
  }

  // 3. Reuse Phase 5 cache + runner UNCHANGED (D-11-14). Same binary, same
  //    argv shape, same 30s timeout, same cache key (projectId + maxMtime).
  const maxMtime = await computeMaxMtime(entry.root)
  const cached = getAgentLinterCached(entry.id, maxMtime)
  if (cached) {
    const payload = enrichWithCachedAt(cached.result, cached.cachedAt)
    return outbound(
      c,
      AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema),
      payload,
    )
  }

  // 4. Cache miss — run a fresh lint. Each POST runs EXACTLY ONE lint for
  //    EXACTLY ONE projectRoot (D-11-14). No loop, no Promise.all over projects.
  const result = await runAgentLinter(entry.root)
  const cachedAt = new Date().toISOString()
  setAgentLinterCached(entry.id, { result, cachedAt, maxMtime })

  const payload = enrichWithCachedAt(result, cachedAt)
  return outbound(
    c,
    AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema),
    payload,
  )
})

/**
 * Mirror Phase 5's `routes/agentlinter.ts` `enrichWithCachedAt`: the
 * `AgentLinterResponseSchema` `ok` variant requires `cachedAt`; the other
 * four variants (`not-installed`, `timeout`, `error`, `unparseable`) carry
 * no timestamp.
 */
function enrichWithCachedAt(
  result: Awaited<ReturnType<typeof runAgentLinter>>,
  cachedAt: string,
): unknown {
  if (result.kind === 'ok') return { ...result, cachedAt }
  return result
}
