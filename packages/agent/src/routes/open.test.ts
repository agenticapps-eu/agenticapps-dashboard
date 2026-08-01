/**
 * open.test.ts — POST /api/projects/:id/open.
 *
 * `filesystem-access-policy` has enumerated this route as one of four permitted
 * process-spawn surfaces since before the daemon had it. §10 needs it, so here
 * it is, and the tests are written against what that spec says the daemon may
 * guarantee: the program invoked, its arguments, its working directory, and
 * that the daemon itself writes nothing. What the editor does afterwards is
 * outside the boundary and is not asserted, because it cannot be.
 *
 * The path goes through `resolveAllowed` — the same primitive the read route
 * uses — so this introduces no new filesystem reach, only a new reason to use
 * the existing one.
 */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn(() => ({ unref: vi.fn(), on: vi.fn() })))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: spawnMock }
})

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

const cleanups: Array<() => void> = []

function makeProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'open-route-'))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'openspec', 'changes', 'a-change'), { recursive: true })
  writeFileSync(join(root, 'openspec', 'changes', 'a-change', 'REVIEWS.md'), '# reviews\n')
  mkdirSync(join(root, '.git'), { recursive: true })
  writeFileSync(join(root, '.git', 'config'), '[core]\n')
  writeFileSync(join(root, 'README.md'), '# readme\n')
  return root
}

describe('POST /api/projects/:id/open', () => {
  let cleanupHome: () => void
  let token: string
  let registryFile: string
  let previousEditor: string | undefined

  beforeEach(() => {
    const tmpHome = makeTmpHome()
    cleanupHome = tmpHome.cleanup
    registryFile = join(tmpHome.configDir, 'registry.json')
    const fresh = ensureAuthFile(join(tmpHome.configDir, 'auth.json'))
    setActiveToken(fresh.token)
    token = fresh.token
    previousEditor = process.env.EDITOR
    process.env.EDITOR = '/usr/local/bin/my-editor'
    spawnMock.mockClear()
  })

  afterEach(() => {
    if (previousEditor === undefined) delete process.env.EDITOR
    else process.env.EDITOR = previousEditor
    while (cleanups.length) cleanups.pop()?.()
    cleanupHome()
  })

  async function register(root: string): Promise<string> {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: root }),
    })
    const body = (await res.json()) as { id: string }
    return body.id
  }

  async function open(
    id: string,
    path: string,
    extraHeaders: Record<string, string> = {},
  ) {
    const app = createApp({ registryFile })
    return app.request(`http://127.0.0.1:5193/api/projects/${id}/open`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({ path }),
    })
  }

  it('spawns the editor against the resolved path and answers immediately', async () => {
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(200)
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [command, args] = spawnMock.mock.calls[0] as unknown as [string, string[]]
    expect(command).toBe('/usr/local/bin/my-editor')
    expect(args).toHaveLength(1)
    expect(args[0]).toContain('openspec/changes/a-change/REVIEWS.md')
  })

  it('never routes the spawn through a shell', async () => {
    const root = makeProject()
    const id = await register(root)

    await open(id, 'openspec/changes/a-change/REVIEWS.md')

    const options = (spawnMock.mock.calls[0] as unknown as [string, string[], Record<string, unknown>])[2]
    expect(options.shell).toBe(false)
    // The registry stores the canonical root, which on macOS means /private/var
    // where mkdtemp handed back /var. Comparing against the raw temp path would
    // be testing the symlink, not the working directory.
    expect(options.cwd).toBe(realpathSync(root))
  })

  it('refuses a path the read route would refuse, and spawns nothing', async () => {
    const root = makeProject()
    const id = await register(root)

    for (const path of ['.git/config', 'README.md', '../escape', '/etc/passwd']) {
      const res = await open(id, path)
      expect(res.status).toBe(422)
    }
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses an unknown project from the registry alone', async () => {
    const res = await open('no-such-project', 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(404)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses a disallowed Origin before doing any work', async () => {
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md', {
      Origin: 'https://evil.example',
    })

    expect(res.status).toBe(403)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('says so when no editor is configured rather than guessing one', async () => {
    delete process.env.EDITOR
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('editor_not_configured')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses an EDITOR carrying arguments instead of splitting it', async () => {
    // Splitting `EDITOR` into argv is how a spawn boundary starts accepting
    // arguments it did not choose. The daemon passes exactly one: the path.
    process.env.EDITOR = 'code -w --user-data-dir /tmp'
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('editor_not_supported')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('requires a bearer token', async () => {
    const root = makeProject()
    const id = await register(root)
    const app = createApp({ registryFile })

    const res = await app.request(`http://127.0.0.1:5193/api/projects/${id}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'openspec/changes/a-change/REVIEWS.md' }),
    })

    expect(res.status).toBe(401)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('leaves the project tree exactly as it found it', async () => {
    const root = makeProject()
    const id = await register(root)
    const before = readdirSync(join(root, 'openspec', 'changes', 'a-change'))

    await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(readdirSync(join(root, 'openspec', 'changes', 'a-change'))).toEqual(before)
  })
})
