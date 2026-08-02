## MODIFIED Requirements

### Requirement: Readiness Is A Boolean Predicate, Not A Score

A repo SHALL be ready only when no non-exempt check has status `fail`, `stale`, or
`never` and no result carries an evaluation error. `warn` SHALL be a
visible, non-blocking caveat. `na` SHALL be excluded from the predicate, and at
least one check SHALL be applicable (`ok` or `warn`). The
predicate SHALL return only ready or not ready and MUST NOT assign weights or
produce a numeric score.

A check designated as having no derived signal SHALL be advisory while
undeclared: its derived `never` SHALL NOT block readiness. The designation is a
property of the check, not of any repo, and SHALL be fixed for all repos. It
SHALL apply only where the daemon has nothing to observe for that check — a
check that observes its repo and finds no artifact reports a measured `never`
that blocks as before, because "we looked and found nothing" and "there is
nothing to look at" are different facts and only the first is evidence.

The exemption SHALL be narrow in four ways. It SHALL apply only to a `never`
that was derived: a declared status is an assertion by the repo and is honoured,
including when it is worse than the daemon could observe. It SHALL NOT extend to
`fail`, `stale`, or a result carrying an evaluation error, so an expired
declaration blocks through the ordinary freshness path and a member that fails to
evaluate blocks like any other check. An advisory check SHALL remain one of the
six for identity, order, and display, so exemption from the predicate is never
omission from the surface.

**And the exemption SHALL NOT apply while the repo's readiness file is unusable.**
An unusable file discards every declaration and returns all six checks to their
derived values, so without this clause a repo could reach ready by breaking its
own readiness file: a declared blocking status on the advisory check would be
discarded along with the file, the check would fall back to a derived `never`, and
the exemption would then excuse it. Readiness would improve because evidence
became unreadable. While a notice reports the file unusable, a derived `never` on
an advisory check SHALL block, because the daemon cannot tell what the discarded
file claimed.

**The check results alone SHALL NOT be treated as sufficient input to the
predicate.** When a readiness file is unusable, every check falls back to its
derived value carrying no error, so an advisory check's result is indistinguishable
from the same check in a repo that simply has no readiness file. The predicate
SHALL therefore take the repo's readiness-file notice alongside its check results,
and **every** computation of readiness — including the outbound schema's check that
`ready` follows from the response — SHALL use that same input. A validation that
recomputed readiness from the results alone would reject exactly the responses this
clause exists to produce. The notice is already carried in the same response object
as `ready` and the results, so this requires no new field on the wire.

#### Scenario: Every recomputation of readiness sees the same inputs
- **WHEN** a response is validated on its way out for a repo whose readiness file is unusable
- **THEN** the validation recomputes readiness from the results **and** the notice, and agrees with the value carried
- **AND** no correct response is rejected because a second computation of the predicate had less information than the first.

#### Scenario: The fleet row obeys the suspension too
- **WHEN** the fleet response carries a repo whose readiness file is unusable and whose five derivable checks report `ok`
- **THEN** that row reports not ready, and the fleet response passes outbound validation
- **AND** the suspension holds on the summary shape and not only on the repo detail, because the fleet row is where the verdict is read most.

#### Scenario: An unusable readiness file cannot make a repo readier
- **WHEN** a repo's readiness file is unusable and its five derivable checks report `ok`
- **THEN** the repo is not ready, because the advisory check's derived `never` blocks while the notice stands
- **AND** a repo cannot reach ready by making its own declarations unreadable.

#### Scenario: An advisory check that fails to evaluate blocks
- **WHEN** a check in the advisory set carries an evaluation error
- **THEN** the repo is not ready
- **AND** the exemption does not apply, because it covers a `never` and not a failure to evaluate.

#### Scenario: A warning does not hide readiness
- **WHEN** a repo has only `ok`, `warn`, and `na` results and no evaluation error
- **THEN** the repo is ready
- **AND** every warning and not-applicable reason remains visible.

#### Scenario: Missing or invalid assurance blocks readiness
- **WHEN** any non-exempt result is `fail`, `stale`, or `never`, or any result carries an evaluation error
- **THEN** the repo is not ready
- **AND** the individual blocking result remains the explanation.

