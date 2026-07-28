## ADDED Requirements

### Requirement: One Normalised Shape Across Four Hosts

The board endpoint SHALL return this strict response envelope:

- `generatedAt`: epoch milliseconds;
- `synthetic`: boolean;
- `hosts`: exactly one entry for each of `claude`, `codex`, `opencode`, and `pi`, each
  carrying `host`, `state` (`present`, `absent`, or `unreadable`), `truncated`,
  `omittedSessions`, `omittedTasks`, and `doneOutsideWindow`; an unreadable entry
  SHALL additionally carry exactly one dashboard-owned `reason` code
  (`invalid-records`, `source-unreadable`, `unsafe-path`, or `read-limit`), while
  present and absent entries SHALL omit `reason`;
- `sessions`: records with the frozen upstream shape `{ host, id, title, cwd?,
  createdAt?, updatedAt, active }`; and
- `tasks`: records with the frozen upstream shape `{ host, sessionId, id, title,
  status, blockedBy, blocks, startedAt?, completedAt?, note? }`.

`host` SHALL be exactly `claude`, `codex`, `opencode`, or `pi`; task `status` SHALL be
exactly `todo`, `in_progress`, `done`, or `blocked`; `blockedBy` and `blocks`
SHALL be arrays of bare task `id` strings resolved as
`(task.host, task.sessionId, referencedId)`; and every timestamp SHALL be epoch
milliseconds. Session identity is `(host, id)` and task identity is
`(host, sessionId, id)`. Every task SHALL reference a session with the same host
and session identifier. The three count fields SHALL be non-negative safe
integers. The response SHALL be validated before it is sent.

#### Scenario: Records from different hosts share one shape
- **WHEN** sessions and tasks are returned from more than one host
- **THEN** every record uses the same field set and the same status values
- **AND** each record names the host it came from.

#### Scenario: Adapter records degrade before outbound validation
- **WHEN** a record produced by an adapter does not match the agreed shape
- **THEN** adapter-side record validation excludes that record and marks its host unreadable
- **AND** the host's readable records are assembled into the envelope
- **AND** the appropriate `omittedSessions` or `omittedTasks` count includes the excluded record
- **AND** if the assembled envelope fails strict outbound validation, the existing outbound wrapper returns `500 schema_drift` without board records.

#### Scenario: Required session freshness cannot disappear silently
- **WHEN** an adapter record omits required `Session.updatedAt`
- **THEN** that session is excluded and increments `omittedSessions`
- **AND** its dependent tasks are excluded and increment `omittedTasks`
- **AND** the host is unreadable with `reason: invalid-records`.

#### Scenario: The envelope reports every known host
- **WHEN** the response is produced
- **THEN** `claude`, `codex`, `opencode`, and `pi` each appear exactly once in the envelope with one of present, absent, or unreadable
- **AND** a host with zero tasks is distinguishable from a host that is not installed.

#### Scenario: Composite identities do not collide across hosts
- **WHEN** two hosts use the same session or task identifier
- **THEN** the records remain distinct because identity includes the host
- **AND** every task resolves to a session with the same host and session identifier.

#### Scenario: Invalid identities degrade deterministically
- **WHEN** records within one host duplicate a composite identity, or a task does not resolve to a session in that same host
- **THEN** every record participating in the duplicate and every unresolved task is excluded
- **AND** dependent task exclusions caused by an excluded session are included in `omittedTasks`
- **AND** the host is unreadable while its other readable records remain available.

### Requirement: Board Data Comes From The External Adapter Implementation

Once real host data is served, the board SHALL obtain it from the same adapter
implementation the terminal viewer consumes, imported as a declared package
dependency. That package SHALL support Bun and Node.js 20 without native
dependencies, SHALL export the `claude`, `codex`, `opencode`, and `pi` adapters
and shared host-style definitions, and SHALL run all four adapter/style fixture
sets under both runtimes. Moving
runtime-specific I/O behind a portable seam is permitted; changing the frozen
model or adapter behaviour is not. The daemon MUST NOT carry its own copy of the
host-parsing logic, and MUST NOT reach into another repository by filesystem
path.

