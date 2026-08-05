# help-docs Specification

## Purpose

The dashboard visualises a workflow that has a lot of moving parts — readiness
checks and their status vocabulary, change lifecycle stages, conformance
comparisons, provenance tiers, freshness. The help system is where that
vocabulary is explained, in-product, rather than in a README nobody opens.

It is a content system, not a page: authored documents with structured
frontmatter, a navigable shell around them, and slots for interactive widgets
that demonstrate concepts the prose can only describe. Its defining constraint is
that an unfinished section must still render — a stub page is a normal state, not
a broken one.

## Requirements

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

### Requirement: Stub Pages Render Rather Than Break

Documented-but-unwritten paths SHALL render an explicit "coming soon" state
carrying the section and title, with a working back-link. A stub MUST NOT crash
or 404.

#### Scenario: An unwritten page is a normal state
- **WHEN** a user navigates to a documented path that has no content yet
- **THEN** the page renders a coming-soon state with its section and title and a working back-link
- **AND** the console reports no error.

### Requirement: Help Navigation Shell

The help system SHALL provide a layout with section navigation and a content
region. Navigation MUST be usable at small viewports, collapsing to a drawer,
and persistent at desktop widths.

#### Scenario: Navigation adapts to viewport
- **WHEN** the help layout renders at a small viewport
- **THEN** its navigation is available as a collapsible drawer
- **AND** at desktop widths it is persistently visible alongside the content.

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

### Requirement: Keyboard Shortcut Reference

The help system SHALL document the product's keyboard shortcuts as a
documentation page, and the help keyboard shortcut SHALL navigate to the help
landing page.

#### Scenario: The help shortcut opens the landing page
- **WHEN** the user presses the help shortcut
- **THEN** the help landing page opens
- **AND** the shortcut reference is reachable from there as a documentation page.
