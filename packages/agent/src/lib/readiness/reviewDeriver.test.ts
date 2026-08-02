import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readGitFacts } from './gitFacts.js'
import { resolveProductionScope } from './productionScope.js'
import { derivePenTest, deriveReview, type ReviewCheckId } from './reviewDeriver.js'

const COVERAGE_PATH = 'coverage/coverage-summary.json'
const NOW = Date.parse('2026-07-31T12:00:00Z')

const PASSING_REVIEW = '---\nverdict: PASS\nblocking_open: 0\n---\n\nAll good.\n'
const PASSING_SECURITY = '---\nverdict: PASS\n---\n\nNo findings.\n'

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

function commit(files: string[], message: string, date: string): string {
  git(['add', ...files])
  git(['commit', '-m', message], date)
  return git(['rev-parse', 'HEAD']).trim()
}

async function derive(
  checkId: ReviewCheckId,
  configured?: { include?: string[]; ignore?: string[] },
) {
  const scope = configured
    ? resolveProductionScope({ coveragePath: COVERAGE_PATH, configured })
    : resolveProductionScope({ coveragePath: COVERAGE_PATH })
  const facts = await readGitFacts(repo)
  return deriveReview({ root: repo, checkId, scope, facts, now: NOW })
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'readiness-review-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('deriveReview — discovery', () => {
  it('reports never when no artifact exists in either layout', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.status).toBe('never')
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
  })

  it('finds an OpenSpec artifact and reports ok when it is current', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    const sha = commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.status).toBe('ok')
    expect(result.evidence).toEqual({ path: 'openspec/changes/one/REVIEW.md', commit: sha })
    expect(result.at).toBe(Date.parse('2026-02-01T00:00:00Z'))
  })

  it('counts evidence inside an archived change', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/archive/2026-01-09-one/REVIEW.md', PASSING_REVIEW)
    commit(
      ['openspec/changes/archive/2026-01-09-one/REVIEW.md'],
      'archived review',
      '2026-02-01T00:00:00Z',
    )

    const result = await derive('code-review')
    expect(result.status).toBe('ok')
    expect(result.evidence?.path).toBe('openspec/changes/archive/2026-01-09-one/REVIEW.md')
  })

  it('prefers an OpenSpec artifact over a newer legacy one', async () => {
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'openspec review', '2026-01-01T00:00:00Z')
    write('.planning/phases/01/CODE-REVIEW.md', PASSING_REVIEW)
    commit(['.planning/phases/01/CODE-REVIEW.md'], 'legacy review', '2026-06-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.evidence?.path).toBe('openspec/changes/one/REVIEW.md')
  })

  it('falls back to the legacy layout when no OpenSpec artifact exists', async () => {
    write('.planning/phases/01/CODE-REVIEW.md', PASSING_REVIEW)
    commit(['.planning/phases/01/CODE-REVIEW.md'], 'legacy review', '2026-01-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.evidence?.path).toBe('.planning/phases/01/CODE-REVIEW.md')
  })

  it('selects the latest candidate, breaking ties by ascending path', async () => {
    write('openspec/changes/b/REVIEW.md', PASSING_REVIEW)
    write('openspec/changes/a/REVIEW.md', PASSING_REVIEW)
    commit(
      ['openspec/changes/a/REVIEW.md', 'openspec/changes/b/REVIEW.md'],
      'two reviews',
      '2026-01-01T00:00:00Z',
    )

    const result = await derive('code-review')
    expect(result.evidence?.path).toBe('openspec/changes/a/REVIEW.md')
  })

  it('selects the newest candidate when timestamps differ', async () => {
    write('openspec/changes/a/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/a/REVIEW.md'], 'older', '2026-01-01T00:00:00Z')
    write('openspec/changes/b/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/b/REVIEW.md'], 'newer', '2026-03-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.evidence?.path).toBe('openspec/changes/b/REVIEW.md')
  })

  it.each([
    ['code-review', 'openspec/changes/one/SECURITY.md', PASSING_SECURITY],
    ['security-review', 'openspec/changes/one/REVIEW.md', PASSING_REVIEW],
  ] as const)(
    'does not let %s be satisfied by the other check evidence',
    async (checkId, path, body) => {
      write(path, body)
      commit([path], 'other evidence', '2026-01-01T00:00:00Z')

      expect((await derive(checkId)).status).toBe('never')
    },
  )
})

