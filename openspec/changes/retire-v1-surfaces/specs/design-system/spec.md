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

#### Scenario: A hue-only indicator fails the requirement
- **WHEN** a status indicator distinguishes its states only by changing hue, with identical shape, fill, glyph, and text
- **THEN** it does not satisfy this requirement
- **AND** it must gain a second channel before it ships.

### Requirement: Dense Rows And Aligned Figures

List and table surfaces SHALL use a compact, uniform row height so that a working
set of repositories is legible without repeated scrolling, and numeric columns
SHALL use tabular figures so that digits align vertically.

The **reference viewport** for these guarantees is the largest declared
breakpoint. Where a scenario below says "at the reference viewport", it means
that breakpoint, which is the width the product is designed against and the one
the design critique is run at.

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

### Requirement: A Bounded Type Scale

The product SHALL draw all text from a single type family, from a declared set of
sizes, and from a declared set of weights. The sets SHALL be enumerated in the
design tokens, and a component MUST NOT introduce a size or weight outside them.

#### Scenario: The scale is enumerable
- **WHEN** the design tokens are inspected
- **THEN** the permitted sizes and weights are enumerated there as named tokens.

#### Scenario: An off-scale value does not ship
- **WHEN** a component declares a font size or weight that is not one of the named tokens
- **THEN** it violates this requirement
- **AND** the value must be replaced by a token or the scale extended deliberately.

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

### Requirement: App Shell And Sidebar Information Architecture

The application shell SHALL present navigation grouped into two labelled
sections: the content surfaces, and account-level surfaces. The sidebar MUST NOT
enumerate individual registered projects; the fleet surface is that list.

#### Scenario: Navigation is grouped into two sections
- **WHEN** the shell renders
- **THEN** content surfaces appear under one labelled section and account-level surfaces under another
- **AND** no third navigation section is present.

#### Scenario: The sidebar does not list projects
- **WHEN** many projects are registered
- **THEN** the sidebar's height is unchanged by their number
- **AND** the projects are reached through the fleet surface.

#### Scenario: The current surface is indicated
- **WHEN** a surface is active
- **THEN** its navigation entry is marked as current
- **AND** the marking does not rely on colour alone.
