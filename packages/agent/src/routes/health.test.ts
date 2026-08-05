import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

describe('GET /health', () => {
  let cleanup: () => void
  let token: string
  let authFile: string
  let registryFile: string

  beforeEach(() => {
    vi.clearAllMocks()
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    registryFile = join(tmp.configDir, 'registry.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
  })

  afterEach(() => cleanup())

  it('returns a valid response without the retired GitNexus extension', async () => {
    const app = createApp({ authFile, registryFile })
    const response = await app.request('http://127.0.0.1/health', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(HealthResponseSchema.safeParse(body).success).toBe(true)
    expect(body).not.toHaveProperty('gitnexus')
  })

  it('requires bearer authentication', async () => {
    const app = createApp({ authFile, registryFile })
    const response = await app.request('http://127.0.0.1/health')
    expect(response.status).toBe(401)
  })

  /**
   * The viewer-version assertions this file used to carry went with the
   * `understand` block in `retire-v1-surfaces`; `cli/viewerRetired.test.ts` now
   * asserts its absence. This one stays and is not about the viewer: /health is
   * unauthenticated-adjacent enough that leaking any token material through it
   * would matter whatever the payload contains.
   */
  it('never exposes viewer or bearer token material', async () => {
    const app = createApp({ authFile, registryFile })

    const response = await app.request('http://127.0.0.1/health', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const serialized = await response.text()

    expect(response.status).toBe(200)
    expect(serialized).not.toContain('"viewerToken"')
    expect(serialized).not.toContain('"token"')
    expect(serialized).not.toContain(token)
  })
})