describe('deriveReview — verdicts', () => {
  async function withCodeReview(body: string) {
    write('openspec/changes/one/REVIEW.md', body)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    return derive('code-review')
  }

  it('reports fail for a recognised failing verdict, without an evaluation error', async () => {
    const result = await withCodeReview('---\nverdict: REQUEST-CHANGES\nblocking_open: 2\n---\n')
    expect(result.status).toBe('fail')
    expect(result.error).toBeNull()
  })

  it('reports fail when a passing verdict still carries open blockers', async () => {
    const result = await withCodeReview('---\nverdict: PASS\nblocking_open: 3\n---\n')
    expect(result.status).toBe('fail')
    expect(result.error).toBeNull()
  })

  it('carries an evaluation error when the verdict is missing', async () => {
    const result = await withCodeReview('---\nreviewer: someone\n---\n\nLooks fine.\n')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('carries an evaluation error when there is no frontmatter at all', async () => {
    const result = await withCodeReview('Looks fine to me.\n')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('carries an evaluation error for an unrecognised verdict', async () => {
    const result = await withCodeReview('---\nverdict: MAYBE\nblocking_open: 0\n---\n')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('carries an evaluation error when blocking_open is absent', async () => {
    const result = await withCodeReview('---\nverdict: PASS\n---\n')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  // The dangerous shape: a key with no value parses to '', which is not
  // undefined, and Number('') is a finite 0. A malformed artifact therefore read
  // as "zero blocking issues" and the check passed — the one outcome a blocker
  // gate must never produce by accident.
  it('carries an evaluation error when blocking_open is present but empty', async () => {
    const result = await withCodeReview('---\nverdict: PASS\nblocking_open:\n---\n')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  // `Number.isFinite` accepted anything that coerced, and only `> 0` failed, so
  // a count that is not a count at all read as "no blocking issues". A negative
  // is the sharp case: it is nonsense, and it passed.
  it.each([
    ['a negative count', '-1'],
    ['a fractional count', '1.5'],
    ['an exponent', '1e2'],
    ['a hex literal', '0x0'],
  ])('carries an evaluation error for %s', async (_label, value) => {
    const result = await withCodeReview(
      `---\nverdict: PASS\nblocking_open: ${value}\n---\n`,
    )
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('still accepts a plain zero', async () => {
    const result = await withCodeReview('---\nverdict: PASS\nblocking_open: 0\n---\n')
    expect(result.status).toBe('ok')
    expect(result.error).toBeNull()
  })

  it('accepts the legacy stage_2_verdict key for a code review', async () => {
    const result = await withCodeReview('---\nstage_2_verdict: APPROVE\nblocking_open: 0\n---\n')
    expect(result.status).toBe('ok')
    expect(result.error).toBeNull()
  })

  it('never reports ok from artifact presence alone', async () => {
    const result = await withCodeReview('---\n---\n')
    expect(result.status).not.toBe('ok')
  })

  it('treats a security artifact carrying only stage_2_verdict as malformed', async () => {
    write('openspec/changes/one/SECURITY.md', '---\nstage_2_verdict: PASS\n---\n')
    commit(['openspec/changes/one/SECURITY.md'], 'security', '2026-02-01T00:00:00Z')

    const result = await derive('security-review')
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('reports fail when a passing security artifact still lists an open finding', async () => {
    write(
      'openspec/changes/one/SECURITY.md',
      '---\nverdict: PASS\n---\n\n- finding: token log\n  status: OPEN\n',
    )
    commit(['openspec/changes/one/SECURITY.md'], 'security', '2026-02-01T00:00:00Z')

    const result = await derive('security-review')
    expect(result.status).toBe('fail')
    expect(result.error).toBeNull()
  })

  it('accepts a security artifact whose findings are all resolved', async () => {
    write(
      'openspec/changes/one/SECURITY.md',
      '---\nverdict: PASS\n---\n\n- finding: token log\n  status: RESOLVED\n',
    )
    commit(['openspec/changes/one/SECURITY.md'], 'security', '2026-02-01T00:00:00Z')

    expect((await derive('security-review')).status).toBe('ok')
  })
})

describe('deriveReview — freshness', () => {
  it('reports stale when the artifact predates the last production commit', async () => {
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-01-01T00:00:00Z')
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'later code', '2026-02-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.status).toBe('stale')
    expect(result.error).toBeNull()
  })

  it('stays ok when the commits since the review touched only documentation', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    write('docs/notes.md')
    write('README.md')
    write(COVERAGE_PATH, '{}\n')
    commit(['docs/notes.md', 'README.md', COVERAGE_PATH], 'docs', '2026-03-01T00:00:00Z')

    expect((await derive('code-review')).status).toBe('ok')
  })

  it('reports stale when a production path is dirty', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    write('packages/agent/src/a.ts', 'edited\n')

    expect((await derive('code-review')).status).toBe('stale')
  })

  it('reports stale when a production path is untracked', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    write('packages/agent/src/brand-new.ts')

    expect((await derive('code-review')).status).toBe('stale')
  })

  it('stays ok when only a documentation path is dirty', async () => {
    write('packages/agent/src/a.ts')
    write('docs/notes.md')
    commit(['packages/agent/src/a.ts', 'docs/notes.md'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    write('docs/notes.md', 'edited\n')

    expect((await derive('code-review')).status).toBe('ok')
  })

  it('treats an uncommitted artifact as current when production code is clean', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)

    const result = await derive('code-review')
    expect(result.status).toBe('ok')
    expect(result.evidence).toEqual({ path: 'openspec/changes/one/REVIEW.md', commit: null })
    expect(result.at).toBe(NOW)
  })

  it('treats an uncommitted artifact as stale when production code is dirty', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    write('packages/agent/src/a.ts', 'edited\n')

    expect((await derive('code-review')).status).toBe('stale')
  })

  it('does not age a failing verdict into stale', async () => {
    write('openspec/changes/one/REVIEW.md', '---\nverdict: FAIL\nblocking_open: 1\n---\n')
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-01-01T00:00:00Z')
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'later code', '2026-02-01T00:00:00Z')

    expect((await derive('code-review')).status).toBe('fail')
  })

  it('honours a declared production scope and says so in the summary', async () => {
    write('packages/agent/src/a.ts')
    write('scripts/build.sh')
    commit(['packages/agent/src/a.ts', 'scripts/build.sh'], 'code', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')
    // Outside the declared include set, so it must not age the review.
    write('scripts/build.sh', 'edited\n')

    const result = await derive('code-review', { include: ['packages/**'] })
    expect(result.status).toBe('ok')
    expect(result.summary).toContain('packages/**')
    expect(result.summary.toLowerCase()).toContain('declar')
  })

  it('carries no absolute path in its summary or error text', async () => {
    write('openspec/changes/one/REVIEW.md', '---\nverdict: MAYBE\n---\n')
    commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-02-01T00:00:00Z')

    const result = await derive('code-review')
    expect(result.summary).not.toContain(repo)
    expect(result.error?.message ?? '').not.toContain(repo)
  })
})

describe('derivePenTest', () => {
  it('always reports never, with no evidence and no tool name', () => {
    const result = derivePenTest()
    expect(result.status).toBe('never')
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
    expect(result.summary).toMatch(/readiness file/i)
    expect(result.summary.toLowerCase()).not.toMatch(/burp|zap|nessus|metasploit|pentest-tools/)
  })
})
