/**
 * Mandatory TDD cases — spec line 616.
 * These describe() names are the acceptance gate and MUST NOT be renamed.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, chmodSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, rotateToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '../../..')
const cliBundle = resolve(packageRoot, 'dist/cli.js')

// Build once before all tests so subprocess tests exercise the built artifact.
beforeAll(() => {
  const build = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (build.status !== 0) throw new Error(`pnpm build failed (status ${build.status})`)
}, 60_000)

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY TDD CASE 1 (spec line 616)
// ─────────────────────────────────────────────────────────────────────────────
describe('token-rotation-invalidates-old-token (mandatory TDD)', () => {
  let cleanup: () => void
  let authFile: string
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    registryFile = join(tmp.configDir, 'registry.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('old token returns 401 after rotation; new token returns 200', async () => {
    const app = createApp({ registryFile })
    const oldToken = getActiveToken()

    // Confirm old token works pre-rotation
    const r1 = await app.request('http://127.0.0.1:5193/health', {
      headers: { Authorization: `Bearer ${oldToken}` },
    })
    expect(r1.status).toBe(200)

    // Rotate — write new file FIRST then flip in-memory ref (D-15)
    const next = rotateToken(authFile)

    // Old token now rejected
    const r2 = await app.request('http://127.0.0.1:5193/health', {
      headers: { Authorization: `Bearer ${oldToken}` },
    })
    expect(r2.status).toBe(401)

    // New token works
    const r3 = await app.request('http://127.0.0.1:5193/health', {
      headers: { Authorization: `Bearer ${next.token}` },
    })
    expect(r3.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY TDD CASE 2 (spec line 616)
// ─────────────────────────────────────────────────────────────────────────────
describe('cors-rejects-wrong-origin (mandatory TDD)', () => {
  let cleanup: () => void
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('OPTIONS preflight from https://evil.example gets no Access-Control-Allow-Origin', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('OPTIONS preflight from https://dashboard.agenticapps.eu DOES get Access-Control-Allow-Origin', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dashboard.agenticapps.eu',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://dashboard.agenticapps.eu',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY TDD CASE 3 (spec line 616) — subprocess test
// ─────────────────────────────────────────────────────────────────────────────
describe('permissions-check-refuses-0644 (mandatory TDD)', () => {
  it('subprocess `start` exits non-zero with EXACT remediation message when auth.json is mode 0644', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'agentic-perms-'))
    const configDir = join(fakeHome, '.agenticapps', 'dashboard')
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
    const authFile = join(configDir, 'auth.json')
    writeFileSync(
      authFile,
      JSON.stringify({
        version: 1,
        token: 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111',
        rotatedAt: '2026-05-03T00:00:00.000Z',
        agentVersion: '0.0.1-alpha.3',
      }),
      { mode: 0o600 },
    )
    // Deliberately loosen permissions to trigger the refusal
    chmodSync(authFile, 0o644)

    const result = spawnSync('node', [cliBundle, 'start'], {
      env: { ...process.env, HOME: fakeHome, NODE_ENV: 'production' },
      encoding: 'utf8',
      timeout: 15_000,
    })

    expect(result.status).not.toBe(0)
    const combined = (result.stderr ?? '') + (result.stdout ?? '')
    // Exact spec remediation message (D-01 / assertSecurePermissions)
    expect(combined).toContain('auth.json has insecure permissions (mode 644)')
    expect(combined).toContain('chmod 600')
    expect(combined).toContain('agentic-dashboard rotate-token')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bearer auth rejects invalid token
// ─────────────────────────────────────────────────────────────────────────────
describe('bearer-auth rejects invalid token', () => {
  let cleanup: () => void
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('request with wrong bearer token returns 401', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/health', {
      headers: { Authorization: 'Bearer wrong-token-that-is-not-valid' },
    })
    expect(res.status).toBe(401)
  })

  it('request with no Authorization header returns 401', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/health', {})
    expect(res.status).toBe(401)
  })
})
