/**
 * router.test.tsx — Tests for the single AppShellV2 route tree (Plan 05.1-06 Task 1).
 *
 * After flag removal, there is ONE route tree. Tests verify structure without any env stub.
 *
 * RT1: route tree contains the `_appshell` pathless layout with indexRoute, settingsRoute,
 *      projectsIdRoute as children. /help/* now lives under the _helpLayout peer
 *      route (Plan 07-05 D-7-12) — verified separately by RT1a.
 * RT1a: _helpLayout is a PEER of _appshell at rootRoute; /help index resolves to
 *       its index child (Plan 07-05).
 * RT2: onboardingRoute and pairRoute are direct children of rootRoute (no shell wrap — D-5.1-03)
 * RT3: no VITE_APPSHELL_V2 env stub needed — always V2, _appshell always present
 * RT4: pairErrorComponent still exported and handles VALIDATE_SEARCH error
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { isRedirect } from '@tanstack/react-router'

// Mock AppShellV2 so the router module can be dynamically imported
// without a full React/jsdom environment.
vi.mock('./components/AppShellV2.js', () => ({
  AppShellV2: function AppShellV2() { return null },
}))
vi.mock('./help/components/HelpLayout.js', () => ({
  HelpLayout: function HelpLayout() { return null },
}))
/**
 * Pairing is controllable rather than fixed: `/` owes two different answers —
 * an unpaired visitor still goes to /onboarding, a paired one now goes to the
 * fleet — and a static `null` can only exercise one of them.
 */
const pairingState = vi.hoisted(() => ({ paired: false }))
vi.mock('./lib/pairing.js', () => ({
  getPairing: () =>
    pairingState.paired ? { agentUrl: 'http://127.0.0.1:4317', token: 'stub' } : null,
}))
vi.mock('./routes/pair-error.js', () => ({
  MalformedPairUrl: function MalformedPairUrl() { return null },
  RouteError: function RouteError() { return null },
}))

describe('router — single AppShellV2 route tree', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('RT1: route tree contains _appshell pathless layout with 3 paired routes as children (help moved to _helpLayout peer in Plan 07-05)', async () => {
    const { router } = await import('./router.js')
    const ids = Object.keys(router.routesById ?? {})
    // The pathless layout route must exist (TanStack Router prefixes children with /_appshell)
    expect(ids.some((id) => id.includes('_appshell'))).toBe(true)
    // The 3 paired route paths under /_appshell (help is no longer here — moved to _helpLayout)
    expect(ids.some((id) => id === '/_appshell/')).toBe(true)
    expect(ids.some((id) => id === '/_appshell/settings')).toBe(true)
    expect(ids.some((id) => id.includes('$projectId'))).toBe(true)
    // /_appshell/help must NOT exist (legacy route removed by Plan 07-05)
    expect(ids.some((id) => id === '/_appshell/help')).toBe(false)
  })

  it('RT1a: helpLayout is a PEER of _appshell at rootRoute; /help/* bypasses AppShellV2 chrome (Plan 07-05 D-7-12)', async () => {
    const { router } = await import('./router.js')
    const ids = Object.keys(router.routesById ?? {})
    // Help layout route mounts AT `/help` (peer of _appshell, NOT a child) so
    // its index entry uses `path: '/'` and wins the TanStack tie-breaker
    // against the `/help/$` catch-all sibling (Plan 07-05 T9 fix — pathless +
    // absolute child paths caused the wildcard to silently outrank the
    // index by tree depth in v1.169's `isFrameMoreSpecific`).
    expect(ids.some((id) => id === '/help')).toBe(true)
    // Children: 1 index (`/help/`) + 5 anchor + 32 stub + 4 redirect + 1 catchAll = 43 routes.
    const helpChildren = ids.filter((id) => id.startsWith('/help'))
    expect(helpChildren.length).toBeGreaterThanOrEqual(40)
    expect(ids.some((id) => id === '/help/')).toBe(true) // index entry
    expect(ids.some((id) => id === '/help/workflow/overview')).toBe(true)
    expect(ids.some((id) => id === '/help/repos/overview')).toBe(true)
    expect(ids.some((id) => id === '/help/observability/overview')).toBe(true)
    expect(ids.some((id) => id === '/help/operations/install')).toBe(true)
    expect(ids.some((id) => id === '/help/reference/shortcuts')).toBe(true)
    // catchAll matches `/help/$` (anything under /help/, NOT /help itself).
    expect(ids.some((id) => id === '/help/$')).toBe(true)
  })

  it('RT2: onboardingRoute and pairRoute are direct children of rootRoute (no shell wrap)', async () => {
    const { router } = await import('./router.js')
    const ids = Object.keys(router.routesById ?? {})
    // Both pre-paired routes must be in the tree at root level (no /_appshell prefix)
    expect(ids.some((id) => id === '/onboarding')).toBe(true)
    expect(ids.some((id) => id === '/pair')).toBe(true)
    // rootRoute component is a bare Outlet wrapper (V2 always)
    const rootComponent = router.routesById['__root__']?.options.component
    expect(rootComponent).toBeDefined()
  })

  it('RT3: no VITE_APPSHELL_V2 env stub needed — _appshell always present', async () => {
    const { router } = await import('./router.js')
    // The router is importable without any env stub — always V2
    expect(router).toBeDefined()
    // _appshell must always be present (no flag check)
    const ids = Object.keys(router.routesById ?? {})
    expect(ids.some((id) => id.includes('_appshell'))).toBe(true)
  })

  it('RT4: pairErrorComponent is still exported and handles VALIDATE_SEARCH error', async () => {
    const { pairErrorComponent } = await import('./router.js')
    expect(typeof pairErrorComponent).toBe('function')

    // VALIDATE_SEARCH error → should return a JSX element (not throw)
    const result = pairErrorComponent({
      error: { routerCode: 'VALIDATE_SEARCH' },
      reset: () => {},
    })
    expect(result).not.toBeNull()
  })

  it('RT5: /observability/skill-drift is mounted under the _appshell layout (Phase 11 D-11-08)', async () => {
    const { router } = await import('./router.js')
    const ids = Object.keys(router.routesById ?? {})
    // Mounted as a child of _appshell (NOT a peer/separate layout) — per D-11-08
    // and REVIEWS action item 9 (no inline if-branch extension; reuse the existing
    // _appshell parent route mount pattern).
    expect(ids.some((id) => id === '/_appshell/observability/skill-drift')).toBe(true)
    // It is NOT registered at the root (would bypass AppShellV2 chrome).
    expect(ids.some((id) => id === '/observability/skill-drift')).toBe(false)
  })

  it('RT6: /workflow is mounted under the paired _appshell layout', async () => {
    const { router } = await import('./router.js')
    const ids = Object.keys(router.routesById ?? {})

    expect(ids.some((id) => id === '/_appshell/workflow')).toBe(true)
    expect(ids.some((id) => id === '/workflow')).toBe(false)
  })
})

