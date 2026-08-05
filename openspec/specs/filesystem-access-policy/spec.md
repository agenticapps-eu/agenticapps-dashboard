# filesystem-access-policy Specification

## Purpose

This capability is the dashboard's security spine. The daemon runs on a
developer's machine with that developer's full filesystem privileges, and it
serves a browser SPA over HTTP. Everything that keeps that arrangement safe lives
here: the daemon is **read-only on every registered project's filesystem**, every
path it will resolve is **allow-listed**, and every file it writes lives under
`~/.agenticapps/dashboard/` at restrictive modes.

These constraints are not implementation preferences. They are the reason the
product is acceptable to run at all, and they survive every refactor. Source:
`docs/spec/dashboard-prompt.md` §"Constraints I want preserved no matter what"
and §"Anti-features"; invariants INV-01 and INV-02 held across every phase.
## Requirements
### Requirement: Read-Only On Project Filesystems

The daemon itself SHALL NOT write to, create, delete, or modify any file under a
registered project's root.

Process creation is separately enumerated. The daemon SHALL spawn a process only
through one of the following, and no further spawning surface may be introduced
without amending this requirement:

1. `POST /api/projects/{id}/open`, which spawns `$EDITOR` per explicit user click.
2. `GET /api/projects/{id}/git`, bounded by the git command allow-list below.
3. The OpenSpec reader's use of the `openspec` binary, bounded by its own argv
   discipline.
4. The workflow conformance harness runner, bounded by
   `workflow-fleet-conformance`.

Items 1 and 4 run foreign programs the daemon does not control. For those, the
daemon SHALL guarantee only what it can enforce at the spawn boundary — the
program invoked, its arguments, its working directory, its resource bounds, and
its termination. It SHALL NOT assert what the spawned program does to the
filesystem, because it cannot.

#### Scenario: A read route never mutates the project
- **WHEN** any project-scoped read route is called
- **THEN** the project's working tree is byte-identical before and after
- **AND** no file under the project root is created, truncated, or removed.

#### Scenario: The editor exception writes nothing itself
- **WHEN** `POST /api/projects/{id}/open` is called with a path
- **THEN** the daemon spawns `$EDITOR` against that path and returns 200 immediately
- **AND** the daemon itself performs no write; any subsequent change is the user's own editor action.

#### Scenario: The harness is spawned under a constrained working directory
- **WHEN** a conformance harness is executed at explicit user request
- **THEN** the daemon sets its working directory to a scratch directory under the daemon's own directory, outside every registered project root
- **AND** the guarantee recorded is that the daemon spawned it so constrained, not that the script confined itself.

#### Scenario: The spawn enumeration is exhaustive
- **WHEN** the daemon's route and library surface is inspected for process creation
- **THEN** every site is one of the four enumerated above
- **AND** a fifth site is a violation of this requirement rather than an undocumented detail.

### Requirement: Per-Project Path Allow-List

`GET /api/projects/{id}/read` SHALL resolve the requested path against the
project root and MUST reject it unless the resolved real path lies under
`<root>/.planning`, `<root>/.claude`, or `<root>/openspec`. Paths containing `..`, absolute paths,
and paths whose realpath escapes the allow-list MUST be rejected.

`<root>/.planning` remains allow-listed after the GSD phase reader is retired,
and is load-bearing rather than residual. Two readers keep it alive, and they
read **different subtrees**, so neither can be retired by removing the other:

- `.planning/skill-observations/` — read by the commitment, observations and
  discipline routes.
- `.planning/phases/<slug>/multi-ai-review-skipped` — read by the
  override-sentinel scanner, which serves `fleet-coverage`'s
  `Review-Override Visibility`.

What stops being read is the phase **artifacts** under `.planning/phases/` — the
plans, review files and verification files the retired reader parsed. The
directory itself is still read, for the sentinel above. A later change that
removes this allow-list entry MUST relocate both readers first.

`<root>/openspec` carries proposals, task lists, spec deltas, and multi-vendor
review prose, and this route makes them readable to any client holding the bearer
token. That exposure is **accepted, not overlooked**, and the equivalence it
rests on is stated rather than assumed. The content is: design rationale,
requirement text, task checklists, and adversarial reviewer commentary on the
project's own plans. `.planning` has been allow-listed since the first release
and carried the same four kinds — GSD-era phase plans, `*-REVIEW.md`,
`*-SECURITY.md`, and research notes — including multi-AI review output under
ADR-0018. The categories match one for one, which is the ground for treating this
as no new class rather than an assertion of it. What both trees can carry is
whatever a project's own planning documents carry; the route's bounds —
authenticated, project-scoped, read-only, realpath-checked, and size-capped
below — are what contain that, and they are unchanged.

