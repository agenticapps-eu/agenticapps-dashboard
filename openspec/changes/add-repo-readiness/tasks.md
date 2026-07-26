# Tasks

Depends on `add-openspec-project-reader` for task 4. Everything else is
independent of it.

## 1. Shared vocabulary (do first — everything binds to it) · AGE-456

- [ ] `packages/shared/src/schemas/readiness.ts`: `CheckId` as an exported const array of the six ids in fixed order (TDD)
- [ ] `CheckStatus` with the six values; `CheckResult` with `id, status, at?, value?, threshold?, summary?, evidence?, source`
- [ ] `RepoSummary` (identity + `checks` + `lastCommitAt`) and `RepoDetail` (summary + per-check `remedy`)
- [ ] `ReadinessFileSchema` for the tier-B file, `schemaVersion: 1`
- [ ] Every nested object `.strict()`, matching the existing schemas
- [ ] Test: `checks` always has length 6 in fixed order; a fully-underivable repo yields six `never`
- [ ] Test: `source` is required on every result
- [ ] Test: `ReadinessFileSchema` discards an unknown `id` rather than throwing — the one deliberate exception to `.strict()`, commented as such
- [ ] Re-export from `packages/shared/src/index.ts`

## 2. Tier-A derivers: review checks and `stale` · AGE-459

- [ ] Shared review deriver parameterised by file pattern (TDD)
- [ ] Search OpenSpec and legacy layouts; OpenSpec match wins; archived changes count
- [ ] `stale` rule: newest artifact mtime versus last commit touching production code
- [ ] Production-code path set excludes `docs/`, `.planning/`, `openspec/`, root-level `*.md`
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
- [ ] `summary` states the frontmatter-comparison limitation and the absence of a migration ledger
- [ ] Fixture: this repo itself — installed `implements_spec` trails what its host ships → must be `fail`

## 4. Tier-A deriver: `spec` · AGE-458 — **needs `add-openspec-project-reader`**

- [ ] Consume the existing reader; no directory traversal in this deriver (TDD)
- [ ] Map: no `openspec/` → `never` + hint; 0 open → `ok`; N open → `warn` with count and task ratios; read error → `fail`
- [ ] Test: an unmigrated repo yields `never`, and no phase-tree fallback is consulted
- [ ] Confirm by grep that this deriver contains no `openspec/` path literal of its own

## 5. Tier-A deriver: `coverage` · AGE-460

- [ ] Read `coverage/coverage-summary.json`, field `total.lines.pct` (TDD)
- [ ] Status mapping against threshold; default 80; tier-B `threshold` overrides
- [ ] Missing file → `never`; unparsable → `fail` with summary; stale rule applies regardless of value
- [ ] Add `json-summary` to this repo's own vitest coverage reporters so the fleet has one real data point

## 6. Tier-B reader and precedence · AGE-461

- [ ] Read `<repo>/.agenticapps/readiness.json`, per-check precedence over tier A (TDD)
- [ ] Absent file → no error, no notice
- [ ] `schemaVersion` mismatch or unparsable JSON → ignore file entirely **and** raise a visible repo notice
- [ ] Unknown `id` → discard that entry only
- [ ] Declared results carry `source: 'declared'`
- [ ] Integration test: repo declaring only `pen-test` yields five derived and one declared

## 7. Daemon endpoints · AGE-462

- [ ] `GET /api/v2/fleet`, `GET /api/v2/repos/:id`, `POST /api/v2/repos/:id/rescan` in the existing Hono app (TDD)
- [ ] Settled-per-repo and settled-per-check composition — the orchestrator never throws
- [ ] Responses pass through the existing outbound schema-validation wrapper
- [ ] 5-second memo consistent with the existing overview cache
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
- [ ] Sort: `fail` count, then `never` count, then most recent change
- [ ] Test: no coverage data renders as absence, never `0 %`
- [ ] Empty registry leads to onboarding, not an empty table
- [ ] No horizontal scrolling at 1440 px

## 10. Repo detail surface · AGE-466

- [ ] Route `/repos/:id`; header with identity, last commit, full-variant indicator, open-in-editor and rescan (TDD)
- [ ] Six blocks, fixed order, one scrollable page, no tabs/modals/drawers
- [ ] Each block: status in words + timestamp, provenance, evidence link through the existing read route
- [ ] Test: every check has a non-empty remedy text; a six-times-`never` repo shows six usable sentences

## 11. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; per-package tests green
- [ ] Design critique on the two new surfaces at 1440×900, artifact committed
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT retire any v1 surface here — that is `retire-v1-surfaces`
- [ ] Do NOT add a GSD fallback to the `spec` check
- [ ] Do NOT compute an aggregate score
- [ ] Do NOT select a pen-test tool
- [ ] Do NOT widen the filesystem allow-list or add an execution path
