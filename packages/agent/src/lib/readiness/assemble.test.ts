import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  CHECK_IDS,
  CheckResultSchema,
  ReadinessNoticeSchema,
  computeReady,
} from '@agenticapps/dashboard-shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeCoverageResolver } from '../coverageResolver.js'
import type { OpenspecProjectState } from '../openspecReader.js'

import { assembleReadiness, type AssembleReadinessOptions } from './assemble.js'
import { READINESS_FILE_PATH } from './readinessFile.js'

const NOW = Date.parse('2026-07-31T12:00:00Z')
const PASSING_REVIEW = '---\nverdict: PASS\nblocking_open: 0\n---\n\nAll good.\n'

let sandbox: string
let family: string
let machine: string
let repo: string

const skill = (version: string, implementsSpec: string) =>
  `---\nname: agentic-apps-workflow\nversion: ${version}\nimplements_spec: ${implementsSpec}\n---\n`

function put(absolute: string, body: string): void {
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, body)
}

const write = (relative: string, body = 'x\n') => put(join(repo, relative), body)

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

function commit(files: string[], message: string, date: string): string {
  git(['add', ...files])
  git(['commit', '-m', message], date)
  return git(['rev-parse', 'HEAD']).trim()
}

const emptyProject = async (): Promise<OpenspecProjectState> => ({
  present: false,
  openChanges: [],
  capabilities: [],
  archived: [],
})

function options(over: Partial<AssembleReadinessOptions> = {}): AssembleReadinessOptions {
  return {
    root: repo,
    now: NOW,
    sources: {
      hostRepos: { claude: join(family, 'claude-workflow') },
      machineSkillRoots: {},
    },
    resolve: makeCoverageResolver({ sourcecodeRoot: sandbox }),
    readProject: emptyProject,
    ...over,
  }
}

/**
 * Writes the declaration file *and* any evidence it cites. A declaration whose
 * evidence cannot be opened now invalidates the whole file, so a fixture that
 * cited a path it never created was testing the unusable-file path while
 * claiming to test precedence. Tests that mean to exercise missing evidence say
 * so by not going through this helper.
 */
const declare = (checks: unknown[], extra: Record<string, unknown> = {}) => {
  for (const check of checks) {
    const cited = (check as { evidence?: unknown }).evidence
    if (typeof cited === 'string' && cited !== '') write(cited)
  }
  write(READINESS_FILE_PATH, JSON.stringify({ schemaVersion: 1, ...extra, checks }))
}

const byId = (checks: Awaited<ReturnType<typeof assembleReadiness>>['checks'], id: string) =>
  checks.find((check) => check.id === id)!

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-assemble-'))
  family = join(sandbox, 'agenticapps')
  machine = join(sandbox, 'machine')
  repo = join(family, 'a-project')
  mkdirSync(repo, { recursive: true })
  mkdirSync(machine, { recursive: true })
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
  put(join(family, 'claude-workflow', 'skill', 'SKILL.md'), skill('3.2.0', '1.0.0'))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('assembleReadiness — shape', () => {
  it('returns six results in the fixed order whatever the repo holds', async () => {
    const result = await assembleReadiness(options())
    expect(result.checks.map((check) => check.id)).toEqual([...CHECK_IDS])
  })

  it('returns results that satisfy the wire shape', async () => {
    write('packages/a.ts')
    commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')

    const result = await assembleReadiness(options())
    for (const check of result.checks) {
      expect(CheckResultSchema.safeParse(check).success).toBe(true)
    }
  })

  it('is not ready when nothing can be derived, and raises no notice', async () => {
    const result = await assembleReadiness(options())
    expect(result.ready).toBe(false)
    expect(result.notice).toBeNull()
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })
})

