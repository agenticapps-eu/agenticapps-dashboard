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

This clause SHALL be retained even though an unverifiable citation no longer
discards the file. Entry-level rejection closes that route locally, by giving the
rejected check an error-bearing result that blocks on its own; but the whole-file
modes that remain — an unsupported version, unparsable JSON, a malformed known
entry, a collapsing production scope — still discard every declaration, and the
suspension is what keeps those from being usable as a route to ready. Narrowing
the citation radius removes one entrant to this clause, not the need for it.

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

#### Scenario: A rejected citation cannot make a repo readier either
- **WHEN** a repo declares its advisory check with a citation that cannot be opened, and its five derivable checks report `ok`
- **THEN** the repo is not ready, because the rejected entry carries an evaluation error rather than falling back to a derived `never`
- **AND** the verdict does not depend on the notice for this case, because the blocking result is local to the check whose citation failed.

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

#### Scenario: A wholly not-applicable repo is not ready
- **WHEN** all six checks report `na`
- **THEN** the repo is not ready
- **AND** no vacuous success is produced.

#### Scenario: A repo with nothing applicable and nothing exempted is not ready
- **WHEN** every derivable check reports `na` and the advisory check reports its exempt derived `never`
- **THEN** the repo is not ready, because no check reported `ok` or `warn`
- **AND** no vacuous success is produced by exempting the only non-`na` result.

Both are reachable, and both are kept deliberately. The first became reachable
when `pen-test` gained a declared `na`: a repo may now report `na` on all six and
is not ready, which was previously a contract the predicate honoured but no input
could produce. It is no longer pinned as a pure-function property alone — it is
now a state a repo can actually be in, and the scenario is the stronger for it.
The second is the boundary the advisory exemption creates.

#### Scenario: An undeclared advisory check does not block readiness
- **WHEN** a repo's five derivable checks report `ok` and its advisory check reports a derived `never`
- **THEN** the repo is ready
- **AND** the advisory check keeps its position and its never-run state among the six.

#### Scenario: A measured never still blocks
- **WHEN** a derivable check observes its repo, finds no artifact, and reports `never`
- **THEN** the repo is not ready
- **AND** the advisory exemption does not apply to it, because the absence of the artifact is itself the observation.

#### Scenario: A declared never on the advisory check blocks
- **WHEN** a repo declares its advisory check as `never`
- **THEN** the repo is not ready
- **AND** the exemption does not apply, because it covers only a derived `never` and this is the author asserting the check has never run.

#### Scenario: An expired advisory declaration blocks
- **WHEN** a repo declared its advisory check and the declaration has since expired
- **THEN** the result reports `stale` and the repo is not ready
- **AND** the advisory exemption does not apply, because it covers only a derived `never`.

#### Scenario: A declared failure on the advisory check blocks
- **WHEN** a repo declares its advisory check as `fail`
- **THEN** the repo is not ready
- **AND** the exemption does not apply, because it covers only `never` and a declared `fail` is an author's assertion that the check did not pass.

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
SHALL reject its own entry rather than the whole file.** While validating tier B,
every declared entry's evidence path SHALL be resolved within the canonical repo
root, SHALL be confirmed to be a regular file within the evidence read bound, and
SHALL be opened rather than merely described — a path can stat cleanly and still be
unreadable. A citation that is absent, is not a regular file, exceeds the bound,
escapes the repository through a symlink, or cannot be opened SHALL reject the entry
that cites it. Every other declared entry in the same file SHALL be honoured.

**A rejected entry SHALL NOT fall back to its derived value.** Its check SHALL
report `fail` with `source: declared` and an evaluation error identifying the
citation as unverifiable. Falling back is the one outcome that must not happen
here: a declaration the daemon refused would become byte-identical to a
declaration that was never made, so an author's blocking assertion could be
erased by breaking the artifact it cites. Reporting the refusal as an
error-bearing `fail` blocks readiness through the predicate's existing
error clause, which makes the entry-level rejection self-sufficient — it does not
rely on the repo-level notice to reach the right verdict.

The repo SHALL still carry the unusable-file notice while any entry is rejected,
naming the rejected citation. The file is not wholly unusable, but it is not
correct either, and the author has something to fix. The notice is what carries
that to the surface.

