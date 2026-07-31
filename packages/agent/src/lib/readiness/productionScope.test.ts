import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PRODUCTION_IGNORE,
  globMatch,
  isProductionPath,
  resolveProductionScope,
  scopeCollapses,
  toPathspecs,
} from './productionScope.js'

const COVERAGE_PATH = 'coverage/coverage-summary.json'

const defaultScope = () => resolveProductionScope({ coveragePath: COVERAGE_PATH })

describe('globMatch', () => {
  it.each([
    ['docs/**', 'docs/spec/x.md', true],
    ['docs/**', 'docs/x.ts', true],
    ['docs/**', 'docsx/x.ts', false],
    ['*.md', 'README.md', true],
    ['*.md', 'packages/spa/README.md', false],
    ['packages/**', 'packages/agent/src/x.ts', true],
    ['packages/**/*.snap', 'packages/spa/src/__snapshots__/a.snap', true],
    ['packages/**/*.snap', 'packages/a.snap', true],
    ['**', 'anything/at/all.ts', true],
    ['src/?.ts', 'src/a.ts', true],
    ['src/?.ts', 'src/ab.ts', false],
  ])('%s against %s is %s', (pattern, path, expected) => {
    expect(globMatch(pattern, path)).toBe(expected)
  })

  it('does not let a single star cross a separator', () => {
    expect(globMatch('src/*.ts', 'src/nested/a.ts')).toBe(false)
  })
})

describe('resolveProductionScope', () => {
  it('defaults to everything but docs, planning, openspec, root markdown and the coverage artifact', () => {
    const scope = defaultScope()
    expect(scope.include).toEqual(['**'])
    expect(scope.ignore).toEqual([...DEFAULT_PRODUCTION_IGNORE, COVERAGE_PATH])
    expect(scope.declared).toBe(false)
  })

  it('marks a configured scope as declared and keeps the coverage artifact ignored', () => {
    const scope = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['packages/**'], ignore: ['packages/**/*.snap'] },
    })
    expect(scope.include).toEqual(['packages/**'])
    expect(scope.ignore).toContain('packages/**/*.snap')
    expect(scope.ignore).toContain(COVERAGE_PATH)
    expect(scope.declared).toBe(true)
  })

  it('extends rather than replaces the default ignores', () => {
    const scope = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { ignore: ['vendor/**'] },
    })
    for (const pattern of DEFAULT_PRODUCTION_IGNORE) {
      expect(scope.ignore).toContain(pattern)
    }
    expect(scope.ignore).toContain('vendor/**')
  })
})

describe('isProductionPath', () => {
  it.each([
    ['packages/agent/src/lib/x.ts', true],
    ['packages/spa/README.md', true],
    ['scripts/build.sh', true],
    ['README.md', false],
    ['CLAUDE.md', false],
    ['docs/spec/dashboard-prompt.md', false],
    ['docs/diagram.ts', false],
    ['.planning/phases/01/PLAN.md', false],
    ['.agenticapps/readiness.json', false],
    ['openspec/specs/x/spec.md', false],
    [COVERAGE_PATH, false],
  ])('%s counts as production: %s', (path, expected) => {
    expect(isProductionPath(path, defaultScope())).toBe(expected)
  })

  it('honours a configured include set', () => {
    const scope = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['packages/**'] },
    })
    expect(isProductionPath('packages/agent/src/x.ts', scope)).toBe(true)
    expect(isProductionPath('scripts/build.sh', scope)).toBe(false)
  })

  it('honours a configured ignore extension', () => {
    const scope = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { ignore: ['packages/**/*.snap'] },
    })
    expect(isProductionPath('packages/spa/src/a.snap', scope)).toBe(false)
    expect(isProductionPath('packages/spa/src/a.ts', scope)).toBe(true)
  })
})

describe('scopeCollapses', () => {
  const files = ['packages/agent/src/x.ts', 'README.md', 'docs/a.md']

  it('is true when a configured scope excludes every production path the default finds', () => {
    const configured = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['nothing-here/**'] },
    })
    expect(scopeCollapses(files, configured, defaultScope())).toBe(true)
  })

  it('is false when the configured scope still finds production paths', () => {
    const configured = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['packages/**'] },
    })
    expect(scopeCollapses(files, configured, defaultScope())).toBe(false)
  })

  it('is false when the default scope finds nothing either', () => {
    const configured = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['nothing-here/**'] },
    })
    expect(scopeCollapses(['README.md', 'docs/a.md'], configured, defaultScope())).toBe(
      false,
    )
  })
})

/**
 * The JS matcher is what classifies working-tree changes; the pathspecs are what
 * ask git for the last production commit. They have to agree, so this asserts it
 * against a real repository rather than assuming two glob dialects match.
 */
describe('toPathspecs parity with isProductionPath', () => {
  let repo: string

  const FILES = [
    'packages/agent/src/lib/x.ts',
    'packages/spa/README.md',
    'packages/spa/src/a.snap',
    'scripts/build.sh',
    'README.md',
    'CLAUDE.md',
    'docs/spec/prompt.md',
    'docs/diagram.ts',
    '.planning/phases/01/PLAN.md',
    '.agenticapps/readiness.json',
    'openspec/specs/x/spec.md',
    COVERAGE_PATH,
  ]

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'readiness-scope-'))
    execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
    for (const file of FILES) {
      mkdirSync(join(repo, dirname(file)), { recursive: true })
      writeFileSync(join(repo, file), 'x\n')
    }
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  function gitSelected(scope: ReturnType<typeof defaultScope>): string[] {
    const out = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...toPathspecs(scope)],
      { cwd: repo, encoding: 'utf8' },
    )
    return out.split('\n').filter(Boolean).sort()
  }

  it('selects the same files as the default scope', () => {
    const scope = defaultScope()
    expect(gitSelected(scope)).toEqual(FILES.filter((f) => isProductionPath(f, scope)).sort())
  })

  it('selects the same files as a configured scope', () => {
    const scope = resolveProductionScope({
      coveragePath: COVERAGE_PATH,
      configured: { include: ['packages/**'], ignore: ['packages/**/*.snap'] },
    })
    expect(gitSelected(scope)).toEqual(FILES.filter((f) => isProductionPath(f, scope)).sort())
  })
})
