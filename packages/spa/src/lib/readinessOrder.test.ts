import { describe, expect, it } from 'vitest'
import {
  CHECK_IDS,
  computeReady,
  type CheckId,
  type CheckResult,
  type CheckStatus,
  type RepoSummary,
} from '@agenticapps/dashboard-shared'

import { compareRepoSeverity } from './readinessOrder.js'

/**
 * A wire-legal result. `never` and `na` carry no observed time and no evidence,
 * and an error-bearing result must be `fail` — the schema refuses anything else,
 * so the fixtures honour it rather than producing a shape the daemon cannot send.
 */
function result(
  id: CheckId,
  status: CheckStatus,
  over: Partial<CheckResult> = {},
): CheckResult {
  const timeless = status === 'never' || status === 'na'
  return {
    id,
    status,
    source: 'derived',
    at: timeless ? null : Date.UTC(2026, 6, 30, 9, 15),
    value: null,
    threshold: null,
    summary: status === 'na' ? 'this host cannot pin a version' : '',
    evidence: null,
    error: null,
    ...over,
  }
}

/** An evaluation error. The schema forces these to carry status `fail`. */
function errored(id: CheckId): CheckResult {
  return result(id, 'fail', {
    error: { code: 'scan-failed', message: 'the deriver threw' },
  })
}

/**
 * Six results in `CHECK_IDS` order, `ok` unless the caller names a status for
 * that check. `checks` is a fixed six-tuple on the wire; the fixture keeps it so.
 */
function repo(
  id: string,
  over: {
    statuses?: Partial<Record<CheckId, CheckStatus>>
    errors?: readonly CheckId[]
    lastCommitAt?: number | null
  } = {},
): RepoSummary {
  const errors = new Set(over.errors ?? [])
  const checks = CHECK_IDS.map((checkId) =>
    errors.has(checkId)
      ? errored(checkId)
      : result(checkId, over.statuses?.[checkId] ?? 'ok'),
  ) as unknown as RepoSummary['checks']

  return {
    id,
    name: id,
    family: 'agenticapps',
    ready: computeReady(checks),
    lastCommitAt: over.lastCommitAt === undefined ? Date.UTC(2026, 6, 30) : over.lastCommitAt,
    checks,
    notice: null,
  }
}

/** The ids in the order the comparator puts them, which is what callers see. */
function order(repos: readonly RepoSummary[]): string[] {
  return [...repos].sort(compareRepoSeverity).map((entry) => entry.id)
}

describe('compareRepoSeverity', () => {
  it('ranks more evaluation errors first', () => {
    const one = repo('one-error', { errors: ['spec'] })
    const two = repo('two-errors', { errors: ['spec', 'coverage'] })

    expect(order([one, two])).toEqual(['two-errors', 'one-error'])
  })

  it('excludes error-bearing results from the ordinary fail count', () => {
    // Both repos have one `fail` status. One of them is an evaluation error,
    // which is a strictly higher key — so it must not also count as a fail,
    // or the two keys would double-count the same cell.
    const evaluation = repo('evaluation-error', { errors: ['spec'] })
    const genuine = repo('two-real-fails', {
      statuses: { spec: 'fail', coverage: 'fail' },
    })

    expect(order([genuine, evaluation])).toEqual([
      'evaluation-error',
      'two-real-fails',
    ])
  })

  it('breaks an error tie on the count of non-error fail', () => {
    const fewer = repo('one-fail', {
      errors: ['spec'],
      statuses: { coverage: 'fail' },
    })
    const more = repo('two-fails', {
      errors: ['spec'],
      statuses: { coverage: 'fail', 'pen-test': 'fail' },
    })

    expect(order([fewer, more])).toEqual(['two-fails', 'one-fail'])
  })

  it('orders stale ahead of never at equal fail counts', () => {
    // The named spec scenario: evidence once believed current is more urgent
    // than evidence never claimed.
    const stale = repo('stale-review', {
      statuses: { 'security-review': 'stale' },
    })
    const never = repo('never-reviewed', {
      statuses: { 'security-review': 'never' },
    })

    expect(order([never, stale])).toEqual(['stale-review', 'never-reviewed'])
  })

  it('orders never ahead of warn', () => {
    const never = repo('never-run', { statuses: { 'pen-test': 'never' } })
    const warn = repo('warned', { statuses: { 'pen-test': 'warn' } })

    expect(order([warn, never])).toEqual(['never-run', 'warned'])
  })

  it('falls back to the most recent committer time when every count ties', () => {
    const older = repo('older', { lastCommitAt: Date.UTC(2026, 5, 1) })
    const newer = repo('newer', { lastCommitAt: Date.UTC(2026, 6, 1) })

    expect(order([older, newer])).toEqual(['newer', 'older'])
  })

  it('sorts a null committer time after every observed one', () => {
    const unknown = repo('unknown-time', { lastCommitAt: null })
    const ancient = repo('ancient', { lastCommitAt: 0 })

    expect(order([unknown, ancient])).toEqual(['ancient', 'unknown-time'])
  })

  it('breaks a total tie on the repo id, ascending', () => {
    const b = repo('beta')
    const a = repo('alpha')

    expect(order([b, a])).toEqual(['alpha', 'beta'])
  })

  it('is a total order — the result does not depend on input order', () => {
    const repos = [
      repo('warned', { statuses: { 'pen-test': 'warn' } }),
      repo('errored', { errors: ['spec'] }),
      repo('clean-newer', { lastCommitAt: Date.UTC(2026, 6, 2) }),
      repo('failing', { statuses: { coverage: 'fail' } }),
      repo('stale', { statuses: { 'security-review': 'stale' } }),
      repo('clean-older', { lastCommitAt: Date.UTC(2026, 5, 2) }),
      repo('nevered', { statuses: { 'pen-test': 'never' } }),
    ]
    const expected = [
      'errored',
      'failing',
      'stale',
      'nevered',
      'warned',
      'clean-newer',
      'clean-older',
    ]

    expect(order(repos)).toEqual(expected)
    expect(order([...repos].reverse())).toEqual(expected)
  })

  it('returns zero only for a repo compared with itself', () => {
    const one = repo('alpha')
    const other = repo('beta')

    expect(compareRepoSeverity(one, one)).toBe(0)
    expect(compareRepoSeverity(one, other)).toBeLessThan(0)
    expect(compareRepoSeverity(other, one)).toBeGreaterThan(0)
  })
})
