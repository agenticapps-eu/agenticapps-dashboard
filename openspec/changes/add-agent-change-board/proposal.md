## Why

`retire-v1-surfaces` has been blocked since 2026-07-28 on one condition recorded
in `openspec/CAPABILITY-MAP.md` § "Agent board deferred": the cutover must not run
until an agent-change surface has been proposed, implemented, and is actually
available in the product.

That note was written the same day the upstream work it waits on finished. It
describes `agents-task-viewer` as *"replacing"* its agent-task board with OpenSpec
change cards — present-progressive — and blocks on the outcome. The upstream
change `repository-centric-openspec-board` archived on 2026-07-28. **The note has
described completed work as pending for five weeks.**

The prerequisite is therefore not unreachable; it is unbuilt. This change builds
it, and in doing so answers a question the dashboard cannot currently answer at
all: *what work is in flight across the registered repositories, and at what
stage.* Readiness says whether a repo is in good order. Nothing says what is
moving through it.

## What Changes

- **New surface `/changes`** — a fleet-wide board of OpenSpec changes across every
  registered repository, arranged as five lifecycle columns: Propose, Validate,
  Execute, Archive, Ship.
- **New daemon endpoint `GET /api/v2/changes/fleet`** — reads each registered
  repo's `openspec/` tree and returns one card per change, bounded and degrading
  per repository.
- **New lifecycle classification in the daemon** — an ordered stage machine
  derived from the upstream `agents-task-viewer` ADR 0004, with one deliberate
  divergence on reviewer verdicts (below).
- **Backlog entries become cards.** Unresolved level-two entries in
  `openspec/BACKLOG.md` render as Propose cards with `source: backlog`, so
  unstarted work is visible rather than invisible until someone opens a change.
- **A card opens a deep-linked drawer** carrying stage, source, artifact presence,
  reviewer verdicts and the checklist rows.
- **One sidebar entry, `Changes`**, in the product-content group.

Explicitly **not** in this change: live agent-session counts. Upstream demoted
host sessions to an `N active` decoration on each card; rendering it needs the
host adapters, which need `agents-task-viewer` converted to a consumable package
(DASHBOARD-V2-SPEC E-3). The pipeline reading does not depend on it.

### The divergence, stated up front

ADR 0004 moves a change past Validate on "two distinct approved reviewer
sections". It counts approvals and never subtracts rejections.

Applied literally here, `retire-v1-surfaces` — claude APPROVE, opencode APPROVE,
gemini REQUEST-CHANGES, codex REQUEST-CHANGES — reads as approved and sits in
Execute. That is wrong for this repository, whose posture is that rejections are
reported and must be dispositioned. **A reviewer counts only when their latest
verdict is APPROVE**, which places that change in Validate, where a change
carrying two unanswered rejections belongs.

## Capabilities

### New Capabilities

- `agent-change-board`: the fleet OpenSpec change board — its card corpus, the
  ordered lifecycle classification, the five-column and paged layouts, drawer
  detail and deep-linking, and per-repository degradation.

### Modified Capabilities

None. The two couplings this change has are with the **unapplied delta** inside
`retire-v1-surfaces`, not with any durable spec:

- Its `design-system` delta adds `Dense Rows And Aligned Figures`, whose scenario
  reads "every row is the same height, **rather than a card-sized block**". A
  kanban of cards is not a list or table surface and so is not literally caught,
  but the direction is deliberately anti-card. **That change must scope the
  requirement to list/table surfaces or grant this board a stated exception.**
- Its `project-dashboard` delta drops archived-change ordering from the hybrid
  reader because "no v2 surface renders either value". **This board renders
  archived changes as cards, in date order, so that justification is now false.**

Both are corrections to `retire-v1-surfaces` while it is still open — cheap now,
a separate change once its delta is folded. Neither is a delta of this change.

The durable `design-system` and `project-dashboard` specs are untouched:
`Dense Rows And Aligned Figures` does not exist in the durable slot yet, and
`Hybrid OpenSpec Read Strategy` still returns archived ordering.

## Impact

**New code.** `packages/shared/src/schemas/changes.ts`;
`packages/agent/src/lib/changes/{changeReader,stage,service}.ts`;
`packages/agent/src/routes/changes.ts`;
`packages/spa/src/components/panels/changes/*` and a `/changes` route.

**Existing code.** One sidebar entry. `openspecReader.ts` is deliberately **not**
extended — it sits on the hot path for the `spec` readiness check and repo
detail, and the board additionally needs `REVIEWS.md` parsing and a git probe per
archived change. Extending it would make every readiness scan pay for board data
it never renders.

**The security spine is not amended.** No new read root: `openspec/**` is already
allow-listed by `add-openspec-project-reader`, and `openspec/BACKLOG.md` passes
`isReadableProjectPath` unchanged. No fifth spawn site: the Ship-versus-Archive
probe is expressed as `git log <ref> -- openspec/changes/archive/<name>`, using
the already-permitted `log` subcommand through the existing bounded-git site.
Widening `GIT_ALLOWED_CMDS` is out of scope.

**Performance.** A dedicated endpoint with its own bound, so the board cannot
slow the readiness endpoints. One bound rather than readiness's two — readiness
pays a second sequential bound only because every repo's cache key derives from a
fleet signature computed first, and the board has no such dependency.

**Unblocks.** `retire-v1-surfaces`, whose remaining obstacles after this are its
own stale artifacts: task §1 describes deleting an old SPA package and renaming a
v2 package, when there is one package with v1 and v2 routes coexisting since #90.
