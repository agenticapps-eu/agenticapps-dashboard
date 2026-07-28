# fleet-conformance Specification

## Purpose

Coverage reports raw cell states. Conformance turns them into a number you can
watch move.

This capability scores each family and the fleet as a whole on how much of the
tracked tooling is actually in place, assigns a tier, and charts the trend over a
long window so a slow slide is visible before it becomes a rewrite. It also
surfaces registry entries whose stored paths have drifted, because a drifted repo
silently poisons the denominator of everything above it.

The scoring rules matter more than the presentation: every counted repo
contributes the same two retained workflow cells, while repos whose registry
paths have drifted must not be counted as tooling failures.

## Requirements

### Requirement: Equal-Weight Conformance Scoring

The daemon SHALL compute a conformance score per family and for the fleet by
weighting `claudeMd` and `workflowVersion` equally across every counted repo.
Legacy GitNexus and Wiki states MUST NOT contribute to current scores or to any
day reconstructed from a snapshot containing those fields.

The knowledge-graph analysis status is deliberately excluded because the
coverage-history store has never snapshotted it; adding it would fabricate a
historical measurement rather than preserve one. `fresh` contributes to the
numerator; `fresh`, `stale`, and `missing` contribute to the denominator.
Scores SHALL be integers.

#### Scenario: Every counted repo contributes two cells
- **WHEN** a family contains counted repos
- **THEN** each repo contributes its `claudeMd` and `workflowVersion` state to the denominator
- **AND** only states equal to `fresh` contribute to the numerator.

#### Scenario: The fleet score is the mean of the family scores
- **WHEN** the fleet score is computed from the three counted families
- **THEN** it is the rounded mean of those three family scores
- **AND** it is not a re-pooled per-cell ratio across all repos.

#### Scenario: Historical scores use the same measurement as today's score
- **WHEN** a daily series is reconstructed from snapshots written before and after legacy fields stopped being written
- **THEN** every day is scored using only `claudeMd` and `workflowVersion`, with retained `not-applicable` values normalised to `missing`
- **AND** the deployment date does not create a measurement-set discontinuity.

### Requirement: Drifted Repos Excluded From Scoring

Repos identified as having drifted registry paths SHALL be excluded from their
family's denominator, and the `other` family SHALL be excluded from scoring
entirely.

#### Scenario: A drifted repo does not count against its family
- **WHEN** a repo is reported as path-drifted
- **THEN** it is removed from its family's denominator for that computation
- **AND** the family score reflects only repos whose paths are trustworthy.

### Requirement: Conformance Tiers

A score SHALL map to exactly one tier by fixed thresholds: 90 and above is the
top tier, 70 through 89 the middle tier, and below 70 the bottom tier. The tier
function MUST be shared by daemon and SPA so both agree at the boundaries.

#### Scenario: Tier boundaries are exact
- **WHEN** scores of 89, 90, 69, and 70 are mapped to tiers
- **THEN** 89 is middle, 90 is top, 69 is bottom, and 70 is middle
- **AND** both ends of the wire use the same function to decide.

### Requirement: Conformance Endpoint

The daemon SHALL expose a conformance endpoint returning today's per-family and
fleet scores, a delta against a baseline point, the daily series across the
retention window, and the list of drifted registry entries. The payload MUST be
validated on the way out, and the composed scan MUST be failure-isolated so a
partial failure degrades the payload rather than returning a server error.

#### Scenario: A partial scan failure still returns a payload
- **WHEN** one component of the conformance scan fails
- **THEN** the endpoint returns a defensive payload built from what succeeded
- **AND** does not return a 500.

#### Scenario: Same-day duplicate records collapse
- **WHEN** the history window contains more than one record for a repo on the same day
- **THEN** the last record for that day wins
- **AND** the day contributes exactly one point to the series.

### Requirement: Fleet Trend Chart

The conformance surface SHALL render the daily series as a chart drawn without
any charting library, plotting one line per family plus a visually heavier fleet
aggregate line, with a fixed 0-to-100 axis and marked threshold rules at the tier
boundaries.

#### Scenario: The chart is legible without interaction
- **WHEN** the trend chart renders
- **THEN** a persistent legend identifies each line and the tier threshold rules are labelled
- **AND** the reader can attribute every line without hovering.

#### Scenario: No charting library is introduced
- **WHEN** the chart is implemented
- **THEN** it is drawn with plain vector markup
- **AND** no third-party charting dependency is added.

### Requirement: Chart Reveal Across Input Modalities

Per-day detail SHALL be revealable by pointer, keyboard focus, and touch, and
dismissible by keyboard. The detail panel MUST stay within the chart bounds at
narrow viewports.

#### Scenario: Keyboard users can read any day
- **WHEN** a keyboard user tabs across the chart
- **THEN** each day can receive focus and reveal its breakdown
- **AND** pressing Escape dismisses the revealed detail.

### Requirement: Honest Cold-Start States

The chart SHALL state plainly when it lacks history rather than implying a trend.
With no data it says so; with partial data it says how many more days are needed.

#### Scenario: Partial history says what is missing
- **WHEN** the series holds fewer days than the chart needs to be meaningful
- **THEN** it reports that it is still building the trend and how many more days are needed
- **AND** does not render a misleading partial line as a complete trend.

### Requirement: Chart Accessibility

The chart SHALL expose an accessible label and a screen-reader-only tabular
equivalent of the plotted data, so non-visual users get the numbers rather than
an unlabelled graphic.

#### Scenario: Screen readers get a table
- **WHEN** a screen reader reaches the chart
- **THEN** it encounters a labelled graphic plus a visually hidden table with one row per day
- **AND** each row carries the fleet and per-family values for that day.

### Requirement: Path Drift Panel

The conformance surface SHALL render a panel listing drifted registry entries
above the score cards, and MUST render nothing when there is no drift. Each row
SHALL offer the suggested path when one was inferred, or an input for the user to
supply one, plus an action to repair the entry.

#### Scenario: No drift renders no panel
- **WHEN** the drift list is empty
- **THEN** the panel is absent entirely rather than rendered empty.

#### Scenario: Repair feedback is user-legible
- **WHEN** a path repair succeeds or fails
- **THEN** a toast reports the outcome
- **AND** a failure shows a mapped, user-friendly message rather than a raw error string or a filesystem path.

#### Scenario: Concurrent repairs are click-safe
- **WHEN** a repair is already in flight for a row
- **THEN** that row's action reflects the in-flight state
- **AND** repeated clicks do not issue duplicate repairs.
