# help-docs Specification

## Purpose

The dashboard visualises a workflow that has a lot of moving parts — phases,
gates, hooks, scan reports, migrations. The help system is where that vocabulary
is explained, in-product, rather than in a README nobody opens.

It is a content system, not a page: authored documents with structured
frontmatter, a navigable shell around them, and slots for interactive widgets
that demonstrate concepts the prose can only describe. Its defining constraint is
that an unfinished section must still render — a stub page is a normal state, not
a broken one.

## Requirements

### Requirement: Authored Documentation Pages

The help system SHALL render authored documentation pages carrying structured
frontmatter (slug, title, section, ordering). Pages MUST support rich content
including tables, links, fenced code blocks, and embedded diagrams.

#### Scenario: An authored page renders its full content
- **WHEN** a documentation page with frontmatter is requested
- **THEN** it renders its content including tables, code blocks, and any embedded diagram
- **AND** its frontmatter determines its title and position in navigation.

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

Help pages SHALL be able to embed named interactive widgets, loaded on demand so
they do not weigh down pages that do not use them. An unknown widget name MUST
render a contained, visible error rather than breaking the page.

#### Scenario: An unknown widget fails contained
- **WHEN** a page references a widget name that is not registered
- **THEN** a bordered error message renders in that widget's place
- **AND** the rest of the page renders normally.

#### Scenario: Widgets load on demand
- **WHEN** a help page containing no widgets is loaded
- **THEN** no widget code is fetched.

### Requirement: Contextual Help Links

The product SHALL provide a mechanism for linking from any surface into a
specific help topic, resolving a topic identifier to its help URL including an
optional anchor.

#### Scenario: A topic resolves to a stable URL
- **WHEN** a topic identifier is resolved
- **THEN** it produces the corresponding help path, including an anchor when one is specified.

### Requirement: Keyboard Shortcut Reference

The help system SHALL document the product's keyboard shortcuts as a
documentation page, and the help keyboard shortcut SHALL navigate to the help
landing page.

#### Scenario: The help shortcut opens the landing page
- **WHEN** the user presses the help shortcut
- **THEN** the help landing page opens
- **AND** the shortcut reference is reachable from there as a documentation page.
