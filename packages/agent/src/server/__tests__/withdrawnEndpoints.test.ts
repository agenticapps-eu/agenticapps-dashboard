/**
 * withdrawnEndpoints.test.ts — the nineteen endpoints `retire-v1-surfaces`
 * withdraws, asserted absent.
 *
 * This table is the executable form of the normative table in the
 * `project-dashboard` delta ("Nineteen endpoints across eleven route modules").
 * It was re-derived against the Hono registrations in `server/app.ts` before
 * this test was written and the two agree exactly; if a future change adds a
 * route to one of the retired modules, this file is where the disagreement
 * surfaces.
 *
 * Every request carries a valid bearer token on purpose. `bearerAuth` is
 * mounted ahead of the `/api` routes, so an unauthenticated probe answers 401
 * whether or not the route exists — which would let a surviving endpoint pass
 * this test. Authenticating is what makes 404 mean "withdrawn" rather than
 * "not admitted".
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.js'
import { ensureAuthFile, setActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'

/** The nineteen, in the delta's order. */
const WITHDRAWN: ReadonlyArray<{ method: 'GET' | 'POST'; path: string; module: string }> = [
  { method: 'GET', path: '/api/coverage', module: 'coverage' },
  { method: 'GET', path: '/api/coverage/history', module: 'coverageHistory' },
  { method: 'GET', path: '/api/observability/conformance', module: 'conformance' },
  { method: 'GET', path: '/api/skills/drift', module: 'skillDrift' },
  { method: 'POST', path: '/api/skills/drift/agentlinter', module: 'skillDrift' },
  { method: 'GET', path: '/api/projects/demo/agentlinter', module: 'agentlinter' },
  { method: 'GET', path: '/api/projects/demo/sentry/recent', module: 'sentry' },
  { method: 'GET', path: '/api/projects/demo/linear/issues', module: 'linear' },
  { method: 'GET', path: '/api/projects/demo/secrets', module: 'secrets' },
  { method: 'GET', path: '/api/projects/demo/integrations', module: 'integrations' },
  { method: 'GET', path: '/api/projects/demo/observability', module: 'observability' },
  { method: 'GET', path: '/knowledge-graph.json', module: 'understandViewer' },
  { method: 'GET', path: '/meta.json', module: 'understandViewer' },
  { method: 'GET', path: '/config.json', module: 'understandViewer' },
  { method: 'GET', path: '/domain-graph.json', module: 'understandViewer' },
  { method: 'GET', path: '/diff-overlay.json', module: 'understandViewer' },
  { method: 'GET', path: '/file-content.json', module: 'understandViewer' },
  { method: 'GET', path: '/understand/agenticapps/demo', module: 'understandViewer' },
  { method: 'GET', path: '/understand/agenticapps/demo/assets/app.js', module: 'understandViewer' },
]

/** The eleven route modules the nineteen endpoints above were served from. */
const RETIRED_MODULES = [
  'coverage',
  'coverageHistory',
  'conformance',
  'skillDrift',
  'agentlinter',
  'sentry',
  'linear',
  'secrets',
  'integrations',
  'observability',
  'understandViewer',
] as const

const ROUTES_DIR = join(import.meta.dirname, '../../routes')

describe('the withdrawn daemon API surface', () => {
  let cleanup: () => void
  let token: string
  let authFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
  })

  afterEach(() => cleanup())

  it('withdraws exactly nineteen endpoints', () => {
    expect(WITHDRAWN).toHaveLength(19)
  })

  it.each(WITHDRAWN)('$method $path ($module) is not found', async ({ method, path }) => {
    const app = createApp({ authFile })
    const response = await app.request(`http://127.0.0.1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ projectId: 'demo' }) } : {}),
    })

    expect(response.status).toBe(404)
  })

  /**
   * Eight of the nineteen already answered 404 before the teardown, for reasons
   * that have nothing to do with withdrawal: the per-project routes 404 on
   * `project_not_found` because `demo` is not registered, and the viewer asset
   * path 404s because no viewer is installed. A behavioural probe alone would
   * therefore pass for those eight whether or not the route still exists. The
   * structural check below is what makes the withdrawal falsifiable per module.
   */
  it.each(RETIRED_MODULES)('the %s route module is gone from the tree', (module) => {
    expect(existsSync(join(ROUTES_DIR, `${module}.ts`))).toBe(false)
  })

  it.each(RETIRED_MODULES)('app.ts no longer mounts %s', (module) => {
    const app = readFileSync(join(import.meta.dirname, '../app.ts'), 'utf8')
    expect(app).not.toMatch(new RegExp(`routes/${module}\\.js`))
  })

  it('serves no compatibility payload in place of a withdrawn endpoint', async () => {
    const app = createApp({ authFile })
    for (const { method, path } of WITHDRAWN) {
      const response = await app.request(`http://127.0.0.1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify({ projectId: 'demo' }) } : {}),
      })
      const body = await response.text()
      // A stub would have to carry one of the withdrawn payload's own keys to be
      // useful to a v1 client; none of these may appear on a withdrawn path.
      expect(body).not.toMatch(/"rows"|"issues"|"diagnostics"|"nodes"|"signals"|"score"/)
    }
  })
})
