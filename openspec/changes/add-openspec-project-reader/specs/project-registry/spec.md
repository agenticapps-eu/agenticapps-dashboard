## MODIFIED Requirements

### Requirement: Registry CRUD Surface

The daemon SHALL expose registry management over both the CLI and HTTP:
`register` (single path or `--auto` scan of a parent directory), `unregister`,
`list`, `rename`, and `tag`. `POST /api/registry/register` MUST return the created
entry with 201, or 409 when the path is already registered.
`POST /api/registry/unregister` MUST return 204. `GET /api/registry` MUST return
every entry with its computed status.

Auto-discovery SHALL recognise exactly two markers: an
`openspec/` directory, or a `.claude/skills/agentic-apps-workflow/SKILL.md`.
`.planning/config.json` is NOT a marker. It was one while the GSD reader existed;
that reader is retired in this change, so offering a match on it would present
projects the dashboard cannot read any planning state for.

Dropping the marker does not unregister anything. A project already in the
registry stays registered and keeps its entry regardless of which marker
originally matched; only the `--auto` scan stops offering new ones.

#### Scenario: Registering a duplicate path conflicts
- **WHEN** `POST /api/registry/register` is called with a path already in the registry
- **THEN** the daemon responds 409
- **AND** the registry is unchanged.

#### Scenario: Auto-discovery requires confirmation per match
- **WHEN** `register --auto <parent-dir>` scans for a marker (an `openspec/` directory, or a `.claude/skills/agentic-apps-workflow/SKILL.md`)
- **THEN** each match is presented to the user for explicit confirmation
- **AND** only confirmed matches are registered.

#### Scenario: A GSD-only project is no longer auto-discovered
- **WHEN** `register --auto <parent-dir>` scans a directory containing a project whose only marker is `.planning/config.json`
- **THEN** that project is not offered as a match
- **AND** a project already registered from that marker remains in the registry and is not removed.

#### Scenario: SPA-driven registration is allowed
- **WHEN** a user registers or removes a project from `/settings/projects`
- **THEN** the change is applied to the registry and is immediately reflected on the home page
- **AND** no project file is written (registry-only mutation, per `filesystem-access-policy`).

### Requirement: Per-Project Computed Status

`GET /api/registry` SHALL compute per-project status at request time, cached
briefly, reporting reachability, whether `openspec/` exists, whether the
workflow skill is installed, the count of open changes, the count of declared
capabilities, and the last commit timestamp on the current branch.

Status SHALL distinguish three conditions, because they call for different user
action and collapsing them produces a card that tells the user to install
something they already have:

| `openspec/` | workflow skill | Reported condition |
|---|---|---|
| present | either | `migrated` — change and capability data are reported |
| absent | present | `needs-migration` |
| absent | absent | `no-workflow` |

**Reachability takes precedence over the marker matrix.** The matrix applies only
to a project whose root is present and readable. When the root is missing,
inaccessible, or has not yet been scanned, status SHALL report `unreachable` and
MUST NOT report any of the three conditions above. Without this precedence an
unreachable project reads as both markers absent — an unmounted volume or a moved
directory would render as `no-workflow`, telling the user to install a workflow
into a path the daemon cannot see.

#### Scenario: A project with neither marker reports no workflow
- **WHEN** a registered project has no `openspec/` directory and no workflow skill installed
- **THEN** its status reports the `no-workflow` condition rather than erroring
- **AND** the home card renders an install hint instead of change data.

#### Scenario: An unreachable project is not reported as missing the workflow
- **WHEN** a registered project's root is missing or inaccessible
- **THEN** its status reports `unreachable`
- **AND** it does not report `no-workflow`, and the card offers no install or migration hint for a path the daemon cannot read.

#### Scenario: A GSD-only project reports that it needs migration
- **WHEN** a registered project has the workflow skill installed but no `openspec/` directory
- **THEN** its status reports the `needs-migration` condition
- **AND** it is not reported as having no workflow installed.

#### Scenario: OpenSpec takes precedence during a migration
- **WHEN** a registered project contains both a `.planning/` tree and an `openspec/` directory
- **THEN** its status is computed from `openspec/` alone and reports the `migrated` condition
- **AND** no value is read from `.planning/phases/`.

#### Scenario: Status carries counts, not a synthesised phase
- **WHEN** status is computed for a migrated project
- **THEN** it reports open-change and capability counts
- **AND** it does not synthesise a phase number or phase status.
