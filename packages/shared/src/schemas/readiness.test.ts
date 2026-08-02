import { describe, expect, it } from 'vitest'

import {
  CHECK_IDS,
  CheckIdSchema,
  CheckResultSchema,
  CheckStatusSchema,
  FleetResponseSchema,
  ReadinessFileSchema,
  RepoDetailResponseSchema,
  RepoDetailSchema,
  RepoRelativePathSchema,
  RepoSummarySchema,
  computeReady,
  type CheckId,
  type CheckResult,
  type RepoDetail,
  type RepoSummary,
} from './readiness.js'

function result(id: CheckId, over: Partial<CheckResult> = {}): CheckResult {
  return {
    id,
    status: 'never',
    source: 'derived',
    at: null,
    value: null,
    threshold: null,
    summary: 'has never run',
    evidence: null,
    error: null,
    ...over,
  }
}

function sixNever(): RepoSummary['checks'] {
  return CHECK_IDS.map((id) => result(id)) as unknown as RepoSummary['checks']
}

function repo(over: Partial<RepoSummary> = {}): RepoSummary {
  return {
    id: 'agenticapps-dashboard',
    name: 'agenticapps-dashboard',
    family: 'agenticapps',
    ready: false,
    lastCommitAt: 1_753_999_999_000,
    checks: sixNever(),
    notice: null,
    ...over,
  }
}

function detail(over: Partial<RepoDetail> = {}): RepoDetail {
  return {
    ...repo(),
    checks: CHECK_IDS.map((id) => ({
      ...result(id),
      remedy: 'Run the check.',
    })) as unknown as RepoDetail['checks'],
    ...over,
  }
}

describe('CHECK_IDS', () => {
  it('is exactly six ids in the fixed order', () => {
    expect([...CHECK_IDS]).toEqual([
      'workflow',
      'spec',
      'code-review',
      'security-review',
      'pen-test',
      'coverage',
    ])
  })

  it('rejects an identifier outside the six', () => {
    expect(CheckIdSchema.safeParse('lint').success).toBe(false)
  })
})

describe('CheckStatusSchema', () => {
  it.each(['ok', 'warn', 'fail', 'stale', 'never', 'na'])(
    'accepts %s',
    (status) => {
      expect(CheckStatusSchema.safeParse(status).success).toBe(true)
    },
  )

  it('rejects a status outside the vocabulary', () => {
    expect(CheckStatusSchema.safeParse('passing').success).toBe(false)
  })
})

