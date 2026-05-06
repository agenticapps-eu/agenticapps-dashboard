/**
 * projects.$projectId.test.tsx — TDD tests for the /projects/$projectId route.
 *
 * Tests R1–R3 (Phase 4 route swap from placeholder to SingleProjectView):
 * R1: route mounts ProjectLayout > SingleProjectView{projectId}
 * R2: Phase 3 placeholder text is GONE ("Three-column view", "Phase 4 work")
 * R3: back link is now part of ProjectHeader (in SingleProjectView), not top-level
 *
 * Also verifies document.title from SingleProjectView.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

afterEach(cleanup)

// Mock registry hooks used transitively by ProjectHeader
vi.mock('../lib/registry.js', () => ({
  useRegistryList: () => ({ data: undefined, isLoading: true }),
  useProjectOverview: () => ({ data: undefined, isLoading: true }),
}))

/** Minimal router fixture that registers the /projects/$projectId route. */
async function makeRouter(projectId: string) {
  const { Route } = await import('./projects.$projectId.lazy.js')
  const Component = Route.options.component
  if (!Component) throw new Error('Route component not set')

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function WrappedComponent() {
    return React.createElement(QueryClientProvider, { client: qc }, React.createElement(Component))
  }

  const rootRoute = createRootRoute({ component: Outlet })
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId',
    component: WrappedComponent,
  })

  const routeTree = rootRoute.addChildren([projectRoute])
  const memoryHistory = createMemoryHistory({
    initialEntries: [`/projects/${projectId}`],
  })

  return createRouter({ routeTree, history: memoryHistory })
}

describe('ProjectIdPage route (/projects/$projectId)', () => {
  it('R1: route renders SingleProjectView grid (data-testid="single-project-grid")', async () => {
    const router = await makeRouter('test-proj-123')
    render(React.createElement(RouterProvider, { router }))
    const grid = await screen.findByTestId('single-project-grid')
    expect(grid).toBeDefined()
  })

  it('R2: Phase 3 placeholder text "Three-column view" is gone', async () => {
    const router = await makeRouter('test-proj-123')
    render(React.createElement(RouterProvider, { router }))
    // Wait for the route to mount by finding the grid
    await screen.findByTestId('single-project-grid')
    expect(screen.queryByText('Three-column view')).toBeNull()
    expect(screen.queryByText(/Phase 4 work/)).toBeNull()
  })

  it('R3: discipline-column is rendered (ProjectHeader is part of SingleProjectView)', async () => {
    const router = await makeRouter('test-proj-123')
    render(React.createElement(RouterProvider, { router }))
    await screen.findByTestId('discipline-column')
    expect(screen.getByTestId('discipline-column')).toBeDefined()
  })

  it('sets document.title to "<projectId> — AgenticApps Dashboard"', async () => {
    const router = await makeRouter('my-cool-project')
    render(React.createElement(RouterProvider, { router }))
    await screen.findByTestId('single-project-grid')
    expect(document.title).toBe('my-cool-project — AgenticApps Dashboard')
  })
})
