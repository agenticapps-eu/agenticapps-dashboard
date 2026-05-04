/**
 * projects.$projectId.test.tsx — TDD tests for the /projects/$projectId placeholder route.
 *
 * Tests:
 * 1. Heading "Three-column view" is present
 * 2. "← Back to all projects" link points to /
 * 3. document.title is set to "<id> — AgenticApps Dashboard"
 */
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'

afterEach(cleanup)

/** Minimal router fixture that registers the /projects/$projectId route. */
async function makeRouter(projectId: string) {
  // Import the component directly from the lazy file (not through Route.options which is typed as | undefined)
  const { Route } = await import('./projects.$projectId.lazy.js')
  // createLazyRoute sets component; assert it here for type safety
  const Component = Route.options.component
  if (!Component) throw new Error('Route component not set')

  const rootRoute = createRootRoute({ component: Outlet })

  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId',
    component: Component,
  })

  const routeTree = rootRoute.addChildren([projectRoute])
  const memoryHistory = createMemoryHistory({
    initialEntries: [`/projects/${projectId}`],
  })

  return createRouter({ routeTree, history: memoryHistory })
}

describe('ProjectIdPlaceholder route (/projects/$projectId)', () => {
  it('renders "Three-column view" heading', async () => {
    const router = await makeRouter('test-proj-123')
    render(React.createElement(RouterProvider, { router }))
    await screen.findByText('Three-column view')
    expect(screen.getByRole('heading', { name: 'Three-column view' })).toBeDefined()
  })

  it('renders "← Back to all projects" link pointing to /', async () => {
    const router = await makeRouter('test-proj-123')
    render(React.createElement(RouterProvider, { router }))
    const link = await screen.findByText('← Back to all projects')
    expect(link.closest('a')).toBeDefined()
    const href = link.closest('a')?.getAttribute('href')
    expect(href).toBe('/')
  })

  it('sets document.title to "<projectId> — AgenticApps Dashboard"', async () => {
    const router = await makeRouter('my-cool-project')
    render(React.createElement(RouterProvider, { router }))
    await screen.findByText('Three-column view')
    expect(document.title).toBe('my-cool-project — AgenticApps Dashboard')
  })
})
