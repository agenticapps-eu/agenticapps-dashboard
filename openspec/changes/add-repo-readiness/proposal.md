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
  map back to an action. Sorting by count of `fail`, then `never`, replaces the
  ranking.
- **It does not pick a pen-test tool.** The slot is deliberately empty and
  generic. Which tool satisfies it is a mapping question and never appears in the
  UI.
- **It does not touch the security spine.** Every read is inside a registered
  project root or through the existing scanner allow-list. No new execution
  surface. (`add-workflow-fleet-conformance` does widen it, and says so.)

## Relationship to `add-openspec-project-reader`

That change adds a capability panel to the single-project view. This change turns
the same underlying data into the `spec` check's evidence display. **The panel is
not lost at the cutover — it changes address.** Recorded here so nobody later
reads its disappearance from `project-dashboard` as an oversight.

## Open questions

> [GAP: The coverage threshold is global 80, overridable per repo via
> `threshold` in `readiness.json` (E-2 in the design spec). No repo in the fleet
> currently emits `coverage-summary.json` at all, so the default is untested
> against real data. Recommended: ship 80 and revisit once three repos report.]
