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

const helpRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/help',
}).lazy(() => import('./routes/help.lazy.js').then((m) => m.Route))

const projectsIdRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/projects/$projectId',
}).lazy(() => import('./routes/projects.$projectId.lazy.js').then((m) => m.Route))

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
    helpRoute,
    projectsIdRoute,
  ] as AnyRoute[]),
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
