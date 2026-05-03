import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'
import {
  RegistryEntrySchema,
  RegistryListResponseSchema,
} from '@agenticapps/dashboard-shared'

import { addProject, removeProject, listProjectsWithStatus } from '../lib/registry.js'
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
    const status = result.alreadyRegistered ? (200 as const) : (201 as const)
    const entry = RegistryEntrySchema.parse(result.entry)
    return c.json({ ...entry, alreadyRegistered: result.alreadyRegistered }, status)
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
    if (removed) return c.body(null, 204)
    return c.json(
      { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
      404,
    )
  },
)
