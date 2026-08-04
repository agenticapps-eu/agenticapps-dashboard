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
daemon's own directory are left in place so a rollback does not destroy
configuration. Inert means v2 neither reads nor writes them.

**Retention is bounded, owned, and dated — and the rule that says so lives
elsewhere, deliberately.** These files hold integration credentials, and "left in
place for rollback" with no end is indefinite retention of secrets the product no
longer has any use for. The window is the rollback window and no longer: **thirty
days from the cutover release**, after which the files are deleted, with the
deletion carried as a dated task owned by whoever ships the cutover.

**Relocated 2026-08-04 to `filesystem-access-policy` as `Retained Credential
Files Have A Bounded Lifetime`.** This paragraph previously stated the rule
normatively — SHALL and all — inside a requirement this delta *removes*, in a
file whose only heading is `## REMOVED Requirements`. At the fold the requirement
is deleted and the rule with it, so the guarantee would have expired precisely
when the credentials started outliving their feature. It now sits beside the
`0600` mode discipline it complements, in a capability that survives.

Mode `0600` governs **who** can read a file, not **how long** it exists; a
credential retained forever at `0600` is still a credential retained forever.
That distinction is the reason the rule needed a home rather than a mention.

### Requirement: Local Tooling Health Detection

**Reason**: Detecting whether observability tooling is wired up in a project
answers "what is set up here". v2 asks whether the work was done, not which tool
was used, and deliberately keeps tool identity out of the surface.

**Migration**: The detection and its panel are removed, with no dashboard
replacement.

An earlier draft offered one — "a repo wanting such a signal on the dashboard
reports it as a declared check" — and it does not exist. The readiness model
accepts exactly six check identifiers and **silently discards** an entry naming
any other, so a repo declaring observability-tooling health would produce a valid
file, no error, and no check. None of the six carries tool-identity or
tooling-setup meaning, which is the point of the withdrawal rather than an
oversight in it: v2 asks whether the work was done, not which tool was used.

A repo that wants this signal keeps it where the tooling already reports it.

### Requirement: Integration Status Summary

**Reason**: A roll-up of the panels withdrawn above.

**Migration**: None.

### Requirement: No Reimplementation Of Third-Party Products

**Reason**: A constraint on how integrations were allowed to behave. With the
integrations withdrawn, it binds nothing in the literal present — exactly as its
sibling binds nothing, since v2 offers no integrations at all.

**Migration**: Preserved, not dropped. Relocated to surviving `project-dashboard`
as `Third-Party Products Are Integrated, Not Reimplemented`, alongside
`Optional Integrations Never Become Load-Bearing`. Both survive by the same
reasoning in design §7: a standing rule binds the next author without relying on
archive archaeology.

**The asymmetry this entry used to defend is withdrawn (2026-08-04).** The
earlier text kept the two apart on consequence rather than principle — that
load-bearing fails silently while reimplementation "is visible in the diff, in
review, and in the size of the work" — and conceded in the same breath that
design §7's reasoning "applies word for word" to both. It closed by naming its
own remedy: "If that trade is wrong, the fix is to preserve this one too." Two
reviewers, in two separate rounds and from different vendors, judged the trade
wrong on the same ground: the cost of retaining a standing rule is zero, and the
visible-in-review defence assumes a reviewer who already knows the constraint,
which is precisely what archive archaeology fails to supply.

**Migration**: None. If integrations return, this constraint should return with
them.

### Requirement: The Dashboard Works Without Any Integration

**Reason**: The guarantee remains load-bearing, but `optional-integrations` ends
because v2 ships no integration surface.

**Migration**: Restated as `Optional Integrations Never Become Load-Bearing` in
`project-dashboard`; no behavioural guarantee is lost.
