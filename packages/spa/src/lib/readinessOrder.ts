/**
 * readinessOrder.ts — the fixed severity comparison the fleet list is sorted by.
 *
 * The daemon returns repos in registry order and deliberately does not sort:
 * ordering interacts with the filter chips, and a sorting server plus a sorting
 * client eventually disagree in a way nobody notices (design.md §6).
 *
 * This is a comparison over counts, not a score. It produces no number, nothing
 * derived here is rendered, and there is no weighting to tune — the keys are
 * ranked, and a repo that leads on an earlier key wins outright regardless of
 * the later ones. That is the property the "no aggregate score" requirement
 * turns on: a reader can reconstruct any pairwise result by counting cells.
 */
import type { CheckResult, RepoSummary } from '@agenticapps/dashboard-shared'

/** The counts the comparison ranks on, in the order it ranks them. */
type SeverityCounts = readonly [
  errors: number,
  fails: number,
  stale: number,
  never: number,
  warn: number,
]

/**
 * An evaluation error is a strictly higher key than a failing check, and the
 * schema forces an error-bearing result to carry status `fail`. `fail` here
 * therefore means "failed on its merits".
 *
 * Be honest about what the `continue` buys: **nothing observable today.** The
 * `fails` key is only read when the `errors` key ties, and on a tie
 * double-counting would add the same number to both sides — so no input can
 * distinguish this from the version without it. An earlier comment here claimed
 * it prevented a crashed deriver outranking two genuine failures; that is
 * arithmetically impossible and the claim was wrong.
 *
 * It stays for two reasons that are real. spec.md requires it in those words
 * ("it contributes to the evaluation-error count and is excluded from the
 * ordinary `fail` count, so one result is never counted twice"), so the counts
 * are meant to describe the world correctly whether or not the ordering
 * notices. And it becomes observable the moment the schema stops forcing an
 * error-bearing result to `fail`, which is exactly when nobody would think to
 * look here.
 *
 * No test pins it, because no test can. Do not add one that pretends to.
 */
function severityCounts(checks: readonly CheckResult[]): SeverityCounts {
  let errors = 0
  let fails = 0
  let stale = 0
  let never = 0
  let warn = 0

  for (const check of checks) {
    if (check.error !== null) {
      errors += 1
      continue
    }
    if (check.status === 'fail') fails += 1
    else if (check.status === 'stale') stale += 1
    else if (check.status === 'never') never += 1
    else if (check.status === 'warn') warn += 1
  }

  return [errors, fails, stale, never, warn]
}

/**
 * A null committer time sorts after every observed one. It means the time is
 * unknown, not that it is old, and putting an unknown at the top of a list
 * ordered by recency would read as a claim about it.
 */
function byRecency(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/**
 * The five counts, ranked. Written as a fallthrough chain rather than a loop
 * over the tuple because that is what "ranked keys" means: the first key that
 * separates the two repos decides, and no later key can overturn it.
 */
function compareCounts(a: SeverityCounts, b: SeverityCounts): number {
  const [aErrors, aFails, aStale, aNever, aWarn] = a
  const [bErrors, bFails, bStale, bNever, bWarn] = b

  return (
    bErrors - aErrors ||
    bFails - aFails ||
    bStale - aStale ||
    bNever - aNever ||
    bWarn - aWarn
  )
}

/**
 * Ranks the more urgent repo first. Every count and the timestamp sort
 * descending; the identifier sorts ascending and is a total tiebreak, so the
 * order does not depend on the order the registry happened to return.
 */
export function compareRepoSeverity(a: RepoSummary, b: RepoSummary): number {
  const counts = compareCounts(severityCounts(a.checks), severityCounts(b.checks))
  if (counts !== 0) return counts

  const recency = byRecency(a.lastCommitAt, b.lastCommitAt)
  if (recency !== 0) return recency

  return a.id.localeCompare(b.id)
}
