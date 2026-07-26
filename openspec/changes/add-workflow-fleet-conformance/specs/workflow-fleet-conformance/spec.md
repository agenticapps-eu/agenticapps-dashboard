## ADDED Requirements

### Requirement: Core Spec Version Is The Maximum Across Sections

The core workflow spec versions each section independently. The scanner SHALL
report the core repo's spec version as the maximum across all section
frontmatter values, and MUST NOT read a single section, take the first, or
average them. An unreleased changelog entry that changes no section version
SHALL NOT change the reported version.

#### Scenario: The maximum is reported
- **WHEN** the core repo's spec sections declare differing versions
- **THEN** the reported core spec version is the highest of them
- **AND** it is not taken from any single section by position.

#### Scenario: An unreleased entry does not move the version
- **WHEN** the core changelog carries an unreleased block that alters no section's declared version
- **THEN** the reported core spec version is unchanged
- **AND** no host is reported as behind because of it.

### Requirement: Implements-Spec Is Reported Per Skill, Not Per Repo

For each host the scanner SHALL report the primary skill's `implements_spec`, the
minimum and maximum across all of that host's skills, and the name and version of
every skill whose value differs from the maximum. A host SHALL NOT be summarised
by its primary skill alone.

#### Scenario: A drifting host is not reported as current
- **WHEN** a host's primary skill matches the core spec version but other skills declare lower values
- **THEN** the host's reported range spans from the lowest skill value to the highest
- **AND** the host is flagged as drifting despite its primary skill matching.

#### Scenario: Laggard skills are named
- **WHEN** a host's range shows drift
- **THEN** each skill below the maximum is listed by name with its own version
- **AND** the list is reachable from the host's row.

#### Scenario: A drift-free host is distinguishable
- **WHEN** every skill of a host declares the same value
- **THEN** the host's minimum and maximum are equal
- **AND** it is presented as drift-free rather than merely as matching on its primary skill.

#### Scenario: A host's skills are found wherever that host installs them
- **WHEN** a host stores some skills outside its main skills directory
- **THEN** those skills are included in the range and the laggard list
- **AND** the scan does not report a narrower range than the host actually carries.

### Requirement: Shared Artefact Conformance Is Byte Equality, Not A Version Claim

For each shared artefact the scanner SHALL compare the host's copy byte-for-byte
against the core reference implementation and report that comparison as the
conformance result. A matching version marker in the file MUST NOT be treated as
evidence of conformance.

#### Scenario: A divergent copy with a matching header is reported as divergent
- **WHEN** a host's artefact declares the same version marker as the core reference but its bytes differ
- **THEN** the artefact is reported as not identical
- **AND** the matching version marker does not raise the result.

#### Scenario: Identical artefacts are reported as green
- **WHEN** every host's copy of an artefact is byte-identical to the core reference
- **THEN** each is reported as identical
- **AND** the row reads as conformant.

#### Scenario: Both the executable artefacts and their harnesses are compared
- **WHEN** the scanner evaluates shared artefacts for a host
- **THEN** the change gate, the reviewer CLI, and their conformance harnesses are each compared against the core reference
- **AND** each carries its own result.

### Requirement: Missing Vendor Provenance Is Reported

Where a host's shared artefact does not record the core commit it was vendored
from, the scanner SHALL report that provenance as absent. This SHALL be reported
independently of byte identity, so that an artefact can be simultaneously
identical and lacking recorded provenance.

#### Scenario: Identical but unprovenanced is visible
- **WHEN** a host's artefact is byte-identical to the reference but records no core commit
- **THEN** the identity result is reported as conformant
- **AND** the provenance result is reported as absent, in its own row.

#### Scenario: Absence across every host is still shown
- **WHEN** no host records vendor provenance for an artefact
- **THEN** the row reports absence for all of them
- **AND** the surface does not suppress a finding for being fleet-wide.

### Requirement: Machine-Wide Installed Artefacts Are Reported

