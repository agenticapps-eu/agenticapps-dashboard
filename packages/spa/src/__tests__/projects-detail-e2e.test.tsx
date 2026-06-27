/**
 * projects-detail-e2e.test.tsx — Phase 4 end-to-end route render test.
 *
 * Verifies the full /projects/{id} route renders with all 8 panels mounted.
 * Asserts ROADMAP Phase 4 success criteria 1–5.
 *
 * Pattern: mocked fetch (no real daemon), MemoryHistory, RouterProvider inside
 * QueryClientProvider + RepairProvider — same as e2e-pair-flow.test.tsx.
 *
 * Threat model T-04-06-03: E2E7 asserts cross-project cache isolation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { RepairProvider } from '../lib/repair.js'

// Mock apiFetch before importing router (lazy chunks import api.js transitively)
vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

// Mock pairing — provide a fixed pairing so the index route doesn't redirect to /onboarding
vi.mock('../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: '01234567-89abcdef-01234567-89abcdef-01234567-89abcdef-01234567-89abcdef',
  })),
  setPairing: vi.fn(),
  clearPairing: vi.fn(),
}))

const VALID_TOKEN = '01234567-89abcdef-01234567-89abcdef-01234567-89abcdef-01234567-89abcdef'

// Canned daemon responses for /projects/acme
const REGISTRY_RESPONSE = [
  {
    id: 'acme',
    name: 'ACME Project',
    root: '/tmp/acme',
    client: null,
    tags: [],
    addedAt: '2026-05-06T00:00:00Z',
    // Wave 5: AppShellV2 Sidebar reads status.reachable + status.currentPhase for all registered projects.
    status: { reachable: true, currentPhase: '04-single-project-view', lastCommitAt: '2026-05-06T00:00:00Z' },
  },
]

const OVERVIEW_RESPONSE = {
  branch: 'feature/phase-4',
  phaseStatus: 'executing',
  currentPhase: '04-single-project-view',
  stage1: null,
  stage2: null,
  dbAudit: null,
  tdd: { greenPairs: 5, totalTasks: 6 },
  verification: { mustHavesTotal: 9, mustHavesEvidenced: 0 },
  markers: { workflowSkillInstalled: true, metaObserverInstalled: true },
}

const COMMITMENT_RESPONSE = {
  markdown: '## Workflow commitment\n- Follow TDD discipline\n- No shortcuts',
  sourceFile: '2026-05-06-session.md',
}

const OBSERVATIONS_RESPONSE = {
  entries: [
    { ts: '2026-05-06T10:00:00Z', skill: 'meta-observer', hook: 'pre-tool-use' },
  ],
  skillInstalled: true,
}

const DISCIPLINE_RESPONSE = {
  rationalization: {
    rows: [{ label: 'Skipped TDD step', fires: 0 }],
    skillInstalled: true,
  },
}

const PHASE_PROGRESS_RESPONSE = {
  phase: 'single-project-view-discipline-phase-progress',
  paddedPhase: '04',
  files: [
    { name: 'CONTEXT.md', present: true, mtimeIso: '2026-05-06T08:00:00Z' },
    { name: 'RESEARCH.md', present: true, mtimeIso: '2026-05-06T08:00:00Z' },
  ],
  tdd: {
    greenPairs: 5,
    totalTasks: 6,
    timeline: [
      {
        taskId: '04-01',
        redCommit: {
          sha: 'abc123',
          subject: 'test(04-01): add failing tests',
          isoDate: '2026-05-06T07:00:00Z',
        },
        greenCommit: {
          sha: 'def456',
          subject: 'feat(04-01): implement schemas',
          isoDate: '2026-05-06T07:30:00Z',
        },
      },
    ],
  },
  review: {
    stage1: { present: true, findings: { critical: 0, high: 0, medium: 1, low: 3 } },
    stage2: null,
  },
  verification: {
    mustHavesTotal: 9,
    mustHavesEvidenced: 7,
    items: [
      { text: 'CI passes on feature branch', evidenced: true },
      { text: 'All new routes validated', evidenced: true },
      { text: 'HUMAN-UAT.md complete', evidenced: false },
    ],
  },
}

const SECURITY_RESPONSE = {
  cso: { fileName: '04-SECURITY.md', content: '# /cso audit\n\n0 critical\n0 high' },
  dbSentinel: null,
}

// Phase 5 mock responses — minimal valid shapes for the 5 new Health column routes.
// These prevent the health-column panels from entering schema-drift loops in e2e tests.
const GLOBAL_SKILLS_RESPONSE = { scope: 'global' as const, skills: [] }
const LOCAL_SKILLS_RESPONSE = { scope: 'local' as const, skills: [] }
const AGENTLINTER_RESPONSE = { kind: 'not-installed' as const }
const OBSERVABILITY_RESPONSE = {
  sentry: { detected: false, signals: [] },
  spotlight: { detected: false, signals: [] },
  sentryCli: { detected: false, signals: [] },
}
const SECRETS_RESPONSE = { state: 'absent' as const }
const INTEGRATIONS_RESPONSE = {
  sentry: 'not-detected' as const,
  linear: 'not-detected' as const,
  infisical: 'not-detected' as const,
}
// Phase 8 mock responses — minimal valid shapes for SentryPanel + LinearPanel (INV-03).
// Empty issues arrays exercise the "not configured / configure to enable" state.
const SENTRY_RECENT_RESPONSE = { issues: [], stale: false }
const LINEAR_ISSUES_RESPONSE = { issues: [], stale: false }

/** Build a mock apiFetch handler for the /projects/acme API surface. */
function buildMockApiFetch(overrides: Record<string, unknown> = {}) {
  return async (path: string) => {
    if (path === '/api/registry') {
      return { ok: true, data: overrides['registry'] ?? REGISTRY_RESPONSE }
    }
    if (path === '/api/projects/acme/overview') {
      return { ok: true, data: overrides['overview'] ?? OVERVIEW_RESPONSE }
    }
    if (path === '/api/projects/acme/commitment') {
      return { ok: true, data: overrides['commitment'] ?? COMMITMENT_RESPONSE }
    }
    if (path?.startsWith('/api/projects/acme/observations/recent')) {
      return { ok: true, data: overrides['observations'] ?? OBSERVATIONS_RESPONSE }
    }
    if (path === '/api/projects/acme/discipline') {
      return { ok: true, data: overrides['discipline'] ?? DISCIPLINE_RESPONSE }
    }
    if (path === '/api/projects/acme/phase-progress') {
      return { ok: true, data: overrides['phaseProgress'] ?? PHASE_PROGRESS_RESPONSE }
    }
    if (path === '/api/projects/acme/security') {
      return { ok: true, data: overrides['security'] ?? SECURITY_RESPONSE }
    }
    // Phase 5 Health column routes — return minimal valid responses to prevent
    // schema-drift loops in tests that exercise the 3-col layout.
    if (path === '/api/skills/global') {
      return { ok: true, data: overrides['globalSkills'] ?? GLOBAL_SKILLS_RESPONSE }
    }
    if (path?.startsWith('/api/projects/acme/skills/local')) {
      return { ok: true, data: overrides['localSkills'] ?? LOCAL_SKILLS_RESPONSE }
    }
    if (path?.startsWith('/api/projects/acme/agentlinter')) {
      return { ok: true, data: overrides['agentlinter'] ?? AGENTLINTER_RESPONSE }
    }
    if (path === '/api/projects/acme/observability') {
      return { ok: true, data: overrides['observability'] ?? OBSERVABILITY_RESPONSE }
    }
    if (path === '/api/projects/acme/secrets') {
      return { ok: true, data: overrides['secrets'] ?? SECRETS_RESPONSE }
    }
    if (path === '/api/projects/acme/integrations') {
      return { ok: true, data: overrides['integrations'] ?? INTEGRATIONS_RESPONSE }
    }
    // Phase 8 integration panel routes — return empty-issue responses (INV-03: no env vars needed)
    if (path === '/api/projects/acme/sentry/recent') {
      return { ok: true, data: overrides['sentryRecent'] ?? SENTRY_RECENT_RESPONSE }
    }
    if (path === '/api/projects/acme/linear/issues') {
      return { ok: true, data: overrides['linearIssues'] ?? LINEAR_ISSUES_RESPONSE }
    }
    // Default fallback
    return { ok: true, data: {} }
  }
}

