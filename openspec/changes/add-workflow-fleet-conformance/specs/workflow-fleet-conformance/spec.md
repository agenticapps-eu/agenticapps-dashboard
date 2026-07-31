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

#### Scenario: An unavailable core makes comparisons unavailable
- **WHEN** the core repository or a required reference artifact is missing or unreadable
- **THEN** every comparison that depends on it is reported as unavailable
- **AND** no host is reported as conformant against a missing reference.

### Requirement: The Workflow Fleet And Artifact Mappings Are Fixed

The workflow fleet SHALL consist of exactly
`agenticapps-workflow-core`, `claude-workflow`, `codex-workflow`,
`opencode-workflow`, and `pi-agentic-apps-workflow`. For each shared artifact,
the host path and core-reference path SHALL come from one daemon-side mapping.
No request field or registry entry may add a repository or alter a mapping.

#### Scenario: Every expected host is represented
- **WHEN** the workflow matrix is produced
- **THEN** the core and all four named host implementations appear in fixed order
- **AND** a missing repository appears as missing rather than being omitted.

#### Scenario: Requests cannot widen the fleet
- **WHEN** a request supplies an unknown repository, host, or artifact identifier
- **THEN** it is rejected
- **AND** the fixed fleet and artifact mappings remain unchanged.

#### Scenario: The compared files come from one mapping
- **WHEN** an artifact is compared across hosts
- **THEN** every host copy is matched to the declared core reference for that artifact
- **AND** a request cannot substitute a different file.

### Requirement: Implements-Spec Is Reported Per Skill, Not Per Repo

For each host the scanner SHALL report the primary skill's `implements_spec`, the
minimum and maximum across all of that host's skills, and the name and version of
every skill whose value differs from the maximum. A host SHALL NOT be summarised
by its primary skill alone. The expected skill set SHALL be the tracked skill
directories declared by that host repository. Machine-global installs SHALL be
compared against that expected set, so an expected skill that is absent is
reported as missing.

Version values SHALL parse as semantic versions. Missing, duplicate, or
unparseable declarations SHALL be reported as unknown and SHALL prevent the host
from being called drift-free. Unknown values SHALL be listed alongside the
numeric range but SHALL not enter its minimum or maximum.

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
- **THEN** that skill is listed as unknown alongside the range rather than silently omitted
- **AND** the host is not reported as drift-free on the strength of skills that were skipped.

#### Scenario: A required skill is missing
- **WHEN** the host repository declares a skill in its tracked skill set but that skill is absent from the scanned install
- **THEN** the skill is listed as missing
- **AND** the host is not reported as drift-free or complete.

#### Scenario: Duplicate or malformed declarations are unknown
- **WHEN** a skill contains duplicate `implements_spec` fields or a value that is not a semantic version
- **THEN** that skill is reported as unknown with a stable reason code
- **AND** no lexical or partial ordering is attempted.

#### Scenario: A host's skills are found wherever that host installs them
- **WHEN** a host stores some skills outside its main skills directory
- **THEN** those skills are included in the range and the laggard list
- **AND** the scan does not report a narrower range than the host actually carries.

#### Scenario: Explained divergence remains divergence
- **WHEN** a host intentionally pins an older version or carries a local patch with an ADR explaining it
- **THEN** the surface may link or name that explanation
- **AND** the version or byte comparison remains divergent rather than becoming green.

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

### Requirement: A Pinned Artefact Is A Distribution Model, Not A Missing One

A host MAY distribute a shared artefact by **pinning** rather than by vendoring:
declaring, in a manifest it owns, one core commit and an expected digest per
file, and resolving those bytes at install time instead of carrying a copy. The
scanner SHALL recognise a declared pin and score that artefact on **pin
integrity** instead of on local byte identity. Under a valid pin, the absence of
the artefact from the host's own tree SHALL NOT be reported as a missing or
divergent artefact.

Pin integrity means all of: the manifest is present and parseable; it names a
core repository and a `core_commit` that parses as a full commit identifier;
**one** commit covers every entry; every artefact the host publishes appears as
an entry; and each recorded digest matches the bytes of the core reference at
that commit. Any of those failing is a finding against that host, reported with
the specific clause that failed rather than as a generic divergence.

A pin SHALL NOT be trusted on its own assertion. The recorded digest is checked
against the reference bytes the scanner already reads; a manifest whose digests
are self-consistent but do not match the reference is a finding, not a pass.

Vendoring remains a fully conformant model scored exactly as before. This
requirement adds a second model; it does not deprecate the first, and a host that
vendors SHALL NOT be reported as deficient for not pinning.

