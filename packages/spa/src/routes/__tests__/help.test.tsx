/**
 * help.test.tsx — TDD tests for the /help route (D-6.1-01 line-length cap).
 *
 * Tests assert:
 * - Placeholder body paragraph carries max-w-[75ch]
 * - Keyboard-shortcut description <td> cells carry max-w-[75ch]
 * - KbdHint-bearing <td> cells do NOT carry max-w-[75ch]
 * - h2 headings do NOT carry max-w-[75ch]
 */
import { describe, it, expect } from 'vitest'
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

/** Minimal router fixture that mounts the /help lazy route. */
async function makeRouter() {
  const { Route } = await import('../help.lazy.js')
  const MaybeComponent = Route.options.component
  if (!MaybeComponent) throw new Error('Route component not set')
  const RouteComponent = MaybeComponent

  const rootRoute = createRootRoute({ component: Outlet })
  const helpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/help',
    component: RouteComponent,
  })

  const routeTree = rootRoute.addChildren([helpRoute])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/help'] })
  return createRouter({ routeTree, history: memoryHistory })
}

describe('D-6.1-01 line-length cap on /help', () => {
  it('caps the placeholder body paragraph at 75ch', async () => {
    const router = await makeRouter()
    const { container } = render(React.createElement(RouterProvider, { router }))
    // Wait for any h2 heading to be visible (use findAll since there are two h2s)
    await screen.findAllByRole('heading', { level: 2 })
    // The placeholder body paragraph is the first <p> in the first section
    const p = container.querySelector('section p')
    expect(p).not.toBeNull()
    expect(p?.className.includes('max-w-[75ch]')).toBe(true)
  })

  it('caps each shortcut-description <td> at 75ch', async () => {
    const router = await makeRouter()
    const { container } = render(React.createElement(RouterProvider, { router }))
    await screen.findAllByRole('heading', { level: 2 })
    // Description cells are the text-only <td> cells (not those containing KbdHint elements).
    // KbdHint renders <span aria-hidden="true"> (not raw <kbd>), so detect via that.
    const descriptionCells = Array.from(container.querySelectorAll('td')).filter(
      (td) =>
        !td.querySelector('span[aria-hidden="true"]') &&
        td.textContent &&
        td.textContent.trim().length > 0,
    )
    expect(descriptionCells.length).toBeGreaterThan(0)
    descriptionCells.forEach((td) => {
      expect(td.className.includes('max-w-[75ch]')).toBe(true)
    })
  })

  it('does NOT cap the kbd <td> cells', async () => {
    const router = await makeRouter()
    const { container } = render(React.createElement(RouterProvider, { router }))
    await screen.findAllByRole('heading', { level: 2 })
    // KbdHint-bearing cells contain <span aria-hidden="true"> (KbdHint primitive output)
    const kbdCells = Array.from(container.querySelectorAll('td')).filter(
      (td) => td.querySelector('span[aria-hidden="true"]') !== null,
    )
    expect(kbdCells.length).toBeGreaterThan(0)
    kbdCells.forEach((td) => {
      expect(td.className.includes('max-w-[75ch]')).toBe(false)
    })
  })

  it('does NOT cap any h2 heading', async () => {
    const router = await makeRouter()
    render(React.createElement(RouterProvider, { router }))
    const h2s = await screen.findAllByRole('heading', { level: 2 })
    h2s.forEach((h) => expect(h.className.includes('max-w-[75ch]')).toBe(false))
  })
})
