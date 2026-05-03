import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'

import { ReadResponseSchema } from '@agenticapps/dashboard-shared'

import { resolveAllowed } from '../lib/paths.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'

import type { Env } from '../server/app.js'

const ReadQuerySchema = z.object({ path: z.string().min(1) })

export const readRoute = new Hono<Env>()

readRoute.get(
  '/:id/read',
  zValidator('query', ReadQuerySchema),
  async (c) => {
    const { id } = c.req.param()
    const { path: relPath } = c.req.valid('query')
    const reg = readRegistry()
    const project = reg.projects.find((p) => p.id === id)
    if (!project) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }

    // Throws PathViolation → caught by errorHandler → 422 with path_not_allowed
    const real = await resolveAllowed(project.root, relPath)
    const [content, st] = await Promise.all([readFile(real, 'utf8'), stat(real)])
    const sha256 = createHash('sha256').update(content).digest('hex')

    return outbound(c, ReadResponseSchema.parse.bind(ReadResponseSchema), {
      content,
      mtime: st.mtime.toISOString(),
      sha256,
    })
  },
)
