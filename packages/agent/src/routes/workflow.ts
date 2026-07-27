import { Hono } from 'hono'
import { WorkflowResponseSchema } from '@agenticapps/dashboard-shared'

import { scanWorkflowFleet } from '../lib/workflowScan.js'
import type { Env } from '../server/app.js'
import { outbound } from '../server/middleware/errors.js'

export const workflowRoute = new Hono<Env>()

workflowRoute.get('/workflow', async (c) => {
  const response = await scanWorkflowFleet()
  return outbound(
    c,
    WorkflowResponseSchema.parse.bind(WorkflowResponseSchema),
    response,
  )
})
