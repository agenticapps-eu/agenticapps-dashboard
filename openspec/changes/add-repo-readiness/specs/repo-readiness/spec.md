## ADDED Requirements

### Requirement: Six Checks With Fixed Identity And Order

Every repo SHALL be described by exactly six checks, identified as `workflow`,
`spec`, `code-review`, `security-review`, `pen-test`, and `coverage`, always in
that order. The order and the identifiers come from one shared definition
consumed by both the daemon and the UI. A repo for which nothing could be derived
SHALL still report six results, never a shorter list.

#### Scenario: A repo with no derivable signal still reports six checks
- **WHEN** readiness is computed for a repo where no check can be derived
- **THEN** six results are returned, one per check identifier, with `never` except where a check explicitly specifies `na`
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

### Requirement: Readiness Is A Boolean Predicate, Not A Score

A repo SHALL be ready only when none of its six checks has status `fail`,
`stale`, or `never` and no result carries an evaluation error. `warn` SHALL be a
visible, non-blocking caveat. `na` SHALL be excluded from the predicate, and at
least one check SHALL be applicable (`ok` or `warn`). The
predicate SHALL return only ready or not ready and MUST NOT assign weights or
produce a numeric score.

#### Scenario: A warning does not hide readiness
- **WHEN** a repo has only `ok`, `warn`, and `na` results and no evaluation error
- **THEN** the repo is ready
- **AND** every warning and not-applicable reason remains visible.

#### Scenario: Missing or invalid assurance blocks readiness
- **WHEN** any result is `fail`, `stale`, or `never`, or carries an evaluation error
- **THEN** the repo is not ready
- **AND** the individual blocking result remains the explanation.

#### Scenario: A wholly not-applicable repo is not ready
- **WHEN** all six checks report `na`
- **THEN** the repo is not ready
- **AND** no vacuous success is produced.

### Requirement: Absent Data Is Never Rendered As A Passing Or Zero Value

A check that has not run SHALL be reported as `never` and MUST NOT be rendered as
`0 %`, as an empty-but-passing state, or as a green indicator.

A check that could not be evaluated because of an error SHALL carry a dedicated
structured error marker on the result, distinct from its status, so that
"evaluation failed" is distinguishable from "never ran" **without parsing prose**.
Error text SHALL be free of absolute filesystem paths and of any credential
material. Every error-bearing result SHALL use status `fail`. In sorting, it
contributes to the evaluation-error count and is excluded from the ordinary
`fail` count, so one result is never counted twice.

#### Scenario: Missing coverage data is not zero percent
- **WHEN** a repo has no coverage artifact
- **THEN** the coverage check reports `never`
- **AND** the fleet row shows an absence marker rather than `0 %`.

#### Scenario: An evaluation error is not silent success
- **WHEN** a deriver throws while evaluating a check
- **THEN** that check reports `fail` and carries the structured error marker together with an explanatory summary
- **AND** it is never reported as `ok`.

#### Scenario: An error is machine-distinguishable from never-run
- **WHEN** one check has never run and another failed to evaluate
- **THEN** the two are distinguishable by the presence of the error marker alone
- **AND** neither requires reading the summary text to tell them apart.

#### Scenario: Error text carries no paths or secrets
- **WHEN** a deriver's failure produces an error message containing an absolute path or credential material
- **THEN** the reported error text is reduced to a repo-relative or symbolic reference
- **AND** no credential material reaches the response.

### Requirement: Two-Tier Provenance With Per-Check Precedence

Check results SHALL be derived from what is already on disk (tier A). Where
`<repo>/.agenticapps/readiness.json` declares a check (tier B), the declared value
SHALL win for that check only, leaving the other checks derived. Every result
MUST record whether it was derived or declared.

**Declared values are trusted as author input and are not validated against the
derived value.** A repo may declare a state better than the one the daemon would
derive, including over a derived `fail`. This is deliberate: tier B exists to
report what the daemon cannot see, and a plausibility check against a signal the
daemon admits is incomplete would defeat that. Provenance and required evidence
metadata make the claim auditable; trust does not permit an anonymous or
timeless review claim. Freshness is the exception to declared-value precedence:
declared code/security review evidence becomes `stale` when its reviewed commit
does not cover the current production-code state or relevant dirty changes
exist, and an expired declared pen test becomes `stale`. Its `source` remains
`declared`.

