/**
 * coverageDeriver.ts — the `coverage` check.
 *
 * Two orderings matter. An artifact that cannot be read, parsed or understood
 * reports an error-bearing fail *before* freshness is considered, because there
 * is no trustworthy value to age. A value that did parse is aged before its
 * percentage is judged, so 95% measured before the last production commit is
 * stale rather than green.
 *
 * Absence is `never`, never `0 %` — a repo that has never measured coverage and
 * a repo measuring zero are different facts about the product.
 */
import { lstat, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { resolveAllowedNamed } from '../paths.js'

import { clampSummary, type DerivedCheck } from './derivedCheck.js'
import {
  isAncestor,
  lastCommitTouching,
  type CommitStamp,
  type GitFacts,
} from './gitFacts.js'
import { isProductionPath, toPathspecs, type ProductionScope } from './productionScope.js'

export const DEFAULT_COVERAGE_PATH = 'coverage/coverage-summary.json'
export const DEFAULT_COVERAGE_THRESHOLD = 80
/** Width of the warn band below the threshold, clamped at zero. */
const WARN_BAND = 5
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024

export interface DeriveCoverageOptions {
  root: string
  scope: ProductionScope
  facts: GitFacts
  now: number
  /** Effective repo-relative artifact path — the default, or the repo's. */
  coveragePath: string
  /** Effective threshold, 0–100. */
  threshold: number
}

export async function deriveCoverage(opts: DeriveCoverageOptions): Promise<DerivedCheck> {
  const { root, scope, facts, now, coveragePath, threshold } = opts

  if (!facts.available) {
    return failure('coverage-repo-unreadable', 'the repository could not be read', threshold)
  }

  const artifact = await readArtifact(root, coveragePath)
  if (artifact.kind === 'absent') {
    return {
      status: 'never',
      at: null,
      value: null,
      threshold,
      summary: clampSummary(
        `No coverage summary at ${coveragePath}. Coverage has never been measured here.`,
      ),
      evidence: null,
      error: null,
    }
  }
  if (artifact.kind === 'error') {
    return failure(artifact.code, artifact.message, threshold)
  }

  const commit = await lastCommitTouching(root, [coveragePath])
  const evidence = { path: coveragePath, commit: commit?.sha ?? null }
  const at = commit?.at ?? now
  const pct = artifact.pct

  const staleReason = await stalenessOf({ root, scope, facts, commit })
  if (staleReason) {
    return {
      status: 'stale',
      at,
      value: pct,
      threshold,
      summary: clampSummary(
        `Coverage of ${pct}% at ${coveragePath} predates ${staleReason}, so it no longer describes this repo.`,
      ),
      evidence,
      error: null,
    }
  }

  const status = pct >= threshold ? 'ok' : pct >= Math.max(0, threshold - WARN_BAND) ? 'warn' : 'fail'
  return {
    status,
    at,
    value: pct,
    threshold,
    summary: clampSummary(
      `Line coverage is ${pct}% against a threshold of ${threshold}%, read from ${coveragePath}.`,
    ),
    evidence,
    error: null,
  }
}

interface StalenessInput {
  root: string
  scope: ProductionScope
  facts: GitFacts
  commit: CommitStamp | null
}

async function stalenessOf(input: StalenessInput): Promise<string | null> {
  const { root, scope, facts, commit } = input
  const dirty = facts.changed.filter((path) => isProductionPath(path, scope))
  if (dirty.length > 0) {
    return `${dirty.length} uncommitted production change${dirty.length === 1 ? '' : 's'}`
  }
  // Uncommitted artifact, clean production tree: it describes what is here now.
  if (!commit) return null

  const lastProduction = await lastCommitTouching(root, toPathspecs(scope))
  if (lastProduction && !(await isAncestor(root, lastProduction.sha, commit.sha))) {
    return 'the last commit touching production code'
  }
  return null
}

type Artifact =
  | { kind: 'ok'; pct: number }
  | { kind: 'absent' }
  | { kind: 'error'; code: string; message: string }

async function readArtifact(root: string, relativePath: string): Promise<Artifact> {
  let absolute: string
  try {
    // Containment through the daemon's named-read primitive: the resolved path
    // must stay under the repo root, so a symlink out of it is refused before
    // any bytes are read. A path that simply does not exist is absence, which
    // the caller distinguishes below by statting first.
    absolute = await resolveAllowedNamed(join(root, relativePath), {
      roots: [root],
      allowedNames: [basename(relativePath)],
    })
  } catch {
    return (await exists(root, relativePath))
      ? {
          kind: 'error',
          code: 'coverage-artifact-refused',
          message: `${relativePath} does not resolve inside the repository`,
        }
      : { kind: 'absent' }
  }

  let raw: string
  try {
    const info = await stat(absolute)
    if (info.size > MAX_ARTIFACT_BYTES) {
      return {
        kind: 'error',
        code: 'coverage-artifact-oversized',
        message: `${relativePath} is larger than the read bound`,
      }
    }
    raw = await readFile(absolute, 'utf8')
  } catch {
    return {
      kind: 'error',
      code: 'coverage-artifact-unreadable',
      message: `${relativePath} could not be read`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      kind: 'error',
      code: 'coverage-artifact-unparsable',
      message: `${relativePath} is not valid JSON`,
    }
  }

  const pct = (parsed as { total?: { lines?: { pct?: unknown } } })?.total?.lines?.pct
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    return {
      kind: 'error',
      code: 'coverage-artifact-invalid',
      message: `${relativePath} carries no usable total.lines.pct percentage`,
    }
  }
  return { kind: 'ok', pct }
}

/**
 * Distinguishes "there is nothing there" from "there is something there that
 * this daemon refuses to read". A dangling or escaping symlink still exists as
 * a directory entry, so absence is decided by lstat rather than by resolution.
 */
async function exists(root: string, relativePath: string): Promise<boolean> {
  try {
    await lstat(join(root, relativePath))
    return true
  } catch {
    return false
  }
}

function failure(code: string, message: string, threshold: number): DerivedCheck {
  return {
    status: 'fail',
    at: null,
    value: null,
    threshold,
    summary: clampSummary(`This check could not be evaluated: ${message}.`),
    evidence: null,
    error: { code, message },
  }
}
