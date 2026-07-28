## MODIFIED Requirements

> The product content surfaces after the atomic cutover are supplied by the
> prerequisite changes: fleet and repo detail by `add-repo-readiness`, and
> workflow conformance by `add-workflow-fleet-conformance`. The agent-change
> surface is a further prerequisite with no change proposed for it yet —
> `add-agent-board` was withdrawn on 2026-07-28 — and the cutover does not run
> until it exists. This change owns the fold-time documentation coverage check,
> which is written against whichever surfaces exist at fold time rather than a
> fixed count.

### Requirement: Authored Documentation Pages

The help system SHALL carry authored pages with structured frontmatter (`slug`,
`title`, `section`, `ordering`) for each product content surface and for
cross-cutting references such as keyboard shortcuts. Pages MUST support tables,
links, fenced code blocks, and diagrams. A page whose only subject is a
withdrawn surface MUST be removed; documented-but-unwritten paths may remain as
the explicit stubs governed by the existing stub requirement.

#### Scenario: Pages match the surfaces
- **WHEN** the help index renders
- **THEN** every current content surface has an authored page and cross-cutting references remain reachable
- **AND** no authored page exists solely for a withdrawn surface.

#### Scenario: Authored content keeps its structure
- **WHEN** an authored page renders
- **THEN** its frontmatter determines its title and navigation position
- **AND** tables, links, code blocks, and diagrams render without loss.

#### Scenario: Each page explains its surface's vocabulary
- **WHEN** a help page for a surface is read
- **THEN** it explains what that surface answers and the vocabulary it uses to answer it.

### Requirement: Embeddable Interactive Widgets

The help system SHALL provide a mechanism for pages to embed named interactive
widgets, loaded on demand. Individual pages MAY use that mechanism. A widget
SHALL exist only for a surface that exists; widgets for withdrawn surfaces MUST
be removed along with their dispatch entries. An unknown widget name MUST render
a contained visible error without breaking the page.

#### Scenario: No widget outlives its surface
- **WHEN** the widget dispatch table is inspected
- **THEN** every entry resolves to a surface the product currently has
- **AND** no entry points at a withdrawn surface.

#### Scenario: Widgets load on demand
- **WHEN** a help page carrying a widget is opened
- **THEN** the widget's code is loaded at that point
- **AND** it is not included in the initial application payload.

#### Scenario: An unknown widget fails contained
- **WHEN** a page references an unregistered widget
- **THEN** a contained error renders in the widget's place
- **AND** the rest of the page remains usable.

### Requirement: Contextual Help Links

The product SHALL provide a mechanism that resolves a help-topic identifier to
an authored help page and optional anchor. Content surfaces MAY use that
mechanism to link to the page describing them. Every such link MUST resolve to
an authored page and, where an anchor is specified, that anchor; a link to a
removed page MUST be removed with it.

#### Scenario: Contextual links resolve
- **WHEN** a contextual help link is followed from any surface
- **THEN** an authored page opens
- **AND** any specified anchor resolves rather than falling back to the page top.
