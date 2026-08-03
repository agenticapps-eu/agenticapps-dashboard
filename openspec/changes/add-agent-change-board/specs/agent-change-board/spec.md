## ADDED Requirements

### Requirement: The Board Shows Every Registered Repository's Changes

The board SHALL render one card per OpenSpec change discovered across the
registered repositories, and its population SHALL be registry-scoped: a
repository that is not registered contributes no cards, and no card is produced
by walking family roots or any other directory the registry does not name.

Three sources SHALL contribute cards, each labelled on the card:

- `active` — a directory directly under `openspec/changes/` that is not the
  `archive/` directory itself. A directory contributes a card when it holds at
  least one of `proposal.md`, `tasks.md`, or a delta spec; a directory holding
  none of those, and any non-directory entry such as a README, contributes no
  card and is not reported as malformed.
- `archive` — a directory under `openspec/changes/archive/` whose name matches
  `YYYY-MM-DD-<slug>` with a calendar-valid date, holding at least one of
  `proposal.md`, `tasks.md`, or a delta spec. The artifact test is the same one
  the `active` source applies, so a directory that would be hidden as active is
  not admitted merely by being archived. An entry under `archive/` failing either
  test is **reported as skipped**, not silently dropped: unlike an absent file, a
  malformed archive record is something someone filed, and hiding it hides
  repository corruption.
- `backlog` — an unresolved entry in `openspec/BACKLOG.md`. An entry is a
  level-two ATX heading (`## `). It is **resolved**, and contributes no card,
  when any of the following holds: its heading line carries a checked checkbox;
  its heading line is struck through; its heading line contains a resolution
  marker (`RESOLVED`, `RETIRED`, `DONE`, `WITHDRAWN`, `OBSOLETE`, in any case,
  with or without a leading tick); or the body between it and the next level-two
  heading opens with a bolded `Status:` line carrying such a marker. A
  `BACKLOG.md` that is absent, empty, or contains no level-two headings
  contributes no cards.

  The marker set is not a guess. This repository's own `openspec/BACKLOG.md` is
  the fixture: of its three level-two headings, one is `## Human verification
  backlog` whose body opens `**Status: ✅ RETIRED 2026-07-26 by explicit
  decision.**`, and one is `## Known stale artifact — ✅ RESOLVED 2026-07-26`.
  A rule that reads only checkboxes and strikethrough reports both as live work.

A repository with no `openspec/` directory SHALL contribute no cards and SHALL
NOT be reported as an error.

**Absent is not malformed.** A source that is simply not present — no
`openspec/`, no `BACKLOG.md`, no headings, a directory holding none of the three
artifacts — contributes no card **silently**. An entry is **malformed**, and
therefore reported per `The Board Degrades Per Repository And Names What It
Lost`, only when the board attempted to read something that exists and could
not: an unreadable file, a file exceeding the read cap, an entry whose required
structure could not be parsed. Nothing SHALL satisfy both readings.

#### Scenario: A registered repository contributes its changes
- **WHEN** a registered repository contains active changes, dated archive entries, and unresolved backlog entries
- **THEN** each appears as one card carrying its repository name
- **AND** each card states which of the three sources it came from.

#### Scenario: A resolved backlog entry is not live work
- **WHEN** a level-two backlog heading is struck through, carries a checked checkbox, contains a resolution marker in its heading, or opens its body with a bolded `Status:` line carrying one
- **THEN** it contributes no card
- **AND** an unresolved sibling heading in the same file still does.

#### Scenario: Absence is silent and unreadability is reported
- **WHEN** one repository has no `BACKLOG.md` and another has one that cannot be read
- **THEN** the first contributes no cards and is not reported
- **AND** the second is reported as a skipped entry naming its repository.

#### Scenario: The archive directory is not itself a change
- **WHEN** a repository's `openspec/changes/` contains an `archive/` directory alongside its active changes
- **THEN** `archive/` produces no card of its own
- **AND** the dated entries inside it produce `archive` cards.

#### Scenario: An unregistered repository is absent
- **WHEN** a git repository containing `openspec/` sits beside a registered one but is not itself registered
- **THEN** none of its changes appear on the board.

#### Scenario: A repository without OpenSpec is silently empty
- **WHEN** a registered repository has no `openspec/` directory
- **THEN** it contributes no cards
- **AND** it is not reported as unavailable or malformed.

### Requirement: Lifecycle Stage Is Classified By An Ordered Rule Set

Every card SHALL carry exactly one lifecycle stage drawn from `propose`,
`validate`, `execute`, `archive`. The stage SHALL be computed by the following
ordered rules, where the first matching rule wins:

1. Archived — **archive**
2. Active, and missing any of `proposal.md`, a delta spec, or `tasks.md` —
   **propose**
