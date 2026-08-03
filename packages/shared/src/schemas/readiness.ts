import { z } from 'zod'

/**
 * The six readiness checks, in the order every surface renders them. The daemon
 * and the SPA both take identity and order from this one constant — neither
 * applies a sort of its own, and a repo always reports all six.
 */
export const CHECK_IDS = [
  'workflow',
  'spec',
  'code-review',
  'security-review',
  'pen-test',
  'coverage',
] as const

export const CheckIdSchema = z.enum(CHECK_IDS)
export type CheckId = z.infer<typeof CheckIdSchema>

/**
 * One vocabulary for all six checks. `never` is not `fail`: a check that has
 * never run is a gap in process, one that ran and failed is a defect. `na` is
 * sayable only with a reason.
 */
export const CHECK_STATUSES = [
  'ok',
  'warn',
  'fail',
  'stale',
  'never',
  'na',
] as const

export const CheckStatusSchema = z.enum(CHECK_STATUSES)
export type CheckStatus = z.infer<typeof CheckStatusSchema>

export const CheckSourceSchema = z.enum(['derived', 'declared'])
export type CheckSource = z.infer<typeof CheckSourceSchema>

const MAX_PATH_LENGTH = 512
const MAX_TEXT_LENGTH = 600
const MAX_VALUE_LENGTH = 200
const MAX_PATH_PATTERNS = 100

/**
 * A repo-relative path that cannot address anything outside the repo by its own
 * shape: no absolute or home-relative form, no drive letter, no backslash, no
 * `.`/`..`/empty segment. Symlink containment is not expressible here — it is a
 * filesystem property, enforced at read time by the daemon's bounded,
 * canonical, symlink-contained project-read primitive.
 */
export const RepoRelativePathSchema = z
  .string()
  .min(1)
  .max(MAX_PATH_LENGTH)
  .superRefine((value, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })

    if (/[\u0000-\u001f\u007f]/.test(value))
      reject('path contains a control character')
    if (value.includes('\\')) reject('path must use forward slashes')
    if (value.startsWith('/')) reject('path must be repo-relative')
    if (value.startsWith('~')) reject('path must not be home-relative')
    if (/^[A-Za-z]:/.test(value)) reject('path must not carry a drive letter')

    for (const segment of value.split('/')) {
      if (segment === '') reject('path must not contain an empty segment')
      if (segment === '.' || segment === '..') reject('path must not traverse')
    }
  })

/**
 * Text safe to serialise to a client: no absolute filesystem path, no drive
 * path. Applied where the spec requires it — error text and repo notices — so a
 * leak is caught by the outbound response validation rather than by review.
 * A symbolic root such as `~/.claude/skills` stays allowed; it names no user.
 *
 * Two boundaries, deliberately of different strictness.
 *
 * At a *strong* boundary — string start, whitespace, quote or bracket — any
 * leading `/` or `\\` is an absolute path and is refused outright. Nothing
 * legitimate in these fields starts a token that way.
 *
 * A colon is the ambiguous case, and it is the one that matters: an
 * interpolated message really does read `resolved to:/Users/...`, which the
 * strong-boundary rule alone lets through. But `GET:/api/v2/fleet returned 500`
 * has the identical shape and is not a leak, so a colon boundary additionally
 * requires the first segment to name a filesystem root. That is a heuristic —
 * a path under an unusual mount such as `/mycustomroot/x` is not caught — and
 * it is the right trade here, because the alternative rejects ordinary route
 * text.
 *
 * The colon rule additionally requires the token holding the colon to contain
 * no `/`. `RepoRelativePathSchema` permits a colon, so `docs/notes:/Users/x.md`
 * is a citation an author can legally commit — and it is not a leak, whereas
 * the `to` of `resolved to:` names nothing on disk. Without that requirement
 * the daemon refused its own error text for such a path, and since a response
 * is validated as one payload for every repo, a single filename answered the
 * whole fleet endpoint with `schema_drift`.
 *
 * **The residual, stated rather than assumed.** A colon in the *first* path
 * segment — `ab:/Users/x` — leaves nothing to separate the citation from an
 * interpolated absolute path, and is still refused. Text-level detection cannot
 * close that; only carrying the path in its own `RepoRelativePathSchema` field,
 * instead of interpolating it into prose, would. That is a wire and surface
 * change and has not been made.
 *
 * An earlier version of this comment bounded the residual risk on the claim
 * that "no message this daemon constructs interpolates anything but a
 * repo-relative path". That reasoning was inverted: a repo-relative path is
 * exactly what breaks it.
 *
 * The cost of a false positive is not a warning: the outbound validation fails
 * and the client gets the schema-drift screen. So callers building text from
 * author-controlled input MUST route it through `wireSafeText` rather than hand
 * it to this boundary and hope. Widening this is a trade, not a free tightening.
 */
