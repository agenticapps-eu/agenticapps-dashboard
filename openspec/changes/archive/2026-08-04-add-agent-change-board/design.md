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
- Stage classification derived from the terminal board's current classifier, so
  the two agree about the same repository except in the one place this one
  deliberately does not: no `ship` stage.
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
- **A `ship` stage.** Deferred to its own change with its own
  `filesystem-access-policy` delta — see decision 5.

## Decisions

### 1. Re-derive the stage machine rather than import upstream's

**Rejected: import `agents-task-viewer`'s `tracker.ts`.**

One definition, no drift — clearly better in principle. It is not available in
practice: `agents-task-viewer` is `private: true`, declares no `exports` or
`main`, has no build script, and is a Bun + OpenTUI application. Consuming it
means performing the E-3 workspace-and-package conversion in another repository
before any dashboard surface can exist, which is a cross-repo project standing in
front of a single page.

**Chosen: re-derive in the daemon, naming the current classifier
(`src/openspec/reader.ts`) and ADR 0008 as the origin**, with test fixtures
mirrored from upstream's `src/openspec/__fixtures__` so the two classifiers are
checked against the same inputs.

**Read the implementation, not only the ADR.** Decision 2 originally cited ADR
0004 and argued at length for a divergence that the current classifier does not
have. ADRs record a decision at a moment; the classifier is what the other board
actually does today. Where they disagree, the code is the origin and the ADR is
history.

**And it is the whole reader, not just the stage machine.** Round 3 made the
scope of that mistake clear. `reader.ts` already contains, tested and working:
`parseBacklog` (code-fence aware, with anchored closed-marker matchers),
`backlogSlug`, `sourceIdentity`, `occupiedSlugs` deduplication,
`MAX_SOURCE_RECORDS` with a `truncated` notice, `parseChecklist`, and a symbolic
notice vocabulary (`collision`, `empty-slug`, `evidence-limited`, `malformed`,
`rejected`, `truncated`). Three review rounds spent their findings on the seams
in hand-written substitutes for each of those — substring markers that closed
`Redone migration`, an identity of heading-text-plus-index that reintroduced the
separator hazard decision 7 exists to avoid, an archive-only bound that
contradicted the corpus requirement.

**So the corpus rules are cited, not restated.** The delta now names the upstream
functions and specifies only what departs from them. The rule of thumb this
change paid three rounds to learn: when a specification and a working
implementation of the same behaviour both exist, write the specification against
the implementation.

The cost is real and is accepted: two definitions of "validate" now exist and
must be kept in step by hand. The mitigation is that the divergence is *stated*
rather than discovered — see decision 2 — so a future reader compares two
documented rules instead of two behaviours.

### 2. The reviewer rule, and two rounds of getting it wrong

**The rule: two distinct approvals and no standing request for changes.** It is
worth recording how this decision arrived there, because both wrong turns were
the same mistake at different depths.

**Draft 1 — "a reviewer counts only while their latest verdict approves."**
Written to hold `retire-v1-surfaces` (claude APPROVE, opencode APPROVE, gemini
REQUEST-CHANGES, codex REQUEST-CHANGES) at Validate. It does not: all four
verdicts are from *distinct* reviewers, each one their latest, so two still
approve and the change still advances. A filter cannot express a veto. Refuted by
its own worked example, by two of three reviewers independently.

**Draft 2 — the veto, argued as a deliberate divergence from ADR 0004.** The rule
was right and the justification was fiction. Upstream's classifier already does
exactly this:

```js
if (input.hasRequestChanges || distinctReviewers.size < 2 || input.checklist.length === 0) {
  return "validate"
}
```

ADR 0004's prose — the sole source for two rounds of argument — describes neither
the current classifier nor ADR 0008. A long, careful case was made for departing
from a rule nobody follows, including a passage explaining that the board is
"deliberately stricter than this repository's ratified gate". It is not stricter
than anything. It matches.

**What survives.** The rule, unchanged. What goes: the divergence framing, the
appeal to project posture, and the claim about gate 2.0.0 — which was itself
overstated, as round-1 review said, and is now simply irrelevant. The board
displays a stage; it enforces nothing, so what the gate enforces never entered
into it.

