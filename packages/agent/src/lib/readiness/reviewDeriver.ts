/**
 * reviewDeriver.ts — the `code-review` and `security-review` checks.
 *
 * Two rules carry most of the weight. A found artifact is not evidence: the
 * verdict has to be recognised, and for a code review the blocker count has to
 * be zero, or the check reports fail rather than ok. And freshness is an
 * ancestry relation over production code — a documentation commit after the
 * review leaves it current, a production commit or a dirty production path does
 * not.
 */
import { readFile, stat } from 'node:fs/promises'

import { resolveAllowed } from '../paths.js'

import {
  clampSummary,
  type DerivedCheck,
  type UnderivableCheck,
} from './derivedCheck.js'
import { stalenessReason } from './freshness.js'
import { commitTimesFor, type CommitStamp, type GitFacts } from './gitFacts.js'
import { type ProductionScope } from './productionScope.js'

export type ReviewCheckId = 'code-review' | 'security-review'

export interface DeriveReviewOptions {
  root: string
  checkId: ReviewCheckId
  scope: ProductionScope
  /** Read once per repo, so one repo costs one pair of git calls, not six. */
  facts: GitFacts
  /** Scan time, used as the timestamp for uncommitted evidence. */
  now: number
}

/**
 * Disjoint by construction: neither review type can be satisfied by the other's
 * artifact. The OpenSpec layout wins over the legacy one even when the legacy
 * artifact is newer, because the legacy tree is frozen history.
 */
const LAYOUTS: Record<ReviewCheckId, { openspec: RegExp; legacy: RegExp }> = {
  'code-review': {
    openspec: /^openspec\/changes\/.+\/REVIEW\.md$/,
    legacy: /^\.planning\/phases\/.+\/CODE-REVIEW\.md$/,
  },
  'security-review': {
    openspec: /^openspec\/changes\/.+\/SECURITY\.md$/,
    legacy: /^\.planning\/phases\/.+\/SECURITY-REVIEW\.md$/,
  },
}

const EVIDENCE_DIRS = ['openspec/changes', '.planning/phases']
const MAX_EVIDENCE_BYTES = 512 * 1024
const PASSING_VERDICT = /^(pass|approve)/i
const FAILING_VERDICT = /^(fail|reject|request[-_ ]?changes|blocked?)/i
const OPEN_FINDING = /^\s*[-*]?\s*status\s*:\s*"?(open|blocking)\b/im

const LABEL: Record<ReviewCheckId, string> = {
  'code-review': 'code review',
  'security-review': 'security review',
}

export async function deriveReview(opts: DeriveReviewOptions): Promise<DerivedCheck> {
  const { root, checkId, scope, facts, now } = opts
  const label = LABEL[checkId]

  if (!facts.available) {
    return failure('review-repo-unreadable', `the repository could not be read for the ${label}`)
  }

  const layout = LAYOUTS[checkId]
  const openspec = facts.files.filter((file) => layout.openspec.test(file))
  const candidates = openspec.length
    ? openspec
    : facts.files.filter((file) => layout.legacy.test(file))

  if (candidates.length === 0) {
    return {
      status: 'never',
      at: null,
      value: null,
      threshold: null,
      summary: `No ${label} artifact exists in either the OpenSpec or the legacy layout.`,
      evidence: null,
      error: null,
    }
  }

  const times = await commitTimesFor(root, EVIDENCE_DIRS)
  const selected = selectCandidate(candidates, times, now)
  const commit = times.get(selected) ?? null

  const artifact = await readArtifact(root, selected)
  if ('error' in artifact) return failure(artifact.error.code, artifact.error.message)

  const verdict = evaluateVerdict(checkId, artifact.text)
  if (verdict.kind === 'error') return failure(verdict.code, verdict.message, selected, commit)
  if (verdict.kind === 'fail') {
    return {
      status: 'fail',
      at: commit?.at ?? now,
      value: null,
      threshold: null,
      summary: clampSummary(`The ${label} at ${selected} reports ${verdict.reason}.`),
      evidence: { path: selected, commit: commit?.sha ?? null },
      error: null,
    }
  }

  return freshness({ root, label, scope, facts, now, selected, commit })
}

interface FreshnessInput {
  root: string
  label: string
  scope: ProductionScope
  facts: GitFacts
  now: number
  selected: string
  commit: CommitStamp | null
}

async function freshness(input: FreshnessInput): Promise<DerivedCheck> {
  const { root, label, scope, facts, now, selected, commit } = input
  const evidence = { path: selected, commit: commit?.sha ?? null }
  const at = commit?.at ?? now

  const stale = (reason: string): DerivedCheck => ({
    status: 'stale',
    at,
    value: null,
    threshold: null,
    summary: clampSummary(`The passing ${label} at ${selected} no longer covers ${reason}.${scopeNote(scope)}`),
    evidence,
    error: null,
  })

  const reason = await stalenessReason({ root, scope, facts, commit })
  if (reason) return stale(reason)

  // An uncommitted artifact is working-tree evidence: there is no commit to run
  // an ancestry test against, and production code is clean, so it is current.
  if (!commit) {
    return {
      status: 'ok',
      at,
      value: null,
      threshold: null,
      summary: clampSummary(
        `The uncommitted ${label} at ${selected} covers a clean production tree.${scopeNote(scope)}`,
      ),
      evidence,
      error: null,
    }
  }

  return {
    status: 'ok',
    at,
    value: null,
    threshold: null,
    summary: clampSummary(
      `The ${label} at ${selected} passes and descends from the last production-code commit.${scopeNote(scope)}`,
    ),
    evidence,
    error: null,
  }
}