const FILESYSTEM_ROOTS =
  'Users|home|var|tmp|private|etc|opt|usr|mnt|Volumes|root|srv|System|Library|Applications'

const STRONG_BOUNDARY = `(?:^|[\\s"'\`([<])`

const ABSOLUTE_PATH = new RegExp(
  [
    `${STRONG_BOUNDARY}/`, // absolute POSIX path at a strong boundary
    `${STRONG_BOUNDARY}\\\\\\\\`, // UNC \\\\server at a strong boundary
    // Colon-adjacent, filesystem-looking, and only where the token holding the
    // colon carries no path separator of its own.
    `${STRONG_BOUNDARY}[^\\s"'\`([</]*:/(?:${FILESYSTEM_ROOTS})\\b`,
    `${STRONG_BOUNDARY}[A-Za-z]:[\\\\/]`, // drive letter
  ].join('|'),
)

/**
 * Whether this text would be refused by the outbound guard. Exported so that a
 * caller tests with exactly what the boundary enforces: the previous in-agent
 * approximation asked whether the path contained a colon, which discarded
 * `docs/a:b.md` — a path this guard has always accepted.
 */
export function carriesAbsolutePath(text: string): boolean {
  return ABSOLUTE_PATH.test(text)
}

/**
 * Text for a sanitised field, or `fallback` when it cannot be certified.
 *
 * This is what makes "one repo cannot withhold the fleet" a property of the
 * design rather than of the heuristic's accuracy. The boundary stays
 * fail-closed; what changes is that no caller hands it text it cannot certify.
 * Callers SHALL keep the full reference on an unrestricted field — `summary` —
 * so withholding it from one message never removes it from the surface.
 */
export function wireSafeText(text: string, fallback: string): string {
  return carriesAbsolutePath(text) ? fallback : text
}

const SanitisedTextSchema = z
  .string()
  .max(MAX_TEXT_LENGTH)
  .refine((value) => !carriesAbsolutePath(value), {
    message: 'text must not carry an absolute filesystem path',
  })

const Rfc3339Schema = z.string().datetime({ offset: true })
const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/)
/**
 * A UTC instant in milliseconds, bounded by what `Date` can actually represent.
 * `at` and `lastCommitAt` are fed from git committer times, and a repo carrying
 * a corrupt commit date can exceed that range — at which point every surface
 * that formats the value throws a RangeError mid-render. Rejecting it here
 * keeps one bad commit in one repo from taking down a whole fleet response.
 */
const MAX_DATE_MS = 8_640_000_000_000_000
const EpochMsSchema = z.number().int().nonnegative().max(MAX_DATE_MS)

const EvidenceSchema = z
  .object({
    path: RepoRelativePathSchema,
    commit: CommitShaSchema.nullable(),
  })
  .strict()

const CheckErrorSchema = z
  .object({
    code: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
    message: SanitisedTextSchema,
  })
  .strict()

function checkResultObject<T extends z.ZodTypeAny>(idSchema: T) {
  return z
    .object({
      id: idSchema,
      status: CheckStatusSchema,
      source: CheckSourceSchema,
      at: EpochMsSchema.nullable(),
      value: z.union([z.string().max(MAX_VALUE_LENGTH), z.number().finite()]).nullable(),
      threshold: z.number().finite().nullable(),
      summary: z.string().max(MAX_TEXT_LENGTH),
      evidence: EvidenceSchema.nullable(),
      error: CheckErrorSchema.nullable(),
    })
    .strict()
}

type BareResult = {
  status: CheckStatus
  summary: string
  at: number | null
  evidence: unknown
  error: unknown
}