#### Scenario: A declared check overrides only itself
- **WHEN** a repo declares only `pen-test` in its readiness file
- **THEN** `pen-test` reports the declared value marked as declared
- **AND** the remaining five checks report their derived values marked as derived.

#### Scenario: No readiness file is the normal case
- **WHEN** a repo has no `.agenticapps/readiness.json`
- **THEN** all six checks are derived
- **AND** no warning, error, or hint is raised about the file's absence.

#### Scenario: A declared value overrides a worse derived value
- **WHEN** a repo declares a check as `ok` where the derived value would be `fail` or `never`
- **THEN** the declared value is reported and marked as declared
- **AND** the daemon raises no discrepancy warning when the declaration satisfies its evidence requirements.

#### Scenario: Freshness overrides a declared status
- **WHEN** declared review evidence no longer covers the current production-code state or a declared pen test is expired
- **THEN** the result reports `stale` while retaining `source: declared`
- **AND** author trust does not turn expired evidence green.

### Requirement: The Tier-B File Has A Strict, Bounded Schema

`.agenticapps/readiness.json` SHALL use `schemaVersion: 1`. It MAY configure a
repo-relative coverage artifact path, the coverage threshold, included
production-code paths, and additional ignored paths. It SHALL carry declared
check entries using the fixed check identifier and status vocabularies.

Every declared entry SHALL carry `observedAt` as an RFC 3339 timestamp. Declared
`code-review`, `security-review`, and `pen-test` entries SHALL also carry a
repo-relative evidence path and a full git commit SHA. A declared `pen-test`
entry SHALL carry `validUntil` as an RFC 3339 timestamp. All strings and arrays
SHALL have explicit size/count bounds.

Every configured or evidence path SHALL be repo-relative, SHALL remain beneath
the canonical repo root after symlink resolution, and SHALL be read with an
explicit file-size limit. Unknown check identifiers SHALL be ignored
entry-by-entry. Unknown top-level fields, unknown fields inside a recognised
entry, and any other malformed known entry SHALL invalidate the whole file.
Declared `pen-test` entries MAY use only `ok`, `warn`, or `fail`; `stale` is
derived from expiration, `never` means no declaration, and `na` is not valid for
this applicable declared-only slot.

All tier-B file and evidence reads SHALL use the daemon's shared bounded,
canonical, symlink-contained project-read primitive rather than a second path
validator. Validation and open SHALL operate through that primitive so a path
that escapes or changes to an escaping symlink is refused before bytes are
parsed.

#### Scenario: A review claim is auditable
- **WHEN** a repo declares a code or security review result
- **THEN** the entry identifies its evidence path, observed time, and reviewed commit
- **AND** a missing or malformed field makes the readiness file unusable.

#### Scenario: Paths cannot escape the repo
- **WHEN** a configured artifact or evidence path is absolute, traverses above the repo, resolves through a symlink outside it, or exceeds its read bound
- **THEN** the readiness file is unusable
- **AND** no file outside the canonical repo root is read.

### Requirement: An Unusable Readiness File Is Reported, Not Silently Ignored

Where `<repo>/.agenticapps/readiness.json` exists but declares an unsupported
`schemaVersion`, cannot be parsed, or contains any malformed known entry, the
file SHALL be ignored in full and the repo SHALL carry a visible notice saying
so. Falling back to derived values without a notice is not permitted.

#### Scenario: A version mismatch is visible
- **WHEN** a repo's readiness file declares a `schemaVersion` the daemon does not support
- **THEN** none of the file's declared checks are applied
- **AND** the repo carries a notice distinguishing this state from having no file at all.

#### Scenario: Unparsable JSON behaves the same way
- **WHEN** a repo's readiness file is not valid JSON
- **THEN** the file is ignored in full and the same visible notice is raised
- **AND** the other repos in the fleet response are unaffected.