#### Scenario: A repo with nothing applicable and nothing exempted is not ready
- **WHEN** every derivable check reports `na` and the advisory check reports its exempt derived `never`
- **THEN** the repo is not ready, because no check reported `ok` or `warn`
- **AND** no vacuous success is produced by exempting the only non-`na` result.

#### Scenario: An undeclared advisory check does not block readiness
- **WHEN** a repo's five derivable checks report `ok` and its advisory check reports a derived `never`
- **THEN** the repo is ready
- **AND** the advisory check keeps its position and its never-run state among the six.

#### Scenario: A measured never still blocks
- **WHEN** a derivable check observes its repo, finds no artifact, and reports `never`
- **THEN** the repo is not ready
- **AND** the advisory exemption does not apply to it, because the absence of the artifact is itself the observation.

#### Scenario: An expired advisory declaration blocks
- **WHEN** a repo declared its advisory check and the declaration has since expired
- **THEN** the result reports `stale` and the repo is not ready
- **AND** the advisory exemption does not apply, because it covers only a derived `never`.

#### Scenario: A declared failure on the advisory check blocks
- **WHEN** a repo declares its advisory check as `fail`
- **THEN** the repo is not ready
- **AND** the exemption does not apply, because it covers only `never` and a declared `fail` is an author's assertion that the check did not pass.

### Requirement: The Pen-Test Check Is A Declared-Only Slot

The `pen-test` check SHALL have no derived signal and SHALL report `never` unless
a repo declares it in tier B. A declaration whose `validUntil` has passed SHALL
report `stale`. The check SHALL remain visible and tool-agnostic: no tool name
appears in the surface.

`pen-test` SHALL be the check designated as having no derived signal, and its
undeclared `never` SHALL therefore be advisory rather than blocking. Without this
the readiness predicate would be a constant: no signal exists to move the check
off `never`, so every repo that has not declared a pen test would be permanently
not ready, and a verdict with one possible value reports nothing about the five
checks that do measure their repo.

The designation SHALL be recorded as an explicit, enumerated set rather than as a
condition written into the predicate's control flow, so that a further
declared-only check joins the set without a second rule.

Membership SHALL be constrained rather than conventional: a check in the set MUST
have no deriver capable of producing a status other than `never`. Because the set
is data, giving a check a derived signal does **not** remove it automatically, and
a member that acquired one would silently shrink the predicate.

The constraint SHALL be enforced structurally rather than by sampling behaviour. A
member's deriver SHALL be typed or declared so that `never` is the only status it
can return, and the guard SHALL be that declaration — not a test that invokes the
deriver and asserts what came back. Invocation cannot establish the property: a
deriver that returns `never` today and something else on a branch not taken
satisfies any finite number of calls while violating the requirement. A behavioural
test MAY accompany the structural constraint but SHALL NOT stand in for it.

#### Scenario: Membership is constrained structurally
- **WHEN** a check named in the advisory set has a deriver whose declared return admits a status other than `never`
- **THEN** the build fails on that declaration
- **AND** the failure does not depend on a test happening to exercise the branch that returns it.

#### Scenario: Undeclared pen-test is never run, not omitted
- **WHEN** a repo declares no pen-test result
- **THEN** the check reports `never` and keeps its position among the six
- **AND** its remedy text explains that the result is reported through the readiness file.

#### Scenario: The surface names no tool
- **WHEN** the pen-test check renders in any state
- **THEN** the label describes the check, not the tool that satisfies it.

#### Scenario: An undeclared pen test does not make its repo unready
- **WHEN** a repo has never declared a pen test and its other five checks are clear
- **THEN** the repo is ready while the pen-test check still reports `never`
- **AND** the verdict is capable of varying across the fleet rather than being fixed by this check.

#### Scenario: A declared pen test governs readiness normally
- **WHEN** a repo declares a pen-test result that is current
- **THEN** that declared status participates in readiness like any other result
- **AND** an expired declaration reports `stale` and blocks.

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

**A cited evidence path SHALL be verified as openable, and a citation that is not
SHALL make the whole readiness file unusable.** While validating tier B, every
declared entry's evidence path SHALL be resolved within the canonical repo root,
SHALL be confirmed to be a regular file within the evidence read bound, and SHALL
be opened rather than merely described — a path can stat cleanly and still be
unreadable. A citation that is absent, is not a regular file, exceeds the bound,
escapes the repository through a symlink, or cannot be opened SHALL invalidate the
file through the ordinary unusable-file path, and the repo's checks SHALL all fall
back to their derived values.

