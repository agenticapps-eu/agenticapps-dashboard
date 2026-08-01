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

- [x] `packages/shared/src/schemas/readiness.ts`: `CheckId` as an exported const array of the six ids in fixed order (TDD)
- [x] `CheckStatus` with the six values; strict `CheckResult` with required nullable `at`, `value`, `threshold`, `evidence`, and `error`
- [x] `RepoSummary` with stable identity, boolean `ready`, six checks, UTC committer time, and notice; `RepoDetail` adds a non-empty remedy per check
- [x] Strict `ReadinessFileSchema`, `schemaVersion: 1`: bounded declarations, coverage path/threshold, production include/ignore paths
- [x] Require RFC 3339 `observedAt`, evidence path, and full commit SHA for declared review/pen-test results; pen tests also require `validUntil`
- [x] Restrict declared pen-test status to `ok`, `warn`, or `fail`; derive `stale` from expiration, reserve `never` for absence, and reject declared `na`
- [x] Validate every configured/evidence path as bounded, repo-relative, canonical, and symlink-contained
- [x] Reuse the daemon's shared bounded project-read primitive for tier-B/evidence reads; adversarial tests cover traversal, escaping symlinks, and a symlink changed before open
- [x] Every nested object `.strict()`, matching the existing schemas
- [x] Test: `checks` always has length 6 in fixed order; a fully-underivable repo yields six `never`
- [x] Test: `source` is required on every result
- [x] Test: `ReadinessFileSchema` discards an unknown `id` rather than throwing — the one deliberate exception to `.strict()`, commented as such
- [x] Test: unknown top-level and recognised-entry fields invalidate the whole readiness file
- [x] Test: any malformed known entry invalidates the whole file; null evidence/time serialises for `never`, `na`, and evaluation errors
- [x] Test: readiness is false for error/`fail`/`stale`/`never` and for all-`na`, true with at least one `ok`/`warn` and only `na` otherwise, and never produces a score
- [x] Re-export from `packages/shared/src/index.ts`

All sixteen now hold. The three that stayed open through section 1 closed in
sections 2, 5 and 6, where the reads they describe actually happen:
`RepoRelativePathSchema` bounds every declared path by shape, every read of a
declared or evidence path goes through the daemon's contained-read primitive
(`resolveAllowed` for review evidence, `resolveAllowedNamed` for the coverage
artifact and the readiness file), and an expired pen-test declaration ages to
`stale` in the assembler.

## 2. Tier-A derivers: review checks and `stale` · AGE-459

- [x] Shared review deriver parameterised by the disjoint exact patterns in the spec (TDD)
- [x] Search OpenSpec and legacy layouts; OpenSpec match wins; archived changes count
- [x] Parse passing/failed verdict and open-blocker metadata; artifact presence alone never passes
- [x] Select the latest candidate by UTC committer time/path, then apply `stale` by commit ancestry; timestamps are display/selection metadata, never the freshness relation
- [x] Default production-code set is tracked and unignored-untracked paths except docs/planning/OpenSpec/readiness-declaration/root markdown and the configured coverage artifact
- [x] Relevant dirty or unignored-untracked production changes make evidence stale; uncommitted evidence is current only with no such production change
- [x] Return effective production include/ignore patterns as trusted declared context; reject a configured scope that becomes empty when the default scope finds production paths
- [x] Fixture: no artifact → `never`
- [x] Fixture: fresh artifact → `ok`
- [x] Fixture: artifact older than last code commit → `stale`
- [x] Fixture: artifact older than HEAD but newer than last *code* commit → stays `ok`
- [x] `pen-test`: no tier-A signal, always `never`, remedy text names no tool

Closed in section 7, earlier than planned: the detail wire shape requires a
non-empty remedy on every result, so the text had to exist before the endpoint
could answer. `remedy.ts` routes every pen-test state through the readiness file
and names no tool, asserted against a denylist across all six statuses. The
collapsed-scope rejection closed with the assembler in section 6.

## 3. Tier-A deriver: `workflow` · AGE-457