#### Scenario: A pinning host is not reported as missing its artefacts
- **WHEN** a host declares a valid pin for an artefact and does not carry that artefact in its own tree
- **THEN** the artefact is reported as pinned, with the pinned commit identified
- **AND** it is not reported as absent, missing, or divergent.

#### Scenario: A pin is verified against the reference, not believed
- **WHEN** a manifest records a digest for an artefact that does not match the core reference bytes at the named commit
- **THEN** the artefact is reported as a pin-integrity finding naming the mismatched file
- **AND** the manifest's internal consistency does not raise the result.

#### Scenario: A partial manifest is a finding
- **WHEN** a host publishes an artefact that its manifest does not list
- **THEN** the omission is reported as a pin-integrity finding
- **AND** the entries that are present do not compensate for the one that is absent.

#### Scenario: Pinning is distinct from explained divergence
- **WHEN** a pinning host is compared against a host carrying an older or locally patched copy with an ADR explaining it
- **THEN** the pinned host reads as conformant while the patched host reads as divergent
- **AND** the two are not collapsed into one state, because a pin resolves the current reference bytes whereas an explanation does not change older bytes.

#### Scenario: Vendoring is not penalised
- **WHEN** a host distributes an artefact as a byte-identical vendored copy
- **THEN** it is reported as conformant on byte identity as before
- **AND** no finding is raised for the absence of a pin.

### Requirement: Missing Vendor Provenance Is Reported

Where a host's shared artefact does not record the core commit it was vendored
from, the scanner SHALL report that provenance as absent. This SHALL be reported
independently of byte identity, so that an artefact can be simultaneously
identical and lacking recorded provenance. A present provenance value SHALL be
parsed as a full commit identifier. A malformed or missing value SHALL be a
finding. This change verifies recorded provenance presence and syntax only; it
MUST NOT spawn git or claim that the commit exists or that historical bytes
match.

A pin manifest **is** a provenance record for every artefact it covers: it names
the core commit those bytes came from, per file. The scanner SHALL read it as
such and MUST NOT report a pinned artefact as unprovenanced merely because the
commit is recorded in the manifest rather than in a header inside the file.

#### Scenario: Identical but unprovenanced is visible
- **WHEN** a host's artefact is byte-identical to the reference but records no core commit
- **THEN** the identity result is reported as conformant
- **AND** the provenance result is reported as absent, in its own row.

#### Scenario: Absence across every host is still shown
- **WHEN** no host records vendor provenance for an artefact
- **THEN** the row reports absence for all of them
- **AND** the surface does not suppress a finding for being fleet-wide.

#### Scenario: A manifest satisfies provenance for the files it covers
- **WHEN** a host records an artefact's core commit in a pin manifest rather than in a header inside the artefact
- **THEN** provenance is reported as present for that artefact
- **AND** the location of the record does not make a recorded provenance count as absent.

#### Scenario: A provenance claim is syntactically valid
- **WHEN** an artifact records a core commit
- **THEN** the value parses as a full commit identifier
- **AND** a malformed value is reported as invalid provenance without a historical git read.

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
displayed with its age. The cache entry SHALL be keyed on the content of the
artifact under test, the harness script, the core reference, and a
runner-contract version covering the fixed command environment and resource
bounds. It SHALL be invalidated when any input changes. Age alone MUST NOT be
the invalidation rule.

Keying on the artefact alone is insufficient: the harness is vendored from the
same upstream as the artefact and changes on its own schedule, so a harness
update would otherwise leave a result produced by different test logic on display
as current. Entries SHALL be capped to the latest result per fixed host/harness
pair; replacement removes the prior entry.

A completed run's outcome SHALL come from its process exit status: exit zero is
passing and any non-zero exit is non-passing. Captured stdout/stderr is
diagnostic text only and MUST NOT be parsed into a score.

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

#### Scenario: The reference or runner contract invalidates the result
- **WHEN** the core reference bytes or runner-contract version changes while the artifact and harness are unchanged
- **THEN** the cached result is discarded
- **AND** evidence from the old comparison contract is not shown as current.

#### Scenario: An unchanged fingerprint keeps its result
- **WHEN** time passes but the artifact, harness, core reference, and runner-contract version are unchanged
- **THEN** the cached result is retained and displayed with its increased age.

#### Scenario: A failing run is cached as a result
- **WHEN** a harness completes with a non-zero exit status
- **THEN** that outcome is cached and displayed with its age like any other completed run
- **AND** it is distinguishable from a run that timed out or was bounded out, which are not cached as completed.

