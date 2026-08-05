# project-dashboard Specification

## Purpose

This capability was the product's original reason to exist — a multi-project home
of cards and a three-column single-project view. The v2 cutover withdrew both
surfaces: the question they answered was *what work is in flight*, and the
product now answers *is this repo production-ready*, on the fleet and repo detail
surfaces owned by `repo-readiness`.

What survives here is the part of the old capability that was never about those
two surfaces. It owns:

- **the transition** — the one migration manifest that says where a bookmarked v1
  location lands, and the enumerated daemon endpoints the cutover withdrew;
- **registration** — the affordance that puts a repo into the registry from the
  browser, re-homed onto the fleet surface when its old host was withdrawn;
- **the wire contract** — schema validation on both the producing and consuming
  side, and the keyboard shortcuts that reach the surfaces that still exist;
- **the OpenSpec reader** — the hybrid CLI-plus-tree read strategy that the
  `spec` readiness check consumes;
- **two standing constraints on future integrations**, relocated here so they
  outlive the `optional-integrations` capability that was withdrawn whole.

Everything here remains a *projection of files the daemon read*. Nothing writes
to a project.

## Requirements

### Requirement: Register A Project From The Home Page

The home surface SHALL offer a register affordance that accepts a path, suggests
a name, and creates the registry entry. A new project SHALL appear in the fleet
list and a removed project SHALL disappear without manual reload.

**The affordance is homed on the fleet surface**, because the surface that hosted
it before the cutover is withdrawn. The register modal and its entry point were
reachable only from the withdrawn multi-project home; nothing else in the product
imported them, and the fleet surface's empty state directed the user to the
`agentic-dashboard register <path>` CLI instead. Read alongside the instruction to
delete every component whose only consumer is a withdrawn location, that would
have deleted the UI this requirement retains and quietly converted a preserved
promise into a CLI-only operation. This requirement is a *product* guarantee: a
user SHALL still be able to register a project without leaving the browser.

The withdrawal of automatic family-root discovery depends on this. That
withdrawal rests on "an unregistered repo is added through the surviving home
registration affordance" — an argument that only holds while the affordance
survives somewhere a user can reach.

**The title still says "Home Page" and the surface is the fleet.** The name is
the baseline's, kept through the fold so the delta had a title to match on; a
MODIFIED entry that renames its target modifies nothing. Renaming it is a
one-line follow-up for a later change, now that this baseline carries the text a
later delta can target.

#### Scenario: Registering from the UI updates the fleet
- **WHEN** a user registers a project through the register affordance on the fleet surface
- **THEN** the project is registered and appears in the fleet list
- **AND** its name was suggested before submission and no manual reload occurs.

#### Scenario: Removing a project updates the fleet
- **WHEN** a registered project is removed
- **THEN** it disappears from the fleet immediately
- **AND** no manual reload is required.

#### Scenario: Registration survives the withdrawal of its old host
- **WHEN** a user opens the product after the cutover with no repository registered
- **THEN** the fleet surface offers the register affordance directly
- **AND** the user is not required to fall back to the CLI to add their first repository.

### Requirement: Schema Validation At Both Ends

Every daemon response SHALL be validated against the shared schema on both the
producing and consuming side. A mismatch MUST surface in the SPA as an explicit
schema-drift state rather than a silent misrender.

#### Scenario: A wire mismatch surfaces as schema drift
- **WHEN** a daemon response does not match the shared schema the SPA expects
- **THEN** the SPA renders a schema-drift state naming where the mismatch occurred
- **AND** does not render the malformed payload as though it were valid.

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
both read paths. An open change is every direct child **directory** of
`openspec/changes/` except `archive/` and names beginning with a dot; an
incomplete directory containing only a proposal or only a task artifact still
counts. A loose file sitting in `openspec/changes/` is not a change and SHALL NOT
be enumerated as one. A change the CLI reports but the tree does not is ignored.

**Where the two readers disagree, the surface SHALL say so rather than pick a
winner quietly.** The CLI and the tree can diverge, and because the CLI is used
only when the binary is present, the same repository can render differently on
two machines with no indication that anything is environment-dependent. A reader
comparing two dashboards would take the difference for a difference in the repos.
When a divergence is detected the surface SHALL mark the affected project as read
in a degraded or compatibility mode and SHALL identify what the readers disagreed
about — the change, where the divergence is per-change, and otherwise the field,
such as a capability or requirement count that belongs to no single change. It
SHALL NOT present the merged values as though both readers agreed.