#### Scenario: One malformed known entry invalidates the file
- **WHEN** one recognised check entry violates its schema
- **THEN** none of the file's declared checks or configuration is applied
- **AND** the repo carries the same visible unusable-file notice.

#### Scenario: An unknown check identifier does not invalidate the file
- **WHEN** a readiness file declares a check whose identifier is not one of the six
- **THEN** that entry alone is discarded
- **AND** the file's remaining valid entries still take precedence.

### Requirement: The Workflow Check Resolves Per Host

The `workflow` check SHALL determine the repo's host and resolve the installed
workflow version using that host's own layout. Where a host stores its
`implements_spec` machine-globally rather than per repo, the check SHALL report
both the per-repo scaffolder version and the machine-global value, and MUST state
that the latter is not repo-specific. The result SHALL be `fail` when the global
`implements_spec` trails, `warn` when only the per-repo scaffolder trails, and
`ok` only when both match what the host repo ships. Where no version can be
pinned for a host, the check SHALL report `na` with a reason rather than deriving
a value; this unpinnable-host rule takes precedence over the no-artifact
`never` rule. Machine-global values MAY appear in the authenticated response as
machine-scoped derived context, but SHALL never be persisted or exported as
repo-owned evidence.

Machine-global reads SHALL use only the host-specific named roots authorised by
`filesystem-access-policy` as modified by `add-workflow-fleet-conformance`.
Canonical/symlink containment and the scanner's file-size bounds apply. This
check MUST NOT ship before that dependency is archived.

Host detection and layout resolution SHALL cover only the explicitly supported
Claude, Codex, and opencode layouts. An unknown host, malformed version artifact,
unavailable authorised root, or unsupported layout SHALL become an
error-bearing result for this check only; it MUST NOT abort the repo or fleet
response. Machine-global context SHALL be labelled as applying to every project
for that host in both compact and detail surfaces.

#### Scenario: A repo-scoped host is compared against what its host repo ships
- **WHEN** the check runs against a repo whose host records the workflow version inside the repo
- **THEN** the installed version and `implements_spec` are compared against the version that host's repo currently ships
- **AND** the result is `ok` when both match, `warn` when only the skill version trails, and `fail` when `implements_spec` trails.

#### Scenario: A machine-global host reports both values and labels them
- **WHEN** the check runs against a repo whose host installs skills machine-globally
- **THEN** the result carries both the per-repo scaffolder version and the machine-global `implements_spec`
- **AND** the detail view states that the machine-global value applies to every project on this machine for that host.

#### Scenario: Machine-global drift determines the status
- **WHEN** the global `implements_spec` trails what the host repo ships
- **THEN** the result is `fail` regardless of the per-repo scaffolder version
- **AND** when only the scaffolder trails the result is `warn`.

#### Scenario: An unpinnable host reports not-applicable
- **WHEN** the check runs against a repo whose host exposes no version artifact
- **THEN** the check reports `na` with a reason
- **AND** no version is inferred.

#### Scenario: No workflow artifact at all
- **WHEN** no workflow artifact is present and the detected host otherwise has a pinnable layout
- **THEN** the check reports `never`.

#### Scenario: Machine-global reads stay in named roots
- **WHEN** a workflow check needs a host's machine-global skill
- **THEN** it resolves the symbolic host root through the dedicated scanner boundary
- **AND** no request or readiness file supplies the external path.

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
- **AND** no phase-tree fallback is consulted to produce a value
- **AND** the remedy names the detected host's installed workflow-update command, states that migration 0032 performs OpenSpec initialisation, and never stops at a generic "migrate" hint.

### Requirement: Review Checks Derive From Evidence Artifacts And Age Against Code

The `code-review` check SHALL match
`openspec/changes/**/REVIEW.md` (including archived changes) and the legacy
`.planning/phases/**/CODE-REVIEW.md` pattern. The `security-review` check SHALL
match `openspec/changes/**/SECURITY.md` (including archived changes) and the
legacy `.planning/phases/**/SECURITY-REVIEW.md` pattern. An OpenSpec match SHALL
win over a legacy match. Within the selected layout, the candidate with the
latest git committer timestamp SHALL be selected, with repo-relative path as an
ascending tie-breaker. The disjoint patterns prevent one review type from
satisfying the other.