The scanner SHALL read the shared artefacts installed at the machine-wide
location and report their version markers, separately from the per-repo copies.

#### Scenario: The machine-wide copy is reported separately
- **WHEN** the workflow surface renders
- **THEN** the versions installed machine-wide are shown as their own entry, distinct from any host repo's copy
- **AND** a divergence between the machine-wide copy and the host repos is visible.

#### Scenario: An absent machine-wide install is stated
- **WHEN** no artefacts are installed at the machine-wide location
- **THEN** that absence is reported plainly
- **AND** no host result is altered because of it.

### Requirement: Migration Position Is Reported Per Host

The scanner SHALL report each host's highest available migration number. It MUST
NOT present this as a record of which migrations a consuming project has applied.

#### Scenario: The highest migration is reported
- **WHEN** a host repo carries a numbered migration set
- **THEN** the highest number is reported for that host.

#### Scenario: The number is not presented as applied state
- **WHEN** the migration figure renders
- **THEN** it is labelled as what the host offers
- **AND** it is not presented as what any project has applied.

### Requirement: The Conformance Harness Runs Only On Explicit Request

A conformance harness SHALL execute only in response to an explicit user action
naming a host and a harness. Rendering the workflow surface, refreshing it, or
polling it MUST NOT execute a harness.

#### Scenario: Rendering executes nothing
- **WHEN** the workflow surface is opened, refreshed, or re-polled
- **THEN** no harness process is started
- **AND** any result shown comes from the cache.

#### Scenario: An explicit request executes exactly one harness
- **WHEN** a user requests a named harness for a named host
- **THEN** that harness runs for that host only
- **AND** no other host's harness is started as a side effect.

### Requirement: Harness Results Carry Their Age And Are Invalidated By Content

A cached harness result SHALL be stored with the timestamp of its run and
displayed with its age. The cache entry SHALL be invalidated when the content of
the artefact it tested changes, independently of its age. Age alone MUST NOT be
the invalidation rule.

#### Scenario: A result is shown with its age
- **WHEN** a cached harness result renders
- **THEN** the outcome is shown together with how long ago it was produced.

#### Scenario: Re-vendoring invalidates the result
- **WHEN** the tested artefact's content changes after a result was cached
- **THEN** the cached result is discarded rather than shown as current
- **AND** the surface reports that no current result exists.

#### Scenario: An unchanged artefact keeps its result
- **WHEN** time passes but the tested artefact is unchanged
- **THEN** the cached result is retained and displayed with its increased age.

### Requirement: Harness Execution Is Bounded

Harness execution SHALL be constrained so that only scripts resolving under one
of the known workflow repository roots may run, no value taken from the request
reaches a command line, each run is bounded by a timeout, and each request passes
the existing rate limiter.

#### Scenario: A script outside the known roots is refused
- **WHEN** execution is requested for a path that does not resolve under a known workflow repository root
- **THEN** the request is refused and no process is started.

#### Scenario: Request values never reach a command line
- **WHEN** a harness request is served
- **THEN** the host and harness identifiers select from a fixed internal set of commands
- **AND** no string taken from the request is interpolated into the executed command.

#### Scenario: A hanging harness is terminated
- **WHEN** a harness exceeds its time budget
- **THEN** the process is terminated and the request reports a timeout
- **AND** no partial result is cached as a completed run.

### Requirement: The Workflow Surface Covers Only The Workflow Repositories

The workflow surface SHALL report on the core repository and the host workflow
implementations only. Registered product repositories MUST NOT appear on it, and
their readiness results MUST NOT be derived from it.

#### Scenario: Product repos are absent
- **WHEN** the workflow surface renders with product repos registered
- **THEN** only the workflow repositories appear
- **AND** no product repo is listed or scored.

#### Scenario: A missing workflow repo is stated, not skipped
- **WHEN** one of the workflow repositories cannot be found on disk
- **THEN** it appears with its absence stated
- **AND** the other repositories are still reported.
