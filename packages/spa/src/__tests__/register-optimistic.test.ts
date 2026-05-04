/**
 * Phase 3 Plan 11 — Subprocess integration test: register-prepare → register-confirm.
 *
 * Covers acceptance criterion 4 (daemon-side bound):
 *   - POST /api/registry/register-prepare → 200 with nonce
 *   - POST /api/registry/register-confirm → 201 with RegistryEntry
 *   - Total round-trip < 5000 ms
 *   - D-10 single-use nonce semantics: second confirm → 410
 *
 * The SPA-side render-tick invariant (D-25: delta from onSuccess to DOM card-visible < 50 ms)
 * is covered by plan 03-08 task 3 in MultiProjectHome.test.tsx — NOT by this test.
 *
 * Security: T-03-11-01 — token is only sent in Authorization header, never logged.
 *           T-03-11-02 — SIGTERM + 200ms drain in afterAll; no orphan daemons.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

// packages/spa/src/__tests__/ → packages/agent/dist/cli.js
const cliBundle = resolve(__dirname, '../../../../packages/agent/dist/cli.js')

// Use a random port in 5500-5599 range to avoid collisions with Phase 1 e2e (5400-5499)
const PORT = 5500 + Math.floor(Math.random() * 100)

let daemon: ChildProcess
let agentUrl: string
let token: string
let homeDir: string

/** Wait for a stdout line matching `pattern` within `timeoutMs` or reject. */
async function waitForLine(
  child: ChildProcess,
  pattern: RegExp,
  timeoutMs = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for ${pattern} — daemon may have failed to start`)),
      timeoutMs,
    )
    let buf = ''
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString()
      if (pattern.test(buf)) {
        clearTimeout(t)
        child.stdout?.off('data', onData)
        child.stderr?.off('data', onData)
        // Return the matched line (last line in buf that matches)
        const line = buf
          .split('\n')
          .find((l) => pattern.test(l)) ?? buf
        resolve(line)
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('exit', (code) => {
      clearTimeout(t)
      reject(new Error(`daemon exited (${code ?? 'null'}) before matching ${pattern}; output:\n${buf}`))
    })
  })
}

beforeAll(async () => {
  // Build the agent binary first (idempotent if already built)
  const packageRoot = resolve(__dirname, '../../../../packages/agent')
  const buildResult = spawnSync('pnpm', ['build'], {
    cwd: packageRoot,
    stdio: 'pipe',
    encoding: 'utf-8',
  })
  if (buildResult.status !== 0) {
    throw new Error(
      `agent build failed (status ${buildResult.status ?? 'null'}):\n${buildResult.stderr}`,
    )
  }

  // Isolated HOME — T-03-11-02 prevents any writes to ~/.agenticapps/dashboard
  homeDir = mkdtempSync(join(tmpdir(), 'agentic-home-03-11-'))
  mkdirSync(join(homeDir, '.agenticapps', 'dashboard'), { recursive: true, mode: 0o700 })

  daemon = spawn('node', [cliBundle, 'start', '--port', String(PORT), '--bind', '127.0.0.1'], {
    env: { ...process.env, HOME: homeDir, AGENTIC_DASHBOARD_HOME: homeDir, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Wait for "Listening on http://127.0.0.1:<PORT>" in stdout or stderr
  await waitForLine(daemon, /Listening on/, 15_000)
  agentUrl = `http://127.0.0.1:${PORT}`

  // Read fresh bearer token from the isolated home — T-03-11-01 (never logged)
  const auth = JSON.parse(
    readFileSync(join(homeDir, '.agenticapps', 'dashboard', 'auth.json'), 'utf-8'),
  ) as { token: string }
  token = auth.token
}, 60_000)

afterAll(async () => {
  // T-03-11-02: SIGTERM + drain — no orphan daemons
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM')
    await delay(300)
    if (daemon.exitCode === null) daemon.kill('SIGKILL')
  }
})