**The diagnostic is required to be possible, which is why it names a field and
not always a change.** Requiring the surface to name "the change the readers
disagreed about" cannot be satisfied for a divergence in capability or
requirement counts: those are properties of the project, not of any change. A
mandatory diagnostic that some real divergence cannot produce is a requirement
that forces either a false attribution or a silent failure to report.

**The cause SHALL NOT be reported as a malformed spec unless the spec is
malformed.** Divergence also arises from configurations OpenSpec permits — a
change whose schema places its task artifact somewhere other than the default
path is legal and still reads as absent to the tree reader — and blaming a
supported configuration on a malformed spec sends the reader to fix a file that
is correct.

For the tree-enumerated changes, the daemon SHALL use the `openspec` CLI's
machine-readable values when that binary is available **and its invocation
succeeds**, and SHALL fall back to values read directly from the tree when the
binary is absent, exits non-zero, or emits output that does not parse. Absence is
not the only fallback trigger: the daemon treats a non-zero exit and unparseable
output as a failed invocation and degrades to the tree. A CLI that is present but
broken MUST NOT be able to empty a surface that the tree can populate. The CLI
augments the tree-authoritative set; it MUST NOT narrow it. The binary is bounded
by the invocation discipline in `filesystem-access-policy`.

Task-artifact presence is always read from the tree on **both** paths because
the CLI emits `completedTasks` and `totalTasks` as zero both for a change with no
task artifact and for one with an empty artifact. Presence cannot be recovered
from CLI output and is not a fallback value. Reading it from the tree does
separate the two: an empty artifact is a file that opens, and an absent one is
not.

**The claim SHALL be understood as holding for the schema's default task-artifact
path.** The tree reader looks for the artifact at that one location, so a change
whose schema places its tasks elsewhere reports absent rather than present, and
the surface understates it. Every change in this project uses the `spec-driven`
schema, whose task artifact is at the default path, so the gap is not reachable
here today — it becomes reachable the moment a second schema is used. Stated
because "presence is read from the tree" reads like a guarantee about all changes
and is a guarantee about one path.

The reader SHALL NOT enumerate archived changes or derive each open change's
affected capabilities: no v2 surface consumes either value. It SHALL continue to
expose open-change names, completed and total task counts, task-artifact
presence, capability names, and requirement counts.

**What is actually consumed, stated exactly, because the pruning standard above
does not reach the whole retained set.** The `spec` check reads slot presence,
each open change's name with its completed and total task counts, and the
*length* of the capability list for its summary line. Task-artifact presence,
capability **names**, and requirement counts have no consumer: their only readers
were the withdrawn capability panel and change progress column.

They are retained anyway, and this is a deliberate exception rather than an
oversight. They are part of the reader contract `add-openspec-project-reader`
established, they cost one tree read that already happens for the counts, and
presence in particular is the one value the CLI cannot reconstruct, so dropping
it would be irreversible from the CLI side alone. What is *not* claimed is that
v2 consumes them.

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
  for a non-conformant change the two paths MAY differ. A
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

#### Scenario: A degraded spec read is visible, not silent
- **WHEN** the CLI and tree readers return different values for a project
- **THEN** the surface marks that project as read in compatibility mode and identifies what the readers disagreed about
- **AND** two machines that differ only in whether the binary is installed do not present the difference as a difference between repos.

#### Scenario: A legal configuration is not reported as malformed
- **WHEN** the readers diverge because a change places its task artifact at a schema-permitted path other than the default
- **THEN** the surface reports the divergence without attributing it to a malformed spec
- **AND** the reader is not sent to correct a file that conforms.

#### Scenario: A broken CLI cannot empty a populated surface
- **WHEN** the `openspec` binary is present but exits non-zero or emits output that does not parse
- **THEN** the daemon falls back to the values read from the tree
- **AND** the surface shows what the tree can populate rather than nothing.

### Requirement: Retired Locations Have An Explicit Transition

