## REMOVED Requirements

### Requirement: Global And Project-Local Skill Inventory

**Reason**: Listing which skills are installed answers "what is set up here",
which is not one of v2's three questions. The only part of it that fed a decision
— whether a repo's workflow skill is current — becomes the `workflow` readiness
check, which reports a version comparison rather than an inventory.

**Migration**: The inventory surface is removed. Workflow currency per repo moves
to the `workflow` check in `repo-readiness`; workflow currency across the four
hosts moves to `workflow-fleet-conformance`.

### Requirement: AgentLinter Integration

**Reason**: The dashboard ran a linter subprocess against a project and rendered
its findings. v2 reports whether reviews and checks have run, not what a
particular tool found. Which tool satisfies a check is deliberately outside the
UI, and embedding one tool's output contradicts that.

**Migration**: The subprocess, its cache, and its panel are removed. The linter
remains usable directly, and a repo that wants its result on the dashboard
reports it through its readiness file as a declared check.

### Requirement: Cross-Repo Skill Drift Matrix

**Reason**: The useful half of this — drift between the workflow skill
implementations — survives and is sharpened in `workflow-fleet-conformance`,
which reports drift *per skill* rather than per repo and names the laggards. The
2026-07-26 measurement showed why that distinction matters: every host's primary
skill agreed, and three of four hosts were nonetheless dragging skills behind.
The general cross-repo matrix over all skills is withdrawn.

**Migration**: Workflow-skill drift is reported on the workflow surface with a
minimum-to-maximum range and named laggard skills. Drift in non-workflow skills
has no successor surface.

### Requirement: Skill Drift Surface

**Reason**: The page hosting the withdrawn matrix.

**Migration**: The route is removed. Its one durable finding has a better home on
the workflow surface.

### Requirement: Filter State Is Deep-Linkable

**Reason**: A URL contract for the withdrawn surface's filters.

**Migration**: None here. Deep-linking on v2's fleet surface, if wanted, is a
property of that surface and would be specified against it.