3. Artifact-complete, and any of: fewer than two reviewers whose latest verdict
   approves; any reviewer whose latest verdict is a rejection; zero checklist
   rows — **validate**
4. The approving threshold met, checklist incomplete — **execute**
5. The approving threshold met, checklist complete and non-empty — **archive**,
   marked `ready`

A backlog entry SHALL classify as **propose**. `design.md` is optional and SHALL
NOT affect any stage.

Two cards may therefore hold stage `archive` for different reasons, and the card
SHALL make the difference legible without opening it: a rule-1 card carries
source `archive`, and a rule-5 card carries source `active` and the `ready`
marker.

The rule set is derived from the upstream `agents-task-viewer` board's **current
classifier** and ADR 0008, not from ADR 0004's prose, which the implementation
has moved past. The specification SHALL name that origin and SHALL state every
deliberate divergence from it. **One divergence exists**: this board has no
`ship` stage, so upstream's mainline-reachability distinction collapses into
`archive`.

Rule 3's empty-checklist clause is upstream's (`checklist.length === 0`), and is
carried deliberately: a change with no checklist rows stays at `validate` rather
than advancing on artifacts alone. A purely declarative change with no tasks will
therefore sit at `validate` until it is archived. That consequence is upstream's
too, and matching it is worth more than fixing it here would be — diverging would
buy one better-classified card at the price of the two boards disagreeing.

#### Scenario: An incomplete change is proposed
- **WHEN** an active change has a proposal but no tasks file
- **THEN** its stage is `propose`.

#### Scenario: An approved change with outstanding work is executing
- **WHEN** an active change is artifact-complete, has two approving reviewers and no standing rejection, and has 4 of 9 checklist rows complete
- **THEN** its stage is `execute`.

#### Scenario: A finished change is ready to archive
- **WHEN** an active change is artifact-complete, has two approving reviewers and no standing rejection, and every one of its checklist rows is complete
- **THEN** its stage is `archive`
- **AND** the card is marked `ready`.

#### Scenario: The two archive readings are distinguishable
- **WHEN** the Archive column holds both a filed archive entry and an active change marked ready
- **THEN** the first carries source `archive` and the second carries source `active` with the `ready` marker.

#### Scenario: A design file never changes the stage
- **WHEN** two otherwise identical changes differ only in whether `design.md` exists
- **THEN** both classify to the same stage.

### Requirement: Two Approving Reviewers And No Standing Rejection

A change SHALL leave `validate` only when at least two distinct reviewers have
approved **and** no reviewer has a standing request for changes. A standing
request for changes from any reviewer holds the change at `validate` however
many other reviewers approve.

**This is not a divergence.** It is what the upstream board already does:
`classifyActiveChange` returns `validate` when `hasRequestChanges` is set, when
fewer than two distinct vendors approved, or when the checklist is empty. ADR
0004's prose — "two distinct approved reviewer sections", counting approvals
without subtracting rejections — describes neither the current classifier nor
ADR 0008. The specification SHALL cite the classifier and ADR 0008 as the origin,
not ADR 0004's prose.

**The verdict grammar is part of the contract**, because stage classification
hinges on it. A reviewer section SHALL be a level-two heading matching
`## Reviewer: <vendor>`; its verdict SHALL be a line matching
`VERDICT: APPROVE` or `VERDICT: REQUEST-CHANGES`, case-insensitively, bounded by
the next reviewer heading; vendors SHALL be compared case-insensitively, and a
vendor that has already approved SHALL NOT be counted twice. This mirrors
upstream's parser so the two boards read one file the same way.

Verdicts that cannot be read SHALL be treated as absent rather than as approvals,
so an unparseable or trailer-absent review record classifies the change as
`validate` for want of evidence.

**Review evidence may be stale, and the board SHALL NOT pretend otherwise.** The
review producer rewrites `REVIEWS.md` in place, but that is not the only way
review rounds are recorded in practice: `close-readiness-spec-gaps` carried
`REVIEWS-round-1.md`, `REVIEWS-round-2.md` and `REVIEWS-round-3.md` beside a
`REVIEWS.md` that lagged behind them. Since a standing rejection now holds a
change at `validate`, reading a superseded file is the difference between a
cleared rejection clearing and a change stranded. Therefore: where a change
directory carries round-numbered review records alongside `REVIEWS.md`, the
board SHALL classify from the highest-numbered record, and SHALL mark the change
as carrying multi-round review evidence so a reader can see which file was read.
Within a single record, a vendor appearing twice resolves to the later section in
document order.

#### Scenario: A standing rejection holds the change at validate
- **WHEN** a change carries approvals from two reviewers and requests for changes from two other reviewers
- **THEN** the change does not leave `validate`.