function refineResult(value: BareResult, ctx: z.RefinementCtx): void {
  if (value.error !== null && value.status !== 'fail') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'an error-bearing result must use status fail',
    })
  }
  if (value.status === 'na' && value.summary.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary'],
      message: 'a not-applicable result must state its reason',
    })
  }
  if (value.status === 'never' || value.status === 'na') {
    if (value.at !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['at'],
        message: `a ${value.status} result has no observed time`,
      })
    }
    if (value.evidence !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence'],
        message: `a ${value.status} result has no evidence`,
      })
    }
  }
}

export const CheckResultSchema = checkResultObject(CheckIdSchema).superRefine(
  refineResult,
)
export type CheckResult = z.infer<typeof CheckResultSchema>

const RemedySchema = z.string().min(1).max(MAX_TEXT_LENGTH)

const summaryCheck = (id: CheckId) =>
  checkResultObject(z.literal(id)).superRefine(refineResult)

const detailCheck = (id: CheckId) =>
  checkResultObject(z.literal(id))
    .extend({ remedy: RemedySchema })
    .superRefine(refineResult)

const SummaryChecksSchema = z.tuple([
  summaryCheck(CHECK_IDS[0]),
  summaryCheck(CHECK_IDS[1]),
  summaryCheck(CHECK_IDS[2]),
  summaryCheck(CHECK_IDS[3]),
  summaryCheck(CHECK_IDS[4]),
  summaryCheck(CHECK_IDS[5]),
])

const DetailChecksSchema = z.tuple([
  detailCheck(CHECK_IDS[0]),
  detailCheck(CHECK_IDS[1]),
  detailCheck(CHECK_IDS[2]),
  detailCheck(CHECK_IDS[3]),
  detailCheck(CHECK_IDS[4]),
  detailCheck(CHECK_IDS[5]),
])

/**
 * Checks the daemon cannot derive any signal for. Their deriver reports `never`
 * unconditionally, so that `never` records the absence of anything to observe
 * rather than an observation — which is why it does not block while undeclared.
 *
 * This is deliberately data and not a branch in `computeReady`: a second
 * declared-only check joins by being listed. Membership is constrained, not
 * conventional — a member's deriver must be typed so `never` is the only status
 * it can return, and `derivePenTest`'s return type is that constraint. Sampling
 * a deriver's behaviour could not establish the property, because a conditional
 * branch satisfies any finite number of calls.
 */
export const ADVISORY_WHEN_UNDECLARED = ['pen-test'] as const satisfies readonly CheckId[]

/**
 * The ids in that set, as a union rather than as `CheckId`. The agent uses it to
 * bind each member to a deriver that can only return `never`, so widening the
 * set fails to compile until the new member has a deriver of that shape.
 * Without the `as const` above this would collapse to `CheckId` and the binding
 * would accept anything.
 */
export type AdvisoryCheckId = (typeof ADVISORY_WHEN_UNDECLARED)[number]

/**
 * Membership test. The set is a narrow literal tuple so the agent can bind each
 * member to an underivable deriver, which makes `.includes` reject an arbitrary
 * `CheckId` outright — this widens for the query without widening the constant
 * that carries the guarantee.
 */
export function isAdvisoryCheck(id: CheckId): boolean {
  return (ADVISORY_WHEN_UNDECLARED as readonly CheckId[]).includes(id)
}

/**
 * Readiness is a boolean over the six results, never a score. `fail`, `stale`,
 * `never` and any evaluation error block; `warn` is a visible, non-blocking
 * caveat; `na` is excluded, and a repo with nothing applicable is not ready
 * rather than vacuously so.
 *
 * A derived `never` on an advisory check is exempt from blocking — without it
 * the verdict is a constant, since nothing derives a pen test and `never` would
 * block every repo forever.
 *
 * `notice` is required rather than optional because omitting it is the one way
 * to get this wrong. When a readiness file is unusable every declaration is
 * discarded and all six checks fall back to derived values carrying no error,
 * so an advisory check's result is byte-identical to the same check in a repo
 * with no readiness file at all. Without the notice, a repo could reach ready by
 * making its own declarations unreadable: a declared blocking status would
 * vanish with the file and the exemption would excuse what replaced it.
 */
