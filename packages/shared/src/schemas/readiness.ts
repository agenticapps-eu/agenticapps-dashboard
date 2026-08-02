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
 * A leading `/` counts as a path start unless the character before it is one
 * that makes it part of a longer token — an alphanumeric, `.`, `_`, `~`, `-`, or
 * another `/`. That is what keeps `coverage/summary.json`, `~/.claude/skills`
 * and `https://example.com/x` acceptable while `resolved to:/Users/...` is not.
 * The earlier form keyed on whitespace, quote or bracket alone, so a path
 * pressed against a colon — the shape an interpolated message actually takes —
 * walked straight through. `^//` is spelled out because a UNC root is absolute
 * but its second slash is otherwise excluded as a boundary.
 *
 * The cost of a false positive is not a warning: the outbound validation fails
 * and the client gets the schema-drift screen. Widening this is a trade, not a
 * free tightening.
 */
const SanitisedTextSchema = z
  .string()
  .max(MAX_TEXT_LENGTH)
  .refine(
    (value) =>
      !/(?:^|[^A-Za-z0-9._~/-])\/(?!\/)|^\/\/|(?:^|[^A-Za-z0-9._~-])[A-Za-z]:[\\/]/.test(
        value,
      ),
    { message: 'text must not carry an absolute filesystem path' },
  )

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
 * Readiness is a boolean over the six results, never a score. `fail`, `stale`,
 * `never` and any evaluation error block; `warn` is a visible, non-blocking
 * caveat; `na` is excluded, and a wholly not-applicable repo is not ready
 * rather than vacuously so.
 */
export function computeReady(
  checks: readonly Pick<CheckResult, 'status' | 'error'>[],
): boolean {
  const blocked = checks.some(
    (check) =>
      check.error !== null ||
      check.status === 'fail' ||
      check.status === 'stale' ||
      check.status === 'never',
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

function refineReady(
  value: { ready: boolean; checks: readonly Pick<CheckResult, 'status' | 'error'>[] },
  ctx: z.RefinementCtx,
): void {
  if (value.ready !== computeReady(value.checks)) {
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
 * A declared pen test states only what an author can observe: `stale` is
 * derived from `validUntil`, `never` means no declaration at all, and `na` is
 * not valid for a slot that has no derived signal to be inapplicable to.
 */
const PenTestDeclarationSchema = z
  .object({
    id: z.literal('pen-test'),
    status: z.enum(['ok', 'warn', 'fail']),
    ...declaredBase,
    ...declaredEvidence,
    validUntil: Rfc3339Schema,
  })
  .strict()

const DeclarationSchema = z.discriminatedUnion('id', [
  plainDeclaration('workflow'),
  plainDeclaration('spec'),
  reviewDeclaration('code-review'),
  reviewDeclaration('security-review'),
  PenTestDeclarationSchema,
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