describe('CheckResultSchema', () => {
  it('accepts a derived result', () => {
    expect(CheckResultSchema.safeParse(result('coverage')).success).toBe(true)
  })

  it('requires source on every result', () => {
    const { source: _source, ...withoutSource } = result('coverage')
    expect(CheckResultSchema.safeParse(withoutSource).success).toBe(false)
  })

  it.each(['at', 'value', 'threshold', 'evidence', 'error'])(
    'requires the nullable field %s to be present',
    (field) => {
      const withoutField: Record<string, unknown> = { ...result('coverage') }
      delete withoutField[field]
      expect(CheckResultSchema.safeParse(withoutField).success).toBe(false)
    },
  )

  it('rejects an unknown field', () => {
    expect(
      CheckResultSchema.safeParse({ ...result('coverage'), score: 82 }).success,
    ).toBe(false)
  })

  /**
   * `at` is fed from a git committer time, and a repo with a corrupt commit
   * date can carry one past the range `Date` can represent. Every surface that
   * renders a time calls `new Date(at).toISOString()`, which throws a
   * RangeError beyond +275760-09-13 — during render, with no error boundary
   * anywhere in the SPA. One bad commit in one registered repo would blank the
   * whole fleet route, which inverts the settled-per-repo degradation this
   * feature is built on. The bound belongs here, where it protects every
   * consumer, rather than in each component that formats a date.
   */
  it('rejects an observed time beyond the range a Date can represent', () => {
    const MAX_DATE_MS = 8_640_000_000_000_000
    expect(
      CheckResultSchema.safeParse(
        result('coverage', { status: 'ok', at: MAX_DATE_MS }),
      ).success,
    ).toBe(true)
    expect(
      CheckResultSchema.safeParse(
        result('coverage', { status: 'ok', at: MAX_DATE_MS + 1 }),
      ).success,
    ).toBe(false)
  })

  it('accepts an ok result carrying a value, threshold and evidence', () => {
    const parsed = CheckResultSchema.safeParse(
      result('coverage', {
        status: 'ok',
        at: 1_753_000_000_000,
        value: 91.4,
        threshold: 80,
        summary: 'lines 91.4% at or above the 80% threshold',
        evidence: {
          path: 'coverage/coverage-summary.json',
          commit: 'a'.repeat(40),
        },
      }),
    )
    expect(parsed.success).toBe(true)
  })

  it('requires an error-bearing result to use status fail', () => {
    const error = { code: 'coverage-unparsable', message: 'not valid JSON' }
    expect(
      CheckResultSchema.safeParse(result('coverage', { status: 'never', error }))
        .success,
    ).toBe(false)
    expect(
      CheckResultSchema.safeParse(
        result('coverage', { status: 'fail', error, summary: 'unparsable' }),
      ).success,
    ).toBe(true)
  })

  it('requires na to carry a reason', () => {
    expect(
      CheckResultSchema.safeParse(result('workflow', { status: 'na', summary: '' }))
        .success,
    ).toBe(false)
    expect(
      CheckResultSchema.safeParse(
        result('workflow', {
          status: 'na',
          summary: 'this host pins no workflow version',
        }),
      ).success,
    ).toBe(true)
  })

  it.each(['never', 'na'] as const)(
    'requires %s to carry null at and evidence',
    (status) => {
      const summary = status === 'na' ? 'not applicable here' : 'has never run'
      expect(
        CheckResultSchema.safeParse(
          result('pen-test', { status, summary, at: 1_753_000_000_000 }),
        ).success,
      ).toBe(false)
      expect(
        CheckResultSchema.safeParse(
          result('pen-test', {
            status,
            summary,
            evidence: { path: 'docs/pen-test.md', commit: null },
          }),
        ).success,
      ).toBe(false)
    },
  )

  it('rejects an error message carrying an absolute filesystem path', () => {
    expect(
      CheckResultSchema.safeParse(
        result('coverage', {
          status: 'fail',
          summary: 'unreadable',
          error: {
            code: 'coverage-unreadable',
            message: 'ENOENT: /Users/someone/repo/coverage/coverage-summary.json',
          },
        }),
      ).success,
    ).toBe(false)
  })

  // The boundary the leak check keys on used to be whitespace, quote or bracket
  // only, so a path pressed straight against a colon walked through it. That is
  // the shape an interpolated message actually takes.
  it('rejects an absolute path that follows a colon with no space', () => {
    expect(
      CheckResultSchema.safeParse(
        result('coverage', {
          status: 'fail',
          summary: 'unreadable',
          error: {
            code: 'coverage-unreadable',
            message: 'resolved to:/Users/someone/repo/coverage-summary.json',
          },
        }),
      ).success,
    ).toBe(false)
  })

  // The counterweight to widening that boundary: a false rejection fails the
  // whole outbound response and shows the schema-drift screen, so the symbolic
  // root and a scheme-relative URL must both survive.
  it.each([
    ['a symbolic home root', 'the skill is missing from ~/.claude/skills'],
    ['a URL', 'see https://example.com/docs/readiness for the format'],
  ])('accepts an error message carrying %s', (_label, message) => {
    expect(
      CheckResultSchema.safeParse(
        result('coverage', {
          status: 'fail',
          summary: 'unreadable',
          error: { code: 'coverage-unreadable', message },
        }),
      ).success,
    ).toBe(true)
  })

  it('accepts an error message carrying a repo-relative path', () => {
    expect(
      CheckResultSchema.safeParse(
        result('coverage', {
          status: 'fail',
          summary: 'unreadable',
          error: {
            code: 'coverage-unreadable',
            message: 'could not read coverage/coverage-summary.json',
          },
        }),
      ).success,
    ).toBe(true)
  })

  it('rejects evidence that escapes the repo', () => {
    expect(
      CheckResultSchema.safeParse(
        result('code-review', {
          status: 'ok',
          at: 1_753_000_000_000,
          evidence: { path: '../other-repo/REVIEW.md', commit: null },
        }),
      ).success,
    ).toBe(false)
  })
})

