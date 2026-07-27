/**
 * The fleet cache is keyed by registry file, so its eviction must be too.
 *
 * GET /api/registry drops superseded snapshots on a miss, because the key
 * carries the registry file's mtime and a mutation mints a new one — the old
 * entry would otherwise never be read again, and so never lazily expire. That
 * sweep is correct for the registry file being recomputed and wrong for every
 * other one: a daemon serving two registry files would have each request
 * discard the other's still-valid snapshot, and the 5s cache that route exists
 * for would never hit.
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'

import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'
import { _resetForTests } from '../../lib/phaseCache.js'
import * as registryLib from '../../lib/registry.js'
import { createApp } from '../app.js'

const ORIGIN = 'http://127.0.0.1:5193'

describe('GET /api/registry — the fleet cache is scoped to its registry file', () => {
  let cleanupHome: () => void
  let cleanupProject: () => void
  let token: string
  let registryA: string
  let registryB: string
  let listSpy: MockInstance

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    registryA = join(tmp.configDir, 'registry-a.json')
    registryB = join(tmp.configDir, 'registry-b.json')

    const fresh = ensureAuthFile(join(tmp.configDir, 'auth.json'))
    setActiveToken(fresh.token)
    token = fresh.token

    const proj = makeTmpProject()
    cleanupProject = proj.cleanup

    // Both files must exist: an absent registry stamps one shared 'absent' key.
    for (const registryFile of [registryA, registryB]) {
      await createApp({ registryFile }).request(`${ORIGIN}/api/registry/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: proj.root }),
      })
    }

    _resetForTests()
    listSpy = vi.spyOn(registryLib, 'listProjectsWithStatus')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _resetForTests()
    cleanupHome()
    cleanupProject()
  })

  it('a read against one registry file leaves the other file’s snapshot cached', async () => {
    const get = (registryFile: string) =>
      createApp({ registryFile }).request(`${ORIGIN}/api/registry`, {
        headers: { Authorization: `Bearer ${token}` },
      })

    expect((await get(registryA)).status).toBe(200)
    expect((await get(registryB)).status).toBe(200)
    expect(listSpy).toHaveBeenCalledTimes(2)

    // A has not changed since its snapshot was taken, so this must be a hit.
    expect((await get(registryA)).status).toBe(200)
    expect(listSpy).toHaveBeenCalledTimes(2)
  })
})
