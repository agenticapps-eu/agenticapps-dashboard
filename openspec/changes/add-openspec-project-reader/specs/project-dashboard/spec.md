## MODIFIED Requirements

### Requirement: Multi-Project Home Renders A Card Per Project

The home route SHALL render one card per registered project, each showing the
count of open changes with per-change task completion, review finding counts by
severity, and the last-commit time. Clicking a card MUST navigate to that
project's single-project view.

#### Scenario: Cards summarise every registered project
- **WHEN** the home page loads with several registered projects
- **THEN** each project renders a card with its open-change count, each open change's completed-over-total task ratio, finding counts, and last-commit time
- **AND** clicking a card opens that project's detail view.

#### Scenario: A project without the workflow shows an install hint
- **WHEN** a registered project has no `openspec/` directory
- **THEN** its card states that plainly and offers an install hint
- **AND** does not render an error or a crash state.

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

## ADDED Requirements

### Requirement: Change Progress Column

The centre column SHALL render, for each open change: its name, its
completed-over-total task count, and the capabilities its spec deltas affect.
Completed work SHALL be readable from the archived changes, ordered by their
date prefix.

#### Scenario: Open changes are listed with real progress
- **WHEN** a project has several open changes
- **THEN** each is listed with its task ratio and affected capabilities
- **AND** a change carrying no task list is reported as having no task data rather than as zero progress.

#### Scenario: Archived changes order correctly without inference
- **WHEN** completed history is rendered
- **THEN** archived changes are ordered by their date prefix
- **AND** no heuristic is applied to derive an ordering from their names.

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
reading the project's `openspec/` tree directly when it is not. Archived changes
SHALL always be read from the tree, because the CLI does not expose them. Both
paths MUST produce the same values for the same project.

#### Scenario: The CLI path and the tree path agree
- **WHEN** the same project is read once with the CLI available and once without
- **THEN** the reported open changes, task ratios, and capability counts are identical
- **AND** neither path reports data the other cannot.

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
