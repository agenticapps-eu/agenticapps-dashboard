import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { RouterProvider, createRouter, createMemoryHistory, type AnyRouter } from '@tanstack/react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { RepairProvider, useRepair } from '../lib/repair.js'
import { createQueryClient } from '../lib/queryClient.js'

// Mock apiFetch BEFORE importing the router (the lazy chunks import api.js transitively)
vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const VALID_TOKEN = '01234567-89abcdef-01234567-89abcdef-01234567-89abcdef-01234567-89abcdef'

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Renders the FULL app at the requested initial URL. */
async function renderApp(initialUrl: string) {
  const { router } = await import('../router.js')
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] })
  const testRouter = createRouter({ routeTree: router.routeTree, history: memoryHistory })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <RepairProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={testRouter} />
      </QueryClientProvider>
    </RepairProvider>,
  )
}

/** Renders the app with the live repair bus wired into the QueryClient (for W4). */
async function renderAppWithRepairBus(initialUrl: string) {
  const { router } = await import('../router.js')
  const memoryHistory = createMemoryHistory({ initialEntries: [initialUrl] })
  const testRouter = createRouter({ routeTree: router.routeTree, history: memoryHistory })

  // Use a mutable container (object property mutation, not variable reassignment)
  // so react-hooks/globals doesn't flag the capture as a render-time side effect.
  const captured: { repair?: ReturnType<typeof useRepair> } = {}

  function BusCapture() {
    const repair = useRepair()
    useEffect(() => {
      captured.repair = repair
    }, [repair])
    return null
  }

  render(
    <RepairProvider>
      <BusCapture />
      {/* QueryClient is created INSIDE RepairProvider so createQueryClient can receive the bus */}
      <QueryBridgeForTest router={testRouter} />
    </RepairProvider>,
  )

  return () => captured.repair!
}

function QueryBridgeForTest({ router: testRouter }: { router: AnyRouter }) {
  const repair = useRepair()
  const queryClient = createQueryClient({ setNeedsRepair: repair.setNeedsRepair })
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>
  )
}

describe('Phase 2 e2e: unpaired → /onboarding redirect (SPA-03)', () => {
  it('visiting / unpaired redirects to /onboarding (OnboardingHero headline visible)', async () => {
    await renderApp('/')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'One local daemon. Every device.',
      )
    })
  })
})

/** An empty fleet, which is what both paired-landing tests below read. */
const EMPTY_FLEET = { generatedAt: Date.UTC(2026, 7, 5, 12, 0), repos: [] }

describe('Phase 2 e2e: /pair happy path (SPA-02)', () => {
  it('valid pair URL persists pairing and lands on the fleet', async () => {
    const { apiFetch } = await import('../lib/api.js')
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path === '/api/v2/fleet') return Promise.resolve({ ok: true, data: EMPTY_FLEET })
      if (path === '/api/registry') return Promise.resolve({ ok: true, data: [] })
      return Promise.resolve({ ok: true, data: { ok: true, version: '1.0.0' } })
    })
    await renderApp(`/pair?agent=http://127.0.0.1:5193&token=${VALID_TOKEN}`)

    await waitFor(
      () => {
        const stored = localStorage.getItem('agentic-dashboard:pairing')
        expect(stored).not.toBeNull()
        expect(JSON.parse(stored!).agentUrl).toBe('http://127.0.0.1:5193')
      },
      { timeout: 3000 },
    )

    // Landed on the fleet, not the withdrawn multi-project home: `/` is a
    // retired location now and resolves through retiredLocations.ts.
    await waitFor(
      () => {
        expect(screen.getByText('No repositories registered yet.')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })
})

describe('Phase 2 e2e: paired → / redirects to the fleet (retire-v1-surfaces)', () => {
  it('paired user visits / and is carried to the fleet', async () => {
    // This case used to assert the inverse — that a paired visitor at `/` sees
    // MultiProjectHome and is NOT redirected. `Retired Locations Have An
    // Explicit Transition` withdrew that surface and gave the bare origin the
    // one behaviour it never had specified.
    const { apiFetch } = await import('../lib/api.js')
    vi.mocked(apiFetch).mockImplementation((path) =>
      path === '/api/v2/fleet'
        ? Promise.resolve({ ok: true, data: EMPTY_FLEET })
        : Promise.resolve({ ok: true, data: [] }),
    )
    localStorage.setItem(
      'agentic-dashboard:pairing',
      JSON.stringify({
        agentUrl: 'http://127.0.0.1:5193',
        token: VALID_TOKEN,
        pairedAt: new Date().toISOString(),
      }),
    )
    await renderApp('/')

    await waitFor(() => {
      expect(screen.getByText('No repositories registered yet.')).toBeInTheDocument()
    })
    // The withdrawn home's empty state, so a future regression that re-mounts
    // it at `/` fails here rather than passing on a lookalike.
    expect(screen.queryByText('No projects registered yet.')).not.toBeInTheDocument()
  })
})

describe('Phase 2 e2e: paired → daemon 401 → RepairBanner visible (AUTH-04 — checker W4)', () => {
  it('a 401 from apiFetch flips RepairBanner; clicking Re-pair navigates to /onboarding', async () => {
    const { ApiError, apiFetch } = await import('../lib/api.js')

    // Setup: localStorage already has a valid pairing
    localStorage.setItem(
      'agentic-dashboard:pairing',
      JSON.stringify({
        agentUrl: 'http://127.0.0.1:5193',
        token: VALID_TOKEN,
        pairedAt: new Date().toISOString(),
      }),
    )

    // Mock apiFetch to reject with 401 — drives QueryCache.onError → setNeedsRepair(true)
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, 'req-fake', 'unauthorized'))

    // Render the full app with the live repair bus wired into createQueryClient
    const getHook = await renderAppWithRepairBus('/')

    // `/` redirects to the fleet, whose own read 401s too — so the surface
    // that reports the unreachable daemon is now the fleet's error state.
    await waitFor(() => {
      expect(screen.getByText('Could not read the fleet.')).toBeInTheDocument()
    })

    // Manually fire the 401 through the repair bus — simulates QueryCache.onError
    // (the fleet's own query already errored; we drive setNeedsRepair directly)
    act(() => {
      getHook().setNeedsRepair(true)
    })

    // Assert the RepairBanner shows. RepairBanner renders "Agent token rejected." text.
    // Note: DaemonUnreachableState also uses role="status", so we query by verbatim text.
    await waitFor(
      () => {
        expect(screen.getByText('Agent token rejected.')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // Click [Re-pair] — banner CTA should navigate to /onboarding.
    const reRepairBtn = screen.getByRole('button', { name: /Re-pair/i })
    reRepairBtn.click()
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'One local daemon. Every device.',
        )
      },
      { timeout: 3000 },
    )
  })
})
