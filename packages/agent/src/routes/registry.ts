import { basename } from 'node:path'

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'
import {
  RegisterResponseSchema,
  RegistryEntrySchema,
  RegistryListResponseSchema,
  RegisterPrepareRequestSchema,
  RegisterPrepareResponseSchema,
  RegisterConfirmRequestSchema,
  RegisterConfirmResponseSchema,
  RenameRequestSchema,
  TagsRequestSchema,
} from '@agenticapps/dashboard-shared'

import {
  addProject,
  removeProject,
  listProjectsWithStatus,
  readRegistry,
  assertRegistrationAllowed,
  RegistrationPathBlocked,
  canonicaliseRoot,
  slugify,
  renameProject,
  setTags,
} from '../lib/registry.js'
import { issueNonce, consumeNonce } from '../lib/registerNonces.js'
import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import { logBlocked } from '../lib/registerLog.js'
import { detectMarkers } from '../lib/projectOverview.js'
import { evict as evictOverviewCache } from '../lib/overviewCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

const RegisterBodySchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  client: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const UnregisterBodySchema = z.object({ id: z.string().min(1) })

/** Return 422 (not 400) for zod validation failures, per D-06. */
function validationError(c: Context): Response {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestId = ((c as any).get?.('requestId') as string | undefined) ?? 'unknown'
  return c.json({ ok: false, error: 'invalid_request', requestId }, 422)
}

/** Extract the raw bearer token from the Authorization header. */
function tokenFromAuthHeader(c: Context): string | null {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice('Bearer '.length).trim()
}

export const registryRoute = new Hono<Env>()

registryRoute.get('/', async (c) => {
  const registryFile = c.get('registryFile') as string | undefined
  const items = await listProjectsWithStatus(registryFile)
  return outbound(c, RegistryListResponseSchema.parse.bind(RegistryListResponseSchema), items)
})

registryRoute.post(
  '/register',
  zValidator('json', RegisterBodySchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined
    const opts: { name?: string; client?: string | null; tags?: string[] } = {
      client: body.client ?? null,
    }
    if (body.name !== undefined) opts.name = body.name
    if (body.tags !== undefined) opts.tags = body.tags
    const result = addProject(body.path, opts, registryFile)
    const status = result.alreadyRegistered ? 200 : 201
    return outbound(
      c,
      RegisterResponseSchema.parse.bind(RegisterResponseSchema),
      { ...result.entry, alreadyRegistered: result.alreadyRegistered },
      status,
    )
  },
)

registryRoute.post(
  '/unregister',
  zValidator('json', UnregisterBodySchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined
    const removed = removeProject(body.id, registryFile)
    if (removed) {
      evictOverviewCache(body.id) // T-03-03-05 cache hygiene
      return c.body(null, 204)
    }
    return c.json(
      { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
      404,
    )
  },
)

// ─── Phase 3: prepare/confirm (D-09..D-19) ────────────────────────────────────

registryRoute.post(
  '/register-prepare',
  zValidator('json', RegisterPrepareRequestSchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  async (c) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'

    // D-14: rate limit (per token hash, sliding 10s window, cap 10)
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
    const resolvedRoot = canonicaliseRoot(body.path)
    const registryFile = c.get('registryFile') as string | undefined

    // D-17: already registered?
    const reg = readRegistry(registryFile)
    const existing = reg.projects.find((p) => p.root === resolvedRoot)
    if (existing) {
      return outbound(
        c,
        RegisterPrepareResponseSchema.parse.bind(RegisterPrepareResponseSchema),
        { canonicalRoot: resolvedRoot, alreadyRegistered: true as const, existingEntry: existing },
      )
    }

    // D-11: blocked?
    try {
      assertRegistrationAllowed(resolvedRoot)
    } catch (err) {
      if (err instanceof RegistrationPathBlocked) {
        logBlocked(err.reason, resolvedRoot, tokHash, requestId) // D-15
        return outbound(
          c,
          RegisterPrepareResponseSchema.parse.bind(RegisterPrepareResponseSchema),
          { canonicalRoot: resolvedRoot, blocked: true as const, blockedReason: err.reason },
        )
      }
      throw err
    }

    // D-09: issue nonce
    const suggestedName = basename(resolvedRoot)
    const suggestedSlug = slugify(suggestedName)
    const markers = detectMarkers(resolvedRoot)
    const { nonce, expiresAt } = issueNonce({
      canonicalRoot: resolvedRoot,
      suggestedName,
      suggestedSlug,
      detectedMarkers: markers,
    })

    return outbound(
      c,
      RegisterPrepareResponseSchema.parse.bind(RegisterPrepareResponseSchema),
      {
        canonicalRoot: resolvedRoot,
        suggestedName,
        suggestedSlug,
        alreadyRegistered: false as const,
        blocked: false as const,
        detectedMarkers: markers,
        nonce,
        expiresAt,
      },
    )
  },
)

registryRoute.post(
  '/register-confirm',
  zValidator('json', RegisterConfirmRequestSchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    const body = c.req.valid('json')

    // D-09 / D-18: consume the nonce (single-use; returns null for unknown OR expired)
    const entry = consumeNonce(body.nonce)
    if (!entry) {
      return c.json({ ok: false, error: 'nonce_expired', requestId }, 410)
    }

    // Defense-in-depth: re-run assertRegistrationAllowed on confirm (D-09 supersedes
    // Phase 1 B2 stopgap but stopgap stays as a second layer).
    try {
      assertRegistrationAllowed(entry.canonicalRoot)
    } catch (err) {
      if (err instanceof RegistrationPathBlocked) {
        // Race window: path entered blocklist between prepare and confirm.
        // Fail closed; do not register. Log per D-15.
        const token = tokenFromAuthHeader(c)
        const tokHash = token ? tokenHashOf(token) : 'no-token'
        logBlocked(err.reason, entry.canonicalRoot, tokHash, requestId)
        return c.json({ ok: false, error: 'path_blocked', requestId }, 422)
      }
      throw err
    }

    const registryFile = c.get('registryFile') as string | undefined
    const opts: { name?: string; client?: string | null; tags?: string[] } = {
      client: body.client ?? null,
    }
    opts.name = body.name ?? entry.suggestedName
    if (body.tags !== undefined) opts.tags = body.tags

    const result = addProject(entry.canonicalRoot, opts, registryFile)
    const status = result.alreadyRegistered ? 200 : 201
    return outbound(
      c,
      RegisterConfirmResponseSchema.parse.bind(RegisterConfirmResponseSchema),
      { ...result.entry, alreadyRegistered: result.alreadyRegistered },
      status,
    )
  },
)

// ─── Phase 3 Plan 05: rename + tags mutation routes (D-24) ────────────────────

registryRoute.post(
  '/:id/rename',
  zValidator('json', RenameRequestSchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined
    const ok = renameProject(id, body.name, registryFile)
    if (!ok) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }
    // Return the updated registry entry
    const reg = readRegistry(registryFile)
    const updated = reg.projects.find((p) => p.id === id)!
    return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), updated)
  },
)

registryRoute.post(
  '/:id/tags',
  zValidator('json', TagsRequestSchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined
    const ok = setTags(id, body.tags, registryFile)
    if (!ok) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }
    // Return the updated registry entry
    const reg = readRegistry(registryFile)
    const updated = reg.projects.find((p) => p.id === id)!
    return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), updated)
  },
)