Reads through this route SHALL be bounded by a maximum file size, and a file
exceeding it MUST be refused with an explicit too-large response — a distinct
status the SPA can render as such — rather than streamed, truncated, or returned
as a generic error. The size MUST be checked before the file is read into memory,
not after. This closes a gap that predates `openspec/` and applies to all three
allow-listed directories equally: without it, any file a user can place in a
registered project can be turned into unbounded daemon memory and response bytes.

Every bound in this capability — this size limit, and the CLI timeout and output
cap below — MUST be a single named constant with a documented default, declared
in one place in the daemon and referenced everywhere else. Each MUST be finite:
no bound may be disabled by configuration, and a configured value that does not
parse falls back to the default rather than to unbounded. Concrete values are an
implementation choice and are not fixed here, in keeping with the rest of these
specs; that they exist, are finite, and are declared once is not.

#### Scenario: Traversal outside the allow-list is rejected
- **WHEN** a read is requested for `../../.ssh/id_rsa`, for an absolute path, or for a symlink whose realpath resolves outside `<root>/.planning`, `<root>/.claude`, and `<root>/openspec`
- **THEN** the daemon rejects the request rather than returning file content
- **AND** no file outside the allow-list is opened.

#### Scenario: An allow-listed read succeeds
- **WHEN** a read is requested for a path under `<root>/.planning/`, `<root>/.claude/`, or `<root>/openspec/`
- **THEN** the daemon returns `{ content, mtime, sha256 }` for that file.

#### Scenario: An oversized allow-listed file is refused
- **WHEN** a read is requested for a file under an allow-listed directory whose size exceeds the maximum
- **THEN** the daemon refuses it with an explicit too-large response
- **AND** the file's content is neither streamed nor truncated into a successful response.

### Requirement: A Containment Anchor Is Verified Against Its Registered Root

A reader that derives a containment boundary from a path that lies inside a
repository root SHALL verify that boundary against the realpath of that
repository root before using it, whether the boundary is resolved once and
reused or re-derived on every call. A boundary that does not lie at, or under,
the realpath of the repository root SHALL NOT be used as a containment boundary,
and nothing reachable only through it SHALL be read.

"Repository root" here means any repository root the daemon reads under, whether
it came from the project registry or was discovered beneath a named scanner root.
The rule follows from the boundary being derived, not from how the repository was
found, so a discovered repository is governed exactly as a registered one is.

Verification SHALL fail closed. Where the realpath of the repository root cannot
be obtained, the reader SHALL refuse rather than fall back to comparing
unresolved paths, because a boundary compared against an unverified root has not
been verified at all.

What matters is that the boundary was **derived** from a path that can leave the
root. Caching is not what makes this rule apply, and a reader that re-resolves
the boundary on each request escapes exactly as far as one that resolved it once.

This is stated separately from `Per-Project Path Allow-List` because it is a
distinct failure: that requirement governs paths checked **against** an anchor,
and is satisfied by a reader whose anchor is itself wrong. Resolving
`<root>/openspec` through a symlink and then admitting everything under the
target passes every per-path check, because each path really does lie under the
boundary the reader adopted. The boundary is the thing that escaped, so the
boundary is what has to be checked.

The repository-scoped anchor is the registered root itself. A symlink **under**
an allow-listed directory remains governed by `Per-Project Path Allow-List`; this
requirement governs the allow-listed directory **being** a symlink, and equally
any further directory derived from one and then used as a boundary in its own
right.

Refusal takes the shape of the reader, and in every shape what is withheld is
the data reachable through the escaped boundary — never necessarily the
repository's entire presence in the output. A reader that aggregates records
SHALL contribute nothing *read through* the escaped boundary, and MAY still
report the repository in a degraded state so the failure is visible rather than
silent. A reader that resolves a single requested path SHALL refuse that path
with its established path-refusal response, and SHALL NOT acquire a new
whole-repository failure mode: paths that do not depend on the escaped boundary
remain readable.

Where a reader is given several candidate boundaries, they are alternatives: a
path admitted by any one of them is admitted. Listing a correctly-anchored
boundary alongside an escaped one therefore SHALL NOT be treated as mitigating
the escaped one.

Anchoring narrows, and SHALL NOT be widened by ambient authority. Where a reader
holds standing permission to read outside the repository — the named scanner
roots of `Named Allowed Roots For Fleet Scanners` — that permission SHALL NOT
apply to a read that has been anchored to a repository root. Otherwise the anchor
is defeated whenever the escaped boundary's target happens to lie under one of
those standing roots, which is the common case rather than the exotic one.
Readers that have not anchored a read keep that standing permission unchanged.