The dashboard's internal shared schema package SHALL own the strict runtime response
validator. Its Stage 1 record schemas MAY mirror the frozen upstream fields so
fixture responses can be validated before the external package is released.
Once that package is consumed, compile-time compatibility checks against its
exported model and the upstream adapter fixtures SHALL make model drift fail a
build or fixture test. This wire validator is not host-parsing logic.

Until the shared package exists, the endpoint MAY serve fixture data. Fixture
data SHALL be labelled as synthetic in the response, so no surface can present it
as observed agent activity. Serving fixture data unlabelled is a violation.

#### Scenario: One implementation serves both frontends
- **WHEN** a host changes its on-disk format and the shared adapter is updated to match
- **THEN** each consumer picks the fix up by moving to that version of the package
- **AND** neither consumer carries parsing logic of its own that would need a second, separate fix.

#### Scenario: Fixture data is never mistaken for real data
- **WHEN** the endpoint serves fixture data before the shared package exists
- **THEN** the response marks the data as synthetic
- **AND** fixture hosts carrying records use `state: present`
- **AND** an empty fixture host uses `state: present` unless the fixture is explicitly exercising absent-host behavior
- **AND** the board states plainly that it is not showing live sessions.

#### Scenario: Synthetic and live records are not mixed
- **WHEN** the external adapter package becomes available
- **THEN** the endpoint atomically replaces the immutable fixture snapshot as a whole
- **AND** one response never combines synthetic records with observed host records.

#### Scenario: Failed live initialisation cannot create a mixed snapshot
- **WHEN** any live adapter fails while the Stage 2 store is initialising
- **THEN** the previously complete synthetic snapshot remains active
- **AND** no response combines synthetic and observed host records.

#### Scenario: Runtime failure after cutover remains live
- **WHEN** a host source becomes unreadable after a live snapshot has been published
- **THEN** the next live snapshot marks only that host unreadable
- **AND** the endpoint does not reactivate or mix in synthetic records.

#### Scenario: Every live host can be unreadable
- **WHEN** all four host sources become unreadable after live cutover
- **THEN** the endpoint returns a live envelope with all four hosts unreadable
- **AND** the surface explains their reason codes rather than presenting an absent-host empty state
- **AND** the endpoint neither reactivates synthetic data nor fails the whole response.

#### Scenario: No cross-repository path import
- **WHEN** the daemon resolves the adapters
- **THEN** they resolve as a declared package dependency
- **AND** no relative path into another repository's source tree is used.

#### Scenario: One package works in both consumers
- **WHEN** the extracted package's fixture suite runs under Bun and Node.js 20
- **THEN** the same `claude`, `codex`, `opencode`, and `pi` fixtures produce the same normalised records and host styles
- **AND** installing the package requires no native dependency.

### Requirement: A Missing Host Degrades Rather Than Fails

Where a host's data is not present on the machine, its mandatory envelope entry
SHALL carry `state: absent`, with no records for that host, and the endpoint SHALL
still succeed. Where no host is present, the endpoint SHALL return a valid empty
record set and the surface SHALL explain which hosts were not found.

#### Scenario: One absent host does not remove the others
- **WHEN** one of the hosts has no data on this machine
- **THEN** the absent host remains in the envelope with `state: absent`
- **AND** the response carries the remaining hosts' sessions and tasks
- **AND** the endpoint does not error.

#### Scenario: An unreadable host degrades to unreadable, not to absent
- **WHEN** a host's data is present but cannot be read, as with a corrupt store or a permission failure
- **THEN** that host is reported as unreadable in the envelope
- **AND** the other hosts' records are still returned
- **AND** it is not reported as absent, which would suggest the host is not installed.

