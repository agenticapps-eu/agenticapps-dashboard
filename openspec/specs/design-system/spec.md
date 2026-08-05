# design-system Specification

## Purpose

The dashboard is a tool someone looks at many times a day, so its visual layer is
held to a contract rather than left to per-page judgement. This capability owns
that contract: the design tokens every surface draws from, the accessibility
floors those tokens must clear, the type scale and density budget every surface
works within, the shared interaction primitives, and the app shell and navigation
structure.

The important part is that these are **enforced**, not aspirational. Colour
contrast is asserted in the test suite, so a token edit that regresses legibility
fails CI rather than shipping. Layout widths come from one shared source, so
sections cannot drift apart. The type scale resets each Tailwind namespace to
`initial`, so a size outside the enumeration generates no CSS at all rather than
quietly working.

The per-change design critique ritual and its composite-score floor are
**process**, not product, and live in `CLAUDE.md` / `docs/WORKFLOW.md`; the
ratified capability map lists them under deliberate exclusions. What is specified
here is the *outcome* that ritual protects — state legibility without colour,
density, a bounded scale, and a value shown wherever one exists — which is what
belongs in a spec.
## Requirements
### Requirement: Design Tokens Are The Single Source Of Colour

All colour SHALL be drawn from named design tokens. Raw colour literals MUST NOT
be introduced in components.

#### Scenario: Components consume tokens, not literals
- **WHEN** a component needs a colour
- **THEN** it references a design token
- **AND** the token source-of-truth assertion continues to pass.

### Requirement: Enforced Colour Contrast Floors

Every colour token that renders as text SHALL meet its WCAG contrast floor against every
background it renders on, in every appearance the product ships, and this MUST be asserted by an
automated test that runs in CI. Backgrounds include tinted surfaces derived from a token and
filled controls, not only opaque surface tokens. Semantic status colours are text whenever a
value is rendered in them and are held to the body-text floor. A filled control SHALL remain
distinguishable from the surface behind it in every appearance, including in its hover state.
Text tiers MUST remain visually distinguishable from one another.

#### Scenario: A contrast-regressing token edit fails CI
- **WHEN** a text token is changed such that it no longer clears its contrast floor against a background surface
- **THEN** the contrast test fails
- **AND** the pipeline cannot go green.

#### Scenario: Tier separation is preserved
- **WHEN** text tokens are adjusted to meet contrast floors
- **THEN** each tier remains perceptibly distinct from its neighbours
- **AND** raising a lower tier does not collapse it into the tier above.

#### Scenario: Both appearances are asserted
- **WHEN** the contrast test runs
- **THEN** it evaluates every text-bearing colour token against every background it renders on in each appearance
- **AND** a token that clears its floor in one appearance but not the other fails.

#### Scenario: A tinted surface is a background
- **WHEN** a surface is drawn as a partially transparent tint of a token and carries text in that same token
- **THEN** that composited pairing is asserted like any other
- **AND** a tint that drops the pairing below the floor fails.

#### Scenario: A status colour carrying a value is held to the text floor
- **WHEN** a surface renders a value in a semantic status colour
- **THEN** that colour is asserted against the body-text floor rather than the non-text floor
- **AND** a status colour that reads as decoration in one surface and as text in another is held to the stricter of the two.

#### Scenario: A filled control stays visible in both appearances
- **WHEN** a filled control renders in its resting and hover states
- **THEN** the fill clears the non-text floor against the surface behind it
- **AND** the text on the fill clears the body-text floor in both states.

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

### Requirement: Theme Support

The product SHALL default to a dark appearance and offer a light alternative.

#### Scenario: The user can switch appearance
- **WHEN** the user changes the theme setting
- **THEN** the interface renders in the chosen appearance
- **AND** the choice persists across reloads.

### Requirement: Every Appearance Defines Every Appearance-Scoped Token

