import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WorkflowHarnessResultSchema,
  WorkflowResponseSchema,
  type WorkflowResponse,
} from '@agenticapps/dashboard-shared'

vi.mock('../lib/workflowScan.js', () => ({
  scanWorkflowFleet: vi.fn(),
}))
vi.mock('../lib/workflowHarness.js', () => ({
  readWorkflowHarnessResult: vi.fn(),
  runWorkflowHarness: vi.fn(),
}))

import { PROD_ORIGIN } from '../constants.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import {
  readWorkflowHarnessResult,
  runWorkflowHarness,
} from '../lib/workflowHarness.js'
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

function harnessResultFixture(): Awaited<
  ReturnType<typeof runWorkflowHarness>
> {
  return WorkflowHarnessResultSchema.parse({
    schemaVersion: 1,
    hostId: 'codex-workflow',
    harnessId: 'change-gate',
    state: 'completed',
    passed: true,
    completedAtIso: '2026-07-27T20:00:00.000Z',
    ageMs: 0,
    output: 'all rows passed',
    cached: false,
  }) as Awaited<ReturnType<typeof runWorkflowHarness>>
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
    vi.mocked(readWorkflowHarnessResult).mockResolvedValue(null)
    vi.mocked(runWorkflowHarness).mockResolvedValue(harnessResultFixture())
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
    expect(runWorkflowHarness).not.toHaveBeenCalled()
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

  it('reads current cached harness results without starting a process', async () => {
    vi.mocked(readWorkflowHarnessResult).mockImplementation(async (request) =>
      request.hostId === 'codex-workflow' &&
      request.harnessId === 'change-gate'
        ? harnessResultFixture()
        : null,
    )

    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const body = await response.json()
    cleanup()

    expect(response.status).toBe(200)
    expect(body).toEqual([harnessResultFixture()])
    expect(readWorkflowHarnessResult).toHaveBeenCalledTimes(8)
    expect(runWorkflowHarness).not.toHaveBeenCalled()
  })

  it('uses only the daemon-configured source-family relocation', async () => {
    process.env.AGENTICAPPS_WORKFLOW_SOURCE_ROOT = '/srv/workflow-family'
    try {
      const app = createApp({ authFile })
      await app.request('http://127.0.0.1:5193/api/v2/workflow', {
        headers: { Authorization: `Bearer ${token}` },
      })
      await app.request('http://127.0.0.1:5193/api/v2/workflow/harness', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(scanWorkflowFleet).toHaveBeenCalledWith({
        sourceFamilyRoot: '/srv/workflow-family',
      })
      expect(readWorkflowHarnessResult).toHaveBeenCalledWith(
        expect.any(Object),
        { sourceFamilyRoot: '/srv/workflow-family' },
      )
    } finally {
      delete process.env.AGENTICAPPS_WORKFLOW_SOURCE_ROOT
      cleanup()
    }
  })
})

describe('POST /api/v2/workflow/harness', () => {
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
    vi.mocked(readWorkflowHarnessResult).mockResolvedValue(null)
    vi.mocked(runWorkflowHarness).mockResolvedValue(harnessResultFixture())
  })

  it('rejects missing bearer auth and does not accept a cookie credential', async () => {
    const app = createApp({ authFile })
    const unauthenticated = await app.request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
        }),
      },
    )
    const cookieOnly = await app.request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `token=${token}`,
        },
        body: JSON.stringify({
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
        }),
      },
    )
    cleanup()

    expect(unauthenticated.status).toBe(401)
    expect(cookieOnly.status).toBe(401)
    expect(runWorkflowHarness).not.toHaveBeenCalled()
  })

  it('rejects a disallowed origin before parsing or command selection', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Origin: 'https://evil.example.com',
        },
        body: '{malformed-json',
      },
    )
    cleanup()

    expect(response.status).toBe(403)
    expect(runWorkflowHarness).not.toHaveBeenCalled()
  })

  it('validates a fixed selection and returns an outbound-validated result', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Origin: PROD_ORIGIN,
        },
        body: JSON.stringify({
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
        }),
      },
    )
    const body = await response.json()
    cleanup()

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(PROD_ORIGIN)
    expect(() => WorkflowHarnessResultSchema.parse(body)).not.toThrow()
    expect(runWorkflowHarness).toHaveBeenCalledTimes(1)
    expect(runWorkflowHarness).toHaveBeenCalledWith({
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
    })
  })

  it.each([
    { hostId: 'unknown-host', harnessId: 'change-gate' },
    { hostId: 'codex-workflow', harnessId: 'unknown-harness' },
    {
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
      root: '/tmp/attacker-controlled',
    },
  ])('rejects a non-fixed request body before dispatch: %j', async (body) => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    cleanup()

    expect(response.status).toBe(422)
    expect(runWorkflowHarness).not.toHaveBeenCalled()
  })

  it('turns an invalid runner result into schema drift', async () => {
    vi.mocked(runWorkflowHarness).mockResolvedValue({
      ...harnessResultFixture(),
      passed: null,
    } as unknown as Awaited<ReturnType<typeof runWorkflowHarness>>)

    const response = await createApp({ authFile }).request(
      'http://127.0.0.1:5193/api/v2/workflow/harness',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
        }),
      },
    )
    cleanup()

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'schema_drift',
    })
  })

  it('runs against the daemon-configured source family', async () => {
    process.env.AGENTICAPPS_WORKFLOW_SOURCE_ROOT = '/srv/workflow-family'
    try {
      const response = await createApp({ authFile }).request(
        'http://127.0.0.1:5193/api/v2/workflow/harness',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hostId: 'codex-workflow',
            harnessId: 'change-gate',
          }),
        },
      )

      expect(response.status).toBe(200)
      expect(runWorkflowHarness).toHaveBeenCalledWith(
        {
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
        },
        { sourceFamilyRoot: '/srv/workflow-family' },
      )
    } finally {
      delete process.env.AGENTICAPPS_WORKFLOW_SOURCE_ROOT
      cleanup()
    }
  })
})
