## ADDED Requirements

> **This capability was listed as untouched by this change, and is not.** The
> proposal already records one correction of that claim: the sibling
> `add-workflow-fleet-conformance` delta replaces the process-spawn authorization
> with an exhaustive four-site list and adds a machine-wide allowed root. This is
> the second, and it originates here rather than in a sibling.
>
> The requirement below was written inside the `optional-integrations` delta,
> under `Environment Configuration Without A Secret Store` — a requirement that
> delta **removes**, in a file whose only heading is `## REMOVED Requirements`.
> A normative retention rule written into text that is being deleted does not
> survive the fold. Two reviewers found it independently, and both were right: the
> guarantee would have vanished at exactly the moment it started to matter.
>
> It lands here because this capability already owns the other half of the
> statement. `Daemon Writes Confined To Its Own Directory` fixes the mode of these
> files at `0600`; nothing fixed how long they exist. Mode governs **who** can
> read a file, not **how long** it is readable, and a credential retained forever
> at `0600` is still a credential retained forever.

### Requirement: Retained Credential Files Have A Bounded Lifetime

Where the daemon retains a file containing third-party credentials after the
feature that required it is withdrawn, that retention SHALL be bounded, owned,
and dated. The retention window SHALL be the rollback window and no longer, and
the change that withdraws the feature SHALL name the deletion as one of its own
tasks with a deadline expressed as a literal date and an owner who is a person
shipping that change.

Retention MUST NOT be deferred to unscheduled cleanup. "Left in place for
rollback" with no end is indefinite retention of secrets the product has no
remaining use for, and an obligation assigned to nobody is discharged by nobody.

For the withdrawal of the optional integrations, the window is **thirty days from
the cutover release**, after which the integration environment files under the
daemon's own directory SHALL be deleted.

This requirement is about lifetime alone. It neither relaxes nor restates the
file-mode discipline in `Daemon Writes Confined To Its Own Directory`, which
continues to govern access for as long as a retained file exists.

#### Scenario: A withdrawn integration's credentials do not outlive its rollback window
- **WHEN** a feature holding third-party credentials is withdrawn and its files are retained for rollback
- **THEN** the withdrawing change carries a deletion task with a literal date and a named owner
- **AND** the files are deleted when the window closes rather than remaining indefinitely.

#### Scenario: Mode is not accepted as a substitute for lifetime
- **WHEN** a retained credential file is written at mode `0600`
- **THEN** the retention requirement is still unmet until a window, an owner, and a date exist
- **AND** restricting who can read the file is not treated as a decision about how long it is kept.

#### Scenario: Cleanup is not deferred to nobody
- **WHEN** a change proposes to retain credential files and record their deletion as separate cleanup
- **THEN** the retention is non-conformant until the deletion is a dated task in that change
- **AND** the obligation cannot be discharged by naming a future change that does not exist.
