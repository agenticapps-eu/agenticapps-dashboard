## ADDED Requirements

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
- A boundary that is a **daemon-named root** lying outside every repository —
  the machine roots of `Named Allowed Roots For Fleet Scanners`.

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
identify which named root it is claiming, drawn from the enumerated set of
machine roots rather than from free text. A declaration that could name any root
whatever, justified by any string whatever, would be an unbounded exemption from
anchoring wearing the appearance of a decision.

**What this requirement enforces is the presence of a declaration, not its
truth.** A declaration naming the wrong case SHALL NOT be treated as satisfying
the anchoring requirement: a derived boundary declared as a repository root
remains a derived boundary, and remains governed by `A Containment Anchor Is
Verified Against Its Registered Root`. Nothing in this requirement detects such
a misdeclaration, and it SHALL NOT be relied on to. Boundaries already anchored
under that requirement SHALL be protected against silent reclassification by
regression coverage, which is the enforceable part of this concern.

Declaring a case SHALL NOT change what a site admits. The declaration records a
classification that already governs the read, so a site whose admitted or
refused paths move when its declaration is written down was misclassified, and
the misclassification is the finding rather than an accepted cost.

The roots supplied in a single resolution SHALL share one classification. A site
needing two classifications SHALL be split into two resolutions rather than
declaring one for a mixed set. Because supplied roots are alternatives — a path
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

#### Scenario: The daemon-named case cannot exempt an arbitrary root

- **WHEN** a site declares daemon-named for a root that is not one of the enumerated machine roots
- **THEN** the declaration is rejected rather than admitted on the strength of its accompanying text
- **AND** an empty or blank reason is likewise rejected, so the record cannot be satisfied by supplying nothing.

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

#### Scenario: A resolution mixing classifications is split rather than declared

- **WHEN** one resolution would supply both a repository root and a boundary derived from inside a repository
- **THEN** it is split into two resolutions, each declaring its own case
- **AND** no single declaration is applied to a set of roots that do not share it.
