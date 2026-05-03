import { Hono } from 'hono'

import { rotateToken } from '../lib/auth.js'

import type { Env } from '../server/app.js'

export const authRoute = new Hono<Env>()

authRoute.post('/rotate', (c) => {
  rotateToken()
  return c.body(null, 204)
})
