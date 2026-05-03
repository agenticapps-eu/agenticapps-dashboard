import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeAll } from 'vitest'

import { makeIsolatedHome, runAgent } from './__shared__/spawnAgent.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('register subprocess', () => {
  it('register <path> adds project to registry, exits 0', () => {
    const { home, cleanup } = makeIsolatedHome()
    // Create a tmp project root to register
    const projDir = mkdtempSync(join(tmpdir(), 'proj-'))
    try {
      const result = runAgent(['register', projDir], home)
      expect(result.status).toBe(0)

      // Verify registry.json contains the entry
      const regFile = join(home, '.agenticapps', 'dashboard', 'registry.json')
      const reg = JSON.parse(readFileSync(regFile, 'utf8')) as {
        projects: Array<{ root: string }>
      }
      const found = reg.projects.some((p) => p.root === projDir)
      expect(found).toBe(true)
    } finally {
      rmSync(projDir, { recursive: true, force: true })
      cleanup()
    }
  })

  it('second register of same path is idempotent (exit 0, already registered message)', () => {
    const { home, cleanup } = makeIsolatedHome()
    const projDir = mkdtempSync(join(tmpdir(), 'proj-idem-'))
    try {
      // First registration
      const first = runAgent(['register', projDir], home)
      expect(first.status).toBe(0)

      // Second registration of the same path
      const second = runAgent(['register', projDir], home)
      expect(second.status).toBe(0)
      expect(second.stdout + second.stderr).toContain('already registered')

      // Still only one entry in registry
      const regFile = join(home, '.agenticapps', 'dashboard', 'registry.json')
      const reg = JSON.parse(readFileSync(regFile, 'utf8')) as { projects: unknown[] }
      expect(reg.projects.length).toBe(1)
    } finally {
      rmSync(projDir, { recursive: true, force: true })
      cleanup()
    }
  })

  it('unregister removes the project, second unregister exits non-zero', () => {
    const { home, cleanup } = makeIsolatedHome()
    const projDir = mkdtempSync(join(tmpdir(), 'proj-unreg-'))
    try {
      // Register
      runAgent(['register', projDir], home)

      // Get the registered id
      const regFile = join(home, '.agenticapps', 'dashboard', 'registry.json')
      const reg = JSON.parse(readFileSync(regFile, 'utf8')) as {
        projects: Array<{ id: string; root: string }>
      }
      const entry = reg.projects.find((p) => p.root === projDir)!
      expect(entry).toBeDefined()

      // Unregister by id
      const unregResult = runAgent(['unregister', entry.id], home)
      expect(unregResult.status).toBe(0)

      // Verify registry is empty
      const reg2 = JSON.parse(readFileSync(regFile, 'utf8')) as { projects: unknown[] }
      expect(reg2.projects.length).toBe(0)

      // Second unregister should exit non-zero
      const second = runAgent(['unregister', entry.id], home)
      expect(second.status).not.toBe(0)
    } finally {
      rmSync(projDir, { recursive: true, force: true })
      cleanup()
    }
  })
})
