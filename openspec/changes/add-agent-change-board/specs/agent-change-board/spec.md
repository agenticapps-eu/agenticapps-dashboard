## ADDED Requirements

### Requirement: The Board Shows Every Registered Repository's Changes

The board SHALL render one card per OpenSpec change discovered across the
registered repositories, and its population SHALL be registry-scoped: a
repository that is not registered contributes no cards, and no card is produced
by walking family roots or any other directory the registry does not name.

Three sources SHALL contribute cards, each labelled on the card:

- `active` — a directory under `openspec/changes/`
- `archive` — a dated `YYYY-MM-DD-<slug>` directory under
  `openspec/changes/archive/`
- `backlog` — an unresolved level-two entry in `openspec/BACKLOG.md`

A repository with no `openspec/` directory SHALL contribute no cards and SHALL
NOT be reported as an error.

#### Scenario: A registered repository contributes its changes
- **WHEN** a registered repository contains active changes, dated archive entries, and unresolved backlog entries
- **THEN** each appears as one card carrying its repository name
- **AND** each card states which of the three sources it came from.

#### Scenario: An unregistered repository is absent
- **WHEN** a git repository containing `openspec/` sits beside a registered one but is not itself registered
- **THEN** none of its changes appear on the board.

#### Scenario: A repository without OpenSpec is silently empty
- **WHEN** a registered repository has no `openspec/` directory
- **THEN** it contributes no cards
- **AND** it is not reported as unavailable or malformed.

### Requirement: Lifecycle Stage Is Classified By An Ordered Rule Set

Every card SHALL carry exactly one lifecycle stage drawn from `propose`,
`validate`, `execute`, `archive`, `ship`. The stage SHALL be computed by the
following ordered rules, where the first matching rule wins:

1. Archived, and the archive entry is proven present on `main` or
   `origin/HEAD` — **ship**
2. Archived without that proof — **archive**
3. Active, and missing any of `proposal.md`, a delta spec, or `tasks.md` —
   **propose**
4. Artifact-complete, but with fewer than two approving reviewers or zero
   checklist rows — **validate**
5. Approving reviewers present, checklist incomplete — **execute**
6. Approving reviewers present, checklist complete and non-empty — **archive**,
   marked `ready`

A backlog entry SHALL classify as **propose**. `design.md` is optional and SHALL
NOT affect any stage.

The rule set is derived from `agents-task-viewer` ADR 0004 so that the two boards
agree. The specification SHALL name that origin, and SHALL state every deliberate
divergence from it.

#### Scenario: An incomplete change is proposed
- **WHEN** an active change has a proposal but no tasks file
- **THEN** its stage is `propose`.

#### Scenario: An approved change with outstanding work is executing
- **WHEN** an active change is artifact-complete, has two approving reviewers, and has 4 of 9 checklist rows complete
- **THEN** its stage is `execute`.

#### Scenario: A finished change is ready to archive
- **WHEN** an active change is artifact-complete, has two approving reviewers, and every one of its checklist rows is complete
- **THEN** its stage is `archive`
- **AND** the card is marked `ready`.

#### Scenario: A design file never changes the stage
- **WHEN** two otherwise identical changes differ only in whether `design.md` exists
- **THEN** both classify to the same stage.

### Requirement: A Reviewer Counts Only When Their Latest Verdict Approves

A reviewer SHALL count toward the approving-reviewer threshold only when that
reviewer's most recent recorded verdict is an approval. An earlier approval
followed by a later request for changes SHALL NOT count.

This is a deliberate divergence from ADR 0004, which counts approving sections
without subtracting rejections. The divergence exists because this project treats
a rejection as something to be dispositioned rather than outvoted, and the
upstream rule would advance a change carrying unanswered rejections.

#### Scenario: Approvals and rejections from different reviewers
- **WHEN** a change carries approvals from two reviewers and requests for changes from two other reviewers
- **THEN** two reviewers count as approving
- **AND** the change is eligible to pass `validate`.

