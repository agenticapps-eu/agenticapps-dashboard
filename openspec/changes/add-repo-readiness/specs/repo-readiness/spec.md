## ADDED Requirements

### Requirement: Six Checks With Fixed Identity And Order

Every repo SHALL be described by exactly six checks, identified as `workflow`,
`spec`, `code-review`, `security-review`, `pen-test`, and `coverage`, always in
that order. The order and the identifiers come from one shared definition
consumed by both the daemon and the UI. A repo for which nothing could be derived
SHALL still report six results, never a shorter list.

#### Scenario: A repo with no derivable signal still reports six checks
- **WHEN** readiness is computed for a repo where no check can be derived
- **THEN** six results are returned, one per check identifier, each with status `never`
- **AND** no check is omitted from the response.

#### Scenario: Order comes from one definition
- **WHEN** the daemon serialises checks and the UI renders them
- **THEN** both take the identifiers and their order from the same shared constant
- **AND** neither applies its own sort.

#### Scenario: An unrecognised check identifier does not enter the model
- **WHEN** a source offers a check whose identifier is not one of the six
- **THEN** it is discarded
- **AND** the six results are returned unaffected.

### Requirement: Six-Value Status Vocabulary

Every check result SHALL carry exactly one of six statuses: `ok`, `warn`, `fail`,
`stale`, `never`, `na`. The same vocabulary applies to all six checks. `na` MUST
carry a reason.

#### Scenario: The vocabulary does not vary by check
- **WHEN** any of the six checks reports a result
- **THEN** its status is one of the six values
- **AND** no check defines a status value of its own.

#### Scenario: Not-applicable states its reason
- **WHEN** a check reports `na`
- **THEN** the result carries a summary explaining why the check does not apply to this repo
- **AND** the UI renders that reason rather than an unexplained grey cell.

### Requirement: Absent Data Is Never Rendered As A Passing Or Zero Value

A check that has not run SHALL be reported as `never` and MUST NOT be rendered as
`0 %`, as an empty-but-passing state, or as a green indicator. A check that could
not be evaluated because of an error SHALL be distinguishable from one that has
never run.

#### Scenario: Missing coverage data is not zero percent
- **WHEN** a repo has no coverage artifact
- **THEN** the coverage check reports `never`
- **AND** the fleet row shows an absence marker rather than `0 %`.

#### Scenario: An evaluation error is not silent success
- **WHEN** a deriver throws while evaluating a check
- **THEN** that check reports a failed or never-run state carrying the error text
- **AND** it is never reported as `ok`.

### Requirement: Two-Tier Provenance With Per-Check Precedence

Check results SHALL be derived from what is already on disk (tier A). Where
`<repo>/.agenticapps/readiness.json` declares a check (tier B), the declared value
SHALL win for that check only, leaving the other checks derived. Every result
MUST record whether it was derived or declared.

#### Scenario: A declared check overrides only itself
- **WHEN** a repo declares only `pen-test` in its readiness file
- **THEN** `pen-test` reports the declared value marked as declared
- **AND** the remaining five checks report their derived values marked as derived.

#### Scenario: No readiness file is the normal case
- **WHEN** a repo has no `.agenticapps/readiness.json`
- **THEN** all six checks are derived
- **AND** no warning, error, or hint is raised about the file's absence.

### Requirement: An Unusable Readiness File Is Reported, Not Silently Ignored

Where `<repo>/.agenticapps/readiness.json` exists but declares an unsupported
`schemaVersion` or cannot be parsed, the file SHALL be ignored in full and the
repo SHALL carry a visible notice saying so. Falling back to derived values
without a notice is not permitted.

#### Scenario: A version mismatch is visible
- **WHEN** a repo's readiness file declares a `schemaVersion` the daemon does not support
- **THEN** none of the file's declared checks are applied
- **AND** the repo carries a notice distinguishing this state from having no file at all.

#### Scenario: Unparsable JSON behaves the same way
- **WHEN** a repo's readiness file is not valid JSON
- **THEN** the file is ignored in full and the same visible notice is raised
- **AND** the other repos in the fleet response are unaffected.

#### Scenario: An unknown check identifier does not invalidate the file
- **WHEN** a readiness file declares a check whose identifier is not one of the six
- **THEN** that entry alone is discarded
- **AND** the file's remaining valid entries still take precedence.

### Requirement: The Workflow Check Resolves Per Host

The `workflow` check SHALL determine the repo's host and resolve the installed
workflow version using that host's own layout. Where a host stores its
`implements_spec` machine-globally rather than per repo, the check SHALL report
both the per-repo artifact and the machine-global value, and MUST state that the
latter is not repo-specific. Where no version can be pinned for a host, the check
SHALL report `na` with a reason rather than deriving a value.

#### Scenario: A repo-scoped host is compared against what its host repo ships
- **WHEN** the check runs against a repo whose host records the workflow version inside the repo
- **THEN** the installed version and `implements_spec` are compared against the version that host's repo currently ships
- **AND** the result is `ok` when both match, `warn` when only the skill version trails, and `fail` when `implements_spec` trails.

