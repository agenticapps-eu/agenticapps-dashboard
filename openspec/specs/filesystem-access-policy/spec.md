# filesystem-access-policy Specification

## Purpose

This capability is the dashboard's security spine. The daemon runs on a
developer's machine with that developer's full filesystem privileges, and it
serves a browser SPA over HTTP. Everything that keeps that arrangement safe lives
here: the daemon is **read-only on every registered project's filesystem**, every
path it will resolve is **allow-listed**, and every file it writes lives under
`~/.agenticapps/dashboard/` at restrictive modes.

These constraints are not implementation preferences. They are the reason the
product is acceptable to run at all, and they survive every refactor. Source:
`docs/spec/dashboard-prompt.md` §"Constraints I want preserved no matter what"
and §"Anti-features"; invariants INV-01 and INV-02 held across every phase.

## Requirements

### Requirement: Read-Only On Project Filesystems

No daemon route SHALL write to, create, delete, or modify any file under a
registered project's root. The sole exception is `POST /api/projects/{id}/open`,
which spawns `$EDITOR` as an explicitly user-driven action per click and itself
writes nothing.

#### Scenario: A read route never mutates the project
- **WHEN** any project-scoped route (`/overview`, `/read`, `/git`, `/agentlinter`, `/skills/local`, `/observations/recent`, `/integrations`) is called
- **THEN** the project's working tree is byte-identical before and after
- **AND** no file under the project root is created, truncated, or removed.

#### Scenario: The editor exception writes nothing itself
- **WHEN** `POST /api/projects/{id}/open` is called with a path
- **THEN** the daemon spawns `$EDITOR` against that path and returns 200 immediately
- **AND** the daemon itself performs no write; any subsequent change is the user's own editor action.

### Requirement: Per-Project Path Allow-List

`GET /api/projects/{id}/read` SHALL resolve the requested path against the
project root and MUST reject it unless the resolved real path lies under
`<root>/.planning` or `<root>/.claude`. Paths containing `..`, absolute paths,
and paths whose realpath escapes the allow-list MUST be rejected.

#### Scenario: Traversal outside the allow-list is rejected
- **WHEN** a read is requested for `../../.ssh/id_rsa`, for an absolute path, or for a symlink whose realpath resolves outside `<root>/.planning` and `<root>/.claude`
- **THEN** the daemon rejects the request rather than returning file content
- **AND** no file outside the allow-list is opened.

#### Scenario: An allow-listed read succeeds
- **WHEN** a read is requested for a path under `<root>/.planning/` or `<root>/.claude/`
- **THEN** the daemon returns `{ content, mtime, sha256 }` for that file.

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The SPA MUST NOT name any external
filesystem path; it names a repo or family, and the daemon resolves it.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** the coverage or conformance scanners read `~/.gitnexus` or `~/Sourcecode/{agenticapps,factiv,neuroflash}`
- **THEN** those reads go through dedicated scanner code paths with their own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/` and `.claude/` and cannot reach them.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet coverage or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.

### Requirement: Git Command Allow-List

`GET /api/projects/{id}/git` SHALL accept only an allow-listed command from
`{log, status, diff-stat, branch}` with allow-listed arguments, returning
`{ stdout, stderr, exitCode }`. Arbitrary git subcommands and shell metacharacters
MUST NOT be forwarded to a subprocess.

#### Scenario: A non-allow-listed git command is refused
- **WHEN** a git request names a command outside `{log, status, diff-stat, branch}`
- **THEN** the daemon refuses the request
- **AND** no subprocess is spawned.

### Requirement: Daemon Writes Confined To Its Own Directory

All daemon writes SHALL be confined to `~/.agenticapps/dashboard/`. `registry.json`,
`auth.json`, and `env.json` MUST be mode `0600`, and the daemon MUST refuse to
start when any is looser. The `coverage-history/` tree MUST be directory mode
`0700` with NDJSON files at mode `0600`, with the mode re-applied after creation
so a permissive umask cannot widen it.

#### Scenario: Loose permissions refuse startup
- **WHEN** the daemon starts and `auth.json` is mode `0644`
- **THEN** it refuses to start
- **AND** it prints an actionable error naming the file and the `chmod 600` remedy.

#### Scenario: Snapshot files stay private under a permissive umask
- **WHEN** a daily coverage snapshot is appended under a umask that would widen the mode
- **THEN** the file is written at mode `0600` and the directory tree remains `0700`
- **AND** the mode is explicitly re-applied rather than assumed from creation.

#### Scenario: Symlink escape from the snapshot directory is refused
- **WHEN** the snapshot directory path resolves through a symlink pointing outside `~/.agenticapps/dashboard/`
- **THEN** the daemon detects this via a realpath check performed once at boot
- **AND** refuses to write snapshots there.

### Requirement: Registry Mutation Is The Only Write Surface

The registry routes SHALL be the only routes that mutate state, and they MUST
mutate only the registry file — never a project's files. Registry writes MUST be
atomic, using an exclusive, no-follow open followed by fsync and rename, so a
crash or a hostile symlink cannot corrupt or redirect the registry.

#### Scenario: Registration mutates only the registry
- **WHEN** `POST /api/registry/register` or `/unregister` succeeds
- **THEN** only `~/.agenticapps/dashboard/registry.json` changes
- **AND** the registered project's own files are untouched.

#### Scenario: A registry write is atomic
- **WHEN** the registry is rewritten
- **THEN** the write goes to a temporary file opened with no-follow and exclusive-create semantics, is fsynced, and is renamed into place
- **AND** a partially written registry is never observable.

### Requirement: Registration Target Blocklist

Paths accepted for registration or path repair SHALL be canonicalised
(absolute + realpath) and refused when they resolve to a system root or a
known secret-bearing directory, and — for path repair — when they fall outside
the configured family roots. Error responses MUST use structured codes and MUST
NOT leak resolved filesystem paths.

#### Scenario: A blocked path is refused with a structured code
- **WHEN** a path-repair request names a path that is unresolvable, blocked, or outside the family roots
- **THEN** the daemon responds 422 with a structured code such as `newPath_unresolvable`, `newPath_blocked`, or `newPath_outside_family_roots`
- **AND** the response body does not contain the resolved filesystem path.
