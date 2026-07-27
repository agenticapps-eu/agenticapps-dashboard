import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WorkflowResponseSchema,
  type WorkflowResponse,
} from '@agenticapps/dashboard-shared'

vi.mock('../lib/workflowScan.js', () => ({
  scanWorkflowFleet: vi.fn(),
}))

import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { scanWorkflowFleet } from '../lib/workflowScan.js'
import { createApp } from '../server/app.js'

function missingHost(
  hostId: WorkflowResponse['hosts'][number]['hostId'],
): WorkflowResponse['hosts'][number] {
  return {
    hostId,
    state: 'missing',
    primary: null,
    skills: [],
    minimum: null,
    maximum: null,
    laggards: [],
    unknowns: [],
    internallyConsistent: false,
    coreState: 'unavailable',
    divergent: true,
    artifacts: [],
    migration: { kind: 'offered', highest: null },
  }
}

function responseFixture(): WorkflowResponse {
  return WorkflowResponseSchema.parse({
    schemaVersion: 1,
    generatedAtIso: '2026-07-27T20:00:00.000Z',
    core: {
      repoId: 'agenticapps-workflow-core',
      state: 'missing',
      specVersion: null,
    },
    hosts: [
      missingHost('claude-workflow'),
      missingHost('codex-workflow'),
      missingHost('opencode-workflow'),
      missingHost('pi-agentic-apps-workflow'),
    ],
    machineRoots: [
      { rootId: 'agenticapps-bin', state: 'absent', entries: [] },
      { rootId: 'claude-skills', state: 'absent', entries: [] },
      { rootId: 'codex-skills', state: 'absent', entries: [] },
      { rootId: 'opencode-skills', state: 'absent', entries: [] },
      { rootId: 'pi-skills', state: 'absent', entries: [] },
    ],
  })
}

describe('GET /api/v2/workflow', () => {
  let authFile: string
  let token: string
  let cleanup: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
    vi.mocked(scanWorkflowFleet).mockResolvedValue(responseFixture())
  })

  it('inherits bearer authentication', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow',
    )
    cleanup()
    expect(response.status).toBe(401)
  })

  it('returns the schema-validated settled matrix', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const body = await response.json()
    cleanup()

    expect(response.status).toBe(200)
    expect(() => WorkflowResponseSchema.parse(body)).not.toThrow()
    expect(scanWorkflowFleet).toHaveBeenCalledTimes(1)
  })

  it('turns outbound schema drift into a 500 response', async () => {
    vi.mocked(scanWorkflowFleet).mockResolvedValue({
      ...responseFixture(),
      schemaVersion: 2,
    } as unknown as WorkflowResponse)
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    cleanup()

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'schema_drift',
    })
  })
})