The blast radius is the offending entry rather than the whole file. **This
narrows the previous behaviour**, under which one moved artifact silently
discarded every unrelated declaration in the repo, and — because discarded
declarations fell back to derived values — could move a repo's results in either
direction. The objection that justified the wider radius was that partial
acceptance would leave the surface reporting some declarations from a file the
daemon had already judged malformed. That objection is answered by not accepting
the rejected entry either: nothing from a refused citation is reported as
declared truth, and the refusal is visible on the check it belongs to. Whole-file
invalidation remains correct for malformations that make the file's *structure*
untrustworthy — an unsupported version, unparsable JSON, a malformed known entry —
because those give no reliable entry boundaries to narrow to.

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

#### Scenario: An unopenable citation rejects its own entry
- **WHEN** a declared entry cites an evidence path that is absent, is a directory, exceeds the read bound, or cannot be opened
- **THEN** that check reports `fail` with `source: declared` and an evaluation error naming the citation as unverifiable
- **AND** every other declared entry in the same file is still honoured.

#### Scenario: A rejected entry does not become an absent declaration
- **WHEN** a declared entry is rejected for an unverifiable citation
- **THEN** its check does not report the value the daemon would have derived
- **AND** a reader can tell that a declaration was made and refused, rather than never made.

#### Scenario: A rejected citation is still reported at the repo level
- **WHEN** any declared entry in a repo's readiness file is rejected for its citation
- **THEN** the repo carries the unusable-file notice naming that citation
- **AND** the notice is the author's signal that the file needs correcting even though it was not wholly discarded.

#### Scenario: Structural malformation still invalidates the whole file
- **WHEN** a readiness file declares an unsupported version, is unparsable, or carries a malformed known entry
- **THEN** the whole file is unusable and every check falls back to its derived value
- **AND** the narrowed citation radius does not extend to malformations that leave no trustworthy entry boundaries.

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

Every declared entry SHALL carry `observedAt` as an RFC 3339 timestamp, **except
an entry declaring a status that records the absence of an observation**. Declared
`code-review`, `security-review`, and substantiated `pen-test` entries SHALL also
carry a repo-relative evidence path and a full git commit SHA. A substantiated
declared `pen-test` entry SHALL carry `validUntil` as an RFC 3339 timestamp. All
strings and arrays SHALL have explicit size/count bounds.

Every configured or evidence path SHALL be repo-relative, SHALL remain beneath
the canonical repo root after symlink resolution, and SHALL be read with an
explicit file-size limit. Unknown check identifiers SHALL be ignored
entry-by-entry. Unknown top-level fields, unknown fields inside a recognised
entry, and any other malformed known entry SHALL invalidate the whole file.

**Where a path violation is caught determines what it costs, and the three
outcomes SHALL NOT be conflated.** A path that escapes *by its own shape* —
absolute, drive-lettered, or traversing — is a malformed field caught while
parsing, and invalidates the whole file. An *evidence* path that passes the shape
check but escapes or cannot be opened at resolution rejects the entry that cites
it. A *configured coverage artifact* path that escapes at resolution is refused by
the check that reads it, which reports an error-bearing `fail`; it does not make
the file unusable, because it is never verified during file validation. The
previous version of this requirement stated that configured and evidence paths
alike made the file unusable on a resolution-time escape, which was true of
neither: the coverage path was refused at read time and is still refused there.

**A declared `pen-test` entry SHALL take one of two variants, distinguished by
whether it records an observation.** A *substantiated* entry uses `ok`, `warn`, or
`fail` and SHALL carry `observedAt`, an evidence path, a commit SHA, and
`validUntil`. An *unsubstantiated* entry uses `never` or `na` and SHALL carry
none of those four fields; an entry declaring `na` SHALL carry a reason. `stale`
SHALL remain underivable by declaration, because it is computed from `validUntil`.

The fields SHALL be absent from the unsubstantiated variant rather than optional
across one merged entry shape. An optional field admits `pen-test: never` carrying
an evidence path and an expiry, which is a claim about a test that did not happen
and which the schema would then have to reject by a second rule. Two variants make
the invalid combination unstateable.

**This removes the reserved meaning of `never` for this slot, and the reservation
is replaced rather than dropped.** `never` previously distinguished "no
declaration" from anything an author could say; that distinction is now carried by
`source`, which every result already records. A derived `never` means no
declaration and is advisory; a declared `never` is the author asserting no test
has been performed, and blocks. The two are separable on the wire and on the
surface, which is what the reservation existed to guarantee.

`na` SHALL become valid for this slot. The prior reasoning — that `na` cannot
apply to a slot that applies to every repo — asserted a product judgement about
every repo that the daemon has no signal to support, and it is the author, not the
daemon, who knows whether a penetration test is meaningful for a given repository.
A declared `na` SHALL state its reason like any other, and SHALL be excluded from
the predicate like any other.

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
raced content reaches a client through that path. The substitution window itself
SHALL remain open — closing it belongs to the shared read primitive and is out of
scope — so a substituted FIFO or device node can still make a validating open block
indefinitely.

