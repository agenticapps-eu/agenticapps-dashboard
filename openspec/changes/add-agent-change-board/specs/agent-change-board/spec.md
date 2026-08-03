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
  `YYYY-MM-DD-<slug>`. An entry under `archive/` that does not match that shape
  contributes no card.
- `backlog` — an unresolved entry in `openspec/BACKLOG.md`, where an entry is a
  level-two ATX heading (`## `) and it is unresolved when no checkbox on its
  heading line is checked and the heading is not struck through. A `BACKLOG.md`
  that is absent, empty, or contains no level-two headings contributes no cards
  and is not reported as malformed.

A repository with no `openspec/` directory SHALL contribute no cards and SHALL
NOT be reported as an error.

#### Scenario: A registered repository contributes its changes
- **WHEN** a registered repository contains active changes, dated archive entries, and unresolved backlog entries
- **THEN** each appears as one card carrying its repository name
- **AND** each card states which of the three sources it came from.

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

The rule set is derived from `agents-task-viewer` ADR 0004 so that the two boards
agree. The specification SHALL name that origin, and SHALL state every deliberate
divergence from it. Two divergences exist and are specified below: the reviewer
rule, and the absence of a `ship` stage.

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

A change SHALL leave `validate` only when at least two distinct reviewers'
latest verdicts approve **and** no reviewer's latest verdict is a rejection. A
reviewer's latest verdict is the only one that counts: an earlier approval
followed by a later request for changes does not count toward the threshold, and
a standing request for changes from any reviewer holds the change at `validate`
however many other reviewers approve.

This is a deliberate divergence from ADR 0004, which counts approving sections
and never subtracts rejections. Under the upstream rule a change carrying two
approvals and two unanswered rejections from different reviewers advances; under
this one it does not.

**The board is deliberately stricter than this repository's own change-gate, and
this is the whole of the divergence's cost.** Gate 2.0.0 reports review evidence
and enforces none of it — two rejections open the gate exactly as two approvals
do, and its stated disposition is "address it or record why not". The board
cannot read a recorded why-not: a rejection recorded in prose is not a verdict,
so the only thing that clears a standing rejection on this surface is a fresh
verdict from that reviewer. A change whose author legitimately declined a
finding will therefore sit at `validate` until the reviewers are re-run. That is
accepted, and stated here rather than discovered, because the alternative is a
board that advances changes on rejections nobody answered.

A reviewer's latest verdict is well defined without an ordering discipline: the
review producer rewrites `REVIEWS.md` wholesale on every run, so a reviewer
appears at most once per file and that section is their latest verdict. Where a
file nonetheless carries two sections for one reviewer, the later in document
order SHALL win.

Verdicts that cannot be read SHALL be treated as absent rather than as approvals,
so an unparseable or trailer-absent `REVIEWS.md` classifies the change as
`validate` for want of evidence.

#### Scenario: A standing rejection holds the change at validate
- **WHEN** a change carries approvals from two reviewers and requests for changes from two other reviewers
- **THEN** the change does not leave `validate`.

#### Scenario: A reviewer who later requested changes
- **WHEN** a reviewer approved and subsequently recorded a request for changes on the same change
- **THEN** that reviewer does not count toward the threshold
- **AND** the change classifies as `validate`.

#### Scenario: A cleared rejection advances the change
- **WHEN** a reviewer whose latest verdict was a request for changes records a later approval, and a second reviewer's latest verdict approves
- **THEN** the change is eligible to leave `validate`.

#### Scenario: Unreadable verdicts do not advance a change
- **WHEN** a change's reviewer verdicts cannot be parsed
- **THEN** they count as absent
- **AND** the change classifies as `validate`.

#### Scenario: The divergence is discoverable
- **WHEN** a reader compares this board's stages with the upstream board's
- **THEN** the specification states the reviewer rule, identifies it as a divergence from ADR 0004, and states that it is stricter than the repository's change-gate.

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
of repository, source, and change name — a backlog entry, an active change, and
an archived entry sharing a name within one repository are three distinct cards
and SHALL address distinctly. The location SHALL carry those three values as
**separate** parameters. A single composite parameter requiring a separator SHALL
NOT be used, because parsing a separator out of an author-controlled change name
is the failure mode that produced the readiness sanitiser defect.

#### Scenario: Opening a card is addressable
- **WHEN** a card is selected
- **THEN** a drawer opens over the board showing that change's detail
- **AND** the location identifies the repository, the source, and the change in separate parameters.

#### Scenario: Same-named cards from different sources address distinctly
- **WHEN** one repository holds a backlog entry and an active change with the same name
- **THEN** each renders as its own card
- **AND** each card's location differs in the source parameter.

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

#### Scenario: Reads stay inside the allow-list
- **WHEN** the board reads a repository's changes, archive entries, and backlog
- **THEN** every path read is one the read allow-list already permits.

#### Scenario: A symlink out of the repository is not read
- **WHEN** an entry under `openspec/` is a symlink resolving outside the registered project root
- **THEN** the board does not read through it
- **AND** the entry produces no card and is reported as skipped.

#### Scenario: No spawn site appears
- **WHEN** the board's route and library surface is inspected for process creation
- **THEN** it creates no process
- **AND** the set of authorised spawn sites is unchanged at four.
