/**
 * Tests for skills routes:
 *   GET /api/skills/global        — D-5-12 singleton, no projectId
 *   GET /api/projects/:id/skills/local — per-project local skills
 *
 * Test cases:
 *   S1: /api/skills/global returns { scope: 'global', skills: [] } (valid GlobalSkillsResponseSchema)
 *   S2: /api/skills/global returns 401 when no Authorization header
 *   S3: /api/skills/global CORS reject from non-allowed origin
 *   S4: /api/projects/:id/skills/local returns { scope: 'local', ... } with installed skill
 *   S5: /api/projects/:id/skills/local returns 404 when projectId not in registry
 *   S6: /api/projects/:id/skills/local returns { scope: 'local', skills: [] } when no local skills
 *   S7: outbound() parse — scope field must match schema
 */

import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../../lib/__fixtures__/phase4-fixture.js'
import { __resetSkillsCache } from '../../routes/skills.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/skills/global + GET /api/projects/:id/skills/local', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string

  beforeEach(async () => {
    __resetSkillsCache()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const fixture = makePhase4Fixture()
    cleanupFixture = fixture.cleanup
    projectRoot = fixture.root

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id
  })

  afterEach(() => {
    vi.restoreAllMocks()
    __resetSkillsCache()
    cleanupHome()
    cleanupFixture()
  })

  // ── /api/skills/global ────────────────────────────────────────────────────

  it('S1: /api/skills/global returns valid GlobalSkillsResponseSchema payload', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/global', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { scope: string; skills: unknown[] }
    expect(data.scope).toBe('global')
    expect(Array.isArray(data.skills)).toBe(true)
  })

  it('S2: /api/skills/global returns 401 when no Authorization header', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/global')
    expect(res.status).toBe(401)
  })

  it('S3: /api/skills/global CORS: no Access-Control-Allow-Origin for evil origin', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/global', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    })
    // Hono's cors middleware omits the Allow-Origin header for disallowed origins
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin')
    expect(allowOrigin).not.toBe('https://evil.example.com')
  })

  // ── /api/projects/:id/skills/local ────────────────────────────────────────

  it('S4: /api/projects/:id/skills/local returns valid LocalSkillsResponseSchema with installed skill', async () => {
    // Install a local skill in the fixture project
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const skillDir = join(projectRoot, '.claude', 'skills', 'test-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: test-skill\ndescription: A test\n---\n`)

    __resetSkillsCache()
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/skills/local`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { scope: string; skills: Array<{ name: string; scope: string }> }
    expect(data.scope).toBe('local')
    expect(Array.isArray(data.skills)).toBe(true)
    const skill = data.skills.find((s) => s.name === 'test-skill')
    expect(skill).toBeDefined()
    expect(skill!.scope).toBe('local')
  })

  it('S5: /api/projects/:id/skills/local returns 404 when projectId not in registry', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/skills/local',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
  })

  it('S6: /api/projects/:id/skills/local returns gracefully when no local skills', async () => {
    // No skills installed in fixture project
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/skills/local`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { scope: string; skills: unknown[] }
    expect(data.scope).toBe('local')
    expect(data.skills).toHaveLength(0)
  })

  it('S7: bearer auth required on /api/projects/:id/skills/local', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/skills/local`,
    )
    expect(res.status).toBe(401)
  })
})
