## REMOVED Requirements

### Requirement: Code-Graph Coverage Status

**Reason**: GitNexus is being removed from the dashboard (GAP-04, 2026-07-26).
The workflow scaffold no longer provisions the indexer, so a fleet-wide column
tracking its index freshness no longer reflects anything the fleet maintains.

**Migration**: The column is removed from the coverage matrix, the shared
coverage schema, and the conformance scoring input set. Historical conformance
scores are left as recorded and the 90-day trend will show a step at the cutover
— accepted, because `retire-v1-surfaces` withdraws the conformance page, the
chart, and the snapshot history in full. See the descope note in this change's
proposal. No user action is required; repos lose a column, not data.

### Requirement: Scoped Code-Graph Scan Actions

**Reason**: The scan actions exist only to refresh the code-graph column being
removed above. With no column to refresh, the daemon has no reason to spawn the
indexer, and the read-only posture is simpler without it.

**Migration**: The daemon scan library, its routes, the job-polling client, the
scan pill, and the install-hint button are deleted. Anyone still wanting a
code-graph index runs the tool directly; it remains installed and available as an
MCP server outside the dashboard.
