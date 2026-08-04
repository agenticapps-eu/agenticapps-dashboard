## ADDED Requirements

### Requirement: A Containment Anchor Is Verified Against Its Registered Root

A reader that resolves an allow-listed directory once and reuses that resolved
path as the containment boundary for every subsequent read SHALL verify the
resolved anchor against the realpath of the registered root before using it. An
anchor that does not lie at, or under, the realpath of the registered root SHALL
be refused, and the repository SHALL contribute nothing rather than contribute
records read through it.

This is stated separately from `Per-Project Path Allow-List` because it is a
distinct failure: that requirement governs paths checked **against** an anchor,
and is satisfied by a reader whose anchor is itself wrong. Resolving
`<root>/openspec` through a symlink and then admitting everything under the
target passes every per-path check, because each path really does lie under the
boundary the reader adopted. The boundary is the thing that escaped, so the
boundary is what has to be checked.

The repository-scoped anchor is the registered root itself. A symlink **under**
an allow-listed directory remains governed by `Per-Project Path Allow-List`; this
requirement governs the allow-listed directory **being** a symlink.

#### Scenario: An allow-listed directory that is itself a symlink is refused
- **WHEN** a registered repository's `openspec` entry is a symlink whose target lies outside the realpath of that repository's root
- **THEN** the reader admits no records from that repository
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
