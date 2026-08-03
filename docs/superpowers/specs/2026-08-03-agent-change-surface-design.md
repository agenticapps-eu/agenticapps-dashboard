# The agent-change surface — a fleet OpenSpec change board

- Date: 2026-08-03
- Status: Design approved, not yet proposed as an OpenSpec change
- Unblocks: `retire-v1-surfaces` (the last outstanding prerequisite)

## Why this exists

`retire-v1-surfaces` has been blocked since 2026-07-28 on one condition, recorded
in `openspec/CAPABILITY-MAP.md` § "Agent board deferred":

> `retire-v1-surfaces` remains blocked until an agent-change surface has been
> proposed, implemented, and is actually available in the product.

That note was written the same day the upstream work it waits on finished. It
says `agents-task-viewer` "*is replacing*" its agent-task board with OpenSpec
change cards — present-progressive — and blocks on the outcome. The upstream
change `repository-centric-openspec-board` archived on 2026-07-28. The note has
described completed work as pending ever since.

So the prerequisite is not unreachable. It is ready to be built, and this design
is what to build.

### What the upstream change actually did

It made **one repository-local OpenSpec change, rather than one host session,
the atomic card**. Host sessions were demoted to an evidence-based `N active`
count decorating each card.

That is the fact that makes this surface cheap. The card corpus is now
`openspec/` files plus git — exactly what the dashboard daemon already reads.
Only the session count needs the host adapters, and the session count is out of
scope here.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D-1 | **Fleet-wide pipeline view**, not a live agent monitor | The dashboard is a fleet product you check, not a monitor you watch. "What work is in flight across the repos, at what stage." |
| D-2 | **File-derived only in v1** — no `activeSessionCount` | Session counts need the host adapters, which need `agents-task-viewer` converted to a consumable package (DASHBOARD-V2-SPEC E-3). Not done, and not required for the pipeline reading. |
| D-3 | **Re-derive the stage machine in the daemon**, citing ADR 0004 | Upstream's `tracker.ts` is not importable: `agents-task-viewer` is `private: true`, has no `exports`/`main`, no build script, and is a Bun + OpenTUI app. Importing it means a cross-repo package conversion before any dashboard surface exists. |
| D-4 | **Five-column kanban**, mirroring the TUI | Chosen over a dense table and a stage-grouped table. Stage stays a *place* rather than a value to scan for, and it matches existing muscle memory from the terminal board. |
| D-5 | **Change name wraps to two lines**, then ellipsis | The terminal truncates because a cell grid forces it, not because truncating is better. All four change names in the fleet exceeding one line (37, 37, 36, 33 chars) fit whole in two 26-char lines. |
| D-6 | **Detail opens in a drawer over the board**, deep-linked | Board stays visible; the URL stays shareable. |
| D-7 | **Own route, own budget, degrade per repo** | A dedicated endpoint with its own bound, so the board cannot make the readiness endpoints slower and one bad repo cannot take the board. |
| D-8 | **Diverge from ADR 0004 on reviewer verdicts** | See below. Recorded as a deliberate divergence, not an implementation slip. |

### D-8 in full — why the reviewer rule diverges

ADR 0004 classifies a change past Validate on "two distinct approved reviewer
sections". It counts approvals and never subtracts rejections.

Applied literally to this repo, `retire-v1-surfaces` — claude APPROVE, opencode
APPROVE, gemini REQUEST-CHANGES, codex REQUEST-CHANGES — reads as approved and
sits in **Execute**. That is the wrong reading here. This repo's posture is that
rejections are reported and must be dispositioned; the discipline recorded in
`CLAUDE.md` and exercised last session is to fix confirmed REQUEST-CHANGES
findings before folding a delta.

**A reviewer counts only when their latest verdict is APPROVE.** Under that rule
`retire-v1-surfaces` sits in Validate, which is where a change with two
unanswered rejections belongs.

The divergence is deliberate and must be stated in the capability spec, so a
reader comparing the two boards finds the reason rather than a discrepancy.

## Architecture

```
packages/shared/src/schemas/changes.ts     ChangeCard + FleetChanges zod schemas
packages/agent/src/lib/changes/
  ├── changeReader.ts    one repo → active changes, archive entries, BACKLOG.md
  ├── stage.ts           the ordered classifier (pure, no I/O)
  └── service.ts         fleet assembly, bounded, degrades per repo
packages/agent/src/routes/changes.ts       GET /api/v2/changes/fleet
packages/spa/src/components/panels/changes/
  ├── ChangeBoardPage.tsx  five columns at ≥1220px, stage-rail pager below
  ├── StageColumn.tsx      header "Label · N", internal scroll
  ├── ChangeCard.tsx       name (2-line clamp) / repo · source · done/total
  └── ChangeDrawer.tsx     deep-linked detail
```

