/**
 * projectQueries.test.ts — TDD tests for Phase 4 SPA query hooks.
 *
 * Tests Q1–Q11 covering:
 * - URL construction per hook
 * - Schema drift error path
 * - observations limit in URL + queryKey
 * - queryKey shapes for all 5 hooks
 * - enabled: id !== null gate
 * - staleTime / refetchInterval / refetchIntervalInBackground config
 * - cross-project cache isolation
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Import hooks under test (fail until projectQueries.ts exists)
import {
  useCommitment,
  useObservations,
  useDiscipline,
  usePhaseProgress,
  useSecurity,
  useGlobalSkills,
  useLocalSkills,
  useAgentLinter,
  useObservability,
  useSecrets,
  useIntegrations,
} from './projectQueries.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Disable automatic refetching in tests
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

function makeSuccessResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function makeDriftResponse() {
  // Returns a valid HTTP response but with schema-invalid body (missing required field)
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ unexpected: 'drift' }),
    clone: () => ({ json: () => Promise.resolve({ unexpected: 'drift' }) }),
  })
}

// ── Valid fixture bodies ──────────────────────────────────────────────────────

const COMMITMENT_BODY = { markdown: '## Workflow commitment\n\nI commit.', sourceFile: 'session-2026.md' }
const OBSERVATIONS_BODY = { entries: [{ ts: '2026-05-01T10:00:00Z', skill: 'meta-observer', hook: 'PostToolUse' }], skillInstalled: true }
const DISCIPLINE_BODY = { rationalization: { rows: [{ label: 'Workflow skill not followed', fires: 2 }], skillInstalled: true } }
const PHASE_PROGRESS_BODY = {
  phase: '04-single-project-view',
  paddedPhase: '04',
  files: [],
  tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
  review: { stage1: null, stage2: null },
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}
const SECURITY_BODY = { cso: null, dbSentinel: null }

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useCommitment', () => {
  it('Q1: fetches /api/projects/acme/commitment and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(COMMITMENT_BODY),
      clone: () => ({ json: () => Promise.resolve(COMMITMENT_BODY) }),
    })

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(COMMITMENT_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/commitment')

    qc.clear()
  })

  it('Q2: on 200 + schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('Q9: when id is null, hook is idle (not triggered)', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('Q10: staleTime is 5000, refetchInterval is 5000, refetchIntervalInBackground is false', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCommitment('acme'), { wrapper })

    const cache = qc.getQueryCache()
    const queries = cache.getAll()
    const q = queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['commitment', 'acme']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(5_000)
    expect(opts?.refetchInterval).toBe(5_000)
    expect(opts?.refetchIntervalInBackground).toBe(false)

    qc.clear()
  })
})

describe('useObservations', () => {
  it('Q3: fetches with default limit=20 in URL', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(OBSERVATIONS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/observations/recent?limit=20')

    qc.clear()
  })

  it('Q4: fetches with explicit limit=5 in URL', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(OBSERVATIONS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations('acme', 5), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/observations/recent?limit=5')

    qc.clear()
  })

  it('Q5: queryKey includes id AND limit (distinct cache slots)', () => {
    const { qc, wrapper } = makeWrapper()

    renderHook(() => useObservations('acme', 20), { wrapper })
    renderHook(() => useObservations('acme', 5), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['observations', 'acme', 20])
    expect(keys).toContainEqual(['observations', 'acme', 5])

    qc.clear()
  })

  it('Q9: when id is null, observations hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })
})

describe('useDiscipline', () => {
  it('Q6: queryKey is [discipline, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useDiscipline('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['discipline', 'acme'])

    qc.clear()
  })

  it('fetches /api/projects/acme/discipline and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(DISCIPLINE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useDiscipline('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/discipline')

    qc.clear()
  })

  it('Q9: when id is null, discipline hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useDiscipline(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('usePhaseProgress', () => {
  it('Q7: queryKey is [phase-progress, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => usePhaseProgress('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['phase-progress', 'acme'])

    qc.clear()
  })

  it('fetches /api/projects/acme/phase-progress and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(PHASE_PROGRESS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => usePhaseProgress('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/phase-progress')

    qc.clear()
  })

  it('Q9: when id is null, phase-progress hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => usePhaseProgress(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('useSecurity', () => {
  it('Q8: queryKey is [security, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSecurity('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['security', 'acme'])

    qc.clear()
  })

  it('fetches /api/projects/acme/security and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(SECURITY_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecurity('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/security')

    qc.clear()
  })

  it('Q9: when id is null, security hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecurity(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('cross-project cache isolation (Q11)', () => {
  it('useCommitment("acme") and useCommitment("beta") produce distinct cache entries', async () => {
    const acmeBody = { markdown: 'acme commitment', sourceFile: 'acme.md' }
    const betaBody = { markdown: 'beta commitment', sourceFile: 'beta.md' }

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/acme/')) {
        return Promise.resolve(makeSuccessResponse(acmeBody))
      }
      if (url.includes('/beta/')) {
        return Promise.resolve(makeSuccessResponse(betaBody))
      }
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useCommitment('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useCommitment('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['commitment', 'acme'])
    const betaCacheData = qc.getQueryData(['commitment', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    // Critically: they are different objects (no leakage)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })
})

// ── Fixtures for new Phase 5 hooks ────────────────────────────────────────────

const GLOBAL_SKILLS_BODY = {
  scope: 'global',
  skills: [
    { name: 'meta-observer', dir: '/home/.claude/skills/meta-observer', scope: 'global', description: 'Observes sessions' },
    { name: 'careful', dir: '/home/.claude/skills/careful', scope: 'global', description: 'Careful skill' },
  ],
}

const LOCAL_SKILLS_BODY = {
  scope: 'local',
  skills: [
    { name: 'project-skill', dir: '/project/.claude/skills/project-skill', scope: 'local', description: 'Local project skill' },
  ],
}

const AGENTLINTER_OK_BODY = {
  kind: 'ok',
  report: {
    score: 87,
    categories: [],
    diagnostics: [
      { severity: 'warning', category: 'description', rule: 'missing-description', file: 'meta-observer/SKILL.md', message: 'Description too short' },
    ],
    files: ['meta-observer/SKILL.md'],
    timestamp: '2026-05-07T12:00:00.000Z',
  },
  cachedAt: '2026-05-07T12:00:00.000Z',
}

// ── useGlobalSkills ────────────────────────────────────────────────────────────

describe('useGlobalSkills', () => {
  it('S1: fetches /api/skills/global and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(GLOBAL_SKILLS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useGlobalSkills(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(GLOBAL_SKILLS_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/skills/global')

    qc.clear()
  })

  it('S2: queryKey is [skills, global] (no projectId)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useGlobalSkills(), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['skills', 'global'])

    qc.clear()
  })

  it('S3: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useGlobalSkills(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('S4: staleTime is 60000 and refetchInterval is 60000', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useGlobalSkills(), { wrapper })

    const cache = qc.getQueryCache()
    const queries = cache.getAll()
    const q = queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['skills', 'global']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(60_000)
    expect(opts?.refetchInterval).toBe(60_000)
    expect(opts?.refetchIntervalInBackground).toBe(false)

    qc.clear()
  })
})

// ── useLocalSkills ─────────────────────────────────────────────────────────────

describe('useLocalSkills', () => {
  it('S5: fetches /api/projects/acme/skills/local and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(LOCAL_SKILLS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useLocalSkills('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(LOCAL_SKILLS_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/skills/local')

    qc.clear()
  })

  it('S6: cross-project cache isolation — useLocalSkills("acme") and useLocalSkills("beta") produce distinct entries', async () => {
    const acmeBody = { scope: 'local', skills: [{ name: 'skill-a', dir: '/acme/.claude/skills/skill-a', scope: 'local', description: 'A' }] }
    const betaBody = { scope: 'local', skills: [{ name: 'skill-b', dir: '/beta/.claude/skills/skill-b', scope: 'local', description: 'B' }] }

    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('/acme/')) return Promise.resolve(makeSuccessResponse(acmeBody))
      if ((url as string).includes('/beta/')) return Promise.resolve(makeSuccessResponse(betaBody))
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useLocalSkills('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useLocalSkills('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['skills', 'local', 'acme'])
    const betaCacheData = qc.getQueryData(['skills', 'local', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })

  it('S7: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useLocalSkills('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('S8: when id is null, hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useLocalSkills(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })
})

// ── useAgentLinter ─────────────────────────────────────────────────────────────

describe('useAgentLinter', () => {
  it('S9: fetches /api/projects/acme/agentlinter and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinter('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(AGENTLINTER_OK_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/agentlinter')

    qc.clear()
  })

  it('S10: cross-project cache isolation — useAgentLinter("acme") and useAgentLinter("beta") produce distinct entries', async () => {
    const acmeBody = { kind: 'not-installed' }
    const betaBody = { kind: 'timeout' }

    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('/acme/')) return Promise.resolve(makeSuccessResponse(acmeBody))
      if ((url as string).includes('/beta/')) return Promise.resolve(makeSuccessResponse(betaBody))
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useAgentLinter('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useAgentLinter('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['agentlinter', 'acme'])
    const betaCacheData = qc.getQueryData(['agentlinter', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })

  it('S11: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinter('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('S12: when id is null, hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinter(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('S13: staleTime is 3_600_000 (1h), no refetchInterval set', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useAgentLinter('acme'), { wrapper })

    const cache = qc.getQueryCache()
    const queries = cache.getAll()
    const q = queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['agentlinter', 'acme']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(3_600_000)
    // useAgentLinter must NOT have a refetchInterval — manual retry only
    expect(opts?.refetchInterval).toBeUndefined()
    expect(opts?.refetchIntervalInBackground).toBe(false)

    qc.clear()
  })
})

// ── Fixtures for Plan 05 health hooks ────────────────────────────────────────

const OBSERVABILITY_BODY = {
  sentry: {
    detected: true,
    signals: [
      { signal: 'sentry-sdk-dep', evidence: '@sentry/node@10.52.0' },
      { signal: 'sentryclirc', evidence: '.sentryclirc' },
    ],
  },
  spotlight: {
    detected: false,
    signals: [],
  },
  sentryCli: {
    detected: true,
    signals: [
      { signal: 'sentry-cli-binary', evidence: '/usr/local/bin/sentry-cli' },
    ],
  },
}

const SECRETS_VALID_BODY = {
  state: 'present-valid',
  workspaceId: 'ws-123',
  defaultEnvironment: 'prod',
}

const INTEGRATIONS_BODY = {
  sentry: 'configured',
  linear: 'not-detected',
  infisical: 'present-but-not-configured',
}

// ── useObservability ──────────────────────────────────────────────────────────

describe('useObservability', () => {
  it('O1: fetches /api/projects/acme/observability and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(OBSERVABILITY_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservability('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(OBSERVABILITY_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/observability')

    qc.clear()
  })

  it('O2: cross-project cache isolation — useObservability("acme") and useObservability("beta") produce distinct entries', async () => {
    const acmeBody = { sentry: { detected: true, signals: [{ signal: 'sentry-sdk-dep', evidence: '@sentry/node' }] }, spotlight: { detected: false, signals: [] }, sentryCli: { detected: false, signals: [] } }
    const betaBody = { sentry: { detected: false, signals: [] }, spotlight: { detected: true, signals: [{ signal: 'spotlight-dep', evidence: '@spotlightjs/core' }] }, sentryCli: { detected: false, signals: [] } }

    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('/acme/')) return Promise.resolve(makeSuccessResponse(acmeBody))
      if ((url as string).includes('/beta/')) return Promise.resolve(makeSuccessResponse(betaBody))
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useObservability('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useObservability('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['observability', 'acme'])
    const betaCacheData = qc.getQueryData(['observability', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })

  it('O3: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservability('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })
})

// ── useSecrets ────────────────────────────────────────────────────────────────

describe('useSecrets', () => {
  it('SC1: fetches /api/projects/acme/secrets and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(SECRETS_VALID_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecrets('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(SECRETS_VALID_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/secrets')

    qc.clear()
  })

  it('SC2: cross-project cache isolation — useSecrets("acme") and useSecrets("beta") produce distinct entries', async () => {
    const acmeBody = { state: 'present-valid', workspaceId: 'ws-acme' }
    const betaBody = { state: 'absent' }

    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('/acme/')) return Promise.resolve(makeSuccessResponse(acmeBody))
      if ((url as string).includes('/beta/')) return Promise.resolve(makeSuccessResponse(betaBody))
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useSecrets('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useSecrets('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['secrets', 'acme'])
    const betaCacheData = qc.getQueryData(['secrets', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })

  it('SC3: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecrets('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })
})

// ── useIntegrations ───────────────────────────────────────────────────────────

describe('useIntegrations', () => {
  it('I1: fetches /api/projects/acme/integrations and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(INTEGRATIONS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useIntegrations('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(INTEGRATIONS_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/integrations')

    qc.clear()
  })

  it('I2: cross-project cache isolation — useIntegrations("acme") and useIntegrations("beta") produce distinct entries', async () => {
    const acmeBody = { sentry: 'configured', linear: 'not-detected', infisical: 'not-detected' }
    const betaBody = { sentry: 'not-detected', linear: 'configured', infisical: 'present-but-not-configured' }

    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('/acme/')) return Promise.resolve(makeSuccessResponse(acmeBody))
      if ((url as string).includes('/beta/')) return Promise.resolve(makeSuccessResponse(betaBody))
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useIntegrations('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useIntegrations('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['integrations', 'acme'])
    const betaCacheData = qc.getQueryData(['integrations', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })

  it('I3: on schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useIntegrations('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })
})
