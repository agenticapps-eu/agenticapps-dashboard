# daemon-runtime Specification

## Purpose

The daemon is the half of the dashboard that holds data. It is a single Node
process — `@agenticapps/dashboard-agent`, binary `agentic-dashboard` — running a
Hono HTTP server on `127.0.0.1:5193` by default, serving the static SPA whatever
it needs to render.

This capability covers the process itself: its lifecycle and CLI surface, how it
binds (loopback, Tailscale, or all interfaces, each with different exposure), its
health contract, its caching cadences, and how it installs as a long-running
service. Two commitments shape all of it: **no native dependencies**, so
`npx @agenticapps/dashboard-agent` stays portable and needs no compile step; and
**loopback by default**, so the safe configuration is the one you get without
thinking.
## Requirements
### Requirement: Single Local Daemon Serving Many Projects

The dashboard SHALL run as one local daemon process serving every registered
project. A single pairing MUST cover all of them; per-project daemons are not
required.

#### Scenario: One daemon covers the whole registry
- **WHEN** the daemon starts with several registered projects
- **THEN** every registered project is served by that one process
- **AND** one pairing grants the SPA access to all of them.

### Requirement: No Native Dependencies

`packages/agent` SHALL NOT depend on any native module, FFI binding, or
compiled addon — specifically not a system keychain binding. Portability of the
`npx` install path takes precedence over convenience.

#### Scenario: Install requires no compile step
- **WHEN** the agent package is installed via `npx` on macOS or Linux
- **THEN** installation completes with no native build
- **AND** credential storage uses a `0600` file in `$HOME` rather than a keychain binding.

### Requirement: Daemon CLI Surface

The daemon SHALL expose a CLI covering lifecycle (`start`, `stop`, `status`),
registry management (`register`, `unregister`, `list`, `rename`, `tag`), auth
(`pair`, `rotate-token`), env (`env set`), and service install
(`install-launchd`, `uninstall-launchd`, `install-systemd`). `start` MUST run in
the foreground by default so logs are visible and Ctrl-C works.

#### Scenario: Foreground is the default process model
- **WHEN** `agentic-dashboard start` is run with no detach flag
- **THEN** the daemon runs in the foreground streaming its logs
- **AND** Ctrl-C shuts it down.

#### Scenario: Status reports health and registry size
- **WHEN** `agentic-dashboard status` is run
- **THEN** it reports daemon health and the number of registered projects
- **AND** supports a JSON output mode for scripting.

### Requirement: Bind Modes And Network Exposure

The daemon SHALL bind `127.0.0.1` by default and MUST support `--bind tailscale`
(auto-detecting the Tailscale CGNAT IPv4 address) and explicit IPv4 and IPv6
literals, including `0.0.0.0` and `::`. For explicit IP literals,
`127.0.0.1` and `::1` SHALL be classified as loopback and every other literal
SHALL be classified as non-loopback. For CLI binds classified as non-loopback,
CIDR enforcement MUST be enabled by default unless the operator explicitly
disables it. Dual-stack wildcard `::` SHALL start with enforcement enabled,
admitting IPv6-mapped CGNAT IPv4 while refusing raw IPv6. Any other
non-loopback IPv6 literal with enforcement enabled MUST fail before server
startup with a diagnostic that the admission boundary is IPv4-only; the
existing explicit opt-out permits that bind. The daemon MUST print a startup
warning banner when binding all interfaces through either `0.0.0.0` or `::`.
The triggering condition is the configured bind mode, not whether an individual
request happens to carry a loopback source address. Loopback mode MUST NOT
install the CIDR middleware.

