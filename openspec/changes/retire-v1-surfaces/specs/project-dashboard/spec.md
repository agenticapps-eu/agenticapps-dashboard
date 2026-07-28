## ADDED Requirements

### Requirement: Retired Locations Have An Explicit Transition

Known SPA transitions SHALL come from one explicit migration manifest.
`/coverage`, `/observability/skill-drift`, `/observability/conformance`, and
`/code-intelligence` SHALL redirect to the fleet surface. `/projects/:id` SHALL
redirect to `/repos/:id`, preserving the registered-project identifier. Unknown
SPA locations MUST return the ordinary not-found state. Daemon API routes
enumerated as removed in that same manifest MUST also return not-found. A removed
API MUST NOT retain a compatibility stub or synthetic payload.

#### Scenario: A bookmarked v1 page reaches the fleet
- **WHEN** a user navigates to a known retired SPA location after the cutover
- **THEN** the application redirects to the fleet surface
- **AND** it does not render a blank shell or a withdrawn page.

#### Scenario: A removed API is absent
- **WHEN** a client requests a daemon API withdrawn by this change
- **THEN** the daemon returns not-found
- **AND** no compatibility response exposes the removed schema.

#### Scenario: An unknown location is not disguised as a migration
- **WHEN** a user navigates to an unrecognised SPA location
- **THEN** the application returns its ordinary not-found state
- **AND** only explicitly known retired locations receive the fleet redirect.

### Requirement: Optional Integrations Never Become Load-Bearing

Where the dashboard offers a third-party integration, every unrelated surface
SHALL render fully without that integration configured. v2 currently offers no
integrations, so this is a standing constraint on future additions rather than a
current panel requirement. This deliberately sharpens the withdrawn
`optional-integrations` wording ("every non-integration route shall function")
into an observable render guarantee without weakening its no-dependency intent.
No integration MAY be a hard dependency of any unrelated route or surface.

#### Scenario: No integration configured is fully supported
- **WHEN** the dashboard runs with no integration configured
- **THEN** every current surface renders its own data completely
- **AND** no unrelated surface reports an integration prerequisite.

#### Scenario: A future integration stays isolated
- **WHEN** a future integration is added and left unconfigured
- **THEN** only that integration's own surface may report its absence
- **AND** no other surface's data or action is withheld.

## REMOVED Requirements

> **This delta builds on `add-openspec-project-reader`, which applies first.**
> That change already replaced the phase concept with open changes, added a
> capability panel, and specified the hybrid read strategy. The withdrawals below
> are of its *result*, not of the state on `main` — the projections it rebuilt
> are replaced here by the readiness surfaces, while the reading machinery is
> narrowed to the fields v2 consumes.
>
> Surviving from the current capability after this change: `Schema Validation At
> Both Ends`, `Hybrid OpenSpec Read Strategy`, `Register A Project From The Home
> Page`, and `Keyboard Shortcuts`. The transition and no-integration requirements
> above are added, for six requirements in the resulting capability.
>
> The categories are disjoint: the eight titled requirements below are the only
> removals. `Register A Project From The Home Page` and `Keyboard Shortcuts`
> appear only under MODIFIED. `Hybrid OpenSpec Read Strategy` also appears under
> MODIFIED. `Schema Validation At Both Ends` is unchanged, so OpenSpec delta
> syntax omits its full text even though it survives.

### Requirement: Multi-Project Home Renders A Card Per Project

**Reason**: A card costs roughly 200 px of height; a row costs 40. At fifteen
repos that is one screen against four scrolls, and the fleet grows. More
fundamentally, the card summarised *activity* — what work is in flight — where v2
answers *readiness*. The replacement is not a smaller card.

**Migration**: Superseded by `The Fleet Surface Is One Row Per Repo` in
`repo-readiness`. Every registered repo still appears on the home route; it
appears as a row carrying six checks. A project with no workflow artifact reports
`never` in the `workflow` check and receives that check's remedy rather than the
old card-specific `no-workflow` hint.

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
The former `needs-migration` informational view becomes the `spec` check's
`never` state, whose required remedy names the workflow update command and the
OpenSpec-initialisation migration.

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
consumes exactly that data. What is withdrawn is the three-column projection,
per-change affected-capability display, and completed-history display. The
underlying reader is modified below so it no longer computes values with no v2
consumer.

**Migration**: Superseded by `The Spec Check Consumes The Existing OpenSpec
Reader` in `repo-readiness`. Open-change counts and task ratios appear in the
`spec` check's cell and its detail block. Affected-capability derivation and
archived-change ordering have no successor because v2 renders neither. The
zero-padded archive-name rule governed chronological display; withdrawing it
does not rename, reorder, or delete archive directories.

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

The home surface SHALL offer a register affordance that accepts a path, suggests
a name, and creates the registry entry. A new project SHALL appear in the fleet
list and a removed project SHALL disappear without manual reload.

#### Scenario: Registering from the UI updates the fleet
- **WHEN** a user registers a project through the home surface affordance
- **THEN** the project is registered and appears in the fleet list
- **AND** its name was suggested before submission and no manual reload occurs.

