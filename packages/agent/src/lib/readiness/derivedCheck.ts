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

/** Longest summary the wire shape accepts; derivers clamp rather than overflow. */
export const MAX_SUMMARY = 600

export const clampSummary = (text: string): string =>
  text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1)}…`
