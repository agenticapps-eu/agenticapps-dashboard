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
 * Children of the pathless _helpLayout route attach with their ABSOLUTE URL
 * path. Because the parent is pathless (id-only, no URL segment), children
 * inherit no URL prefix — the path written here is matched verbatim against
 * the URL. Hence `/help` for the index, `/help/workflow/overview` for an
 * anchor, and `/help/$` for the catch-all (any path starting with `/help/`).
 *
 * Deviation from plan body: the planned `relativePath` helper (stripping the
 * /help prefix) is incompatible with the D-7-12 PEER layout pattern. With
 * the parent pathless, stripping the prefix would collide with `/_appshell/`
 * (both children would claim path '/'), and the catch-all `$` would match
 * every URL in the app, not just `/help/*`. Rule 1 (auto-fix bug).
 */
export function buildHelpRoutes(parent: AnyRoute): AnyRoute[] {
  const routes: AnyRoute[] = []

  for (const entry of helpRouteTable) {
    if (entry.kind === 'index') {
      const r = createRoute({
        getParentRoute: () => parent,
        path: '/help',
      }).lazy(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import('./pages/landing.lazy.js').then((m) => m.Route as any),
      ) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'anchor') {
      const anchorEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: anchorEntry.path,
      }).lazy(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        anchorEntry.lazyImport().then((m: { Route: unknown }) => m.Route as any),
      ) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'stub') {
      const stubEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: stubEntry.path,
        component: () => <ComingSoonRoute section={stubEntry.section} title={stubEntry.title} />,
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'redirect') {
      const redirectEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: redirectEntry.from,
        beforeLoad: () => {
          throw redirect({ to: redirectEntry.to })
        },
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'catchAll') {
      const catchEntry = entry
      // `/help/$` matches anything under /help/ (catchAll within the docs
      // namespace only — does NOT catch all routes).
      const r = createRoute({
        getParentRoute: () => parent,
        path: '/help/$',
        beforeLoad: () => {
          throw redirect({ to: catchEntry.to })
        },
      }) as unknown as AnyRoute
      routes.push(r)
    }
  }

  return routes
}
