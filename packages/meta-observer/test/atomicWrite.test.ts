import { describe, it, expect, vi } from 'vitest'
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { atomicWrite, PathViolation } from '../lib/atomicWrite.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `atomic-write-test-${randomBytes(4).toString('hex')}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function cleanup(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}

describe('atomicWrite', () => {
  it('writes content to the target file', async () => {
    const sandbox = makeTmpDir()
    try {
      const target = join(sandbox, 'output.md')
      await atomicWrite(target, 'hello world', { sandboxRoot: sandbox })
      expect(readFileSync(target, 'utf8')).toBe('hello world')
    } finally {
      cleanup(sandbox)
    }
  })

  it('bootstraps a sandboxRoot that does not exist yet (first-fire case)', async () => {
    const parent = makeTmpDir()
    try {
      const sandbox = join(parent, 'skill-observations')
      const target = join(sandbox, 'first.md')
      await atomicWrite(target, 'bootstrap', { sandboxRoot: sandbox })
      expect(readFileSync(target, 'utf8')).toBe('bootstrap')
    } finally {
      cleanup(parent)
    }
  })

  it('creates parent directories recursively if they do not exist', async () => {
    const sandbox = makeTmpDir()
    try {
      const target = join(sandbox, 'deep', 'nested', 'output.md')
      await atomicWrite(target, 'nested content', { sandboxRoot: sandbox })
      expect(readFileSync(target, 'utf8')).toBe('nested content')
    } finally {
      cleanup(sandbox)
    }
  })

  it('leaves no .tmp file after a successful write', async () => {
    const sandbox = makeTmpDir()
    try {
      const target = join(sandbox, 'output.md')
      await atomicWrite(target, 'clean write', { sandboxRoot: sandbox })
      expect(existsSync(target + '.tmp')).toBe(false)
    } finally {
      cleanup(sandbox)
    }
  })

  it('concurrent reader never sees a partial file — always full or ENOENT', async () => {
    const sandbox = makeTmpDir()
    try {
      const target = join(sandbox, 'concurrent.md')
      const bigContent = 'x'.repeat(512 * 1024) // 512KB

      let readError: string | null = null
      let partialSeen = false

      // Start a read loop concurrently with the write
      const readLoop = async () => {
        for (let i = 0; i < 100; i++) {
          try {
            const content = readFileSync(target, 'utf8')
            // If we read something, it must be the full content
            if (content.length > 0 && content.length !== bigContent.length) {
              partialSeen = true
              readError = `Partial read: got ${content.length} bytes, expected ${bigContent.length}`
            }
          } catch (err) {
            // ENOENT is acceptable (file doesn't exist yet)
            const code = (err as NodeJS.ErrnoException).code
            if (code !== 'ENOENT') {
              readError = `Unexpected error: ${code}`
            }
          }
        }
      }

      await Promise.all([atomicWrite(target, bigContent, { sandboxRoot: sandbox }), readLoop()])

      expect(partialSeen).toBe(false)
      expect(readError).toBeNull()
    } finally {
      cleanup(sandbox)
    }
  })

  it('rejects a path outside the sandboxRoot (path traversal attempt)', async () => {
    const sandbox = makeTmpDir()
    try {
      // Attempt to write outside the sandbox using ..
      const escapePath = join(sandbox, '..', 'escape.md')
      await expect(
        atomicWrite(escapePath, 'should fail', { sandboxRoot: sandbox })
      ).rejects.toThrow(PathViolation)
    } finally {
      cleanup(sandbox)
    }
  })

  it('rejects a path containing .. segments', async () => {
    const sandbox = makeTmpDir()
    try {
      const badPath = join(sandbox, 'sub', '..', '..', 'etc', 'passwd')
      await expect(
        atomicWrite(badPath, 'should fail', { sandboxRoot: sandbox })
      ).rejects.toThrow(PathViolation)
    } finally {
      cleanup(sandbox)
    }
  })

  it('rejects a relative path', async () => {
    const sandbox = makeTmpDir()
    try {
      await expect(
        atomicWrite('relative/path.md', 'should fail', { sandboxRoot: sandbox })
      ).rejects.toThrow(PathViolation)
    } finally {
      cleanup(sandbox)
    }
  })

  it('rejects a path outside sandbox even without .. (different branch)', async () => {
    const sandbox = makeTmpDir()
    const otherDir = makeTmpDir()
    try {
      const externalPath = join(otherDir, 'output.md')
      await expect(
        atomicWrite(externalPath, 'should fail', { sandboxRoot: sandbox })
      ).rejects.toThrow(PathViolation)
    } finally {
      cleanup(sandbox)
      cleanup(otherDir)
    }
  })
})