A found artifact alone is not sufficient for `ok`. A code-review artifact SHALL
carry a frontmatter `verdict` or `stage_2_verdict` whose value begins with
`PASS` or `APPROVE`, case-insensitively, and `blocking_open: 0`. A security
artifact SHALL carry a frontmatter `verdict` beginning with `PASS` or `APPROVE`
and SHALL contain no finding whose status is `OPEN` or `BLOCKING`. A recognised
failed verdict SHALL report `fail`; a missing or malformed verdict SHALL carry
an evaluation error and SHALL never report `ok`.

The verdict-key asymmetry is deliberate: legacy code-review evidence used
`stage_2_verdict`, while the security-review artifact contract has only ever
used `verdict`. A security artifact carrying only `stage_2_verdict` is malformed
rather than silently accepted under the code-review compatibility rule.

Passing committed evidence SHALL report `stale` when the last commit touching
production code is not an ancestor of the evidence commit, or when relevant
dirty or unignored-untracked production-code paths exist. Committer timestamps
in UTC are display and candidate-selection metadata only; they never replace
the ancestry test. An uncommitted review artifact SHALL be current when there is
no dirty or unignored-untracked production-code path; it is evaluated as
working-tree evidence and has no ancestry comparison.

By default, production code is every tracked or unignored-untracked path except
`docs/**`, `.planning/**`, `openspec/**`, root-level `*.md`, and the configured
coverage artifact. Gitignored paths do not enter the set. A repo MAY replace the
included path set and extend the ignored set through the strict tier-B
configuration; this is trusted author configuration and its effect is visible
in the result summary. The response SHALL expose the effective include and
ignore patterns and label them as a repo declaration. A configured scope that
leaves no effective production path while the default scope finds one SHALL make
the readiness file unusable rather than allowing all existing evidence to evade
freshness.

#### Scenario: No artifact means never run
- **WHEN** no matching review artifact exists in either layout
- **THEN** the check reports `never`.

#### Scenario: A current artifact passes
- **WHEN** the selected artifact has a passing verdict, descends from the last production-code commit, and no relevant production-code change is dirty or unignored-untracked
- **THEN** the check reports `ok` carrying the artifact path and its timestamp.

#### Scenario: An outdated artifact is stale, not ok
- **WHEN** the selected passing artifact does not descend from the last production-code commit or relevant production-code changes are dirty or unignored-untracked
- **THEN** the check reports `stale`
- **AND** the result distinguishes this from both `ok` and `fail`.

#### Scenario: Documentation changes do not age a review
- **WHEN** the only commits since the selected artifact touched documentation, planning, spec, ignored output, or the configured coverage artifact
- **THEN** the check remains `ok`
- **AND** the comparison uses the last commit touching production code rather than the repository head.

#### Scenario: A fresh clone does not make stale evidence look current
- **WHEN** a repo whose selected review artifact does not descend from its last production-code commit is read from a fresh clone, so every file's filesystem timestamp is the checkout time
- **THEN** the check still reports `stale`
- **AND** the evaluation uses ancestry rather than filesystem timestamps.

#### Scenario: A failed verdict is not passing evidence
- **WHEN** the newest matching artifact has a recognised failed verdict or open blocking findings
- **THEN** the check reports `fail`
- **AND** artifact presence alone never produces `ok`.

#### Scenario: Each review check matches only its own evidence
- **WHEN** a repo contains evidence artifacts for both `code-review` and `security-review`
- **THEN** each check reports against its own artifacts only
- **AND** neither check is satisfied by the other's evidence.

#### Scenario: Archived evidence counts
- **WHEN** the only matching artifact lives inside an archived change
- **THEN** it is parsed and aged by the same rules as active evidence.

### Requirement: The Pen-Test Check Is A Declared-Only Slot

The `pen-test` check SHALL have no derived signal and SHALL report `never` unless
a repo declares it in tier B. A declaration whose `validUntil` has passed SHALL
report `stale`. The check SHALL remain visible and tool-agnostic: no tool name
appears in the surface.