export function computeReady(
  checks: readonly Pick<CheckResult, 'id' | 'status' | 'source' | 'error'>[],
  notice: ReadinessNotice | null,
): boolean {
  const exempt = (check: Pick<CheckResult, 'id' | 'status' | 'source'>) =>
    check.status === 'never' &&
    check.source === 'derived' &&
    isAdvisoryCheck(check.id) &&
    notice === null

  const blocked = checks.some(
    (check) =>
      check.error !== null ||
      check.status === 'fail' ||
      check.status === 'stale' ||
      (check.status === 'never' && !exempt(check)),
  )
  if (blocked) return false
  return checks.some((check) => check.status === 'ok' || check.status === 'warn')
}

export const ReadinessNoticeSchema = z
  .object({
    code: z.enum([
      'readiness-file-unsupported-version',
      'readiness-file-unparsable',
      'readiness-file-invalid',
    ]),
    message: SanitisedTextSchema,
  })
  .strict()
export type ReadinessNotice = z.infer<typeof ReadinessNoticeSchema>

export const RepoFamilySchema = z.enum([
  'agenticapps',
  'factiv',
  'neuroflash',
  'other',
])
export type RepoFamily = z.infer<typeof RepoFamilySchema>

function repoObject<T extends z.ZodTypeAny>(checksSchema: T) {
  return z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      family: RepoFamilySchema,
      ready: z.boolean(),
      lastCommitAt: EpochMsSchema.nullable(),
      checks: checksSchema,
      notice: ReadinessNoticeSchema.nullable(),
    })
    .strict()
}

/**
 * The outbound check that `ready` follows from the response. It must be given
 * the same inputs the predicate was given — including `notice`, which is a
 * sibling of `ready` and `checks` on this very object. Recomputing from the
 * results alone would reject exactly the responses the unusable-file suspension
 * exists to produce, so the daemon would fail validation on its own correct
 * output.
 */
function refineReady(
  value: {
    ready: boolean
    checks: readonly Pick<CheckResult, 'id' | 'status' | 'source' | 'error'>[]
    notice: ReadinessNotice | null
  },
  ctx: z.RefinementCtx,
): void {
  if (value.ready !== computeReady(value.checks, value.notice)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ready'],
      message: 'ready must follow from the six results',
    })
  }
}

export const RepoSummarySchema = repoObject(SummaryChecksSchema).superRefine(
  refineReady,
)
export type RepoSummary = z.infer<typeof RepoSummarySchema>

export const RepoDetailSchema = repoObject(DetailChecksSchema).superRefine(
  refineReady,
)
export type RepoDetail = z.infer<typeof RepoDetailSchema>

/**
 * `generatedAt` is when the snapshot was computed, not when it was served. A
 * response replayed from the memo repeats the original time, so a client can
 * tell a fresh reading from a cached one instead of seeing every response claim
 * to be current.
 */
export const FleetResponseSchema = z
  .object({
    generatedAt: EpochMsSchema,
    repos: z.array(RepoSummarySchema),
  })
  .strict()
export type FleetResponse = z.infer<typeof FleetResponseSchema>

export const RepoDetailResponseSchema = z
  .object({
    generatedAt: EpochMsSchema,
    repo: RepoDetailSchema,
  })
  .strict()
export type RepoDetailResponse = z.infer<typeof RepoDetailResponseSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Tier B — <repo>/.agenticapps/readiness.json
// ─────────────────────────────────────────────────────────────────────────────

const declaredBase = {
  observedAt: Rfc3339Schema,
  summary: z.string().max(MAX_TEXT_LENGTH).optional(),
  value: z
    .union([z.string().max(MAX_VALUE_LENGTH), z.number().finite()])
    .optional(),
}

const declaredEvidence = {
  evidence: RepoRelativePathSchema,
  commit: CommitShaSchema,
}

function plainDeclaration(id: 'workflow' | 'spec' | 'coverage') {
  return z.object({ id: z.literal(id), status: CheckStatusSchema, ...declaredBase }).strict()
}

function reviewDeclaration(id: 'code-review' | 'security-review') {
  return z
    .object({
      id: z.literal(id),
      status: CheckStatusSchema,
      ...declaredBase,
      ...declaredEvidence,
    })
    .strict()
}

