## Context

The dashboard can say whether a repository is in good order. It cannot say what
is moving through one. `repo-readiness` answers "is this repo healthy"; nothing
answers "what work is in flight, and where has it got to".

`agents-task-viewer` answers exactly that in a terminal. Its 2026-07-28 change
`repository-centric-openspec-board` made **one repository-local OpenSpec change,
rather than one host session, the atomic card**, and demoted host sessions to an
evidence-based `N active` count decorating each card. That inversion is what
makes this surface cheap to build: the card corpus became `openspec/` files plus
git, which the daemon already reads.

The blocking constraint is not technical. `openspec/CAPABILITY-MAP.md` records
that `retire-v1-surfaces` may not run until an agent-change surface exists, and
that note has misdescribed the upstream work as in-flight since the day it
archived. This change removes the obstacle by building the surface, rather than
by superseding a ratified decision.

The full brainstorming record, including the layout options considered and
rejected, is at
`docs/superpowers/specs/2026-08-03-agent-change-surface-design.md`.

## Goals / Non-Goals

**Goals:**

- One fleet-wide board answering "what is in flight, at what stage" across every
  registered repository.
- Stage classification that agrees with the terminal board, so the two do not
  disagree about the same repository.
- Degradation that names what it lost, per repository.
- No amendment to the security spine.

**Non-Goals:**

- **Live agent-session counts.** `activeSessionCount`, `activeByHost` and
  `supportingTasks` are out. They need the host adapters, which need
  `agents-task-viewer` converted to a consumable package (DASHBOARD-V2-SPEC E-3).
- Any change to `agents-task-viewer`.
- A per-repository change section on `/repos/:id`. Additive; propose it once the
  board exists.
- Running the `retire-v1-surfaces` cutover.
- Widening `GIT_ALLOWED_CMDS` or the four authorised spawn sites.

## Decisions

### 1. Re-derive the stage machine rather than import upstream's

**Rejected: import `agents-task-viewer`'s `tracker.ts`.**

One definition, no drift — clearly better in principle. It is not available in
practice: `agents-task-viewer` is `private: true`, declares no `exports` or
`main`, has no build script, and is a Bun + OpenTUI application. Consuming it
means performing the E-3 workspace-and-package conversion in another repository
before any dashboard surface can exist, which is a cross-repo project standing in
front of a single page.

**Chosen: re-derive in the daemon, naming ADR 0004 as the origin**, with test
fixtures mirrored from upstream's `src/openspec/__fixtures__` so the two
classifiers are checked against the same inputs.

The cost is real and is accepted: two definitions of "validate" now exist and
must be kept in step by hand. The mitigation is that the divergence is *stated*
rather than discovered — see decision 2 — so a future reader compares two
documented rules instead of two behaviours.

### 2. Diverge from ADR 0004 on reviewer verdicts

ADR 0004 advances a change past Validate on "two distinct approved reviewer
sections". It counts approvals and never subtracts rejections.

Applied literally to this repository, `retire-v1-surfaces` — claude APPROVE,
opencode APPROVE, gemini REQUEST-CHANGES, codex REQUEST-CHANGES — reads as
approved and lands in Execute. That is the wrong answer. This project's whole
posture is that a rejection is dispositioned, not outvoted; the discipline
recorded in `CLAUDE.md` and exercised in the sanitiser change is to fix confirmed
REQUEST-CHANGES findings before folding a delta.

**Chosen: a reviewer counts only while their latest verdict approves.** Under
that rule the change sits in Validate, which is where two unanswered rejections
should put it.

Recorded as a requirement rather than a code comment, because it is the one place
the two boards will legitimately disagree about the same repository, and the
first person to notice should find the reason rather than file a bug.

### 3. A new reader module, not an extension of `openspecReader.ts`

**Rejected: widen `openspecReader.ts`.** It already returns open changes, task
counts and archived names — most of what a card needs.

It is also on the hot path for the `spec` readiness check and repo detail, and
the board additionally needs `REVIEWS.md` parsing and a git probe per archived
change. Widening it makes every readiness scan pay for board data it never
renders, on a fleet endpoint whose latency is already a recorded concern.

**Chosen: `lib/changes/` reads independently.** The duplicated directory listing
is the price, and it is written down here so a reviewer reads it as a decision.

The two readers answer different questions and should be free to diverge: the
readiness check wants presence and counts, the board wants artifacts, verdicts
and rows.

### 4. One bound, and per-repository settlement

The board reuses the `withinBound` + `Promise.allSettled` shape from
`readiness/service.ts`: race an unref'd timer, settle every repository
independently so one failure drops one repository's rows.

It deliberately does **not** copy readiness's two sequential bounds. That second
bound exists there only because every repository's cache key derives from a fleet
signature computed first. The board has no such dependency, so its worst case is
one bound rather than two.

`withinBound` bounds *the wait*, not the work — a blocked filesystem call keeps
running and the endpoint stops waiting for it. That limitation is inherited
knowingly; threading an `AbortSignal` through the shared read primitive is the
principled fix and belongs to that primitive, not to this board.