**Where that enforcement is enabled, the accepted set is IPv4 CGNAT only.** An
address is accepted if it lies in `100.64.0.0/10`, whether presented as a
dotted quad or in IPv6-mapped IPv4 form. IPv6-mapped values SHALL be normalised
before the range classification. A raw address in any other family — including
a tailnet's own IPv6 range — is refused by the admission function. `--bind
tailscale` selects an IPv4 socket, so a direct connection to that daemon node's
tailnet IPv6 address fails before HTTP rather than reaching the admission
function. Dual-stack wildcard `::` can present raw IPv6 and IPv6-mapped IPv4 to
admission. A specific non-loopback IPv6 bind reaches admission only when the
operator has explicitly disabled CIDR enforcement.

The daemon SHALL classify each admission refusal in its own diagnostics as
`unsupported-family`, `outside-range`, or `address-unavailable`. A mapped IPv4
address outside CGNAT is `outside-range`, not `unsupported-family`. The
diagnostic MUST use these stable class names rather than inferring or recording
whether a peer belongs to a particular network.

The classification SHALL live only in the daemon's own diagnostics. It MUST NOT
appear in any HTTP response, including responses to authenticated callers, so
that neither a rejected client nor a paired peer can probe which rule refused a
request. Diagnostics SHALL record the classification and the existing
per-request `requestId` installed before CIDR middleware; they MUST NOT record
the client address. This requirement introduces no new correlation identifier
or header.

Refusal diagnostics SHALL be rate limited, because admission runs before
authentication and a peer that can open a socket would otherwise control the
daemon's diagnostic write rate. Within a bounded window the daemon SHALL emit
at most one correlated diagnostic per refusal class, and SHALL report the count
of further refusals of that class rather than discarding them. The admission
decision itself SHALL NOT depend on the rate limit: every refused request is
still refused, and every admitted request is still admitted.

#### Scenario: Tailscale bind detects the interface or fails gracefully
- **WHEN** `--bind tailscale` is used and Tailscale is not installed
- **THEN** the daemon fails gracefully with a clear message rather than crashing
- **AND** when Tailscale is present with a CGNAT IPv4 address it binds that address and emits a pair URL using the Tailscale hostname.

#### Scenario: Tailscale bind setup failures are distinct
- **WHEN** `--bind tailscale` is used and Tailscale is missing or unavailable, or the running daemon node has no CGNAT IPv4 address
- **THEN** the daemon fails gracefully and distinguishes an unavailable installation from an IPv4-unavailable node
- **AND** the CGNAT requirement is not applied when the operator has explicitly disabled enforcement.

#### Scenario: Binding all interfaces warns and enforces CIDR
- **WHEN** the daemon binds `0.0.0.0`
- **THEN** it prints a warning banner at startup
- **AND** it rejects clients outside the Tailscale CIDR unless that enforcement is explicitly disabled.

#### Scenario: Default loopback mode bypasses the tailnet boundary
- **WHEN** the daemon runs in its default `127.0.0.1` loopback bind mode
- **THEN** CIDR middleware is not installed
- **AND** the loopback client is not required to have a Tailscale address.

#### Scenario: Bind configuration selects enforcement
- **WHEN** a request reaches any supported non-loopback bind with enforcement enabled
- **THEN** the CIDR check is applied even if the request source is a loopback address
- **AND** the decision does not infer bind mode from the request address.

#### Scenario: Explicit IP literals are valid bind inputs
- **WHEN** the operator supplies an explicit IPv4 or IPv6 literal
- **THEN** the CLI recognises it as a bind address
- **AND** applies the loopback or non-loopback policy for that literal.

#### Scenario: IPv6 loopback remains local
- **WHEN** the operator supplies `::1` as an explicit bind address
- **THEN** the daemon classifies it as loopback and does not install CIDR middleware

#### Scenario: Dual-stack wildcard enforces the IPv4 boundary
- **WHEN** the operator supplies `::` without disabling CIDR enforcement
- **THEN** the daemon starts with an all-interfaces warning and CIDR middleware enabled
- **AND** it admits mapped CGNAT IPv4 peers while refusing raw IPv6 peers as `unsupported-family`.

#### Scenario: Specific non-loopback IPv6 bind fails fast by default
- **WHEN** the operator supplies a non-loopback IPv6 literal other than `::` while CIDR enforcement is enabled
- **THEN** the daemon fails before startup with an IPv4-only boundary diagnostic
- **AND** it points to the CGNAT IPv4 path or the explicit CIDR opt-out.

#### Scenario: Specific IPv6 bind requires a deliberate opt-out
- **WHEN** the operator supplies a specific non-loopback IPv6 literal together with the explicit CIDR opt-out
- **THEN** the daemon binds that address without CIDR middleware
- **AND** the address-family and range rules are both disabled.

#### Scenario: Other overlay networks are not implied
- **WHEN** a peer arrives from an overlay network whose IPv4 address is outside `100.64.0.0/10`
- **THEN** it is refused under the same outside-range rule
- **AND** support for that overlay requires a separate bind-policy change.

#### Scenario: A CGNAT address is accepted in either presentation
- **WHEN** a client's socket address is in the accepted range, presented either as a dotted quad or in IPv6-mapped IPv4 form
- **THEN** the request is accepted
- **AND** the two presentations are treated identically.

#### Scenario: A direct tailnet IPv6 connection is unsupported
- **WHEN** `--bind tailscale` is used and a client attempts the daemon node's tailnet IPv6 address rather than its CGNAT IPv4 address
- **THEN** the IPv4-bound daemon does not accept that HTTP connection
- **AND** if a raw IPv6 address is presented directly to admission it is refused as `unsupported-family`.

#### Scenario: An out-of-range IPv4 address is classified as outside range
- **WHEN** a client's socket address is a routable IPv4 address outside the accepted range
- **THEN** the request is refused
- **AND** the diagnostics classify it as `outside-range`, never as `unsupported-family`.

#### Scenario: A missing peer address has its own class
- **WHEN** admission receives no parseable socket peer address
- **THEN** the request is refused as `address-unavailable`
- **AND** it is not guessed to be either an address-family or range failure.

#### Scenario: The refusal reason never leaves the daemon
- **WHEN** requests are refused under different internal classification codes
- **THEN** every refusal response carries the same status, public error code, and field set
- **AND** no response field, on any route and for any caller, reveals which rule refused the request.

#### Scenario: Refusal diagnostics are rate limited
- **WHEN** many requests are refused under the same classification within one window
- **THEN** the daemon emits one diagnostic carrying that class and a `requestId`
- **AND** it reports the number of further refusals of that class rather than discarding them
- **AND** every one of those requests is still refused.

#### Scenario: Refusal diagnostics do not retain the peer address
- **WHEN** the daemon records any admission-refusal classification
- **THEN** the diagnostic contains that class and the request's existing `requestId`
- **AND** it contains neither the raw nor normalised client address.

#### Scenario: The client address still comes from the socket
- **WHEN** a request carries headers asserting a different client address
- **THEN** those headers are ignored
- **AND** the decision is taken on the raw socket address.

#### Scenario: Disabling enforcement disables the whole check
- **WHEN** the operator explicitly disables CIDR enforcement
- **THEN** neither the range rule nor the address-family rule is applied
- **AND** disabling remains an explicit, non-default operator action.

### Requirement: Health Endpoint

The daemon SHALL expose `GET /health` returning `{ ok, daemonVersion, registryCount, paired }`.
The SPA uses it to validate a pairing and to detect an unreachable or
token-rotated daemon.

#### Scenario: Health confirms a working pairing
- **WHEN** the SPA calls `/health` with a valid bearer token
- **THEN** the daemon returns `ok` with its version and registry count.

### Requirement: Response Caching Cadences

The daemon SHALL cache expensive computations server-side rather than recomputing
per request: project status and fleet coverage on a short cadence, AgentLinter
results for about an hour keyed on input freshness, and derived fleet aggregates
on their own cadence. Caches MUST be explicitly invalidatable by the actions that
change their inputs.

#### Scenario: A refresh action invalidates the cache it affects
- **WHEN** an action changes data behind a cached response (a scoped scan, or a registry path repair)
- **THEN** the affected cache entry is invalidated
- **AND** the next read reflects the new state without waiting for natural expiry.

### Requirement: Polling, Not Push

The dashboard SHALL be driven by client polling on roughly a 5-second cadence.
Real-time push transport MUST NOT be introduced.

#### Scenario: The SPA polls for freshness
- **WHEN** the dashboard is open
- **THEN** it refreshes project data by polling at approximately 5s
- **AND** per-card freshness is surfaced to the user.

### Requirement: Service Installation

The daemon SHALL install as a user-level background service:
`install-launchd` on macOS writing a LaunchAgent plist that runs at load, keeps
the process alive, and logs to `~/.agenticapps/dashboard/logs/`; and
`install-systemd` on Linux writing a systemd user unit. Each MUST have a
corresponding uninstall path.

#### Scenario: The installed service survives a reboot
- **WHEN** `install-launchd` has been run and the machine reboots
- **THEN** the daemon starts automatically
- **AND** its stdout and stderr are written under `~/.agenticapps/dashboard/logs/`.

### Requirement: No Daemon Auto-Update

The daemon SHALL NOT update itself. Upgrading MUST be an explicit user action.

#### Scenario: Upgrades are explicit
- **WHEN** a newer agent version is published
- **THEN** the running daemon does not self-update
- **AND** the user upgrades by explicitly running the `@latest` install command.