#### Scenario: One malformed record does not discard its host
- **WHEN** a single record from an otherwise readable host fails validation
- **THEN** the host is reported as unreadable with its readable records still returned
- **AND** its stable reason is `invalid-records`
- **AND** the matching omission count increases by one
- **AND** one bad record does not remove that host's remaining data.

#### Scenario: No hosts present yields an explained empty state
- **WHEN** none of the hosts is present
- **THEN** the response is valid and empty
- **AND** the surface states that `claude`, `codex`, `opencode`, and `pi` were looked for and not found, rather than rendering a blank board.

### Requirement: The Board Inherits The Product's Access Controls And Bounds What It Exports

The board endpoint SHALL sit behind the same bearer-token authentication, CORS
origin lock, and bind-mode restrictions as every other daemon route; it
introduces no separate access path.

The board's founding use case is a second device on the tailnet, so its payload
leaves the machine on which it was read. Session and task records carry
free-text fields written by agents, and a working-directory field. The response
SHALL therefore reduce working directories to a repository-relative or symbolic
form rather than absolute filesystem paths, and free-text fields SHALL be
rendered as plain text, never as markup. Titles SHALL be limited to 256 Unicode
code points and notes to 2,048 Unicode code points. Per host, at most 200
sessions and 2,000 tasks SHALL be returned. Sessions SHALL be ordered by active
first, then `updatedAt` descending, `createdAt` descending, and id ascending;
tasks for retained sessions SHALL
be ordered by status (`blocked`, `in_progress`, `todo`, `done`), then their
latest timestamp descending and id ascending. A task's latest timestamp SHALL be the maximum present
value of `completedAt` and `startedAt`; a task with neither timestamp sorts last.
Tasks whose session was
omitted SHALL also be omitted. Record or field omission SHALL set `truncated`
and record omission SHALL increment the matching omission count. Per-host
`omittedSessions` and `omittedTasks` SHALL count source records absent from the
returned arrays because of validation, referential exclusion, or record caps;
shortening a retained field does not increment either record count.
`doneOutsideWindow` SHALL count valid, referentially coherent records from the
readable source inventory before record caps are applied, so it is not a count
derived from the returned snapshot. A record excluded by validation, or a task
excluded because its session is invalid or omitted, SHALL NOT contribute. The
count SHALL be zero for an absent host or a wholly
unreadable source. A done task without `completedAt` SHALL NOT contribute. A
readable, referentially valid task outside the window SHALL contribute before
caps even if a record cap also excludes that task; `doneOutsideWindow` and
`omittedTasks` describe different dimensions and MAY therefore count the same
source task. A done task with
`completedAt` after `generatedAt` SHALL remain visible and SHALL NOT contribute
to `doneOutsideWindow`. A `reason` SHALL be one of the dashboard-owned codes in
the envelope schema and MUST NOT contain a raw adapter error, path, or
host-authored text. Board payloads MUST NOT be logged or persisted by the
daemon.

Adapters SHALL read only their fixed host data roots. Canonical-path and symlink
containment SHALL be checked before every read, files SHALL be read with explicit
bounds, and SQLite stores SHALL be opened read-only without modifying database,
WAL, or SHM files. A store that cannot be read without recovery or sidecar
mutation SHALL degrade its host to unreadable. A canonical-path or symlink
containment failure SHALL make the affected host unreadable with
`reason: unsafe-path`. A source read that exceeds its explicit byte bound SHALL
make the affected host unreadable with `reason: read-limit`; only output
record/field caps SHALL set `truncated`. A SQLite store that requires recovery
or sidecar mutation SHALL make the affected host unreadable with
`reason: source-unreadable`.

When more than one failure is observable, the host SHALL report the first
applicable reason in this precedence order: `unsafe-path`, `read-limit`,
`source-unreadable`, `invalid-records`.

Session and task caps SHALL retain the first 200 and first 2,000 records,
respectively, in the deterministic orders above. The session cap SHALL be
applied before the task cap so tasks belonging to an omitted session are
referential exclusions rather than task-cap candidates.