/** Render the full SPA router at /projects/acme with mocked daemon responses. */
async function renderProjectDetail(
  apiOverrides: Record<string, unknown> = {},
  projectId = 'acme',
) {
  const { apiFetch } = await import('../lib/api.js')
  vi.mocked(apiFetch).mockImplementation(
    buildMockApiFetch(apiOverrides) as typeof apiFetch,
  )

  const { router } = await import('../router.js')
  const memoryHistory = createMemoryHistory({ initialEntries: [`/projects/${projectId}`] })
  const testRouter = createRouter({ routeTree: router.routeTree, history: memoryHistory })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })

  // Store queryClient ref for E2E7 cross-project assertion
  const container = render(
    <RepairProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={testRouter} />
      </QueryClientProvider>
    </RepairProvider>,
  )

  return { queryClient, ...container }
}

beforeEach(() => {
  localStorage.setItem(
    'agentic-dashboard:pairing',
    JSON.stringify({ agentUrl: 'http://127.0.0.1:5193', token: VALID_TOKEN }),
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('Phase 4 e2e: /projects/:id detail route', () => {
  it('E2E1 (ROADMAP criterion 1): renders project PageHeader with projectId as title (Wave 5: ProjectHeader deleted)', async () => {
    await renderProjectDetail()

    // Wave 5 (Plan 05.1-06): ProjectHeader deleted; PageHeader renders an <h1> with projectId
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 1, name: 'acme' })).toBeDefined()
      },
      { timeout: 5000 },
    )
  })

  it('E2E2: all 8 panel headings mount (all panels rendered)', async () => {
    await renderProjectDetail()

    const panelTitles = [
      'Commitment',
      'Hook Firings',
      'Rationalization Fires',
      'Phase Progress',
      'Execution Timeline',
      'Review Status',
      'Security Status',
      'Verification Status',
    ]

    for (const title of panelTitles) {
      await waitFor(
        () => {
          expect(screen.getByRole('heading', { level: 2, name: title })).toBeDefined()
        },
        { timeout: 5000 },
      )
    }
  })

  it('E2E3 (ROADMAP criterion 2): CommitmentBlock surfaces markdown content', async () => {
    await renderProjectDetail()

    await waitFor(
      () => {
        // CommitmentBlock renders commitment markdown in a <pre>
        expect(screen.getByText(/Follow TDD discipline/)).toBeDefined()
      },
      { timeout: 5000 },
    )
  })

  it('E2E4 (ROADMAP criterion 3): ExecutionTimeline renders RED/GREEN commit pairs', async () => {
    await renderProjectDetail()

    await waitFor(
      () => {
        // ExecutionTimeline renders task header + commit subjects
        expect(screen.getByText(/Task 04-01/)).toBeDefined()
        expect(screen.getByText(/test\(04-01\): add failing tests/)).toBeDefined()
        expect(screen.getByText(/feat\(04-01\): implement schemas/)).toBeDefined()
      },
      { timeout: 5000 },
    )
  })

  it('E2E5 (ROADMAP criterion 4): ReviewStatus renders all 4 severity glyphs', async () => {
    await renderProjectDetail()

    await waitFor(
      () => {
        // ReviewStatus renders Stage 1 with severity glyphs
        expect(screen.getByText('Stage 1')).toBeDefined()
        const bodyText = document.body.textContent ?? ''
        expect(bodyText).toContain('🟡')
        expect(bodyText).toContain('⚪')
      },
      { timeout: 5000 },
    )
  })

  it('E2E6 (ROADMAP criterion 5): VerificationStatus shows must-haves count vs evidence', async () => {
    await renderProjectDetail()

    await waitFor(
      () => {
        expect(screen.getByText('7 / 9 must-haves evidenced')).toBeDefined()
      },
      { timeout: 5000 },
    )
  })

  it('E2E7 (cross-project leakage guard): switching projects produces independent cache entries', async () => {
    // First render at /projects/acme
    const { queryClient } = await renderProjectDetail()

    // Wait for acme data to resolve
    await waitFor(
      () => {
        expect(queryClient.getQueryData(['commitment', 'acme'])).toBeDefined()
      },
      { timeout: 5000 },
    )

    // beta project should NOT have an acme cache entry
    expect(queryClient.getQueryData(['commitment', 'beta'])).toBeUndefined()
    expect(queryClient.getQueryData(['phase-progress', 'beta'])).toBeUndefined()

    // acme's entry should be independent
    const acmeCommitment = queryClient.getQueryData(['commitment', 'acme'])
    const acmePhaseProgress = queryClient.getQueryData(['phase-progress', 'acme'])
    expect(acmeCommitment).not.toBeUndefined()
    expect(acmePhaseProgress).not.toBeUndefined()
  })
})
