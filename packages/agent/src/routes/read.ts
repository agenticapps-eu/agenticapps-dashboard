import { open, realpath } from 'node:fs/promises'
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

    // Open with O_NOFOLLOW so a symlink swap of the FINAL component between
    // resolveAllowed's realpath() and this open() (TOCTOU window) fails at
    // open time. ELOOP/ENOTDIR/ENOENT from intermediate-component swaps
    // surface here too — translate them into path_not_allowed (422), not 500.
    let fh
    try {
      fh = await open(real, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ELOOP' || code === 'EMLINK' || code === 'ENOTDIR' || code === 'ENOENT') {
        return c.json(
          { ok: false, error: 'path_not_allowed', requestId: c.get('requestId') },
          422,
        )
      }
      throw err
    }
    try {
      // Re-realpath the same path string after open. If a parent component was
      // swapped to a symlink between resolveAllowed and open, realpath() now
      // resolves through the swap and yields a path different from `real`. The
      // fd may already be bound to the attacker's file, but we close it without
      // reading. (Defense beyond this requires openat() chains, which Node
      // doesn't expose portably; this catches the realistic same-uid swap.)
      let real2: string
      try {
        real2 = await realpath(real)
      } catch {
        return c.json(
          { ok: false, error: 'path_not_allowed', requestId: c.get('requestId') },
          422,
        )
      }
      if (real2 !== real) {
        return c.json(
          { ok: false, error: 'path_not_allowed', requestId: c.get('requestId') },
          422,
        )
      }

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
      // Read at most MAX_READ_BYTES from the fd. Hard-cap at the buffer length
      // so a file growing concurrently between stat() and read cannot exceed
      // the budget (Codex cross-confirmed concern). After the bounded read,
      // assert no more bytes remain so we don't silently truncate.
      const buf = Buffer.allocUnsafe(MAX_READ_BYTES)
      const { bytesRead } = await fh.read(buf, 0, MAX_READ_BYTES, 0)
      if (bytesRead >= MAX_READ_BYTES) {
        const peek = Buffer.allocUnsafe(1)
        const { bytesRead: extra } = await fh.read(peek, 0, 1, MAX_READ_BYTES)
        if (extra > 0) {
          return c.json(
            { ok: false, error: 'file_too_large', requestId: c.get('requestId') },
            413,
          )
        }
      }
      const slice = buf.subarray(0, bytesRead)
      const content = slice.toString('utf8')
      const sha256 = createHash('sha256').update(slice).digest('hex')
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