**What SHALL NOT follow from that is a withheld fleet response.** The availability
consequence is bounded at the endpoint rather than at the open: fleet assembly
carries a per-repo time bound, so a repo whose scan blocks indefinitely is reported
as unscannable and the fleet still answers. The exposure that remains is one repo's
readiness going unreported until the block clears, which is the same degradation a
rejecting repo already receives.

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

Correspondingly, `pen-test` remains the only check whose declared status
vocabulary is restricted, and the restriction is now narrow: `stale` alone is
excluded, because it is computed from `validUntil` rather than asserted. The other
five checks accept the full vocabulary as declarations, and a declared `never` on
those checks is an assertion that the check has never run and SHALL block
readiness accordingly.

**An author SHALL be able to assert "no penetration test has been performed" as a
blocking declaration.** This closes a gap the previous version of this requirement
recorded and did not resolve: an author with no test could neither declare `never`,
which was reserved, nor `fail`, which asserts a test ran and demanded an evidence
path, a commit SHA, and `validUntil` for an event that did not occur. Leaving the
slot undeclared was the only honest option and did not block, so the file could not
express a known, accepted gap. The unsubstantiated variant is that expression.

#### Scenario: A review claim is auditable
- **WHEN** a repo declares a code or security review result
- **THEN** the entry identifies its evidence path, observed time, and reviewed commit
- **AND** a missing or malformed field makes the readiness file unusable.

#### Scenario: A path that escapes by its own shape invalidates the file
- **WHEN** a configured artifact or evidence path is absolute, carries a drive letter, or traverses above the repo
- **THEN** the readiness file is unusable, because the violation is a malformed field caught while parsing rather than a citation that failed verification
- **AND** no file outside the canonical repo root is read.

#### Scenario: A configured coverage path that escapes at resolution fails its own check
- **WHEN** the configured coverage artifact path resolves through a symlink outside the repo or exceeds its read bound
- **THEN** the coverage check reports an error-bearing `fail` naming the refusal, and the readiness file stays usable
- **AND** no file outside the canonical repo root is read.

#### Scenario: An evidence path that escapes at resolution rejects its entry
- **WHEN** a declared entry's evidence path resolves through a symlink outside the repo or exceeds its read bound
- **THEN** that entry is rejected and its check reports an error-bearing declared `fail`
- **AND** no file outside the canonical repo root is read.

#### Scenario: A declared never on a derivable check blocks
- **WHEN** a repo declares `workflow`, `spec`, or `coverage` as `never`
- **THEN** the declaration is accepted and that repo is not ready
- **AND** the advisory exemption does not apply, because the exemption covers a derived `never` and this is an assertion.

#### Scenario: An author declares that no penetration test has been performed
- **WHEN** a repo declares `pen-test` as `never` with no evidence path, commit, expiry, or observed time
- **THEN** the entry is valid, the check reports `never` marked `declared`, and the repo is not ready
- **AND** the author has stated a known gap rather than leaving the slot silent.

#### Scenario: An unsubstantiated pen-test entry cannot carry evidence
- **WHEN** a declared `pen-test` entry uses `never` or `na` and also carries an evidence path, a commit, `validUntil`, or `observedAt`
- **THEN** the entry is malformed and the readiness file is unusable
- **AND** the invalid combination is unstateable rather than rejected by a second rule.

#### Scenario: A declared not-applicable pen test states its reason
- **WHEN** a repo declares `pen-test` as `na` with a reason
- **THEN** the check reports `na` marked `declared` and is excluded from the predicate
- **AND** a repo whose every check is `na` is still not ready, because nothing is applicable.

#### Scenario: A declared stale pen test is refused
- **WHEN** a declared `pen-test` entry states `stale`
- **THEN** the entry is malformed and the readiness file is unusable
- **AND** staleness remains computed from `validUntil` rather than asserted.

#### Scenario: Expiry is carried by the calendar-decaying check alone
- **WHEN** a declared entry for a check other than `pen-test` carries `validUntil`
- **THEN** the field is unknown for that entry and the readiness file is unusable
- **AND** no check outside `pen-test` acquires a calendar expiry.

### Requirement: The Pen-Test Check Is A Declared-Only Slot

The `pen-test` check SHALL have no derived signal and SHALL report a derived
`never` unless a repo declares it in tier B. A declaration whose `validUntil` has
passed SHALL report `stale`. The check SHALL remain visible and tool-agnostic: no
tool name appears in the surface.

