/**
 * claudeMdScanner.test.ts — CLAUDE.md / AGENTS.md presence detection.
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * CODEX HIGH-3: scanClaudeMd accepts a `resolve` callback argument.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join, sep, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { scanClaudeMd } from './claudeMdScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpRepo: string

beforeEach(() => {
  tmpRepo = mkdtempSync(join(tmpdir(), 'claude-md-scanner-'))
})

afterEach(() => {
  rmSync(tmpRepo, { recursive: true, force: true })
})

/** Create a resolver that allows reads from the given repo directory. */
function makeResolver(repoRoot: string): PathResolver {
  return (candidatePath, opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    let realRoot: string
    try {
      realRoot = realpathSync(repoRoot)
    } catch {
      realRoot = repoRoot
    }
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed roots: ${real}`)
    }
    const name = basename(real)
    if (opts.allowedNames && !opts.allowedNames.includes(name)) {
      throw new PathViolation(`name not in allow-list: ${name}`)
    }
    return real
  }
}

describe('scanClaudeMd', () => {
  it('scans CLAUDE.md present at repo root — returns state=fresh via CLAUDE.md', () => {
    writeFileSync(join(tmpRepo, 'CLAUDE.md'), '# Claude instructions')
    const resolve = makeResolver(tmpRepo)
    const result = scanClaudeMd({ repoAbsPath: tmpRepo, resolve })
    expect(result.state).toBe('fresh')
    expect(result.via).toBe('CLAUDE.md')
  })

  it('scans AGENTS.md fallback when CLAUDE.md absent — returns state=fresh via AGENTS.md', () => {
    writeFileSync(join(tmpRepo, 'AGENTS.md'), '# Agents instructions')
    const resolve = makeResolver(tmpRepo)
    const result = scanClaudeMd({ repoAbsPath: tmpRepo, resolve })
    expect(result.state).toBe('fresh')
    expect(result.via).toBe('AGENTS.md')
  })

  it('CLAUDE.md takes precedence when both CLAUDE.md and AGENTS.md are present', () => {
    writeFileSync(join(tmpRepo, 'CLAUDE.md'), '# Claude instructions')
    writeFileSync(join(tmpRepo, 'AGENTS.md'), '# Agents instructions')
    const resolve = makeResolver(tmpRepo)
    const result = scanClaudeMd({ repoAbsPath: tmpRepo, resolve })
    expect(result.state).toBe('fresh')
    expect(result.via).toBe('CLAUDE.md')
  })

  it('returns state=missing when neither CLAUDE.md nor AGENTS.md is present', () => {
    // Empty repo directory — no CLAUDE.md or AGENTS.md.
    const resolve = makeResolver(tmpRepo)
    const result = scanClaudeMd({ repoAbsPath: tmpRepo, resolve })
    expect(result.state).toBe('missing')
    expect(result.via).toBe('none')
  })

  it('CODEX HIGH-3: scanClaudeMd uses the resolve callback to canonicalise paths before existsSync', () => {
    // A resolver that throws PathViolation for all calls — this proves the scanner
    // goes through the resolver (rather than calling existsSync directly with raw paths).
    let resolveCallCount = 0
    const throwingResolver: PathResolver = (candidatePath, _opts) => {
      resolveCallCount++
      // Simulate the resolver saying "not accessible" for all paths.
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }

    // When resolver always throws, scanner should fall through to 'missing'.
    const result = scanClaudeMd({ repoAbsPath: tmpRepo, resolve: throwingResolver })
    // The resolver MUST have been called (proving the callback is used).
    expect(resolveCallCount).toBeGreaterThan(0)
    // Both CLAUDE.md and AGENTS.md are not accessible → missing.
    expect(result.state).toBe('missing')
    expect(result.via).toBe('none')
  })
})
