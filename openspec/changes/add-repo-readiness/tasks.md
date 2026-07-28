# Tasks

Depends on `add-openspec-project-reader` for task 4 and on
`add-workflow-fleet-conformance`'s named-root policy before task 3 may read
machine-global host state. The remaining tasks are independent of those
dependencies.

**`add-workflow-fleet-conformance` is a release gate for this whole change, not
just for task 3.** The spec states that the `workflow` check MUST NOT ship
before that dependency is archived, so this change MUST NOT be marked complete,
merged, or folded while it remains unarchived — even if every task below is
ticked. Verify the dependency is archived as the last step before folding.

## 1. Shared vocabulary (do first — everything binds to it) · AGE-456

- [ ] `packages/shared/src/schemas/readiness.ts`: `CheckId` as an exported const array of the six ids in fixed order (TDD)
- [ ] `CheckStatus` with the six values; strict `CheckResult` with required nullable `at`, `value`, `threshold`, `evidence`, and `error`
- [ ] `RepoSummary` with stable identity, boolean `ready`, six checks, UTC committer time, and notice; `RepoDetail` adds a non-empty remedy per check
- [ ] Strict `ReadinessFileSchema`, `schemaVersion: 1`: bounded declarations, coverage path/threshold, production include/ignore paths
- [ ] Require RFC 3339 `observedAt`, evidence path, and full commit SHA for declared review/pen-test results; pen tests also require `validUntil`
- [ ] Restrict declared pen-test status to `ok`, `warn`, or `fail`; derive `stale` from expiration, reserve `never` for absence, and reject declared `na`
- [ ] Validate every configured/evidence path as bounded, repo-relative, canonical, and symlink-contained
- [ ] Reuse the daemon's shared bounded project-read primitive for tier-B/evidence reads; adversarial tests cover traversal, escaping symlinks, and a symlink changed before open
- [ ] Every nested object `.strict()`, matching the existing schemas
- [ ] Test: `checks` always has length 6 in fixed order; a fully-underivable repo yields six `never`
- [ ] Test: `source` is required on every result
- [ ] Test: `ReadinessFileSchema` discards an unknown `id` rather than throwing — the one deliberate exception to `.strict()`, commented as such
- [ ] Test: unknown top-level and recognised-entry fields invalidate the whole readiness file
- [ ] Test: any malformed known entry invalidates the whole file; null evidence/time serialises for `never`, `na`, and evaluation errors
- [ ] Test: readiness is false for error/`fail`/`stale`/`never` and for all-`na`, true with at least one `ok`/`warn` and only `na` otherwise, and never produces a score
- [ ] Re-export from `packages/shared/src/index.ts`

## 2. Tier-A derivers: review checks and `stale` · AGE-459

- [ ] Shared review deriver parameterised by the disjoint exact patterns in the spec (TDD)
- [ ] Search OpenSpec and legacy layouts; OpenSpec match wins; archived changes count
- [ ] Parse passing/failed verdict and open-blocker metadata; artifact presence alone never passes
- [ ] Select the latest candidate by UTC committer time/path, then apply `stale` by commit ancestry; timestamps are display/selection metadata, never the freshness relation
- [ ] Default production-code set is tracked and unignored-untracked paths except docs/planning/OpenSpec/root markdown and the configured coverage artifact
- [ ] Relevant dirty or unignored-untracked production changes make evidence stale; uncommitted evidence is current only with no such production change
- [ ] Return effective production include/ignore patterns as trusted declared context; reject a configured scope that becomes empty when the default scope finds production paths
- [ ] Fixture: no artifact → `never`
- [ ] Fixture: fresh artifact → `ok`
- [ ] Fixture: artifact older than last code commit → `stale`
- [ ] Fixture: artifact older than HEAD but newer than last *code* commit → stays `ok`
- [ ] `pen-test`: no tier-A signal, always `never`, remedy text names no tool

## 3. Tier-A deriver: `workflow` · AGE-457

- [ ] Host detection from the present host directory (TDD)
- [ ] Per-host resolution: repo-scoped, machine-global, and unpinnable strategies
- [ ] Resolve host-repo paths through the existing family-roots helper in `packages/agent/src/lib/paths.ts`
- [ ] Status mapping: match → `ok`; skill version trails → `warn`; `implements_spec` trails → `fail`; no artifact → `never`; unpinnable host → `na` + reason
- [ ] Machine-global hosts carry both values; result marks the global one as not repo-specific
- [ ] Set `at`/evidence from the repo-scoped workflow-version/scaffolder metadata commit (or scan time when uncommitted); machine-global context never replaces it
- [ ] Never persist/export machine-global workflow values as repo-owned evidence
- [ ] Resolve machine-global skill paths only through the host-specific named scanner roots with canonical/symlink containment and size bounds
- [ ] `summary` states the frontmatter-comparison limitation and the absence of a migration ledger
- [ ] Fixed fixtures cover global-trails → `fail`, scaffolder-only-trails → `warn`, both-match → `ok`, and unpinnable-host → `na`
- [ ] Fixtures cover unknown host, malformed version artifact, unavailable authorised root, and unsupported layout as per-check errors while the repo/fleet response survives
- [ ] Compact and detail results label machine-global context as applying to every project for that host