Route `/changes`; one sidebar entry, `Changes`, in the product-content group.

### Why a new reader rather than extending `openspecReader.ts`

`openspecReader.ts` already returns open changes, task counts and archived names,
so widening it is tempting. It is also on the hot path for the `spec` readiness
check and repo detail, and the board additionally needs `REVIEWS.md` parsing and
a git probe per archived change. Extending it makes every readiness scan pay for
board data it never renders.

Separate modules. The duplicated directory listing is the accepted price, and it
is recorded here so a reviewer reads it as a decision rather than an oversight.

### Bounding

`service.ts` reuses the `withinBound` + `Promise.allSettled` pattern from
`readiness/service.ts`: race an unref'd timer, one repo's failure drops that
repo's rows and nothing else.

This is **one** bound, not readiness's two. Readiness pays a second sequential
bound only because every repo's cache key derives from a fleet signature computed
first; the board has no such dependency.

## The stage classifier

Ordered, first match wins. Per ADR 0004 except where D-8 applies.

| # | Condition | Stage |
|---|---|---|
| 1 | Archived, marker present at `origin/HEAD` or local `main` | **Ship** |
| 2 | Archived without that local proof | **Archive** |
| 3 | Active, missing `proposal.md` / delta specs / `tasks.md` | **Propose** |
| 4 | Artifact-complete, but under two approved reviewers, or zero checklist rows | **Validate** |
| 5 | Approved, checklist incomplete | **Execute** |
| 6 | Approved, checklist complete and non-empty | **Archive** (`ready`) |

Unresolved level-two entries in `openspec/BACKLOG.md` become **Propose** cards
with `source: backlog`. `design.md` is optional and never gates a stage.

### The Ship probe must fit the existing bounded-git site

`GIT_ALLOWED_CMDS` is `['log', 'status', 'diff-stat', 'branch']`, and
`add-workflow-fleet-conformance` closes process-spawn authorization at exactly
four sites — editor, bounded git, OpenSpec reader, workflow harness.

Separating Ship from Archive needs proof that the archive entry exists on
`main`/`origin/HEAD`. That is expressible as:

```
git log <ref> -- openspec/changes/archive/<name>
```

which uses `log`, adds no subcommand, and adds no fifth spawn site. Widening
`GIT_ALLOWED_CMDS` would amend `filesystem-access-policy` — the security spine —
and is not worth spending for a column label.

## The surface

