## MODIFIED Requirements

### Requirement: Responsive Coverage Layout

The coverage surface SHALL render a card-per-repo layout at the smallest
viewport, preserving each column's state and keeping interactive controls at an
accessible touch-target size. Larger viewports keep the table layout with
consistent column widths across family sections.

#### Scenario: Small viewports switch to cards
- **WHEN** the coverage page renders at the smallest breakpoint
- **THEN** each repo renders as a card carrying its name, override chip, a state for every tracked column, and its actions
- **AND** action controls remain at an accessible touch-target size.

#### Scenario: Column widths agree across family sections
- **WHEN** the table layout renders multiple family sections
- **THEN** corresponding columns are the same width in every section
- **AND** those widths come from one shared definition rather than per-section values.
