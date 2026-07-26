# fleet-coverage Specification

## Purpose

The registry answers "what is this project doing?". Coverage answers a wider
question: **across every repo I own, where is the tooling actually installed and
is it current?**

The coverage matrix scans every git repo one level deep under the known family
roots and reports, per repo, the state of each tracked tooling column — is
`CLAUDE.md` present, is the code graph indexed and fresh, is the knowledge wiki
compiled recently, is the workflow skill at the current version. Each cell
carries one of four freshness states, and the daemon writes a daily snapshot so
the matrix has a memory: a cell that just improved or regressed says so.

Coverage reads far outside any registered project root, which is why it goes
through dedicated daemon-side scanners with their own allowed roots rather than
the project read route (see `filesystem-access-policy`).

## Requirements

### Requirement: Fleet Coverage Matrix

The daemon SHALL expose a coverage matrix with one entry per git repo found one
level deep under the known family roots. Each entry SHALL carry its family, repo
name, a state for each tracked tooling column, an override count, and a freshness
state per column.

#### Scenario: Every family repo appears exactly once
- **WHEN** the coverage scan runs across the family roots
- **THEN** each git repo one level deep produces exactly one matrix entry
- **AND** each entry reports its family and per-column freshness.

### Requirement: Four-State Column Freshness

Every coverage cell SHALL report exactly one of four states: `fresh`, `stale`,
`missing`, or `not-applicable`. Staleness thresholds are per column, and a column
that is binary present-or-absent MUST NOT report `stale`.

#### Scenario: A binary column never reports stale
- **WHEN** the `CLAUDE.md` column is evaluated
- **THEN** it reports `fresh` when present and `missing` when absent
- **AND** it never reports `stale`.

#### Scenario: An uninstalled tool reports not-applicable, not missing
- **WHEN** a tool is not installed on the machine at all
- **THEN** every repo's cell for that column reports `not-applicable`
- **AND** the surface shows a neutral state with an install hint rather than a fleet of red cells.

### Requirement: Workflow Version Comparison

The workflow-version column SHALL compare each repo's installed workflow skill
version against the current head version derived from the highest-numbered
migration in the scaffolder repository. The probe MUST tolerate the known
alternative skill directory layouts.

#### Scenario: Installed version is compared against migration head
- **WHEN** a repo's installed workflow skill version is read
- **THEN** it is compared against the `to_version` of the highest-numbered migration
- **AND** equal reads as current, behind reads as stale, and a missing version field is distinguished from a missing skill file.

#### Scenario: Both skill directory layouts are probed
- **WHEN** the version probe looks for a repo's workflow skill
- **THEN** it tries each known candidate path under that repo's skills directory
- **AND** reports the skill missing only when none of them resolves.

### Requirement: Family Grouping And Aggregates

The coverage surface SHALL group repos by family under sticky section headers
showing aggregate counts of missing, stale, and fresh, with a per-family collapse
toggle. The matrix value MUST always be visible rather than hidden behind tree
expansion. Aggregates MUST reflect the filtered view.

#### Scenario: Aggregates track the active filter
- **WHEN** a status filter is applied
- **THEN** each family header's counts reflect only the visible rows
- **AND** collapsing a family hides its rows without changing the counts it reports.

### Requirement: Filtering And Search

The coverage surface SHALL provide multi-select status filter chips defaulting to
all, and a free-text repo-name search, with filter state persisted to URL query
parameters. Default sort is family-alphabetical then repo-alphabetical.

#### Scenario: A filtered coverage view is shareable
- **WHEN** a user filters to missing rows and searches a name fragment
- **THEN** the URL captures both
- **AND** opening that URL reproduces the same view.

### Requirement: Review-Override Visibility

A repo with any recorded review-override sentinel SHALL show an inline override
chip next to its name, expandable to list each override with the phase it belongs
to and the date it was recorded. The chip MUST be absent when the count is zero.

#### Scenario: Overrides are discoverable but unobtrusive
- **WHEN** a repo carries two override sentinels
- **THEN** an override chip shows the count next to the repo name
- **AND** expanding it lists each phase slug with the date its sentinel appeared.

### Requirement: Daily Coverage History Snapshots

The daemon SHALL write one NDJSON snapshot per day recording each repo's
per-column freshness, into a private directory under its own state directory. A
pruner SHALL drop snapshots older than the retention window, validating filenames
before deleting anything. Snapshots MUST NOT be backfilled for missed days.

#### Scenario: The pruner only deletes what it recognises
- **WHEN** the retention pruner runs over the snapshot directory
- **THEN** it deletes only files whose names match the expected dated-NDJSON pattern and fall outside the window
- **AND** any unrecognised entry is skipped rather than unlinked.

#### Scenario: A missed day is not fabricated
- **WHEN** the daemon was off for several days and then starts
- **THEN** it writes today's snapshot if absent
- **AND** does not invent snapshots for the days it was not running.

#### Scenario: Snapshot failure never crashes the daemon
- **WHEN** a scheduled snapshot write fails
- **THEN** the error is logged and swallowed
- **AND** the scheduler re-arms so the next day's snapshot is still attempted.

### Requirement: Per-Cell Drift Indicator

The daemon SHALL compute, for a given repo and column, the most recent state
transition within the history window and report its direction and how many days
ago it occurred. The surface SHALL render an inline improvement or regression
indicator on the cell, with an accessible label.

#### Scenario: A recent regression is visible on the cell
- **WHEN** a cell's state worsened three days ago within the window
- **THEN** the cell renders a regression indicator reading three days
- **AND** exposes an accessible label stating that it regressed three days ago.

#### Scenario: No transition in the window renders no indicator
- **WHEN** a cell has held the same state across the whole window
- **THEN** no drift indicator is rendered.

### Requirement: Scoped Refresh Actions

The coverage surface SHALL offer scoped refresh actions constrained to an
explicit action enum. The daemon MUST reject any action outside that enum at
schema-parse time. Actions that are merely clipboard hints MUST be constructed
SPA-side and MUST NOT round-trip through the daemon.

#### Scenario: An unrecognised action is rejected at parse
- **WHEN** a refresh request names an action outside the permitted enum
- **THEN** the daemon rejects it with a 400 at schema validation
- **AND** no subprocess is spawned.

#### Scenario: A successful refresh updates the row in place
- **WHEN** a scoped scan action completes successfully
- **THEN** the daemon returns the updated row
- **AND** the coverage cache is invalidated so the cell reflects the new state without a manual reload.

### Requirement: Responsive Coverage Layout

The coverage surface SHALL render a card-per-repo layout at the smallest
viewport, preserving each column's state and keeping interactive controls at an
accessible touch-target size. Larger viewports keep the table layout with
consistent column widths across family sections.

#### Scenario: Small viewports switch to cards
- **WHEN** the coverage page renders at the smallest breakpoint
- **THEN** each repo renders as a card carrying its name, override chip, four column states, and its actions
- **AND** action controls remain at an accessible touch-target size.

#### Scenario: Column widths agree across family sections
- **WHEN** the table layout renders multiple family sections
- **THEN** corresponding columns are the same width in every section
- **AND** that width comes from a single shared source of truth rather than per-section values.
