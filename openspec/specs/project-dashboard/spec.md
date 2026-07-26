# project-dashboard Specification

## Purpose

This is the product's original reason to exist: seeing, at a glance and from any
device, what every registered project's pipeline is doing right now — instead of
grepping `.planning/`, `git log`, and skill output per project.

It covers two surfaces built on the same read-only projection. The **multi-project
home** renders one card per registered project. The **single-project view** opens
one project into three columns: discipline state on the left, phase progress in
the centre, skills and tooling health on the right (the right column's contents
are specified in `skills-and-linting` and `optional-integrations`).

Everything here is a *projection of files the daemon read*. No panel writes, and
every panel must degrade to a useful empty state rather than an error.

## Requirements

### Requirement: Multi-Project Home Renders A Card Per Project

The home route SHALL render one card per registered project, each showing the
current phase and its status, review finding counts by severity, and the
last-commit time. Clicking a card MUST navigate to that project's single-project
view.

#### Scenario: Cards summarise every registered project
- **WHEN** the home page loads with several registered projects
- **THEN** each project renders a card with its current phase, phase status, finding counts, and last-commit time
- **AND** clicking a card opens that project's detail view.

#### Scenario: A project without the workflow shows an install hint
- **WHEN** a registered project has no `.planning/` directory
- **THEN** its card states that plainly and offers an install hint
- **AND** does not render an error or a crash state.

### Requirement: Card Data Comes From One Call Per Project

Each home card SHALL be composed from a single `GET /api/projects/{id}/overview`
call, polled on the global cadence, with per-card data freshness surfaced to the
user.

#### Scenario: Freshness is visible
- **WHEN** the home page is polling
- **THEN** each card indicates how fresh its data is
- **AND** a stale card is distinguishable from a current one.

### Requirement: Filtering, Search, And Sort

The home page SHALL provide tag-based filters, free-text search over project
names, and a default sort by tag priority (active, then client, then internal)
followed by last-commit time descending.

#### Scenario: Default ordering surfaces active work first
- **WHEN** the home page renders with no filter applied
- **THEN** projects are ordered by tag priority and then by most recent commit
- **AND** filtering or searching narrows the set without changing that ordering rule.

### Requirement: Register A Project From The Home Page

The home page SHALL offer a register affordance that accepts a path, suggests a
name, and creates the registry entry. The new project MUST appear without a
manual reload.

#### Scenario: Registering from the UI updates the grid
- **WHEN** a user registers a project through the home page affordance
- **THEN** the registry is updated and the project appears in the grid
- **AND** removing a project likewise disappears from the grid immediately.

### Requirement: Single-Project Header Context

The single-project view SHALL show a header carrying the project name and client,
the current branch, and the current phase with its status, plus a link back to
the project list.

#### Scenario: An issue reference links out without an API call
- **WHEN** a Linear-style issue reference is detectable from the branch name or commits
- **THEN** the header renders it as a static link
- **AND** no integration API call is required to render that link.

### Requirement: Discipline State Column

The left column SHALL render the project's workflow discipline state: the most
recent workflow commitment block, recent hook firings drawn from the project's
skill-observation log, and a per-row count of which rationalization-table entries
fired.

#### Scenario: A project without the observer skill shows an install hint
- **WHEN** the project has no skill-observation log because the observer skill is not installed
- **THEN** the panel renders an install hint with a copy-pasteable command
- **AND** does not render an error.

#### Scenario: Recent hook firings are listed newest-first
- **WHEN** the observation log contains hook firing entries
- **THEN** the panel lists the most recent firings
- **AND** each entry identifies which hook fired.

### Requirement: Phase Progress Column

The centre column SHALL render, for the current phase: a file-by-file artifact
checklist, an execution timeline of TDD red/green pairs derived from git history,
two-stage review status with finding counts by severity, security audit status,
and verification status as satisfied must-haves against recorded evidence.

#### Scenario: Artifact presence drives the checklist
- **WHEN** the current phase directory contains some but not all expected artifacts
- **THEN** the checklist marks present artifacts complete and absent ones outstanding
- **AND** the phase's overall status reflects that partial state.

#### Scenario: Finding counts are grouped by severity
- **WHEN** a phase's review artifacts contain severity-tagged findings
- **THEN** the panel reports counts grouped by severity
- **AND** those same counts appear on the project's home card.

### Requirement: Panels Degrade To Empty States

Every panel SHALL either render data or render a graceful empty state carrying a
hint. A panel MUST NOT surface a raw error or crash the view when its underlying
data is absent.

#### Scenario: Missing source data yields a hint, not an error
- **WHEN** any panel's underlying files or logs are absent
- **THEN** it renders an empty state explaining what is missing and how to enable it
- **AND** the rest of the view continues to render normally.

### Requirement: Schema Validation At Both Ends

Every daemon response SHALL be validated against the shared schema on both the
producing and consuming side. A mismatch MUST surface in the SPA as an explicit
schema-drift state rather than a silent misrender.

#### Scenario: A wire mismatch surfaces as schema drift
- **WHEN** a daemon response does not match the shared schema the SPA expects
- **THEN** the SPA renders a schema-drift state naming where the mismatch occurred
- **AND** does not render the malformed payload as though it were valid.

### Requirement: Keyboard Shortcuts

The dashboard SHALL provide keyboard shortcuts for refreshing, focusing search,
and opening help.

#### Scenario: Shortcuts drive the primary actions
- **WHEN** the user presses the refresh, search-focus, or help shortcut
- **THEN** the corresponding action occurs without a pointer
- **AND** the help shortcut navigates to the help landing page.