**The slot's `never` SHALL be readable as two distinct states through `source`.**
A derived `never` records that the daemon had nothing to observe and no author
spoke; a declared `never` records that the author asserts no test has been
performed. They render the same shape and status but differ in the verdict: the
first is advisory, the second blocks. Any surface that explains the verdict SHALL
be able to tell them apart, because "nobody has said" and "we have said no" are
different facts about a repo and only the second is an assertion.

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

The constraint governs the *deriver* and SHALL NOT be read as a constraint on the
check's declared vocabulary. A member may accept any declared status its tier-B
variant admits; what membership fixes is that the daemon itself can observe
nothing for it.

#### Scenario: Membership is constrained structurally
- **WHEN** a check named in the advisory set has a deriver whose declared return admits a status other than `never`
- **THEN** the build fails on that declaration
- **AND** the failure does not depend on a test happening to exercise the branch that returns it.

#### Scenario: Undeclared pen-test is never run, not omitted
- **WHEN** a repo declares no pen-test result
- **THEN** the check reports a derived `never` and keeps its position among the six
- **AND** its remedy text explains that the result is reported through the readiness file.

#### Scenario: A derived never and a declared never are distinguishable
- **WHEN** one repo leaves `pen-test` undeclared and another declares it `never`
- **THEN** both checks report `never`, the first marked `derived` and the second `declared`
- **AND** the first repo may still be ready while the second is not.

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

**The per-repo degradation guarantee SHALL cover a scan that never settles, not
only one that rejects.** Fleet assembly SHALL apply a finite time bound to each
repo's scan and to the fleet-wide signature it computes first. A repo whose scan
exceeds its bound SHALL be reported as unscannable — the same six error-bearing
`fail` results a rejecting repo receives — and the fleet response SHALL still
carry every other repo. The endpoint SHALL answer within a bounded time whatever
any single repository does.

This closes a gap the previous version of this requirement recorded: awaiting
every repo's result without a time bound meant that a scan which merely rejected
was isolated while a scan which blocked indefinitely withheld the entire
response. The distinction was invisible to a reader of the guarantee and
indefensible to a user of the endpoint, for whom no answer is worse than a
degraded one. The bound SHALL exceed the subprocess timeouts already applied
within a scan, so that a slow-but-progressing repo is reported rather than cut
off; a repo reported unscannable on timeout is therefore genuinely stuck, not
merely large.

A timed-out scan SHALL NOT be cached as a result. The bound governs how long the
endpoint waits, not what the repo is: recording an expiry as a snapshot would let
one transient block suppress a repo for the memo's lifetime even after the block
cleared.

**A computation that has exceeded its bound SHALL nonetheless remain the one
in-flight computation for its repo, and later requests SHALL join it rather than
starting another.** A repo whose scan is genuinely blocked therefore continues to
report unscannable until the block clears, at which point the joined computation
settles and the repo recovers on its own. This is deliberate and is the reason
the bound is safe to make short: abandoning the computation instead would start a
fresh scan on every poll, and since a blocked filesystem call cannot be
cancelled, each would block in turn — converting one stuck repo into an unbounded
accumulation of stuck work. Coalescing is what keeps the cost at one blocked
computation per repo however often the endpoint is called.

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

#### Scenario: One hung repo does not withhold the fleet
- **WHEN** the fleet endpoint is called and one registered repo's scan blocks past its time bound
- **THEN** the response still answers, carrying every other repo
- **AND** the blocked repo appears as unscannable in the same shape a rejecting repo receives.

#### Scenario: A blocking fleet signature does not withhold the fleet
- **WHEN** computing the fleet-wide signature blocks past its time bound
- **THEN** the endpoint still answers rather than waiting indefinitely before any repo is scanned
- **AND** the bound covers the work that precedes per-repo assembly, not only the per-repo scans.

#### Scenario: A timed-out scan is not remembered as a result
- **WHEN** a repo's scan exceeds its time bound, the block later clears, and a further request arrives for that repo
- **THEN** that request reports the repo's real readiness rather than replaying the timeout
- **AND** the expiry was never recorded as a snapshot.

#### Scenario: Repeated requests do not multiply a blocked scan
- **WHEN** the fleet endpoint is called repeatedly while one repo's scan remains blocked
- **THEN** those requests join the one computation already in flight for that repo rather than each starting another
- **AND** the cost of a stuck repo stays at one blocked computation however often the endpoint is polled.

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