describe('Phase 3: register-prepare → register-confirm (daemon round-trip)', () => {
  it(
    'prepare returns 200 with nonce shape; confirm returns 201 with RegistryEntry; round-trip < 5000 ms (criterion 4)',
    async () => {
      const projectDir = mkdtempSync(join(tmpdir(), 'agentic-proj-03-11-'))

      // ── Step 1: prepare ──────────────────────────────────────────────────────
      const prepStart = Date.now()
      const prepRes = await fetch(`${agentUrl}/api/registry/register-prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: projectDir }),
      })
      expect(prepRes.status).toBe(200)

      const prep = (await prepRes.json()) as {
        nonce: string
        alreadyRegistered: boolean
        blocked: boolean
        canonicalRoot: string
        suggestedName: string
        suggestedSlug: string
        detectedMarkers: { gitRepo: boolean; planning: boolean; claudeSkills: boolean }
        expiresAt: number
      }

      // D-10 / D-11: nonce is 32 lowercase hex chars
      expect(prep.nonce).toMatch(/^[0-9a-f]{32}$/)
      expect(prep.alreadyRegistered).toBe(false)
      expect(prep.blocked).toBe(false)
      expect(typeof prep.canonicalRoot).toBe('string')
      expect(typeof prep.suggestedName).toBe('string')
      expect(typeof prep.detectedMarkers.gitRepo).toBe('boolean')

      // ── Step 2: confirm ──────────────────────────────────────────────────────
      const confirmRes = await fetch(`${agentUrl}/api/registry/register-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nonce: prep.nonce, name: 'phase3-fixture', tags: [] }),
      })
      const totalMs = Date.now() - prepStart

      expect(confirmRes.status).toBe(201)

      const entry = (await confirmRes.json()) as {
        id: string
        name: string
        root: string
        alreadyRegistered: boolean
        tags: string[]
      }
      expect(entry).toHaveProperty('id')
      expect(typeof entry.id).toBe('string')
      expect(entry).toHaveProperty('name', 'phase3-fixture')
      expect(entry).toHaveProperty('alreadyRegistered', false)

      // ── Acceptance criterion 4: daemon round-trip < 5 s (criterion bound) ───
      // The optimistic-add UI tick (< 50 ms) is covered by MultiProjectHome.test.tsx.
      expect(totalMs).toBeLessThan(5_000)
    },
    15_000,
  )

  it(
    'rejects confirm with second use of the same nonce (D-10 single-use semantics → 410)',
    async () => {
      const projectDir = mkdtempSync(join(tmpdir(), 'agentic-once-03-11-'))

      // Prepare
      const prepRes = await fetch(`${agentUrl}/api/registry/register-prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: projectDir }),
      })
      expect(prepRes.status).toBe(200)
      const prep = (await prepRes.json()) as { nonce: string }
      expect(prep.nonce).toMatch(/^[0-9a-f]{32}$/)

      // First confirm — must succeed (201)
      const first = await fetch(`${agentUrl}/api/registry/register-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nonce: prep.nonce }),
      })
      expect(first.status).toBe(201)

      // Second confirm with same nonce — single-use: must return 410 Gone (D-10, D-18)
      const second = await fetch(`${agentUrl}/api/registry/register-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nonce: prep.nonce }),
      })
      expect(second.status).toBe(410)

      const body = (await second.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe('nonce_expired')
    },
    15_000,
  )

  it(
    'GET /api/registry contains the newly registered entry (D-25 optimistic-add confirms real registration)',
    async () => {
      const registryRes = await fetch(`${agentUrl}/api/registry`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(registryRes.status).toBe(200)
      const list = (await registryRes.json()) as Array<{ id: string; name: string }>
      const names = list.map((e) => e.name)
      // 'phase3-fixture' was registered in test 1 above
      expect(names).toContain('phase3-fixture')
    },
    10_000,
  )
})