describe('assembleReadiness — per-check precedence', () => {
  it('lets a repo declaring only pen-test keep five derived results', async () => {
    declare([
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        validUntil: '2027-07-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'b'.repeat(40),
      },
    ])

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'pen-test').source).toBe('declared')
    expect(byId(result.checks, 'pen-test').status).toBe('ok')
    expect(result.checks.filter((check) => check.source === 'derived')).toHaveLength(5)
    expect(result.notice).toBeNull()
  })

  // The same declaration, minus the file it cites. Nothing about the JSON has
  // changed, so a reader who saw only the declaration would still read `ok` —
  // which is why the citation has to be opened rather than trusted. The refusal
  // is reported on the check that made the claim, and does NOT fall back to the
  // derived value: a refused declaration must not become indistinguishable from
  // one that was never made.
  it('refuses the citing check, with a notice, when declared evidence is not there', async () => {
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: 'docs/pen-test.md',
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')
    expect(penTest.status).toBe('fail')
    expect(penTest.source).toBe('declared')
    expect(penTest.evidence).toBeNull()
    expect(penTest.error?.code).toBe('evidence-unverifiable')
    expect(penTest.error?.message).toContain('docs/pen-test.md')
    expect(result.notice?.code).toBe('readiness-file-invalid')
  })

  /**
   * A repo-relative path may legally contain a colon, and this one spells the
   * shape the outbound guard reads as an interpolated absolute path. Both the
   * check's error and the repo-level notice are built from it, and both are
   * validated on the way out — so before this was fixed the daemon refused its
   * own message and the whole response died with it.
   *
   * The path has to reach the reader, not merely fail to kill the response:
   * it is the only handle on what to fix.
   */
  it('names a colon-bearing citation in the error and keeps the response valid', async () => {
    const cited = 'docs/notes:/Users/x.md'
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: cited,
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')

    expect(penTest.error?.code).toBe('evidence-unverifiable')
    expect(penTest.error?.message).toContain(cited)
    expect(penTest.summary).toContain(cited)
    expect(CheckResultSchema.safeParse(penTest).success).toBe(true)
    expect(ReadinessNoticeSchema.safeParse(result.notice).success).toBe(true)
    expect(result.notice?.message).toContain(cited)
  })

  /**
   * The residual the narrowing does not close. A colon in the *first* segment
   * leaves nothing to tell the citation apart from a leaked absolute path, so
   * the guard still refuses it — and the daemon must therefore substitute text
   * it can certify rather than hand it over and 500.
   *
   * The reference is withheld from the message, never from the surface: the
   * summary is unrestricted and still carries the path in full.
   */
  it('withholds a first-segment colon path from the message but not from the summary', async () => {
    const cited = 'ab:/Users/x.md'
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: cited,
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')

    expect(penTest.error?.code).toBe('evidence-unverifiable')
    expect(penTest.error?.message).not.toContain(cited)
    expect(penTest.summary).toContain(cited)
    expect(CheckResultSchema.safeParse(penTest).success).toBe(true)
    expect(ReadinessNoticeSchema.safeParse(result.notice).success).toBe(true)
    expect(result.notice?.message).not.toContain(cited)
  })

  /**
   * The same outage reached without a colon anywhere. `RepoRelativePathSchema`
   * allows 512 characters, and a citation at that limit renders a 622-character
   * notice against a 600-character field maximum — so the response died on
   * length while the path rule was perfectly happy.
   *
   * Found by review, not by this change's own tests, because the guard was
   * written to certify the path rule rather than the field's schema. It now
   * certifies the schema, which is the only bound that cannot drift from what
   * the boundary actually enforces.
   */
  it('survives a citation at the path length limit, which carries no colon at all', async () => {
    const cited = `${'d/'.repeat(6)}${'a'.repeat(497)}.md`
    expect(cited).toHaveLength(512)
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: cited,
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')

    expect(penTest.error?.code).toBe('evidence-unverifiable')
    expect(CheckResultSchema.safeParse(penTest).success).toBe(true)
    expect(ReadinessNoticeSchema.safeParse(result.notice).success).toBe(true)
  })

  it('honours the other declarations when one citation is unopenable', async () => {
    write('docs/review.md')
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'code-review',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            evidence: 'docs/review.md',
            commit: 'c'.repeat(40),
          },
          { id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
          // Cites nothing that exists.
          {
            id: 'pen-test',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: 'docs/pen-test.md',
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'spec').source).toBe('declared')
    expect(byId(result.checks, 'spec').status).toBe('ok')
    expect(byId(result.checks, 'code-review').source).toBe('declared')
    expect(byId(result.checks, 'pen-test').error?.code).toBe('evidence-unverifiable')
  })

  // The hole this narrowing must not open. Dropping the entry and letting the
  // check fall back to its derived value would put `pen-test` at a derived
  // `never` — which is exactly the shape the advisory exemption excuses — so a
  // repo could reach ready by deleting the evidence behind its own blocking
  // declaration. `notice` is passed as null on purpose: the result has to block
  // on its own, not by leaning on the repo-level notice.
  it('cannot be made readier by deleting the evidence it declared', async () => {
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'pen-test',
            status: 'fail',
            observedAt: '2026-07-01T09:00:00Z',
            validUntil: '2027-07-01T09:00:00Z',
            evidence: 'docs/pen-test.md',
            commit: 'b'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')

    expect(penTest.status).not.toBe('never')
    expect(penTest.error).not.toBeNull()
    expect(result.ready).toBe(false)

    // Self-sufficient: still blocking with the notice taken away, and still
    // blocking when every other check is forced green.
    const allElseOk = result.checks.map((check) =>
      check.id === 'pen-test' ? check : { ...check, status: 'ok' as const, error: null },
    )
    expect(computeReady(allElseOk, null)).toBe(false)
  })

  it('lets a declaration override a worse derived value without a discrepancy warning', async () => {
    declare([{ id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' }])

    const result = await assembleReadiness(options())
    const spec = byId(result.checks, 'spec')
    expect(spec.status).toBe('ok')
    expect(spec.source).toBe('declared')
    expect(spec.error).toBeNull()
    expect(result.notice).toBeNull()
  })

  it('applies no declaration at all when the file is unusable, and says so', async () => {
    write(READINESS_FILE_PATH, '{ not json')

    const result = await assembleReadiness(options())
    expect(result.notice?.code).toBe('readiness-file-unparsable')
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })

  // Narrowing the citation radius must not narrow these. A malformation that puts
  // the file's *structure* in question leaves no trustworthy entry boundary to
  // blame, so it still discards everything.
  it.each([
    ['an unsupported version', JSON.stringify({ schemaVersion: 2 })],
    ['unparsable JSON', '{ not json'],
    [
      'a malformed known entry',
      JSON.stringify({
        schemaVersion: 1,
        checks: [{ id: 'spec', status: 'ok' }],
      }),
    ],
    [
      'an evidence path that escapes by its own shape',
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'code-review',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            evidence: '../elsewhere.md',
            commit: 'c'.repeat(40),
          },
        ],
      }),
    ],
  ])('still discards the whole file for %s', async (_label, body) => {
    write(READINESS_FILE_PATH, body)

    const result = await assembleReadiness(options())
    expect(result.notice).not.toBeNull()
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })

  // Three different places a path violation can be caught, three different
  // costs. The previous spec text claimed the first two behaved alike; they
  // never did.
  it('charges a bad configured coverage path to its own check, not to the file', async () => {
    write('docs/review.md')
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        coverage: { path: 'coverage/nowhere.json' },
        checks: [
          {
            id: 'code-review',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            evidence: 'docs/review.md',
            commit: 'c'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    // The file stays usable and the sound declaration is honoured.
    expect(byId(result.checks, 'code-review').source).toBe('declared')
    expect(result.notice).toBeNull()
  })

  /**
   * The third author-input site, which this change originally missed and a
   * reviewer found: `coverage.path` is author-supplied and lands in five
   * different `readArtifact` error messages. Nothing about the citing-evidence
   * fix touched it, so the coverage check could still refuse its own message and
   * take the response down — a colon-bearing path and an over-long one both.
   */
  it.each([
    // A first-segment colon: the residual the narrowed regex still refuses, and
    // therefore the shape that actually needs the guard here. A path with a
    // directory before the colon — `coverage/out:/Users/x.json` — is accepted by
    // the regex outright and proves nothing about this call site.
    //
    // Length cannot reach this site: the longest suffix these messages append is
    // 44 characters, so a 512-character path yields 556 against a 600 maximum.
    // The notice site is where length bites, and it is covered separately.
    ['a first-segment colon', 'ab:/Users/x.json'],
  ])('keeps the coverage check on the wire when its configured path has %s', async (
    _label,
    coveragePath,
  ) => {
    // The artifact must exist and be unreadable-as-coverage, or `readArtifact`
    // returns `absent` and the error message under test is never built at all.
    write(coveragePath, 'not json')
    write(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, coverage: { path: coveragePath } }),
    )

    const result = await assembleReadiness(options())
    const coverage = byId(result.checks, 'coverage')

    // The error path must actually be reached, or this test proves nothing.
    expect(coverage.status).toBe('fail')
    expect(coverage.error).not.toBeNull()
    expect(CheckResultSchema.safeParse(coverage).success).toBe(true)
  })

  // `error.message` is validated by SanitisedTextSchema on the way out, and a
  // colon followed by a filesystem-looking root is exactly the shape it refuses.
  // A repo-relative path must survive that, or the daemon fails validation on its
  // own correct output and the client gets the schema-drift screen.
  it('produces a refusal message the outbound sanitiser accepts', async () => {
    write(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          {
            id: 'code-review',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            evidence: 'docs/notes:/Users/reviewer/report.md',
            commit: 'c'.repeat(40),
          },
        ],
      }),
    )

    const result = await assembleReadiness(options())
    const review = byId(result.checks, 'code-review')
    expect(review.error?.code).toBe('evidence-unverifiable')
    // The whole result must round-trip the shared schema, message included.
    expect(CheckResultSchema.safeParse(review).success).toBe(true)
    // This assertion is the reverse of what it was. It used to require the path
    // to be dropped, which was the workaround the sanitiser's ambiguity forced:
    // any colon in a citation removed it from the message. That bought safety
    // with the reader's only handle on what to fix, and it did not even work —
    // the notice built from the same path had no guard at all and took the
    // whole fleet response down with it. The guard now separates a citation
    // from a leak, so the path stays.
    expect(review.error?.message).toContain('docs/notes:/Users/reviewer/report.md')
    expect(review.summary).toContain('docs/notes:/Users/reviewer/report.md')
  })

  it('discards an unknown check id and keeps the rest of the file', async () => {
    declare([
      { id: 'accessibility', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      { id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
    ])

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'spec').source).toBe('declared')
    expect(result.notice).toBeNull()
  })

  it('is ready when every check is declared ok', async () => {
    declare([
      { id: 'workflow', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      { id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        evidence: 'docs/review.md',
        commit: 'c'.repeat(40),
      },
      {
        id: 'security-review',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        evidence: 'docs/security.md',
        commit: 'c'.repeat(40),
      },
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        validUntil: '2027-07-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'c'.repeat(40),
      },
      { id: 'coverage', status: 'ok', observedAt: '2026-07-01T09:00:00Z', value: 91.2 },
    ])

    const result = await assembleReadiness(options())
    expect(result.ready).toBe(true)
  })

  // The honest declaration the slot previously had no vocabulary for. An author
  // with no pen test could not say `never` (reserved for the absence of a
  // declaration) and could not say `fail` (which asserts a test ran and demands
  // an artifact for it), so the only option was silence — which does not block.
  it('accepts a declared pen-test of never and blocks on it', async () => {
    declare([{ id: 'pen-test', status: 'never' }])

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')
    expect(penTest.status).toBe('never')
    expect(penTest.source).toBe('declared')
    expect(penTest.at).toBeNull()
    expect(penTest.evidence).toBeNull()
    expect(result.notice).toBeNull()
    expect(result.ready).toBe(false)
  })

  // Same status, same shape, opposite verdict — the difference is `source`, and
  // it is the whole point: "nobody has said" is advisory, "we have said no" is an
  // assertion.
  it('distinguishes a declared never from the derived never it replaces', async () => {
    const undeclared = await assembleReadiness(options())
    expect(byId(undeclared.checks, 'pen-test').status).toBe('never')
    expect(byId(undeclared.checks, 'pen-test').source).toBe('derived')

    declare([{ id: 'pen-test', status: 'never' }])
    const declared = await assembleReadiness(options())
    expect(byId(declared.checks, 'pen-test').status).toBe('never')
    expect(byId(declared.checks, 'pen-test').source).toBe('declared')
  })

  it('accepts a declared pen-test of na and excludes it from the predicate', async () => {
    declare([
      {
        id: 'pen-test',
        status: 'na',
        summary: 'this repo ships no network surface',
      },
    ])

    const result = await assembleReadiness(options())
    const penTest = byId(result.checks, 'pen-test')
    expect(penTest.status).toBe('na')
    expect(penTest.source).toBe('declared')
    expect(penTest.at).toBeNull()
    expect(penTest.evidence).toBeNull()
    expect(penTest.summary).toContain('no network surface')
    expect(result.notice).toBeNull()
  })

  // Previously unreachable: `pen-test` derived a constant `never` and could not
  // be declared `na`, so the predicate honoured this case as a pure-function
  // contract that no repo could actually be in. The declared `na` makes it real.
  it('is not ready when every check including pen-test is na', async () => {
    declare([
      { id: 'workflow', status: 'na', observedAt: '2026-07-01T09:00:00Z', summary: 'n/a' },
      { id: 'spec', status: 'na', observedAt: '2026-07-01T09:00:00Z', summary: 'n/a' },
      {
        id: 'code-review',
        status: 'na',
        observedAt: '2026-07-01T09:00:00Z',
        summary: 'n/a',
        evidence: 'docs/review.md',
        commit: 'c'.repeat(40),
      },
      {
        id: 'security-review',
        status: 'na',
        observedAt: '2026-07-01T09:00:00Z',
        summary: 'n/a',
        evidence: 'docs/security.md',
        commit: 'c'.repeat(40),
      },
      { id: 'pen-test', status: 'na', summary: 'no network surface' },
      { id: 'coverage', status: 'na', observedAt: '2026-07-01T09:00:00Z', summary: 'n/a' },
    ])

    const result = await assembleReadiness(options())
    expect(result.checks.every((check) => check.status === 'na')).toBe(true)
    expect(result.ready).toBe(false)
  })

  it('renders a declared na without a timestamp or evidence, but with its reason', async () => {
    declare([
      {
        id: 'coverage',
        status: 'na',
        observedAt: '2026-07-01T09:00:00Z',
        summary: 'this repo ships no executable code',
      },
    ])

    const result = await assembleReadiness(options())
    const coverage = byId(result.checks, 'coverage')
    expect(coverage.status).toBe('na')
    expect(coverage.at).toBeNull()
    expect(coverage.evidence).toBeNull()
    expect(coverage.summary).toContain('no executable code')
  })
})

