import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

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

export const registryRoute = new Hono<Env>()

registryRoute.get('/', async (c) => {
  const items = await listProjectsWithStatus()
  return outbound(c, RegistryListResponseSchema.parse.bind(RegistryListResponseSchema), items)
})

registryRoute.post('/register', zValidator('json', RegisterBodySchema), (c) => {
  const body = c.req.valid('json')
  const result = addProject(body.path, body)
  const status = result.alreadyRegistered ? (200 as const) : (201 as const)
  const entry = RegistryEntrySchema.parse(result.entry)
  return c.json({ ...entry, alreadyRegistered: result.alreadyRegistered }, status)
})

registryRoute.post(
  '/unregister',
  zValidator('json', UnregisterBodySchema),
  (c) => {
    const body = c.req.valid('json')
    const removed = removeProject(body.id)
    return c.body(null, removed ? 204 : 404)
  },
)