**What this cost.** Two review rounds spent adjudicating a difference that does
not exist, and a spec requirement whose stated origin was wrong. The check that
would have caught it at the start is `grep` in the upstream classifier — cheaper
than either round.

Recorded as a requirement rather than a code comment, because it is the rule two
independent classifiers have to keep agreeing on, and the parse grammar it rests
on — `## Reviewer:` sections, `VERDICT:` lines, case-insensitive vendor dedup —
is a contract between them rather than an implementation detail of either.

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

**The bound is not a substitute for a cache, and the durable spec already says
so.** `daemon-runtime` → `Response Caching Cadences` requires expensive
computations to be cached server-side, naming "derived fleet aggregates on their
own cadence" with explicit invalidation. This endpoint is one, so it is cached —
no delta required, because the requirement already binds it. The change simply
did not comply until round-2 review pointed at the citation.

### 5. No Ship stage — the probe does not fit the security spine

**Rejected: `git log <ref> -- openspec/changes/archive/<name>` through the
existing bounded-git site.** This was the original design, and it is not
implementable as written. Three things are wrong with it, found in plan review
and each verified against the code:

1. **The site takes no such arguments.** `runAllowedGit(cmd, cwd)` in
   `packages/agent/src/lib/git.ts` maps every allow-listed subcommand to a fixed
   argv — `log` is `['log', '--oneline', '-20']` — and the only request-derived
   value it accepts is the working directory. The probe cannot go "through the
   existing site"; the site would have to grow argument passing first.
2. **That growth is the thing the spine forbids.** The ref is bounded, but the
   archive directory name is a string read out of a project tree, and
   `filesystem-access-policy` states for spawn site 3 that "change names,
   capability names, file names, and every other string read out of a project
   tree MUST NOT reach the argument vector". The git site's fixed argv is that
   same rule made structural. Adding a parameter is a policy amendment, not a
   refactor.
3. **`log` is the wrong probe anyway.** It proves an archive path was *touched in
   history*, not that the ref *currently contains* it — a deleted archive entry
   would classify as shipped. A deletion-safe proof needs `ls-tree` or
   `cat-file -e`, neither of which is in `GIT_ALLOWED_CMDS`.

Only the "no fifth spawn site" half of the original claim survives: `integrations.ts`
and `linear.ts` already call `runAllowedGit` from routes other than
`GET /api/projects/{id}/git`, so the bounded function — not the route — is the
site by established practice.

**Chosen: drop the `ship` stage.** Archived is archived; the board never claims a
change has landed. This keeps "the security spine is not amended" literally true
rather than technically-true-and-misleading, and it means the board spawns no
process at all.

The stage is not abandoned, it is unbundled: a `ship` stage is a change to
`filesystem-access-policy` with its own delta, its own argv discipline (closed
ref set, a strict `YYYY-MM-DD-<slug>` validator, a deletion-safe subcommand), and
its own review pass. That work should not ride in on a surface change.

### 6. Kanban, chosen over two denser alternatives

**Rejected: a dense table**, one row per change with stage as a sortable column.
It reuses the Fleet readiness table wholesale and is the least new code. It also
demotes stage from a *place* to a value you scan for, which is the entire reading
the board exists to provide.

**Rejected: a stage-grouped table**, stages as section headers with dense rows
beneath. It keeps pipeline order and full names, and it was the recommendation.
It was not chosen.

**Chosen: kanban columns**, mirroring the terminal board that already has this
job, on the reasoning that recognition across the two surfaces is worth more than
the density a table would buy. Four of them, per decision 5.

Two consequences are handled rather than absorbed. Long names wrap to two lines
instead of truncating — the terminal elides because a cell grid forces it, and
all four change names in the current fleet that exceed one line fit whole in two.
And because four columns still cannot fit a small viewport, the board pages one
stage at a time behind a stage rail below a 180px minimum column width, which is
the mechanism the terminal board already uses when narrow.

### 6b. Fix the data, not the parser

This repository's `openspec/BACKLOG.md` did not match the convention upstream's
`parseBacklog` expects. Its two closed entries used a trailing `✅ RESOLVED` in
the heading and a `**Status: ✅ RETIRED 2026-07-26 by explicit decision.**` body
line; upstream's matchers are anchored — a bracketed or `MARKER:` prefix, or a
body line ending at the marker — so both entries read as **open**.

