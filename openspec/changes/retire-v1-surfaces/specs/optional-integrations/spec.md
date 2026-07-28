## REMOVED Requirements

> v2 has no third-party integrations at all. Every panel and requirement in this
> capability is withdrawn. The standing no-integration invariant moves to the
> surviving `project-dashboard` capability so the guarantee remains without
> leaving an otherwise-ended capability alive.

### Requirement: Unconfigured Panels Explain Themselves

**Reason**: There are no integration panels. The underlying principle — a surface
that cannot show data says why — is not lost: `repo-readiness` requires that
every never-run check carries an instruction for making it run, which is the same
idea applied to what v2 actually renders.

**Migration**: Superseded by the remedy-text requirement in `repo-readiness`.

### Requirement: Unconfigured Routes Are Distinguishable From Failures

**Reason**: The distinction it protects is real and survives, restated for the
readiness model: `never` and `na` are distinct first-class states, separate from
`fail`, and an evaluation error is required to be distinguishable from a check
that never ran.

**Migration**: Superseded by the status vocabulary and the absent-data
requirements in `repo-readiness`.

### Requirement: Integration Failures Degrade To Cached Data

**Reason**: A resilience contract for network calls the product no longer makes.
v2's failure mode is local and specified where it now applies: a failing deriver
degrades that one check, and a failing repo does not remove the rest of the fleet.

**Migration**: Superseded by the per-check and per-repo degradation requirement
in `repo-readiness`.

### Requirement: Error Tracking Panel

**Reason**: v2 does not report third-party service state. Error tracking is
answered in the error tracker, not mirrored here.

**Migration**: The panel and its route are removed.

### Requirement: Issue Tracker Panel And Static Linking

**Reason**: The issue tracker is where issues live; this dashboard is where state
lives. Mixing them is a large part of why the old project view accumulated twelve
panels. Reintroducing a link is a separate decision with its own justification,
not a side effect of this teardown.

**Migration**: The panel and its route are removed. Static issue links derived
from branch names are removed with the header requirement they belonged to.

### Requirement: Secrets Manager Status Reflection Only

**Reason**: Secrets management is a separate product. The dashboard's read-only
status reflection was always the smallest possible surface over it, and v2 keeps
none of it.

**Migration**: The panel and its route are removed. No secret was ever read or
written by this surface, so nothing changes about secret handling.

### Requirement: Environment Configuration Without A Secret Store

**Reason**: The local environment file exists to configure the integrations being
withdrawn. With no integration to configure, it has no consumer.

**Migration**: The management surface is removed. Existing files under the
daemon's own directory are left in place for rollback rather than deleted. Inert
means v2 neither reads nor writes them. Deletion or archival requires separate
cleanup with an explicit retention decision. The daemon's file-mode discipline
in `filesystem-access-policy` is unaffected.

### Requirement: Local Tooling Health Detection

**Reason**: Detecting whether observability tooling is wired up in a project
answers "what is set up here". v2 asks whether the work was done, not which tool
was used, and deliberately keeps tool identity out of the surface.

**Migration**: The detection and its panel are removed. A repo wanting such a
signal on the dashboard reports it as a declared check.

### Requirement: Integration Status Summary

**Reason**: A roll-up of the panels withdrawn above.

**Migration**: None.

### Requirement: No Reimplementation Of Third-Party Products

**Reason**: A constraint on how integrations were allowed to behave. With the
integrations withdrawn, it binds nothing. Its spirit is visible elsewhere in v2 —
the knowledge-graph viewer is withdrawn for exactly this reason, and the board is
read-only rather than a control plane — but it is not restated as a standing rule
here.

**Migration**: None. If integrations return, this constraint should return with
them.

### Requirement: The Dashboard Works Without Any Integration

**Reason**: The guarantee remains load-bearing, but `optional-integrations` ends
because v2 ships no integration surface.

**Migration**: Restated as `Optional Integrations Never Become Load-Bearing` in
`project-dashboard`; no behavioural guarantee is lost.