The live store SHALL publish one immutable, outbound-valid snapshot reference
at a time. A request SHALL read exactly one published reference.

#### Scenario: The board is not reachable without the product's auth
- **WHEN** the board endpoint is requested without a valid bearer token or from a disallowed origin
- **THEN** it is refused exactly as any other daemon route is
- **AND** no session or task data is returned.

#### Scenario: Absolute paths do not leave the machine
- **WHEN** a session carries a working directory
- **THEN** a directory under a registered root is rendered as `repo:<id>/<relative-path>` and every other directory as `external`
- **AND** no home-directory path reaches the second device.

#### Scenario: Agent free text cannot execute
- **WHEN** a task title or note contains markup or script content
- **THEN** it renders as literal text
- **AND** it is not interpreted by the browser.

#### Scenario: Board payloads are not retained
- **WHEN** the board endpoint serves a response
- **THEN** the daemon writes neither the payload nor its records to any log or cache file.

#### Scenario: Host data is bounded and read without mutation
- **WHEN** an adapter encounters more than the allowed records, an oversized file, or a symlink escaping its fixed root
- **THEN** the response remains bounded and marks the affected host truncated or unreadable as appropriate
- **AND** no host database or companion file is modified.

#### Scenario: Outbound schema drift fails closed
- **WHEN** the assembled board envelope fails strict outbound validation
- **THEN** the endpoint returns the existing `500 schema_drift` response
- **AND** no session or task record is returned.

### Requirement: The Board Is Read-Only

No board surface or endpoint SHALL modify a session or task in any host. There
SHALL be no status change by direct manipulation, no task creation, and no
deletion. The board API SHALL expose `GET /api/v2/board` only and SHALL add no
mutating sibling route.

#### Scenario: State cannot be changed from the board
- **WHEN** the board is used in any way
- **THEN** no host's session or task data is written, created, or removed
- **AND** the board offers no control that would do so.

### Requirement: Four Columns With A Bounded Done Column

The board SHALL present tasks in four columns corresponding to the four task
statuses, one card per task. The completed column SHALL show done tasks with no
`completedAt` and tasks whose `completedAt` is greater than or equal to
`generatedAt - 24 hours`; there is no upper bound, so clock-skewed future
completion times remain in the completed column. Filtering occurs on the client
over the bounded snapshot; the daemon's `doneOutsideWindow` count supplies
the pre-truncation hidden count. The bound and hidden count SHALL be stated on
the surface.

Tasks excluded by that bound are **out of scope of the board's display**, not
misplaced: every task that is displayed appears in exactly one column.

#### Scenario: Every displayed task appears in exactly one column
- **WHEN** the board renders
- **THEN** each task within the display scope appears in exactly one column, determined by its status
- **AND** no displayed task appears in two columns or in none.

#### Scenario: Completed work does not overwhelm the board
- **WHEN** many tasks have completed over a long period
- **THEN** the completed column shows only those within the default window
- **AND** the surface states that the column is bounded and how many completed tasks fall outside it.

#### Scenario: Record-cap omissions are disclosed separately
- **WHEN** a record cap excludes tasks, including done tasks inside the completed window
- **THEN** the surface states the affected host's `omittedTasks` count and truncated status separately
- **AND** the completed-window hidden count continues to mean only valid done tasks outside the window.

#### Scenario: A completed task with no completion time is not silently dropped
- **WHEN** a task has completed status but carries no completion timestamp
- **THEN** it is shown in the completed column rather than excluded by the window
- **AND** it is not treated as having completed at an unknown-and-therefore-old time.

### Requirement: Host Identity Uses The Shared Colour System

Each live-data card SHALL carry its host's identity using the textual label and
semantic colour definition imported from the shared package. The fixture-backed
stage SHALL use the same fixed host names with neutral design-system tokens and
state that shared host styling is pending. If a shared colour fails the SPA's
contrast floor, the SPA SHALL pair the shared identity with a compliant design
token; the textual label remains authoritative.

