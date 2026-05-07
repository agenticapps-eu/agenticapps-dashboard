/**
 * Skills routes — HEALTH-01 InstalledSkills data source.
 *
 * Routes:
 *   GET /api/skills/global           — D-5-12 singleton, no projectId
 *   GET /api/projects/:id/skills/local — per-project local skills
 *
 * Both routes inherit bearer-auth + CORS from app.ts middleware chain.
 * No new auth code here.
 *
 * Security (T-05-02-Symlink-Escape): symlink-escape defence lives in skillsScan.ts.
 * Security (T-05-02-Schema-Drift): outbound() enforces schema parse on every response.
 * Security (T-05-02-Bearer-Bypass): inherited from app.ts bearerAuth middleware.
 * Security (T-05-02-CORS-Bypass): inherited from app.ts cors middleware.
 *
 * Cache: in-module memo with 60s TTL (Claude's Discretion per CONTEXT.md D-5-12).
 * Global skills cache is singleton (no projectId).
 * Local skills cache is per-projectId.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Hono } from 'hono'
import { GlobalSkillsResponseSchema, LocalSkillsResponseSchema } from '@agenticapps/dashboard-shared'

import { readGlobalSkills, readLocalSkills } from '../lib/skillsScan.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const skillsRoute = new Hono<Env>()

/** 60s memo TTL for skill lists (D-5-12 Claude's Discretion). */
const SKILLS_TTL_MS = 60_000

// ── Global skills singleton cache ─────────────────────────────────────────────

let globalCache: {
  value: Awaited<ReturnType<typeof readGlobalSkills>>
  cachedAtMs: number
} | null = null

skillsRoute.get('/skills/global', async (c) => {
  const now = Date.now()
  if (globalCache && now - globalCache.cachedAtMs < SKILLS_TTL_MS) {
    return outbound(
      c,
      GlobalSkillsResponseSchema.parse.bind(GlobalSkillsResponseSchema),
      globalCache.value,
    )
  }
  const root = join(homedir(), '.claude', 'skills')
  const value = await readGlobalSkills(root)
  globalCache = { value, cachedAtMs: now }
  return outbound(c, GlobalSkillsResponseSchema.parse.bind(GlobalSkillsResponseSchema), value)
})

// ── Per-project local skills cache ────────────────────────────────────────────

const localCache = new Map<
  string,
  {
    value: Awaited<ReturnType<typeof readLocalSkills>>
    cachedAtMs: number
  }
>()

skillsRoute.get('/projects/:id/skills/local', async (c) => {
  const projectId = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }

  const now = Date.now()
  const cached = localCache.get(projectId)
  if (cached && now - cached.cachedAtMs < SKILLS_TTL_MS) {
    return outbound(
      c,
      LocalSkillsResponseSchema.parse.bind(LocalSkillsResponseSchema),
      cached.value,
    )
  }

  const value = await readLocalSkills(entry.root)
  localCache.set(projectId, { value, cachedAtMs: now })
  return outbound(c, LocalSkillsResponseSchema.parse.bind(LocalSkillsResponseSchema), value)
})

// ── Cache reset helpers (for tests + registry eviction) ───────────────────────

/** Evict the local skills cache for a specific project (call on unregister). */
export function evictSkillsCacheProject(id: string): void {
  localCache.delete(id)
}

/** Test-only: reset both caches. */
export function __resetSkillsCache(): void {
  globalCache = null
  localCache.clear()
}