The blast radius is the whole file rather than the offending entry. This is
recorded as the **current behaviour and a known weakness**, not as a design this
requirement endorses. What justifies it is narrow: partial acceptance would leave
the surface reporting some declarations from a file the daemon had already judged
malformed. What argues against it is broader — one moved artifact silently
discards every unrelated declaration in the repo, and because discarded
declarations fall back to derived values, an unusable file can move a repo's
results in either direction. The predicate requirement therefore forbids the
advisory exemption while a file is unusable, so that this weakness cannot make a
repo report ready. Narrowing the radius to the offending entry is the better
long-term shape and is deliberately not done here.

A cited path SHALL be treated as disclosed, and a cited path inside the read
route's allow-list SHALL be treated as disclosing its **contents** too. Tier B
admits any path beneath the repo root, so an author may cite a sensitive file.
Two different exposures follow, and conflating them understates one of them:

- **Tier-B validation** opens each citation and discards the bytes, so it discloses
  the path only.
- **The surface** renders a citation inside the read route's allow-list as a link,
  and following it serves the file. For those paths the contents are disclosed, by
  design — that is what an evidence link is for.

Both are disclosures to an already-authenticated client of a local daemon, and the
path itself may carry meaning even when its contents are never served. Stated
rather than left implicit, because a requirement whose subject is trust properties
should not have an unstated one.

Verification establishes that the citation is real and reachable, and **nothing
about its contents**. The daemon does not read the cited artifact and could not
judge it if it did: a present file may be empty, superseded, or unrelated. No
surface SHALL present a verified path as evidence that the underlying assurance
was performed or that it says what the declaration claims. What is verified is the
citation, not the claim.

#### Scenario: An unopenable citation invalidates the file
- **WHEN** a declared entry cites an evidence path that is absent, is a directory, exceeds the read bound, or cannot be opened
- **THEN** the readiness file is unusable and reported through the existing notice path
- **AND** every check for that repo falls back to its derived value rather than some declarations being honoured.

#### Scenario: Citation validity is not content validity
- **WHEN** a declared entry cites an evidence path that opens successfully
- **THEN** the declared status is honoured and the citation is presented as what the author cited
- **AND** no surface asserts that the daemon confirmed the artifact substantiates the claim.

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

#### Scenario: Verification happens once, while the file is validated
- **WHEN** a repo's readiness file has been accepted as usable
- **THEN** its citations were verified during that validation
- **AND** assembling each check's result does not re-open the cited artifacts.

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
that resolves outside the canonical repo root is refused before it is opened.
This primitive admits an author-named path anywhere beneath the canonical
repo root and is distinct from the fixed subdirectory allow-list that governs the
project read route, so evidence may be cited where such artifacts live without
that allow-list being widened.

**Containment SHALL be understood as a property of the path at the moment it was
resolved, not as an atomic guarantee across resolution and open.** Validation
resolves, inspects, and opens in separate steps without an open-time
no-follow constraint or post-open revalidation, so a path substituted between those
steps can be opened after its predecessor was judged contained. This is stated
rather than implied because the earlier phrasing — that a path which *changes* to
an escaping symlink is refused — claimed more than the implementation delivers, and
a spec that overstates a containment guarantee is worse than one that bounds it.

The residual exposure SHALL be stated rather than characterised as bounded.
**Tier-B validation** discloses nothing from a raced artifact: it opens each
citation only to establish that it can be read and closes it without parsing, so no
raced content reaches a client through that path. The exposure is availability, and
it is not small: a substituted FIFO or device node can make the validating open
block indefinitely, and because fleet assembly awaits a result for every registered
repo without a per-repo time bound, one repo can withhold the whole fleet response.

**The per-repo degradation guarantee in the endpoints requirement SHALL therefore
be read as covering failure, not indefinite blocking.** A repo whose scan rejects
is replaced by an unscannable result and the fleet still answers; a repo whose scan
never settles has no such treatment, and the fleet does not answer at all. This is
a pre-existing property of the shared read path rather than something this change
introduces, and it is recorded here because the alternative is a spec that claims
isolation the implementation does not provide. Bounding the open — and with it
closing the substitution window — belongs to the shared read primitive and is out
of scope.