describe('RepoRelativePathSchema', () => {
  it.each([
    'coverage/coverage-summary.json',
    'openspec/changes/archive/2026-07-31-x/REVIEW.md',
    'REVIEW.md',
  ])('accepts %s', (path) => {
    expect(RepoRelativePathSchema.safeParse(path).success).toBe(true)
  })

  it.each([
    ['an absolute path', '/etc/passwd'],
    ['a traversing path', '../secrets.json'],
    ['an interior traversal', 'openspec/../../secrets.json'],
    ['a home-relative path', '~/.ssh/id_rsa'],
    ['a windows drive path', 'C:\\Windows\\system32'],
    ['a backslash separator', 'openspec\\changes\\REVIEW.md'],
    ['a doubled separator', 'openspec//REVIEW.md'],
    ['a trailing separator', 'openspec/'],
    ['a dot segment', './REVIEW.md'],
    ['an empty path', ''],
    ['a control character', 'REVIEW\u0000.md'],
    ['an unbounded path', `${'a/'.repeat(300)}REVIEW.md`],
  ])('rejects %s', (_label, path) => {
    expect(RepoRelativePathSchema.safeParse(path).success).toBe(false)
  })
})

describe('RepoSummarySchema', () => {
  it('accepts a repo whose six checks have never run', () => {
    const parsed = RepoSummarySchema.safeParse(repo())
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.checks).toHaveLength(6)
  })

  it('rejects a shorter check list', () => {
    const short = sixNever().slice(0, 5)
    expect(RepoSummarySchema.safeParse(repo({ checks: short as never })).success).toBe(
      false,
    )
  })

  it('rejects checks in any other order', () => {
    const reordered = [...sixNever()].reverse()
    expect(
      RepoSummarySchema.safeParse(repo({ checks: reordered as never })).success,
    ).toBe(false)
  })

  it('rejects an unknown field', () => {
    expect(
      RepoSummarySchema.safeParse({ ...repo(), score: 62 }).success,
    ).toBe(false)
  })

  it('rejects a ready boolean that disagrees with the six results', () => {
    expect(RepoSummarySchema.safeParse(repo({ ready: true })).success).toBe(false)
  })

  it('accepts a null lastCommitAt', () => {
    expect(RepoSummarySchema.safeParse(repo({ lastCommitAt: null })).success).toBe(
      true,
    )
  })

  it('carries an unusable-readiness-file notice', () => {
    const parsed = RepoSummarySchema.safeParse(
      repo({
        notice: {
          code: 'readiness-file-unsupported-version',
          message: 'the readiness file declares an unsupported schemaVersion',
        },
      }),
    )
    expect(parsed.success).toBe(true)
  })

  it('rejects a notice message carrying an absolute path', () => {
    expect(
      RepoSummarySchema.safeParse(
        repo({
          notice: {
            code: 'readiness-file-unparsable',
            message: '/Users/someone/repo/.agenticapps/readiness.json is not JSON',
          },
        }),
      ).success,
    ).toBe(false)
  })
})

describe('RepoDetailSchema', () => {
  it('accepts a detail whose every check carries a remedy', () => {
    expect(RepoDetailSchema.safeParse(detail()).success).toBe(true)
  })

  it('rejects an empty remedy', () => {
    const checks = detail().checks.map((c, i) => (i === 3 ? { ...c, remedy: '' } : c))
    expect(
      RepoDetailSchema.safeParse(detail({ checks: checks as never })).success,
    ).toBe(false)
  })

  it('rejects a missing remedy', () => {
    const checks = detail().checks.map((c, i) => {
      if (i !== 0) return c
      const { remedy: _remedy, ...withoutRemedy } = c
      return withoutRemedy
    })
    expect(
      RepoDetailSchema.safeParse(detail({ checks: checks as never })).success,
    ).toBe(false)
  })
})

