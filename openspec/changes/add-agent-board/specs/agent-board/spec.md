## ADDED Requirements

### Requirement: One Normalised Shape Across Three Hosts

The board endpoint SHALL return sessions and tasks from every available agent
host in a single normalised shape, with the host recorded on each record. Task
status SHALL be drawn from one fixed set of values shared by all hosts. The
session and task record shapes SHALL be taken unchanged from the upstream data
model, and the response SHALL be validated against them before it is sent.

The response SHALL carry a per-host status envelope alongside the records,
reporting for each known host whether it was present, absent, or unreadable. The
envelope is a property of the response, not of the upstream data model, and does
not alter the frozen record shapes.

#### Scenario: Records from different hosts share one shape
- **WHEN** sessions and tasks are returned from more than one host
- **THEN** every record uses the same field set and the same status values
- **AND** each record names the host it came from.

#### Scenario: Shape drift becomes a parse error, not silent loss
- **WHEN** a record produced by an adapter does not match the agreed shape
- **THEN** validation fails at the wire boundary
- **AND** the mismatch surfaces as an error rather than as a silently dropped field.

#### Scenario: The envelope reports every known host
- **WHEN** the response is produced
- **THEN** every known host appears in the envelope with one of present, absent, or unreadable
- **AND** a host with zero tasks is distinguishable from a host that is not installed.

### Requirement: Board Data Comes From The Shared Adapter Implementation

Once real host data is served, the board SHALL obtain it from the same adapter
implementation the terminal viewer consumes, imported as a declared package
dependency. The daemon MUST NOT carry its own copy of the host-parsing logic, and
MUST NOT reach into another repository by filesystem path.

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
- **AND** the board states plainly that it is not showing live sessions.

#### Scenario: No cross-repository path import
- **WHEN** the daemon resolves the adapters
- **THEN** they resolve as a declared package dependency
- **AND** no relative path into another repository's source tree is used.

### Requirement: A Missing Host Degrades Rather Than Fails

Where a host's data is not present on the machine, that host SHALL be absent from
the response and the endpoint SHALL still succeed. Where no host is present, the
endpoint SHALL return a valid empty response and the surface SHALL explain which
hosts were not found.

#### Scenario: One absent host does not remove the others
- **WHEN** one of the hosts has no data on this machine
- **THEN** the response carries the remaining hosts' sessions and tasks
- **AND** the endpoint does not error.

#### Scenario: An unreadable host degrades to unreadable, not to absent
- **WHEN** a host's data is present but cannot be read, as with a corrupt store or a permission failure
- **THEN** that host is reported as unreadable in the envelope
- **AND** the other hosts' records are still returned
- **AND** it is not reported as absent, which would suggest the host is not installed.

#### Scenario: One malformed record does not discard its host
- **WHEN** a single record from an otherwise readable host fails validation
- **THEN** the host is reported as unreadable with its readable records still returned
- **AND** one bad record does not remove that host's remaining data.

#### Scenario: No hosts present yields an explained empty state
- **WHEN** none of the hosts is present
- **THEN** the response is valid and empty
- **AND** the surface states which hosts were looked for and not found, rather than rendering a blank board.

### Requirement: The Board Inherits The Product's Access Controls And Bounds What It Exports

The board endpoint SHALL sit behind the same bearer-token authentication, CORS
origin lock, and bind-mode restrictions as every other daemon route; it
introduces no separate access path.

The board's founding use case is a second device on the tailnet, so its payload
leaves the machine on which it was read. Session and task records carry
free-text fields written by agents, and a working-directory field. The response
SHALL therefore reduce working directories to a repository-relative or symbolic
form rather than absolute filesystem paths, and free-text fields SHALL be
rendered as plain text, never as markup. Board payloads MUST NOT be logged or
persisted by the daemon.

#### Scenario: The board is not reachable without the product's auth
- **WHEN** the board endpoint is requested without a valid bearer token or from a disallowed origin
- **THEN** it is refused exactly as any other daemon route is
- **AND** no session or task data is returned.

#### Scenario: Absolute paths do not leave the machine
- **WHEN** a session carries a working directory
- **THEN** the response carries a repository-relative or symbolic reference
- **AND** no home-directory path reaches the second device.

#### Scenario: Agent free text cannot execute
- **WHEN** a task title or note contains markup or script content
- **THEN** it renders as literal text
- **AND** it is not interpreted by the browser.

#### Scenario: Board payloads are not retained
- **WHEN** the board endpoint serves a response
- **THEN** the daemon writes neither the payload nor its records to any log or cache file.

### Requirement: The Board Is Read-Only

No board surface or endpoint SHALL modify a session or task in any host. There
SHALL be no status change by direct manipulation, no task creation, and no
deletion.

#### Scenario: State cannot be changed from the board
- **WHEN** the board is used in any way
- **THEN** no host's session or task data is written, created, or removed
- **AND** the board offers no control that would do so.

### Requirement: Four Columns With A Bounded Done Column

The board SHALL present tasks in four columns corresponding to the four task
statuses, one card per task. The completed column SHALL be bounded to a recent
window by default so that it cannot crowd out the other three, and the bound
SHALL be stated on the surface together with the count it is hiding.

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

#### Scenario: A completed task with no completion time is not silently dropped
- **WHEN** a task has completed status but carries no completion timestamp
- **THEN** it is shown in the completed column rather than excluded by the window
- **AND** it is not treated as having completed at an unknown-and-therefore-old time.

### Requirement: Host Identity Uses The Shared Colour System

Each card SHALL carry its host's identity using the same colour definitions the
terminal viewer uses, imported from the shared package rather than redefined.

#### Scenario: The same host reads the same in both frontends
- **WHEN** a host's tasks render on the board and in the terminal viewer
- **THEN** the host is identified by the same colour in both
- **AND** the definition comes from one shared source.

### Requirement: Blocked Cards Name Their Blockers As Text

A blocked task SHALL show the titles of the tasks blocking it as text. The board
MUST NOT render drawn dependency edges between cards.

#### Scenario: A blocked card says what it waits for
- **WHEN** a task is blocked by other tasks
- **THEN** its card lists those tasks' titles
- **AND** no connecting line or arrow is drawn between cards.

### Requirement: Grouping And Filtering

The board SHALL offer grouping by session or a flat arrangement by status, and
SHALL offer filtering by host and to active sessions only. Session activity SHALL
be taken from the shared data model rather than recomputed.

#### Scenario: Grouping can be switched
- **WHEN** the grouping control is changed
- **THEN** the same displayed tasks are rearranged between session grouping and a flat status arrangement
- **AND** the set of displayed tasks is identical in both arrangements.

#### Scenario: Active-session filtering uses the model's own definition
- **WHEN** the active-sessions filter is applied
- **THEN** activity is read from the shared model's own activity flag
- **AND** the board does not apply its own recency rule.

### Requirement: Board Freshness Without Push

The board SHALL refresh by polling on a short interval, such that a status change
in any host becomes visible within a few seconds. Polling SHALL pause while the
surface is not visible. The product MUST NOT introduce a server-push channel for
this surface.

#### Scenario: A change appears without user action
- **WHEN** a task changes status in any host
- **THEN** the board reflects the change within a few seconds without the user reloading.

#### Scenario: A backgrounded surface stops polling
- **WHEN** the board is no longer the visible surface
- **THEN** polling pauses
- **AND** it resumes when the surface becomes visible again.

#### Scenario: No push channel is opened
- **WHEN** the board is active
- **THEN** it holds no server-sent-event or websocket connection
- **AND** all updates arrive through ordinary polled requests.