Each appearance the product ships SHALL define a value for every appearance-scoped token —
colour tokens and any other token whose correct value depends on the ground, such as elevation
shadows and the declared colour scheme — so that no token silently inherits a value designed for
a different ground. This MUST be asserted by an automated test that runs in CI.

#### Scenario: A partially defined appearance fails CI
- **WHEN** an appearance defines some but not all appearance-scoped tokens
- **THEN** the completeness test fails naming the missing tokens
- **AND** the pipeline cannot go green.

#### Scenario: A new token must be defined everywhere
- **WHEN** an appearance-scoped token is added to one appearance
- **THEN** the test fails until every other appearance defines it too
- **AND** no appearance falls back to a value designed for a different ground.

#### Scenario: Non-colour tokens are covered too
- **WHEN** an appearance defines every colour token but omits an elevation shadow or the declared colour scheme
- **THEN** the completeness test still fails
- **AND** coverage is not narrowed to colour alone.

### Requirement: Fill Colours And Foreground Colours Are Separate Tokens

A colour that renders as text or an icon on a page ground and a colour that sits behind
contrasting text SHALL be separate tokens, because the two roles impose opposing luminance
constraints that cannot both be satisfied by one value across appearances. A component SHALL NOT
place fixed-luminance text on a token whose role is foreground.

#### Scenario: One token is not asked to serve both roles
- **WHEN** a surface places white text on a filled control
- **THEN** the fill comes from a fill-role token
- **AND** that token is asserted against the text placed on it in every appearance.

#### Scenario: The separation is enforced, not conventional
- **WHEN** a component pairs fixed-luminance text with a foreground-role token
- **THEN** an automated test fails identifying the component
- **AND** the pairing cannot reach the default branch.

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
screen.** The binding constraint is a maximum height per row, verifiable by
measuring one row. "A fifteen-row working set is visible without scrolling" was
the earlier phrasing and it is not a property of the design: the same stylesheet
passes or fails it depending on browser chrome, OS font scaling, zoom level, and
whether a bookmarks bar is open. A requirement that a correct implementation can
fail for reasons outside the page cannot be met deliberately, only met by luck.

**The maximum SHALL be `3.5rem`, declared as a design token, and SHALL be
expressed in `rem` rather than CSS pixels.** An earlier draft said "a maximum
height per row in CSS pixels" and then declared no number at all, leaving the
requirement unverifiable — a scenario asserting a row is "at or below the
declared maximum" when nothing declares one.

**`3.5rem` was chosen because the fleet table already ships it — but it is a
budget the product must meet, not a description of the product as built.** The
original rationale read "the constraint records the density that exists rather
than imposing a restyling", and measurement on 2026-08-05 falsified that as a
general claim: it holds for the fleet, and does not hold for the workflow
conformance surface, whose two tables measure `[100, 75.5, 51, 99.5]` and
`[71.5, 71.5, 51, 51, 51, 50.5]` CSS pixels against a 56 px cap, because their
cells stack list-valued content. That surface is a real `<table>` with no
recorded exemption claim, so this requirement binds it and it is currently
non-conformant — tracked as an open `openspec/BACKLOG.md` entry rather than
silently rescoped. Stated here so the number is read as a target with one known
outstanding violation, not as a measurement of the whole product.

The unit is the substantive half. A cap fixed in CSS pixels that must hold "at a
non-default OS font scale" is a requirement to clip text when a user enlarges it,
which collides with the text-resize and reflow guarantees the product owes. In
`rem` the row grows with the user's font size, so the cap scales with the text it
contains: the density is a property of the design, and enlarging text remains a
supported thing to do rather than a conformance failure.

**The maximum and the uniformity clause are both scoped to the reference
viewport.** At `xs` a logical row may wrap its fields internally, which
necessarily makes it taller than one line and makes rows of differing content
differ in height. Both are permitted there: at `xs` the requirement is that a row
remains one list item with every required field available, not that it fits
`3.5rem` or matches its neighbours. Read unscoped, the uniform-height scenario
and the wrap allowance contradict each other outright — one demands every row be
identical while the other permits exactly the variation that breaks it.

