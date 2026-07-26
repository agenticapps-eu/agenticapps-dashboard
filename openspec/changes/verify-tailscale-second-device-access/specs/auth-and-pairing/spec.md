## ADDED Requirements

### Requirement: Concurrent Multi-Device Pairing

A single daemon token SHALL support more than one paired device at the same
time. Pairing a second device MUST NOT invalidate the first device's pairing,
and both MUST continue to read the same registry.

#### Scenario: A second device pairs without displacing the first
- **WHEN** a second device pairs against a daemon that already has a paired device
- **THEN** both devices remain paired and can read the dashboard
- **AND** neither device's stored pairing is invalidated by the other.

#### Scenario: Rotation re-pairs every device
- **WHEN** the token is rotated while several devices are paired
- **THEN** every paired device shows the re-pair prompt on its next request
- **AND** no device continues to read data with the superseded token.

### Requirement: Remote Access Is Reachable Only Over The Tailnet

When the daemon is bound to a Tailscale address with CIDR enforcement active, a
client whose address falls outside the Tailscale CIDR SHALL be rejected, and
bypassing that enforcement MUST require an explicit opt-out flag.

#### Scenario: An off-tailnet client is rejected
- **WHEN** a client outside the Tailscale CIDR requests any route from a Tailscale-bound daemon
- **THEN** the request is rejected
- **AND** enforcement is bypassed only when the operator passes the explicit opt-out flag.
