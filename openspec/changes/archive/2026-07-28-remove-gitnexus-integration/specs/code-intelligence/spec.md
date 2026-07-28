## MODIFIED Requirements

### Requirement: Knowledge-Graph Analysis Status

The coverage matrix SHALL carry a column reporting each repo's knowledge-graph
analysis state. Its wire values SHALL be `fresh`, `stale`, or `missing`;
`fresh` is presented to the user as analysed. Staleness SHALL be determined by
comparing the commit recorded in the analysis metadata against the repo's
current head. Any copyable re-analysis command SHALL be constructed in the SPA
and MUST NOT round-trip through the daemon.

#### Scenario: A commit mismatch marks the analysis stale
- **WHEN** a repo's recorded analysis commit differs from its current head commit
- **THEN** the cell reports the analysis as stale
- **AND** offers an SPA-constructed copyable command to re-run the analysis.

## REMOVED Requirements

### Requirement: Code-Graph Coverage Status

**Reason**: GitNexus is being removed from the dashboard (GAP-04, 2026-07-26).
The workflow scaffold no longer provisions the indexer, so a fleet-wide column
tracking its index freshness no longer reflects anything the fleet maintains.

**Migration**: The column is removed from every table and card layout, the live
coverage schema, coverage-history response, and health response. Snapshot
readers continue accepting legacy records but ignore the removed field, snapshot
writers stop emitting it, and current and historical conformance scores use the
same surviving measurement set. No user action is required; repos lose a
column, not source data.

### Requirement: Scoped Code-Graph Scan Actions

**Reason**: The scan actions exist only to refresh the code-graph column being
removed above. With no column to refresh, the daemon has no reason to spawn the
indexer, and the read-only posture is simpler without it.

**Migration**: The daemon scan library, both scan and coverage-refresh routes,
the GitNexus health field, job-polling client, scan pill, bulk refresh action,
install hints, and their schemas are deleted. Removed routes return not-found,
the daemon has no path that spawns GitNexus, and no persisted override, cache,
or job record remains. In-flight children are terminated at deployment restart.
Anyone still wanting a code-graph index runs the tool directly; it remains
installed and available as an MCP server outside the dashboard.

The Knowledge-Graph Viewer is implemented by Understand Anything over
`.understand-anything/` artifacts. Its routes, schemas, and static viewer are
not part of this migration.
