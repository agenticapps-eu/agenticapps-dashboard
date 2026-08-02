/**
 * assemble.ts — the six checks for one repo, from both tiers.
 *
 * Tier A derives from what is on disk; tier B, `.agenticapps/readiness.json`,
 * overrides *per check* so a repo reporting only its pen test keeps five derived
 * values instead of blanking them. Declared values are trusted — a repo may
 * declare better than the daemon would derive — with one exception: freshness.
 * A declared review whose reviewed commit no longer covers production code, or
 * an expired pen test, reports stale while staying `declared`. Author trust does
 * not turn expired evidence green.
 *
 * Every check is computed in isolation. A deriver that throws costs its own
 * check, which reports an error-bearing fail, and never the other five.
 */
import {
  CHECK_IDS,
  computeReady,
  type CheckId,
  type CheckResult,
  type ReadinessDeclaration,
  type ReadinessNotice,
} from '@agenticapps/dashboard-shared'

import type { PathResolver } from '../coverageResolver.js'
import type { OpenspecProjectState } from '../openspecReader.js'

import {
  DEFAULT_COVERAGE_PATH,
  DEFAULT_COVERAGE_THRESHOLD,
  deriveCoverage,
} from './coverageDeriver.js'
import { clampSummary, type DerivedCheck } from './derivedCheck.js'
import { stalenessReason } from './freshness.js'
import { readGitFacts, type GitFacts } from './gitFacts.js'
import {
  resolveProductionScope,
  scopeCollapses,
  type ProductionScope,
} from './productionScope.js'
import {
  readReadinessFile,
  READINESS_FILE_PATH,
  type RejectedCitation,
} from './readinessFile.js'
import { derivePenTest, deriveReview } from './reviewDeriver.js'
import { deriveSpec } from './specDeriver.js'
import { deriveWorkflow, type WorkflowSources } from './workflowDeriver.js'

export interface AssembleReadinessOptions {
  root: string
  now: number
  sources: WorkflowSources
  resolve: PathResolver
  readProject: (root: string) => Promise<OpenspecProjectState>
}

export interface AssembledReadiness {
  /** Exactly six results, in CHECK_IDS order. */
  checks: CheckResult[]
  ready: boolean
  notice: ReadinessNotice | null
}

export async function assembleReadiness(
  opts: AssembleReadinessOptions,
): Promise<AssembledReadiness> {
  const { root, now } = opts
  const facts = await readGitFacts(root)
  const outcome = await readReadinessFile(root)

  let file = outcome.kind === 'usable' ? outcome.file : null
  // Both non-absent outcomes carry a notice; a usable file's is non-null only
  // while one of its entries was rejected for its citation.
  let notice = outcome.kind === 'absent' ? null : outcome.notice
  const rejected =
    outcome.kind === 'usable' ? outcome.rejected : new Map<CheckId, RejectedCitation>()

  const configured = file?.productionPaths
  const coveragePath = file?.coverage?.path ?? DEFAULT_COVERAGE_PATH
  const fallbackScope = resolveProductionScope({ coveragePath: DEFAULT_COVERAGE_PATH })
  let scope: ProductionScope = configured
    ? resolveProductionScope({ coveragePath, configured })
    : resolveProductionScope({ coveragePath })

  // A configured scope that leaves no production path while the default scope
  // finds one would silence freshness for all of this repo's evidence, so the
  // file is unusable rather than merely ignored for that field.
  if (configured && scopeCollapses(facts.files, scope, fallbackScope)) {
    file = null
    scope = fallbackScope
    notice = {
      code: 'readiness-file-invalid',
      message: `${READINESS_FILE_PATH} declares a production scope that leaves no production path`,
    }
  }

  const threshold = file?.coverage?.threshold ?? DEFAULT_COVERAGE_THRESHOLD
  const effectiveCoveragePath = file?.coverage?.path ?? DEFAULT_COVERAGE_PATH

  const derived = await Promise.all([
    guard('workflow', () =>
      deriveWorkflow({ root, now, sources: opts.sources, resolve: opts.resolve }),
    ),
    guard('spec', () => deriveSpec({ root, now, readProject: opts.readProject })),
    guard('code-review', () =>
      deriveReview({ root, checkId: 'code-review', scope, facts, now }),
    ),
    guard('security-review', () =>
      deriveReview({ root, checkId: 'security-review', scope, facts, now }),
    ),
    guard('pen-test', async () => derivePenTest()),
    guard('coverage', () =>
      deriveCoverage({
        root,
        scope,
        facts,
        now,
        coveragePath: effectiveCoveragePath,
        threshold,
      }),
    ),
  ])

  const declarations = new Map<CheckId, ReadinessDeclaration>(
    (file?.checks ?? []).map((entry) => [entry.id, entry]),
  )

  const checks: CheckResult[] = []
  for (const [index, id] of CHECK_IDS.entries()) {
    const refusal = rejected.get(id)
    if (refusal) {
      checks.push(refusedResult(id, refusal))
      continue
    }
    const declaration = declarations.get(id)
    checks.push(
      declaration
        ? await declaredResult(declaration, { root, scope, facts, now })
        : { id, source: 'derived', ...derived[index]! },
    )
  }

  return { checks, ready: computeReady(checks, notice), notice }
}

