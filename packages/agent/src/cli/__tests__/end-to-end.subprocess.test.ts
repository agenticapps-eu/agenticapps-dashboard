/**
 * Phase 1 end-to-end smoke test — closes Phase 1 success criterion 1.
 *
 * Sequence: register → start → /health → /api/registry → /read → traversal-rejected
 *           → rotate (API) → old-token-401 → stop → daemon exited
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeIsolatedHome, cliBundle } from './__shared__/spawnAgent.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('Phase 1 end-to-end smoke (success criterion 1)', () => {
  it(
    'register → start → /health → /api/registry → /read → traversal-rejected → rotate → old-token-401 → stop → exited',
    async () => {
      const port = 5400 + Math.floor(Math.random() * 100)
      const { home, cleanup } = makeIsolatedHome()

      // Build a minimal tmp project with .planning/PROJECT.md
      const proj = mkdtempSync(join(tmpdir(), 'agentic-e2e-proj-'))
      mkdirSync(join(proj, '.planning'), { recursive: true })
      mkdirSync(join(proj, '.claude'), { recursive: true })
      writeFileSync(join(proj, '.planning', 'PROJECT.md'), '# tmp project for e2e')

      const child = spawn('node', [cliBundle, 'start', '--port', String(port)], {
        env: { ...process.env, HOME: home, NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let buf = ''

      try {
        // 1) register before starting daemon (register writes to registry.json directly)
        const regResult = spawnSync('node', [cliBundle, 'register', proj], {
          env: { ...process.env, HOME: home },
          encoding: 'utf8',
          timeout: 10_000,
        })
        expect(regResult.status).toBe(0)

        // 2) Wait for daemon to be ready
        await new Promise<void>((resolveReady, rejectReady) => {
          const onData = (chunk: Buffer): void => {
            buf += chunk.toString('utf8')
            if (buf.includes('Listening on')) resolveReady()
          }
          child.stdout!.on('data', onData)
          child.stderr!.on('data', onData)
          child.once('exit', (code) =>
            rejectReady(
              new Error(`agent exited (${code ?? 'null'}) before ready; output:\n${buf}`),
            ),
          )
          setTimeout(
            () => rejectReady(new Error(`agent did not start within 5s; output:\n${buf}`)),
            5_000,
          )
        })

        // Read active token from isolated home
        const auth = JSON.parse(
          readFileSync(join(home, '.agenticapps/dashboard/auth.json'), 'utf8'),
        ) as { token: string }
        const oldToken = auth.token

        // 3) GET /health — expects ok: true, registryCount: 1
        const healthRes = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: { Authorization: `Bearer ${oldToken}` },
        })
        expect(healthRes.status).toBe(200)
        const health = (await healthRes.json()) as {
          ok: boolean
          daemonVersion?: string
          registryCount?: number
        }
        expect(health.ok).toBe(true)
        expect(health.registryCount).toBe(1)

        // 4) GET /api/registry — list contains the registered project
        const regRes = await fetch(`http://127.0.0.1:${port}/api/registry`, {
          headers: { Authorization: `Bearer ${oldToken}` },
        })
        expect(regRes.status).toBe(200)
        const list = (await regRes.json()) as Array<{ id: string; root: string }>
        expect(list).toHaveLength(1)
        expect(list[0]!.root).toBe(proj)
        const projId = list[0]!.id

        // 5) GET /api/projects/:id/read?path=.planning/PROJECT.md — returns file content
        // Must be under .planning/ or .claude/ per path allow-list (D-23)
        const readRes = await fetch(
          `http://127.0.0.1:${port}/api/projects/${projId}/read?path=.planning%2FPROJECT.md`,
          { headers: { Authorization: `Bearer ${oldToken}` } },
        )
        expect(readRes.status).toBe(200)
        const readBody = (await readRes.json()) as { content: string }
        expect(readBody.content).toContain('tmp project for e2e')

        // 6) Path traversal must be rejected (422)
        const badRes = await fetch(
          `http://127.0.0.1:${port}/api/projects/${projId}/read?path=..%2F..%2Fetc%2Fpasswd`,
          { headers: { Authorization: `Bearer ${oldToken}` } },
        )
        expect(badRes.status).toBe(422)

        // 7) POST /api/auth/rotate — rotate token via API (D-15)
        const rotateRes = await fetch(`http://127.0.0.1:${port}/api/auth/rotate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${oldToken}` },
        })
        expect(rotateRes.status).toBe(204)

        // 8) Old token must now return 401 (D-15 mid-rotation invalidation)
        const oldRes = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: { Authorization: `Bearer ${oldToken}` },
        })
        expect(oldRes.status).toBe(401)

        // 9) stop via CLI subprocess (uses POST /api/admin/shutdown as primary path)
        const stopResult = spawnSync('node', [cliBundle, 'stop'], {
          env: { ...process.env, HOME: home },
          encoding: 'utf8',
          timeout: 10_000,
        })
        expect(stopResult.status).toBe(0)

        // 10) Daemon should exit within 2s
        await new Promise((r) => setTimeout(r, 1_500))
        expect(child.exitCode === null ? 'still alive' : 'exited').toBe('exited')
      } finally {
        if (child.exitCode === null) child.kill('SIGKILL')
        cleanup()
      }
    },
    60_000,
  )
})
