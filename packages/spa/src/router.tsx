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

import { AppShell } from './components/AppShell.js'
import { AppShellV2 } from './components/AppShellV2.js'
import { getPairing } from './lib/pairing.js'
import { MalformedPairUrl, RouteError } from './routes/pair-error.js'

/**
 * Feature flag — STRICT equality (RESEARCH Pitfall 4: 'false' is truthy).
 * Read once at module scope before route construction.
 * Production CI builds without this flag → legacy tree ships.
 */
const useV2 = import.meta.env.VITE_APPSHELL_V2 === '1'

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

// ── Legacy route tree (declared at module scope so TypeScript infers register types) ──

const legacyRootRoute = createRootRoute({ component: AppShell })

const legacyIndexRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/',
  beforeLoad: () => {
    const pairing = getPairing()
    if (!pairing) { throw redirect({ to: '/onboarding' }) }
  },
}).lazy(() => import('./routes/index.lazy.js').then((m) => m.Route))

const legacyOnboardingRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/onboarding',
}).lazy(() => import('./routes/onboarding.lazy.js').then((m) => m.Route))

const legacyPairRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/pair',
  validateSearch: zodValidator(PairSearchSchema),
  errorComponent: pairErrorComponent,
}).lazy(() => import('./routes/pair.lazy.js').then((m) => m.Route))

const legacySettingsRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/settings',
}).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

const legacyHelpRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/help',
}).lazy(() => import('./routes/help.lazy.js').then((m) => m.Route))

const legacyProjectsIdRoute = createRoute({
  getParentRoute: () => legacyRootRoute,
  path: '/projects/$projectId',
}).lazy(() => import('./routes/projects.$projectId.lazy.js').then((m) => m.Route))

const legacyRouteTree = legacyRootRoute.addChildren([
  legacyIndexRoute,
  legacyOnboardingRoute,
  legacyPairRoute,
  legacySettingsRoute,
  legacyHelpRoute,
  legacyProjectsIdRoute,
] as AnyRoute[])

/**
 * Typed reference used ONLY for the `Register` interface below.
 * This is always the legacy router so TypeScript knows all route paths.
 */
const legacyRouter = createRouter({ routeTree: legacyRouteTree })

// ── Runtime router: conditionally builds the active variant ──────────────────
// Two separate rootRoute instances so addChildren calls never collide.
// The legacyRootRoute/legacyRouter above provide TypeScript types.
// The actual runtime router is built here based on the flag.

let router: typeof legacyRouter

if (useV2) {
  // ── V2 tree: pathless layout wraps the 4 paired routes (RESEARCH Pattern 3) ──
  const v2RootRoute = createRootRoute({ component: () => <Outlet /> })

  /**
   * Pathless layout route — id='_appshell' is the TanStack Router code-based
   * pattern for layout routes without a path segment (verified v1.169).
   * /onboarding and /pair stay at v2RootRoute → NO shell (D-5.1-03).
   */
  const appShellLayoutRoute = createRoute({
    getParentRoute: () => v2RootRoute,
    id: '_appshell',
    component: AppShellV2,
  })

  const indexRouteV2 = createRoute({
    getParentRoute: () => appShellLayoutRoute,
    path: '/',
    beforeLoad: () => {
      const pairing = getPairing()
      if (!pairing) { throw redirect({ to: '/onboarding' }) }
    },
  }).lazy(() => import('./routes/index.lazy.js').then((m) => m.Route))

  const settingsRouteV2 = createRoute({
    getParentRoute: () => appShellLayoutRoute,
    path: '/settings',
  }).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

  const helpRouteV2 = createRoute({
    getParentRoute: () => appShellLayoutRoute,
    path: '/help',
  }).lazy(() => import('./routes/help.lazy.js').then((m) => m.Route))

  const projectsIdRouteV2 = createRoute({
    getParentRoute: () => appShellLayoutRoute,
    path: '/projects/$projectId',
  }).lazy(() => import('./routes/projects.$projectId.lazy.js').then((m) => m.Route))

  // /onboarding and /pair stay at rootRoute in V2 mode (no shell — D-5.1-03)
  const onboardingRouteV2 = createRoute({
    getParentRoute: () => v2RootRoute,
    path: '/onboarding',
  }).lazy(() => import('./routes/onboarding.lazy.js').then((m) => m.Route))

  const pairRouteV2 = createRoute({
    getParentRoute: () => v2RootRoute,
    path: '/pair',
    validateSearch: zodValidator(PairSearchSchema),
    errorComponent: pairErrorComponent,
  }).lazy(() => import('./routes/pair.lazy.js').then((m) => m.Route))

  const v2RouteTree = v2RootRoute.addChildren([
    appShellLayoutRoute.addChildren([
      indexRouteV2,
      settingsRouteV2,
      helpRouteV2,
      projectsIdRouteV2,
    ] as AnyRoute[]),
    onboardingRouteV2,
    pairRouteV2,
  ] as AnyRoute[])

  router = createRouter({ routeTree: v2RouteTree }) as unknown as typeof legacyRouter
} else {
  router = legacyRouter
}

export { router }

/** Type registration so useNavigate / Link infer the route tree. */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof legacyRouter
  }
}