#### Scenario: A reviewer who later requested changes
- **WHEN** a reviewer approved and subsequently recorded a request for changes on the same change
- **THEN** that reviewer does not count toward the threshold
- **AND** a change left with fewer than two approving reviewers classifies as `validate`.

#### Scenario: The divergence is discoverable
- **WHEN** a reader compares this board's stages with the upstream board's
- **THEN** the specification states the reviewer rule and identifies it as a divergence from ADR 0004.

### Requirement: An Unproven Archive Is Never Shown As Shipped

Separating `ship` from `archive` requires positive proof that the archive entry
is present on `main` or `origin/HEAD`. When that proof cannot be obtained — the
probe fails, times out, the repository has no such ref, or the working copy is
detached — the card SHALL classify as `archive`.

Absence of evidence SHALL resolve to the weaker claim. The board SHALL NOT
report a change as shipped on the strength of a failed check.

#### Scenario: The probe cannot run
- **WHEN** the ship probe fails or times out for an archived change
- **THEN** the card's stage is `archive`, not `ship`.

#### Scenario: No main or origin ref exists
- **WHEN** an archived change sits in a repository with neither a local `main` nor an `origin/HEAD`
- **THEN** the card's stage is `archive`.

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

Five stage columns SHALL be shown while each column is at least 180 CSS pixels
wide. Below that width the board SHALL show one stage at a time behind a stage
rail that names every stage and its card count, and every stage SHALL remain
reachable.

The minimum column width, not a viewport breakpoint, is the binding constraint:
the breakpoint follows from the shell's sidebar and padding, so a change to
either recomputes the threshold rather than invalidating the requirement.

#### Scenario: Five columns at the reference viewport
- **WHEN** the board renders at 1440×900
- **THEN** all five stage columns are visible
- **AND** the page does not scroll horizontally.

#### Scenario: The paged layout on a small viewport
- **WHEN** the board renders at 390×844
- **THEN** one stage is shown at a time behind a stage rail
- **AND** every stage and its card count remain reachable
- **AND** the page does not scroll horizontally.

#### Scenario: An empty stage still reads as a stage
- **WHEN** a stage contains no cards
- **THEN** the column or paged view states that it has no changes rather than rendering blank.

### Requirement: A Change Name Is Never Silently Truncated

A card SHALL show its change name across up to two lines before eliding. When a
name is elided, its full value SHALL remain available in the card's detail view.

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

The open drawer SHALL be addressable: the location SHALL identify the repository
and the change in **separate** parameters. A single composite parameter requiring
a separator SHALL NOT be used, because parsing a separator out of an
author-controlled change name is the failure mode that produced the readiness
sanitiser defect.

#### Scenario: Opening a card is addressable
- **WHEN** a card is selected
- **THEN** a drawer opens over the board showing that change's detail
- **AND** the location identifies the repository and the change in separate parameters.

#### Scenario: A deep link restores the drawer
- **WHEN** a location naming a repository and a change is opened directly
- **THEN** the board renders with that change's drawer already open.

#### Scenario: A deep link to a change that no longer exists
- **WHEN** a location names a change absent from the current board
- **THEN** the board renders without a drawer and states that the change was not found.

### Requirement: The Board Adds No Read Root And No Process-Spawn Site

The board SHALL read only paths already permitted by `filesystem-access-policy`,
and SHALL introduce no new process-spawn site beyond the four the policy
authorises.

The ship probe SHALL be expressed using an already-permitted git subcommand
through the existing bounded-git site. Widening the permitted git subcommands, or
adding a fifth spawn site, SHALL NOT be done to serve this board.

#### Scenario: Reads stay inside the allow-list
- **WHEN** the board reads a repository's changes, archive entries, and backlog
- **THEN** every path read is one the read allow-list already permits.

#### Scenario: No new spawn site appears
- **WHEN** the board determines whether an archived change is shipped
- **THEN** the probe runs through the existing bounded-git site
- **AND** the set of authorised spawn sites is unchanged.
