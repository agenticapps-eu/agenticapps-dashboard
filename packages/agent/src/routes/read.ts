import { open } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createHash } from 'node:crypto'

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'
import { ReadResponseSchema } from '@agenticapps/dashboard-shared'

import { resolveAllowed } from '../lib/paths.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import { MAX_READ_BYTES } from '../constants.js'
import type { Env } from '../server/app.js'

const ReadQuerySchema = z.object({ path: z.string().min(1) })

function validationError(c: Context): Response {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestId = ((c as any).get?.('requestId') as string | undefined) ?? 'unknown'
  return c.json({ ok: false, error: 'invalid_request', requestId }, 422)
}

export const readRoute = new Hono<Env>()

readRoute.get(
  '/:id/read',
  zValidator('query', ReadQuerySchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  async (c) => {
    const { id } = c.req.param()
    const { path: relPath } = c.req.valid('query')
    const registryFile = c.get('registryFile') as string | undefined
    const reg = readRegistry(registryFile)
    const project = reg.projects.find((p) => p.id === id)
    if (!project) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }

    // Throws PathViolation → caught by errorHandler → 422 with path_not_allowed
    const real = await resolveAllowed(project.root, relPath)

    // Open with O_NOFOLLOW so a symlink swap between resolveAllowed's realpath()
    // and this open() (TOCTOU window) fails at open time rather than reading
    // through the planted symlink. Then fstat the fd to enforce regular-file +
    // size cap; reading from the fd avoids re-resolving the path.
    const fh = await open(real, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    try {
      const st = await fh.stat()
      if (!st.isFile()) {
        return c.json(
          { ok: false, error: 'not_a_regular_file', requestId: c.get('requestId') },
          422,
        )
      }
      if (st.size > MAX_READ_BYTES) {
        return c.json(
          { ok: false, error: 'file_too_large', requestId: c.get('requestId') },
          413,
        )
      }
      const buf = await fh.readFile()
      const content = buf.toString('utf8')
      const sha256 = createHash('sha256').update(buf).digest('hex')
      return outbound(c, ReadResponseSchema.parse.bind(ReadResponseSchema), {
        content,
        mtime: st.mtime.toISOString(),
        sha256,
      })
    } finally {
      await fh.close()
    }
  },
)
