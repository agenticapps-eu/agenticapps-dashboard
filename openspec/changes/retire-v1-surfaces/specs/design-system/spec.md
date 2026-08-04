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
without page-level horizontal scrolling. List and table surfaces SHALL use a
compact, uniform row height, and numeric columns SHALL use tabular figures so
that digits align vertically. At the `xs` viewport a logical row MAY wrap its
fields internally, but it MUST remain one list item rather than becoming a card
and every required field MUST remain available.

**Density SHALL be specified as a row height, not as a row count that fits a
screen.** The binding constraint is a maximum height per row in CSS pixels,
verifiable by measuring one row. "A fifteen-row working set is visible without
scrolling" was the earlier phrasing and it is not a property of the design: the
same stylesheet passes or fails it depending on browser chrome, OS font scaling,
zoom level, and whether a bookmarks bar is open. A requirement that a correct
implementation can fail for reasons outside the page cannot be met deliberately,
only met by luck.

The row-count figure is retained as the **intent** the height is chosen to serve
— roughly a fifteen-row working set at the reference viewport in a typical
browser — and SHALL NOT be used as the pass condition.

**The density clause binds list and table surfaces; the fit and alignment
clauses bind every surface.** The scoping is stated rather than inferred,
because `add-agent-change-board` adds a kanban board of cards and the sentence
"every row is the same height, rather than a card-sized block" reads as
anti-card in general. It is not: it governs surfaces whose unit of information
is a **row**, where a card-sized block is a density regression against a
directly comparable alternative. A kanban column's unit is a card, chosen over
a dense table deliberately and with the trade-off recorded (that change's design
decision 6 — stage as a *place* rather than a value scanned for, matching the
terminal board this fleet already uses).

What the board is **not** exempt from, and must satisfy: no page-level
horizontal scrolling at either verification viewport, and tabular figures on its
numeric values so counts align between cards. Both are asserted in that change's
own tests. The exemption is from uniform row height alone.

The **reference viewport** for density guarantees is 1440×900, matching the
design critique. Responsive fit SHALL also be verified at the smallest declared
breakpoint; a width breakpoint alone is not used to assert vertical fit. The
smallest named breakpoint is `xs` below 640 CSS pixels, and its representative
verification viewport is 390×844.

#### Scenario: A row is no taller than the density budget
- **WHEN** a row on a list or table surface is measured
- **THEN** its height is at or below the declared maximum
- **AND** every row is the same height, rather than a card-sized block.

#### Scenario: A card surface is bound by fit and alignment but not by row height
- **WHEN** a surface whose unit of information is a card rather than a row renders, such as the lifecycle change board
- **THEN** the uniform-row-height requirement does not apply to it
- **AND** it still fits without page-level horizontal scrolling at every declared verification viewport
- **AND** its numeric values still use tabular figures.

#### Scenario: Density does not depend on the viewer's browser furniture
- **WHEN** the same surface is rendered with a bookmarks bar open, at a non-default OS font scale, or at a zoom level other than 100%
- **THEN** it still satisfies the density requirement, because the requirement is a measured row height
- **AND** conformance does not change with conditions the stylesheet does not control.

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