**Expiry and status-vocabulary restrictions differ per check by design.**
`validUntil` SHALL be carried only by `pen-test`, because a pen test is the only
check whose result decays against the calendar: the threat landscape moves under
unchanged code. Declared `code-review` and `security-review` entries decay against
the code they covered and carry a reviewed commit for that purpose, so an expiry
field would be a second, redundant decay model. Declared `workflow`, `spec`, and
`coverage` entries carry neither a commit nor an expiry and therefore **do not
age at all**: a declared value for these three holds until the author changes it.
This is stated because it is the weakest guarantee in tier B and a reader must not
infer from the other three that every declaration eventually goes stale. Giving
these three an expiry is not the fix — an expiry would turn a declaration stale
while both the code and the declared value were unchanged — and giving them
ancestry decay is a change to what tier B requires of an author, which this
requirement does not make.

Correspondingly, `pen-test` is the only check whose declared status
vocabulary is restricted, and it is restricted to exactly those values the daemon
derives for that slot rather than arbitrarily: `never` is how the slot reports the
absence of a declaration, `stale` is computed from `validUntil`, and `na` cannot
apply to a slot that applies to every repo. The other five checks accept the full
vocabulary as declarations because none of those three values is reserved for
them: a declared `never` on those checks is an assertion that the check has never
run, and SHALL block readiness accordingly.

**An author cannot presently assert "no penetration test has been performed" as a
blocking declaration, and this requirement SHALL NOT claim otherwise.** Declared
`pen-test: never` is invalid because `never` is reserved for the absence of a
declaration. Declared `fail` is not a substitute: it asserts that a test ran and
did not pass, and it requires an evidence path, a full commit SHA, and
`validUntil`, all mandatory — so an author with no test would have to cite an
artifact for an event that did not occur. The honest statement of the current
design is that an author who has not tested leaves the slot undeclared, which under
the advisory rule does **not** block.

This is a real gap and is recorded as one. Closing it means either permitting a
declared `never` for this slot — which collides with the reserved meaning that the
same restriction depends on — or an entry variant whose evidence fields are
optional for a non-passing status. Both change what tier B asks of an author, and
neither is decided here.

#### Scenario: A review claim is auditable
- **WHEN** a repo declares a code or security review result
- **THEN** the entry identifies its evidence path, observed time, and reviewed commit
- **AND** a missing or malformed field makes the readiness file unusable.

#### Scenario: Paths cannot escape the repo
- **WHEN** a configured artifact or evidence path is absolute, traverses above the repo, resolves through a symlink outside it, or exceeds its read bound
- **THEN** the readiness file is unusable
- **AND** no file outside the canonical repo root is read.

#### Scenario: A declared never on a derivable check blocks
- **WHEN** a repo declares `workflow`, `spec`, or `coverage` as `never`
- **THEN** the declaration is accepted and that repo is not ready
- **AND** the advisory exemption does not apply, because the exemption covers a derived `never` and this is an assertion.

#### Scenario: Expiry is carried by the calendar-decaying check alone
- **WHEN** a declared entry for a check other than `pen-test` carries `validUntil`
- **THEN** the field is unknown for that entry and the readiness file is unusable
- **AND** no check outside `pen-test` acquires a calendar expiry.

### Requirement: Readiness Endpoints Degrade Per Check And Per Repo

The daemon SHALL expose authenticated, CORS-locked `GET /api/v2/fleet`, `GET
/api/v2/repos/:id`, and `POST /api/v2/repos/:id/rescan` routes in the existing
Hono app, with no cookie-auth alternative. The bearer token is the authorization
boundary. The CORS allow-list governs what a browser will be permitted to read
and SHALL NOT be relied on to refuse a non-browser client, so the two read
routes SHALL serve a token-bearing request whatever its `Origin`. The
state-changing rescan route SHALL additionally check `Origin` in the daemon and
refuse a disallowed one with 403 before doing any work: the middleware governs
what a browser may read, the explicit check governs what the daemon will do.
Unknown repo identifiers SHALL return 404. A failure in one deriver MUST NOT remove other checks from that repo's
result, and a failure for one repo MUST NOT remove other repos from the fleet
result. Responses SHALL be validated against the shared schema before being sent
and returned in registry order without server-side sorting.

