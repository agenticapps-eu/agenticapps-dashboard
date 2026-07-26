## ADDED Requirements

### Requirement: Conformance History Survives A Column-Set Change

When the set of tracked coverage columns changes, historical conformance scores
SHALL be recomputed over the new column set rather than left as recorded. The
daily series MUST remain comparable end to end, so a change in measurement is
never rendered as a change in fleet health.

#### Scenario: History is re-scored, not stepped
- **WHEN** a tracked column is removed and the 90-day trend is rendered
- **THEN** every historical day is scored over the same reduced column set as today
- **AND** the series shows no discontinuity at the cutover date.

#### Scenario: Removing a mostly-failing column does not fake an improvement
- **WHEN** the removed column was predominantly non-green across the fleet
- **THEN** historical scores rise consistently across the whole window, reflecting the new measure applied throughout
- **AND** the chart does not show an apparent fleet-wide improvement dated to the removal.

#### Scenario: Stored snapshots retain their per-column detail
- **WHEN** conformance history is recomputed
- **THEN** the recomputation reads the per-column states already stored in each daily snapshot
- **AND** the stored snapshots are not rewritten or discarded, so a future column-set change can be recomputed the same way.
