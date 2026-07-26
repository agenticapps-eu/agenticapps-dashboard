## MODIFIED Requirements

### Requirement: Authored Documentation Pages

The help system SHALL carry an authored page for each of the product's content
surfaces and no more. Every page MUST describe a surface that exists; a page for
a withdrawn surface MUST be removed rather than left in place.

#### Scenario: Pages match the surfaces
- **WHEN** the help index renders
- **THEN** there is one authored page per content surface
- **AND** no page documents a surface the product no longer has.

#### Scenario: Each page explains its surface's vocabulary
- **WHEN** a help page for a surface is read
- **THEN** it explains what that surface answers and the vocabulary it uses to answer it.

### Requirement: Embeddable Interactive Widgets

Help pages MAY embed interactive widgets, loaded on demand. A widget SHALL exist
only for a surface that exists; widgets for withdrawn surfaces MUST be removed
along with their dispatch entries, leaving no unreachable stub.

#### Scenario: No widget outlives its surface
- **WHEN** the widget dispatch table is inspected
- **THEN** every entry resolves to a surface the product currently has
- **AND** no entry points at a withdrawn surface.

#### Scenario: Widgets load on demand
- **WHEN** a help page carrying a widget is opened
- **THEN** the widget's code is loaded at that point
- **AND** it is not included in the initial application payload.

### Requirement: Contextual Help Links

Content surfaces MAY link into the help system at the page describing them. Every
such link MUST resolve to an authored page; a link to a removed page MUST be
removed with it.

#### Scenario: Contextual links resolve
- **WHEN** a contextual help link is followed from any surface
- **THEN** an authored page opens
- **AND** no link resolves to a stub or a missing page.