#### Scenario: An allow-listed directory that is itself a symlink is refused
- **WHEN** a registered repository's `openspec` entry is a symlink whose target lies outside the realpath of that repository's root
- **THEN** the reader admits no records reached through that entry
- **AND** no file under the symlink's target is opened
- **AND** the repository's failure is reported through the symbolic vocabulary, never as a path.

#### Scenario: An allow-listed directory symlinked within its own root is admitted
- **WHEN** a registered repository's `openspec` entry is a symlink whose target lies under the realpath of that same repository's root
- **THEN** the anchor is accepted, because it has not left the registered root
- **AND** the repository's records are read normally.

#### Scenario: A real allow-listed directory is unaffected
- **WHEN** a registered repository's `openspec` entry is an ordinary directory
- **THEN** the anchor check passes without additional filesystem work beyond resolving the root once
- **AND** the reader's existing per-path containment checks continue to govern every read beneath it.

#### Scenario: A file read through an escaping allow-listed directory is refused
- **WHEN** a file read is requested for a path under a registered project's allow-listed directory, and that directory is a symlink whose target lies outside the realpath of the project root
- **THEN** the read is refused with the same path-refusal response the daemon already gives a path outside the allow-list
- **AND** the file's content does not appear in any response
- **AND** the project remains readable for paths that do not depend on the escaped boundary.

#### Scenario: An escaping allow-listed directory is not handed to a foreign process
- **WHEN** an open request names a path under an allow-listed directory that is a symlink whose target lies outside the realpath of the project root
- **THEN** the request is refused
- **AND** no path under the symlink's target is passed to the editor process.

#### Scenario: A boundary derived from an allow-listed directory is anchored too
- **WHEN** a reader derives a further boundary from a directory inside a registered repository, and any component of that derivation is a symlink leading outside the realpath of the repository root
- **THEN** the derived boundary is refused rather than adopted
- **AND** no file under it is read, even where its name and extension would otherwise be permitted.

#### Scenario: Pairing an escaped boundary with the registered root does not admit it
- **WHEN** a reader offers both an escaped derived boundary and the repository's own root as candidate boundaries for the same read
- **THEN** a path that lies under the escaped boundary only is still refused
- **AND** the presence of the correctly-anchored candidate does not widen what is admitted.

#### Scenario: A standing scanner root does not rescue an anchored read
- **WHEN** a read has been anchored to a repository root, and the escaped boundary's target lies under one of the named scanner roots the reader may otherwise read
- **THEN** the read is refused, because the standing permission does not apply to an anchored read
- **AND** a reader performing the same read without an anchor retains that standing permission unchanged.

#### Scenario: An unverifiable repository root refuses rather than guesses
- **WHEN** the realpath of the repository root a read is anchored to cannot be obtained
- **THEN** the read is refused
- **AND** no comparison against an unresolved form of that root is used to admit it.

#### Scenario: An unverifiable derived boundary is discarded, not approximated
- **WHEN** a read is anchored to a repository root and one of its candidate boundaries cannot be resolved to a realpath
- **THEN** that boundary is discarded rather than compared in an unresolved form
- **AND** the read is refused if no resolvable, anchored boundary remains.

#### Scenario: A boundary is verified before the directory beneath it is listed
- **WHEN** a reader enumerates the contents of a directory it treats as a containment boundary, and that directory is a symlink whose target lies outside the realpath of the repository root
- **THEN** the directory is not enumerated
- **AND** no name read from the target appears in the reader's output, because names are themselves content.

#### Scenario: An escaping boundary aimed at another permitted repository is still refused
- **WHEN** an anchored read's boundary is a symlink from one repository into a *different* repository that the reader would otherwise be permitted to read
- **THEN** the read is refused, because the boundary has left the repository it was anchored to
- **AND** being a legitimate location for some other reader does not make it a legitimate boundary for this one.

### Requirement: Containment Intent Is Declared At Every Resolution Site

Every site that supplies a containment boundary to a path resolver SHALL declare
which containment case that boundary is in. A site SHALL NOT be able to leave
the declaration unmade: an undeclared boundary SHALL fail the build rather than
be admitted under a default.

This is stated separately from `A Containment Anchor Is Verified Against Its
Registered Root` because it governs a different failure. That requirement says
what a verified boundary is, and is satisfied by a reader that verifies the
boundaries it thought to verify. This one says *no reader may decline to answer
the question*. A boundary nobody considered and a boundary considered and
correctly left unanchored are indistinguishable when both are written as
silence, so silence SHALL NOT be available as a way of writing either.