Known SPA transitions SHALL come from one explicit migration manifest. The root
location `/`, `/coverage`, `/observability/skill-drift`, and
`/observability/conformance` SHALL redirect to the fleet surface.
`/code-intelligence` SHALL redirect to the fleet surface. `/projects/:id` SHALL
redirect to `/repos/:id`, preserving the registered-project identifier.

**`/` is named because it is the one retired location nobody thinks to
enumerate.** It rendered the withdrawn multi-project home, so after the cutover
it is neither a surviving surface nor an unknown location, and the not-found
clause below does not reach it. Left unnamed, the product's bare origin — its
most likely entry point — would be the single URL whose behaviour nothing
specifies. Redirecting rather than re-hosting the fleet at `/` keeps `/fleet` the
canonical location `add-repo-readiness` shipped; a withdrawal change is the wrong
place to move a surface that is working. The existing redirect from `/` to the
onboarding surface for a visitor with no pairing SHALL be preserved: this
requirement governs where a paired visitor lands, not whether pairing is checked.

**A retired location carrying a repo identifier SHALL redirect to that repo's
detail surface, not to the fleet.** `/projects/:id` SHALL resolve to `/repos/:id`.
Discarding an identifier the URL already carries costs the user the context they
bookmarked and lands them on a list they must search to get back to where they
were. Only a retired location with no identifier in it falls back to the fleet
surface.

**The per-project rule is enumerated, not a wildcard.** A wildcard over
`/projects/:id/*` would contradict the not-found rule below: it would redirect
invented paths the product never served instead of returning not-found. The
router served `/projects/:id` and no per-project sub-paths. The manifest lists the
locations the product actually served; anything else is unknown.

**A redirect preserves the identifier without asserting it is still registered.**
`/projects/:id` for a repo that has since been unregistered SHALL still resolve to
`/repos/:id`, where the repo detail surface renders its existing not-found state.
Resolving the identifier against the registry before redirecting would put a
registry lookup in a URL rewrite and give a stale bookmark two different failure
surfaces depending on timing.

Unknown SPA locations MUST return the ordinary not-found state.

**The withdrawn daemon API surface SHALL be enumerated normatively, not by
reference to the manifest.** Defining it as "the routes the manifest lists" makes
the requirement circular: an endpoint omitted from the manifest is, by that
wording, not required to be removed, and cannot be found missing by review. The
withdrawal covers **every** method and path served by the retired route modules —
the knowledge-graph viewer's asset and read endpoints, the coverage and
coverage-history endpoints, the conformance endpoint, the skill-drift endpoints,
the AgentLinter endpoints, and the Sentry, Linear, secrets, integrations and
observability endpoints. **Nineteen endpoints across eleven route modules**,
enumerated here rather than deferred:

| Endpoint | Module |
|---|---|
| `GET /api/coverage` | `coverage` |
| `GET /api/coverage/history` | `coverageHistory` |
| `GET /api/observability/conformance` | `conformance` |
| `GET /api/skills/drift` | `skillDrift` |
| `POST /api/skills/drift/agentlinter` | `skillDrift` |
| `GET /api/projects/:id/agentlinter` | `agentlinter` |
| `GET /api/projects/:id/sentry/recent` | `sentry` |
| `GET /api/projects/:id/linear/issues` | `linear` |
| `GET /api/projects/:id/secrets` | `secrets` |
| `GET /api/projects/:id/integrations` | `integrations` |
| `GET /api/projects/:id/observability` | `observability` |
| `GET /knowledge-graph.json` | `understandViewer` |
| `GET /meta.json` | `understandViewer` |
| `GET /config.json` | `understandViewer` |
| `GET /domain-graph.json` | `understandViewer` |
| `GET /diff-overlay.json` | `understandViewer` |
| `GET /file-content.json` | `understandViewer` |
| `GET /understand/:family/:repo` | `understandViewer` |
| `GET /understand/:family/:repo/*` | `understandViewer` |

An endpoint served by one of those eleven modules and absent from this table is
an error in the table rather than a survivor; a change touching this surface
SHALL re-derive the list against the router and correct it if the two disagree.