### Requirement: Harness Execution Is Bounded

The five fixed workflow repository identifiers SHALL resolve beneath configured
source-family roots through a daemon-side mapping that no request or registry
entry can extend. Configuration may relocate a source-family root; it cannot add
a sixth workflow repository or provide a harness path. The SPA MUST NOT be able
to influence the resolved paths.

Only a harness whose bytes are currently identical to its mapped core reference
SHALL execute. A missing, non-executable, or divergent harness SHALL be refused
and no cached result SHALL be presented as current.

Harness execution SHALL be constrained by all of the following:

- The script path SHALL be canonicalised and the canonical result SHALL lie under
  one of those roots. Symlinks SHALL be resolved before the check, and the path
  SHALL be re-verified at spawn time so that a path swapped between check and
  spawn cannot be executed.
- Host and harness identifiers SHALL select from a fixed internal table of
  commands. No string taken from the request SHALL reach an argument vector, a
  working directory, or an environment variable.
- The process SHALL be started in its own process group, with a scratch working
  directory under the daemon's own `workflow-harness/tmp/` tree. Each request
  gets a fresh mode-`0700` directory, removed after completion. One run is
  bounded to 30 seconds wall time, a platform-enforced or sampled 256 MiB memory
  ceiling, 1 MiB combined captured output, and 64 MiB scratch disk usage.
- On timeout or bound violation the **entire process group** SHALL be terminated,
  not the direct child alone.
- Concurrency SHALL be bounded: at most one harness run per host at a time and
  at most two runs overall.
- Captured output SHALL be truncated to the bound and stripped of absolute
  filesystem paths, credential-shaped values, and machine usernames before it
  is stored or returned.

The harness endpoint SHALL inherit the daemon's bearer-token authentication and
origin lock. It uses no cookie authentication, and therefore MUST NOT introduce
a second CSRF-bearing credential path.

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

#### Scenario: A missing or divergent harness is refused
- **WHEN** the mapped harness is absent, non-executable, or differs from its core reference
- **THEN** the request is refused and no process is started
- **AND** the surface shows the conformance finding instead of a harness result.

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
- **WHEN** a harness exceeds its memory, output, or scratch-disk bound
- **THEN** the run is terminated and reported as bounded-out
- **AND** the captured output is truncated rather than stored in full.

#### Scenario: Harness execution is authenticated and origin-locked
- **WHEN** the harness endpoint is called without the bearer token or from a disallowed origin
- **THEN** the request is refused before command selection
- **AND** no process is started.

#### Scenario: Concurrency has exact limits
- **WHEN** a host already has a run in progress or two runs are active overall
- **THEN** another conflicting request is refused as busy
- **AND** the configured concurrency bound is not exceeded.

#### Scenario: Stored output carries no absolute paths
- **WHEN** a harness result is cached or returned
- **THEN** absolute filesystem paths are reduced to symbolic references
- **AND** no home-directory path reaches the response.

#### Scenario: Stored output carries no captured credential
- **WHEN** harness output contains a token-shaped value or machine username
- **THEN** that value is redacted before storage and response
- **AND** truncation happens before the bounded output is persisted.

#### Scenario: The root set cannot be widened by a request
- **WHEN** any request attempts to name a repository root
- **THEN** the daemon ignores it and uses its own fixed list
- **AND** a root added to the list is a code change subject to this requirement.

### Requirement: The Workflow Surface Covers Only The Workflow Repositories

The workflow surface SHALL report on the core repository and the host workflow
implementations only. Registered product repositories MUST NOT appear on it, and
their readiness results MUST NOT be derived from it.

Scanner responses SHALL carry fixed repo, host, skill, and artifact identifiers
rather than absolute repository or machine-global paths. The daemon MUST NOT
export or persist the resolved machine paths used by the scanner.

#### Scenario: Product repos are absent
- **WHEN** the workflow surface renders with product repos registered
- **THEN** only the workflow repositories appear
- **AND** no product repo is listed or scored.

#### Scenario: A missing workflow repo is stated, not skipped
- **WHEN** one of the workflow repositories cannot be found on disk
- **THEN** it appears with its absence stated
- **AND** the other repositories are still reported.

#### Scenario: Scanner paths remain daemon-internal
- **WHEN** the workflow response describes a laggard, missing skill, or unreadable artifact
- **THEN** it uses symbolic identifiers and a stable reason code
- **AND** no absolute path or machine username appears in the response.