#### Scenario: A cleared rejection advances the change
- **WHEN** a reviewer whose recorded verdict was a request for changes records an approval in a later round, and a second reviewer approves
- **THEN** the change is eligible to leave `validate`.

#### Scenario: The newest round is the one that counts
- **WHEN** a change directory holds `REVIEWS.md` alongside `REVIEWS-round-1.md` through `REVIEWS-round-3.md`
- **THEN** the stage is classified from `REVIEWS-round-3.md`
- **AND** the card records that the change carries multi-round review evidence.

#### Scenario: Unreadable verdicts do not advance a change
- **WHEN** a change's reviewer verdicts cannot be parsed
- **THEN** they count as absent
- **AND** the change classifies as `validate`.

#### Scenario: The boards read one file the same way
- **WHEN** the same `REVIEWS.md` is read by this board and by the upstream board
- **THEN** both identify the same reviewers and the same verdicts
- **AND** both classify the change to the same stage.

### Requirement: The Board Does Not Claim A Change Has Shipped

The board SHALL NOT distinguish a change that has landed on a mainline ref from
one that is merely archived. Both classify as `archive`, and no card SHALL assert
that a change has shipped.

Proving that an archive entry is present on `main` or `origin/HEAD` requires a
git invocation whose argument vector carries a ref and a pathspec built from a
directory name read out of a project tree. `filesystem-access-policy` closes the
git site to a fixed argument vector for that reason, and forbids project-tree
strings reaching an argument vector at the OpenSpec-binary site in terms. A
`ship` stage is therefore a change to the security spine, and SHALL be proposed
as its own change with its own delta against that capability rather than carried
here.

#### Scenario: An archived change is never shown as shipped
- **WHEN** an archived change is present on the repository's mainline ref
- **THEN** its card's stage is `archive`
- **AND** no card, column, or drawer states that it shipped.

### Requirement: The Board Degrades Per Repository And Names What It Lost

One repository SHALL NOT be able to withhold the board. When a repository is
unreachable, exceeds the read budget, or yields a malformed change or backlog
entry, the remaining repositories SHALL still render.

Every degradation SHALL be visible in the response and on the surface: the
affected repository or entry SHALL be named together with the reason. Degraded
reads SHALL NOT render as an ordinary empty board.

#### Scenario: One unreachable repository does not take the fleet
- **WHEN** one registered repository is unreachable and five others are readable
- **THEN** the board renders the five readable repositories' cards
- **AND** the response reports the unreachable repository by name with a reason.

#### Scenario: A malformed entry is skipped and counted
- **WHEN** a change directory or backlog entry cannot be parsed
- **THEN** that entry produces no card
- **AND** the board reports that an entry was skipped, identifying its repository.

#### Scenario: Degradation is distinguishable from emptiness
- **WHEN** every repository fails to read
- **THEN** the surface states that the repositories could not be read
- **AND** it does not present the same appearance as a fleet with no open changes.

### Requirement: The Board Fits Every Declared Viewport

The board SHALL render without page-level horizontal scrolling at every declared
verification viewport.

Four stage columns SHALL be shown while each column is at least 180 CSS pixels
wide. Below that width the board SHALL show one stage at a time behind a stage
rail that names every stage and its card count, and every stage SHALL remain
reachable.

The minimum column width, not a viewport breakpoint, is the binding constraint:
the breakpoint follows from the shell's sidebar and padding, so a change to
either recomputes the threshold rather than invalidating the requirement.

#### Scenario: Four columns at the reference viewport
- **WHEN** the board renders at 1440×900
- **THEN** all four stage columns are visible
- **AND** the page does not scroll horizontally.

#### Scenario: The paged layout on a small viewport
- **WHEN** the board renders at 390×844
- **THEN** one stage is shown at a time behind a stage rail
- **AND** every stage and its card count remain reachable
- **AND** the page does not scroll horizontally.

#### Scenario: An empty stage still reads as a stage
- **WHEN** a stage contains no cards
- **THEN** the column or paged view states that it has no changes rather than rendering blank.

### Requirement: The Archive Column Is Bounded

Archive cards SHALL be ordered by their entry date, most recent first, and ties
broken by name so the order is total and stable across requests.

Archived changes accumulate without limit while the other three stages drain, so
the Archive column SHALL render at most a bounded number of the most recently
dated archive cards per repository, against a named constant, and SHALL state
how many it withheld.

A bound that is silently applied is indistinguishable from a repository that has
archived little, which is the reporting failure this board exists to avoid.

#### Scenario: A mature archive is bounded and says so
- **WHEN** a repository has more archived changes than the bound
- **THEN** the column renders the most recently dated ones up to the bound
- **AND** states the number withheld for that repository.

