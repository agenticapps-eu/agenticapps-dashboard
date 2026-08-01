## ADDED Requirements

### Requirement: Every Appearance Defines Every Colour Token

Each appearance the product ships SHALL define a value for every colour token, so
that no token silently inherits another appearance's value. This MUST be asserted
by an automated test that runs in CI.

#### Scenario: A partially defined appearance fails CI
- **WHEN** an appearance defines some but not all of the colour tokens
- **THEN** the token-completeness test fails naming the missing tokens
- **AND** the change cannot merge on a green pipeline.

#### Scenario: A new token must be defined everywhere
- **WHEN** a colour token is added to one appearance
- **THEN** the test fails until every other appearance defines it too
- **AND** no appearance falls back to a value designed for a different ground.

## MODIFIED Requirements

### Requirement: Enforced Colour Contrast Floors

Every colour token that renders as text SHALL meet its WCAG contrast floor against
every background it renders on, in every appearance the product ships, and this
MUST be asserted by an automated test that runs in CI. Semantic status colours are
text when a value is rendered in them and are held to the same floor as any other
text. Text tiers MUST remain visually distinguishable from one another.

#### Scenario: A contrast-regressing token edit fails CI
- **WHEN** a text token is changed such that it no longer clears its contrast floor against a background surface
- **THEN** the contrast test fails
- **AND** the change cannot merge on a green pipeline.

#### Scenario: Tier separation is preserved
- **WHEN** text tokens are adjusted to meet contrast floors
- **THEN** each tier remains perceptibly distinct from its neighbours
- **AND** raising a lower tier does not collapse it into the tier above.

#### Scenario: Both appearances are asserted
- **WHEN** the contrast test runs
- **THEN** it evaluates every text-bearing colour token against every background surface in each appearance
- **AND** a token that clears its floor in one appearance but not the other fails.

#### Scenario: A status colour carrying a value is held to the text floor
- **WHEN** a surface renders a value in a semantic status colour
- **THEN** that colour is asserted against the body-text floor rather than the non-text floor
- **AND** a status colour that reads as decoration in one surface and as text in another is held to the stricter of the two.
