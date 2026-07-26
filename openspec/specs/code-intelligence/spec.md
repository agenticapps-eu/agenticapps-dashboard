# code-intelligence Specification

## Purpose

Two external tools build machine-readable maps of a repo: a code-graph indexer
and an LLM-driven knowledge-graph analyser. Both produce artifacts on disk that
are useless if nobody can see whether they exist, whether they are current, or
what they contain.

This capability is the dashboard's surface over both: per-repo status in the
coverage matrix, scoped actions to refresh what can be refreshed headlessly, and
a daemon-hosted viewer for the analysis that has a real UI. The user-facing
capability is "see and refresh code intelligence for a repo"; the two tools are
implementation behind it.

> **⚠ SCHEDULED FOR REMOVAL — GitNexus integration.** The GitNexus half of this
> capability (`Scoped Code-Graph Scan Actions` and the code-graph coverage
> column) is being **removed from the dashboard entirely** — decided 2026-07-26,
> GAP-04. Until that removal ships, the requirements below remain **current
> truth**: the feature works and is in use. Do not extend it; see the active
> change `openspec/changes/remove-gitnexus-integration/`.
>
> Note that removal is a *product* decision, not a consequence of migration
> `0032`. That migration removed GitNexus from the AgenticApps workflow scaffold
> only; the tool itself remains installed and registered as an MCP server, and
> stays available outside the dashboard.
>
> The knowledge-graph viewer half of this capability is **not** affected.

## Requirements

### Requirement: Code-Graph Coverage Status

The coverage matrix SHALL carry a column reporting each repo's code-graph index
state, using the standard four freshness states. Index staleness SHALL be
measured against the age of the last index.

#### Scenario: Index age drives staleness
- **WHEN** a repo's code-graph index is older than the staleness threshold
- **THEN** its cell reports `stale`
- **AND** a repo with no index at all reports `missing`.

#### Scenario: Indexer absent yields a neutral state and a hint
- **WHEN** the code-graph tool is not installed on the machine
- **THEN** every repo's cell reports `not-applicable` rather than red
- **AND** a family-level install hint with a copyable command is offered, without a page-level banner.

### Requirement: Scoped Code-Graph Scan Actions

> Scheduled for removal (GAP-04) — recorded as current truth; do not extend.

The daemon SHALL offer scan actions scoped to a single family or a single repo,
spawning the indexer as a subprocess and returning a job identifier the SPA polls
until completion. On success the coverage cache MUST be invalidated so the cell
updates without user action. The binary MUST be resolved from PATH rather than
invoked through a package runner.

#### Scenario: A scoped scan flips the cell without a reload
- **WHEN** a per-repo scan action completes successfully
- **THEN** the coverage data is invalidated and the repo's cell reflects the new index state
- **AND** the user did not have to reload the page.

#### Scenario: The clipboard fallback survives for the uninstalled case
- **WHEN** the indexer binary is not installed
- **THEN** the surface offers the copyable install command rather than a scan action
- **AND** that fallback path remains available.

### Requirement: Knowledge-Graph Analysis Status

The coverage matrix SHALL carry a column reporting each repo's knowledge-graph
analysis state: analysed, stale, or missing. Staleness SHALL be determined by
comparing the commit recorded in the analysis metadata against the repo's current
head.

#### Scenario: A commit mismatch marks the analysis stale
- **WHEN** a repo's recorded analysis commit differs from its current head commit
- **THEN** the cell reports the analysis as stale
- **AND** offers a copyable command to re-run the analysis.

### Requirement: Analysis Is Not Daemon-Triggered

The daemon SHALL NOT execute knowledge-graph analysis. That analysis is
LLM-driven with no headless binary, so the dashboard surfaces status and a
copyable command only.

#### Scenario: The dashboard offers a command, not an execution
- **WHEN** a repo's analysis is stale or missing
- **THEN** the surface provides a copyable command for the user to run themselves
- **AND** no daemon route spawns the analysis.

### Requirement: Daemon-Hosted Knowledge-Graph Viewer

The daemon SHALL serve a prebuilt static build of the knowledge-graph viewer
per repo, and SHALL re-implement the data endpoints that viewer requires, reading
from each repo's analysis output directory. Opening the viewer MUST happen in a
new tab rather than embedding it in the dashboard shell.

#### Scenario: The viewer opens against a specific repo
- **WHEN** a user opens the viewer for an analysed repo
- **THEN** the daemon serves the viewer assets and its data endpoints scoped to that repo
- **AND** the viewer opens in a new tab.

#### Scenario: The upstream viewer is not modified
- **WHEN** the viewer is installed
- **THEN** it is used as a prebuilt asset
- **AND** no modification is made to the upstream plugin.

### Requirement: Viewer Asset Installation

The daemon SHALL provide a CLI command that builds the viewer from its source
package and installs it under a versioned path in the daemon's own state
directory.

#### Scenario: Viewer assets install under a versioned path
- **WHEN** the viewer install command is run
- **THEN** the built assets are placed under a version-qualified directory in the daemon state directory
- **AND** the daemon serves that installed version.

### Requirement: Code Intelligence Page

The SPA SHALL provide a page listing repos with available code intelligence and
linking to their viewers, reachable from a dedicated sidebar section built with
room for further entries.

#### Scenario: The page lists analysed repos with viewer links
- **WHEN** the code intelligence page loads
- **THEN** it lists repos that have analysis available and links each to its viewer
- **AND** repos without analysis are shown with their status rather than omitted silently.

#### Scenario: Failures offer recovery
- **WHEN** the page's data request fails
- **THEN** it renders a recoverable error state with a retry action
- **AND** does not render a blank page.
