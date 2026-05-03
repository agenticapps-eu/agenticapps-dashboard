import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeAll } from 'vitest'

import { makeIsolatedHome, runAgent } from './__shared__/spawnAgent.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('rotate-token subprocess', () => {
  it('rotates the token: new token != old token (D-13, D-14, D-15)', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      // Initialize auth.json by running any command that calls ensureAuthFile
      const initResult = runAgent(['list', '--json'], home)
      expect(initResult.status).toBe(0)

      // Record the initial token from auth.json
      const authFile = join(home, '.agenticapps', 'dashboard', 'auth.json')
      const beforeAuth = JSON.parse(readFileSync(authFile, 'utf8')) as { token: string }
      const oldToken = beforeAuth.token
      expect(typeof oldToken).toBe('string')
      expect(oldToken.length).toBeGreaterThan(0)

      // Run rotate-token
      const rotateResult = runAgent(['rotate-token'], home)
      expect(rotateResult.status).toBe(0)
      expect(rotateResult.stdout + rotateResult.stderr).toContain('token rotated')

      // Read the new token from auth.json
      const afterAuth = JSON.parse(readFileSync(authFile, 'utf8')) as { token: string }
      const newToken = afterAuth.token

      // New token must differ from old token
      expect(newToken).not.toBe(oldToken)
      // D-13: token must be 71 chars (8 groups of 8 hex chars separated by dashes)
      expect(newToken).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/)
    } finally {
      cleanup()
    }
  })

  it('rotate-token exits 0 and prints new token to stdout', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['rotate-token'], home)
      expect(result.status).toBe(0)
      const combined = result.stdout + result.stderr
      expect(combined).toContain('new token:')
    } finally {
      cleanup()
    }
  })
})
