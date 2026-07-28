## REMOVED Requirements

> The other two requirements of this capability — `Code-Graph Coverage Status`
> and `Scoped Code-Graph Scan Actions` — are withdrawn upstream by
> `remove-gitnexus-integration`, which applies before this change. Listing them
> again here would withdraw them twice. With the five below, the capability ends
> rather than being thinned: nothing remains under `code-intelligence`.
> The upstream change's statement that the viewer is unaffected means unaffected
> by that earlier GitNexus-only removal. It does not survive this later cutover:
> the five requirements below explicitly withdraw the remaining viewer half.

### Requirement: Knowledge-Graph Analysis Status

**Reason**: v2 asks one question per repo — is it production-ready — and answers
it with six checks. Whether a third-party knowledge graph has been generated is
not one of them, and no readiness check depends on it. The surface is withdrawn
because the product's question changed, not because the analysis stopped working.

**Migration**: The status is no longer reported anywhere in the dashboard. The
analysis tool remains installed and usable outside the dashboard; anyone wanting
its state runs it directly.

### Requirement: Analysis Is Not Daemon-Triggered

**Reason**: A constraint on a surface that no longer exists. With no
knowledge-graph analysis reported, there is no trigger to constrain. The
principle it protected — that the daemon does not spawn expensive third-party
work on a render — survives as an explicit requirement in
`workflow-fleet-conformance`, which is the only remaining product-analysis
surface that runs a harness.

**Migration**: None. The rule is carried forward where it still binds.

### Requirement: Daemon-Hosted Knowledge-Graph Viewer

**Reason**: The daemon hosted a prebuilt third-party viewer and re-implemented
its read endpoints so the graph could be browsed inside the dashboard. v2 has no
place for a hosted third-party application: the dashboard reports state, and
browsing a code graph is a different tool's job.

**Migration**: The viewer, its asset serving, and its six read endpoints are
removed from the daemon. The upstream tool remains available and hosts its own
viewer.

### Requirement: Viewer Asset Installation

**Reason**: Exists only to install assets for the viewer withdrawn above.

**Migration**: The installation path and its asset directory are removed. Nothing
under a registered project's root was ever written by it, so no project is
affected.

### Requirement: Code Intelligence Page

**Reason**: The page is the container for the two halves of this capability. One
half is withdrawn by `remove-gitnexus-integration`, the other by the requirements
above. An empty container is not a surface.

**Migration**: The route is removed and its sidebar entry disappears with it. v2's
information architecture has four content routes; this is not among them.