**The rescan route SHALL answer with the recomputed repo detail.** A successful
rescan SHALL return 200 carrying the same repo-detail shape the read route
returns for that repo, reflecting the recomputation the call performed, so that a
caller observes the result of its own rescan without a following read. It SHALL
return 404 for an unknown repo identifier and 403 for a disallowed origin,
using the same error shape as the read routes. Rescan SHALL NOT answer with an
acknowledgement that omits the new state.

Computed readiness SHALL be cached for no more than five seconds and invalidated
by relevant HEAD, the entire dirty/untracked working-tree state, readiness-file
state, machine-global workflow state, or registry membership. The invalidating
set is deliberately wider than the production-code subset the freshness rules
score: narrowing it would require parsing the readiness file to learn the
configured scope before the cache could be consulted, and over-invalidating errs
in the safe direction where under-invalidating does not. Concurrent rescans for the same repo SHALL be
coalesced into one computation.

**A rescan SHALL NOT be served from a computation that was permitted to replay the
cache.** Coalescing SHALL be scoped by whether a computation may use the cache, not
by arrival time. A request MAY join an in-flight computation only when that
computation is at least as forcing as itself: two rescans therefore still coalesce,
and a read still joins anything, while a rescan overlapping an in-flight read SHALL
NOT join it and SHALL instead cause a computation that may not replay the cache.

The distinction is what a joined computation was allowed to do, not when it
started. A second rescan joining an in-flight rescan necessarily observes work
begun before its own request, and that is correct — the computation it joined was
already forbidden to serve cache. A rescan joining a read is not, because the
read's computation may return cached state, and the rescan would then report
success having recomputed nothing.

Readiness data, including machine-global
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

#### Scenario: A rescan does not join an in-flight read
- **WHEN** a rescan for a repo is requested while a read for that same repo is still computing
- **THEN** the rescan recomputes rather than adopting the read's result
- **AND** it does not answer success on the strength of a computation that was permitted to serve cache.

#### Scenario: A rescan may join an in-flight rescan
- **WHEN** a rescan for a repo is requested while another rescan for that repo is still computing
- **THEN** the two share that one computation even though it began before the second request
- **AND** this does not violate the freshness rule, because the joined computation was itself forbidden to replay the cache.

#### Scenario: Rescan returns the state it computed
- **WHEN** a rescan succeeds
- **THEN** the response carries the recomputed repo detail in the same shape the read route returns
- **AND** a caller needs no following read to observe its own rescan.

#### Scenario: Rescan refuses an unknown repo and a disallowed origin alike
- **WHEN** rescan is called for an unregistered identifier, or from an origin outside the allow-list
- **THEN** it answers 404 or 403 respectively
- **AND** neither answer carries a repo-detail body.

#### Scenario: All routes inherit the trust boundary
- **WHEN** a readiness route is requested without a valid bearer token
- **THEN** it is refused before repository data is read
- **AND** no cookie-only authentication path is accepted.

#### Scenario: CORS does not stand in for authorization on the read routes
- **WHEN** a readiness read route is requested with a valid bearer token and an origin outside the allow-list
- **THEN** the response is served, because the origin allow-list binds browsers and not other clients
- **AND** the allow-list still denies the response to a browser page on that origin.

#### Scenario: The state-changing route checks the origin itself
- **WHEN** rescan is requested with a valid bearer token and an origin outside the allow-list
- **THEN** it is refused with 403 and no rescan is performed.

#### Scenario: A request carrying no origin is not refused by the origin check
- **WHEN** rescan is requested with a valid bearer token and no `Origin` header at all
- **THEN** the origin check does not refuse it, because the check exists to bind browsers and a request without an origin is not a browser page
- **AND** the bearer token remains the authorization boundary for it.

#### Scenario: The server does not sort
- **WHEN** the fleet endpoint returns
- **THEN** repos appear in registry order
- **AND** ordering by failure count is applied by the client.

### Requirement: The Fleet Surface Is One Row Per Repo

The fleet surface SHALL render one row per registered repo carrying its name, the
six checks, boolean readiness, any readiness-file notice, and its last-change
time. Selecting a row SHALL open that repo's
detail; selecting a cell SHALL open the same detail positioned at that check.
Filters SHALL be combinable and family SHALL be a filter rather than a grouping
level.

