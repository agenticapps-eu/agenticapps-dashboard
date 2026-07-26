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

#### Scenario: The rule holds across surfaces
- **WHEN** any surface renders state indicators
- **THEN** the second channel is present on all of them
- **AND** no surface opts out.

### Requirement: Dense Rows And Aligned Figures

List and table surfaces SHALL use a compact row rhythm so that a working set of
repositories is legible without repeated scrolling, and numeric columns SHALL use
tabular figures so that digits align vertically. Typography SHALL stay within one
family, a small set of sizes, and a small set of weights.

#### Scenario: A working set fits on one screen
- **WHEN** a list surface renders a typical number of rows at the reference width
- **THEN** they are readable without repeated scrolling
- **AND** rows follow one consistent height rather than card-sized blocks.

#### Scenario: Numbers in a column line up
- **WHEN** a column carries version numbers, percentages, or counts
- **THEN** the digits align vertically between rows
- **AND** the column width does not shift as values change.

#### Scenario: No horizontal scrolling at the reference width
- **WHEN** any surface renders at the reference width
- **THEN** its content fits without horizontal scrolling.

### Requirement: A Value Is Shown Where One Exists

Where a state has an underlying value — a version, a percentage, a count — that
value SHALL be rendered alongside the state indicator rather than replaced by it.
Colour and shape summarise; they do not substitute for the number.

#### Scenario: The number is not hidden behind an indicator
- **WHEN** a state carries an underlying value
- **THEN** the value is rendered in the cell together with the state indicator.

#### Scenario: Absence is not rendered as a value
- **WHEN** a state has no underlying value because none exists
- **THEN** an absence marker is rendered
- **AND** no placeholder number is shown in its place.

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
