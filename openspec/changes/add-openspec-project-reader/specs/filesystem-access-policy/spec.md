## MODIFIED Requirements

### Requirement: Per-Project Path Allow-List

`GET /api/projects/{id}/read` SHALL resolve the requested path against the
project root and MUST reject it unless the resolved real path lies under
`<root>/.planning`, `<root>/.claude`, or `<root>/openspec`. Paths containing `..`, absolute paths,
and paths whose realpath escapes the allow-list MUST be rejected.

#### Scenario: Traversal outside the allow-list is rejected
- **WHEN** a read is requested for `../../.ssh/id_rsa`, for an absolute path, or for a symlink whose realpath resolves outside `<root>/.planning`, `<root>/.claude`, and `<root>/openspec`
- **THEN** the daemon rejects the request rather than returning file content
- **AND** no file outside the allow-list is opened.

#### Scenario: An allow-listed read succeeds
- **WHEN** a read is requested for a path under `<root>/.planning/`, `<root>/.claude/`, or `<root>/openspec/`
- **THEN** the daemon returns `{ content, mtime, sha256 }` for that file.

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The SPA MUST NOT name any external
filesystem path; it names a repo or family, and the daemon resolves it.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** the coverage or conformance scanners read `~/.gitnexus` or `~/Sourcecode/{agenticapps,factiv,neuroflash}`
- **THEN** those reads go through dedicated scanner code paths with their own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/`, `.claude/`, and `openspec/` and cannot reach them.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet coverage or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.
