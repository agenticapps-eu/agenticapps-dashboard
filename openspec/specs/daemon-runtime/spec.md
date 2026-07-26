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
(auto-detecting the Tailscale IP) and an explicit address including `0.0.0.0`.
For non-loopback binds it MUST support enforcing that the client IP falls within
the Tailscale CIDR `100.64.0.0/10`, and MUST print a startup warning banner when
binding all interfaces.

#### Scenario: Tailscale bind detects the interface or fails gracefully
- **WHEN** `--bind tailscale` is used and Tailscale is not installed
- **THEN** the daemon fails gracefully with a clear message rather than crashing
- **AND** when Tailscale is present it binds the detected address and emits a pair URL using the Tailscale hostname.

#### Scenario: Binding all interfaces warns and enforces CIDR
- **WHEN** the daemon binds `0.0.0.0`
- **THEN** it prints a warning banner at startup
- **AND** it rejects clients outside the Tailscale CIDR unless that enforcement is explicitly disabled.

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
