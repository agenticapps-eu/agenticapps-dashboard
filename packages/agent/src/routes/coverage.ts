import { Hono } from 'hono'

import { CoverageResponseSchema } from '@agenticapps/dashboard-shared'

import { scanCoverage } from '../lib/coverageScan.js'
import { getCoverageCache, setCoverageCache } from '../lib/coverageCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const coverageRoute = new Hono<Env>()

coverageRoute.get('/coverage', async (c) => {
  const cached = getCoverageCache()
  if (cached) {
    return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), cached)
  }

  const value = await scanCoverage()
  setCoverageCache(value)
  return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), value)
})
