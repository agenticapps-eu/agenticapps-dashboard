/**
 * coverageResolver.test.ts — Tests for the synchronous PathResolver wrapper.
 *
 * CODEX HIGH-3: makeCoverageResolver() is the SINGLE filesystem entry point for
 * Phase 10 scanner code. Every scanner reads external paths through this helper.
 *
 * Tests verify:
 *  - Factory returns a callable PathResolver
 *  - Allowed paths resolve successfully
 *  - Paths outside roots are rejected with PathViolation
 *  - Disallowed basenames are rejected
 *  - Non-existent paths are rejected
 *  - Symlink escaping roots is rejected
 *  - extension form works correctly
 *  - Mutually exclusive opts (allowedNames + extension) are rejected
 *  - Neither allowedNames nor extension provided is rejected
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCoverageResolver, PathViolation } from './coverageResolver.js'
import type { PathResolver } from './coverageResolver.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTmpRoot(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'coverage-resolver-test-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('makeCoverageResolver', () => {
  let root: string
  let cleanup: () => void
  let resolve: PathResolver

  beforeEach(() => {
    const tmp = makeTmpRoot()
    root = tmp.root
    cleanup = tmp.cleanup
    // Build sub-directories that mirror Phase 10 family roots
    mkdirSync(join(root, 'Sourcecode', 'agenticapps'), { recursive: true })
    mkdirSync(join(root, 'Sourcecode', 'factiv'), { recursive: true })
    mkdirSync(join(root, 'Sourcecode', 'neuroflash'), { recursive: true })
    mkdirSync(join(root, '.gitnexus'), { recursive: true })
    // Create the resolver bound to our tmpdir roots
    resolve = makeCoverageResolver({ sourcecodeRoot: join(root, 'Sourcecode') })
  })

  afterEach(() => cleanup())

  it('makeCoverageResolver returns a callable PathResolver function', () => {
    expect(typeof resolve).toBe('function')
  })

  it('resolver accepts path inside an allowed root with matching allowedNames', () => {
    const filePath = join(root, 'Sourcecode', 'agenticapps', 'CLAUDE.md')
    writeFileSync(filePath, '# CLAUDE')
    const result = resolve(filePath, {
      allowedNames: ['CLAUDE.md'],
      roots: [join(root, 'Sourcecode', 'agenticapps')],
    })
    expect(result).toContain('CLAUDE.md')
  })

  it('resolver returns the realpath-resolved absolute path', () => {
    const filePath = join(root, 'Sourcecode', 'factiv', 'registry.json')
    writeFileSync(filePath, '[]')
    const result = resolve(filePath, {
      allowedNames: ['registry.json'],
      roots: [join(root, 'Sourcecode', 'factiv')],
    })
    expect(typeof result).toBe('string')
    expect(result.endsWith('registry.json')).toBe(true)
  })

  it('resolver throws PathViolation for path outside all allowed roots', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'outside-'))
    const outsidePath = join(outsideDir, 'secret.txt')
    writeFileSync(outsidePath, 'sensitive')
    try {
      expect(() =>
        resolve(outsidePath, {
          allowedNames: ['secret.txt'],
          roots: [join(root, 'Sourcecode', 'agenticapps')],
        }),
      ).toThrow(PathViolation)
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('resolver throws PathViolation with "outside allowed roots" message', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'outside2-'))
    const outsidePath = join(outsideDir, 'secret.json')
    writeFileSync(outsidePath, '{}')
    try {
      expect(() =>
        resolve(outsidePath, {
          allowedNames: ['secret.json'],
          roots: [join(root, 'Sourcecode', 'factiv')],
        }),
      ).toThrow(/outside allowed roots/)
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('resolver throws PathViolation for disallowed basename (name not in allow-list)', () => {
    const allowed = join(root, 'Sourcecode', 'agenticapps', 'CLAUDE.md')
    const disallowed = join(root, 'Sourcecode', 'agenticapps', 'SECRET.txt')
    writeFileSync(allowed, '# CLAUDE')
    writeFileSync(disallowed, 'secret')
    expect(() =>
      resolve(disallowed, {
        allowedNames: ['CLAUDE.md'],
        roots: [join(root, 'Sourcecode', 'agenticapps')],
      }),
    ).toThrow(PathViolation)
  })

  it('resolver throws PathViolation for non-existent path (not accessible)', () => {
    const nonExistent = join(root, 'Sourcecode', 'agenticapps', 'does-not-exist.md')
    expect(() =>
      resolve(nonExistent, {
        allowedNames: ['does-not-exist.md'],
        roots: [join(root, 'Sourcecode', 'agenticapps')],
      }),
    ).toThrow(PathViolation)
  })

  it('resolver throws PathViolation for symlink escaping root (defense in depth)', () => {
    const escapeTarget = mkdtempSync(join(tmpdir(), 'escape-'))
    const targetFile = join(escapeTarget, 'secret.txt')
    writeFileSync(targetFile, 'sensitive')
    const symlinkPath = join(root, 'Sourcecode', 'factiv', 'escape.json')
    symlinkSync(targetFile, symlinkPath)
    try {
      expect(() =>
        resolve(symlinkPath, {
          allowedNames: ['escape.json'],
          roots: [join(root, 'Sourcecode', 'factiv')],
        }),
      ).toThrow(PathViolation)
    } finally {
      rmSync(escapeTarget, { recursive: true, force: true })
    }
  })

  it('extension form: resolver accepts *.md file when extension=".md"', () => {
    const mdPath = join(root, 'Sourcecode', 'neuroflash', 'README.md')
    writeFileSync(mdPath, '# readme')
    const result = resolve(mdPath, {
      extension: '.md',
      roots: [join(root, 'Sourcecode', 'neuroflash')],
    })
    expect(result).toContain('README.md')
  })

  it('extension form: resolver rejects *.txt when extension=".md" required', () => {
    const txtPath = join(root, 'Sourcecode', 'neuroflash', 'notes.txt')
    writeFileSync(txtPath, 'text')
    expect(() =>
      resolve(txtPath, {
        extension: '.md',
        roots: [join(root, 'Sourcecode', 'neuroflash')],
      }),
    ).toThrow(PathViolation)
  })

  it('throws PathViolation when both allowedNames and extension are provided (mutually exclusive)', () => {
    const filePath = join(root, 'Sourcecode', 'agenticapps', 'CLAUDE.md')
    writeFileSync(filePath, '# CLAUDE')
    expect(() =>
      resolve(filePath, {
        allowedNames: ['CLAUDE.md'],
        extension: '.md',
        roots: [join(root, 'Sourcecode', 'agenticapps')],
      }),
    ).toThrow(PathViolation)
  })

  it('throws PathViolation when neither allowedNames nor extension is provided', () => {
    const filePath = join(root, 'Sourcecode', 'agenticapps', 'CLAUDE.md')
    writeFileSync(filePath, '# CLAUDE')
    expect(() =>
      resolve(filePath, {
        roots: [join(root, 'Sourcecode', 'agenticapps')],
      }),
    ).toThrow(PathViolation)
  })

  it('PathViolation has the correct name property', () => {
    const filePath = join(root, 'Sourcecode', 'agenticapps', 'does-not-exist.md')
    let caught: unknown
    try {
      resolve(filePath, { allowedNames: ['does-not-exist.md'], roots: [join(root, 'Sourcecode', 'agenticapps')] })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(PathViolation)
    expect((caught as PathViolation).name).toBe('PathViolation')
  })
})

describe('PathViolation', () => {
  it('is an Error subclass', () => {
    const err = new PathViolation('test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('test message')
    expect(err.name).toBe('PathViolation')
  })
})
