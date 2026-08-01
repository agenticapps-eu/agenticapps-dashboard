## ADDED Requirements

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

## MODIFIED Requirements

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
