## ADDED Requirements

### Requirement: OpenSpec Auto-Discovery Marker

`register --auto` SHALL treat the presence of an `openspec/` directory as a valid
AgenticApps project marker, in addition to the existing workflow-skill and
`.planning/config.json` markers. Each match MUST still be confirmed by the user
before registration.

#### Scenario: A migrated project is discoverable
- **WHEN** auto-discovery scans a parent directory containing a project whose only marker is `openspec/`
- **THEN** that project is offered as a match
- **AND** it is registered only after explicit user confirmation.

### Requirement: Migrated Projects Report Their Front End

A registered project's computed status SHALL report which planning front end it
uses, so the dashboard can render the correct progress shape without inferring it
per panel.

#### Scenario: Status names the front end
- **WHEN** project status is computed for a migrated project
- **THEN** it reports the OpenSpec front end
- **AND** consumers render the OpenSpec progress shape rather than probing for phase directories.