describe('FleetResponseSchema', () => {
  it('accepts a generated fleet of summaries', () => {
    expect(
      FleetResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repos: [repo(), repo({ id: 'other', name: 'other' })],
      }).success,
    ).toBe(true)
  })

  it('accepts an empty fleet', () => {
    expect(
      FleetResponseSchema.safeParse({ generatedAt: 1_754_000_000_000, repos: [] })
        .success,
    ).toBe(true)
  })

  it('requires generatedAt', () => {
    expect(FleetResponseSchema.safeParse({ repos: [] }).success).toBe(false)
  })

  it('rejects an unknown top-level field', () => {
    expect(
      FleetResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repos: [],
        count: 0,
      }).success,
    ).toBe(false)
  })

  it('rejects a repo carrying a remedy — the fleet is the summary shape', () => {
    expect(
      FleetResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repos: [detail()],
      }).success,
    ).toBe(false)
  })
})

describe('RepoDetailResponseSchema', () => {
  it('accepts a generated detail', () => {
    expect(
      RepoDetailResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repo: detail(),
      }).success,
    ).toBe(true)
  })

  it('requires generatedAt', () => {
    expect(RepoDetailResponseSchema.safeParse({ repo: detail() }).success).toBe(
      false,
    )
  })

  it('rejects a summary without remedies', () => {
    expect(
      RepoDetailResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repo: repo(),
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown top-level field', () => {
    expect(
      RepoDetailResponseSchema.safeParse({
        generatedAt: 1_754_000_000_000,
        repo: detail(),
        stale: false,
      }).success,
    ).toBe(false)
  })
})

describe('computeReady', () => {
  const ok = (id: CheckId) => result(id, { status: 'ok', summary: 'current' })
  const warn = (id: CheckId) => result(id, { status: 'warn', summary: 'trails' })
  const na = (id: CheckId) => result(id, { status: 'na', summary: 'not applicable' })

  it('is false when any check has never run', () => {
    expect(computeReady(sixNever())).toBe(false)
  })

  it.each(['fail', 'stale', 'never'] as const)(
    'is false when one check is %s',
    (status) => {
      const checks = CHECK_IDS.map((id, i) =>
        i === 2
          ? result(id, { status, summary: 'blocking', at: status === 'never' ? null : 1 })
          : ok(id),
      )
      expect(computeReady(checks)).toBe(false)
    },
  )

  it('is false when a check carries an evaluation error', () => {
    const checks = CHECK_IDS.map((id, i) =>
      i === 5
        ? result(id, {
            status: 'fail',
            summary: 'could not evaluate',
            error: { code: 'coverage-unreadable', message: 'unreadable artifact' },
          })
        : ok(id),
    )
    expect(computeReady(checks)).toBe(false)
  })

  it('is false when every check is not applicable', () => {
    expect(computeReady(CHECK_IDS.map(na))).toBe(false)
  })

  it('is true when only ok, warn and na results are present', () => {
    const checks = CHECK_IDS.map((id, i) =>
      i === 0 ? na(id) : i === 1 ? warn(id) : ok(id),
    )
    expect(computeReady(checks)).toBe(true)
  })

  it('is true when the one applicable check is a warning', () => {
    const checks = CHECK_IDS.map((id, i) => (i === 4 ? warn(id) : na(id)))
    expect(computeReady(checks)).toBe(true)
  })

  it('returns a boolean rather than a score', () => {
    expect(typeof computeReady(sixNever())).toBe('boolean')
  })
})

