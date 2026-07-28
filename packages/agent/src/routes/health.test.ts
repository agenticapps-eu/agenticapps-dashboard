import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

vi.mock('../lib/viewerInstall.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/viewerInstall.js')>()
  return {
    compareSemver: actual.compareSemver,
    getInstalledViewerVersion: vi.fn(),
    getInstalledViewerPath: vi.fn(),
    getNewestPluginCacheVersion: vi.fn(),
  }
})

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import {
  getInstalledViewerVersion,
  getNewestPluginCacheVersion,
} from '../lib/viewerInstall.js'

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
    vi.mocked(getInstalledViewerVersion).mockReturnValue(null)
    vi.mocked(getNewestPluginCacheVersion).mockReturnValue(null)
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

  it('still reports Understand viewer versions and update availability', async () => {
    vi.mocked(getInstalledViewerVersion).mockReturnValue('2.7.5')
    vi.mocked(getNewestPluginCacheVersion).mockReturnValue('2.7.6')
    const app = createApp({ authFile, registryFile })

    const response = await app.request('http://127.0.0.1/health', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await response.json()) as {
      understand: {
        viewerInstalled: boolean
        viewerVersion: string | null
        pluginVersion: string | null
        updateAvailable: boolean
      }
    }

    expect(body.understand).toEqual({
      viewerInstalled: true,
      viewerVersion: '2.7.5',
      pluginVersion: '2.7.6',
      updateAvailable: true,
    })
  })

  it('requires bearer authentication', async () => {
    const app = createApp({ authFile, registryFile })
    const response = await app.request('http://127.0.0.1/health')
    expect(response.status).toBe(401)
  })

  it('never exposes viewer or bearer token material', async () => {
    vi.mocked(getInstalledViewerVersion).mockReturnValue('2.7.6')
    vi.mocked(getNewestPluginCacheVersion).mockReturnValue('2.7.6')
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