**Rejected: loosen the matcher to a substring test.** That was the round-3
draft, and reviewers immediately found what it costs: `Redone migration` and
`Add WITHDRAWN flag support` close as resolved. A rule loose enough to catch our
idiosyncratic file is loose enough to close entries nobody resolved.

**Chosen: correct the two entries** to `## [RESOLVED] …` and `**Status:**
RETIRED`. One editorial edit, no divergence to maintain, and both boards then
read the file identically — verified by running upstream's unmodified regexes
over the corrected file: two closed, one open.

The general form: when local data does not fit a shared parser, the parser is
usually not the thing that is wrong.

### 7. Separate search parameters, never one composite

The drawer is addressable as `?repo=<id>&source=<source>&change=<name>`.

A single `repo:name` parameter needs a separator, a separator needs a parser, and
a parser over author-controlled names is precisely the shape that produced
`fix-readiness-sanitiser-colon-hazard`: a legal change name containing the
separator becomes an injection into the surrounding grammar. Separate parameters
need no parsing at all, so the failure mode does not exist rather than being
guarded.

**`source` is in the address because it is in the identity.** Review pointed out
that `(repo, name)` does not identify a card: a backlog entry and an active
change of the same name — the ordinary case, since a backlog entry becomes a
change under its own name — collide on one address, as would an active change and
its own archived predecessor. The card's identity is the triple, so the address
is the triple.

## Risks / Trade-offs

**Two stage definitions drift apart.** → The departures are specified, and the
conformance test is no longer deferred: upstream's mirrored fixtures run through
both `classifyActiveChange` (copied verbatim into the test as an oracle) and
`stage.ts`, asserting identical stages. Deferring it was what allowed a phantom
divergence to survive two rounds — the test would have shown the two classifiers
already agreeing. The residual risk is that the copied oracle and the mirrored
fixtures are snapshots: they pin today's behaviour and drift silently when
upstream changes. That is a smaller gap than the one it closes, and it is named
here rather than discovered.

**The board is the most expensive read the daemon performs.** It walks
`openspec/changes/`, `openspec/changes/archive/` and `BACKLOG.md` per repository,
and reads `REVIEWS.md` and `tasks.md` per active change. → Its own endpoint with
its own bound, so it cannot slow readiness; per-repository settlement, so it
cannot be withheld by one repo. Dropping the ship probe removes the part that
scaled with archive size — a mature repository's archive is now a directory
listing, not one subprocess per entry, which is what review flagged as
unscalable. If the archive walk still proves too costly, the fallback is
active-only cards, which removes one of four columns — a product regression, so
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

**Review evidence goes stale, and the census that said otherwise was rigged by
its own glob.** Round 1 raised "latest verdict" as undefined. The answer given
was a census — every `REVIEWS.md` in the repo, twelve files, none repeating a
reviewer — concluding that the producer rewrites the file wholesale, so a section
is always the latest verdict. That went into the delta as a SHALL.

It is false, and round 2 falsified it in one line.
`archive/2026-08-02-close-readiness-spec-gaps/` holds `REVIEWS-round-1.md`,
`REVIEWS-round-2.md` and `REVIEWS-round-3.md` beside a `REVIEWS.md` that lagged
them. The census ran `-name REVIEWS.md`, which structurally excluded the only
counter-evidence in the repository — a pattern chosen by the same person who
wanted the conclusion.

→ The per-file invariant survives (no file repeats a reviewer). The freshness
claim does not, and it mattered: with a rejection now vetoing, reading a
superseded file is the difference between a cleared rejection clearing and a
change stranded at Validate. Classify from the highest-numbered round record
where one exists, mark the card as carrying multi-round evidence, and keep the
document-order tie-break within a record.

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
  the same name?** Upstream reports a `collision` limit notice. Cards are keyed by
  repository, source and name (decision 7), so no merge occurs and every card
  addresses distinctly; what is still open is purely visual — the surface does not
  distinguish two same-named cards beyond their repository label.
- **When should the `ship` follow-up be proposed?** Decision 5 defers it with its
  shape already worked out. It could reasonably be proposed before this board
  ships, so the Archive column is never shipped knowing it conflates two things —
  or left until the board has been used and the missing column has actually been
  felt.
