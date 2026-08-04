/**
 * changes.test.ts — the contract of `GET /api/v2/changes/fleet`.
 *
 * The route is thin, so this asserts what a route is responsible for: identity,
 * status code, outbound validation, and that the middleware chain it inherits
 * actually refuses an unauthenticated caller. Everything about what the board
 * *is* belongs to the service and is tested there.
 */
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChangesFleetResponseSchema } from '@agenticapps/dashboard-shared'

vi.mock('../lib/changes/service.js', () => ({ readChangesFleet: vi.fn() }))

import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { readChangesFleet } from '../lib/changes/service.js'
import { createApp } from '../server/app.js'

const GENERATED_AT = 1_760_000_000_000

const card = {
  id: 'p1\u0000active\u0000add-thing',
  repositoryId: 'p1',
  repositoryName: 'one',
  source: 'active' as const,
  sourceInstance: 'add-thing',
  changeName: 'add-thing',
  title: 'add-thing',
  stage: 'execute' as const,
  ready: false,
  artifacts: {
    proposal: 'ready' as const,
    deltaSpecCount: 1,
    tasks: 'ready' as const,
    design: 'optional' as const,
  },
  reviewerVendors: ['gemini', 'codex'],
  hasRequestChanges: false,
  reviewRecord: 'REVIEWS.md',
  checklist: [{ text: 'a', completed: false }],
  completedChecklist: 0,
  totalChecklist: 1,
  archiveDate: null,
  updatedAt: GENERATED_AT,
  evidenceLimited: false,
}

const ok = {
  generatedAt: GENERATED_AT,
  cards: [card],
  repositories: [{ id: 'p1', name: 'one', read: 'ok' as const, reason: null }],
  notices: [],
}

let cleanup: () => void
let token: string
let authFile: string

beforeEach(() => {
  vi.clearAllMocks()
  const tmp = makeTmpHome()
  cleanup = tmp.cleanup
  authFile = join(tmp.configDir, 'auth.json')
  token = ensureAuthFile(authFile).token
  setActiveToken(token)
  vi.mocked(readChangesFleet).mockResolvedValue(ok as never)
})

afterEach(() => cleanup())

const auth = () => ({ Authorization: `Bearer ${token}` })
const url = 'http://127.0.0.1/api/v2/changes/fleet'

describe('GET /api/v2/changes/fleet', () => {
  it('answers 200 with the strict fleet shape', async () => {
    const response = await createApp({ authFile }).request(url, { headers: auth() })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(ChangesFleetResponseSchema.safeParse(body).success).toBe(true)
    expect(body).toMatchObject({ generatedAt: GENERATED_AT })
  })

  it('carries the degraded reading through to the client', async () => {
    vi.mocked(readChangesFleet).mockResolvedValue({
      generatedAt: GENERATED_AT,
      cards: [],
      repositories: [
        { id: 'p1', name: 'one', read: 'ok', reason: null },
        { id: 'p2', name: 'two', read: 'failed', reason: 'unreachable' },
      ],
      notices: [
        {
          repositoryId: 'p1',
          repositoryName: 'one',
          source: 'archive',
          kind: 'truncated',
          admitted: 128,
          observed: 200,
        },
      ],
    } as never)

    const response = await createApp({ authFile }).request(url, { headers: auth() })
    expect(response.status).toBe(200)

    // Parsed rather than cast: the assertions below are only meaningful if the
    // degraded body satisfies the contract in the first place.
    const body = ChangesFleetResponseSchema.parse(await response.json())
    expect(body.repositories[1]).toMatchObject({ read: 'failed', reason: 'unreachable' })
    expect(body.notices[0]).toMatchObject({ kind: 'truncated', admitted: 128, observed: 200 })
  })

  // `auth-and-pairing` → "Bearer Token On Every Route": no anonymous access to
  // any route. Asserted here rather than assumed, and the service must not even
  // be reached.
  it('refuses an unauthenticated request', async () => {
    const response = await createApp({ authFile }).request(url)

    expect(response.status).toBe(401)
    expect(readChangesFleet).not.toHaveBeenCalled()
  })

  it('refuses a cookie in place of a bearer token', async () => {
    const response = await createApp({ authFile }).request(url, {
      headers: { Cookie: `token=${token}` },
    })

    expect(response.status).toBe(401)
    expect(readChangesFleet).not.toHaveBeenCalled()
  })

  it('refuses a wrong bearer token', async () => {
    const response = await createApp({ authFile }).request(url, {
      headers: { Authorization: 'Bearer not-the-token' },
    })

    expect(response.status).toBe(401)
    expect(readChangesFleet).not.toHaveBeenCalled()
  })

  // The read routes carry no explicit Origin check, matching the v2 readiness
  // reads: CORS binds browsers, not curl, so the token is the boundary.
  it('serves a token-bearing read from an origin outside the allow-list', async () => {
    const response = await createApp({ authFile }).request(url, {
      headers: { ...auth(), Origin: 'https://evil.example' },
    })

    expect(response.status).toBe(200)
  })

  it('fails loudly rather than serving a body that does not match the contract', async () => {
    // A producer emitting `ship` is wrong about this board. The outbound parse
    // is what stops an unknown stage reaching a column.
    vi.mocked(readChangesFleet).mockResolvedValue({
      ...ok,
      cards: [{ ...card, stage: 'ship' }],
    } as never)

    const response = await createApp({ authFile }).request(url, { headers: auth() })
    expect(response.status).toBe(500)
  })

  it('is a read-only route: POST is not routed', async () => {
    const response = await createApp({ authFile }).request(url, {
      method: 'POST',
      headers: auth(),
    })

    expect(response.status).toBe(404)
  })
})
