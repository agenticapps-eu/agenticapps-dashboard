import type { CheckStatus } from '@agenticapps/dashboard-shared'

/**
 * What one deriver returns, before the orchestrator stamps on the check id and
 * provenance. It mirrors the wire shape's nullable fields exactly so that
 * assembling a CheckResult is a merge rather than a translation — a translation
 * layer is where an invented timestamp or a dropped error would get in.
 */
export interface DerivedCheck {
  status: CheckStatus
  /** Epoch milliseconds, or null where there is nothing observed to timestamp. */
  at: number | null
  value: string | number | null
  threshold: number | null
  summary: string
  evidence: { path: string; commit: string | null } | null
  error: { code: string; message: string } | null
}

/**
 * A deriver that can only ever report `never`, for a check the daemon has no
 * signal to observe. This is the structural constraint behind
 * `ADVISORY_WHEN_UNDECLARED`: a member of that set must be unable to return any
 * other status, and the compiler is what establishes it. A test cannot — a
 * deriver returning `never` today and something else on a branch not taken
 * satisfies any finite number of calls while violating the requirement.
 *
 * Giving such a check a real signal means widening its return type here, which
 * is the point at which its membership of the advisory set must be revisited —
 * `UNDERIVABLE_DERIVERS` is what makes that a build failure rather than a note.
 */
export type UnderivableCheck = Omit<DerivedCheck, 'status'> & { status: 'never' }

/** Longest summary the wire shape accepts; derivers clamp rather than overflow. */
export const MAX_SUMMARY = 600

export const clampSummary = (text: string): string =>
  text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1)}…`
