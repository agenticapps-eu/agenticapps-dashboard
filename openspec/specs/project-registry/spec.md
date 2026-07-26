# project-registry Specification

## Purpose

The registry is the dashboard's single source of truth for *which projects
exist*. One local daemon serves many registered projects, and one pairing covers
all of them — so the registry, not a per-project install, is what makes the
dashboard multi-project.

It lives at `~/.agenticapps/dashboard/registry.json` (mode `0600`) and is the
only mutable state the daemon owns besides auth and env. This capability covers
its shape, its CRUD surface across both the CLI and the SPA, how project
identity is derived, and how the daemon copes when a registered path stops being
true — the project moved, the symlink retargeted, or the directory vanished.

## Requirements

### Requirement: Registry Record Shape

The registry SHALL be a versioned JSON document holding a `projects` array, where
each entry carries `id`, `name`, `root`, `client`, `addedAt`, and `tags`. The
registry file MUST be mode `0600`.

#### Scenario: A registered project round-trips
- **WHEN** a project is registered and the registry is re-read
- **THEN** the entry carries its `id`, `name`, absolute `root`, `client` (nullable), ISO-8601 `addedAt`, and `tags` array
- **AND** the file remains mode `0600`.

### Requirement: Project Identity And Collision Handling

Project `id` SHALL be derived by slugifying the project directory name.
Collisions MUST be resolved by appending a numeric suffix (`-2`, `-3`, …) so
every `id` is unique within the registry.

#### Scenario: A colliding slug gets a suffix
- **WHEN** a project is registered whose directory name slugifies to an `id` already present
- **THEN** the new entry receives the next free numeric suffix
- **AND** the pre-existing entry's `id` is unchanged.

### Requirement: Registry CRUD Surface

The daemon SHALL expose registry management over both the CLI and HTTP:
`register` (single path or `--auto` scan of a parent directory), `unregister`,
`list`, `rename`, and `tag`. `POST /api/registry/register` MUST return the created
entry with 201, or 409 when the path is already registered.
`POST /api/registry/unregister` MUST return 204. `GET /api/registry` MUST return
every entry with its computed status.

#### Scenario: Registering a duplicate path conflicts
- **WHEN** `POST /api/registry/register` is called with a path already in the registry
- **THEN** the daemon responds 409
- **AND** the registry is unchanged.

#### Scenario: Auto-discovery requires confirmation per match
- **WHEN** `register --auto <parent-dir>` scans for the workflow marker (a `.claude/skills/agentic-apps-workflow/SKILL.md`, or a `.planning/config.json` referencing the workflow)
- **THEN** each match is presented to the user for explicit confirmation
- **AND** only confirmed matches are registered.

#### Scenario: SPA-driven registration is allowed
- **WHEN** a user registers or removes a project from `/settings/projects`
- **THEN** the change is applied to the registry and is immediately reflected on the home page
- **AND** no project file is written (registry-only mutation, per `filesystem-access-policy`).

### Requirement: Per-Project Computed Status

`GET /api/registry` SHALL compute per-project status at request time, cached
briefly, reporting reachability, whether `.planning/` exists, whether the
workflow skill is installed, the current phase and its status, and the last
commit timestamp on the current branch.

#### Scenario: Status reflects a project with no workflow installed
- **WHEN** a registered project has no `.planning/` directory
- **THEN** its status reports that absence rather than erroring
- **AND** the home card renders an install hint instead of phase data.

### Requirement: Unreachable Projects Degrade Gracefully

When a registered project's `root` no longer exists, the daemon SHALL mark that
entry `unreachable` and MUST NOT crash or fail the whole request. One project's
failure MUST NOT take down the listing for the others.

#### Scenario: A missing root does not break the listing
- **WHEN** one registered project's root has been deleted and others are healthy
- **THEN** the response lists the missing one as `unreachable`
- **AND** every healthy project still reports full status.

### Requirement: Registry Path Drift Detection

The daemon SHALL detect registry entries whose stored path no longer matches
reality and report each with a reason: `missing` when the root does not exist,
`symlink-target-changed` when the realpath differs from the canonical root, and
`git-remote-changed` when the git origin is readable but the stored path is not
under a known family root. Detection MUST be failure-isolated per entry and MUST
NOT throw.

#### Scenario: Drift is reported per entry with a reason
- **WHEN** the drift detector runs across the registry
- **THEN** each drifted entry is returned with its stored path and a drift reason
- **AND** an entry that throws during inspection is skipped without failing the scan.

#### Scenario: A suggested path is best-effort
- **WHEN** the detector can read a drifted project's git origin URL
- **THEN** it searches the family roots one level deep for a matching directory and offers the first match as a suggested path
- **AND** returns no suggestion rather than guessing when nothing matches.

### Requirement: Registry Path Repair

The daemon SHALL expose `POST /api/admin/registry/fix-path` accepting `{ id, newPath }`
under strict schema validation. It MUST apply, in order: bearer auth, rate
limiting, schema parse, path canonicalisation, the registration blocklist, family-root
containment, and registry lookup — then mutate atomically and invalidate the
coverage and conformance caches.

#### Scenario: A valid repair updates the entry and invalidates caches
- **WHEN** a path repair passes every check
- **THEN** the registry entry's root is updated atomically
- **AND** the coverage and conformance caches are invalidated so the next read reflects the new path.

#### Scenario: An unknown project id is refused
- **WHEN** a path repair names an `id` not present in the registry
- **THEN** the daemon responds 404 `project_not_found`
- **AND** the registry is unchanged.
