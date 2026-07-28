# fleet-coverage Specification

## Purpose

The registry answers "what is this project doing?". Coverage answers a wider
question: **across every repo I own, where is the tooling actually installed and
is it current?**

The coverage matrix scans every git repo one level deep under the known family
roots and reports, per repo, whether `CLAUDE.md` is present, whether the workflow
skill is current, and whether Understand Anything analysis is current. Current
cells carry one of three freshness states. The daemon snapshots the two
historically comparable workflow fields daily so a cell that just improved or
regressed says so.

Coverage reads far outside any registered project root, which is why it goes
through dedicated daemon-side scanners with their own allowed roots rather than
the project read route (see `filesystem-access-policy`).

## Requirements

### Requirement: Fleet Coverage Matrix

The daemon SHALL expose coverage response schema version 2 with one entry per
git repo found one level deep under the known family roots. Each entry SHALL
carry its family, repo name, override count, `claudeMd` freshness,
`workflowVersion` freshness, and the knowledge-graph analysis status defined by
`code-intelligence`.

#### Scenario: Every family repo appears exactly once
- **WHEN** the coverage scan runs across the family roots
- **THEN** each git repo one level deep produces exactly one matrix entry
- **AND** each entry reports all three specified state-bearing columns.

### Requirement: Three-State Column Freshness

Every coverage cell SHALL report exactly one of three states: `fresh`, `stale`,
or `missing`. Staleness thresholds are per column, and a binary
present-or-absent column MUST NOT report `stale`.

#### Scenario: A binary column never reports stale
- **WHEN** the `CLAUDE.md` column is evaluated
- **THEN** it reports `fresh` when present and `missing` when absent
- **AND** it never reports `stale`.

#### Scenario: A missing maintained artifact is not neutral
- **WHEN** a tracked artifact or workflow installation is absent
- **THEN** its cell reports `missing`
- **AND** the matrix does not render a tool-not-installed hint
- **AND** this does not remove the SPA-constructed re-analysis command for a missing knowledge graph.

### Requirement: Coverage Wire Version Skew Is Explicit

The SPA SHALL accept versions 1 and 2 of both the live coverage response and the
coverage-history response. Both deployed version-1 responses are discriminated
by literal `schemaVersion: 1`. A version-1 live response requires the retained
row cells `claudeMd` and `workflowVersion` using the four-state vocabulary and
permits the optional `understand` cell used by later version-1 daemons. A
version-1 history response requires retained cells `claudeMd` and
`workflowVersion` using that same vocabulary.

The SPA SHALL validate the version-1 discriminator, envelope identity, and
retained cells before normalising. It SHALL tolerate and discard legacy
`gitNexus`, `wiki`, and GitNexus install-state data without validating their
internal shapes, preserve `understand` when present, and map `not-applicable` in
any retained cell to `missing`. When a version-1 row has no `understand` cell,
the SPA SHALL present `Unavailable from this daemon` without creating a
coverage cell and SHALL exclude that presentation from freshness aggregates and
filters. The daemon SHALL emit version 2 for both responses. A pre-version-2
SPA receiving either version-2 response SHALL reach the existing explicit
schema-drift recovery state rather than render partial data.

#### Scenario: Current SPA reads an older daemon
- **WHEN** the current SPA receives valid version-1 live coverage and history responses
- **THEN** it validates the literal version and retained cells while tolerating and discarding legacy integration data
- **AND** preserves a supplied knowledge-graph cell or presents an absent one as unavailable without inventing a state
- **AND** maps any retained `not-applicable` value to `missing`.

#### Scenario: Current SPA reads the current daemon
- **WHEN** the SPA receives version-2 live coverage and history responses
- **THEN** it validates each strict version-2 shape
- **AND** displays the current matrix and history without compatibility placeholders.

#### Scenario: A stale SPA does not render version-2 data partially
- **WHEN** a pre-version-2 SPA receives a version-2 coverage or history response
- **THEN** its strict validation reaches the product's explicit schema-drift recovery state
- **AND** reloading the current static build restores the surface.

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

