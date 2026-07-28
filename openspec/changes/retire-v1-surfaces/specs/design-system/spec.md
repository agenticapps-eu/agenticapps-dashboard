## ADDED Requirements

> **The Impeccable composite-score floor is deliberately not a requirement
> here.** The ratified capability map lists the critique ritual and its floor
> under *deliberate exclusions*, and this capability's own preamble states that
> the ritual and its score are process, not product, living in `CLAUDE.md` and
> `docs/WORKFLOW.md`. Raising the floor is real work and is tracked as AGE-476;
> it is a change to how work is verified, not to what the product guarantees.
> What is added below is the *outcome* that ritual protects, which is what
> belongs in a spec.

### Requirement: State Is Never Signalled By Colour Alone

Any element that communicates a state SHALL encode that state through at least
one channel besides colour — shape, fill, pattern, glyph, or text. A user who
does not perceive the colour difference MUST be able to distinguish every state.

#### Scenario: Every state is distinguishable without colour
- **WHEN** a state-bearing element renders and colour information is unavailable
- **THEN** each distinct state remains distinguishable from every other
- **AND** no state is identified only by its hue.

### Requirement: Dense Rows And Aligned Figures

Every surface SHALL fit horizontally at the declared verification viewports
without page-level horizontal scrolling. At the reference viewport, list and
table surfaces SHALL use a compact, uniform row height so that a fifteen-row
working set is visible without scrolling, and numeric columns SHALL use tabular
figures so that digits align vertically. At the `xs` viewport a logical row MAY
wrap its fields internally, but it MUST remain one list item rather than becoming
a card and every required field MUST remain available.

The **reference viewport** for density guarantees is 1440×900, matching the
design critique. Responsive fit SHALL also be verified at the smallest declared
breakpoint; a width breakpoint alone is not used to assert vertical fit. The
smallest named breakpoint is `xs` below 640 CSS pixels, and its representative
verification viewport is 390×844.

#### Scenario: A working set fits on one screen
- **WHEN** a list surface renders fifteen rows at the reference viewport
- **THEN** all of them are visible without scrolling
- **AND** every row is the same height, rather than a card-sized block.

#### Scenario: Numbers in a column line up
- **WHEN** a column carries version numbers, percentages, or counts
- **THEN** the digits align vertically between rows
- **AND** the column width does not shift as values change.

#### Scenario: No horizontal scrolling at the reference viewport
- **WHEN** any surface renders at the reference viewport
- **THEN** its content fits without horizontal scrolling.

#### Scenario: The smallest breakpoint has a deliberate layout
- **WHEN** a surface renders at the 390×844 representative `xs` viewport
- **THEN** a list may wrap fields within each logical row without becoming a card or hiding required fields
- **AND** the page has no horizontal scrolling
- **AND** interactive controls remain reachable.

### Requirement: A Bounded Type Scale

The product SHALL draw interface text from one declared family and code,
commands, and tabular machine text from one declared monospace family. Sizes and
weights SHALL come from enumerated design tokens; a component MUST NOT introduce
a value outside them.

#### Scenario: The scale is enumerable
- **WHEN** the design tokens are inspected
- **THEN** the permitted sizes and weights are enumerated there as named tokens.

### Requirement: A Value Is Shown Where One Exists

Where a state has an underlying value — a version, a percentage, a count — that
value SHALL be rendered alongside the state indicator rather than replaced by it.
Colour and shape summarise; they do not substitute for the number.

#### Scenario: The number is not hidden behind an indicator
- **WHEN** a state carries an underlying value
- **THEN** the value is rendered in the cell together with the state indicator.

#### Scenario: Absence is not rendered as a value
- **WHEN** a state has no underlying value because none exists
- **THEN** a single canonical absence marker is rendered — an em dash, used consistently across every surface
- **AND** no placeholder number, empty string, or zero is shown in its place.

#### Scenario: Absence is distinguishable from a failed render
- **WHEN** the absence marker appears in a cell
- **THEN** it is visibly a deliberate marker rather than a blank
- **AND** a reader can tell "there is no value here" from "this did not render".

## MODIFIED Requirements

> This is a substantive replacement of the baseline shell requirement: it
> preserves the shared authenticated shell, navigation primitive, indentation,
> and peer ordering while fixing the grouping to exactly two labelled sections,
> forbidding registered-project entries, and requiring a non-colour-only current
> marker. The product-content group carries the v2 content routes; the utility
> group carries help plus settings/account destinations.

### Requirement: App Shell And Sidebar Information Architecture

The product SHALL render its authenticated routes inside a shared application
shell. Its sidebar SHALL present navigation grouped into exactly two labelled
sections: product content and utilities. Help and settings/account destinations
SHALL appear in utilities rather than being treated as product content. Entries
within each section SHALL use the same navigation primitive and indentation. The
sidebar MUST NOT enumerate individual registered projects; the fleet surface is
that list. New destinations SHALL be added as peers within the appropriate
section without reordering existing peers unless a later
information-architecture change says so.

#### Scenario: Navigation is grouped into two sections
- **WHEN** an authenticated route renders inside the shared shell
- **THEN** product content appears under one labelled section and help plus settings/account destinations under utilities
- **AND** no third navigation section is present.

#### Scenario: The sidebar does not list projects
- **WHEN** many projects are registered
- **THEN** the sidebar's height is unchanged by their number
- **AND** the projects are reached through the fleet surface.

#### Scenario: The current surface is indicated
- **WHEN** a surface is active
- **THEN** its navigation entry is marked as current
- **AND** the marking does not rely on colour alone.

#### Scenario: Adding a destination preserves peer order
- **WHEN** a new content or utility destination is added
- **THEN** it appears in the matching section using the same navigation primitive and indentation as its siblings
- **AND** existing peer ordering remains unchanged.