- [x] Host detection from the present host directory (TDD)
- [x] Per-host resolution: repo-scoped, machine-global, and unpinnable strategies
- [x] Resolve host-repo paths through the existing family-roots helper in `packages/agent/src/lib/paths.ts`
- [x] Status mapping: match → `ok`; skill version trails → `warn`; `implements_spec` trails → `fail`; no artifact → `never`; unpinnable host → `na` + reason
- [x] Machine-global hosts carry both values; result marks the global one as not repo-specific
- [x] Set `at`/evidence from the repo-scoped workflow-version/scaffolder metadata commit (or scan time when uncommitted); machine-global context never replaces it
- [x] Never persist/export machine-global workflow values as repo-owned evidence
- [x] Resolve machine-global skill paths only through the host-specific named scanner roots with canonical/symlink containment and size bounds
- [x] `summary` states the frontmatter-comparison limitation and the absence of a migration ledger
- [x] Fixed fixtures cover global-trails → `fail`, scaffolder-only-trails → `warn`, both-match → `ok`, and unpinnable-host → `na`
- [x] Fixtures cover unknown host, malformed version artifact, unavailable authorised root, and unsupported layout as per-check errors while the repo/fleet response survives
- [x] Compact and detail results label machine-global context as applying to every project for that host

Closed in section 7. The deriver still takes each host repo's root and each
machine-global skills root as inputs and reads both through the scanner
resolver, so containment was never in question; what was missing was the caller
that computes them. `service.ts` now derives the host repos from the family root
and the machine-global roots from `workflowScan`'s named-roots policy
(`defaultMachineRoots`, exported for this), so neither is ever supplied by a
request or by a repo's own readiness file.

## 4. Tier-A deriver: `spec` · AGE-458 — **needs `add-openspec-project-reader`**

- [x] Consume the existing reader; no directory traversal in this deriver (TDD)
- [x] Map: no `openspec/` → `never` + hint; 0 open → `ok`; N open → `warn` with count and task ratios; read error → `fail`
- [x] For no `openspec/`, render a host-specific remedy naming the installed workflow-update command and migration 0032's OpenSpec initialisation; no generic migration-only hint

Closed in section 7, once host detection existed to hang it on.
`workflowDeriver` now exports `detectHostId`, the orchestrator threads the
detected host into `remedyFor`, and the unmigrated-spec remedy names that host's
own command — `/update-agenticapps-workflow` on claude,
`$update-codex-agenticapps-workflow` on codex,
`$update-opencode-agenticapps-workflow` on opencode,
`/update-pi-agenticapps-workflow` on pi — together with migration 0032's OpenSpec
initialisation. With no host detected it names no command at all rather than
guessing one, which would be a wrong instruction rather than a vague one.

The deriver's own absent-slot *summary* still carries the generic wording. That
is the summary, not the remedy: this task's obligation is on the remedy text,
and the spec scenario it cites is about what the remedy says.
- [x] Test: an unmigrated repo yields `never`, and no phase-tree fallback is consulted
- [x] Confirm by grep that this deriver contains no `openspec/` path literal of its own

## 5. Tier-A deriver: `coverage` · AGE-460

- [x] Read the configured repo-relative coverage path, default `coverage/coverage-summary.json`, field `total.lines.pct` (TDD)
- [x] Threshold is bounded 0–100; map ≥threshold `ok`, max(0, threshold−5) to threshold `warn`, lower `fail`
- [x] Missing file → `never`; unreadable/unparsable/schema-invalid → error-bearing `fail` before freshness; only a parsed numeric result can become `stale`
- [x] Add `json-summary` to this repo's own vitest coverage reporters so the fleet has one real data point

## 6. Tier-B reader and precedence · AGE-461

- [x] Read `<repo>/.agenticapps/readiness.json`, per-check precedence over tier A (TDD)
- [x] Absent file → no error, no notice
- [x] `schemaVersion` mismatch or unparsable JSON → ignore file entirely **and** raise a visible repo notice
- [x] Unknown `id` → discard that entry only
- [x] Declared results carry `source: 'declared'`
- [x] Malformed known entry or unsafe/oversized path → ignore the whole file and raise the visible notice
- [x] Review declarations age by ancestry/relevant dirty production paths; expired pen-test declaration → `stale`, retaining declared provenance
- [x] Integration test: repo declaring only `pen-test` yields five derived and one declared

## 7. Daemon endpoints · AGE-462

