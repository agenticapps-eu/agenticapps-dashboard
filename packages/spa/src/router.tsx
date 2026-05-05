import type { ReactElement } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type AnyRoute,
} from '@tanstack/react-router'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { AgentUrlSchema, TokenSchema } from '@agenticapps/dashboard-shared'

import { AppShell } from './components/AppShell.js'
import { getPairing } from './lib/pairing.js'
import { MalformedPairUrl, RouteError } from './routes/pair-error.js'

/** Root route renders the persistent AppShell. */
const rootRoute = createRootRoute({
  component: AppShell,
})

/**
 * SPA-03: visiting `/` without a pairing redirects to `/onboarding`.
 * beforeLoad runs synchronously before the lazy component is even fetched.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    const pairing = getPairing()
    if (!pairing) {
      throw redirect({ to: '/onboarding' })
    }
  },
}).lazy(() => import('./routes/index.lazy.js').then((m) => m.Route))

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
}).lazy(() => import('./routes/onboarding.lazy.js').then((m) => m.Route))

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

const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pair',
  validateSearch: zodValidator(PairSearchSchema),
  errorComponent: pairErrorComponent,
}).lazy(() => import('./routes/pair.lazy.js').then((m) => m.Route))

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
}).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
}).lazy(() => import('./routes/help.lazy.js').then((m) => m.Route))

/**
 * D-37 (Phase 3): Placeholder route for /projects/$projectId.
 * Phase 3 ships the route stub so card click-through resolves cleanly.
 * Phase 4 replaces the body with Discipline + Phase columns.
 */
const projectsIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
}).lazy(() => import('./routes/projects.$projectId.lazy.js').then((m) => m.Route))

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  pairRoute,
  settingsRoute,
  helpRoute,
  projectsIdRoute,
] as AnyRoute[])

export const router = createRouter({ routeTree })

/** Type registration so useNavigate / Link infer the route tree. */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