#### Scenario: Undeclared pen-test is never run, not omitted
- **WHEN** a repo declares no pen-test result
- **THEN** the check reports `never` and keeps its position among the six
- **AND** its remedy text explains that the result is reported through the readiness file.

#### Scenario: The surface names no tool
- **WHEN** the pen-test check renders in any state
- **THEN** the label describes the check, not the tool that satisfies it.

### Requirement: The Coverage Check Reports Test Coverage

The `coverage` check SHALL read `coverage/coverage-summary.json` by default and
report `total.lines.pct`. The strict tier-B configuration MAY provide a different
repo-relative artifact path. The threshold SHALL default to 80 and MAY be
overridden per repo within 0–100. Values at or above the threshold SHALL be
`ok`; values from `max(0, threshold - 5)` up to but excluding the threshold
SHALL be `warn`; lower values SHALL be `fail`. The same ancestry and relevant
dirty-working-tree rule as the review checks applies to a successfully parsed
numeric result and takes precedence over its percentage status. Artifact
read/parse/schema errors take precedence over freshness and report an
error-bearing `fail`, because no trustworthy evidence value exists to age.

#### Scenario: Status follows the configured threshold
- **WHEN** a coverage summary is present
- **THEN** it reports `ok` at or above the configured threshold, `warn` within the five-point band below it, and `fail` below that band
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
- **WHEN** the last production-code commit is not an ancestor of the committed coverage artifact or relevant production changes are dirty or unignored-untracked
- **THEN** the check reports `stale` even if the percentage is above the threshold
- **AND** the comparison uses ancestry rather than timestamp ordering.

#### Scenario: An uncommitted coverage artifact is current
- **WHEN** the coverage artifact exists in the working tree but is not committed and no relevant production-code path is dirty or unignored-untracked
- **THEN** it is treated as current rather than stale.

### Requirement: The Readiness Wire Shape Is Strict And Nullable

Every check result SHALL contain `id`, `status`, `source` (`derived` or
`declared`), `at` (epoch milliseconds or null), `value` (string, number, or
null), `threshold` (number or null), `summary`, `evidence` (a repo-relative path
and optional commit SHA, or null), and `error` (a stable code and sanitised
message, or null). Repo summaries SHALL contain stable registry `id`, `name`,
`family`, boolean `ready`, `lastCommitAt` as epoch milliseconds or null, exactly
six check results, and any readiness-file notice. Repo detail SHALL add a
non-empty `remedy` to each result. Fleet and detail responses SHALL carry
`generatedAt` as epoch milliseconds.

For derived committed evidence, `at` SHALL be the evidence commit's git
committer timestamp; for declared evidence it SHALL be `observedAt`; for
uncommitted evidence it SHALL be the scan time. `generatedAt` SHALL be the time
the computed snapshot entered the cache, not the time a cached response happened
to be served.

For the derived `workflow` check, repo-scoped workflow-version/scaffolder
metadata is the evidence: `at` SHALL be the last commit touching that
repo-relative metadata, or scan time when it is uncommitted. A machine-global
`implements_spec` value is labelled response context, not repo evidence, and
does not supply or replace `at`. An unpinnable-host `na` result has null `at` and
evidence.

For `never`, `na`, and evaluation-error results without observed evidence, `at`
and `evidence` SHALL be null and the UI SHALL render an em dash rather than an
invented timestamp or path. All response schemas and nested objects SHALL reject
unknown fields.

#### Scenario: Missing evidence is represented explicitly
- **WHEN** a check has never run or has no observed evidence
- **THEN** its `at` and `evidence` fields are null
- **AND** the surface renders em dashes rather than a current time or synthetic path.

#### Scenario: Responses carry no machine path
- **WHEN** readiness evidence, errors, or notices are serialised
- **THEN** paths are repo-relative or symbolic and credentials and usernames are redacted
- **AND** no absolute filesystem path reaches the client.

### Requirement: Readiness Endpoints Degrade Per Check And Per Repo

