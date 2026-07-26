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
- **AND** it is presented as internally consistent rather than merely as matching on its primary skill.

#### Scenario: Internal consistency is not reported as being current
- **WHEN** every skill of a host declares the same value and that value is below the core spec version
- **THEN** the host is reported as internally consistent **and** behind core
- **AND** the two results are separate, so uniform obsolescence is never rendered as conformance.

#### Scenario: A skill with no declared value is reported as unknown
- **WHEN** a host carries a skill whose frontmatter declares no `implements_spec`, or declares one that cannot be parsed as a version
- **THEN** that skill is listed as unknown rather than silently excluded from the range
- **AND** the host is not reported as drift-free on the strength of skills that were skipped.

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

The scanner SHALL read the shared artefacts installed outside any repository —
both the shared AgenticApps binary directory and, for hosts that install skills
machine-globally, that host's own global skill directory — and report them
separately from the per-repo copies. These locations are per host and are not
assumed to be a single path.

Where a machine-wide artefact is one for which a core reference exists, it SHALL
be compared by byte equality like any other shared artefact, not by its version
marker alone. This is the path whose contents the agents actually execute, so a
weaker check here than on the repo copies would invert the priority.

#### Scenario: Machine-wide copies are reported separately
- **WHEN** the workflow surface renders
- **THEN** the artefacts installed outside any repository are shown as their own entries, distinct from any host repo's copy
- **AND** a divergence between a machine-wide copy and the host repos is visible.

#### Scenario: Machine-wide artefacts are compared by content
- **WHEN** a machine-wide artefact has a core reference implementation
- **THEN** it is compared byte-for-byte against that reference
- **AND** a matching version marker over differing bytes is reported as divergent.

#### Scenario: Per-host global locations are resolved per host
- **WHEN** hosts install their skills to different machine-global directories
- **THEN** each host's own location is read
- **AND** no host is reported as absent because another host's location was searched.

#### Scenario: An absent machine-wide install is stated
- **WHEN** no artefacts are present at a machine-wide location
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
displayed with its age. The cache entry SHALL be keyed on the content of **both**
the artefact under test **and** the harness script that tested it, and SHALL be
invalidated when either changes. Age alone MUST NOT be the invalidation rule.

Keying on the artefact alone is insufficient: the harness is vendored from the
same upstream as the artefact and changes on its own schedule, so a harness
update would otherwise leave a result produced by different test logic on display
as current.

#### Scenario: A result is shown with its age
- **WHEN** a cached harness result renders
- **THEN** the outcome is shown together with how long ago it was produced.

#### Scenario: Re-vendoring the artefact invalidates the result
- **WHEN** the tested artefact's content changes after a result was cached
- **THEN** the cached result is discarded rather than shown as current
- **AND** the surface reports that no current result exists.

#### Scenario: Re-vendoring the harness invalidates the result
- **WHEN** the harness script's content changes while the tested artefact is unchanged
- **THEN** the cached result is discarded
- **AND** it is not shown as current merely because the artefact still matches.

#### Scenario: An unchanged pair keeps its result
- **WHEN** time passes but both the tested artefact and the harness are unchanged
- **THEN** the cached result is retained and displayed with its increased age.

#### Scenario: A failing run is cached as a result
- **WHEN** a harness completes and reports a non-passing score
- **THEN** that outcome is cached and displayed with its age like any other completed run
- **AND** it is distinguishable from a run that timed out or was bounded out, which are not cached as completed.

### Requirement: Harness Execution Is Bounded

The set of workflow repository roots SHALL be a fixed daemon-side list that no
request can extend, and the SPA MUST NOT be able to influence it.

Harness execution SHALL be constrained by all of the following:

- The script path SHALL be canonicalised and the canonical result SHALL lie under
  one of those roots. Symlinks SHALL be resolved before the check, and the path
  SHALL be re-verified at spawn time so that a path swapped between check and
  spawn cannot be executed.
- Host and harness identifiers SHALL select from a fixed internal table of
  commands. No string taken from the request SHALL reach an argument vector, a
  working directory, or an environment variable.
- The process SHALL be started in its own process group, with a scratch working
  directory under the daemon's own directory, and with bounds on CPU time,
  memory, and captured output size.
- On timeout or bound violation the **entire process group** SHALL be terminated,
  not the direct child alone.
- Concurrency SHALL be bounded: at most one harness run per host at a time, and a
  bounded number overall.
- Captured output SHALL be truncated to the bound and stripped of absolute
  filesystem paths before it is stored or returned.

#### Scenario: A script outside the known roots is refused
- **WHEN** execution is requested for a path whose canonical form does not resolve under a known workflow repository root
- **THEN** the request is refused and no process is started.

#### Scenario: A symlink out of the roots is refused
- **WHEN** a path inside a known root is a symlink whose target resolves outside every known root
- **THEN** the request is refused
- **AND** the decision is taken on the canonical path, not the requested one.

#### Scenario: An unknown host or harness identifier is refused
- **WHEN** a request names a host or harness that is not in the fixed internal table
- **THEN** the request is refused and no process is started.

#### Scenario: Request values never reach a command line
- **WHEN** a harness request is served
- **THEN** the identifiers select an entry from the fixed internal table
- **AND** no string taken from the request is interpolated into the argument vector, working directory, or environment.

#### Scenario: A hanging harness takes its children with it
- **WHEN** a harness exceeds its time budget after spawning child processes
- **THEN** the entire process group is terminated
- **AND** no descendant process survives the run
- **AND** no partial result is cached as a completed run.

#### Scenario: Runaway resource use is bounded
- **WHEN** a harness exceeds its memory or output bound
- **THEN** the run is terminated and reported as bounded-out
- **AND** the captured output is truncated rather than stored in full.

#### Scenario: Stored output carries no absolute paths
- **WHEN** a harness result is cached or returned
- **THEN** absolute filesystem paths are reduced to symbolic references
- **AND** no home-directory path reaches the response.

#### Scenario: The root set cannot be widened by a request
- **WHEN** any request attempts to name a repository root
- **THEN** the daemon ignores it and uses its own fixed list
- **AND** a root added to the list is a code change subject to this requirement.

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
