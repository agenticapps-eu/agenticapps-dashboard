## MODIFIED Requirements

### Requirement: Per-Project Computed Status

`GET /api/registry` SHALL compute per-project status at request time, cached
briefly, reporting reachability, whether `openspec/` exists, whether the
workflow skill is installed, the count of open changes, the count of declared
capabilities, and the last commit timestamp on the current branch.

#### Scenario: Status reflects a project with no workflow installed
- **WHEN** a registered project has no `openspec/` directory
- **THEN** its status reports that absence rather than erroring
- **AND** the home card renders an install hint instead of change data.

#### Scenario: Status carries counts, not a synthesised phase
- **WHEN** status is computed for a migrated project
- **THEN** it reports open-change and capability counts
- **AND** it does not synthesise a phase number or phase status.

## ADDED Requirements

### Requirement: OpenSpec Auto-Discovery Marker

`register --auto` SHALL treat the presence of an `openspec/` directory as a valid
AgenticApps project marker, alongside the existing workflow-skill marker. Each
match MUST still be confirmed by the user before registration.

#### Scenario: A migrated project is discoverable
- **WHEN** auto-discovery scans a parent directory containing a project whose only marker is `openspec/`
- **THEN** that project is offered as a match
- **AND** it is registered only after explicit user confirmation.
