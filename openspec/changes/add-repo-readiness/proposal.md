# Answer one question per repo: is it production-ready?

## Why

The dashboard drifted into being an observability tool for the workflow. It
renders skill drift, conformance scores, a coverage matrix of *tooling*, Sentry
health, secrets status, and a twelve-panel project view. What it never answers
is the question someone actually opens it with: **is this repo production-ready,
and if not, what is missing?**

The answer today is scattered across surfaces that each use their own vocabulary.
A repo can be green on the coverage matrix, tiered on conformance, and still have
never had a security review — and nothing on any page says so.

This change replaces that with **six checks, always the same, always in the same
order, for every repo**: `workflow` · `spec` · `code-review` · `security-review`
· `pen-test` · `coverage`. One vocabulary of six status values. No aggregate
score.

Linear: AGE-456, AGE-457, AGE-458, AGE-459, AGE-460, AGE-461, AGE-462, AGE-464,
AGE-465, AGE-466. Design basis: `docs/spec/DASHBOARD-V2-SPEC.md` §4, §5.

## What changes

1. **A six-check readiness model** with a fixed identity and order, a six-value
   status vocabulary, and an honesty rule: a check that cannot run says so, and
   is never rendered as `0 %` or as a green tick for "no data".
   A repo is ready only when none of its checks is `fail`, `stale`, or `never`
   and no check carries an evaluation error. `warn` is a visible, non-blocking
   caveat and `na` is excluded from the predicate; at least one applicable check
   must remain. This is a boolean rule, not a score. Because pen-test is
   declared-only and blocks as `never`, the accepted launch state is that repos
   without a declared pen test are not ready; the six cells remain the useful
   explanation rather than the boolean becoming a ranking.
2. **Two-tier provenance.** Tier A derives from what is already on disk, so the
   dashboard shows something real on day one without a single repo changing.
   Tier B is an optional `<repo>/.agenticapps/readiness.json` that wins **per
   check**, so a repo can report what the daemon cannot derive.
3. **Four derivers** — `workflow` (host-dependent), the three review checks with
   the `stale` state, and `coverage` (test coverage, read from
   `coverage/coverage-summary.json`).
4. **The `spec` check consumes the existing OpenSpec reader.** It builds no
   second reader.
5. **`/api/v2/fleet`, `/api/v2/repos/:id`, `/api/v2/repos/:id/rescan`**, running
   in the same Hono app and inheriting the existing auth and CORS middleware.
6. **Two surfaces**: a fleet table with one row per repo, and a repo detail page
   with six blocks carrying evidence and, where a check has never run, a
   sentence saying how to make it run.

## Capabilities

- `repo-readiness` (new)

## What this change explicitly does not do

- **It does not retire anything.** The v1 surfaces it will eventually replace —
  the home cards, the three-column project view, the coverage matrix, the
  conformance page — all stay deployed and specified. Their withdrawal is
  `retire-v1-surfaces`, at the cutover. Until then both are true: the old SPA
  renders cards, the new one renders the table, and the spec slot describes both
  because both exist.
- **It does not build a second OpenSpec reader.** AGE-458 was cut back to
  "consume the reader" precisely because two readers over the same directory is
  the drift this fleet's discipline exists to prevent. The reader is
  `add-openspec-project-reader`, and this change depends on it.
- **It does not add a GSD fallback for the `spec` check.** Retiring the GSD
  reader blanks eight not-yet-migrated repos, including `claude-workflow` and
  `factiv/cparx`. They render `—` in the `spec` column. That is the wanted
  behaviour: the column exists to make the migration backlog visible, and a
  fallback would hide exactly the information it was added to show.
- **It does not compute an aggregate score.** No per-repo percentage, no fleet
  score. The conformance page demonstrated where that leads — a number nobody can
  map back to an action. A fixed severity sort replaces the ranking.
- **It does not pick a pen-test tool.** The slot is deliberately empty and
  generic. Which tool satisfies it is a mapping question and never appears in the
  UI.
- **It adds no execution surface.** No deriver spawns a process.
- **It does not itself widen the filesystem allow-list — but it depends on a
  widening made elsewhere.** The `workflow` check reads the machine-global skill
  directories of the hosts that install skills machine-wide. Those paths lie
  outside every registered project root, so this change is only safe under the
  `Named Allowed Roots For Fleet Scanners` requirement as modified by
  `add-workflow-fleet-conformance`. That dependency is named here rather than
  asserted: a reviewer reading this change alone would otherwise have to take
  "the spine is untouched" on trust, and it would not be true.
- **It does not treat gitignored output as production code.** Untracked source
  files count; ignored dependencies, build output, and the configured coverage
  artifact do not age review evidence.

## Relationship to `add-openspec-project-reader`

That change adds a capability panel to the single-project view. This change turns
the same underlying data into the `spec` check's evidence display. **The panel is
not lost at the cutover — it changes address.** Recorded here so nobody later
reads its disappearance from `project-dashboard` as an oversight.

## Review findings resolved

- Coverage defaults to 80%; 75–79.99% is `warn` and below 75% is `fail`.
  Both the artifact path and threshold may be overridden in the repo-local
  readiness file.
- Tier-B review and pen-test claims require evidence metadata and bounded
  timestamps; declarations remain author claims, but they cannot be anonymous or
  timeless.
- Readiness is an explicit boolean predicate over the six results, while the UI
  continues to show the individual evidence and no aggregate score.
- Production-code paths, review evidence matchers, cache freshness, endpoint
  behaviour, and filesystem containment are specified rather than left to the
  implementation.
- Evidence read/parse/schema errors take precedence over freshness; only parsed
  evidence can be classified as stale.
- Workflow timestamps come from repo-scoped workflow metadata, never from a
  machine-global value, and null repository commit times sort last.
- Declared pen tests use `ok`, `warn`, or `fail`; expiration derives `stale`,
  absence derives `never`, and declared `na` is invalid.
- The legacy `stage_2_verdict` key is accepted only for code-review evidence;
  security-review evidence retains its `verdict`-only contract.
- Tier-B paths reuse the daemon's shared contained-read primitive; workflow
  layout failures degrade only their check; effective production-path overrides
  are visible and cannot collapse a non-empty default scope to empty.
- The unmigrated OpenSpec remedy names the detected host's workflow update
  command and migration 0032, which performs OpenSpec initialisation.
