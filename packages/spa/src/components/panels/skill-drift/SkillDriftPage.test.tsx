/**
 * SkillDriftPage.test.tsx — TDD tests for the top-level Skill drift page.
 *
 * Plan 11-05 Task 3 Step A.
 *
 * Page composition (PD-11-03 single-source-of-truth scope):
 * - useSkillDriftScopeFromUrl() is the single read of URL scope
 * - scope passes to BOTH useSkillDrift({ scope }) AND <SkillDriftMatrix scope={...} />
 * - Loading / error / empty / happy states each render distinct UI
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import React from 'react'
import {
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
} from '@tanstack/react-router'
import type { SkillDriftResponse } from '@agenticapps/dashboard-shared'

// Hoisted mocks for the query + mutation hooks.
const useSkillDrift = vi.fn()
const useAgentLinterDrift = vi.fn(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
}))

vi.mock('../../../lib/skillDriftQueries.js', () => ({
  useSkillDrift: (...args: unknown[]) => useSkillDrift(...args),
  useAgentLinterDrift: () => useAgentLinterDrift(),
}))

import { SkillDriftPage } from './SkillDriftPage.js'

// ── Harness ───────────────────────────────────────────────────────────────────

async function renderWithRouter(initialUrl = '/observability/skill-drift') {
  const rootRoute = createRootRoute()
  const skillDriftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/observability/skill-drift',
    component: SkillDriftPage,
  })
  const routeTree = rootRoute.addChildren([skillDriftRoute])
  const router = createRouter({ routeTree })
  const utils = render(<RouterProvider router={router} />)
  await act(async () => {
    await router.navigate({ to: initialUrl as '/observability/skill-drift' })
  })
  return { router, ...utils }
}

afterEach(() => {
  cleanup()
  useSkillDrift.mockReset()
})

// ── Fixture ──────────────────────────────────────────────────────────────────

const fixtureData: SkillDriftResponse = {
  schemaVersion: 1,
  generatedAtIso: '2026-05-16T12:00:00.000Z',
  projects: [
    { projectId: 'p1', projectName: 'agenticapps-dashboard', family: 'agenticapps' },
  ],
  rows: [
    {
      skillId: 'agenticapps-workflow',
      byProject: {
        p1: { present: true, version: '1.2.3', lastModifiedIso: '2026-05-16T10:00:00.000Z' },
      },
    },
  ],
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SkillDriftPage', () => {
  it('SDP1: loading state — useSkillDrift returning isPending renders the loading message', async () => {
    useSkillDrift.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderWithRouter()
    expect(screen.getByText(/loading skill drift/i)).toBeDefined()
  })

  it('SDP2: error state — useSkillDrift returning isError renders an error state', async () => {
    useSkillDrift.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    })
    await renderWithRouter()
    expect(screen.getByText(/failed to load skill drift/i)).toBeDefined()
  })

  it('SDP3: empty state — data.rows = [] renders the SkillDriftMatrix "No skills detected" empty state', async () => {
    useSkillDrift.mockReturnValue({
      data: { ...fixtureData, rows: [] },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderWithRouter()
    expect(screen.getByText(/no skills detected/i)).toBeDefined()
  })

  it('SDP4: happy path — renders PageHeader "Skill drift" + Toolbar + Matrix', async () => {
    useSkillDrift.mockReturnValue({
      data: fixtureData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderWithRouter()
    // PageHeader title
    expect(screen.getByRole('heading', { name: /skill drift/i })).toBeDefined()
    // Toolbar chips
    expect(screen.getByRole('button', { name: /per family/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cross family/i })).toBeDefined()
    // Matrix renders a row
    expect(screen.getByText('agenticapps-workflow')).toBeDefined()
  })

  it('SDP5: page reads scope from URL via useSkillDriftScopeFromUrl + passes it to useSkillDrift({ scope }) (PD-11-03)', async () => {
    useSkillDrift.mockReturnValue({
      data: fixtureData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderWithRouter('/observability/skill-drift?scope=cross')
    expect(useSkillDrift).toHaveBeenCalled()
    const lastCall = useSkillDrift.mock.calls.at(-1)
    expect(lastCall).toBeDefined()
    expect((lastCall as unknown[])[0]).toEqual({ scope: 'cross' })
    // And the cross-family chip is the active selection
    expect(screen.getByRole('button', { name: /cross family/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('SDP6: default URL (no ?scope) → page calls useSkillDrift({ scope: "family" }) (default per PD-11-03)', async () => {
    useSkillDrift.mockReturnValue({
      data: fixtureData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    await renderWithRouter('/observability/skill-drift')
    const lastCall = useSkillDrift.mock.calls.at(-1)
    expect(lastCall).toBeDefined()
    expect((lastCall as unknown[])[0]).toEqual({ scope: 'family' })
  })
})