/**
 * A declaration the daemon refused, because the evidence it cites could not be
 * verified.
 *
 * The one outcome that must not happen here is a fall back to the derived value.
 * A refused declaration would then be byte-identical to one that was never made,
 * so an author's blocking assertion could be erased by breaking the artifact it
 * cites — a repo would improve its verdict by deleting its own evidence. The
 * error is what stops that: `computeReady` blocks on any result carrying one,
 * before it reaches the advisory exemption, which makes this result sufficient on
 * its own rather than dependent on the repo-level notice also being raised.
 *
 * `source` stays `declared` because that is where the value came from, and
 * `evidence` is null because an unverified citation is not evidence. The path
 * belongs in the error, where it reads as something to fix rather than something
 * to follow.
 */
function refusedResult(id: CheckId, refusal: RejectedCitation): CheckResult {
  return {
    id,
    status: 'fail',
    source: 'declared',
    at: null,
    value: null,
    threshold: null,
    summary: clampSummary(
      `Declared in this repo’s readiness file, but the evidence it cites could not be verified: ${refusal.reason}.`,
    ),
    evidence: null,
    error: { code: 'evidence-unverifiable', message: wireSafeReason(refusal) },
  }
}

/**
 * `error.message` is validated by the shared sanitiser on the way out; `summary`
 * is not. The sanitiser refuses a colon followed by a filesystem-looking root,
 * which is how it catches an interpolated absolute path — and a *repo-relative*
 * path is allowed to contain a colon, so `docs/notes:/Users/x.md` is a legal
 * citation whose message the daemon would then reject as its own output. The
 * client's view of that is the schema-drift screen, not a warning.
 *
 * So the path is dropped from the wire message in the one case that can trip the
 * guard. The full path stays in `summary`, which is where a reader looks for it
 * and which carries no such restriction.
 */
function wireSafeReason(refusal: RejectedCitation): string {
  return refusal.cited.includes(':')
    ? 'the evidence path declared for this check could not be verified'
    : refusal.reason
}

async function guard(
  id: CheckId,
  derive: () => Promise<DerivedCheck>,
): Promise<DerivedCheck> {
  try {
    return await derive()
  } catch {
    return {
      status: 'fail',
      at: null,
      value: null,
      threshold: null,
      summary: `This check could not be evaluated: the ${id} deriver failed.`,
      evidence: null,
      error: {
        code: `${id}-deriver-failed`,
        message: `the ${id} deriver failed`,
      },
    }
  }
}

interface DeclarationContext {
  root: string
  scope: ProductionScope
  facts: GitFacts
  now: number
}

async function declaredResult(
  entry: ReadinessDeclaration,
  context: DeclarationContext,
): Promise<CheckResult> {
  const aged = await ageDeclaration(entry, context)
  const status = aged ? 'stale' : entry.status
  // `never` and `na` carry no observed evidence, whoever asserted them.
  const observed = status !== 'never' && status !== 'na'

  const evidence =
    observed && 'evidence' in entry && entry.evidence
      ? { path: entry.evidence, commit: entry.commit }
      : null

  return {
    id: entry.id,
    status,
    source: 'declared',
    // `observed` is false for exactly the statuses whose entry variant carries no
    // `observedAt`, so the field is never read when it is not there. The `in`
    // narrows what the guard already guarantees, for the type checker's benefit.
    at: observed && 'observedAt' in entry ? Date.parse(entry.observedAt) : null,
    value: entry.value ?? null,
    threshold: null,
    summary: clampSummary(
      aged
        ? `Declared in this repo's readiness file, but no longer current: ${aged}.`
        : entry.summary ?? 'Declared in this repo’s readiness file.',
    ),
    evidence,
    error: null,
  }
}

/** Why a declaration is no longer current, or null while it still is. */
async function ageDeclaration(
  entry: ReadinessDeclaration,
  context: DeclarationContext,
): Promise<string | null> {
  if (entry.id === 'pen-test') {
    // An unsubstantiated entry — `never` or `na` — carries no `validUntil` and
    // cannot expire. There is no observation to decay: the author is asserting
    // that no test happened, which does not become less true with time. Without
    // this guard `Date.parse(undefined)` is NaN, and `NaN < now` is false, so the
    // entry would read as permanently current by accident rather than by rule.
    if (!('validUntil' in entry)) return null
    return Date.parse(entry.validUntil) < context.now
      ? 'the declared penetration test has expired'
      : null
  }
  if (entry.id !== 'code-review' && entry.id !== 'security-review') return null

  return stalenessReason({
    root: context.root,
    scope: context.scope,
    facts: context.facts,
    commit: { sha: entry.commit },
  })
}