- [x] `GET /api/v2/fleet`, `GET /api/v2/repos/:id`, `POST /api/v2/repos/:id/rescan` in the existing Hono app (TDD)
- [x] Settled-per-repo and settled-per-check composition — the orchestrator never throws
- [x] Responses pass through the existing outbound schema-validation wrapper
- [x] Routes inherit bearer auth and CORS lock, accept no cookie-only path, and unknown repo ids return 404
- [x] 5-second maximum memo keyed by registry membership, HEAD, relevant dirty/untracked state, readiness file, and machine-global workflow identity
- [x] Concurrent rescans for one repo coalesce into one computation
- [x] Keep readiness and machine-global workflow data memory-only; redact absolute paths, usernames, and credentials
- [x] Registry order preserved; no server-side sort
- [x] Subprocess test: three fixture repos (complete, empty, broken readiness file) all come back

Two notes on how these were satisfied. The memo folds in the **whole**
dirty/untracked set rather than the production subset the freshness rules use:
narrowing it needs the readiness file parsed first to learn the configured
scope, and over-invalidating errs in the safe direction. And `generatedAt` on
the fleet is the **oldest** snapshot's stamp, not the moment the response was
assembled — with a per-repo memo the repos have different ages, and the response
must not claim a currency its replayed parts do not have.

Redaction is enforced by the shared schema rather than by a scrubbing pass here:
error and notice text is `SanitisedTextSchema`, so a leaked absolute path fails
outbound validation as `schema_drift` instead of reaching the client. Remedy
text is deliberately exempt (`RemedySchema`) because two hosts spell their
update command with a leading slash; its own tests apply the sanitiser rule to
everything but those four commands.

## 8. Readiness indicator component · AGE-464

- [x] Six cells, fixed positions, compact and full variants (TDD)
- [x] Each status distinguishable by shape as well as colour
- [x] Value rendered in-cell where one exists
- [x] Per-cell disclosure: check name, status in words, timestamp, provenance
- [x] Test: all six states; contrast test against tokens green in light **and** dark
- [ ] Snapshot at 1440 px — **deferred to §9**, see 8.1

### 8.1 The snapshot and the critique wait for a route

`ReadinessIndicator` is not mounted anywhere yet; §9 and §10 are what put it on
a surface. A 1440 px snapshot taken now would have to render it through a
harness route built for the screenshot and deleted afterwards, which measures
the harness rather than the product. The same applies to the `impeccable:critique`
run CLAUDE.md requires of every frontend-touching change: it runs *against
affected routes*, and this change affects none until the fleet surface exists.

Both are therefore carried into §9 rather than skipped, and §9 is not complete
until the fleet route has been snapshotted at 1440 px and critiqued at the ≥ 80
composite floor with the readiness cells visible in both appearances.

Stage-two review added two more §9 obligations:

- **The cell's disclosure must stop being a `title` when the cell becomes a
  control.** Today the cell is non-interactive and follows `CoverageCell`'s
  `aria-label` + `title` precedent, which reaches assistive tech and pointer
  users but not a sighted keyboard user — acceptable while nothing is focusable.
  The spec requires selecting a cell to open the detail at that check, so §9
  turns it into a control, and a focusable control carrying a native `title` is
  exactly what `ui/Tooltip.tsx` exists to replace: it opens on focus, closes on
  Escape, and portals out of the containing block, all three of which a cell
  inside a `table-fixed` row will need.
- **§9 must supply the column headers.** The compact variant is six unlabelled
  14 px glyphs; check identity lives only in the accessible name. That is right
  for a one-row-per-repo table, but it means the table owes the labels, and the
  component deliberately does not.

### 8.3 Carried into §11 (Verify): `force` is dropped on a coalesced rescan

Found by stage-two review, pre-existing in §7 and deliberately not fixed here —
it is a different section's code and a fix belongs with a test that names the
behaviour, not bundled into §8.

`snapshotFor` returns an in-flight promise before it consults `force`. A forced
`rescanRepo` that arrives while an *unforced* `readFleet`/`readRepo` is still in
flight therefore joins the unforced computation and can be answered from the
memo — so a rescan the user explicitly asked for may silently return the cached
snapshot. The §7 tests do not cover a forced rescan racing an unforced read;
both callers in the coalescing test are forced, which is why it went unnoticed.

### 8.2 Colour answers "is something wrong?", not "does this block?"

