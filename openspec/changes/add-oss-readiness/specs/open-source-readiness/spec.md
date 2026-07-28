## ADDED Requirements

### Requirement: Distributed Under An Explicit Licence

The repository SHALL carry the SPDX MIT licence text in a `LICENSE` file at its
root, with the owner-approved copyright holder and publication year completing
the copyright line. `@agenticapps/dashboard-agent`, the repository's only
registry-eligible package, SHALL declare `MIT` in its manifest. Every other
workspace package SHALL remain private unless a later change gives it its own
publication contract. Publishing the agent to a registry is a separate human
release action and SHALL be subject to the same completed audit as repository
visibility.

#### Scenario: The licence is discoverable at the root
- **WHEN** the repository is browsed or cloned
- **THEN** a `LICENSE` file containing the SPDX MIT terms and completed copyright line is present at the root
- **AND** the `@agenticapps/dashboard-agent` manifest declares `"license": "MIT"`.

#### Scenario: Private workspace packages do not become public accidentally
- **WHEN** the workspace package manifests are inspected before publication
- **THEN** only `@agenticapps/dashboard-agent` is publishable
- **AND** every other workspace package remains marked private.

### Requirement: The Published Tree Has Compatible Provenance

Before publication, the repository SHALL inventory every tracked vendored
subtree, source-level copyright notice, and runtime, development, bundled, and
transitive dependency. Every redistributed item MUST be covered by the root MIT
licence, carry its own redistribution-compatible licence, or be removed from the
public tree or bundle. Development-only dependencies are inventoried but their
licences block publication only when their code or assets are redistributed.
Required third-party copyright and attribution notices SHALL be retained in a
`THIRD-PARTY-NOTICES` file or equivalent published artefact. An unresolved
redistribution obligation MUST block publication.

#### Scenario: Vendored content has an attributable licence
- **WHEN** a tracked vendored subtree is included in the public repository
- **THEN** its provenance and licence coverage are recorded
- **AND** the root MIT licence is not represented as overriding incompatible third-party terms.

#### Scenario: Dependencies are compatible before publication
- **WHEN** dependency licences are audited across the lockfile and bundled output
- **THEN** every redistributed dependency is compatible with MIT redistribution
- **AND** an unknown or incompatible licence blocks publication.

#### Scenario: Existing notices remain coherent
- **WHEN** tracked source files carry copyright or licence notices
- **THEN** those notices are consistent with, or explicitly qualified against, the root licence
- **AND** ambiguous conflicting notices block publication.

### Requirement: Contributor Guidance

The repository SHALL carry a `CONTRIBUTING.md` documenting local development
setup, how to run the test suites, the OpenSpec lifecycle, the two-stage review
expectation, the filesystem security spine, and the pull-request template
contributors are expected to follow. It SHALL link to
`docs/review-protocol.md` and
`openspec/specs/filesystem-access-policy/spec.md`. The repository SHALL also
carry a `CODE_OF_CONDUCT.md`.
The repository SHALL also carry a root `SECURITY.md` naming a private
vulnerability-reporting channel and a supported-response expectation.

#### Scenario: A new contributor can get to a green test run
- **WHEN** someone reads CONTRIBUTING.md with no prior knowledge of the repo
- **THEN** it gives them the install, build, and per-package test commands
- **AND** it links the review protocol and the filesystem security constraints contributors must preserve.

#### Scenario: Pull requests follow a known shape
- **WHEN** a contributor opens a pull request
- **THEN** a template presents the expected sections
- **AND** the template names both the pre-code OpenSpec review and the post-implementation code review.

#### Scenario: Community conduct is stated
- **WHEN** a contributor looks for the project's community expectations
- **THEN** a root `CODE_OF_CONDUCT.md` states them
- **AND** the contributing guide links to it.

#### Scenario: A security reporter has a non-public channel
- **WHEN** someone discovers a potential vulnerability
- **THEN** `SECURITY.md` gives them a private reporting path and response expectations
- **AND** it does not instruct them to disclose the issue publicly first.

### Requirement: Publication Is Gated By A Complete Repository Audit

Before repository visibility or registry distribution changes, the current tree
and every git object the publication host can expose SHALL be audited for
secrets, tokens, pairing URLs, private hostnames, personal paths, and other
material that must not become public. Findings SHALL be classified as active
credential, sensitive identifying material, or benign/cosmetic match. Active
credentials MUST be removed from the public history and rotated. Sensitive
identifying material MUST be redacted or excluded. A benign/cosmetic match MAY
be accepted only with a recorded rationale and owner approval.

History remediation MAY use a coordinated rewrite or a new clean public history;
the chosen method and its impact on existing clones and references SHALL be
recorded. The published tree SHALL also carry a completed audit record with no
unresolved blocker, and publication SHALL remain a deliberate human action.
Repository workflows SHALL be audited for public-fork trust, including
`pull_request_target` and any job able to access secrets.

#### Scenario: Deleted material is still inspected in history
- **WHEN** publication readiness is evaluated
- **THEN** the audit covers every object the publication host can expose rather than only the current tree
- **AND** a secret removed from the latest revision still blocks publication until it is removed from the published history and rotated.

#### Scenario: The release gate is green before publication
- **WHEN** the human publication action is taken
- **THEN** the completed audit record identifies no unresolved blocker or unapproved sensitive finding
- **AND** public-fork workflow paths have no unreviewed route to secrets.

### Requirement: Public Access Policy Is An Explicit Decision

Any relaxation of the bearer-token, CORS, bind-mode, or filesystem access policy
specified by `auth-and-pairing`, `daemon-runtime`, and
`filesystem-access-policy` SHALL be an
explicitly recorded decision rather than an incidental consequence of publishing
the source. Publishing the source MUST NOT by itself change what the deployed
dashboard exposes.

#### Scenario: Source publication does not widen deployment access
- **WHEN** the repository becomes publicly readable
- **THEN** the production deployment's access policy is unchanged
- **AND** relaxing it requires its own recorded decision.