Three cases exhaust the declarations, and they are distinct claims:

- A boundary **derived** from a path inside a repository, which SHALL be
  anchored to that repository root and is governed entirely by `A Containment
  Anchor Is Verified Against Its Registered Root`.
- A boundary that **is** a repository root, where anchoring would be an identity.
- A boundary that is a **daemon-named root** lying outside every repository.
  These are the named roots of `Named Allowed Roots For Fleet Scanners`, and
  they are of two kinds: the machine roots that are installed to rather than
  checked out, and the family roots, which **contain** repositories rather than
  being one. A caller supplying a family root is not supplying a repository
  root and SHALL NOT declare it as one.

Neither of the two unanchored declarations narrows a resolver's **standing**
roots. Where a resolver is constructed with roots of its own, a read declared
`repository-root` or `daemon-named` continues to be admitted under those
standing roots as well as under the supplied one, exactly as it is today. That
reach is granted by `Named Allowed Roots For Fleet Scanners` and is neither
created nor removed by a declaration; only an anchored read excludes it, which
is what `A Containment Anchor Is Verified Against Its Registered Root` already
requires. A declaration SHALL NOT be read as a claim that the resolution is
confined to the boundary it names.

The daemon-named case SHALL record why the read is not anchored to a repository
root. It is the case in which a caller **supplies** a boundary outside every
repository, and the justification is otherwise unavailable to whoever next reads
that code. A recorded reason SHALL be non-empty, and the daemon-named case SHALL
identify which named root it is claiming, drawn from an **enumerated set of
named-root identifiers** — covering both kinds above — rather than from free
text. A declaration that could name any root whatever, justified by any string
whatever, would be an unbounded exemption from anchoring wearing the appearance
of a decision.

What the enumeration bounds is the **identifier**, not the directory. Nothing
requires the supplied boundary to be the root that the identifier names, and no
resolver can require it: the identifier-to-directory mapping is caller-side and
deliberately overridable, so a resolver has nothing to check against without
being handed the registry it is meant to be independent of. A declaration
pairing a valid identifier with some other directory is therefore well-formed
and false, and is governed by the presence-not-truth rule below rather than
detected here. The reason string is likewise checked for presence only.

**What this requirement enforces is the presence of a declaration, not its
truth.** A declaration naming the wrong case SHALL NOT be treated as satisfying
the anchoring requirement: a derived boundary declared as a repository root
remains a derived boundary, and remains governed by `A Containment Anchor Is
Verified Against Its Registered Root`. Nothing in this requirement detects such
a misdeclaration, and it SHALL NOT be relied on to. Boundaries already anchored
under that requirement SHALL be protected against silent reclassification by
regression coverage, which is the enforceable part of this concern.

The same limit applies to every other truth-claim in this requirement, including
the prohibition on declaring a container of repositories as a repository root.
Those prohibitions state which declaration is *correct* for a boundary; none of
them is detected at the resolver, and a requirement whose other clauses are
build-checked SHALL NOT be read as build-checking these.

**A helper that relays a resolver SHALL relay the classification with it.** A
helper standing between a call site and a resolver SHALL accept the containment
declaration as a parameter and pass it through unchanged, and SHALL NOT
synthesise one of its own. One helper can serve boundaries in different cases —
a repository root on one call and a named root outside every repository on
another — so a helper that chooses a classification decides it for callers whose
boundary it cannot see, which reintroduces the misdeclaration this requirement
exists to make visible, one layer above where anyone would look for it. This
obligation is on the relaying helper, not on the resolver, which cannot tell a
relayed declaration from a first-hand one.

Declaring a case SHALL NOT change what a site admits. The declaration records a
classification that already governs the read, so a site whose admitted or
refused paths move when its declaration is written down was misclassified, and
the misclassification is the finding rather than an accepted cost.

The roots supplied in a single resolution SHALL share one classification. A site
needing two classifications SHALL be split into two resolutions rather than
declaring one for a mixed set. Roots of different **provenance** do not by
themselves need two classifications: where a derived boundary and the repository
root it derives from are supplied together, both are required to lie under that
same repository root, so the resolution has one honest classification and one of
its roots merely coincides with the anchor. What forces a split is two roots
requiring **different anchors**. Because supplied roots are alternatives — a path
admitted by any one of them is admitted, and what is returned is the resolved
candidate rather than the root that matched — a split preserves admission
exactly when the results are recombined as alternatives: the path is admitted if
any of the split resolutions admits it, and refused only if all of them refuse.
A split SHALL NOT be treated as preserving admission if it is recombined in any
other way.

