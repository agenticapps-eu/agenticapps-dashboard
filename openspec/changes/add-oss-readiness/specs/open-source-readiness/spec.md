## ADDED Requirements

### Requirement: Distributed Under An Explicit Licence

The repository SHALL carry an MIT `LICENSE` file at its root, and the published
agent package SHALL declare the same licence in its manifest.

#### Scenario: The licence is discoverable at the root
- **WHEN** the repository is browsed or cloned
- **THEN** a `LICENSE` file containing the MIT terms is present at the root
- **AND** the agent package manifest declares the matching licence identifier.

### Requirement: Contributor Guidance

The repository SHALL carry a `CONTRIBUTING.md` documenting local development
setup, how to run the test suites, the two-stage review expectation, and the
pull-request template contributors are expected to follow.

#### Scenario: A new contributor can get to a green test run
- **WHEN** someone reads CONTRIBUTING.md with no prior knowledge of the repo
- **THEN** it gives them the install, build, and per-package test commands
- **AND** it states that changes pass through two review stages before merge.

#### Scenario: Pull requests follow a known shape
- **WHEN** a contributor opens a pull request
- **THEN** a template presents the expected sections
- **AND** the two-stage review expectation is stated in the contributing guide.

### Requirement: Public Access Policy Is An Explicit Decision

Any relaxation of the production deployment's access policy SHALL be an
explicitly recorded decision rather than an incidental consequence of publishing
the source. Publishing the source MUST NOT by itself change what the deployed
dashboard exposes.

#### Scenario: Source publication does not widen deployment access
- **WHEN** the repository becomes publicly readable
- **THEN** the production deployment's access policy is unchanged
- **AND** relaxing it requires its own recorded decision.
