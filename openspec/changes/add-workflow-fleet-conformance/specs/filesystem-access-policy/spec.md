## MODIFIED Requirements

### Requirement: Read-Only On Project Filesystems

No daemon route SHALL write to, create, delete, or modify any file under a
registered project's root. Exactly two routes SHALL spawn a process, both only as
an explicitly user-driven action per request, and neither writing under a
registered project's root itself:

1. `POST /api/projects/{id}/open`, which spawns `$EDITOR`.
2. The workflow conformance harness runner, which executes a conformance script
   resolving under a known workflow repository root, subject to the bounds in
   `workflow-fleet-conformance`.

No third spawning route may be added without amending this requirement.

#### Scenario: A read route never mutates the project
- **WHEN** any project-scoped read route is called
- **THEN** the project's working tree is byte-identical before and after
- **AND** no file under the project root is created, truncated, or removed.

#### Scenario: The editor exception writes nothing itself
- **WHEN** `POST /api/projects/{id}/open` is called with a path
- **THEN** the daemon spawns `$EDITOR` against that path and returns 200 immediately
- **AND** the daemon itself performs no write; any subsequent change is the user's own editor action.

#### Scenario: The harness exception writes nothing under a project root
- **WHEN** a conformance harness is executed at explicit user request
- **THEN** any fixtures it builds are created outside every registered project's root
- **AND** the working tree of every registered project is byte-identical before and after.

#### Scenario: Only these two routes spawn
- **WHEN** the daemon's route surface is inspected for process creation
- **THEN** exactly the editor route and the harness runner create processes
- **AND** every other route serves its response without spawning.

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The named roots SHALL be the configured
source families and the machine-wide AgenticApps binary directory. The SPA MUST
NOT name any external filesystem path; it names a repo or family, and the daemon
resolves it.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** a fleet-level scanner reads outside a registered project root
- **THEN** the read goes through a dedicated scanner code path with its own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/`, `.claude/`, and `openspec/` and cannot reach it.

#### Scenario: The machine-wide binary directory is read-only and named
- **WHEN** the workflow scanner reads the machine-wide AgenticApps binary directory
- **THEN** that directory is one of the scanner's named allowed roots
- **AND** the scanner only reads from it, never writing or executing through this path.

#### Scenario: A path outside every named root is refused
- **WHEN** a scanner is asked to resolve a path under no named allowed root
- **THEN** the read is refused
- **AND** no file outside the named roots is opened.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet data or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.
