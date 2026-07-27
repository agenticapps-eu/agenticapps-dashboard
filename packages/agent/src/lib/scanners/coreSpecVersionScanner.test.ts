import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'
import { readCoreSpecVersion } from './coreSpecVersionScanner.declare.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'core-spec-version-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeResolver(root: string): PathResolver {
  return (candidatePath, opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }

    const realRoot = realpathSync(root)
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed root: ${real}`)
    }

    const name = basename(real)
    if (opts.allowedNames && !opts.allowedNames.includes(name)) {
      throw new PathViolation(`name not allowed: ${name}`)
    }
    if (opts.extension && !name.endsWith(opts.extension)) {
      throw new PathViolation(`extension not allowed: ${name}`)
    }

    return real
  }
}

function writeSection(coreRoot: string, name: string, version: string): void {
  const specDir = join(coreRoot, 'spec')
  mkdirSync(specDir, { recursive: true })
  writeFileSync(
    join(specDir, name),
    `---\nspec_version: ${version}\n---\n\n# Section\n`,
  )
}

describe('readCoreSpecVersion', () => {
  it('reports the semantic-version maximum across all sections', () => {
    writeSection(tmpDir, '00-overview.md', '2.9.9')
    writeSection(tmpDir, '01-contract.md', '2.10.0')
    writeSection(tmpDir, '02-older.md', '1.99.0')

    expect(readCoreSpecVersion(tmpDir, makeResolver(tmpDir))).toBe('2.10.0')
  })

  it('does not let an unreleased changelog entry move the reported version', () => {
    writeSection(tmpDir, '00-overview.md', '1.8.0')
    writeSection(tmpDir, '01-contract.md', '1.9.0')
    writeFileSync(
      join(tmpDir, 'CHANGELOG.md'),
      '# Changelog\n\n## Unreleased\n\n- Prepare workflow spec 99.0.0\n',
    )

    expect(readCoreSpecVersion(tmpDir, makeResolver(tmpDir))).toBe('1.9.0')
  })

  it('returns null when the core spec directory is unavailable', () => {
    expect(readCoreSpecVersion(tmpDir, makeResolver(tmpDir))).toBeNull()
  })
})