**Nineteen is a measured figure**, counted from the router registrations in the
eleven modules and corroborated independently by a reviewer. An earlier "roughly
sixty" was never verified and would have led an implementer finding nineteen to
conclude they had missed forty-one. The six root-level `*.json` endpoints are
listed explicitly because they are mounted at the root rather than under `/api`,
which is where an enumeration by prefix loses them.

The viewer endpoints are called out because they are the ones where an escape
costs most: they serve graph and file content, so an endpoint left standing after
its surface is withdrawn keeps that content reachable with no product surface
that would reveal it is still there.

A removed API MUST NOT retain a compatibility stub or synthetic payload.

#### Scenario: A bookmarked v1 page reaches the fleet
- **WHEN** a user navigates to a known retired SPA location carrying no repo identifier
- **THEN** the application redirects to the fleet surface
- **AND** it does not render a blank shell or a withdrawn page.

#### Scenario: The bare origin lands on the fleet
- **WHEN** a paired user opens the application at `/`
- **THEN** the application redirects to the fleet surface
- **AND** it does not render the withdrawn multi-project home or a blank shell.

#### Scenario: The origin still gates on pairing
- **WHEN** a user with no pairing opens the application at `/`
- **THEN** the application redirects to the onboarding surface as before
- **AND** the fleet redirect does not bypass the pairing check.

#### Scenario: A retired per-project link keeps its repo
- **WHEN** a user navigates to `/projects/:id`
- **THEN** the application redirects to `/repos/:id` rather than to the fleet surface
- **AND** the user is not made to search a list for the repo their bookmark already named.

#### Scenario: An invented per-project path is not redirected
- **WHEN** a user navigates to a `/projects/:id/...` sub-path the product never served
- **THEN** the application returns the ordinary not-found state
- **AND** the per-project rule does not act as a wildcard over paths absent from the manifest.

#### Scenario: A stale bookmark for an unregistered repo
- **WHEN** a user navigates to `/projects/:id` for a repo that is no longer registered
- **THEN** the application still redirects to `/repos/:id`
- **AND** the repo detail surface renders its not-found state rather than the redirect resolving the registry first.

#### Scenario: A removed API is absent
- **WHEN** a client requests a daemon API withdrawn by the v2 cutover
- **THEN** the daemon returns not-found
- **AND** no compatibility response exposes the removed schema.

#### Scenario: No endpoint survives by being left off a list
- **WHEN** an endpoint served by a retired route module is absent from the enumerated method/path list
- **THEN** it is still withdrawn, and its absence from the list is an error in the list
- **AND** the requirement cannot be satisfied by an enumeration that quietly omits a route.

#### Scenario: A withdrawn viewer endpoint stops serving content
- **WHEN** a client requests a knowledge-graph viewer asset or read endpoint after the cutover
- **THEN** the daemon returns not-found and serves no graph or file content
- **AND** the content is not left reachable by an endpoint whose surface was withdrawn.

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
An integration MUST NOT be a hard dependency of any unrelated route or surface.

#### Scenario: No integration configured is fully supported
- **WHEN** the dashboard runs with no integration configured
- **THEN** every current surface renders its own data completely
- **AND** no unrelated surface reports an integration prerequisite.

#### Scenario: A future integration stays isolated
- **WHEN** a future integration is added and left unconfigured
- **THEN** only that integration's own surface may report its absence
- **AND** no other surface's data or action is withheld.

### Requirement: Third-Party Products Are Integrated, Not Reimplemented

Where the dashboard surfaces a third-party product, it SHALL reflect that
product's state and link out to it rather than rebuild its functionality. The
dashboard MUST NOT become a control plane for a product it does not own. Like the
requirement above, this binds future additions rather than any current surface,
because v2 offers no integrations.

This is relocated from the withdrawn `optional-integrations` capability rather
than restated fresh. It was originally to be dropped on the reasoning that
reimplementation is conspicuous enough to be caught in review, unlike a
load-bearing dependency that fails silently. That reasoning was withdrawn: a
reviewer only catches what they know to look for, and the constraint they would
need is the one that went to the archive. Retaining a standing rule costs
nothing; recovering one from an archived change requires knowing it existed.

#### Scenario: A product is reflected, not rebuilt
- **WHEN** a future integration surfaces a third-party product's state
- **THEN** the dashboard renders that state and links out to the product
- **AND** it does not reimplement the product's own operations.