#### Scope

This requirement governs boundaries **supplied by a caller** to a path resolver.
It does not govern a resolver that anchors unconditionally without a
caller-supplied boundary, nor the standing roots a resolver is constructed with,
which remain governed by `Named Allowed Roots For Fleet Scanners`.

#### Scenario: A resolution site that declares no containment case does not build

- **WHEN** a caller supplies a containment boundary without declaring which case applies
- **THEN** the build fails at that site
- **AND** the failure names the site, so the set of undeclared sites is enumerable by building rather than by searching for a property name.

#### Scenario: A read outside every repository states why it is not anchored

- **WHEN** a site supplies a daemon-named root that lies outside every repository root
- **THEN** the site records the condition that makes anchoring that root wrong
- **AND** the recorded reason is discoverable from the resolution site itself, not only from an archived design document.

#### Scenario: The daemon-named case cannot name an arbitrary root identifier

- **WHEN** a site declares daemon-named with an identifier that is not one of the enumerated named roots
- **THEN** the declaration is rejected rather than admitted on the strength of its accompanying text
- **AND** an empty or blank reason is likewise rejected, so the record cannot be satisfied by supplying nothing
- **AND** a valid identifier paired with a directory that is not the root it names is **not** rejected, because that pairing is not checkable at the resolver; it is a misdeclaration, governed as one.

#### Scenario: A helper relaying a resolver relays the declaration

- **WHEN** a helper stands between a resolution site and a resolver, and is called for boundaries in more than one containment case
- **THEN** the helper takes the declaration as a parameter and passes it through unchanged
- **AND** a helper that synthesises a classification instead is a defect of this requirement, even where every resolution it performs is well-formed.

#### Scenario: A misdeclared derived boundary is still governed by the anchoring requirement

- **WHEN** a boundary derived from a path inside a repository is declared as a repository root or as a daemon-named root
- **THEN** the declaration does not exempt it from `A Containment Anchor Is Verified Against Its Registered Root`
- **AND** the declaration requirement is not claimed to have detected the misdeclaration, because it enforces presence and not truth.

#### Scenario: A covered anchored boundary cannot be silently reclassified

- **WHEN** a boundary named by the anchoring regression coverage is changed to any other declaration
- **THEN** that coverage fails
- **AND** the anchoring it relies on cannot be removed by relabelling alone.

#### Scenario: A newly anchored boundary joins the regression coverage

- **WHEN** a boundary is newly anchored to a repository root
- **THEN** it is added to the anchoring regression coverage as part of anchoring it
- **AND** the coverage's protection is not claimed for boundaries it does not name.

#### Scenario: Declaring an existing site does not change what it admits

- **WHEN** an existing resolution site gains an explicit declaration matching the case it was already in
- **THEN** the paths it admits and refuses are unchanged
- **AND** any observed difference is treated as evidence that the site was misclassified, not as an accepted consequence of declaring it.

#### Scenario: A resolution needing two anchors is split rather than declared

- **WHEN** one resolution would supply two roots that require different anchors
- **THEN** it is split into two resolutions, each declaring its own case
- **AND** no single declaration is applied to a set of roots that do not share it.

#### Scenario: Roots of different provenance under one anchor are not split

- **WHEN** one resolution supplies a boundary derived from inside a repository together with the repository root it derives from
- **THEN** the resolution declares the single anchored case naming that repository root
- **AND** the coincidence of one root with the anchor is not treated as a second classification requiring a split.

### Requirement: Named Allowed Roots For Fleet Scanners

Filesystem reads outside a registered project's root SHALL be performed only by
daemon-side dedicated scanners against explicitly named allowed roots, never
through the project-scoped `/read` route. The named roots SHALL be the configured
source families, the machine-wide AgenticApps binary directory, and the
configured machine-global skill directory for each host that installs skills
outside repositories. `~/.gitnexus` is not a named root. This root set takes
effect in the same atomic release that removes the GitNexus dashboard scanner;
that removal is a hard deployment dependency. The SPA MUST NOT name any external filesystem
path; it names a fixed repo, host, or family identifier, and the daemon resolves
it.

Every external read path SHALL be canonicalised with symlinks resolved and
verified to remain under one of the named roots before it is opened. Error and
response fields SHALL use symbolic root and artifact identifiers, never absolute
paths.

#### Scenario: Fleet scans do not widen the project read route
- **WHEN** a fleet-level scanner reads outside a registered project root
- **THEN** the read goes through a dedicated scanner code path with its own allowed-root list
- **AND** `/api/projects/{id}/read` remains constrained to `.planning/`, `.claude/`, and `openspec/` and cannot reach it.

