# auth-and-pairing Specification

## Purpose

The SPA is served from a public URL; the daemon holds every byte of real data.
Pairing is what connects them, and the bearer token is the only thing standing
between a page on the open internet and a developer's filesystem.

This capability covers token generation and storage, the rotation policy, the
CORS origin lock, and the pairing user-journey — the one-click pair URL, its
manual fallback, and what the SPA does when the token stops working. The design
constraint throughout is that **no secrets manager is required**: a `0600` file
in `$HOME` is the store, because a keychain binding would be a native dependency
and break the `npx` install story.

## Requirements

### Requirement: Bearer Token On Every Route

Every daemon route SHALL require an `Authorization: Bearer <token>` header
matching the stored token. There MUST be no anonymous access to any route.

#### Scenario: A missing or wrong token is refused
- **WHEN** a request arrives with no bearer token, or one that does not match the stored token
- **THEN** the daemon refuses the request
- **AND** returns no project data.

### Requirement: Token Storage At Restrictive Permissions

The token SHALL be stored in `~/.agenticapps/dashboard/auth.json` at mode `0600`,
carrying the token, its rotation timestamp, and the agent version. The daemon
MUST verify the mode at startup and refuse to start when it is looser, printing
an error that names the file and the remedy.

#### Scenario: Insecure permissions block startup with a remedy
- **WHEN** the daemon starts and `auth.json` is mode `0644`
- **THEN** it refuses to start
- **AND** the error names the insecure mode and gives both the `chmod 600` command and the `rotate-token` alternative.

### Requirement: Token Rotation Policy

The token SHALL rotate on explicit `rotate-token`, on daemon version upgrade, and
after 30 days. Rotation MUST invalidate the previous token immediately.

#### Scenario: Rotation invalidates the old token at once
- **WHEN** `agentic-dashboard rotate-token` completes
- **THEN** the previous token is rejected on its next use
- **AND** a new token is written to `auth.json` at mode `0600`.

### Requirement: CORS Origin Lock

The daemon SHALL accept cross-origin requests only from the production dashboard
origin and the local SPA dev-server origin. Requests from any other origin MUST
be rejected.

#### Scenario: An unknown origin is rejected
- **WHEN** a browser at an origin outside the allow-list calls a daemon route
- **THEN** the request is rejected by CORS policy
- **AND** no response data is exposed to that origin.

### Requirement: One-Click Pairing

On start, the daemon SHALL print a pair URL carrying the agent URL and token as
query parameters, plus the values needed to pair manually. Opening the pair URL
MUST complete setup without any login form.

#### Scenario: The pair URL completes setup
- **WHEN** the user opens the printed pair URL
- **THEN** the SPA validates the agent URL, calls `/health` with the bearer token, stores the pairing locally, and redirects to the home page
- **AND** no account, login form, or third-party identity provider is involved.

#### Scenario: Manual pairing is always available
- **WHEN** the user cannot use the one-click URL
- **THEN** the settings page accepts the agent URL and token directly
- **AND** pairing completes identically.

### Requirement: Agent URL Validation

The SPA SHALL accept only agent URLs on loopback (`localhost`, `127.0.0.1`) or a
Tailscale hostname. Other hosts MUST be refused so a crafted pair link cannot
point the SPA at an arbitrary server.

#### Scenario: A non-local agent URL is refused
- **WHEN** a pair link supplies an agent URL that is neither loopback nor a Tailscale hostname
- **THEN** the SPA refuses to pair
- **AND** surfaces a pairing error rather than storing the pairing.

### Requirement: Pairing State Is Client-Side Only

The pairing (`agentUrl` and token) SHALL be stored only in the browser's local
storage. No pairing data may be stored cloud-side.

#### Scenario: Nothing is stored cloud-side
- **WHEN** a device completes pairing
- **THEN** the agent URL and token exist only in that browser's local storage
- **AND** the static SPA host stores nothing.

### Requirement: Graceful Recovery From A Dead Pairing

When the daemon is unreachable or the token has been rotated, the SPA SHALL show
an actionable "agent unreachable — re-pair" state. It MUST NOT crash, and MUST
NOT present the failure as data.

#### Scenario: A rotated token prompts re-pairing
- **WHEN** the stored token has been invalidated by rotation
- **THEN** the SPA shows the re-pair prompt
- **AND** does not render stale or empty data as though it were current.

### Requirement: Unpaired Users Reach Onboarding

When no pairing exists, the SPA SHALL redirect the root route to onboarding,
which MUST render a one-screen install guide.

#### Scenario: A fresh install lands on onboarding
- **WHEN** a user opens the dashboard with no pairing stored and no registered projects
- **THEN** they are redirected to onboarding
- **AND** shown the register-and-start commands that produce a pair URL.