#### Scenario: A machine-global host reports both values and labels them
- **WHEN** the check runs against a repo whose host installs skills machine-globally
- **THEN** the result carries both the per-repo scaffolder version and the machine-global `implements_spec`
- **AND** the detail view states that the machine-global value applies to every project on this machine for that host.

#### Scenario: An unpinnable host reports not-applicable
- **WHEN** the check runs against a repo whose host exposes no version artifact
- **THEN** the check reports `na` with a reason
- **AND** no version is inferred.

#### Scenario: No workflow artifact at all
- **WHEN** no workflow artifact of any host is present in the repo
- **THEN** the check reports `never`.

#### Scenario: The result does not overstate its own precision
- **WHEN** the workflow check returns any derived result
- **THEN** its summary states that the comparison is a frontmatter comparison and that no migration ledger exists
- **AND** the number is not presented as a record of which migrations were applied.

### Requirement: The Spec Check Consumes The Existing OpenSpec Reader

The `spec` check SHALL map what the project's OpenSpec reader already reports onto
the readiness status vocabulary. It MUST NOT implement its own traversal of a
project's `openspec/` directory, and MUST NOT fall back to reading a GSD phase
tree.

#### Scenario: Reader output is mapped, not recomputed
- **WHEN** the `spec` check evaluates a repo
- **THEN** it obtains open-change counts and task ratios from the existing reader
- **AND** it performs no directory traversal of its own.

#### Scenario: Status maps from the reader's answer
- **WHEN** the reader reports no `openspec/` directory
- **THEN** the check reports `never` with a hint that OpenSpec is not set up
- **AND** when the reader reports zero open changes the check reports `ok`, when it reports open changes the check reports `warn` carrying their count and task ratios, and when the reader reports a read error the check reports `fail` carrying that error.

#### Scenario: A repo still on the old layout renders as absent, not as passing
- **WHEN** the check evaluates a repo that has not migrated to OpenSpec
- **THEN** it reports `never` and the fleet column shows an absence marker
- **AND** no phase-tree fallback is consulted to produce a value.

### Requirement: Review Checks Derive From Evidence Artifacts And Age Against Code

The `code-review` and `security-review` checks SHALL search both the OpenSpec and
the legacy planning layouts for their evidence artifacts, preferring an OpenSpec
match, and SHALL count artifacts inside archived changes. A found artifact alone
is not sufficient for `ok`: where the newest matching artifact predates the last
commit that touched production code, the check SHALL report `stale`.

#### Scenario: No artifact means never run
- **WHEN** no matching review artifact exists in either layout
- **THEN** the check reports `never`.

#### Scenario: A current artifact passes
- **WHEN** the newest matching artifact is at least as new as the last production-code commit
- **THEN** the check reports `ok` carrying the artifact path and its timestamp.

#### Scenario: An outdated artifact is stale, not ok
- **WHEN** the newest matching artifact predates the last production-code commit
- **THEN** the check reports `stale`
- **AND** the result distinguishes this from both `ok` and `fail`.

#### Scenario: Documentation changes do not age a review
- **WHEN** the only commits since the newest artifact touched documentation, planning, or spec directories
- **THEN** the check remains `ok`
- **AND** the comparison uses the last commit touching production code rather than the repository head.

#### Scenario: Archived evidence counts
- **WHEN** the only matching artifact lives inside an archived change
- **THEN** it is counted as evidence that the review ran.

### Requirement: The Pen-Test Check Is A Declared-Only Slot

The `pen-test` check SHALL have no derived signal and SHALL report `never` unless
a repo declares it in tier B. The check SHALL remain visible and tool-agnostic:
no tool name appears in the surface.

#### Scenario: Undeclared pen-test is never run, not omitted
- **WHEN** a repo declares no pen-test result
- **THEN** the check reports `never` and keeps its position among the six
- **AND** its remedy text explains that the result is reported through the readiness file.

#### Scenario: The surface names no tool
- **WHEN** the pen-test check renders in any state
- **THEN** the label describes the check, not the tool that satisfies it.

### Requirement: The Coverage Check Reports Test Coverage

The `coverage` check SHALL read the repo's coverage summary artifact and report
the total line-coverage percentage against a threshold, defaulting to a global
value and overridable per repo through tier B. The same staleness rule as the
review checks applies.

#### Scenario: Status follows the threshold
- **WHEN** a coverage summary is present
- **THEN** the check reports `ok` at or above the threshold, `warn` within five points below it, and `fail` further below
- **AND** the measured percentage is carried on the result.

#### Scenario: A missing artifact is never run
- **WHEN** no coverage summary artifact exists
- **THEN** the check reports `never`
- **AND** no percentage is reported.

#### Scenario: An unreadable artifact fails visibly
- **WHEN** a coverage summary exists but cannot be parsed
- **THEN** the check reports `fail` with an explanatory summary
- **AND** it is not reported as `never`.

#### Scenario: Stale coverage is stale regardless of its value
- **WHEN** the coverage artifact predates the last production-code commit
- **THEN** the check reports `stale` even if the percentage is above the threshold.

