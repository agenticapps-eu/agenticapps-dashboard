# code-intelligence Specification

## Purpose

Understand Anything builds an LLM-driven, machine-readable knowledge graph for
a repo. This capability makes that analysis visible: per-repo status in the
coverage matrix, an SPA-constructed command for running or refreshing analysis,
and a daemon-hosted viewer for inspecting the generated artifacts.

## Requirements

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