#### Scenario: The machine-wide binary directory is read-only and named
- **WHEN** the workflow scanner reads the machine-wide AgenticApps binary directory
- **THEN** that directory is one of the scanner's named allowed roots
- **AND** the scanner only reads from it, never writing or executing through this path.

#### Scenario: Per-host global skill roots are named separately
- **WHEN** a host installs executable skills in its own machine-global directory
- **THEN** that configured directory is a named read-only scanner root for that host
- **AND** another host's directory is not substituted for it.

#### Scenario: The retired GitNexus root is no longer authorised
- **WHEN** the GitNexus dashboard integration has been removed
- **THEN** `~/.gitnexus` is absent from the scanner allowed-root set
- **AND** no daemon scanner reads its registry or repository data.

#### Scenario: A path outside every named root is refused
- **WHEN** a scanner is asked to resolve a path under no named allowed root
- **THEN** the read is refused
- **AND** no file outside the named roots is opened.

#### Scenario: A symlink cannot escape a named read root
- **WHEN** a path lexically inside a named root resolves through a symlink outside every named root
- **THEN** the read is refused on the canonical path
- **AND** no outside file is opened.

#### Scenario: External paths are not exposed
- **WHEN** a fleet scanner returns a result or error about a machine-global artifact
- **THEN** the response uses host, root, and artifact identifiers
- **AND** no absolute filesystem path appears.

#### Scenario: The SPA never supplies a filesystem path
- **WHEN** the SPA requests fleet data or triggers a scoped refresh
- **THEN** it identifies the target by family and repo identifier
- **AND** the daemon maps that identifier to a path itself.

### Requirement: Git Command Allow-List

`GET /api/projects/{id}/git` SHALL accept only an allow-listed command from
`{log, status, diff-stat, branch}` with allow-listed arguments, returning
`{ stdout, stderr, exitCode }`. Arbitrary git subcommands and shell metacharacters
MUST NOT be forwarded to a subprocess.

#### Scenario: A non-allow-listed git command is refused
- **WHEN** a git request names a command outside `{log, status, diff-stat, branch}`
- **THEN** the daemon refuses the request
- **AND** no subprocess is spawned.

### Requirement: Daemon Writes Confined To Its Own Directory

All daemon writes SHALL be confined to `~/.agenticapps/dashboard/`.
`registry.json`, `auth.json`, and `env.json` MUST be mode `0600`, and the daemon
MUST refuse to start when any is looser. The `coverage-history/` and
`workflow-harness/` trees MUST be directory mode `0700`; persisted result files
MUST be mode `0600`, with modes re-applied after creation. Each harness run SHALL
use a fresh `workflow-harness/tmp/` child at mode `0700`, enforce its disk bound,
and remove it after the run.

#### Scenario: Loose permissions refuse startup
- **WHEN** the daemon starts and `auth.json` is mode `0644`
- **THEN** it refuses to start
- **AND** it prints an actionable error naming the file and the `chmod 600` remedy.

#### Scenario: Snapshot files stay private under a permissive umask
- **WHEN** a daily coverage snapshot is appended under a umask that would widen the mode
- **THEN** the file is written at mode `0600` and the directory tree remains `0700`
- **AND** the mode is explicitly re-applied rather than assumed from creation.

#### Scenario: Daemon-owned result files stay private
- **WHEN** a coverage snapshot or workflow harness result is written under a permissive umask
- **THEN** the file is mode `0600` and its directory tree remains `0700`
- **AND** the mode is explicitly re-applied rather than assumed from creation.

#### Scenario: Scratch state is bounded and removed
- **WHEN** a harness completes, fails, times out, or exceeds a bound
- **THEN** its fresh scratch child is removed
- **AND** no arbitrary harness-created file remains beside daemon credentials.

#### Scenario: Symlink escape from the snapshot directory is refused
- **WHEN** the snapshot directory path resolves through a symlink pointing outside `~/.agenticapps/dashboard/`
- **THEN** the daemon detects this via a realpath check performed once at boot
- **AND** refuses to write snapshots there.

#### Scenario: Symlink escape from a daemon-owned tree is refused
- **WHEN** a daemon-owned result or scratch path resolves through a symlink outside `~/.agenticapps/dashboard/`
- **THEN** the daemon refuses to write or execute there
- **AND** the decision is made on the canonical path.

### Requirement: Files Retained For Rollback Have A Bounded Lifetime