describe('ReadinessFileSchema', () => {
  const declaredPenTest = {
    id: 'pen-test',
    status: 'ok',
    observedAt: '2026-07-01T09:00:00Z',
    validUntil: '2027-07-01T09:00:00Z',
    evidence: 'docs/security/pen-test-2026-07.md',
    commit: 'b'.repeat(40),
  }

  it('accepts a file declaring nothing but its version', () => {
    expect(ReadinessFileSchema.safeParse({ schemaVersion: 1 }).success).toBe(true)
  })

  it('rejects an unsupported schemaVersion', () => {
    expect(ReadinessFileSchema.safeParse({ schemaVersion: 2 }).success).toBe(false)
  })

  it('rejects an unknown top-level field', () => {
    expect(
      ReadinessFileSchema.safeParse({ schemaVersion: 1, tier: 'b' }).success,
    ).toBe(false)
  })

  it('discards an entry whose check id is unknown', () => {
    const parsed = ReadinessFileSchema.safeParse({
      schemaVersion: 1,
      checks: [
        { id: 'accessibility-audit', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
        declaredPenTest,
      ],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.checks).toHaveLength(1)
    expect(parsed.success && parsed.data.checks?.[0]?.id).toBe('pen-test')
  })

  it('rejects an unknown field inside a recognised entry', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [{ ...declaredPenTest, auditor: 'someone' }],
      }).success,
    ).toBe(false)
  })

  it.each([
    ['a missing observedAt', { ...declaredPenTest, observedAt: undefined }],
    ['a date-only observedAt', { ...declaredPenTest, observedAt: '2026-07-01' }],
    ['a missing validUntil', { ...declaredPenTest, validUntil: undefined }],
    ['a missing evidence path', { ...declaredPenTest, evidence: undefined }],
    ['an escaping evidence path', { ...declaredPenTest, evidence: '../elsewhere.md' }],
    ['a missing commit', { ...declaredPenTest, commit: undefined }],
    ['a short commit', { ...declaredPenTest, commit: 'b'.repeat(7) }],
  ])('rejects the whole file for %s', (_label, entry) => {
    expect(
      ReadinessFileSchema.safeParse({ schemaVersion: 1, checks: [entry] }).success,
    ).toBe(false)
  })

  it.each(['ok', 'warn', 'fail'])('accepts a declared pen-test of %s', (status) => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [{ ...declaredPenTest, status }],
      }).success,
    ).toBe(true)
  })

  it.each(['na', 'stale', 'never'])(
    'rejects a declared pen-test of %s',
    (status) => {
      expect(
        ReadinessFileSchema.safeParse({
          schemaVersion: 1,
          checks: [{ ...declaredPenTest, status }],
        }).success,
      ).toBe(false)
    },
  )

  it('requires a declared na to carry a reason', () => {
    const entry = {
      id: 'workflow',
      status: 'na',
      observedAt: '2026-07-01T09:00:00Z',
    }
    expect(
      ReadinessFileSchema.safeParse({ schemaVersion: 1, checks: [entry] }).success,
    ).toBe(false)
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [{ ...entry, summary: 'this repo ships no code' }],
      }).success,
    ).toBe(true)
  })

  it('requires evidence and a commit on a declared code review', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [
          { id: 'code-review', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
        ],
      }).success,
    ).toBe(false)
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [
          {
            id: 'code-review',
            status: 'ok',
            observedAt: '2026-07-01T09:00:00Z',
            evidence: 'openspec/changes/archive/2026-07-31-x/REVIEW.md',
            commit: 'c'.repeat(40),
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects two entries for the same check', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        checks: [declaredPenTest, { ...declaredPenTest, status: 'fail' }],
      }).success,
    ).toBe(false)
  })

  it('accepts a coverage artifact path and threshold', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        coverage: { path: 'reports/coverage-summary.json', threshold: 75 },
      }).success,
    ).toBe(true)
  })

  it.each([101, -1])('rejects a threshold of %s', (threshold) => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        coverage: { threshold },
      }).success,
    ).toBe(false)
  })

  it('rejects a coverage path that escapes the repo', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        coverage: { path: '../elsewhere/coverage-summary.json' },
      }).success,
    ).toBe(false)
  })

  it('accepts bounded production path configuration', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        productionPaths: { include: ['packages/**'], ignore: ['packages/**/*.md'] },
      }).success,
    ).toBe(true)
  })

  it('rejects an unbounded production path list', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        productionPaths: { include: Array.from({ length: 101 }, (_, i) => `p${i}/**`) },
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown field inside the coverage configuration', () => {
    expect(
      ReadinessFileSchema.safeParse({
        schemaVersion: 1,
        coverage: { threshold: 80, reporter: 'json-summary' },
      }).success,
    ).toBe(false)
  })
})
