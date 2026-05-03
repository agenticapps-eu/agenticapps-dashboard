import { spawnSync } from 'node:child_process'
import { readFileSync, chmodSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeAll } from 'vitest'

import { makeIsolatedHome, startAgent, cliBundle } from './__shared__/spawnAgent.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('start subprocess', () => {
  it('boots, prints banner with pair URL, /health returns ok via bearer token', async () => {
    // T-01-04-10: random port to avoid collisions on parallel runs
    const port = 5200 + Math.floor(Math.random() * 50)
    const { home, cleanup } = makeIsolatedHome()
    const { child, ready } = startAgent(home, port)
    try {
      await ready

      // Read the token from the freshly created auth.json
      const authJson = JSON.parse(
        readFileSync(join(home, '.agenticapps/dashboard/auth.json'), 'utf8'),
      )
      const token: string = authJson.token

      // Verify /health responds correctly with bearer token
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean; daemonVersion?: string }
      expect(body.ok).toBe(true)
      expect(body.daemonVersion).toBeTruthy()
    } finally {
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 600))
      cleanup()
    }
  }, 30_000)

  it('refuses to start when auth.json has mode 0644 (DAEMON-04)', async () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const dashDir = join(home, '.agenticapps', 'dashboard')
      mkdirSync(dashDir, { recursive: true })
      const authFile = join(dashDir, 'auth.json')
      // Create an intentionally insecure auth.json (mode 0644)
      writeFileSync(
        authFile,
        JSON.stringify({
          version: 1,
          token: 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000-11111111',
          rotatedAt: new Date().toISOString(),
          agentVersion: '0.0.1',
        }),
        { mode: 0o644 },
      )
      chmodSync(authFile, 0o644)

      const result = spawnSync('node', [cliBundle, 'start', '--port', '5299'], {
        env: { ...process.env, HOME: home },
        encoding: 'utf8',
        timeout: 10_000,
      })
      expect(result.status).not.toBe(0)
      // D-01 exact spec remediation message
      const combined = result.stdout + result.stderr
      expect(combined).toContain('insecure permissions')
      expect(combined).toContain('chmod 600')
    } finally {
      cleanup()
    }
  }, 15_000)
})
