import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  WorkflowHarnessRequestSchema,
  WorkflowHarnessResultSchema,
  WorkflowResponseSchema,
  type WorkflowHarnessRequest,
} from '@agenticapps/dashboard-shared'

import { DEV_ORIGIN, PROD_ORIGIN } from '../constants.js'
import {
  readWorkflowHarnessResult,
  runWorkflowHarness,
} from '../lib/workflowHarness.js'
import { scanWorkflowFleet } from '../lib/workflowScan.js'
import type { Env } from '../server/app.js'
import { outbound } from '../server/middleware/errors.js'

export const workflowRoute = new Hono<Env>()
const WorkflowHarnessResultsSchema = WorkflowHarnessResultSchema.array()

const HARNESS_REQUESTS: readonly WorkflowHarnessRequest[] = [
  'claude-workflow',
  'codex-workflow',
  'opencode-workflow',
  'pi-agentic-apps-workflow',
].flatMap((hostId) =>
  ['change-gate', 'reviewer-cli'].map((harnessId) =>
    WorkflowHarnessRequestSchema.parse({ hostId, harnessId }),
  ),
)

function workflowOptions(): { sourceFamilyRoot?: string } {
  const sourceFamilyRoot = process.env.AGENTICAPPS_WORKFLOW_SOURCE_ROOT
  return sourceFamilyRoot ? { sourceFamilyRoot } : {}
}

workflowRoute.get('/workflow', async (c) => {
  const response = await scanWorkflowFleet(workflowOptions())
  return outbound(
    c,
    WorkflowResponseSchema.parse.bind(WorkflowResponseSchema),
    response,
  )
})

workflowRoute.get('/workflow/harness', async (c) => {
  const settled = await Promise.all(
    HARNESS_REQUESTS.map((request) =>
      readWorkflowHarnessResult(request, workflowOptions()),
    ),
  )
  const response = settled.filter((result) => result !== null)
  return outbound(
    c,
    WorkflowHarnessResultsSchema.parse.bind(WorkflowHarnessResultsSchema),
    response,
  )
})

workflowRoute.post(
  '/workflow/harness',
  async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin && origin !== PROD_ORIGIN && origin !== DEV_ORIGIN) {
      const requestId =
        (c.get('requestId') as string | undefined) ?? 'unknown'
      return c.json(
        { ok: false, error: 'origin_not_allowed', requestId },
        403,
      )
    }
    await next()
  },
  zValidator('json', WorkflowHarnessRequestSchema, (validation, c) => {
    if (!validation.success) {
      const context = c as unknown as { get(key: string): unknown }
      const requestId =
        (context.get('requestId') as string | undefined) ?? 'unknown'
      return c.json(
        { ok: false, error: 'invalid_request', requestId },
        422,
      )
    }
  }),
  async (c) => {
    const response = await runWorkflowHarness(
      c.req.valid('json'),
      workflowOptions(),
    )
    return outbound(
      c,
      WorkflowHarnessResultSchema.parse.bind(WorkflowHarnessResultSchema),
      response,
    )
  },
)
