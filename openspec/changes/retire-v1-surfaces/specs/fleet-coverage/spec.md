## REMOVED Requirements

> **The word `coverage` is not recycled.** This capability measured *tooling*
> coverage — which repos had which tools wired up. In v2 `coverage` means *test*
> coverage of a single repo, and lives as one of six checks in `repo-readiness`.
> Same word, different concept, which is why the replacement capability is not
> called `fleet-coverage`.

### Requirement: Fleet Coverage Matrix

**Reason**: The matrix answered "which repos have which tools installed". v2 asks
"is this repo production-ready", and answers it with six checks that are the same
for every repo. Tool presence is at most an input to the `workflow` check, never
a surface of its own. The matrix also discovered every git repo one level below
the configured family roots, including repos that were never registered. v2's
readiness fleet is intentionally registry-scoped, so that automatic population
is withdrawn with the coverage scanner. The matrix is withdrawn because the
question and population model were replaced, not because it stopped working.

**Migration**: Registered repos appear on the fleet surface as one row with six
readiness checks. A family-root repo that is not registered no longer appears
automatically; it is added through the surviving home registration affordance.
The per-tool columns have no successor; a repo's tooling is visible in the repo
itself.

### Requirement: Four-State Column Freshness

**Reason**: A four-state vocabulary scoped to matrix cells. v2 uses one
six-value vocabulary across all six checks and all surfaces, specified in
`repo-readiness`. Two state vocabularies in one product is how a reader learns to
distrust both.

**Migration**: The six-value vocabulary replaces it. `stale` — the state this one
lacked and the one that carries the most information — is now first-class.

### Requirement: Workflow Version Comparison

**Reason**: Workflow version comparison survives, in two better-targeted places:
as the `workflow` readiness check per repo, and as the version matrix in
`workflow-fleet-conformance` for the five workflow repos. What is withdrawn is
its expression as a matrix column, which flattened four genuinely different host
resolution strategies into one.

**Migration**: Per-repo comparison moves to the `workflow` check, which resolves
per host. Fleet-wide comparison moves to the workflow surface, which reports a
range across skills rather than a single number.

### Requirement: Family Grouping And Aggregates

**Reason**: Grouping by family spends vertical space separating repos a reader
wants to compare side by side, and the aggregates are the per-family form of the
score v2 rejects. v2 keeps family as a filter and drops the grouping level and
the aggregates.

**Migration**: Family becomes a filter chip on the fleet surface. No aggregate
replaces the per-family figures.

### Requirement: Filtering And Search

**Reason**: Scoped to a surface being withdrawn. Filtering and search survive on
the fleet surface, specified in `repo-readiness` against the readiness model
rather than against matrix columns.

**Migration**: The fleet surface carries combinable filters and search.

### Requirement: Review-Override Visibility

**Reason**: The override chip records a human decision to disregard a matrix
cell. With no cells, there is nothing to override. v2's equivalent is tier B: a
repo declares a check's state directly, and the result is marked as declared
rather than derived — which is a stronger form of the same idea, because it
carries the claim rather than merely suppressing the machine's. The tier-B
declared-check model is introduced by `add-repo-readiness`, which must be applied
before this retirement.

**Migration**: Overrides are expressed as declared checks in a repo's readiness
file. The detail surface shows provenance for every check.

### Requirement: Daily Coverage History Snapshots

**Reason**: The snapshots exist to feed the trend chart and the drift badges,
both withdrawn. v2 reports current state and does not keep a fleet time series;
the history that matters — when a review last ran, whether it predates the code —
is carried per check as a timestamp and the `stale` state.

**Migration**: Snapshot writing stops. Existing snapshot files under the daemon's
own directory are left in place for rollback rather than deleted. Inert means v2
neither reads nor writes them. Deletion or archival requires a separate cleanup
decision with an explicit retention policy.

### Requirement: Per-Cell Drift Indicator

**Reason**: Depends on the snapshot history withdrawn above and on cells that no
longer exist.

**Migration**: None. Per-check staleness replaces the notion of a cell drifting.

### Requirement: Scoped Refresh Actions

**Reason**: Scoped to matrix columns and families. v2 keeps a rescan, scoped to a
repo, specified in `repo-readiness`.

**Migration**: A per-repo rescan invalidates and recomputes that repo's checks.

### Requirement: Responsive Coverage Layout

**Reason**: The responsive contract of a surface being withdrawn. v2's density
rules and its breakpoint behaviour are specified in `design-system` and apply to
the fleet table.

**Migration**: The fleet surface remains one logical row per repo. At the `xs`
verification viewport, `Dense Rows And Aligned Figures` in `design-system`
permits that row to wrap its required fields internally without becoming a card
or creating page-level horizontal scrolling.
