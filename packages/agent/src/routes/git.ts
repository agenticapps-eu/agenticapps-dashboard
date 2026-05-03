import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'

import { GitResponseSchema } from '@agenticapps/dashboard-shared'

import { runAllowedGit } from '../lib/git.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'

import type { Env } from '../server/app.js'

const GitQuerySchema = z.object({ cmd: z.string().min(1) })

function validationError(c: Context): Response {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestId = ((c as any).get?.('requestId') as string | undefined) ?? 'unknown'
  return c.json({ ok: false, error: 'invalid_request', requestId }, 422)
}

export const gitRoute = new Hono<Env>()

gitRoute.get(
  '/:id/git',
  zValidator('query', GitQuerySchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  async (c) => {
    const { id } = c.req.param()
    const { cmd } = c.req.valid('query')
    const registryFile = c.get('registryFile') as string | undefined
    const reg = readRegistry(registryFile)
    const project = reg.projects.find((p) => p.id === id)
    if (!project) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }
    // runAllowedGit throws GitNotAllowedError for disallowed cmds → errorHandler → 422
    const result = await runAllowedGit(cmd, project.root)
    return outbound(c, GitResponseSchema.parse.bind(GitResponseSchema), result)
  },
)