#### Scenario: A small archive is unbounded in practice
- **WHEN** a repository has fewer archived changes than the bound
- **THEN** every one of them renders
- **AND** nothing is reported as withheld.

### Requirement: A Change Name Wraps Before It Elides

A card SHALL show its change name across up to two lines before eliding. When a
name is elided, its full value SHALL remain available in the card's detail view,
so no name is lost at any width.

Numeric values on a card — completed and total checklist counts — SHALL use
tabular figures so that digits align between cards.

#### Scenario: A long name wraps rather than truncating at one line
- **WHEN** a change name is longer than one line at the current column width but fits within two
- **THEN** the whole name is shown across two lines.

#### Scenario: An elided name is recoverable
- **WHEN** a change name exceeds two lines and is elided
- **THEN** opening the card's detail view shows the complete name.

### Requirement: A Card Opens A Deep-Linked Drawer

Selecting a card SHALL open a detail drawer over the board, leaving the board
visible. The drawer SHALL carry the change's repository, stage, source, artifact
presence, reviewer verdicts, and its checklist rows.

The open drawer SHALL be addressable, and a card's identity SHALL be the triple
of repository, source, and **the entry's own name as it appears on disk** — for
an active change its directory name, for an archived entry its full dated
`YYYY-MM-DD-<slug>` basename, for a backlog entry its heading text plus its
one-based index among the file's headings. A backlog entry, an active change and
an archived entry sharing a slug within one repository are distinct cards and
SHALL address distinctly; so are two archived entries of the same slug filed on
different dates, and two backlog headings with identical text.

The location SHALL carry the three values as **separate** parameters. A single
composite parameter requiring a separator SHALL NOT be used, because parsing a
separator out of an author-controlled change name is the failure mode that
produced the readiness sanitiser defect.

#### Scenario: Opening a card is addressable
- **WHEN** a card is selected
- **THEN** a drawer opens over the board showing that change's detail
- **AND** the location identifies the repository, the source, and the change in separate parameters.

#### Scenario: Same-named cards from different sources address distinctly
- **WHEN** one repository holds a backlog entry and an active change with the same name
- **THEN** each renders as its own card
- **AND** each card's location differs in the source parameter.

#### Scenario: One slug archived twice addresses distinctly
- **WHEN** a repository holds `2026-07-04-add-thing` and `2026-08-02-add-thing` under `archive/`
- **THEN** each renders as its own card
- **AND** their locations differ, because the dated basename is the identity rather than the slug.

#### Scenario: A deep link restores the drawer
- **WHEN** a location naming a repository, a source, and a change is opened directly
- **THEN** the board renders with that change's drawer already open.

#### Scenario: A deep link to a change that no longer exists
- **WHEN** a location names a change absent from the current board
- **THEN** the board renders without a drawer and states that the change was not found.

### Requirement: The Board Adds No Read Root And Spawns No Process

The board SHALL read only paths already permitted by `filesystem-access-policy`,
and SHALL spawn no process at all. The four authorised spawn sites are unchanged
by this board, and neither the permitted git subcommands nor the read allow-list
is widened to serve it.

Path admission SHALL NOT rest on the lexical guard alone. `isReadableProjectPath`
answers whether a path's shape is offerable, not whether reading it stays inside
the repository, so every path the board reads SHALL additionally be resolved and
confirmed to lie under the registered project root, and SHALL be read only when
it is a regular file.

**Every read SHALL be size-capped before it is performed**, against a named
constant, and a file exceeding the cap SHALL be skipped and reported rather than
read. The board reads `tasks.md`, `REVIEWS.md` and `BACKLOG.md` for every change
in every registered repository on one fleet request, so an oversized file is a
whole-endpoint cost and not a per-card one. The cap is not optional hardening:
it was required by this change's first-round review, alongside the realpath and
regular-file checks, and was the one of the three left unimplemented.

#### Scenario: Reads stay inside the allow-list
- **WHEN** the board reads a repository's changes, archive entries, and backlog
- **THEN** every path read is one the read allow-list already permits.

#### Scenario: An oversized file is skipped, not read
- **WHEN** a `tasks.md`, `REVIEWS.md` or `BACKLOG.md` under `openspec/` exceeds the read cap
- **THEN** the board does not read it
- **AND** the entry is reported as skipped, naming its repository.

#### Scenario: A symlink out of the repository is not read
- **WHEN** an entry under `openspec/` is a symlink resolving outside the registered project root
- **THEN** the board does not read through it
- **AND** the entry produces no card and is reported as skipped.

#### Scenario: No spawn site appears
- **WHEN** the board's route and library surface is inspected for process creation
- **THEN** it creates no process
- **AND** the set of authorised spawn sites is unchanged at four.
