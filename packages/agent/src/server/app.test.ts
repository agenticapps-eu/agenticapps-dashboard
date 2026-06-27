import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from './app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('createApp - bindMode plumbing (13-01)', () => {
  let cleanup: () => void
  let registryFile: string
  let authFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it("createApp({bindMode:'tailscale'}) exposes bindMode via c.get on every request", async () => {
    const app = createApp({ registryFile, authFile, bindMode: 'tailscale' })
    const token = getActiveToken()

    // Add a test route that returns the bindMode from context
    app.get('/_test_bindmode', (c) => {
      return c.json({ bindMode: c.get('bindMode') })
    })

    const res = await app.request('http://127.0.0.1:5193/_test_bindmode', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { bindMode: string }
    expect(body.bindMode).toBe('tailscale')
  })

  it("createApp({bindMode:'loopback'}) exposes bindMode as loopback", async () => {
    const app = createApp({ registryFile, authFile, bindMode: 'loopback' })
    const token = getActiveToken()

    app.get('/_test_bindmode', (c) => {
      return c.json({ bindMode: c.get('bindMode') })
    })

    const res = await app.request('http://127.0.0.1:5193/_test_bindmode', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { bindMode: string }
    expect(body.bindMode).toBe('loopback')
  })

  it("createApp() defaults bindMode to 'loopback' when not specified", async () => {
    const app = createApp({ registryFile, authFile })
    const token = getActiveToken()

    app.get('/_test_bindmode', (c) => {
      return c.json({ bindMode: c.get('bindMode') })
    })

    const res = await app.request('http://127.0.0.1:5193/_test_bindmode', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { bindMode: string }
    expect(body.bindMode).toBe('loopback')
  })
})
