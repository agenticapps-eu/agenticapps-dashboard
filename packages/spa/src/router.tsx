import type { ReactElement } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  type AnyRoute,
} from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { AgentUrlSchema, TokenSchema } from '@agenticapps/dashboard-shared'

import { AppShellV2 } from './components/AppShellV2.js'
import { HelpLayout } from './help/components/HelpLayout.js'
import { buildHelpRoutes } from './help/buildHelpRoutes.js'
import { getPairing } from './lib/pairing.js'
import { MalformedPairUrl, RouteError } from './routes/pair-error.js'

/**
 * PairSearchSchema validates the required /pair?agent=&token= search params.
 * Uses AgentUrlSchema (loopback / *.ts.net) and TokenSchema (D-13 dashed-hex).
 * Checker W1: MalformedPairUrl lives in pair-error.tsx (NOT pair.lazy.tsx) so
 * this eager import doesn't pull the entire pair.lazy chunk into the main bundle.
 */
const PairSearchSchema = z.object({
  agent: AgentUrlSchema,
  token: TokenSchema,
})

/**
 * Exported so a unit test can verify it never re-throws on a non-VALIDATE_SEARCH
 * error (WR-02). Pitfall 8: validateSearch errors arrive here with
 * `error.routerCode === 'VALIDATE_SEARCH'` and render <MalformedPairUrl/>;
 * any other error renders a visible <RouteError/> fallback instead of
 * re-throwing into React render (which, with no outer error boundary, would
 * blank the screen).
 */
export function pairErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}): ReactElement {
  if (
    error &&
    typeof error === 'object' &&
    'routerCode' in error &&
    (error as { routerCode: string }).routerCode === 'VALIDATE_SEARCH'
  ) {
    return <MalformedPairUrl />
  }
  return <RouteError error={error} reset={reset} />
}

// ── Single route tree: AppShellV2 is the only shell (Plan 05.1-06 Wave 5) ────

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

/**
 * Pathless layout route — id='_appshell' is the TanStack Router code-based
 * pattern for layout routes without a path segment (verified v1.169).
 * /onboarding and /pair stay at rootRoute → NO shell (D-5.1-03).
 */
const appShellLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_appshell',
  component: AppShellV2,
})

const indexRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/',
  beforeLoad: () => {
    const pairing = getPairing()
    if (!pairing) { throw redirect({ to: '/onboarding' }) }
  },
}).lazy(() => import('./routes/index.lazy.js').then((m) => m.Route))

const settingsRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/settings',
}).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

const projectsIdRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/projects/$projectId',
}).lazy(() => import('./routes/projects.$projectId.lazy.js').then((m) => m.Route))

/**
 * _helpLayout — peer of _appshell at rootRoute (D-7-12). `/help/*` bypasses
 * AppShellV2 so the docs site owns its own chrome (sidebar + main).
 *
 * Originally registered as a pathless layout (id-only), but that forced every
 * child to repeat the `/help` prefix in its `path` AND made the catch-all
 * `path: '/help/$'` outrank the static `path: '/help'` index entry in
 * TanStack's depth-based tie-breaker — the wildcard `$` lives one segment
 * deeper than the index, and `isFrameMoreSpecific` prefers deeper frames when
 * statics/dynamics/index-ness are otherwise equal, so `/help` resolved to the
 * empty catch-all route and rendered an empty `<Outlet/>`. Rule 1 fix:
 * mount the layout AT `/help` so children can use the canonical TanStack
 * shape (`path: '/'` for the index, relative paths for anchors/stubs,
 * `path: '$'` for the catch-all). The URL surface is unchanged.
 *
 * Children are generated from helpRouteTable via buildHelpRoutes (Plan 07-05).
 */
const helpLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: HelpLayout,
})

// /onboarding and /pair stay at rootRoute (no shell — D-5.1-03)
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
}).lazy(() => import('./routes/onboarding.lazy.js').then((m) => m.Route))

const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pair',
  validateSearch: zodValidator(PairSearchSchema),
  errorComponent: pairErrorComponent,
}).lazy(() => import('./routes/pair.lazy.js').then((m) => m.Route))

const routeTree = rootRoute.addChildren([
  appShellLayoutRoute.addChildren([
    indexRoute,
    settingsRoute,
    projectsIdRoute,
  ] as AnyRoute[]),
  // _helpLayout is a PEER of _appshell (D-7-12) — /help/* bypasses AppShellV2.
  helpLayoutRoute.addChildren(buildHelpRoutes(helpLayoutRoute as unknown as AnyRoute) as AnyRoute[]),
  onboardingRoute,
  pairRoute,
] as AnyRoute[])

export const router = createRouter({ routeTree })

/** Type registration so useNavigate / Link infer the route tree. */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