/**
 * A declared pen test takes one of two variants, distinguished by whether it
 * records an observation.
 *
 * A *substantiated* entry asserts a test ran: `ok`, `warn` or `fail`, carrying
 * an observed time, an evidence path, the commit it covered, and an expiry.
 *
 * An *unsubstantiated* entry asserts that no test ran — `never` — or that none
 * applies — `na`, which states its reason like any other. It carries none of
 * those four fields, because a test that did not happen has no artifact, no
 * reviewed commit, no observed time and nothing to expire.
 *
 * The fields are *absent from the variant* rather than optional across one
 * merged shape. An optional field would admit `pen-test: never` carrying an
 * evidence path and an expiry — a claim about a test that did not occur — which
 * the schema would then need a second rule to reject. Two variants make the
 * invalid combination unstateable instead.
 *
 * `stale` is absent from both: it is computed from `validUntil`, not asserted.
 */
const SubstantiatedPenTestSchema = z
  .object({
    id: z.literal('pen-test'),
    status: z.enum(['ok', 'warn', 'fail']),
    ...declaredBase,
    ...declaredEvidence,
    validUntil: Rfc3339Schema,
  })
  .strict()

const UnsubstantiatedPenTestSchema = z
  .object({
    id: z.literal('pen-test'),
    status: z.enum(['never', 'na']),
    // `declaredBase` minus `observedAt`: there is nothing to have observed. The
    // `na`-states-a-reason rule reads `summary` and is shared with every other
    // check, so it is not restated here.
    summary: declaredBase.summary,
    value: declaredBase.value,
  })
  .strict()

/**
 * A plain union rather than a `discriminatedUnion` on `id`. Zod keys a
 * discriminated union by its discriminator value, so it cannot hold the two
 * `pen-test` variants at once. The cost is error-message quality inside a
 * malformed entry; the benefit is that the unsubstantiated variant stays a
 * variant rather than becoming a refinement over optional fields.
 */
const DeclarationSchema = z.union([
  plainDeclaration('workflow'),
  plainDeclaration('spec'),
  reviewDeclaration('code-review'),
  reviewDeclaration('security-review'),
  SubstantiatedPenTestSchema,
  UnsubstantiatedPenTestSchema,
  plainDeclaration('coverage'),
])

const KNOWN_CHECK_IDS = new Set<string>(CHECK_IDS)

/**
 * The one deliberate exception to `.strict()` in this file: an entry naming a
 * check identifier outside the six is discarded on its own, so a newer repo can
 * declare a check this daemon does not know without making its whole readiness
 * file unusable. Every other malformation invalidates the file.
 */
const DeclarationsSchema = z.preprocess(
  (raw) =>
    Array.isArray(raw)
      ? raw.filter(
          (entry) =>
            !(
              typeof entry === 'object' &&
              entry !== null &&
              typeof (entry as { id?: unknown }).id === 'string' &&
              !KNOWN_CHECK_IDS.has((entry as { id: string }).id)
            ),
        )
      : raw,
  z
    .array(DeclarationSchema)
    .max(CHECK_IDS.length)
    .superRefine((entries, ctx) => {
      const seen = new Set<string>()
      for (const entry of entries) {
        if (seen.has(entry.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `check ${entry.id} is declared more than once`,
          })
        }
        seen.add(entry.id)
        if (entry.status === 'na' && (entry.summary ?? '').trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `check ${entry.id} declares na without a reason`,
          })
        }
      }
    }),
)

export const ReadinessFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    coverage: z
      .object({
        path: RepoRelativePathSchema.optional(),
        threshold: z.number().finite().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    productionPaths: z
      .object({
        include: z.array(RepoRelativePathSchema).max(MAX_PATH_PATTERNS).optional(),
        ignore: z.array(RepoRelativePathSchema).max(MAX_PATH_PATTERNS).optional(),
      })
      .strict()
      .optional(),
    checks: DeclarationsSchema.optional(),
  })
  .strict()
export type ReadinessFile = z.infer<typeof ReadinessFileSchema>
export type ReadinessDeclaration = z.infer<typeof DeclarationSchema>
