## MODIFIED Requirements

### Requirement: Per-Project Path Allow-List

`GET /api/projects/{id}/read` SHALL resolve the requested path against the
project root and MUST reject it unless the resolved real path lies under
`<root>/.planning`, `<root>/.claude`, or `<root>/openspec`. Paths containing `..`, absolute paths,
and paths whose realpath escapes the allow-list MUST be rejected.

`<root>/.planning` remains allow-listed after the GSD phase reader is retired,
and is load-bearing rather than residual: `.planning/skill-observations/` is read
by the override-sentinel scanner and by the commitment route, and
`.planning/config.json` is still read as live lifecycle configuration. Only
`.planning/phases/` stops being read. A later change that removes this entry MUST
relocate those readers first.

`<root>/openspec` carries proposals, task lists, spec deltas, and multi-vendor
review prose, and this route makes them readable to any client holding the bearer
token. That exposure is **accepted, not overlooked**, and the equivalence it
rests on is stated rather than assumed. The content is: design rationale,
requirement text, task checklists, and adversarial reviewer commentary on the
project's own plans. `.planning` has been allow-listed since the first release
and carried the same four kinds — GSD-era phase plans, `*-REVIEW.md`,
`*-SECURITY.md`, and research notes — including multi-AI review output under
ADR-0018. The categories match one for one, which is the ground for treating this
as no new class rather than an assertion of it. What both trees can carry is
whatever a project's own planning documents carry; the route's bounds —
authenticated, project-scoped, read-only, realpath-checked, and size-capped
below — are what contain that, and they are unchanged.

Reads through this route SHALL be bounded by a maximum file size, and a file
exceeding it MUST be refused with an explicit too-large response rather than
streamed or truncated. This closes a gap that predates `openspec/` and applies
to all three allow-listed directories equally: without it, any file a user can
place in a registered project can be turned into unbounded daemon memory and
response bytes.

#### Scenario: Traversal outside the allow-list is rejected
- **WHEN** a read is requested for `../../.ssh/id_rsa`, for an absolute path, or for a symlink whose realpath resolves outside `<root>/.planning`, `<root>/.claude`, and `<root>/openspec`
- **THEN** the daemon rejects the request rather than returning file content
- **AND** no file outside the allow-list is opened.

#### Scenario: An allow-listed read succeeds
- **WHEN** a read is requested for a path under `<root>/.planning/`, `<root>/.claude/`, or `<root>/openspec/`
- **THEN** the daemon returns `{ content, mtime, sha256 }` for that file.