### Requirement: Readiness Endpoints Degrade Per Check And Per Repo

The daemon SHALL expose fleet readiness, per-repo readiness detail, and a rescan
action. A failure in one deriver MUST NOT remove other checks from that repo's
result, and a failure for one repo MUST NOT remove other repos from the fleet
result. Responses SHALL be validated against the shared schema before being sent,
and SHALL be returned in registry order without server-side sorting.

#### Scenario: One broken repo does not break the fleet
- **WHEN** the fleet endpoint is called and one registered repo cannot be read at all
- **THEN** the response still carries every other repo
- **AND** the failing repo appears with its checks in a never-run state carrying the error.

#### Scenario: One broken deriver does not break its repo
- **WHEN** a single check's deriver throws for a repo
- **THEN** that repo's other five checks are still reported
- **AND** the failing check carries the error text.

#### Scenario: Rescan invalidates and recomputes
- **WHEN** the rescan action is called for a repo
- **THEN** the cached readiness for that repo is discarded and recomputed
- **AND** other repos' cached results are unaffected.

#### Scenario: The server does not sort
- **WHEN** the fleet endpoint returns
- **THEN** repos appear in registry order
- **AND** ordering by failure count is applied by the client.

### Requirement: Readiness Is Presented Without An Aggregate Score

No surface SHALL present a per-repo or fleet-wide readiness score, percentage, or
tier derived by combining the six checks. Ordering SHALL be by count of `fail`,
then count of `never`, then most recent change.

#### Scenario: No combined number is rendered
- **WHEN** any readiness surface renders
- **THEN** no aggregate percentage, score, or tier appears
- **AND** the six individual states are what is shown.

#### Scenario: Sorting replaces ranking
- **WHEN** the fleet list is ordered by default
- **THEN** repos with more `fail` results appear first, ties broken by count of `never`, then by most recent change.

### Requirement: State Is Encoded By Shape As Well As Colour

The readiness indicator SHALL render all six checks in fixed positions, and each
status SHALL be distinguishable by shape in addition to colour. Where a value
exists for a check, that value SHALL appear in the cell. A compact variant
without values SHALL be available for dense list rows and a full variant for
detail headers.

#### Scenario: Colour is not the only channel
- **WHEN** any status renders
- **THEN** it is distinguishable from the other five by shape alone
- **AND** the rendering remains readable when colour is not perceived.

#### Scenario: Positions are stable across repos
- **WHEN** two repos with different results render side by side
- **THEN** each check occupies the same position in both
- **AND** no check is omitted to close a gap.

#### Scenario: Values are shown where they exist
- **WHEN** a check carries a version, a percentage, or a count
- **THEN** that value appears in the cell
- **AND** the colour summarises rather than replaces it.

#### Scenario: Each cell explains itself on demand
- **WHEN** a cell is inspected
- **THEN** it reveals the check name, the status in words, the timestamp, and whether the value was derived or declared.

### Requirement: The Fleet Surface Is One Row Per Repo

The fleet surface SHALL render one row per registered repo carrying its name, the
six checks, and its last-change time. Selecting a row SHALL open that repo's
detail; selecting a cell SHALL open the same detail positioned at that check.
Filters SHALL be combinable and family SHALL be a filter rather than a grouping
level.

#### Scenario: A row summarises a repo without a card
- **WHEN** the fleet surface renders registered repos
- **THEN** each repo occupies a single row carrying its six check states and last-change time.

#### Scenario: Selecting a cell lands on its check
- **WHEN** a check cell is selected
- **THEN** the repo detail opens positioned at that check's block.

#### Scenario: Filters combine and family does not group
- **WHEN** multiple filters are applied together
- **THEN** the visible rows satisfy all of them
- **AND** family narrows the row set rather than splitting it into sections.

#### Scenario: No repos registered leads to onboarding
- **WHEN** the fleet surface renders with no registered repos
- **THEN** it presents the path to registering one
- **AND** does not render an empty table.

### Requirement: Repo Detail Shows Evidence And A Way Forward

The repo detail surface SHALL render the six checks as six blocks in the fixed
order on a single scrollable page, without tabs, modals, or drawers. Each block
SHALL state its status in words with a timestamp, name its provenance, link its
evidence through the existing project read route, and — where the check has never
run — give a concrete instruction for making it run. No check's instruction text
may be empty.

#### Scenario: Every never-run check offers an action
- **WHEN** a repo renders with all six checks in a never-run state
- **THEN** six actionable instructions are shown
- **AND** none of them is blank.

#### Scenario: Provenance is stated
- **WHEN** a check block renders
- **THEN** it states whether the value was derived, naming the path it came from, or declared in the repo's readiness file.

#### Scenario: Evidence opens through the existing read route
- **WHEN** an evidence link is followed
- **THEN** the file is fetched through the existing project read route
- **AND** no new filesystem access path is introduced.

#### Scenario: All six blocks are present without navigation
- **WHEN** the detail surface renders
- **THEN** all six blocks are reachable by scrolling a single page
- **AND** no block is hidden behind a tab, modal, or drawer.