Where a row is ready while one or more advisory checks are undeclared, the
readiness verdict SHALL carry explicit wording naming every check the verdict
excludes. The wording SHALL be derived from the set of exempted checks rather than
written for a single named check, so that the set growing does not silently leave
a check undisclosed. The six check cells are already rendered per row, so their
presence SHALL NOT be treated as satisfying this: a reader who reads the verdict
and not the cells is exactly the reader this protects, and adjacency is not
disclosure. The qualification SHALL be available to assistive technology as part
of the verdict rather than conveyed only by the spatial relationship between the
verdict and a cell.

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

#### Scenario: A ready verdict says what it excludes
- **WHEN** a repo is ready and one or more advisory checks report an undeclared `never`
- **THEN** the verdict itself carries wording naming every excluded check
- **AND** rendering the six check cells beside the verdict does not by itself satisfy this.

#### Scenario: The disclosure follows the set rather than a fixed name
- **WHEN** the advisory set contains more than one check and both are undeclared on a ready repo
- **THEN** the verdict's wording names both
- **AND** no check is left undisclosed because the wording was written for a single check.
- **NOTE** the set has one member today, so this scenario is forward-pinning: it constrains how the wording is built rather than describing a reachable state, and is satisfied by deriving the wording from the set.

### Requirement: Repo Detail Shows Evidence And A Way Forward

The repo detail surface SHALL render the six checks as six blocks in the fixed
order on a single scrollable page, without tabs, modals, or drawers. Each block
SHALL state its status in words with a timestamp, name its provenance, present its
evidence — as a link through the existing project read route where that route will
serve the cited path, and as text where it will not — and, where the check has
never run, give a concrete instruction for making it run. No check's instruction
text may be empty. Evidence links SHALL use only validated repo identifiers and
repo-relative paths already accepted by that read route. The header SHALL render
the boolean readiness and any readiness-file notice.

Where the repo is ready and one or more advisory checks are undeclared, the header
SHALL state that the verdict excludes them, naming every such check. Each advisory
check's own block SHALL continue to give its never-run instruction, so the surface
says both that the repo is ready and what remains undeclared.

A cited evidence path that the project read route will not serve SHALL be rendered
as a non-actionable citation rather than as a link. Tier-B validation admits an
author-named path anywhere beneath the repo root, while the read route serves only
its fixed subdirectory allow-list, so a citation may be entirely valid and still
be unservable. Presenting it as a link would offer an action known in advance to
fail; presenting it as text keeps the audit trail — the reader still learns what
the author cited and can open it themselves.

Servability SHALL be decided by the shared allow-list predicate rather than by a
rule restated in the client, so that a later change to the allow-list moves the
route and the surface together. That predicate is a **conservative mirror, not the
route's own guard**: it answers from the path alone, while the route additionally
resolves symlinks and checks existence and file mode, and may still refuse a path
the mirror admits. The surface therefore uses it to avoid offering links that are
certainly dead, not to promise that the remaining links will succeed. A link that
fails when followed remains possible and SHALL NOT change any check's status,
provenance, or the repo's readiness. No field is added to the wire shape for this.

#### Scenario: Servability is decided by the shared predicate
- **WHEN** the surface decides whether to render a citation as a link
- **THEN** it evaluates the shared allow-list predicate rather than a rule written into the surface
- **AND** changing the allow-list changes both the route's behaviour and the surface's rendering without a second edit.

#### Scenario: A link the mirror admitted may still fail
- **WHEN** a citation passes the shared predicate but the read route refuses it on resolution, existence, or file mode
- **THEN** the link fails for that reader
- **AND** the check's status, its provenance, and the repo's readiness are unchanged.

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

#### Scenario: A ready header discloses what it excludes
- **WHEN** the detail header renders a ready verdict for a repo whose advisory check is undeclared
- **THEN** the header states that the verdict excludes that check
- **AND** the advisory check's block still carries its instruction for making it run.

#### Scenario: An unservable citation is shown but not offered as a link
- **WHEN** a declared entry cites an evidence path outside the subdirectories the project read route serves
- **THEN** the block names the cited path as text rather than as a link
- **AND** no action is offered that would fail when taken.
