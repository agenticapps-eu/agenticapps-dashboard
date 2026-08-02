/**
 * The verdict disclosure, tested directly rather than only through the two
 * pages that render it.
 *
 * The advisory set has one member today, so the page tests can only ever
 * exercise the single-name branch. The spec requires the wording to be derived
 * from the set — "no check is left undisclosed because the wording was written
 * for a single check" — and that requirement is forward-pinning: its scenario
 * describes a set the invariant cannot produce yet. These are the only tests
 * that touch it, and without them the multi-member branch ships unexecuted.
 */
import { describe, expect, it } from 'vitest'
import { CHECK_IDS, type CheckId, type CheckResult } from '@agenticapps/dashboard-shared'

import { excludedFromVerdict, exclusionPhrase } from './ReadinessIndicator.js'

function check(id: CheckId, over: Partial<CheckResult> = {}): CheckResult {
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

describe('excludedFromVerdict', () => {
  it('names an undeclared advisory check on a ready repo', () => {
    const checks = CHECK_IDS.map((id) =>
      id === 'pen-test' ? check(id) : check(id, { status: 'ok', at: 1 }),
    )
    expect(excludedFromVerdict(true, checks)).toEqual(['pen-test'])
  })

  it('names nothing when the repo is not ready', () => {
    // A verdict that already withholds itself has nothing to qualify, and this
    // early return is also what makes it safe for this function not to consult
    // the readiness-file notice the way computeReady does.
    const checks = CHECK_IDS.map((id) => check(id))
    expect(excludedFromVerdict(false, checks)).toEqual([])
  })

  it('does not name a declared advisory check', () => {
    const checks = CHECK_IDS.map((id) =>
      id === 'pen-test'
        ? check(id, { status: 'ok', source: 'declared', at: 1 })
        : check(id, { status: 'ok', at: 1 }),
    )
    expect(excludedFromVerdict(true, checks)).toEqual([])
  })

  it('does not name a derivable check that has never run', () => {
    // `coverage` reporting never is a measurement — the deriver looked and found
    // no artifact — so it blocks rather than being excluded, and the repo would
    // not be ready anyway.
    const checks = CHECK_IDS.map((id) =>
      id === 'coverage' ? check(id) : check(id, { status: 'ok', at: 1 }),
    )
    expect(excludedFromVerdict(true, checks)).toEqual([])
  })
})

describe('exclusionPhrase', () => {
  it('is null when nothing is excluded', () => {
    expect(exclusionPhrase([])).toBeNull()
  })

  it('names one check', () => {
    expect(exclusionPhrase(['pen-test'])).toBe('excludes pen test')
  })

  // Forward-pinning: the advisory set cannot hold two members until a second
  // declared-only check exists, but the wording must already be built from the
  // set rather than written for one name.
  it('names two checks without dropping either', () => {
    expect(exclusionPhrase(['pen-test', 'security-review'])).toBe(
      'excludes pen test and security review',
    )
  })

  it('names three checks as a list', () => {
    expect(exclusionPhrase(['pen-test', 'security-review', 'coverage'])).toBe(
      'excludes pen test, security review and coverage',
    )
  })
})