Where the daemon retains a file after the feature that produced it is withdrawn —
whether it holds third-party credentials or evidence kept so a rollback has
something to roll back to — that retention SHALL be bounded, owned, and dated.
The retention window SHALL be the rollback window and no longer, and the change
that withdraws the feature SHALL name the deletion as one of its own tasks, with
a deadline expressed as a literal date and an owner who is a named person.

Retention MUST NOT be deferred to unscheduled cleanup. "Left in place for
rollback" with no end is indefinite retention of data the product has no
remaining use for, and an obligation assigned to nobody is discharged by nobody.

**Credential files are the strictest case, not the only one.** A retained
credential outlives the feature that justified it while remaining a live secret,
so it is the case where the cost of an unbounded window is highest. Retained
evidence expires for the same reason, one degree weaker: rollback evidence is
worth keeping exactly as long as rollback is possible.

For the withdrawal of the optional integrations, the window is **thirty days from
the cutover release**, after which the integration environment files under the
daemon's own directory SHALL be deleted. The coverage and conformance history
snapshots retained by the same cutover SHALL be deleted or archived on the same
window, by the same owner.

**Scoped to files and evidence, added 2026-08-05.** This requirement was written
covering "a file containing third-party credentials" alone, which left the
retained snapshots — withdrawn by the same change, retained on the same
reasoning, deferred to "a separate cleanup decision" in their own delta — outside
any normative window. A retention rule that covers only the strictest case leaves
every weaker case exactly where it was.

This requirement is about lifetime alone. It neither relaxes nor restates the
file-mode discipline in `Daemon Writes Confined To Its Own Directory`, which
continues to govern access for as long as a retained file exists.

#### Scenario: Retained files do not outlive their rollback window
- **WHEN** a withdrawn feature's files are retained for rollback, whether they hold credentials or evidence
- **THEN** the withdrawing change carries a deletion task with a literal date and a named owner
- **AND** the files are deleted when the window closes rather than remaining indefinitely.

#### Scenario: Retained evidence is bounded, not only retained secrets
- **WHEN** a change retains history snapshots so a rollback has something to roll back to
- **THEN** those files carry the same window, owner, and dated deletion as any retained credential
- **AND** the weaker case is not left unbounded because a stricter one was addressed.

#### Scenario: Mode is not accepted as a substitute for lifetime
- **WHEN** a retained credential file is written at mode `0600`
- **THEN** the retention requirement is still unmet until a window, an owner, and a date exist
- **AND** restricting who can read the file is not treated as a decision about how long it is kept.

#### Scenario: Cleanup is not deferred to nobody
- **WHEN** a change proposes to retain credential files and record their deletion as separate cleanup
- **THEN** the retention is non-conformant until the deletion is a dated task in that change
- **AND** the obligation cannot be discharged by naming a future change that does not exist.

### Requirement: Registry Mutation Is The Only Write Surface

The registry routes and `POST /api/v2/workflow/harness` SHALL be the only routes
that mutate daemon state. Registry routes MUST mutate only `registry.json`.
The harness route MUST mutate only its bounded `workflow-harness/` cache and
scratch tree. Neither may write a registered project's files. Registry writes
MUST remain atomic, using an exclusive no-follow open followed by fsync and
rename.

#### Scenario: Registration mutates only the registry
- **WHEN** `POST /api/registry/register` or `/unregister` succeeds
- **THEN** only `~/.agenticapps/dashboard/registry.json` changes
- **AND** the registered project's own files are untouched.

#### Scenario: Harness mutation stays in its declared tree
- **WHEN** a harness request runs
- **THEN** daemon-created state is confined to `workflow-harness/`
- **AND** no project file, registry file, auth file, or environment file is mutated.

#### Scenario: A registry write is atomic
- **WHEN** the registry is rewritten
- **THEN** the write goes to an exclusive no-follow temporary file, is fsynced, and is renamed into place
- **AND** a partially written registry is never observable.

### Requirement: Registration Target Blocklist

Paths accepted for registration or path repair SHALL be canonicalised
(absolute + realpath) and refused when they resolve to a system root or a
known secret-bearing directory, and — for path repair — when they fall outside
the configured family roots. Error responses MUST use structured codes and MUST
NOT leak resolved filesystem paths.

#### Scenario: A blocked path is refused with a structured code
- **WHEN** a path-repair request names a path that is unresolvable, blocked, or outside the family roots
- **THEN** the daemon responds 422 with a structured code such as `newPath_unresolvable`, `newPath_blocked`, or `newPath_outside_family_roots`
- **AND** the response body does not contain the resolved filesystem path.

### Requirement: OpenSpec CLI Invocation Discipline

