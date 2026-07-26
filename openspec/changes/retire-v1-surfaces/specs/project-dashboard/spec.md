## REMOVED Requirements

> **This delta builds on `add-openspec-project-reader`, which applies first.**
> That change already replaced the phase concept with open changes, added a
> capability panel, and specified the hybrid read strategy. The withdrawals below
> are of its *result*, not of the state on `main` — the projections it rebuilt
> are replaced here by the readiness surfaces, while the reading machinery it
> added survives untouched.
>
> Surviving in this capability after this change: `Schema Validation At Both
> Ends` and `Hybrid OpenSpec Read Strategy`. Both are how the daemon reads a
> project, which v2 does not alter.

### Requirement: Multi-Project Home Renders A Card Per Project

**Reason**: A card costs roughly 200 px of height; a row costs 40. At fifteen
repos that is one screen against four scrolls, and the fleet grows. More
fundamentally, the card summarised *activity* — what work is in flight — where v2
answers *readiness*. The replacement is not a smaller card.

**Migration**: Superseded by `The Fleet Surface Is One Row Per Repo` in
`repo-readiness`. Every registered repo still appears on the home route; it
appears as a row carrying six checks.

### Requirement: Card Data Comes From One Call Per Project

**Reason**: A fetch contract for the withdrawn cards. v2's fleet surface is one
call for the whole fleet rather than one per project, so the constraint no longer
describes the shape of the work.

**Migration**: Superseded by the readiness endpoint requirement in
`repo-readiness`, which specifies a single fleet response composed per repo and
per check without failing whole.

### Requirement: Filtering, Search, And Sort

**Reason**: Scoped to the card grid. Filtering and sorting survive on the fleet
surface with different semantics: family becomes a filter rather than a grouping
level, and the default sort is by count of `fail` then `never` rather than by
freshness.

**Migration**: Superseded by the filter and sort clauses of `The Fleet Surface Is
One Row Per Repo` in `repo-readiness`.

### Requirement: Single-Project Header Context

**Reason**: The header summarised open changes and carried a derived issue link.
v2's repo detail header carries repo identity, last commit, and the readiness
indicator in full — a different summary for a different question. The issue link
goes with the issue-tracker withdrawal.

**Migration**: Superseded by the header clause of `Repo Detail Shows Evidence And
A Way Forward` in `repo-readiness`.

### Requirement: Discipline State Column

**Reason**: The commitment block, hook firings, and observations describe how the
agent worked in a session. That is process telemetry, and v2 reports product
readiness. It has no surface and no readiness check depends on it.

**Migration**: No successor. The underlying artifacts remain on disk in each
project and are readable through the existing project read route.

### Requirement: Change Progress Column

**Reason**: Added by `add-openspec-project-reader` and withdrawn here after one
step. That is deliberate rather than wasteful: the reader change is what makes
open changes and task ratios readable at all, and the `spec` readiness check
consumes exactly that data. What is withdrawn is the three-column projection of
it, not the reading.

**Migration**: Superseded by `The Spec Check Consumes The Existing OpenSpec
Reader` in `repo-readiness`. Open-change counts and task ratios appear in the
`spec` check's cell and its detail block.

### Requirement: Capability Panel

**Reason**: The panel is not lost — it changes address. In v2 it becomes the
evidence display of the `spec` check on the repo detail surface. Recorded
explicitly so its disappearance from this capability is not later read as an
oversight.

**Migration**: Superseded by the `spec` check's block in `Repo Detail Shows
Evidence And A Way Forward`. A project's declared capabilities and their
requirement counts remain visible.

### Requirement: Panels Degrade To Empty States

**Reason**: A contract about panels, in a view that no longer has panels. The
principle is not lost: v2 requires that every check states its status honestly
and that every never-run check carries an instruction for making it run, which is
strictly more than an empty state offered.

**Migration**: Superseded by the absent-data and remedy-text requirements in
`repo-readiness`.

## MODIFIED Requirements

### Requirement: Register A Project From The Home Page

The home surface SHALL offer registration of a new project, validating the path
and reporting a failure without leaving the surface. Where no project is
registered, the surface SHALL present registration as the primary action rather
than rendering an empty list.

#### Scenario: A project is registered without leaving the fleet surface
- **WHEN** a valid project path is submitted from the home surface
- **THEN** the project is registered and appears in the fleet list
- **AND** the surface is not navigated away from.

#### Scenario: An invalid path is reported in place
- **WHEN** a path that cannot be registered is submitted
- **THEN** the reason is reported on the surface
- **AND** no partial registration is recorded.

#### Scenario: An empty registry leads to registration
- **WHEN** the home surface renders with no registered projects
- **THEN** registration is presented as the primary action
- **AND** no empty table is rendered.

### Requirement: Keyboard Shortcuts

The application SHALL provide keyboard navigation between its content surfaces
and to settings and help, and SHALL provide a discoverable list of the available
shortcuts. Shortcuts MUST NOT reference surfaces that do not exist.

#### Scenario: Content surfaces are reachable from the keyboard
- **WHEN** a navigation shortcut is pressed
- **THEN** the corresponding surface opens
- **AND** every shortcut maps to a surface that exists.

#### Scenario: The shortcut list is discoverable
- **WHEN** the shortcut help is invoked
- **THEN** the available shortcuts are listed with their actions.
