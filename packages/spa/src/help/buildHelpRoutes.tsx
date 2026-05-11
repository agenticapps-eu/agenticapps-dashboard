/**
 * buildHelpRoutes — factory that converts helpRouteTable into TanStack route instances.
 *
 * Plan 07-05 Task 3. Each route entry kind maps to a different createRoute()
 * shape:
 *   - index: createRoute(path: '/') → lazy(landing)
 *   - anchor: createRoute(path) → lazy(anchor module)
 *   - stub: createRoute(path) → component renders ComingSoonRoute
 *   - redirect: createRoute(path) → beforeLoad throws redirect
 *   - catchAll: createRoute(path: '$') → beforeLoad throws redirect to /help
 *
 * Per OQ-7-B: dynamic Route union narrows poorly with code-generated routes,
 * so we cast the parent and child arrays as AnyRoute[] (matches the existing
 * router.tsx pattern at appShellLayoutRoute.addChildren).
 */
import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router'

import { ComingSoonRoute } from './ComingSoonRoute.js'
import { helpRouteTable } from './helpRouteTable.js'

/**
 * Strip the leading "/help" prefix so the route path is parented at _helpLayout.
 * The `_helpLayout` route is pathless (id-only); children attach with the
 * remainder of the URL.
 */
function relativePath(absPath: string): string {
  if (absPath === '/help') return '/'
  return absPath.replace(/^\/help/, '')
}

export function buildHelpRoutes(parent: AnyRoute): AnyRoute[] {
  const routes: AnyRoute[] = []

  for (const entry of helpRouteTable) {
    if (entry.kind === 'index') {
      const r = createRoute({
        getParentRoute: () => parent,
        path: '/',
      }).lazy(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import('./pages/landing.lazy.js').then((m) => m.Route as any),
      ) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'anchor') {
      const anchorEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: relativePath(anchorEntry.path),
      }).lazy(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        anchorEntry.lazyImport().then((m: { Route: unknown }) => m.Route as any),
      ) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'stub') {
      const stubEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: relativePath(stubEntry.path),
        component: () => <ComingSoonRoute section={stubEntry.section} title={stubEntry.title} />,
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'redirect') {
      const redirectEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: relativePath(redirectEntry.from),
        beforeLoad: () => {
          throw redirect({ to: redirectEntry.to })
        },
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'catchAll') {
      const catchEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: '$',
        beforeLoad: () => {
          throw redirect({ to: catchEntry.to })
        },
      }) as unknown as AnyRoute
      routes.push(r)
    }
  }

  return routes
}
