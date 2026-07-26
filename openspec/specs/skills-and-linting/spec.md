# skills-and-linting Specification

## Purpose

Agent skills are the unit of capability across the fleet, and they drift: a repo
runs an old version, a skill is installed globally but missing locally, a
`CLAUDE.md` grows past the point where instructions reliably land.

This capability covers what the dashboard knows about skills — the inventory of
installed skills both globally and per project, the AgentLinter integration that
scores instruction-file health (Position Risk being the highest-leverage signal),
and the cross-repo drift matrix that shows which projects have which skills at
which versions.

AgentLinter runs as a subprocess against files the daemon may read, and its
results are cached aggressively because the scan is not cheap.

## Requirements

### Requirement: Global And Project-Local Skill Inventory

The daemon SHALL expose the global skill inventory read from `~/.claude/skills/`
and, per project, the project-local inventory from that project's
`.claude/skills/`. Each entry SHALL carry the skill's frontmatter and its
modification time.

#### Scenario: Global skills are not project-scoped
- **WHEN** the global skill inventory is requested
- **THEN** it is served from a daemon-level route reading `~/.claude/skills/`
- **AND** it is not reached through any project-scoped read route.

#### Scenario: Frontmatter and mtime are reported per skill
- **WHEN** either inventory is read
- **THEN** each skill reports its parsed frontmatter and its file modification time
- **AND** a skill whose frontmatter cannot be parsed does not fail the whole listing.

### Requirement: AgentLinter Integration

The daemon SHALL run AgentLinter as a subprocess against a project's instruction
files and return its parsed results, surfacing scores and Position Risk warnings.
Results MUST be cached for about an hour, keyed on the freshness of the scanned
inputs so an edit invalidates the cache.

#### Scenario: A cached scan is reused until inputs change
- **WHEN** AgentLinter results are requested twice within the cache window with no intervening file change
- **THEN** the second request is served from cache without re-running the subprocess
- **AND** modifying a scanned instruction file causes the next request to re-run it.

#### Scenario: The linter binary is invoked consistently
- **WHEN** AgentLinter is run for a project
- **THEN** it is invoked with the same binary resolution and timeout discipline used everywhere in the product
- **AND** a failure or timeout degrades to an empty state rather than crashing the route.

### Requirement: Cross-Repo Skill Drift Matrix

The daemon SHALL aggregate skill inventories across every registered project into
a matrix of skills against projects, each cell reporting presence and version.
Each project SHALL be assigned a family derived from its root path, with an
`other` fallback for roots outside the known families.

#### Scenario: Family is derived from the path, not stored metadata
- **WHEN** the drift aggregator assigns a family to a project
- **THEN** it matches the project root against the known family root prefixes
- **AND** a root outside all of them is assigned the `other` family.

#### Scenario: One project's failure degrades only its column
- **WHEN** one project's skill scan fails during aggregation
- **THEN** that project's column is marked degraded with its error
- **AND** the request still succeeds and reports every other project.

### Requirement: Skill Drift Surface

The SPA SHALL render the drift matrix with skills as rows and projects as
columns, offering a family-scoped and cross-family filter whose state is
reflected in the URL. It SHALL offer a per-row action to run AgentLinter for a
single project.

#### Scenario: The linter action is single-project by construction
- **WHEN** a user triggers the AgentLinter action from a matrix row
- **THEN** the request carries exactly one project identifier
- **AND** the route rejects array or comma-list forms structurally rather than by validation convention.

#### Scenario: An unknown project fails closed
- **WHEN** the AgentLinter action names a project not in the registry
- **THEN** the daemon responds 404
- **AND** no subprocess is spawned.

### Requirement: Filter State Is Deep-Linkable

Filter and scope state on skill and coverage surfaces SHALL be reflected in URL
query parameters so a filtered view can be shared or restored.

#### Scenario: A filtered view survives a reload
- **WHEN** a user applies a scope filter and reloads the page
- **THEN** the same filter is still applied
- **AND** the URL alone is sufficient to reproduce the view.