### 5. Ship-versus-Archive through the existing bounded-git site

`GIT_ALLOWED_CMDS` is `['log', 'status', 'diff-stat', 'branch']`, and
`add-workflow-fleet-conformance` closes process-spawn authorisation at exactly
four sites.

Proving an archive entry is on `main`/`origin/HEAD` is expressible as
`git log <ref> -- openspec/changes/archive/<name>`, which uses the permitted
`log` subcommand through the existing site. No new subcommand, no fifth site, no
amendment to `filesystem-access-policy`.

**A failed probe resolves to `archive`, never `ship`.** Absence of evidence takes
the weaker claim; a board that reports "shipped" on a failed check is worse than
one that reports "archived" on a successful ship.

### 6. Kanban, chosen over two denser alternatives

**Rejected: a dense table**, one row per change with stage as a sortable column.
It reuses the Fleet readiness table wholesale and is the least new code. It also
demotes stage from a *place* to a value you scan for, which is the entire reading
the board exists to provide.

**Rejected: a stage-grouped table**, stages as section headers with dense rows
beneath. It keeps pipeline order and full names, and it was the recommendation.
It was not chosen.

**Chosen: five kanban columns**, mirroring the terminal board that already has
this job, on the reasoning that recognition across the two surfaces is worth more
than the density a table would buy.

Two consequences are handled rather than absorbed. Long names wrap to two lines
instead of truncating — the terminal elides because a cell grid forces it, and
all four change names in the current fleet that exceed one line fit whole in two.
And because five columns cannot fit a small viewport, the board pages one stage
at a time behind a stage rail below a 180px minimum column width, which is the
mechanism the terminal board already uses when narrow.

### 7. Two search parameters, never one composite

The drawer is addressable as `?repo=<id>&change=<name>`.

A single `repo:name` parameter needs a separator, a separator needs a parser, and
a parser over author-controlled names is precisely the shape that produced
`fix-readiness-sanitiser-colon-hazard`: a legal change name containing the
separator becomes an injection into the surrounding grammar. Two parameters need
no parsing at all, so the failure mode does not exist rather than being guarded.

## Risks / Trade-offs

**Two stage definitions drift apart.** → The divergence is specified, not
implicit, and the classifier is tested against fixtures mirrored from upstream's.
A conformance test that runs upstream's fixtures through this classifier was
considered and deferred: it would pin the two together, but it requires importing
fixtures across a repository boundary, which is the coupling decision 1 declines.
Accepted, and named here so it is a known gap rather than a surprise.

**The board is the most expensive read the daemon performs.** It walks
`openspec/changes/`, `openspec/changes/archive/` and `BACKLOG.md` per repository
and probes git per archived change. → Its own endpoint with its own bound, so it
cannot slow readiness; per-repository settlement, so it cannot be withheld by one
repo. If the archive walk proves too costly in practice, the fallback is
active-only cards, which removes two of five columns — a product regression, so
it is a fallback and not the plan.

**A kanban sits against the design-system's direction.** `retire-v1-surfaces`
adds `Dense Rows And Aligned Figures`, whose scenario reads "every row is the
same height, rather than a card-sized block". → A kanban is not a list or table
surface, so it is not literally caught; but that change must scope the
requirement explicitly or grant this board a stated exception. Silence would
leave two documents disagreeing.

**Reviewer parsing is only as good as `REVIEWS.md` conventions.** The gate itself
reports some `REVIEWS.md` files as unverifiable (trailer-absent). → A change whose
verdicts cannot be read classifies as `validate`, the same as one with too few
approvals: the board never advances a change on evidence it could not parse.

**The `N active` row is designed out, not designed around.** The terminal card has
three rows and this one has two. → The card's layout must not assume a fixed row
count, so adding the session row later is additive rather than a rewrite.

## Migration Plan

None. This change adds a surface and an endpoint; it removes nothing and changes
no existing wire contract. Rollback is reverting the change.

Two ordering notes:

- This change does **not** depend on `retire-v1-surfaces`. It stands alone on the
  current SPA, alongside the v1 surfaces, and unblocks that change rather than
  waiting for it.
- Once this ships, `openspec/CAPABILITY-MAP.md` needs a dated note recording that
  the agent-board prerequisite is discharged. That belongs to whoever runs the
  cutover, appended and never edited in, per that document's own rule.

## Open Questions

- **Does the drawer need a link out to `/repos/:id`?** Deliberately omitted for
  now; the two surfaces answer different questions and the link is additive.
- **Should the stage rail persist at wide viewports?** The terminal shows it in
  pager mode only. Retaining it at every width would give the board a stable
  summary line; it also duplicates the column headers.
- **How should a change appear that exists in two registered repositories under
  the same name?** Upstream reports a `collision` limit notice. This design
  carries cards keyed by repository so no merge occurs, but the surface does not
  yet distinguish two same-named changes visually beyond their repository label.
