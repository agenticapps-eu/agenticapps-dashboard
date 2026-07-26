## MODIFIED Requirements

### Requirement: Multi-Project Home Renders A Card Per Project

The home route SHALL render one card per registered project, each showing the
count of open changes with per-change task completion and the last-commit time.
Clicking a card MUST navigate to that project's single-project view.

Review finding counts by severity are **removed from the card**. Their only
source was the GSD phase reader's artifact parsing, which this change retires,
and OpenSpec `REVIEWS.md` carries reviewer prose with no structured severity to
aggregate. A card field with no derivable source is a field that renders a
fabricated number; it is dropped rather than approximated. Re-adding it requires
a change that first specifies where severity comes from.

#### Scenario: Cards summarise every registered project
- **WHEN** the home page loads with several registered projects
- **THEN** each project renders a card with its open-change count, each open change's completed-over-total task ratio, and last-commit time
- **AND** clicking a card opens that project's detail view.

#### Scenario: A project with no workflow shows an install hint
- **WHEN** a registered project reports the `no-workflow` condition
- **THEN** its card states that plainly and offers an install hint
- **AND** does not render an error or a crash state.

#### Scenario: A GSD-only project is told to migrate, not to install
- **WHEN** a registered project reports the `needs-migration` condition
- **THEN** its card offers a migration hint naming that the workflow is installed but not yet migrated to OpenSpec
- **AND** it does not tell the user to install a workflow that is already present.

#### Scenario: Task ratios come from real counts, not artifact presence
- **WHEN** an open change's task list is partially complete
- **THEN** the ratio reflects the actual completed-versus-total task count
- **AND** it is not inferred from which planning artifacts happen to exist.

### Requirement: Single-Project Header Context

The single-project view SHALL show a header carrying the project name and client,
the current branch, and a summary of open changes, plus a link back to the
project list.

#### Scenario: An issue reference links out without an API call
- **WHEN** a Linear-style issue reference is detectable from the branch name or commits
- **THEN** the header renders it as a static link
- **AND** no integration API call is required to render that link.

#### Scenario: Opening a GSD-only project explains the migration
- **WHEN** a project reporting `needs-migration` is opened from its card
- **THEN** the view renders an informational state naming that the project predates the OpenSpec layout and that progress data resumes once it migrates
- **AND** it renders neither a blank page nor an error, and the header, branch, and last-commit context still render.

## ADDED Requirements

### Requirement: Change Progress Column

The centre column SHALL render, for each open change: its name, its
completed-over-total task count, and the capabilities its spec deltas affect.
Completed work SHALL be readable from the archived changes.

**Affected capabilities** SHALL be derived from the directory names under the
change's own `specs/` tree — each `specs/<capability>/` is one affected
capability. The `openspec` CLI does not report them, so this value is always
read from the tree, on both read paths. A change with no `specs/` directory
affects no capability; that is a legitimate in-progress state, not an error.

**An open change** is a directory directly under `openspec/changes/`, other than
`archive/`, whose name does not begin with a dot. Nothing further is required of
it: a directory holding only a `tasks.md`, or only a `proposal.md`, is an open
change and MUST be listed. This is deliberately permissive — a change is
incomplete for most of its life, and a reader that hides half-written changes
hides exactly the work in flight.

**The change set is always enumerated from the tree**, on both read paths. The
CLI supplies task counts for changes the tree has already found; it does not
decide which changes exist. Were the CLI's set authoritative, a change it
declines to list — because it is half-written, or fails a validation the reader
does not impose — would vanish from the column exactly when the binary is
present, which is the majority case. A change the CLI reports and the tree does
not is ignored, since the tree is what the allow-list bounds.

**Archive ordering** SHALL rely on a pinned format rather than inference:
archived change directories are named with a zero-padded ISO `YYYY-MM-DD-`
prefix, which makes lexicographic order chronological by construction. A
directory whose name does not match that prefix SHALL be ordered after every
matching one, grouped and sorted by name, and no chronological claim is made for
it. This is the weakness the GSD phase names had, closed by pinning the format
instead of inheriting it by omission.

The non-matching rule is defensive, not a legacy accommodation: all 21
directories in this repo's archive were measured on 2026-07-26 and every one
already carries a conforming prefix, including the GSD-era phases renamed during
the migration. No existing archive is displaced by the rule.

**Task counts** SHALL distinguish an absent task artifact from an empty one. The
reported shape carries task-artifact presence as its own value; a change with no
`tasks.md` is reported as having no task data, and a change with a `tasks.md`
containing no task lines is reported as zero of zero. Neither may be inferred
from a count of zero, because the CLI reports zero for both.

A change with no task artifact is still **listed**. "Reported as having no task
data" replaces its progress ratio with an explicit no-task-list state; it never
means the change is omitted from the column.

#### Scenario: Open changes are listed with real progress
- **WHEN** a project has several open changes
- **THEN** each is listed with its task ratio and affected capabilities
- **AND** a change carrying no task artifact is still listed, showing an explicit no-task-list state in place of its ratio rather than a zero ratio or no row at all.

#### Scenario: A directory holding only one artifact still counts as an open change
- **WHEN** a directory under `openspec/changes/` contains only a `tasks.md`, or only a `proposal.md`
- **THEN** it is listed as an open change
- **AND** it is not filtered out for being incomplete.

