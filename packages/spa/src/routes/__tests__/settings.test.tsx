/**
 * settings.test.tsx — TDD tests for the /settings route.
 *
 * Coverage:
 * - D-6.1-01 line-length cap on the page-level helper prose under "Settings".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'

// Stub clipboard so MaskedToken (rendered by ManualPairForm with pre-populated
// pairing) doesn't fail in tests that mount /settings without explicit setup.
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
})

/** Minimal router fixture that mounts the /settings lazy route. */
async function makeRouter() {
  const { Route } = await import('../settings.lazy.js')
  const MaybeComponent = Route.options.component
  if (!MaybeComponent) throw new Error('Route component not set')
  const RouteComponent = MaybeComponent

  const rootRoute = createRootRoute({ component: Outlet })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: RouteComponent,
  })

  const routeTree = rootRoute.addChildren([settingsRoute])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/settings'] })
  return createRouter({ routeTree, history: memoryHistory })
}

describe('D-6.1-01 line-length cap on /settings', () => {
  it('caps the page-level helper prose at 75ch', async () => {
    const router = await makeRouter()
    render(React.createElement(RouterProvider, { router }))
    // Wait for the lazy route to mount: locate the helper prose
    const helper = await screen.findByText(/Pair the daemon and configure the dashboard\./)
    const p = helper.closest('p')
    expect(p).not.toBeNull()
    expect(p?.className.includes('max-w-[75ch]')).toBe(true)
  })

  it('does NOT cap the h1 "Settings" heading', async () => {
    const router = await makeRouter()
    render(React.createElement(RouterProvider, { router }))
    const heading = await screen.findByRole('heading', { name: 'Settings', level: 1 })
    expect(heading.className.includes('max-w-[75ch]')).toBe(false)
  })
})