#### Scenario: Removing a project updates the fleet
- **WHEN** a registered project is removed
- **THEN** it disappears from the fleet immediately
- **AND** no manual reload is required.

### Requirement: Keyboard Shortcuts

The application SHALL provide keyboard shortcuts for refresh, search focus, and
opening help. Every shortcut MUST map to an action or surface that still exists.
The unchanged `Keyboard Shortcut Reference` requirement in `help-docs` remains
the authoritative discoverable list.

#### Scenario: Primary actions remain keyboard-accessible
- **WHEN** the refresh, search-focus, or help shortcut is pressed
- **THEN** the current surface refreshes, search receives focus, or the help landing page opens respectively
- **AND** no shortcut targets a withdrawn surface.

### Requirement: Hybrid OpenSpec Read Strategy

The daemon SHALL enumerate a project's open changes from its `openspec/` tree on
both read paths. An open change is every direct child of `openspec/changes/`
except `archive/` and names beginning with a dot; an incomplete directory
containing only a proposal or only a task artifact still counts. A change the
CLI reports but the tree does not is ignored.

For the tree-enumerated changes, the daemon SHALL use the `openspec` CLI's
machine-readable values when that binary is available and SHALL fall back to
values read directly from the tree when it is not. The CLI augments the
tree-authoritative set; it MUST NOT narrow it. The binary is bounded by the
invocation discipline in `filesystem-access-policy`.

Task-artifact presence is always read from the tree on **both** paths because
the CLI emits `completedTasks` and `totalTasks` as zero both for a change with no
task artifact and for one with an empty artifact. Presence cannot be recovered
from CLI output and is not a fallback value.

The reader SHALL NOT enumerate archived changes or derive each open change's
affected capabilities: no v2 surface consumes either value. It SHALL continue
to expose open-change names, completed and total task counts, task-artifact
presence, capability names, and requirement counts.

**The parity claim is pinned to a field set and a scope**, because an unqualified
"both paths produce the same values" is not testable and, taken literally, is
false. The two paths MUST agree on exactly:

| Field | Per |
|---|---|
| open change names | project |
| completed task count | open change |
| total task count | open change |
| capability names | project |
| requirement count | capability |

Task-artifact presence is deliberately **not** in this table: it has one source
on both paths, so agreement is structural rather than an invariant to test.
It means specifically that a supported top-level `tasks.md` exists. For a
non-conformant task path the CLI may report counts while presence remains false;
consumers SHALL describe that as a non-conformant or unsupported task location,
not as "no work exists".

Parity is claimed over a **conformant project**, and conformance has two parts
because the two paths disagree in two different places:

- A **conformant change directory** is one whose task list is a top-level
  `tasks.md`. OpenSpec permits task artifacts the tree reader does not locate;
  for a non-conformant change the two paths MAY differ. The former
  `specs/<capability>/spec.md` condition is no longer part of change conformance
  because affected-capability derivation has been withdrawn.
- A **conformant capability spec** is one whose requirements are nested under a
  `## Requirements` section heading. The CLI counts only requirements under that
  heading; the tree reader counts `### Requirement:` headings wherever they sit.
  A spec file that omits the section heading therefore reports a different
  `requirementCount` on the two paths — measured against `openspec` 1.6.0 on
  2026-07-26: the CLI reports 0 where the tree reports 2. `openspec validate`
  rejects such a file, so this is a malformed-input case rather than a supported
  one, but the parity MUST above cannot hold for it and does not claim to.

Where the two paths differ within these bounds, the daemon SHALL prefer the
CLI's value for every field the CLI reports. Open-change set membership remains
tree-authoritative, so CLI values augment only changes the tree has enumerated;
task-artifact presence remains tree-sourced on both paths. Stating the scope is
what makes the MUST enforceable — an invariant that cannot fail is not an
invariant, and one whose stated scope does not match where it actually holds is
worse, because it reads as tested when it is not.

#### Scenario: The CLI path and the tree path agree on the pinned field set
- **WHEN** the same conformant project is read once with the CLI available and once without
- **THEN** every field in the pinned set above is identical between the two reads
- **AND** the test asserts the whole set rather than a sampled subset.

#### Scenario: A non-conformant change prefers the CLI
- **WHEN** a change stores its task list somewhere the tree reader does not locate and the CLI path is available
- **THEN** the tree-enumerated change remains listed and the CLI's task counts are reported
- **AND** false top-level task-artifact presence is reported as a non-conformant location rather than as no work.

#### Scenario: A half-written change is never hidden
- **WHEN** a non-dot directory directly under `openspec/changes/` contains only a proposal or only a task artifact
- **THEN** it is listed as an open change whether or not the CLI reports it
- **AND** task-artifact presence states whether a top-level `tasks.md` exists.

#### Scenario: A missing CLI degrades rather than fails
- **WHEN** the `openspec` binary is not installed on the daemon host
- **THEN** the project is read from its tree
- **AND** no route errors and no readiness check reports the project as unreadable.

#### Scenario: Withdrawn reader fields are not retained as dead output
- **WHEN** the hybrid reader returns OpenSpec data after the v2 cutover
- **THEN** it carries no archived-change list or per-change affected-capability list
- **AND** the spec check and repo detail still receive every field they display.
