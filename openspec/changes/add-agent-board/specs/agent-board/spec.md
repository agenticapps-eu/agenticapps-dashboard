## ADDED Requirements

### Requirement: One Normalised Shape Across Three Hosts

The board endpoint SHALL return sessions and tasks from every available agent
host in a single normalised shape, with the host recorded on each record. Task
status SHALL be drawn from one fixed set of values shared by all hosts. The
shape SHALL be validated at the wire boundary in both directions.

#### Scenario: Records from different hosts share one shape
- **WHEN** sessions and tasks are returned from more than one host
- **THEN** every record uses the same field set and the same status values
- **AND** each record names the host it came from.

#### Scenario: Shape drift becomes a parse error, not silent loss
- **WHEN** a record does not match the agreed shape
- **THEN** validation fails at the wire boundary
- **AND** the mismatch surfaces as an error rather than as a silently dropped field.

### Requirement: Board Data Comes From The Shared Adapter Implementation

The board SHALL obtain host data from the same adapter implementation the
terminal viewer consumes, imported as a package. The daemon MUST NOT carry its
own copy of the host-parsing logic, and MUST NOT reach into another repository by
filesystem path.

#### Scenario: One implementation serves both frontends
- **WHEN** a host changes its on-disk format and the shared adapter is updated
- **THEN** both the terminal viewer and the board reflect the fix without a second edit
- **AND** neither consumer carries parsing logic of its own.

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

#### Scenario: No hosts present yields an explained empty state
- **WHEN** none of the hosts is present
- **THEN** the response is valid and empty
- **AND** the surface states which hosts were looked for and not found, rather than rendering a blank board.

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
SHALL be stated on the surface.

#### Scenario: Every task appears in the column matching its status
- **WHEN** the board renders
- **THEN** each task appears in exactly one column, determined by its status.

#### Scenario: Completed work does not overwhelm the board
- **WHEN** many tasks have completed over a long period
- **THEN** the completed column shows only those within the default window
- **AND** the surface states that the column is bounded.

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
- **THEN** the same tasks are rearranged between session grouping and a flat status arrangement
- **AND** no task disappears in either arrangement.

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
