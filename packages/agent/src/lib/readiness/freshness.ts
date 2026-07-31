/**
 * freshness.ts — the one rule that decides whether evidence still describes the
 * repo it was gathered from.
 *
 * Three checks and the tier-B reader all age evidence, and they have to age it
 * identically: evidence is stale when relevant production paths are dirty or
 * untracked, or when the last commit touching production code is not an
 * ancestor of the evidence commit. Committer timestamps never decide it — a
 * fresh clone stamps every file with checkout time, and ordering by that would
 * make stale evidence look current.
 */
import { isAncestor, lastCommitTouching, type CommitStamp, type GitFacts } from './gitFacts.js'
import { isProductionPath, toPathspecs, type ProductionScope } from './productionScope.js'

export interface StalenessInput {
  root: string
  scope: ProductionScope
  facts: GitFacts
  /** The evidence commit, or null when the evidence is uncommitted. */
  commit: CommitStamp | { sha: string } | null
}

/**
 * Returns why the evidence is stale, or null when it is current. Uncommitted
 * evidence over a clean production tree is current: it is working-tree evidence
 * and there is no commit to run an ancestry test against.
 */
export async function stalenessReason(input: StalenessInput): Promise<string | null> {
  const { root, scope, facts, commit } = input

  const dirty = facts.changed.filter((path) => isProductionPath(path, scope))
  if (dirty.length > 0) {
    return `${dirty.length} uncommitted production change${dirty.length === 1 ? '' : 's'}`
  }
  if (!commit) return null

  const lastProduction = await lastCommitTouching(root, toPathspecs(scope))
  if (lastProduction && !(await isAncestor(root, lastProduction.sha, commit.sha))) {
    return 'the last commit touching production code'
  }
  return null
}