## 4. Tier-A deriver: `spec` · AGE-458 — **needs `add-openspec-project-reader`**

- [ ] Consume the existing reader; no directory traversal in this deriver (TDD)
- [ ] Map: no `openspec/` → `never` + hint; 0 open → `ok`; N open → `warn` with count and task ratios; read error → `fail`
- [ ] For no `openspec/`, render a host-specific remedy naming the installed workflow-update command and migration 0032's OpenSpec initialisation; no generic migration-only hint
- [ ] Test: an unmigrated repo yields `never`, and no phase-tree fallback is consulted
- [ ] Confirm by grep that this deriver contains no `openspec/` path literal of its own

## 5. Tier-A deriver: `coverage` · AGE-460

- [ ] Read the configured repo-relative coverage path, default `coverage/coverage-summary.json`, field `total.lines.pct` (TDD)
- [ ] Threshold is bounded 0–100; map ≥threshold `ok`, max(0, threshold−5) to threshold `warn`, lower `fail`
- [ ] Missing file → `never`; unreadable/unparsable/schema-invalid → error-bearing `fail` before freshness; only a parsed numeric result can become `stale`
- [ ] Add `json-summary` to this repo's own vitest coverage reporters so the fleet has one real data point

## 6. Tier-B reader and precedence · AGE-461

- [ ] Read `<repo>/.agenticapps/readiness.json`, per-check precedence over tier A (TDD)
- [ ] Absent file → no error, no notice
- [ ] `schemaVersion` mismatch or unparsable JSON → ignore file entirely **and** raise a visible repo notice
- [ ] Unknown `id` → discard that entry only
- [ ] Declared results carry `source: 'declared'`
- [ ] Malformed known entry or unsafe/oversized path → ignore the whole file and raise the visible notice
- [ ] Review declarations age by ancestry/relevant dirty production paths; expired pen-test declaration → `stale`, retaining declared provenance
- [ ] Integration test: repo declaring only `pen-test` yields five derived and one declared

## 7. Daemon endpoints · AGE-462

- [ ] `GET /api/v2/fleet`, `GET /api/v2/repos/:id`, `POST /api/v2/repos/:id/rescan` in the existing Hono app (TDD)
- [ ] Settled-per-repo and settled-per-check composition — the orchestrator never throws
- [ ] Responses pass through the existing outbound schema-validation wrapper
- [ ] Routes inherit bearer auth and CORS lock, accept no cookie-only path, and unknown repo ids return 404
- [ ] 5-second maximum memo keyed by registry membership, HEAD, relevant dirty/untracked state, readiness file, and machine-global workflow identity
- [ ] Concurrent rescans for one repo coalesce into one computation
- [ ] Keep readiness and machine-global workflow data memory-only; redact absolute paths, usernames, and credentials
- [ ] Registry order preserved; no server-side sort
- [ ] Subprocess test: three fixture repos (complete, empty, broken readiness file) all come back

## 8. Readiness indicator component · AGE-464

- [ ] Six cells, fixed positions, compact and full variants (TDD)
- [ ] Each status distinguishable by shape as well as colour
- [ ] Value rendered in-cell where one exists
- [ ] Per-cell disclosure: check name, status in words, timestamp, provenance
- [ ] Test: all six states; contrast test against tokens green in light **and** dark
- [ ] Snapshot at 1440 px

## 9. Fleet surface · AGE-465

- [ ] Route `/`, one row per repo, name + six checks + last-change time (TDD)
- [ ] Row selection opens detail; cell selection opens detail at that check
- [ ] Combinable filters; family as filter, not grouping
- [ ] Sort descending by evaluation errors, non-error `fail`, `stale`, `never`, `warn`, then UTC committer time with null last; stable repo id asc
- [ ] Test: no coverage data renders as absence, never `0 %`
- [ ] Empty registry leads to onboarding, not an empty table
- [ ] Render the boolean readiness and any unusable-file notice in fleet rows
- [ ] No horizontal scrolling at 1440 px

## 10. Repo detail surface · AGE-466

- [ ] Route `/repos/:id`; header with identity, last commit, full-variant indicator, open-in-editor and rescan (TDD)
- [ ] Six blocks, fixed order, one scrollable page, no tabs/modals/drawers
- [ ] Each block: status in words + timestamp, provenance, evidence link through the existing read route
- [ ] Render em dash for null time/evidence; never invent a timestamp or path
- [ ] Render boolean readiness and any unusable-file notice in the detail header
- [ ] Test: every check has a non-empty remedy text; a six-times-`never` repo shows six usable sentences

## 11. Verify

- [ ] `openspec validate --all` green
- [ ] Fresh independent OpenSpec change review approves the revised artifacts before implementation
- [ ] `pnpm lint` green; per-package tests green
- [ ] Design critique on the two new surfaces at 1440×900, artifact committed
- [ ] Two-stage review
- [ ] **Release gate:** confirm `add-workflow-fleet-conformance` is archived. This change does not fold while it is not.

## Out of scope

- [ ] Do NOT retire any v1 surface here — that is `retire-v1-surfaces`
- [ ] Do NOT add a GSD fallback to the `spec` check
- [ ] Do NOT compute an aggregate score
- [ ] Do NOT select a pen-test tool
- [ ] Do NOT widen the filesystem allow-list or add an execution path
