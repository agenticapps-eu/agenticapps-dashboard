## ADDED Requirements

### Requirement: Planning Front End Detection

The daemon SHALL determine which planning front end a registered project uses
rather than assuming one. A project carrying an `openspec/` directory SHALL be
read as an OpenSpec project; a project carrying `.planning/phases/` SHALL be read
as a GSD project. Both SHALL remain supported for the duration of the fleet
migration.

#### Scenario: An OpenSpec project is detected and read
- **WHEN** a registered project contains `openspec/specs/` and `openspec/changes/`
- **THEN** the daemon reads its progress from the OpenSpec layout
- **AND** does not report the project as having no workflow installed.

#### Scenario: A GSD project still reads as before
- **WHEN** a registered project contains `.planning/phases/` and no `openspec/`
- **THEN** the daemon reads its progress from the phase tree exactly as it does today.

#### Scenario: A project with neither is reported honestly
- **WHEN** a registered project has neither layout
- **THEN** the daemon reports no workflow installed and the card renders its install hint.

### Requirement: OpenSpec Progress Projection

For an OpenSpec project the daemon SHALL project progress from active changes in
`openspec/changes/` and completed work in `openspec/changes/archive/`, reporting
per-change task completion derived from the change's `tasks.md` checklist.

#### Scenario: Active and archived changes are distinguished
- **WHEN** an OpenSpec project has both active changes and archived ones
- **THEN** only the active changes count as in-flight work
- **AND** archived changes are reported as completed history.

#### Scenario: Task completion comes from the change's own checklist
- **WHEN** an active change's `tasks.md` has some items checked
- **THEN** the projected progress reflects that ratio
- **AND** a change with no `tasks.md` is reported as having no task data rather than zero progress.