The six statuses share four colour pairings; shape is what separates all six.
The colour channel had two defensible readings and the choice is recorded here
because §9 and §10 inherit it.

**Chosen:** `ok` green, `warn` and `stale` amber, `fail` red, `never` and `na`
neutral grey.

**Rejected: colour tracks the readiness predicate** — `fail`, `stale` and
`never` all red, because all three block `ready`. It is the more literal reading
of design.md §2, and it was rejected because design.md §3 is equally explicit
that `never` is not `fail`: an unrun check is a gap in process, not a defect in
the product. `pen-test` is expected to sit at `never` across the entire fleet at
launch, so this mapping paints every repo substantially red on day one — the
"makes every young repo look broken" failure the six-value vocabulary was
introduced to avoid.

**Rejected: `stale` gets its own colour** (`status-info`). Aged evidence is
arguably its own category, but blue reads as informational and understates that
`stale` blocks readiness, and it would add the one tinted `status-info` pairing
this palette has so far avoided asserting.

Blocking-ness is carried by the boolean `ready`, which is computed from the six
results. It does not need to be re-encoded in the colour, and encoding it there
costs the distinction §3 exists to preserve.

## 9. Fleet surface · AGE-465

- [x] Route `/fleet` (see §9.1), one row per repo, name + six checks + last-change time (TDD)
- [x] Row selection opens detail; cell selection opens detail at that check
- [x] Combinable filters; family as filter, not grouping
- [x] Sort descending by evaluation errors, non-error `fail`, `stale`, `never`, `warn`, then UTC committer time with null last; stable repo id asc
- [x] Test: no coverage data renders as absence, never `0 %`
- [x] Empty registry leads to onboarding, not an empty table
- [x] Render the boolean readiness and any unusable-file notice in fleet rows
- [ ] No horizontal scrolling at 1440 px
- [ ] 1440 px snapshot in both appearances, carried from §8.1
- [ ] `impeccable:critique` at the ≥ 80 composite floor, carried from §8.1

### 9.1 The fleet mounts at `/fleet`, not at `/`

The task line above originally said `/`. The same file puts "do NOT retire any
v1 surface here" out of scope, and `/` is `MultiProjectHome` — a v1 surface. The
two lines cannot both be honoured.

`/fleet` is additive and follows the precedent set one change earlier:
`add-workflow-fleet-conformance` mounted `/workflow` beside the v1 routes rather
than displacing anything. `retire-v1-surfaces` §1 already owns the migration
manifest that repoints the four retired legacy routes at the fleet, and it does
that in **one commit** so the cutover reverts as one — taking `/` here would
split that rollback across two changes.

Confirmed with the user before any code was written.

### 9.2 §10's route and header landed in §9

§9's rows and cells must open `/repos/$repoId`. A TanStack `Link` does not
typecheck against an unregistered route, and shipping links to a 404 is not an
option, so the route had to exist before §9 could close. The user chose to move
§10's first task line into §9 rather than leave §9 at seven of eight lines and
critique a table whose rows do not open anything.

Landed here: the route, `useRepoDetail`, and the header — identity, family, last
commit, the boolean, any notice, and the full-variant indicator.

Still §10: the six evidence blocks, per-check remedies, evidence links through
the existing read route, open-in-editor, and rescan. §10's first line is
therefore already partly discharged; what remains of it is the two actions.

### 9.3 `Tooltip` gained an opt-out rather than being used as-is

§8.1 said the cell's disclosure should stop being a native `title` once the cell
became a control, and named `ui/Tooltip` as the replacement. Used as written it
would have made the keyboard path worse: the trigger carries its own
`tabIndex={0}` and dotted underline, which are right for the column headers it
was built for and wrong in front of something already focusable. A six-check row
would have cost twelve tab stops instead of six.

`interactiveChild` says the child can already be focused, so the wrapper adds
neither the tab stop nor the decoration. Open and close are untouched — React's
focus and keydown events bubble — and there is a test that pins exactly that,
which passed before the prop existed. That is the point of it: the prop must not
cost the behaviour it is wrapping.

### 9.4 The status filter omits `ok` and `na`

Four chips, not six. A list of repos with at least one passing check is every
repo, and the same holds for `na`; those two chips would narrow nothing while
looking like they had. The four that remain are the four that mean work.

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