describe('assembleReadiness — declared evidence still ages', () => {
  it('turns a declared review stale when production code moved on, keeping its provenance', async () => {
    write('packages/a.ts')
    const reviewed = commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('packages/b.ts')
    commit(['packages/b.ts'], 'later code', '2026-02-01T00:00:00Z')
    declare([
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-01-01T10:00:00Z',
        evidence: 'docs/review.md',
        commit: reviewed,
      },
    ])

    const result = await assembleReadiness(options())
    const review = byId(result.checks, 'code-review')
    expect(review.status).toBe('stale')
    expect(review.source).toBe('declared')
  })

  it('keeps a declared review current when it covers the last production commit', async () => {
    write('packages/a.ts')
    const reviewed = commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    declare([
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-01-01T10:00:00Z',
        evidence: 'docs/review.md',
        commit: reviewed,
      },
    ])
    commit([READINESS_FILE_PATH], 'declare', '2026-01-02T00:00:00Z')

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'code-review').status).toBe('ok')
  })

  it('turns an expired declared pen test stale, keeping its provenance', async () => {
    declare([
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2025-01-01T09:00:00Z',
        validUntil: '2026-01-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'b'.repeat(40),
      },
    ])

    const result = await assembleReadiness(options())
    const pen = byId(result.checks, 'pen-test')
    expect(pen.status).toBe('stale')
    expect(pen.source).toBe('declared')
  })
})