/**
 * `Retired Locations Have An Explicit Transition` (project-dashboard).
 *
 * The manifest in lib/retiredLocations.ts already resolves these — that is
 * tested there. What is tested here is that the router asks it, because a
 * tested manifest nothing calls redirects nobody.
 *
 * `beforeLoad` is invoked directly rather than through a navigation: the
 * redirect is the entire behaviour, and driving a real history would add a
 * shell, lazy chunks and a query client to a question about one function.
 */
describe('router — retired v1 locations resolve through the manifest', () => {
  beforeEach(() => {
    pairingState.paired = true
  })

  /**
   * Runs a route's beforeLoad and returns the destination it redirected to.
   * `redirect()` in v1.169 returns `{ options: { to, replace, statusCode } }`,
   * not a flat `{ to }` — reading `.to` off the thrown value yields undefined
   * and every assertion below would pass vacuously against a bare `throw`.
   */
  async function redirectFrom(routeId: string, pathname: string): Promise<string | undefined> {
    const { router } = await import('./router.js')
    const route = router.routesById[routeId as keyof typeof router.routesById]
    const beforeLoad = route?.options.beforeLoad as
      | ((opts: { location: { pathname: string } }) => unknown)
      | undefined
    expect(beforeLoad).toBeTypeOf('function')

    try {
      await beforeLoad?.({ location: { pathname } })
    } catch (thrown) {
      expect(isRedirect(thrown)).toBe(true)
      return (thrown as { options: { to?: string } }).options.to
    }
    return undefined
  }

  it.each([
    ['/_appshell/', '/'],
    ['/_appshell/coverage', '/coverage'],
    ['/_appshell/observability/skill-drift', '/observability/skill-drift'],
    ['/_appshell/observability/conformance', '/observability/conformance'],
    ['/_appshell/code-intelligence', '/code-intelligence'],
  ])('sends %s to the fleet', async (routeId, pathname) => {
    expect(await redirectFrom(routeId, pathname)).toBe('/fleet')
  })

  it('sends /projects/:id to /repos/:id, preserving the identifier', async () => {
    expect(await redirectFrom('/_appshell/projects/$projectId', '/projects/dashboard')).toBe(
      '/repos/dashboard',
    )
  })

  it('still sends an unpaired visitor at / to onboarding, not to the fleet', async () => {
    // The origin owes the unpaired case first. A visitor with no daemon paired
    // reaches a fleet that cannot load rather than the screen that pairs them.
    pairingState.paired = false
    expect(await redirectFrom('/_appshell/', '/')).toBe('/onboarding')
  })

  it('leaves a surviving surface alone', async () => {
    const { router } = await import('./router.js')
    const fleet = router.routesById['/_appshell/fleet' as keyof typeof router.routesById]
    expect(fleet?.options.beforeLoad).toBeUndefined()
  })
})
