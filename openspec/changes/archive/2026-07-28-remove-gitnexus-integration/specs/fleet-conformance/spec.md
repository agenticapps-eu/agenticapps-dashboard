## MODIFIED Requirements

### Requirement: Equal-Weight Conformance Scoring

The daemon SHALL compute a conformance score per family and for the fleet by
weighting `claudeMd` and `workflowVersion` equally across every counted repo.
GitNexus and Wiki states MUST NOT contribute to current scores or to any day
reconstructed from a snapshot containing those legacy fields.

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
- **WHEN** a daily series is reconstructed from snapshots written before and after GitNexus and Wiki fields stopped being written
- **THEN** every day is scored using only `claudeMd` and `workflowVersion`, with retained `not-applicable` values normalised to `missing`
- **AND** the deployment date does not create a measurement-set discontinuity.
