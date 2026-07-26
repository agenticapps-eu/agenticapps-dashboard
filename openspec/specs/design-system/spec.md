# design-system Specification

## Purpose

The dashboard is a tool someone looks at many times a day, so its visual layer is
held to a contract rather than left to per-page judgement. This capability owns
that contract: the design tokens every surface draws from, the accessibility
floors those tokens must clear, the shared interaction primitives, and the app
shell and navigation structure.

The important part is that these are **enforced**, not aspirational. Colour
contrast is asserted in the test suite, so a token edit that regresses legibility
fails CI rather than shipping. Layout widths come from one shared source, so
sections cannot drift apart.

The per-phase design critique ritual and its composite-score floor are **process**,
not product, and live in `CLAUDE.md` / `docs/WORKFLOW.md`. What is specified here
is the outcome that ritual protects.

## Requirements

### Requirement: Design Tokens Are The Single Source Of Colour

All colour SHALL be drawn from named design tokens. Raw colour literals MUST NOT
be introduced in components.

#### Scenario: Components consume tokens, not literals
- **WHEN** a component needs a colour
- **THEN** it references a design token
- **AND** the token source-of-truth assertion continues to pass.

### Requirement: Enforced Colour Contrast Floors

Every text token SHALL meet its WCAG contrast floor against every background it
renders on, and this MUST be asserted by an automated test that runs in CI. Text
tiers MUST remain visually distinguishable from one another.

#### Scenario: A contrast-regressing token edit fails CI
- **WHEN** a text token is changed such that it no longer clears its contrast floor against a background surface
- **THEN** the contrast test fails
- **AND** the change cannot merge on a green pipeline.

#### Scenario: Tier separation is preserved
- **WHEN** text tokens are adjusted to meet contrast floors
- **THEN** each tier remains perceptibly distinct from its neighbours
- **AND** raising a lower tier does not collapse it into the tier above.

### Requirement: Consistent Table Column Widths

Where the same tabular structure repeats across sections, column widths SHALL
derive from a single shared definition so corresponding columns align across every
section.

#### Scenario: Repeated sections align
- **WHEN** several sections of the same table structure render together
- **THEN** each corresponding column has identical width across all of them
- **AND** those widths come from one shared definition rather than per-section values.

### Requirement: Sticky Page Headers Are Opt-In

The page header SHALL support a sticky mode that routes opt into explicitly.
Non-opted routes MUST retain their existing non-sticky behaviour. A sticky header
MUST have an opaque backing so content does not bleed through it.

#### Scenario: Opting in does not change other routes
- **WHEN** one route opts its page header into sticky mode
- **THEN** that route's header remains visible while scrolling with an opaque backing
- **AND** routes that have not opted in are unchanged.

#### Scenario: Controls in a sticky header stay reachable
- **WHEN** a surface places its filter controls inside a sticky header
- **THEN** those controls remain visible at every scroll position
- **AND** layering offsets track the header's measured height rather than a hardcoded value.

### Requirement: Toast Feedback Primitive

The product SHALL provide a toast primitive for transient feedback, available to
every authenticated route. Toasts SHALL distinguish success from error, announce
themselves to assistive technology with an urgency matching their severity, and
replace rather than queue when a new one arrives.

#### Scenario: Every clipboard action confirms visibly
- **WHEN** a user triggers any copy-to-clipboard action
- **THEN** a toast confirms the copy promptly
- **AND** a failed copy shows the error variant instead.

#### Scenario: Assistive technology hears the right urgency
- **WHEN** a success toast and an error toast are shown
- **THEN** the success announces politely and the error announces assertively.

#### Scenario: A rapid second toast replaces the first
- **WHEN** a second toast is triggered while one is visible
- **THEN** it replaces the current toast
- **AND** no queue of pending toasts accumulates.

### Requirement: Viewport Breakpoint Awareness

The product SHALL expose the current viewport breakpoint to components in a way
that is safe under concurrent rendering and does not emit an event storm during
resize.

#### Scenario: Resizing does not flood the app with updates
- **WHEN** the user drags the window to resize it across a breakpoint
- **THEN** components observing the breakpoint update only as breakpoints actually change
- **AND** they do not re-render per resize frame.

### Requirement: Accessible Touch Targets

Interactive controls on surfaces intended for touch use SHALL meet a minimum
touch-target size.

#### Scenario: Touch controls are large enough
- **WHEN** an interactive control renders on a touch-oriented layout
- **THEN** its hit area meets the minimum accessible touch-target size.

### Requirement: Discoverable Affordances

Row-level actions SHALL remain perceptible before interaction rather than being
fully hidden until hover, and MUST reach full prominence on hover or keyboard
focus.

#### Scenario: A row action is visible before hover
- **WHEN** a row with an action renders without pointer interaction
- **THEN** the action is faintly but perceptibly visible
- **AND** it reaches full prominence on hover or focus.

### Requirement: App Shell And Sidebar Information Architecture

The product SHALL render its authenticated routes inside a shared shell with
sidebar navigation grouped into sections. New destinations SHALL be added as peer
entries within the appropriate section, preserving existing ordering, rather than
reorganising established navigation.

#### Scenario: A new destination is added without reordering
- **WHEN** a new page joins an existing sidebar section
- **THEN** it is appended as a peer entry using the same navigation primitive as its siblings
- **AND** the existing entries keep their order and indentation.

### Requirement: Theme Support

The product SHALL default to a dark appearance and offer a light alternative.

#### Scenario: The user can switch appearance
- **WHEN** the user changes the theme setting
- **THEN** the interface renders in the chosen appearance
- **AND** the choice persists across reloads.