#### Scenario: An oversized allow-listed file is refused
- **WHEN** a read is requested for a file under an allow-listed directory whose size exceeds the maximum
- **THEN** the daemon refuses it with an explicit too-large response
- **AND** the file's content is neither streamed nor truncated into a successful response.

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The SPA MUST NOT name any external
filesystem path; it names a repo or family, and the daemon resolves it.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** a fleet-level scanner reads outside a registered project root
- **THEN** the read goes through a dedicated scanner code path with its own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/`, `.claude/`, and `openspec/` and cannot reach it.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet coverage or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.

## ADDED Requirements

### Requirement: OpenSpec CLI Invocation Discipline

The OpenSpec reader's use of the `openspec` binary is spawn site 3 of the
enumeration in `Daemon Writes Confined To Its Own Directory`. It SHALL be bounded
by the discipline below, which is the analogue of `Git Command Allow-List` for
this binary. Unlike `$EDITOR` and the conformance harness, this binary is invoked
without a user gesture, on an ordinary read — so its bounds are the daemon's
responsibility on every request rather than a one-time user consent.

**Resolution.** The binary SHALL be resolved once at daemon start, not per
request, and the resolved value MUST be an absolute path to an existing regular
executable file. A path that resolves to a directory, to a broken symlink, or to
a file without the executable bit is a **resolution failure**, identical in
effect to the binary being absent. If resolution fails, the reader SHALL use the
tree path for the remainder of the daemon's lifetime and MUST NOT retry a `PATH`
lookup per request.

**Invocation.** The binary SHALL be invoked via argv, never through a shell, so
that no value can be interpreted as a shell metacharacter. The argument vector
SHALL be drawn from a fixed table — `list --json` and `list --specs --json` — and
no other subcommand, flag, or argument may be passed.

This table is not assumed. It was verified against `openspec` **1.6.0** on
2026-07-26: both forms exist, and their JSON carries exactly the fields the
parity set in `project-dashboard` names — `name`, `completedTasks`,
`totalTasks` per change, and `id`, `requirementCount` per spec. A daemon meeting
a CLI whose surface has moved does not fail; it falls back under the
shape-recognition rule below.

**User-controlled values.** The only request-derived value that reaches the
invocation is the working directory, which MUST be the realpath-resolved root of
a registered project. Change names, capability names, file names, and every other
string read out of a project tree MUST NOT reach the argument vector.

**Bounds and fallback.** The invocation SHALL be bounded by a wall-clock timeout
and a maximum captured-output size, and SHALL run in its own process group so a
timeout terminates descendants rather than orphaning them. The reader SHALL fall
back to the tree path, and report the project normally, on any of: **a spawn
failure** (the binary resolved at start but is missing, replaced, or no longer
executable at invocation), timeout, non-zero exit, output exceeding the cap,
unparseable JSON, or JSON whose shape the daemon does not recognise. None of
these conditions may surface as a route error.

**Shape recognition** SHALL be a required-subset check that ignores unknown
fields: output is recognised when every field the daemon consumes is present and
of the expected type, and additional fields are ignored rather than rejected. A
stricter exact-set check would degrade the CLI path to the tree on every upstream
release that adds a field, which would defeat the reason for having a CLI path at
all. This rule handles version skew in both directions — a newer CLI adding
fields stays recognised, and an older CLI missing a consumed field is
unrecognised and falls back rather than silently reporting a partial project.

#### Scenario: The subcommand table is closed
- **WHEN** the reader invokes the `openspec` binary
- **THEN** the argument vector is one of `list --json` or `list --specs --json`
- **AND** no code path constructs an `openspec` argument vector from a value read out of a project tree.

#### Scenario: No value reaches a shell
- **WHEN** a registered project's root path contains a space, a quote, or a shell metacharacter
- **THEN** the binary is invoked via argv with that path as its working directory and the read succeeds
- **AND** no shell is interposed and no part of the path is interpreted as syntax.

#### Scenario: A hung binary is bounded and falls back
- **WHEN** the `openspec` binary does not exit within the timeout
- **THEN** the daemon terminates its process group and reads the project from the tree instead
- **AND** the route returns the project's data rather than an error.

#### Scenario: Unrecognised CLI output degrades to the tree
- **WHEN** the binary exits successfully but emits JSON missing a field the daemon consumes, or output exceeding the size cap
- **THEN** the reader falls back to the tree path
- **AND** the project is reported with tree-derived values rather than partially-parsed ones.

#### Scenario: An added upstream field does not degrade the CLI path
- **WHEN** the binary emits JSON carrying every consumed field plus fields the daemon does not know
- **THEN** the output is recognised and the CLI path is used
- **AND** the unknown fields are ignored rather than treated as a shape mismatch.

#### Scenario: A binary that disappears after resolution falls back
- **WHEN** the binary resolved at daemon start is deleted, replaced, or loses its executable bit before an invocation
- **THEN** the resulting spawn failure falls back to the tree path
- **AND** the route returns the project's data rather than an error.

#### Scenario: Resolution is not retried per request
- **WHEN** the binary cannot be resolved at daemon start — because it is absent, a directory, a broken symlink, or not executable
- **THEN** every subsequent project read uses the tree path directly
- **AND** no `PATH` lookup and no process spawn is attempted on the request path.
