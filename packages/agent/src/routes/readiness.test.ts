import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FleetResponseSchema,
  RepoDetailResponseSchema,
} from '@agenticapps/dashboard-shared'

vi.mock('../lib/readiness/service.js', () => ({
  readFleet: vi.fn(),
  readRepo: vi.fn(),
  rescanRepo: vi.fn(),
}))

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { readFleet, readRepo, rescanRepo } from '../lib/readiness/service.js'
import { PROD_ORIGIN } from '../constants.js'

const GENERATED_AT = 1_760_000_000_000

function checks(withRemedy: boolean) {
  return (
    ['workflow', 'spec', 'code-review', 'security-review', 'pen-test', 'coverage'] as const
  ).map((id) => ({
    id,
    status: 'never' as const,
    source: 'derived' as const,
    at: null,
    value: null,
    threshold: null,
    summary: 'has never run',
    evidence: null,
    error: null,
    ...(withRemedy ? { remedy: `Run ${id}.` } : {}),
  }))
}

const summary = {
  id: 'a',
  name: 'a-repo',
  family: 'agenticapps' as const,
  ready: false,
  lastCommitAt: 1_759_000_000_000,
  checks: checks(false),
  notice: null,
}

const detail = { ...summary, checks: checks(true) }

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

  vi.mocked(readFleet).mockResolvedValue({
    generatedAt: GENERATED_AT,
    repos: [summary],
  } as never)
  vi.mocked(readRepo).mockResolvedValue({
    generatedAt: GENERATED_AT,
    repo: detail,
  } as never)
  vi.mocked(rescanRepo).mockResolvedValue({
    generatedAt: GENERATED_AT,
    repo: detail,
  } as never)
})

afterEach(() => cleanup())

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/v2/fleet', () => {
  it('answers the strict fleet shape', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/fleet',
      { headers: auth() },
    )

    expect(response.status).toBe(200)
    expect(FleetResponseSchema.safeParse(await response.json()).success).toBe(true)
  })

  it('refuses an unauthenticated request', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/fleet',
    )

    expect(response.status).toBe(401)
    expect(readFleet).not.toHaveBeenCalled()
  })

  it('refuses a cookie in place of a bearer token', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/fleet',
      { headers: { Cookie: `token=${token}` } },
    )

    expect(response.status).toBe(401)
    expect(readFleet).not.toHaveBeenCalled()
  })

  // The read routes carry no explicit Origin check, unlike rescan below. CORS
  // binds browsers, not curl, so a token-bearing client is served whatever it
  // claims as its origin — the token is the boundary. Asserted because the spec
  // scenario says so, and because a reader who saw only the 403 on rescan would
  // reasonably assume the reads behave the same way.
  it('serves a token-bearing read from an origin outside the allow-list', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/fleet',
      { headers: { ...auth(), Origin: 'https://evil.example' } },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe(
      'https://evil.example',
    )
    expect(readFleet).toHaveBeenCalled()
  })

  it('returns schema_drift rather than a malformed body', async () => {
    vi.mocked(readFleet).mockResolvedValueOnce({ repos: 'not-a-list' } as never)

    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/fleet',
      { headers: auth() },
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, error: 'schema_drift' })
  })
})

describe('GET /api/v2/repos/:id', () => {
  it('answers the strict detail shape', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/repos/a',
      { headers: auth() },
    )

    expect(response.status).toBe(200)
    expect(RepoDetailResponseSchema.safeParse(await response.json()).success).toBe(
      true,
    )
  })

  it('passes the requested id through unchanged', async () => {
    await createApp({ authFile }).request('http://127.0.0.1/api/v2/repos/a', {
      headers: auth(),
    })

    expect(readRepo).toHaveBeenCalledWith('a', expect.anything())
  })

  it('returns 404 for an unknown repo', async () => {
    vi.mocked(readRepo).mockResolvedValueOnce(null)

    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/repos/nobody',
      { headers: auth() },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ ok: false })
  })

  it('refuses an unauthenticated request', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/repos/a',
    )

    expect(response.status).toBe(401)
    expect(readRepo).not.toHaveBeenCalled()
  })
})

describe('POST /api/v2/repos/:id/rescan', () => {
  const post = (path: string, headers: Record<string, string>) =>
    createApp({ authFile }).request(`http://127.0.0.1${path}`, {
      method: 'POST',
      headers,
    })

  it('recomputes and answers the strict detail shape', async () => {
    const response = await post('/api/v2/repos/a/rescan', auth())

    expect(response.status).toBe(200)
    expect(rescanRepo).toHaveBeenCalledWith('a', expect.anything())
    expect(RepoDetailResponseSchema.safeParse(await response.json()).success).toBe(
      true,
    )
  })

  it('returns 404 for an unknown repo without rescanning anything else', async () => {
    vi.mocked(rescanRepo).mockResolvedValueOnce(null)

    const response = await post('/api/v2/repos/nobody/rescan', auth())

    expect(response.status).toBe(404)
  })

  it('refuses an unauthenticated request', async () => {
    const response = await post('/api/v2/repos/a/rescan', {})

    expect(response.status).toBe(401)
    expect(rescanRepo).not.toHaveBeenCalled()
  })

  it('accepts the product origin', async () => {
    const response = await post('/api/v2/repos/a/rescan', {
      ...auth(),
      Origin: PROD_ORIGIN,
    })

    expect(response.status).toBe(200)
  })

  it('refuses a disallowed origin before doing any work', async () => {
    const response = await post('/api/v2/repos/a/rescan', {
      ...auth(),
      Origin: 'https://evil.example',
    })

    expect(response.status).toBe(403)
    expect(rescanRepo).not.toHaveBeenCalled()
  })

  // The origin check binds browsers. A request with no Origin at all is not a
  // browser page, so it is not what this check exists to refuse — the bearer
  // token is its authorization boundary. Pinned because the shipped guard reads
  // `if (origin && ...)`, and a reader could just as easily infer that a missing
  // origin is refused.
  it('does not refuse a request that carries no origin', async () => {
    const response = await post('/api/v2/repos/a/rescan', auth())

    expect(response.status).toBe(200)
    expect(rescanRepo).toHaveBeenCalled()
  })

  it('is not reachable by GET', async () => {
    const response = await createApp({ authFile }).request(
      'http://127.0.0.1/api/v2/repos/a/rescan',
      { headers: auth() },
    )

    expect(response.status).toBe(404)
  })
})