The coverage surface SHALL provide multi-select status filter chips for
`fresh`, `stale`, and `missing`, defaulting to all, and a free-text repo-name
search, with filter state persisted to URL query parameters. Unrecognised status
values from an older shared URL SHALL be discarded. If every supplied status is
unrecognised, filtering SHALL degrade to the default all-selected view. Default
sort is family-alphabetical then repo-alphabetical.

#### Scenario: A filtered coverage view is shareable
- **WHEN** a user filters to missing rows and searches a name fragment
- **THEN** the URL captures both
- **AND** opening that URL reproduces the same view.

#### Scenario: A stale status value degrades safely
- **WHEN** a shared URL contains `status=not-applicable` together with recognised status values
- **THEN** the unrecognised value is discarded and the recognised selection is applied
- **AND** when every supplied status is unrecognised the surface uses the default all-selected view.

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
`claudeMd` and `workflowVersion` freshness into a private directory under its
own state directory. A pruner SHALL drop snapshots older than the retention
window, validating filenames before deleting anything. Snapshots MUST NOT be
backfilled for missed days.

Readers MUST accept records containing additional legacy `gitNexus` and `wiki`
fields and ignore those fields. A legacy `not-applicable` value in
`claudeMd` or `workflowVersion` SHALL normalise to `missing` for drift and score
computation. Readers MUST NOT rewrite or delete an otherwise valid historical
record because it contains legacy fields or values.

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

#### Scenario: Legacy records remain readable
- **WHEN** the retained window contains a snapshot with legacy fields or `not-applicable` in a retained cell
- **THEN** the reader ignores the removed fields and maps the retained legacy value to `missing`
- **AND** the historical record is neither rejected, rewritten, nor deleted.

### Requirement: Per-Cell Drift Indicator

The daemon SHALL compute, for a given repo and each of `claudeMd` and
`workflowVersion`, the most recent state transition within the history window
and report its direction and how many days ago it occurred. The history response
schema version SHALL be `2` and its cell object SHALL contain exactly
`claudeMd` and `workflowVersion`. The surface SHALL render an inline improvement
or regression indicator on each cell for which a transition is computed, with
an accessible label.

#### Scenario: A recent regression is visible on the cell
- **WHEN** a cell's state worsened three days ago within the window
- **THEN** the cell renders a regression indicator reading three days
- **AND** exposes an accessible label stating that it regressed three days ago.

#### Scenario: No transition in the window renders no indicator
- **WHEN** a cell has held the same state across the whole window
- **THEN** no drift indicator is rendered.

#### Scenario: Version 2 has the reduced strict shape
- **WHEN** the coverage-history endpoint returns a current response
- **THEN** its `schemaVersion` is `2`
- **AND** its cells contain exactly `claudeMd` and `workflowVersion`.

### Requirement: Responsive Coverage Layout

The coverage surface SHALL render a card-per-repo layout at the smallest
viewport, preserving all three matrix states and keeping interactive controls
at an accessible touch-target size. Larger viewports keep the table layout with
consistent column widths across family sections. Row actions SHALL be limited
to the review-override affordance, the daemon-served Understand Anything viewer,
and its SPA-constructed copy-command affordance.

#### Scenario: Small viewports switch to cards
- **WHEN** the coverage page renders at the smallest breakpoint
- **THEN** each repo renders as a card carrying its name, override chip, three matrix states, and applicable Understand Anything actions
- **AND** every interactive control keeps an accessible touch target.

#### Scenario: Column widths agree across family sections
- **WHEN** the table layout renders multiple family sections
- **THEN** corresponding columns are the same width in every section
- **AND** that width comes from a single shared source of truth rather than per-section values.

#### Scenario: Desktop rows expose only the current actions
- **WHEN** the coverage table renders
- **THEN** row actions consist only of review-override and applicable Understand Anything affordances
- **AND** those actions keep their existing behavior.
