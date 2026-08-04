## ADDED Requirements

### Requirement: Containment Intent Is Declared At Every Resolution Site

Every site that resolves a path against a containment boundary SHALL declare
which containment case it is in. A site SHALL NOT be able to leave that
declaration unmade: the absence of a declaration SHALL be a build failure rather
than a silently permitted default.

This is stated separately from `A Containment Anchor Is Verified Against Its
Registered Root` because it governs a different failure. That requirement says
what a verified boundary is, and is satisfied by a reader that verifies the
boundaries it thought to verify. This one says that *no reader may decline to
answer the question*. A boundary that was never considered and a boundary that
was considered and correctly left unanchored are indistinguishable when both are
written as silence, so silence SHALL NOT be available as a way of writing either.

Three cases exhaust the declarations, and they are distinct claims:

- A boundary **derived** from a path inside a repository, which SHALL be anchored
  to that repository root and is governed entirely by `A Containment Anchor Is
  Verified Against Its Registered Root`.
- A boundary that **is** a repository root, where the anchor is the root itself
  and verification is an identity.
- A boundary that is a **daemon-named root** lying outside every repository —
  the machine and family roots of `Named Allowed Roots For Fleet Scanners`.

The third case SHALL record why the read is not anchored to a repository root.
A recorded reason is required because this is the only case that widens what is
reachable beyond a repository, and because the justification is otherwise
unavailable to whoever next reads that code: it survives, if at all, in an
archived design document they have no reason to open. What is recorded SHALL
state the condition that makes anchoring wrong for that root, not merely that a
decision was taken.

Declaring a case SHALL NOT by itself change what is admitted. The declaration
records a classification that already governs the read; a site whose behaviour
changes when its declaration is written down was misclassified, and the
misclassification is the finding.

#### Scenario: A resolution site that declares no containment case does not build

- **WHEN** a path-resolution site is written without declaring which containment case applies
- **THEN** the build fails at that site
- **AND** the failure names the site, so the set of undeclared sites is enumerable by building rather than by searching for a property name.

#### Scenario: A read outside every repository states why it is not anchored

- **WHEN** a site resolves against a daemon-named root that lies outside every repository root
- **THEN** the site records the condition that makes anchoring that root wrong
- **AND** the recorded reason is discoverable from the resolution site itself, not only from an archived design document.

#### Scenario: A derived boundary cannot be declared as a repository root

- **WHEN** a boundary derived from a path inside a repository is declared as being a repository root, or as a daemon-named root
- **THEN** the declaration is not a valid description of that boundary
- **AND** the boundary remains governed by the anchoring requirement, because a misdeclaration does not narrow what that requirement covers.

#### Scenario: Declaring an existing site does not change what it admits

- **WHEN** an existing resolution site gains an explicit containment declaration matching the case it was already in
- **THEN** the paths it admits and refuses are unchanged
- **AND** any observed difference is treated as evidence that the site was misclassified, not as an accepted consequence of declaring it.