The daemon SHALL expose authenticated, CORS-locked `GET /api/v2/fleet`, `GET
/api/v2/repos/:id`, and `POST /api/v2/repos/:id/rescan` routes in the existing
Hono app, with no cookie-auth alternative. Unknown repo identifiers SHALL return
404. A failure in one deriver MUST NOT remove other checks from that repo's
result, and a failure for one repo MUST NOT remove other repos from the fleet
result. Responses SHALL be validated against the shared schema before being sent
and returned in registry order without server-side sorting.

Computed readiness SHALL be cached for no more than five seconds and invalidated
by relevant HEAD, dirty/untracked production-code state, readiness-file state,
machine-global workflow state, or registry membership. Concurrent rescans for the same repo SHALL be
coalesced into one computation. Readiness data, including machine-global
workflow state, SHALL remain in memory and MUST NOT be persisted or exported as
repo-owned data.

#### Scenario: One broken repo does not break the fleet
- **WHEN** the fleet endpoint is called and one registered repo cannot be read at all
- **THEN** the response still carries every other repo
- **AND** the failing repo appears with six `fail` results carrying structured errors.

#### Scenario: One broken deriver does not break its repo
- **WHEN** a single check's deriver throws for a repo
- **THEN** that repo's other five checks are still reported
- **AND** the failing check carries the structured error marker specified in the status vocabulary.

#### Scenario: Rescan invalidates and recomputes
- **WHEN** the rescan action is called for a repo
- **THEN** the cached readiness for that repo is discarded and recomputed
- **AND** other repos' cached results are unaffected.

#### Scenario: Concurrent rescans are bounded
- **WHEN** more than one rescan request for the same repo overlaps
- **THEN** the requests share one in-flight computation
- **AND** an unknown repo returns 404 without reading a filesystem path from the request.

#### Scenario: All routes inherit the trust boundary
- **WHEN** a readiness route is requested without a valid bearer token or from a disallowed origin
- **THEN** it is refused before repository data is read
- **AND** no cookie-only authentication path is accepted.

#### Scenario: The server does not sort
- **WHEN** the fleet endpoint returns
- **THEN** repos appear in registry order
- **AND** ordering by failure count is applied by the client.

### Requirement: Readiness Is Presented Without An Aggregate Score

No surface SHALL present a per-repo or fleet-wide readiness score, percentage, or
tier derived by combining the six checks.

Ordering SHALL rank by count of evaluation errors, then `fail`, `stale`, `never`,
and `warn`, followed by the most recent git committer timestamp normalised to UTC
and stable repo identifier. Every count and timestamp sorts descending; the
stable identifier sorts ascending. A null `lastCommitAt` sorts after every
observed timestamp. Error-bearing `fail` results are excluded
from the ordinary fail count. `stale` precedes `never` because evidence once
believed current is more urgent than evidence never claimed. Ordering is a fixed
comparison over counts, not a score: it produces no number and none is displayed.

#### Scenario: No combined number is rendered
- **WHEN** any readiness surface renders
- **THEN** no aggregate percentage, score, or tier appears
- **AND** the six individual states are what is shown.

#### Scenario: Sorting replaces ranking
- **WHEN** the fleet list is ordered by default
- **THEN** repos with more evaluation errors appear first, ties broken by count of `fail`, `stale`, `never`, and `warn`, then by most recent committer time and stable id.

#### Scenario: Stale evidence outranks never-run evidence
- **WHEN** one repo has a `stale` security review and another has the same check at `never`, with equal `fail` counts
- **THEN** the repo with the `stale` result is ordered first
- **AND** no numeric score is produced to express the difference.

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

#### Scenario: A missing timestamp is not fabricated
- **WHEN** a check's `at` field is null
- **THEN** the disclosure renders an em dash
- **AND** it does not substitute the response generation time.

### Requirement: The Fleet Surface Is One Row Per Repo

The fleet surface SHALL render one row per registered repo carrying its name, the
six checks, boolean readiness, any readiness-file notice, and its last-change
time. Selecting a row SHALL open that repo's
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
may be empty. Evidence links SHALL use only validated repo identifiers and
repo-relative paths already accepted by that read route. The header SHALL render
the boolean readiness and any readiness-file notice.

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
