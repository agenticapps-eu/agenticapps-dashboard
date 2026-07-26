## MODIFIED Requirements

> Written as a modification of the existing requirement rather than as a parallel
> one. Two requirements governing the same check would drift, and the review of
> `verify-tailscale-second-device-access` reached the same conclusion about where
> CIDR governance belongs.

### Requirement: Bind Modes And Network Exposure

The daemon SHALL bind `127.0.0.1` by default and MUST support `--bind tailscale`
(auto-detecting the Tailscale IP) and an explicit address including `0.0.0.0`.
For non-loopback binds it MUST support enforcing that the client IP falls within
the Tailscale CIDR `100.64.0.0/10`, and MUST print a startup warning banner when
binding all interfaces.

**Where that enforcement is enabled, the accepted set is IPv4 CGNAT only.** An
address is accepted if it lies in the range, whether presented as a dotted quad
or in IPv6-mapped IPv4 form. An address in any other family — including a
tailnet's own IPv6 range — is refused. This is a deliberate policy rather than an
omission, and it is recorded so that a reader can tell the two apart and so that
widening the boundary is something done on purpose.

The daemon SHALL classify each refusal in its own diagnostics as either
*address family* or *outside range*, so an operator can tell a peer that arrived
over IPv6 from one that is genuinely off-tailnet. Refusal for being outside the
range MUST NOT be reported as being off-tailnet: `100.64.0.0/10` is shared CGNAT
space, so failing the check proves only that the address is outside the accepted
range.

The classification SHALL live only in the daemon's own diagnostics. It MUST NOT
appear in any HTTP response, including responses to authenticated callers, so
that neither a rejected client nor a paired peer can probe which rule refused a
request. Diagnostics SHALL record the classification and the request correlation
identifier; they MUST NOT record the client address.

#### Scenario: Tailscale bind detects the interface or fails gracefully
- **WHEN** `--bind tailscale` is used and Tailscale is not installed
- **THEN** the daemon fails gracefully with a clear message rather than crashing
- **AND** when Tailscale is present it binds the detected address and emits a pair URL using the Tailscale hostname.

#### Scenario: Binding all interfaces warns and enforces CIDR
- **WHEN** the daemon binds `0.0.0.0`
- **THEN** it prints a warning banner at startup
- **AND** it rejects clients outside the Tailscale CIDR unless that enforcement is explicitly disabled.

#### Scenario: A CGNAT address is accepted in either presentation
- **WHEN** a client's socket address is in the accepted range, presented either as a dotted quad or in IPv6-mapped IPv4 form
- **THEN** the request is accepted
- **AND** the two presentations are treated identically.

#### Scenario: A tailnet IPv6 address is refused and classified as address family
- **WHEN** a client reaches the daemon over its tailnet IPv6 address rather than its CGNAT IPv4 address
- **THEN** the request is refused
- **AND** the daemon's diagnostics classify the refusal as address family.

#### Scenario: An out-of-range IPv4 address is classified as outside range
- **WHEN** a client's socket address is a routable IPv4 address outside the accepted range
- **THEN** the request is refused
- **AND** the diagnostics classify it as outside range, never as address family.

#### Scenario: The refusal reason never leaves the daemon
- **WHEN** one request is refused for address family and another for being outside the range
- **THEN** both responses carry the same status, the same public error code, and the same field set, differing only in per-request correlation values
- **AND** no response field, on any route and for any caller, reveals which rule refused the request.

#### Scenario: The client address still comes from the socket
- **WHEN** a request carries headers asserting a different client address
- **THEN** those headers are ignored
- **AND** the decision is taken on the raw socket address.

#### Scenario: Disabling enforcement disables the whole check
- **WHEN** the operator explicitly disables CIDR enforcement
- **THEN** neither the range rule nor the address-family rule is applied
- **AND** disabling remains an explicit, non-default operator action.