#### Scenario: An incomplete change does not disappear when the CLI is available
- **WHEN** the tree contains a change directory that the `openspec` CLI does not report
- **THEN** the change is still listed, with tree-derived values
- **AND** the CLI's change set does not narrow the set enumerated from the tree.

#### Scenario: A change with no spec delta yet renders without capabilities
- **WHEN** an open change has a `tasks.md` but no `specs/` directory
- **THEN** it is listed with its task ratio and an explicit no-spec-delta state
- **AND** the column does not render an error or omit the change.

#### Scenario: Archived changes order correctly without inference
- **WHEN** completed history is rendered
- **THEN** archived changes are ordered by their zero-padded ISO date prefix
- **AND** a directory not matching that prefix is ordered after all matching ones rather than interleaved by a heuristic.

#### Scenario: A project with no open changes says so
- **WHEN** a project has an `openspec/` directory containing no open changes
- **THEN** the column renders an empty state explaining that no change is in flight
- **AND** it is not rendered as an unreadable project or as an error.

### Requirement: Capability Panel

The single-project view SHALL render the project's declared capabilities and the
requirement count of each, read from its spec directory. This states what the
project currently promises, as distinct from what work is in flight.

#### Scenario: Capabilities are listed with requirement counts
- **WHEN** a project's spec directory contains capability specifications
- **THEN** each capability is listed with the number of requirements it declares
- **AND** the panel is presented as current truth rather than as activity.

#### Scenario: A project with no specs says so
- **WHEN** a project has an `openspec/` directory but no capability specifications yet
- **THEN** the panel renders an empty state explaining that no capabilities are declared
- **AND** does not render an error.

### Requirement: Hybrid OpenSpec Read Strategy

The daemon SHALL read a project's OpenSpec data using the `openspec` CLI's
machine-readable output when that binary is available, and SHALL fall back to
reading the project's `openspec/` tree directly when it is not. The binary is
bounded by the invocation discipline in `filesystem-access-policy`.

Three values are always read from the tree on **both** paths, because the CLI
reports none of them: the archived changes, each change's affected capabilities,
and task-artifact presence. The CLI emits `completedTasks` and `totalTasks` as
zero for a change with no task artifact and for one with an empty artifact, so
presence cannot be recovered from its output at all. These three are not a
fallback — the tree is where they live, and the CLI path reads them there too.

**The parity claim is pinned to a field set and a scope**, because an unqualified
"both paths produce the same values" is not testable and, taken literally, is
false. The two paths MUST agree on exactly:

| Field | Per |
|---|---|
| open change names | project |
| completed task count | open change |
| total task count | open change |
| capability names | project |
| requirement count | capability |

Task-artifact presence is deliberately **not** in this table: it has one source
on both paths, so agreement is structural rather than an invariant to test.

Parity is claimed over a **conformant project**, and conformance has two parts
because the two paths disagree in two different places:

- A **conformant change directory** is one whose task list is a top-level
  `tasks.md` and whose spec deltas are `specs/<capability>/spec.md`. OpenSpec
  permits task artifacts the tree reader does not locate; for a non-conformant
  change the two paths MAY differ.
- A **conformant capability spec** is one whose requirements are nested under a
  `## Requirements` section heading. The CLI counts only requirements under that
  heading; the tree reader counts `### Requirement:` headings wherever they sit.
  A spec file that omits the section heading therefore reports a different
  `requirementCount` on the two paths — measured against `openspec` 1.6.0 on
  2026-07-26: the CLI reports 0 where the tree reports 2. `openspec validate`
  rejects such a file, so this is a malformed-input case rather than a supported
  one, but the parity MUST above cannot hold for it and does not claim to.

Where the two paths differ within these bounds the daemon SHALL prefer the CLI's
value. Stating the scope is what makes the MUST enforceable — an invariant that
cannot fail is not an invariant, and one whose stated scope does not match where
it actually holds is worse, because it reads as tested when it is not.

#### Scenario: The CLI path and the tree path agree on the pinned field set
- **WHEN** the same conformant project is read once with the CLI available and once without
- **THEN** every field in the pinned set above is identical between the two reads
- **AND** the test asserts the whole set rather than a sampled subset.

#### Scenario: A non-conformant change prefers the CLI
- **WHEN** a change stores its task list somewhere the tree reader does not locate and the CLI path is available
- **THEN** the CLI's task counts are reported
- **AND** the divergence is not reported as a parity failure.

#### Scenario: A missing CLI degrades rather than fails
- **WHEN** the `openspec` binary is not installed on the daemon host
- **THEN** the project is read from its tree
- **AND** no route errors and no panel reports the project as unreadable.

## REMOVED Requirements

### Requirement: Phase Progress Column

**Reason**: The GSD phase engine has been replaced by OpenSpec, and the GSD
reader is retired in this change. There is no phase to render: progress is now
expressed as open changes with real task counts, specified above as
`Change Progress Column`.

**Migration**: Projects still on the GSD layout render no progress data until
they migrate. At the time of this change that is 8 repos, including `cparx` and
`claude-workflow` — an accepted cost, recorded in this change's proposal. The
remedy is to migrate those repos; the historical phase artifacts remain readable
on disk under each project's own planning archive.
