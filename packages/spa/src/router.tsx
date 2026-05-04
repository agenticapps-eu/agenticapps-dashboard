import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type AnyRoute,
} from '@tanstack/react-router'
import { AppShell } from './components/AppShell.js'
import { getPairing } from './lib/pairing.js'

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

/** /pair?agent=&token= — Plan 04 wires validateSearch + Pattern 2 errorComponent. */
const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pair',
}).lazy(() => import('./routes/pair.lazy.js').then((m) => m.Route))

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
}).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
}).lazy(() => import('./routes/help.lazy.js').then((m) => m.Route))

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  pairRoute,
  settingsRoute,
  helpRoute,
] as AnyRoute[])

export const router = createRouter({ routeTree })

/** Type registration so useNavigate / Link infer the route tree. */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