A host's state SHALL describe trust in its source. `present` means the source
was readable and all accepted records were valid; `absent` means no source
exists; and `unreadable` means either the source was wholly inaccessible or at
least one source record was rejected. The surface SHALL show the stable reason
and omission counts so partial invalid records are distinguishable from a
wholly inaccessible source.

#### Scenario: The same host reads the same in both frontends
- **WHEN** a host's tasks render on the board and in the terminal viewer
- **THEN** the host uses the shared textual label and semantic colour identity
- **AND** any web contrast adaptation is explicit and preserves a non-colour label.

#### Scenario: Partial and complete source failures remain distinguishable
- **WHEN** one unreadable host retains valid siblings and another host's source cannot be read at all
- **THEN** both hosts carry `state: unreadable`
- **AND** their stable reasons and omission counts distinguish partial invalid records from complete source failure
- **AND** the surface renders that distinction.

### Requirement: Blocked Cards Name Their Blockers As Text

A blocked task SHALL resolve blockers only within its own `(host, sessionId)`
scope and show their titles as text, even when the blocker is filtered from the
display. An absent blocker SHALL render as `Unknown task <short-id>`, where
`<short-id>` is the first eight Unicode code points of its task id. The board
MUST NOT render drawn dependency edges between cards. A missing blocker
reference is a rendering condition, not an omitted session or task, and SHALL
NOT increment an omission count.

#### Scenario: A blocked card says what it waits for
- **WHEN** a task is blocked by other tasks
- **THEN** its card lists those tasks' titles
- **AND** no connecting line or arrow is drawn between cards.

### Requirement: Grouping And Filtering

The board SHALL offer grouping by session (the default) or a flat arrangement by status, and
SHALL offer filtering by host and to active sessions only. Session activity SHALL
be taken from the shared data model rather than recomputed.

The host filter SHALL offer exactly `claude`, `codex`, `opencode`, and `pi`.

#### Scenario: Grouping can be switched
- **WHEN** the grouping control is changed
- **THEN** the same displayed tasks are rearranged between session grouping and a flat status arrangement
- **AND** the set of displayed tasks is identical in both arrangements.

#### Scenario: Session grouping preserves the status columns
- **WHEN** session grouping is active
- **THEN** sessions render as swimlanes across the same four status columns
- **AND** no fifth column or alternative status mapping is introduced.

#### Scenario: Active-session filtering uses the model's own definition
- **WHEN** the active-sessions filter is applied
- **THEN** activity is read from the shared model's own activity flag
- **AND** the board does not apply its own recency rule.

#### Scenario: The board is reachable from the shell
- **WHEN** the application shell renders
- **THEN** the board appears as a content-surface navigation entry
- **AND** it is not hidden behind a project-specific menu.

### Requirement: Board Freshness Without Push

The board SHALL poll every three seconds. The daemon SHALL cache a host snapshot
for at most one second and coalesce concurrent reads per host. Measured from the
first poll eligible to observe an upstream change through rendered completion,
the visibility target SHALL be five seconds. Polling SHALL pause while the
surface is not visible. A network failure SHALL keep the last successful
snapshot visible and mark it stale; a hidden tab SHALL retain it with a paused
label, not a stale label. The product MUST NOT introduce a server-push channel
for this surface.

#### Scenario: A change appears without user action
- **WHEN** a task changes status in any host
- **THEN** the board reflects the change within the five-second target without the user reloading.

#### Scenario: A backgrounded surface stops polling
- **WHEN** the board is no longer the visible surface
- **THEN** polling pauses
- **AND** the last successful snapshot remains visible and is marked paused
- **AND** polling resumes when the surface becomes visible again.

#### Scenario: No push channel is opened
- **WHEN** the board is active
- **THEN** it holds no server-sent-event or websocket connection
- **AND** all updates arrive through ordinary polled requests.
