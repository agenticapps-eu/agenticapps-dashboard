# optional-integrations Specification

## Purpose

Sentry, Linear, and Infisical each have something useful to say about a project.
None of them is allowed to become load-bearing.

The governing rule of this capability is a product commitment, not a nicety: **the
dashboard works fully with none of them configured.** Every integration panel has
two honest states — configured and showing data, or unconfigured and telling you
exactly which environment variable would enable it. A third state, failing
noisily and breaking the page, is not permitted.

This capability also covers the health-detection panels that merely *observe*
whether third-party tooling is present in a project, which make no network calls
at all.

## Requirements

### Requirement: The Dashboard Works Without Any Integration

The dashboard SHALL render fully and every non-integration route SHALL function
with none of the optional integrations configured. No integration may be a hard
dependency.

#### Scenario: A fully unconfigured install is fully usable
- **WHEN** the daemon runs with no integration credentials set
- **THEN** every non-integration route works normally and the dashboard renders completely
- **AND** only the integration panels show unconfigured states.

### Requirement: Unconfigured Panels Explain Themselves

When an integration is unconfigured, its panel SHALL show a "configure to enable"
empty state naming the environment variable required and linking to a short setup
guide. It MUST NOT render as an error.

#### Scenario: The empty state names the variable
- **WHEN** an integration panel renders without its credential configured
- **THEN** it states which environment variable enables it and links to the guide
- **AND** presents as an empty state rather than a failure.

### Requirement: Unconfigured Routes Are Distinguishable From Failures

Integration routes SHALL respond distinctly when the integration is not
configured, with a body that identifies the unconfigured condition, so the SPA
can tell "not set up" apart from "broken".

#### Scenario: Not-configured is not reported as a generic error
- **WHEN** an integration route is called with its credential unset
- **THEN** the response identifies the unconfigured condition specifically
- **AND** the SPA renders the configure-to-enable state rather than an error state.

### Requirement: Integration Failures Degrade To Cached Data

When a configured integration's upstream API is unreachable or failing, the panel
SHALL fall back to showing cached data with an explicit staleness notice. It MUST
NOT crash the page.

#### Scenario: An unreachable API shows stale data honestly
- **WHEN** a configured integration's API call fails and cached data exists
- **THEN** the panel renders the cached data and states that the API was unreachable and when the data is from
- **AND** the rest of the page is unaffected.

### Requirement: Error Tracking Panel

The daemon SHALL expose recent error data for a project when the error-tracking
credential is configured, cached briefly. Without the credential the panel shows
the configure-to-enable state.

#### Scenario: Recent errors render when configured
- **WHEN** the error-tracking credential is set and the project resolves to a project slug
- **THEN** the panel renders recent errors from a briefly cached response.

### Requirement: Issue Tracker Panel And Static Linking

The daemon SHALL expose issue detail for a given issue identifier when the issue
tracker credential is configured. Independently of any credential, the dashboard
SHALL detect issue references in branch names and commits and render them as
static links.

#### Scenario: The static link needs no credential
- **WHEN** a branch or commit carries an issue-style reference and no credential is configured
- **THEN** the reference still renders as a static link
- **AND** only the richer issue panel is gated behind the credential.

### Requirement: Secrets Manager Status Reflection Only

The dashboard SHALL reflect secrets-manager configuration status only — whether
it is configured and at what scope — with a link to configure. It MUST NOT make
privileged calls to a secrets manager and MUST NOT store secrets. It is
explicitly not a secrets manager.

#### Scenario: Status is read locally, never fetched privileged
- **WHEN** the secrets status surface renders
- **THEN** it reports configured-or-not and scope from local configuration
- **AND** makes no privileged call to the secrets platform and stores no secret value.

### Requirement: Environment Configuration Without A Secret Store

Integration credentials SHALL be supplied to the daemon through its process
environment. The daemon SHALL additionally support persisting them to an
env file in its own state directory at mode `0600`. Running the daemon under an
external secrets injector MUST require no code change.

#### Scenario: An external injector requires no code change
- **WHEN** the daemon is launched under an external secrets injector that populates its environment
- **THEN** the integrations become configured with no modification to the daemon
- **AND** the daemon reads them exactly as it reads any environment variable.

#### Scenario: Persisted credentials stay private
- **WHEN** a credential is persisted via the env command
- **THEN** it is written to the daemon's env file at mode `0600`
- **AND** it is never logged nor sent to the SPA.

### Requirement: Local Tooling Health Detection

The dashboard SHALL detect and report the presence of observability tooling and
secrets-manager configuration in a project by inspecting the project's own files.
This detection SHALL make no network calls.

#### Scenario: Detection is purely local
- **WHEN** the tooling health panels evaluate a project
- **THEN** they determine presence by reading the project's manifest and configuration files
- **AND** no request is made to any third-party service.

### Requirement: Integration Status Summary

The daemon SHALL expose a per-project summary reporting, for each optional
integration, whether it is configured and its identifying scope, read from local
configuration only.

#### Scenario: The summary is derived locally
- **WHEN** the integration status summary is requested for a project
- **THEN** each integration reports configured-or-not with its scope
- **AND** every value is derived from local files and environment, never from a remote service.

### Requirement: No Reimplementation Of Third-Party Products

The dashboard SHALL link out to the third-party products it integrates with
rather than reimplementing their functionality.

#### Scenario: Deep functionality links out
- **WHEN** a user needs functionality beyond the summary a panel shows
- **THEN** the panel links to the third-party product
- **AND** the dashboard does not reproduce that product's features.
