## MODIFIED Requirements

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
