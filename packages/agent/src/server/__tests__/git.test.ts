import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { addProject } from '../../lib/registry.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/git', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let projectId: string
  let registryFile: string
  let token: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
    // Make it a git repo so git log works
    await execa('git', ['init'], { cwd: proj.root })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: proj.root })
    await execa('git', ['config', 'user.name', 'Test'], { cwd: proj.root })
    await execa('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: proj.root })

    const result = addProject(proj.root, {}, registryFile)
    projectId = result.entry.id
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET ?cmd=log returns 200 with GitResponseSchema body', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/git?cmd=log`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { stdout: string; stderr: string; exitCode: number }
    expect(typeof body.stdout).toBe('string')
    expect(typeof body.stderr).toBe('string')
    expect(typeof body.exitCode).toBe('number')
    expect(body.exitCode).toBe(0)
  })

  it('GET ?cmd=rebase returns 422 with error=git_cmd_not_allowed', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/git?cmd=rebase`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(422)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('git_cmd_not_allowed')
  })

  it('GET ?cmd=log&extra=ignored only reads cmd param (ignores extra)', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/git?cmd=log&extra=ignored`,
      { headers: authHeaders(token) },
    )
    // Should succeed — extra query params are ignored
    expect(res.status).toBe(200)
  })
})