The row-count figure is retained as the **intent** the height is chosen to serve
— roughly a fifteen-row working set at the reference viewport in a typical
browser — and SHALL NOT be used as the pass condition.

**The density clause binds list and table surfaces; the fit and alignment
clauses bind every surface.** The scoping is stated rather than inferred,
because the lifecycle change board is a kanban board of cards and the sentence
"every row is the same height, rather than a card-sized block" reads as
anti-card in general. It is not: it governs surfaces whose unit of information
is a **row**, where a card-sized block is a density regression against a
directly comparable alternative. A kanban column's unit is a card, chosen over
a dense table deliberately and with the trade-off recorded (`add-agent-change-board`
design decision 6 — stage as a *place* rather than a value scanned for, matching
the terminal board this fleet already uses).

What the board is **not** exempt from, and must satisfy: no page-level
horizontal scrolling at either verification viewport, and tabular figures on its
numeric values so counts align between cards. Both are asserted in that change's
own tests. The exemption is from uniform row height alone.

**A surface SHALL NOT claim the exemption by self-assertion.** "Whose unit of
information is a card" is a judgement, and a judgement no one has to write down
is one every future surface can make in its own favour — which is how a density
requirement decays into a density preference. A surface claiming the exemption
SHALL record the claim and its trade-off in its own change, as the lifecycle
change board does in its design decision 6. A surface that has not recorded the
claim is bound by uniform row height.

The **reference viewport** for density guarantees is 1440×900, matching the
design critique. Responsive fit SHALL also be verified at the smallest declared
breakpoint; a width breakpoint alone is not used to assert vertical fit. The
smallest named breakpoint is `xs` below 640 CSS pixels, and its representative
verification viewport is 390×844.

#### Scenario: A row is no taller than the density budget
- **WHEN** a row on a list or table surface is measured at the reference viewport
- **THEN** its height is at or below the declared maximum of `3.5rem`
- **AND** every row at that viewport is the same height, rather than a card-sized block.

#### Scenario: A wrapped row at the smallest breakpoint is not a violation
- **WHEN** a logical row wraps its fields internally at the `xs` viewport and so exceeds `3.5rem`
- **THEN** it still conforms, because the maximum and the uniformity clause are scoped to the reference viewport
- **AND** it remains one list item with every required field available.

#### Scenario: Enlarged text is not a conformance failure
- **WHEN** a user raises their text size and rows grow with it
- **THEN** the surface still conforms, because the maximum is expressed in `rem` and scales with the text
- **AND** the requirement never asks an implementation to clip text to stay within a pixel budget.

#### Scenario: A card surface is bound by fit and alignment but not by row height
- **WHEN** a surface whose unit of information is a card rather than a row renders, such as the lifecycle change board
- **THEN** the uniform-row-height requirement does not apply to it
- **AND** it still fits without page-level horizontal scrolling at every declared verification viewport
- **AND** its numeric values still use tabular figures.

#### Scenario: An unrecorded exemption does not hold
- **WHEN** a surface renders card-shaped units without having recorded the exemption claim in its own change
- **THEN** it is bound by the uniform row-height requirement
- **AND** the exemption cannot be asserted after the fact to excuse a density regression.

#### Scenario: Density does not depend on the viewer's browser furniture
- **WHEN** the same surface is rendered with a bookmarks bar open, at a different window height, or at a zoom level other than 100%
- **THEN** it still satisfies the density requirement, because the requirement is a measured row height rather than a count of rows that fit
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

#### Scenario: A value outside the scale is rejected
- **WHEN** a component declares a font size or weight that is not one of the enumerated tokens
- **THEN** an automated check fails on that component — `packages/spa/src/styles/typographyTokens.test.ts`, which parses the enumeration out of `tokens.css` rather than restating it
- **AND** the requirement's MUST NOT is exercised rather than only its enumeration.

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

