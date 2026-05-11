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
 * Children of _helpLayout (mounted at `/help`) use TanStack-canonical relative
 * paths. The parent's `path: '/help'` contributes the `/help` URL prefix, so:
 *
 *   - index entry → `path: '/'` (true INDEX node — outranks wildcard siblings)
 *   - anchor / stub / redirect entries → relative path with the `/help/` prefix
 *     stripped (e.g. `/help/workflow/overview` → `workflow/overview`)
 *   - catch-all → `path: '$'` (matches anything under `/help/`)
 *
 * Why the prefix-stripping fix (Rule 1): with the prior pathless `_helpLayout`
 * and every child carrying an absolute `/help/...` path, the catch-all route
 * `/help/$` ended up one segment deeper than the static index `/help` in
 * TanStack's route tree. `isFrameMoreSpecific` (v1.169) prefers deeper frames
 * when statics/dynamics/index-ness are otherwise equal, so the wildcard
 * silently outranked the index — `/help` resolved to the catch-all and
 * rendered an empty `<Outlet/>` while flooding the dev console with
 * `Generated path … did not match the same route after params.stringify`.
 * Mounting the layout at `/help` and giving the index `path: '/'` makes it
 * a true INDEX node, which TanStack always prefers over a sibling wildcard.
 */
const HELP_PREFIX = '/help/'
function relPath(absPath: string): string {
  if (absPath === '/help') return '/'
  if (absPath.startsWith(HELP_PREFIX)) return absPath.slice(HELP_PREFIX.length)
  return absPath
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
        path: relPath(anchorEntry.path),
      }).lazy(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        anchorEntry.lazyImport().then((m: { Route: unknown }) => m.Route as any),
      ) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'stub') {
      const stubEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: relPath(stubEntry.path),
        component: () => <ComingSoonRoute section={stubEntry.section} title={stubEntry.title} />,
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'redirect') {
      const redirectEntry = entry
      const r = createRoute({
        getParentRoute: () => parent,
        path: relPath(redirectEntry.from),
        beforeLoad: () => {
          throw redirect({ to: redirectEntry.to })
        },
      }) as unknown as AnyRoute
      routes.push(r)
    } else if (entry.kind === 'catchAll') {
      const catchEntry = entry
      // path: '$' under parent /help → matches anything under /help/ but does
      // NOT match `/help` exactly (the INDEX child handles that).
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