describe('assembleReadiness — degradation', () => {
  it('keeps the other five checks when one deriver throws', async () => {
    const result = await assembleReadiness(
      options({
        readProject: async () => {
          throw new Error('boom')
        },
      }),
    )
    const spec = byId(result.checks, 'spec')
    expect(spec.status).toBe('fail')
    expect(spec.error?.code).toBeTruthy()
    expect(result.checks).toHaveLength(6)
    expect(result.ready).toBe(false)
  })

  it('keeps the other five checks when a deriver throws outright', async () => {
    put(join(repo, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), skill('3.2.0', '1.0.0'))
    const exploding = {
      get hostRepos(): never {
        throw new Error('boom')
      },
      machineSkillRoots: {},
    }

    const result = await assembleReadiness(
      options({ sources: exploding as unknown as AssembleReadinessOptions['sources'] }),
    )
    const workflow = byId(result.checks, 'workflow')
    expect(workflow.status).toBe('fail')
    expect(workflow.error?.code).toBeTruthy()
    expect(result.checks).toHaveLength(6)
    expect(result.checks.filter((check) => check.error === null)).not.toHaveLength(0)
  })

  it('rejects a configured production scope that leaves no production path', async () => {
    write('packages/a.ts')
    commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    declare([], { productionPaths: { include: ['nothing-here/**'] } })

    const result = await assembleReadiness(options())
    expect(result.notice?.code).toBe('readiness-file-invalid')
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })

  it('accepts a configured production scope that still finds production paths', async () => {
    write('packages/a.ts')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['packages/a.ts', 'openspec/changes/one/REVIEW.md'], 'code', '2026-01-01T00:00:00Z')
    declare([], { productionPaths: { include: ['packages/**'] } })

    const result = await assembleReadiness(options())
    expect(result.notice).toBeNull()
    expect(byId(result.checks, 'code-review').status).toBe('ok')
  })
})
