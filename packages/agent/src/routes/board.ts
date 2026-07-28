import { Hono } from 'hono'
import { BoardResponseSchema } from '@agenticapps/dashboard-shared'

import { createSyntheticBoardFixture } from '../lib/boardSnapshot.js'
import { readRegistry } from '../lib/registry.js'
import type { Env } from '../server/app.js'
import { outbound } from '../server/middleware/errors.js'

export const boardRoute = new Hono<Env>()

boardRoute.get('/board', (c) => {
  const registry = readRegistry(c.get('registryFile') as string | undefined)
  let payload: unknown

  try {
    payload = createSyntheticBoardFixture(Date.now(), registry.projects)
  } catch {
    payload = null
  }

  return outbound(
    c,
    BoardResponseSchema.parse.bind(BoardResponseSchema),
    payload,
  )
})
