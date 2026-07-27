import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WORKFLOW_QUERY_KEY,
  useRunWorkflowHarness,
  useWorkflow,
  useWorkflowHarnessResults,
} from './workflowQueries.js'

vi.mock('./pairing.js', () => ({
  getPairing: () => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token',
    pairedAt: '2026-07-27T20:00:00.000Z',
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function missingHost(hostId: string) {
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

const workflowResponse = {
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
}

const harnessResult = {
  schemaVersion: 1,
  hostId: 'codex-workflow',
  harnessId: 'change-gate',
  state: 'completed',
  passed: true,
  completedAtIso: '2026-07-27T20:00:00.000Z',
  ageMs: 0,
  output: 'all checks passed',
  cached: false,
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('workflow queries', () => {
  it('uses one stable workflow query key', () => {
    expect(WORKFLOW_QUERY_KEY).toEqual(['workflow'])
  })

  it('reads the workflow matrix without starting a harness', async () => {
    mockFetch.mockReturnValue(jsonResponse(workflowResponse))

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/api/v2/workflow')
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('surfaces response schema drift as a query error', async () => {
    mockFetch.mockReturnValue(jsonResponse({ schemaVersion: 99 }))

    const { result } = renderHook(() => useWorkflow(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/^schema_drift:/)
  })

  it('reads cached harness results without a mutation', async () => {
    mockFetch.mockReturnValue(jsonResponse([{ ...harnessResult, cached: true }]))

    const { result } = renderHook(() => useWorkflowHarnessResults(), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v2/workflow/harness')
    expect(init?.method).toBeUndefined()
    expect(result.current.data?.[0]?.cached).toBe(true)
  })

  it('posts only the fixed host and harness selection after mutation', async () => {
    mockFetch.mockReturnValue(jsonResponse(harnessResult))
    const { result } = renderHook(() => useRunWorkflowHarness(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        hostId: 'codex-workflow',
        harnessId: 'change-gate',
      })
    })

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v2/workflow/harness')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
    })
  })
})