/**
 * A repo may replace the production include set and extend the ignore set. That
 * is trusted author configuration, so its effect is stated rather than applied
 * silently — the summary is where the wire shape lets it be seen.
 */
function scopeNote(scope: ProductionScope): string {
  if (!scope.declared) return ''
  return ` Production scope declared by this repo: include ${scope.include.join(', ')}; ignore ${scope.ignore.join(', ')}.`
}

function selectCandidate(
  candidates: readonly string[],
  times: Map<string, CommitStamp>,
  now: number,
): string {
  // Uncommitted candidates sort as scan time, which is the timestamp they carry.
  return [...candidates].sort((a, b) => {
    const left = times.get(a)?.at ?? now
    const right = times.get(b)?.at ?? now
    if (left !== right) return right - left
    return a < b ? -1 : 1
  })[0]!
}

async function readArtifact(
  root: string,
  relativePath: string,
): Promise<{ text: string } | { error: { code: string; message: string } }> {
  try {
    // The daemon's contained-read primitive: repo-relative, canonical, and
    // refused if a symlink leaves the allowed subtree.
    const absolute = await resolveAllowed(root, relativePath)
    const info = await stat(absolute)
    if (info.size > MAX_EVIDENCE_BYTES) {
      return {
        error: {
          code: 'review-evidence-oversized',
          message: `${relativePath} is larger than the read bound`,
        },
      }
    }
    return { text: await readFile(absolute, 'utf8') }
  } catch {
    return {
      error: {
        code: 'review-evidence-unreadable',
        message: `${relativePath} could not be read`,
      },
    }
  }
}

type Verdict =
  | { kind: 'pass' }
  | { kind: 'fail'; reason: string }
  | { kind: 'error'; code: string; message: string }

function evaluateVerdict(checkId: ReviewCheckId, text: string): Verdict {
  const frontmatter = readFrontmatter(text)
  if (!frontmatter) {
    return {
      kind: 'error',
      code: 'review-frontmatter-missing',
      message: 'the artifact carries no frontmatter to read a verdict from',
    }
  }

  // stage_2_verdict is legacy code-review evidence. The security artifact
  // contract has only ever used `verdict`, so accepting the legacy key there
  // would silently pass an artifact that does not meet its own contract.
  const raw =
    checkId === 'code-review'
      ? frontmatter.verdict ?? frontmatter.stage_2_verdict
      : frontmatter.verdict

  if (!raw) {
    return {
      kind: 'error',
      code: 'review-verdict-missing',
      message: 'the artifact declares no verdict',
    }
  }

  const value = unquote(raw)
  if (FAILING_VERDICT.test(value)) return { kind: 'fail', reason: `verdict ${value}` }
  if (!PASSING_VERDICT.test(value)) {
    return {
      kind: 'error',
      code: 'review-verdict-unrecognised',
      message: `the verdict ${value} is neither a recognised pass nor a recognised failure`,
    }
  }

  if (checkId === 'code-review') {
    const declared = frontmatter.blocking_open
    // A bare `blocking_open:` parses to '', which is not undefined, and
    // Number('') is a finite 0 — so without the emptiness test a malformed
    // artifact declared itself free of blocking issues and passed the gate.
    const raw = declared === undefined ? undefined : unquote(declared)
    if (raw === undefined || raw === '') {
      return {
        kind: 'error',
        code: 'review-blocking-count-missing',
        message: 'the artifact declares no blocking_open count',
      }
    }
    // A count is a plain non-negative decimal integer, not "anything Number()
    // will coerce". `Number.isFinite` waved through `-1`, `1.5`, `1e2` and
    // `0x0`; because only `> 0` fails, every one of those read as "no blocking
    // issues" — a malformed artifact silently passing the gate.
    if (!/^\d+$/.test(raw)) {
      return {
        kind: 'error',
        code: 'review-blocking-count-malformed',
        message: 'the blocking_open count is not a whole number of findings',
      }
    }
    const count = Number(raw)
    if (count > 0) {
      return { kind: 'fail', reason: `${count} open blocking finding${count === 1 ? '' : 's'}` }
    }
  } else if (OPEN_FINDING.test(text)) {
    return { kind: 'fail', reason: 'an open or blocking finding' }
  }

  return { kind: 'pass' }
}

/**
 * A local reader rather than the SKILL.md one: this parses text already read for
 * the findings scan, and it must not inherit that reader's dirname `name`
 * fallback, which has no meaning for a review artifact.
 */
function readFrontmatter(text: string): Record<string, string> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return null
  const out: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    if (key) out[key] = line.slice(separator + 1).trim()
  }
  return out
}

const unquote = (value: string): string => value.replace(/^["']|["']$/g, '').trim()

function failure(
  code: string,
  message: string,
  path?: string,
  commit?: CommitStamp | null,
): DerivedCheck {
  return {
    status: 'fail',
    at: commit?.at ?? null,
    value: null,
    threshold: null,
    summary: clampSummary(`This check could not be evaluated: ${message}.`),
    evidence: path ? { path, commit: commit?.sha ?? null } : null,
    error: { code, message },
  }
}

/**
 * The pen-test slot has no derived signal at all. It stays visible at `never`
 * and tool-agnostic: which tool satisfies it is a mapping question that never
 * appears in the surface.
 */
export function derivePenTest(): UnderivableCheck {
  return {
    status: 'never',
    at: null,
    value: null,
    threshold: null,
    summary:
      'No penetration test has been reported. A result is reported through the repository readiness file.',
    evidence: null,
    error: null,
  }
}
