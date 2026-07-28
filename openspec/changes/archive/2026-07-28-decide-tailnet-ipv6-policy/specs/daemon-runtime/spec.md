## MODIFIED Requirements

### Requirement: Bind Modes And Network Exposure

The daemon SHALL bind `127.0.0.1` by default and MUST support `--bind tailscale`
(auto-detecting the Tailscale CGNAT IPv4 address) and explicit IPv4 and IPv6
literals, including `0.0.0.0` and `::`. For explicit IP literals,
`127.0.0.1` and `::1` SHALL be classified as loopback and every other literal
SHALL be classified as non-loopback. For CLI binds classified as non-loopback,
CIDR enforcement MUST be enabled by default unless the operator explicitly
disables it. Dual-stack wildcard `::` SHALL start with enforcement enabled by default,
admitting IPv6-mapped CGNAT IPv4 while refusing raw IPv6; the existing
explicit opt-out disables that enforcement as it does for any other
non-loopback bind. Any other
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
