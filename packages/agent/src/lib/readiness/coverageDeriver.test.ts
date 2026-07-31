import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_COVERAGE_PATH,
  DEFAULT_COVERAGE_THRESHOLD,
  deriveCoverage,
} from './coverageDeriver.js'
import { readGitFacts } from './gitFacts.js'
import { resolveProductionScope } from './productionScope.js'

const NOW = Date.parse('2026-07-31T12:00:00Z')

let repo: string

function git(args: string[], date?: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=t@t.com', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd: repo,
      encoding: 'utf8',
      env: date
        ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
        : process.env,
    },
  )
}

function write(file: string, body = 'x\n'): void {
  mkdirSync(join(repo, dirname(file)), { recursive: true })
  writeFileSync(join(repo, file), body)
}

function writeSummary(pct: unknown, file = DEFAULT_COVERAGE_PATH): void {
  write(file, JSON.stringify({ total: { lines: { pct } } }))
}

function commit(files: string[], message: string, date: string): string {
  git(['add', ...files])
  git(['commit', '-m', message], date)
  return git(['rev-parse', 'HEAD']).trim()
}

async function derive(options: { path?: string; threshold?: number } = {}) {
  const coveragePath = options.path ?? DEFAULT_COVERAGE_PATH
  return deriveCoverage({
    root: repo,
    scope: resolveProductionScope({ coveragePath }),
    facts: await readGitFacts(repo),
    now: NOW,
    coveragePath,
    threshold: options.threshold ?? DEFAULT_COVERAGE_THRESHOLD,
  })
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'readiness-coverage-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
  write('packages/agent/src/a.ts')
  commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('deriveCoverage — absence and thresholds', () => {
  it('reports never when no coverage artifact exists, with no percentage', async () => {
    const result = await derive()
    expect(result.status).toBe('never')
    expect(result.value).toBeNull()
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
  })

  it('reports ok at or above the threshold and carries the measurement', async () => {
    writeSummary(91.4)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.value).toBe(91.4)
    expect(result.threshold).toBe(80)
  })

  it('reports ok exactly at the threshold', async () => {
    writeSummary(80)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('ok')
  })

  it.each([79.99, 77, 75])('reports warn inside the five-point band at %s', async (pct) => {
    writeSummary(pct)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('warn')
  })

  it('reports fail below the band', async () => {
    writeSummary(74.9)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error).toBeNull()
  })

  it('clamps the warn band at zero for a very low threshold', async () => {
    writeSummary(0)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    expect((await derive({ threshold: 3 })).status).toBe('warn')
  })

  it('honours a configured artifact path', async () => {
    writeSummary(95, 'reports/coverage-summary.json')
    commit(['reports/coverage-summary.json'], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive({ path: 'reports/coverage-summary.json' })
    expect(result.status).toBe('ok')
    expect(result.evidence?.path).toBe('reports/coverage-summary.json')
  })
})

describe('deriveCoverage — unusable artifacts', () => {
  it.each([
    ['unparsable JSON', 'not json at all'],
    ['a missing total.lines.pct', JSON.stringify({ total: { statements: { pct: 90 } } })],
    ['a non-numeric percentage', JSON.stringify({ total: { lines: { pct: 'high' } } })],
    ['a percentage outside 0-100', JSON.stringify({ total: { lines: { pct: 140 } } })],
  ])('reports an error-bearing fail for %s', async (_label, body) => {
    write(DEFAULT_COVERAGE_PATH, body)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
    expect(result.value).toBeNull()
  })

  it('refuses an artifact whose path leaves the repository', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'readiness-outside-'))
    try {
      writeFileSync(
        join(outside, 'coverage-summary.json'),
        JSON.stringify({ total: { lines: { pct: 99 } } }),
      )
      mkdirSync(join(repo, 'coverage'), { recursive: true })
      symlinkSync(join(outside, 'coverage-summary.json'), join(repo, DEFAULT_COVERAGE_PATH))

      const result = await derive()
      expect(result.status).toBe('fail')
      expect(result.error?.code).toBeTruthy()
      expect(result.value).toBeNull()
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('reports the read error rather than staleness when both apply', async () => {
    write(DEFAULT_COVERAGE_PATH, 'not json at all')
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    write('packages/agent/src/a.ts', 'edited\n')

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('carries no absolute path in its error text', async () => {
    write(DEFAULT_COVERAGE_PATH, 'not json at all')
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.error?.message ?? '').not.toContain(repo)
    expect(result.summary).not.toContain(repo)
  })
})

describe('deriveCoverage — freshness', () => {
  it('reports stale when production code moved on, whatever the percentage', async () => {
    writeSummary(95)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    write('packages/agent/src/b.ts')
    commit(['packages/agent/src/b.ts'], 'later code', '2026-03-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('stale')
    expect(result.value).toBe(95)
  })

  it('reports stale when a production path is dirty', async () => {
    writeSummary(95)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    write('packages/agent/src/a.ts', 'edited\n')

    expect((await derive()).status).toBe('stale')
  })

  it('treats an uncommitted artifact as current when production code is clean', async () => {
    writeSummary(95)

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.at).toBe(NOW)
    expect(result.evidence).toEqual({ path: DEFAULT_COVERAGE_PATH, commit: null })
  })

  it('stays current when only documentation moved on', async () => {
    writeSummary(95)
    commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')
    write('docs/notes.md')
    commit(['docs/notes.md'], 'docs', '2026-03-01T00:00:00Z')

    expect((await derive()).status).toBe('ok')
  })

  it('does not age itself against its own artifact', async () => {
    writeSummary(95)
    const sha = commit([DEFAULT_COVERAGE_PATH], 'coverage', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.evidence?.commit).toBe(sha)
  })
})