**Columns.** Five, 220px each at the 1440×900 reference viewport. Header
`Label · N`, internal vertical scroll, `No changes` when empty (mirroring the
TUI's `EMPTY_CHANGE_COPY`).

**The pager threshold is derived, not chosen.** Five columns hold while each is
at least **180 CSS px** wide — below that a two-line name drops under ~20
characters per line and the longest real names stop fitting. With the 240px
sidebar and the shell's 24px padding either side, content width is
`viewport − 288`, and five 180px columns with four 8px gaps need 932px. So the
pager engages below **1220px** viewport width, showing one stage at a time behind
a stage rail — the same mechanism `App.tsx` already uses when narrow, so tablet
and `xs` are covered by one layout rather than three.

Stating the minimum column width rather than the breakpoint is deliberate: the
breakpoint follows from the sidebar and padding, so if either changes the rule
still holds and the number is recomputed rather than silently wrong.

**Card.** Two fields, the first of which may occupy two lines.

1. Change name, clamped to two lines then ellipsis.
2. `repo · source · done/total`, one line, tabular figures, `ready` suffix where
   rule 6 applies.

The TUI's third row was `N active` and is out of v1 per D-2.

**Drawer.** Opens over the board, board visible behind. Carries change name,
repository, stage, source, artifact presence, reviewer vendors with verdicts, and
the checklist rows. Deep-linked via **two** search params —
`/changes?repo=<repoId>&change=<name>` — so the board stays mounted and the URL
is shareable.

Two params rather than one composite `repo:name` value on purpose. A composite
needs a separator, a separator needs a parser, and a parser over
author-controlled names is precisely the shape that produced last session's
`fix-readiness-sanitiser-colon-hazard` outage. Two params need no parsing at all.

**Sidebar.** One entry, `Changes`, in the product-content group — not its own
section, because the `design-system` delta in `retire-v1-surfaces` mandates
exactly two groups.

## Interaction with `retire-v1-surfaces`

Three couplings, all of which this change must state rather than discover later.

**1. The kanban and the density requirement.** The `design-system` delta's
`Dense Rows And Aligned Figures` binds "list and table surfaces" to a uniform row
height, and its scenario reads "every row is the same height, **rather than a
card-sized block**"; the `xs` clause repeats "rather than becoming a card". A
kanban of cards is not a list or table surface, so it is not literally caught —
but the direction is deliberately anti-card. This change must scope that
requirement explicitly to list/table surfaces, or grant the board a stated
exception. Either is fine; silence is not.

**2. No horizontal scrolling is binding.** That clause applies to *every*
surface, which is why the pager exists rather than a scrolling column strip.

**3. The hybrid reader must keep archived changes.** The `project-dashboard`
delta currently drops archived-change ordering and per-change affected-capability
derivation, justified as:

> Per-change affected-capability derivation and archived-change ordering are
> deliberately dropped because no v2 surface renders either value.

A change board renders archived changes as cards, in date order. **That
justification is now false and the delta needs correcting while it is still
open** — cheap now, a new change after the fold.

## Error handling

All degradation is visible. Silent degraded reads were a review finding on
`retire-v1-surfaces` and the same rule applies here.

- **Repo unreachable or over budget** — its rows drop; a notice names the repo
  and the reason.
- **Malformed change directory or `BACKLOG.md` entry** — the item is skipped and
  counted, mirroring upstream's limit notices.
- **Git probe fails** — the change reads **Archive**, never Ship. Failure falls
  to the weaker claim; the board never asserts shipped without proof.
- **Daemon unreachable / schema drift** — existing `DaemonUnreachableState` and
  `SchemaDriftState`.

## Testing

TDD throughout, per `CLAUDE.md` rule 4.

- `stage.ts` is pure: one unit test per ordered rule, plus the D-8 case — two
  APPROVE and two REQUEST-CHANGES lands in Validate, not Execute. Fixtures
  mirrored from upstream's `src/openspec/__fixtures__`.
- `changeReader` against temp directories.
- `service` degradation test proving one throwing repo does not take the others.
- Route contract test for the 200 shape and the degraded notice.
- SPA tests for column counts, empty copy, the two-line clamp, the pager below
  breakpoint, and drawer deep-linking.
- `impeccable:critique` artifact at 1440×900, composite ≥ 80 — mandatory for any
  frontend-touching change in this repo.
- **Every new test proved to fail before the implementation lands.** Two fixtures
  last session asserted nothing and passed anyway; reverting the fix to confirm
  RED is the check that catches it.

## Out of scope

- Live session counts (`activeSessionCount`, `activeByHost`, `supportingTasks`)
  and therefore the host adapters and the E-3 package conversion.
- Any change to `agents-task-viewer`.
- Widening `GIT_ALLOWED_CMDS` or the four authorized spawn sites.
- Running the `retire-v1-surfaces` cutover itself.

## Open questions

- **Should `/changes` also appear per-repo on `/repos/:id`?** Not in v1. The
  fleet board answers the question that was asked; a per-repo section is additive
  and can be proposed once the board exists.
- **`retire-v1-surfaces` task §1 is stale independently of this design.** It
  describes deleting an old SPA package and renaming a v2 package. There is one
  package, `packages/spa`, with v1 and v2 routes coexisting since #90 on
  2026-08-02. Three tasks and the "one commit, a revert is the rollback" plan
  need rewriting. Not this change's job, but it blocks the cutover this change
  unblocks.
- **`/` has no assigned plan.** The delta withdraws the card grid, filters,
  search and sort while retaining `Register A Project From The Home Page`;
  `MultiProjectHome.tsx` implements both in one component, and the migration
  manifest does not list `/`. Also not this change's job, also unassigned.
- **The abandoned board endpoint.** The worktree
  `agenticapps-dashboard-add-agent-board` (branch `chore/setup-codex-workflow`)
  carries `5155a97 feat(ts): board endpoint — Phase 3 implementation (GREEN)` and
  an ADR recording the agent board boundary, from before `add-agent-board` was
  withdrawn. Worth reading before implementing; decide harvest or discard.
