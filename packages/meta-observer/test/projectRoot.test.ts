import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { resolveProjectRoot } from '../lib/projectRoot.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `proj-root-test-${randomBytes(4).toString('hex')}`)
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

describe('resolveProjectRoot', () => {
  afterEach(() => {
    delete process.env['CLAUDE_PROJECT_DIR']
  })

  it('returns CLAUDE_PROJECT_DIR when set and has .planning marker', () => {
    const root = makeTmpDir()
    try {
      mkdirSync(join(root, '.planning'), { recursive: true })
      process.env['CLAUDE_PROJECT_DIR'] = root
      const result = resolveProjectRoot({ cwd: tmpdir() })
      expect(result).toBe(root)
    } finally {
      cleanup(root)
    }
  })

  it('returns CLAUDE_PROJECT_DIR when set and has .claude marker', () => {
    const root = makeTmpDir()
    try {
      mkdirSync(join(root, '.claude'), { recursive: true })
      process.env['CLAUDE_PROJECT_DIR'] = root
      const result = resolveProjectRoot({ cwd: tmpdir() })
      expect(result).toBe(root)
    } finally {
      cleanup(root)
    }
  })

  it('returns null when CLAUDE_PROJECT_DIR set but path lacks .planning or .claude', () => {
    const root = makeTmpDir()
    try {
      // No .planning or .claude created
      process.env['CLAUDE_PROJECT_DIR'] = root
      const result = resolveProjectRoot({ cwd: tmpdir() })
      expect(result).toBeNull()
    } finally {
      cleanup(root)
    }
  })

  it('walks up from cwd to find .planning marker', () => {
    const root = makeTmpDir()
    const nested = join(root, 'a', 'b', 'c')
    try {
      mkdirSync(nested, { recursive: true })
      mkdirSync(join(root, '.planning'), { recursive: true })
      const result = resolveProjectRoot({ cwd: nested })
      expect(result).toBe(root)
    } finally {
      cleanup(root)
    }
  })

  it('walks up from cwd to find .claude marker when .planning absent', () => {
    const root = makeTmpDir()
    const nested = join(root, 'x', 'y')
    try {
      mkdirSync(nested, { recursive: true })
      mkdirSync(join(root, '.claude'), { recursive: true })
      const result = resolveProjectRoot({ cwd: nested })
      expect(result).toBe(root)
    } finally {
      cleanup(root)
    }
  })

  it('returns null when neither .planning nor .claude found from cwd up to root', () => {
    const isolated = makeTmpDir()
    try {
      // isolated dir has no .planning or .claude
      const result = resolveProjectRoot({ cwd: isolated })
      expect(result).toBeNull()
    } finally {
      cleanup(isolated)
    }
  })

  it('prefers .planning over .claude when both present', () => {
    const root = makeTmpDir()
    const nested = join(root, 'deep')
    try {
      mkdirSync(nested, { recursive: true })
      mkdirSync(join(root, '.planning'), { recursive: true })
      mkdirSync(join(root, '.claude'), { recursive: true })
      const result = resolveProjectRoot({ cwd: nested })
      expect(result).toBe(root)
    } finally {
      cleanup(root)
    }
  })
})
