import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeIsolatedHome, runAgent } from './__shared__/spawnAgent.js'
import {
  RegistryListResponseSchema,
  StatusResponseSchema,
} from '@agenticapps/dashboard-shared'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('list subprocess', () => {
  it('list --json emits valid RegistryListResponseSchema JSON (D-04)', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['list', '--json'], home)
      expect(result.status).toBe(0)

      const parsed = JSON.parse(result.stdout) as unknown
      // Must parse without throwing
      expect(() => RegistryListResponseSchema.parse(parsed)).not.toThrow()
      // Empty registry returns empty array
      expect(RegistryListResponseSchema.parse(parsed)).toEqual([])
    } finally {
      cleanup()
    }
  })

  it('list (no --json) exits 0 with friendly message when registry is empty', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['list'], home)
      expect(result.status).toBe(0)
      expect(result.stdout + result.stderr).toContain('No projects registered')
    } finally {
      cleanup()
    }
  })
})

describe('status subprocess', () => {
  it('status --json emits valid StatusResponseSchema JSON (D-04)', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['status', '--json'], home)
      expect(result.status).toBe(0)

      const parsed = JSON.parse(result.stdout) as unknown
      // Must parse without throwing
      expect(() => StatusResponseSchema.parse(parsed)).not.toThrow()

      const status = StatusResponseSchema.parse(parsed)
      // Daemon is not running, so reachable=false
      expect(status.reachable).toBe(false)
      expect(status.registryCount).toBe(0)
      expect(typeof status.uptime).toBe('number')
      expect(typeof status.tokenAge).toBe('number')
    } finally {
      cleanup()
    }
  })

  it('status (no --json) exits 0 and prints reachable field', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['status'], home)
      expect(result.status).toBe(0)
      expect(result.stdout + result.stderr).toContain('reachable:')
    } finally {
      cleanup()
    }
  })
})
