import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /api/admin/shutdown', () => {
  let cleanup: () => void
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('returns 204 with valid bearer token (server.close called via SIGTERM mock)', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()

    // Mock process.kill to prevent actual SIGTERM from shutting down the test runner
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((_pid, _signal) => true)

    try {
      const res = await app.request('http://127.0.0.1:5193/api/admin/shutdown', {
        method: 'POST',
        headers: authHeaders(token),
      })
      expect(res.status).toBe(204)

      // Give setImmediate a tick to run
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM')
    } finally {
      killSpy.mockRestore()
    }
  })

  it('returns 401 without bearer token', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/admin/shutdown', {
      method: 'POST',
    })
    expect(res.status).toBe(401)
  })
})
