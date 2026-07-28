import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardResponseSchema } from '@agenticapps/dashboard-shared'

import { PROD_ORIGIN } from '../constants.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { createApp } from '../server/app.js'

import { boardRoute } from './board.js'

describe('GET /api/v2/board', () => {
  let authFile: string
  let cleanup: () => void
  let registryFile: string
  let token: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    registryFile = join(tmp.configDir, 'registry.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)

    const projectRoot = join(tmp.homeDir, 'dashboard')
    mkdirSync(projectRoot)
    writeFileSync(
      registryFile,
      JSON.stringify({
        version: 1,
        projects: [
          {
            id: 'dashboard',
            name: 'Dashboard',
            root: projectRoot,
            client: null,
            addedAt: '2026-07-28T00:00:00.000Z',
            tags: [],
          },
        ],
      }),
    )
  })

  afterEach(() => cleanup())

  function request(init: RequestInit = {}) {
    return createApp({ authFile, registryFile }).request(
      'http://127.0.0.1:5193/api/v2/board',
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      },
    )
  }

  it('returns a schema-valid four-host synthetic fixture through the declared route', async () => {
    expect(boardRoute).toBeDefined()

    const response = await request()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(() => BoardResponseSchema.parse(body)).not.toThrow()
    expect(body).toMatchObject({ synthetic: true })
    expect(new Set((body as { hosts: Array<{ host: string }> }).hosts.map(({ host }) => host))).toEqual(
      new Set(['claude', 'codex', 'opencode', 'pi']),
    )
  })

  it('inherits bearer authentication', async () => {
    const response = await createApp({ authFile, registryFile }).request(
      'http://127.0.0.1:5193/api/v2/board',
    )

    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('sessions')
  })

  it('inherits the existing CORS origin lock', async () => {
    const allowed = await request({ headers: { Origin: PROD_ORIGIN } })
    const disallowed = await request({ headers: { Origin: 'https://attacker.example' } })

    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PROD_ORIGIN)
    expect(disallowed.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('is available in tailscale bind mode without a separate access path', async () => {
    const response = await createApp({
      authFile,
      registryFile,
      bindMode: 'tailscale',
    }).request('http://127.0.0.1:5193/api/v2/board', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
  })

  it('logs and persists no board payload', async () => {
    const beforeRegistry = readFileSync(registryFile, 'utf8')
    const beforeFiles = readdirSync(join(registryFile, '..')).sort()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      const response = await request()
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(log.mock.calls.flat().join(' ')).not.toContain(body)
      expect(log.mock.calls.flat().join(' ')).not.toContain('Synthetic Claude session')
      expect(readFileSync(registryFile, 'utf8')).toBe(beforeRegistry)
      expect(readdirSync(join(registryFile, '..')).sort()).toEqual(beforeFiles)
    } finally {
      log.mockRestore()
    }
  })

  it('returns schema_drift without records when outbound validation fails', async () => {
    const parse = vi.spyOn(BoardResponseSchema, 'parse').mockImplementation(() => {
      throw new Error('simulated board schema drift')
    })

    try {
      const response = await request()
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toMatchObject({ ok: false, error: 'schema_drift' })
      expect(JSON.stringify(body)).not.toContain('sessions')
      expect(JSON.stringify(body)).not.toContain('tasks')
    } finally {
      parse.mockRestore()
    }
  })

  it('adds no mutating board route', async () => {
    const response = await request({ method: 'POST' })

    expect(response.status).toBe(404)
  })
})
