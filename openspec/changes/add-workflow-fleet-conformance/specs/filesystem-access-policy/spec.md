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

### Requirement: Daemon Writes Confined To Its Own Directory

All daemon writes SHALL be confined to `~/.agenticapps/dashboard/`.
`registry.json`, `auth.json`, and `env.json` MUST be mode `0600`, and the daemon
MUST refuse to start when any is looser. The `coverage-history/` and
`workflow-harness/` trees MUST be directory mode `0700`; persisted result files
MUST be mode `0600`, with modes re-applied after creation. Each harness run SHALL
use a fresh `workflow-harness/tmp/` child at mode `0700`, enforce its disk bound,
and remove it after the run.

#### Scenario: Loose permissions refuse startup
- **WHEN** the daemon starts and `auth.json` is mode `0644`
- **THEN** it refuses to start
- **AND** it prints an actionable error naming the file and the `chmod 600` remedy.

#### Scenario: Daemon-owned result files stay private
- **WHEN** a coverage snapshot or workflow harness result is written under a permissive umask
- **THEN** the file is mode `0600` and its directory tree remains `0700`
- **AND** the mode is explicitly re-applied rather than assumed from creation.

#### Scenario: Scratch state is bounded and removed
- **WHEN** a harness completes, fails, times out, or exceeds a bound
- **THEN** its fresh scratch child is removed
- **AND** no arbitrary harness-created file remains beside daemon credentials.

#### Scenario: Symlink escape from a daemon-owned tree is refused
- **WHEN** a daemon-owned result or scratch path resolves through a symlink outside `~/.agenticapps/dashboard/`
- **THEN** the daemon refuses to write or execute there
- **AND** the decision is made on the canonical path.

### Requirement: Registry Mutation Is The Only Write Surface

The registry routes and `POST /api/v2/workflow/harness` SHALL be the only routes
that mutate daemon state. Registry routes MUST mutate only `registry.json`.
The harness route MUST mutate only its bounded `workflow-harness/` cache and
scratch tree. Neither may write a registered project's files. Registry writes
MUST remain atomic, using an exclusive no-follow open followed by fsync and
rename.

#### Scenario: Registration mutates only the registry
- **WHEN** `POST /api/registry/register` or `/unregister` succeeds
- **THEN** only `~/.agenticapps/dashboard/registry.json` changes
- **AND** the registered project's own files are untouched.

#### Scenario: Harness mutation stays in its declared tree
- **WHEN** a harness request runs
- **THEN** daemon-created state is confined to `workflow-harness/`
- **AND** no project file, registry file, auth file, or environment file is mutated.

#### Scenario: A registry write is atomic
- **WHEN** the registry is rewritten
- **THEN** the write goes to an exclusive no-follow temporary file, is fsynced, and is renamed into place
- **AND** a partially written registry is never observable.

### Requirement: OpenSpec CLI Invocation Discipline

The OpenSpec reader's use of the `openspec` binary is spawn site 3 of the
enumeration in `Read-Only On Project Filesystems`. It SHALL be bounded by the
discipline below, which is the analogue of `Git Command Allow-List` for this
binary. Unlike `$EDITOR` and the conformance harness, this binary is invoked
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
a registered project. Change names, capability names, file names, and every
other string read out of a project tree MUST NOT reach the argument vector.

**Bounds and fallback.** The invocation SHALL be bounded by a wall-clock timeout
and a maximum captured-output size, both named constants per the rule above, and
SHALL run in its own process group. On timeout the daemon SHALL signal the whole
group rather than the direct child alone, so descendants are terminated rather
than orphaned, and SHALL stop capturing output at the cap rather than buffering
past it while waiting for exit. The reader SHALL fall back to the tree path, and
report the project normally, on any of: **a spawn failure** (the binary resolved
at start but is missing, replaced, or no longer executable at invocation),
timeout, non-zero exit, output exceeding the cap, unparseable JSON, or JSON whose
shape the daemon does not recognise. None of these conditions may surface as a
route error.

**Shape recognition** SHALL be a required-subset check that ignores unknown
fields: output is recognised when every field the daemon consumes is present and
of the expected type, and additional fields are ignored rather than rejected. A
newer CLI adding fields stays recognised; an older CLI missing a consumed field
falls back rather than silently reporting a partial project.

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

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The named roots SHALL be the configured
source families, the machine-wide AgenticApps binary directory, and the
configured machine-global skill directory for each host that installs skills
outside repositories. `~/.gitnexus` is not a named root. This root set takes
effect in the same atomic release that removes the GitNexus dashboard scanner;
that removal is a hard deployment dependency. The SPA MUST NOT name any external filesystem
path; it names a fixed repo, host, or family identifier, and the daemon resolves
it.

Every external read path SHALL be canonicalised with symlinks resolved and
verified to remain under one of the named roots before it is opened. Error and
response fields SHALL use symbolic root and artifact identifiers, never absolute
paths.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** a fleet-level scanner reads outside a registered project root
- **THEN** the read goes through a dedicated scanner code path with its own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/`, `.claude/`, and `openspec/` and cannot reach it.

#### Scenario: The machine-wide binary directory is read-only and named
- **WHEN** the workflow scanner reads the machine-wide AgenticApps binary directory
- **THEN** that directory is one of the scanner's named allowed roots
- **AND** the scanner only reads from it, never writing or executing through this path.

#### Scenario: Per-host global skill roots are named separately
- **WHEN** a host installs executable skills in its own machine-global directory
- **THEN** that configured directory is a named read-only scanner root for that host
- **AND** another host's directory is not substituted for it.

#### Scenario: The retired GitNexus root is no longer authorised
- **WHEN** the GitNexus dashboard integration has been removed
- **THEN** `~/.gitnexus` is absent from the scanner allowed-root set
- **AND** no daemon scanner reads its registry or repository data.

#### Scenario: A path outside every named root is refused
- **WHEN** a scanner is asked to resolve a path under no named allowed root
- **THEN** the read is refused
- **AND** no file outside the named roots is opened.

#### Scenario: A symlink cannot escape a named read root
- **WHEN** a path lexically inside a named root resolves through a symlink outside every named root
- **THEN** the read is refused on the canonical path
- **AND** no outside file is opened.

#### Scenario: External paths are not exposed
- **WHEN** a fleet scanner returns a result or error about a machine-global artifact
- **THEN** the response uses host, root, and artifact identifiers
- **AND** no absolute filesystem path appears.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet data or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.