The OpenSpec reader's use of the `openspec` binary is spawn site 3 of the
enumeration in `Read-Only On Project Filesystems`. It SHALL be bounded by the
discipline below, which is the analogue of `Git Command Allow-List` for this
binary. Unlike `$EDITOR` and the conformance harness, this binary is invoked
without a user gesture, on an ordinary read — so its bounds are the daemon's
responsibility on every request rather than a one-time user consent.

**Resolution.** The binary SHALL be resolved once at daemon start, not per
request, and the resolved value MUST be an absolute path to an existing regular
executable file. A path that resolves to a directory, to a broken symlink, or to
a file without the executable bit is a **resolution failure**, identical in
effect to the binary being absent. If resolution fails, the reader SHALL use the
tree path for the remainder of the daemon's lifetime and MUST NOT retry a `PATH`
lookup per request.

**Invocation.** The binary SHALL be invoked via argv, never through a shell, so
that no value can be interpreted as a shell metacharacter. The argument vector
SHALL be drawn from a fixed table — `list --json` and `list --specs --json` — and
no other subcommand, flag, or argument may be passed.

This table is not assumed. It was verified against `openspec` **1.6.0** on
2026-07-26: both forms exist, and their JSON carries exactly the fields the
parity set in `project-dashboard` names — `name`, `completedTasks`,
`totalTasks` per change, and `id`, `requirementCount` per spec. A daemon meeting
a CLI whose surface has moved does not fail; it falls back under the
shape-recognition rule below.

**User-controlled values.** The only request-derived value that reaches the
invocation is the working directory, which MUST be the realpath-resolved root of
a registered project. Change names, capability names, file names, and every
other string read out of a project tree MUST NOT reach the argument vector.

**Bounds and fallback.** The invocation SHALL be bounded by a wall-clock timeout
and a maximum captured-output size, both named constants per the rule above, and
SHALL run in its own process group. On timeout the daemon SHALL signal the whole
group rather than the direct child alone, so descendants are terminated rather
than orphaned, and SHALL stop capturing output at the cap rather than buffering
past it while waiting for exit. The reader SHALL fall back to the tree path, and
report the project normally, on any of: **a spawn failure** (the binary resolved
at start but is missing, replaced, or no longer executable at invocation),
timeout, non-zero exit, output exceeding the cap, unparseable JSON, or JSON whose
shape the daemon does not recognise. None of these conditions may surface as a
route error.

**Shape recognition** SHALL be a required-subset check that ignores unknown
fields: output is recognised when every field the daemon consumes is present and
of the expected type, and additional fields are ignored rather than rejected. A
newer CLI adding fields stays recognised; an older CLI missing a consumed field
falls back rather than silently reporting a partial project.

#### Scenario: The subcommand table is closed
- **WHEN** the reader invokes the `openspec` binary
- **THEN** the argument vector is one of `list --json` or `list --specs --json`
- **AND** no code path constructs an `openspec` argument vector from a value read out of a project tree.

#### Scenario: No value reaches a shell
- **WHEN** a registered project's root path contains a space, a quote, or a shell metacharacter
- **THEN** the binary is invoked via argv with that path as its working directory and the read succeeds
- **AND** no shell is interposed and no part of the path is interpreted as syntax.

#### Scenario: A hung binary is bounded and falls back
- **WHEN** the `openspec` binary does not exit within the timeout
- **THEN** the daemon terminates its process group and reads the project from the tree instead
- **AND** the route returns the project's data rather than an error.

#### Scenario: Unrecognised CLI output degrades to the tree
- **WHEN** the binary exits successfully but emits JSON missing a field the daemon consumes, or output exceeding the size cap
- **THEN** the reader falls back to the tree path
- **AND** the project is reported with tree-derived values rather than partially-parsed ones.

#### Scenario: An added upstream field does not degrade the CLI path
- **WHEN** the binary emits JSON carrying every consumed field plus fields the daemon does not know
- **THEN** the output is recognised and the CLI path is used
- **AND** the unknown fields are ignored rather than treated as a shape mismatch.

#### Scenario: A binary that disappears after resolution falls back
- **WHEN** the binary resolved at daemon start is deleted, replaced, or loses its executable bit before an invocation
- **THEN** the resulting spawn failure falls back to the tree path
- **AND** the route returns the project's data rather than an error.

#### Scenario: Resolution is not retried per request
- **WHEN** the binary cannot be resolved at daemon start — because it is absent, a directory, a broken symlink, or not executable
- **THEN** every subsequent project read uses the tree path directly
- **AND** no `PATH` lookup and no process spawn is attempted on the request path.

