/**
 * Mandatory TDD case — spec line 616.
 * describe 'path-allow-list-rejects-traversal' name is the acceptance gate.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { addProject } from '../../lib/registry.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'
import { MAX_READ_BYTES } from '../../constants.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('path-allow-list-rejects-traversal (mandatory TDD)', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    const result = await addProject(proj.root, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET ?path=../../etc/passwd returns 422 with path_not_allowed', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=../../etc/passwd`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(422)
    const body = await res.json() as { ok: boolean; error: string; requestId: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('path_not_allowed')
    expect(typeof body.requestId).toBe('string')
  })
})

describe('path-allow-list-rejects-absolute', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    const result = await addProject(proj.root, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET ?path=/etc/passwd returns 422 with path_not_allowed', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=/etc/passwd`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(422)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('path_not_allowed')
  })
})

describe('path-allow-list-allows-planning', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string
  let projRoot: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    projRoot = proj.root
    // Write a file inside .planning so the read route can return it
    mkdirSync(join(projRoot, '.planning'), { recursive: true })
    writeFileSync(join(projRoot, '.planning', 'PROJECT.md'), '# test project')
    const result = await addProject(projRoot, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET ?path=.planning/PROJECT.md returns 200 with ReadResponseSchema body', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=.planning/PROJECT.md`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { content: string; mtime: string; sha256: string }
    expect(body.content).toContain('test project')
    expect(typeof body.mtime).toBe('string')
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('path-allow-list-allows-openspec', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string
  let projRoot: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    projRoot = proj.root
    mkdirSync(join(projRoot, 'openspec', 'specs', 'daemon-runtime'), { recursive: true })
    writeFileSync(
      join(projRoot, 'openspec', 'specs', 'daemon-runtime', 'spec.md'),
      '# daemon-runtime\n\n### Requirement: Health',
    )
    const result = await addProject(projRoot, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET ?path=openspec/specs/daemon-runtime/spec.md returns 200', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=openspec/specs/daemon-runtime/spec.md`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { content: string; sha256: string }
    expect(body.content).toContain('### Requirement: Health')
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('GET ?path=docs/legacy-planning/STATE.md stays rejected with 422', async () => {
    mkdirSync(join(projRoot, 'docs', 'legacy-planning'), { recursive: true })
    writeFileSync(join(projRoot, 'docs', 'legacy-planning', 'STATE.md'), 'history')
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=docs/legacy-planning/STATE.md`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('path_not_allowed')
  })
})

/**
 * Coverage for an existing guarantee, not a new one. MAX_READ_BYTES has capped
 * /read since the route was written; nothing asserted it. The change adds the
 * cap to filesystem-access-policy as a requirement, so it needs a test that
 * fails if the cap is ever removed. Written as characterization — it passes on
 * first run because the behaviour already exists, which is not a TDD violation.
 */
describe('path-allow-list-enforces-size-cap', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string
  let projRoot: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    projRoot = proj.root
    const result = await addProject(projRoot, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('refuses an oversized file with 413 file_too_large rather than truncating', async () => {
    mkdirSync(join(projRoot, 'openspec'), { recursive: true })
    writeFileSync(
      join(projRoot, 'openspec', 'huge.md'),
      Buffer.alloc(MAX_READ_BYTES + 1, 0x61),
    )
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=openspec/huge.md`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(413)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('file_too_large')
  })

  it('allows a file exactly at the cap', async () => {
    mkdirSync(join(projRoot, 'openspec'), { recursive: true })
    writeFileSync(
      join(projRoot, 'openspec', 'atlimit.md'),
      Buffer.alloc(MAX_READ_BYTES, 0x62),
    )
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/read?path=openspec/atlimit.md`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
  })
})
