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
import { resolveRetiredLocation } from './lib/retiredLocations.js'
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
 * FleetSearchSchema validates the optional /fleet?family=&status=&q= params.
 * Comma-joined, like /coverage's. Unknown values inside a list are dropped by
 * `parseFleetFilters` rather than rejected here: a hand-edited URL should
 * narrow to something sensible instead of blanking the page.
 */
const FleetSearchSchema = z.object({
  family: z.string().optional(),
  status: z.string().optional(),
  // Coerced, because the router's default search parser JSON-parses values
  // before this sees them: `/fleet?q=2024` arrives as the number 2024, a bare
  // `z.string()` rejects it, and the route's error component then tells the
  // reader their pair URL looks wrong — on the fleet page, over a search term.
  // Searching for a year is not a malformed URL.
  q: z.coerce.string().optional(),
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

/**
 * A retired location is not a page any more — it is an address that still has
 * to answer. `retiredLocations.ts` owns every destination; this only asks it,
 * keyed on the pathname the visitor actually typed, so the router never holds
 * a second copy of the mapping that could drift from the first.
 *
 * `resolveRetiredLocation` returning `null` cannot happen for a path mounted
 * here — the route paths and the manifest are the same six locations. If they
 * ever stop being, falling through is the honest answer: the route has no
 * component, so the visitor reaches not-found rather than a plausible guess,
 * which is what the requirement asks for an address the product never served.
 */
function retiredRoute(path: string) {
  return createRoute({
    getParentRoute: () => appShellLayoutRoute,
    path,
    beforeLoad: ({ location }: { location: { pathname: string } }) => {
      const to = resolveRetiredLocation(location.pathname)
      if (to !== null) { throw redirect({ to, replace: true }) }
    },
  })
}

/**
 * The origin owes the unpaired case first. A visitor with no daemon paired is
 * sent to /onboarding as before; only a paired one is carried on to the fleet,
 * because the fleet cannot load without a daemon to read.
 */
const indexRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/',
  beforeLoad: ({ location }) => {
    const pairing = getPairing()
    if (!pairing) { throw redirect({ to: '/onboarding' }) }
    const to = resolveRetiredLocation(location.pathname)
    if (to !== null) { throw redirect({ to, replace: true }) }
  },
})

const settingsRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/settings',
}).lazy(() => import('./routes/settings.lazy.js').then((m) => m.Route))

/**
 * `/projects/:id` and nothing beneath it. `$projectId` matches a single
 * segment, so `/projects/:id/anything` — an address the product never served —
 * misses every route and reaches not-found, which is what the requirement
 * asks. A wildcard here would redirect it somewhere plausible instead.
 */
const projectsIdRoute = retiredRoute('/projects/$projectId')

const coverageRoute = retiredRoute('/coverage')
const observabilitySkillDriftRoute = retiredRoute('/observability/skill-drift')
const conformanceRoute = retiredRoute('/observability/conformance')
const codeIntelligenceRoute = retiredRoute('/code-intelligence')

const workflowRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/workflow',
}).lazy(() => import('./routes/workflow.lazy.js').then((m) => m.Route))

/**
 * fleetRoute — /fleet, the readiness fleet (add-repo-readiness §9).
 *
 * Mounted alongside the v1 routes rather than at `/`, which still belongs to
 * MultiProjectHome. `retire-v1-surfaces` owns repointing the legacy routes at
 * the fleet, and it does that in one commit so the cutover reverts as one.
 */
const fleetRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/fleet',
  validateSearch: zodValidator(FleetSearchSchema),
  errorComponent: pairErrorComponent,
}).lazy(() => import('./routes/fleet.lazy.js').then((m) => m.Route))

/**
 * changesRoute — /changes, the fleet OpenSpec change board
 * (add-agent-change-board §5).
 *
 * The drawer's address is three separate search parameters — `repo`, `source`
 * and `change` — never one composite. A single parameter would need a
 * separator, a separator needs a parser, and a parser over author-controlled
 * change names is exactly the shape that produced
 * `fix-readiness-sanitiser-colon-hazard`. Separate parameters need no parsing
 * at all, so the failure mode does not exist rather than being guarded.
 *
 * All three are optional and unvalidated beyond being strings: a deep link
 * naming a change that no longer exists renders the board with a not-found
 * statement, which is a better answer than blanking the page.
 */
const ChangeSearchSchema = z.object({
  repo: z.coerce.string().optional(),
  source: z.coerce.string().optional(),
  change: z.coerce.string().optional(),
})

const changesRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/changes',
  validateSearch: zodValidator(ChangeSearchSchema),
  errorComponent: pairErrorComponent,
}).lazy(() => import('./routes/changes.lazy.js').then((m) => m.Route))

/**
 * repoDetailRoute — /repos/$repoId, where a fleet row or cell lands. A cell
 * carries the check id as the hash, so the detail can position itself at the
 * block that was selected.
 *
 * An unregistered identifier is answered by the daemon as a 404 from the
 * registry alone, so nothing here needs to validate the id: it is never joined
 * to a path on either side.
 */
const repoDetailRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/repos/$repoId',
}).lazy(() => import('./routes/repos.$repoId.lazy.js').then((m) => m.Route))

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
    // The six retired v1 locations stay mounted so they can answer. They
    // resolve through retiredLocations.ts and render nothing — removing them
    // would turn a specified redirect into a not-found.
    indexRoute,
    projectsIdRoute,
    coverageRoute,
    observabilitySkillDriftRoute,
    conformanceRoute,
    codeIntelligenceRoute,
    settingsRoute,
    workflowRoute,
    fleetRoute, // add-repo-readiness §9 — /fleet under _appshell
    repoDetailRoute, // add-repo-readiness §9/§10 — /repos/$repoId under _appshell
    changesRoute, // add-agent-change-board §5 — /changes under _appshell
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
