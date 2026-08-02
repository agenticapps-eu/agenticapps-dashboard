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
  chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const spawnMock = vi.hoisted(() =>
  vi.fn(() => ({ unref: vi.fn(), on: vi.fn(), once: vi.fn() })),
)
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
    // `filesystem-access-policy` names termination as one of the five things
    // the daemon guarantees at the spawn boundary. Deleting either of these
    // used to leave every test in this file green, while the editor's lifetime
    // silently became the daemon's.
    expect(options.detached).toBe(true)
    expect(options.stdio).toBe('ignore')
    const child = spawnMock.mock.results[0]?.value as { unref: ReturnType<typeof vi.fn> }
    expect(child.unref).toHaveBeenCalledTimes(1)
    // The registry stores the canonical root, which on macOS means /private/var
    // where mkdtemp handed back /var. Comparing against the raw temp path would
    // be testing the symlink, not the working directory.
    expect(options.cwd).toBe(realpathSync(root))
  })

  it('opens the repo itself when no path is named', async () => {
    // What "open in editor" means on a repo detail header. The project root is
    // not under the read allow-list and never will be — that list bounds what
    // the daemon will read out and hand to a browser, and opening an editor
    // reads nothing and returns nothing. The registry is what bounds this: the
    // only roots nameable here are ones the user registered.
    const root = makeProject()
    const id = await register(root)
    const app = createApp({ registryFile })

    const res = await app.request(`http://127.0.0.1:5193/api/projects/${id}/open`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    const [command, args] = spawnMock.mock.calls[0] as unknown as [string, string[]]
    expect(command).toBe('/usr/local/bin/my-editor')
    expect(args).toEqual([realpathSync(root)])
  })

  it('still refuses a named path outside the allow-list', async () => {
    // Omitting the path opens the root; naming one keeps every restriction the
    // read route applies. The two must not blur into "any path under the root".
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'README.md')

    expect(res.status).toBe(422)
    expect(spawnMock).not.toHaveBeenCalled()
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

  it('honours an EDITOR that carries arguments, path last', async () => {
    // `EDITOR="zed --wait"` and `EDITOR="code -w"` are the common shapes, so
    // refusing them refused nearly everyone. Splitting is safe for the reason
    // that mattered all along: `shell: false` means no token here is ever
    // interpreted, and $EDITOR is the operator's own environment.
    process.env.EDITOR = 'zed --wait'
    const root = makeProject()
    const id = await register(root)

    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(200)
    const [command, args] = spawnMock.mock.calls[0] as unknown as [string, string[]]
    expect(command).toBe('zed')
    expect(args).toHaveLength(2)
    expect(args[0]).toBe('--wait')
    expect(args[1]).toContain('REVIEWS.md')
  })

  it('treats an executable whose own path contains spaces as the program', async () => {
    // macOS is this product's platform, where
    // `/Applications/Visual Studio Code.app/.../code` is one program with zero
    // arguments. Splitting it on whitespace would look for a binary called
    // "/Applications/Visual".
    const dir = mkdtempSync(join(tmpdir(), 'editor dir-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    const editorPath = join(dir, 'my editor')
    writeFileSync(editorPath, '#!/bin/sh\n')
    chmodSync(editorPath, 0o755)
    process.env.EDITOR = editorPath

    const root = makeProject()
    const id = await register(root)
    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(200)
    const [command, args] = spawnMock.mock.calls[0] as unknown as [string, string[]]
    expect(command).toBe(editorPath)
    expect(args).toHaveLength(1)
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

  it('survives an editor that cannot be spawned', async () => {
    // `spawn` reports ENOENT asynchronously, by emitting 'error' on the child.
    // An EventEmitter with no 'error' listener rethrows, which here means an
    // uncaught exception in the daemon — so a user whose EDITOR names a binary
    // that is not on the daemon's PATH takes the daemon down by clicking a
    // button. The response has already gone out by then, so the client sees a
    // 200 and the daemon dies behind it.
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof spawnMock>)

    const root = makeProject()
    const id = await register(root)
    const res = await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(res.status).toBe(200)
    expect(() =>
      child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })),
    ).not.toThrow()
  })

  it('leaves the project tree exactly as it found it', async () => {
    const root = makeProject()
    const id = await register(root)
    const before = readdirSync(join(root, 'openspec', 'changes', 'a-change'))

    await open(id, 'openspec/changes/a-change/REVIEWS.md')

    expect(readdirSync(join(root, 'openspec', 'changes', 'a-change'))).toEqual(before)
  })
})
