/**
 * SkillDriftToolbar.test.tsx — TDD tests for the Skill drift toolbar.
 *
 * Plan 11-05 Task 2 Step B.
 *
 * Tests cover:
 * - Single-select scope chip: [ Per family ] [ Cross family ] (PD-11-03)
 * - Default scope 'family' (URL ?scope= absent → 'family')
 * - URL invalid scope value falls back to 'family' (defensive)
 * - useSkillDriftScopeFromUrl() helper for parent (SkillDriftPage) integration
 * - 200ms debounce on search input + URL sync (?q=)
 * - Chip click flips URL ?scope=cross|family
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React, { useState } from 'react'
import {
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
} from '@tanstack/react-router'

import {
  SkillDriftToolbar,
  useSkillDriftScopeFromUrl,
} from './SkillDriftToolbar.js'

// ── Test harness ──────────────────────────────────────────────────────────────

/**
 * Build a minimal real TanStack Router tree with the toolbar mounted at '/'.
 * Optional `initialUrl` lets us seed `?scope=` etc.
 */
async function renderWithRouter(
  Component: React.ComponentType,
  initialUrl = '/',
) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    // TanStack's RouteComponent expects (props: { [...]: ... }) → JSX shape; our
    // local harness components are React.ComponentType — cast via unknown is
    // fine for the test harness (no public API surface).
    component: Component as unknown as () => React.JSX.Element,
  })
  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({ routeTree })
  const utils = render(<RouterProvider router={router} />)
  await act(async () => {
    await router.navigate({ to: initialUrl as '/' })
  })
  return { router, ...utils }
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── Controlled wrapper that mirrors how SkillDriftPage uses the toolbar ──────

function HarnessPage(): React.JSX.Element {
  const scope = useSkillDriftScopeFromUrl()
  const [search, setSearch] = useState('')
  return (
    <div>
      <SkillDriftToolbar
        scope={scope}
        search={search}
        onSearchChange={setSearch}
      />
      <div data-testid="resolved-scope">{scope}</div>
    </div>
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SkillDriftToolbar', () => {
  it('SDT1: renders two scope chips: "Per family" and "Cross family"', async () => {
    await renderWithRouter(HarnessPage)
    expect(screen.getByRole('button', { name: /per family/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cross family/i })).toBeDefined()
  })

  it('SDT2: default scope is "family" (no URL param)', async () => {
    await renderWithRouter(HarnessPage)
    expect(screen.getByTestId('resolved-scope').textContent).toBe('family')
    expect(screen.getByRole('button', { name: /per family/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /cross family/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('SDT3: clicking "Cross family" updates URL to ?scope=cross and selects it (deselects "Per family")', async () => {
    const { router } = await renderWithRouter(HarnessPage)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cross family/i }))
    })
    // URL synced
    expect(router.state.location.search).toMatchObject({ scope: 'cross' })
    // Resolved scope re-derived from URL
    expect(screen.getByTestId('resolved-scope').textContent).toBe('cross')
    // Single-select aria
    expect(screen.getByRole('button', { name: /cross family/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /per family/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('SDT4: clicking "Per family" while at ?scope=cross removes/clears the scope param', async () => {
    const { router } = await renderWithRouter(HarnessPage, '/?scope=cross')
    expect(screen.getByTestId('resolved-scope').textContent).toBe('cross')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /per family/i }))
    })

    // Either scope is unset (no param) OR scope: 'family' — both are
    // valid "default" representations. We accept either.
    const s = router.state.location.search as { scope?: string }
    expect(s.scope === undefined || s.scope === 'family').toBe(true)
    expect(screen.getByTestId('resolved-scope').textContent).toBe('family')
  })

  it('SDT5: renders a free-text search input', async () => {
    await renderWithRouter(HarnessPage)
    expect(screen.getByRole('searchbox')).toBeDefined()
  })

  it('SDT6: typing in search input debounces 200ms before calling onSearchChange', async () => {
    const onSearchChange = vi.fn()

    function DebouncePage() {
      const scope = useSkillDriftScopeFromUrl()
      return (
        <SkillDriftToolbar
          scope={scope}
          search=""
          onSearchChange={onSearchChange}
        />
      )
    }

    vi.useFakeTimers()
    await renderWithRouter(DebouncePage)

    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'workflow' } })
    expect(onSearchChange).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onSearchChange).toHaveBeenCalledWith('workflow')
    vi.useRealTimers()
  })

  it('SDT7: URL ?scope=cross at mount → useSkillDriftScopeFromUrl returns "cross"', async () => {
    await renderWithRouter(HarnessPage, '/?scope=cross')
    expect(screen.getByTestId('resolved-scope').textContent).toBe('cross')
  })

  it('SDT8: URL without ?scope → useSkillDriftScopeFromUrl returns "family" (default per PD-11-03)', async () => {
    await renderWithRouter(HarnessPage, '/')
    expect(screen.getByTestId('resolved-scope').textContent).toBe('family')
  })

  it('SDT9: URL ?scope=invalid → useSkillDriftScopeFromUrl falls back to "family"', async () => {
    await renderWithRouter(HarnessPage, '/?scope=bogus')
    expect(screen.getByTestId('resolved-scope').textContent).toBe('family')
  })
})
