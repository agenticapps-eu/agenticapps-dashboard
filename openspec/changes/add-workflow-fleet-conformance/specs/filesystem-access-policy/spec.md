## MODIFIED Requirements

### Requirement: Read-Only On Project Filesystems

The daemon itself SHALL NOT write to, create, delete, or modify any file under a
registered project's root.

Process creation is separately enumerated. The daemon SHALL spawn a process only
through one of the following, and no further spawning surface may be introduced
without amending this requirement:

1. `POST /api/projects/{id}/open`, which spawns `$EDITOR` per explicit user click.
2. `GET /api/projects/{id}/git`, bounded by the git command allow-list below.
3. The OpenSpec reader's use of the `openspec` binary, bounded by its own argv
   discipline.
4. The workflow conformance harness runner, bounded by
   `workflow-fleet-conformance`.

Items 1 and 4 run foreign programs the daemon does not control. For those, the
daemon SHALL guarantee only what it can enforce at the spawn boundary — the
program invoked, its arguments, its working directory, its resource bounds, and
its termination. It SHALL NOT assert what the spawned program does to the
filesystem, because it cannot.

#### Scenario: A read route never mutates the project
- **WHEN** any project-scoped read route is called
- **THEN** the project's working tree is byte-identical before and after
- **AND** no file under the project root is created, truncated, or removed.

#### Scenario: The editor exception writes nothing itself
- **WHEN** `POST /api/projects/{id}/open` is called with a path
- **THEN** the daemon spawns `$EDITOR` against that path and returns 200 immediately
- **AND** the daemon itself performs no write; any subsequent change is the user's own editor action.

#### Scenario: The harness is spawned under a constrained working directory
- **WHEN** a conformance harness is executed at explicit user request
- **THEN** the daemon sets its working directory to a scratch directory under the daemon's own directory, outside every registered project root
- **AND** the guarantee recorded is that the daemon spawned it so constrained, not that the script confined itself.

#### Scenario: The spawn enumeration is exhaustive
- **WHEN** the daemon's route and library surface is inspected for process creation
- **THEN** every site is one of the four enumerated above
- **AND** a fifth site is a violation of this requirement rather than an undocumented detail.

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
