## ADDED Requirements

### Requirement: The Tailnet Boundary Is IPv4 CGNAT Only

The client-address check that guards non-loopback binds SHALL accept only
addresses within the IPv4 CGNAT range, including addresses presented in
IPv6-mapped IPv4 form. Addresses in any other family — including a tailnet's own
IPv6 range — SHALL be refused.

This is a deliberate policy, not an omission. It is recorded as a requirement so
that a future reader can tell a decision from an oversight, and so that widening
the boundary is a change someone makes on purpose.

A refusal caused by address family SHALL be distinguishable, in the daemon's own
diagnostics, from a refusal caused by an address being outside the tailnet. The
distinction MUST NOT be exposed to the rejected client, which continues to
receive the same response either way.

#### Scenario: A mapped IPv4 tailnet address is accepted
- **WHEN** a client's socket address is a tailnet CGNAT address presented in IPv6-mapped IPv4 form
- **THEN** the mapping prefix is stripped and the address is accepted
- **AND** it is treated identically to the same address in plain dotted-quad form.

#### Scenario: A tailnet IPv6 address is refused
- **WHEN** a client reaches the daemon over its tailnet IPv6 address rather than its CGNAT IPv4 address
- **THEN** the request is refused
- **AND** the daemon's diagnostics record that the refusal was on address family, not on range.

#### Scenario: The rejected client learns nothing extra
- **WHEN** a request is refused for address family and another is refused for being outside the range
- **THEN** both clients receive the same response
- **AND** neither response reveals which rule refused it.

#### Scenario: The client address still comes from the socket
- **WHEN** a request carries headers that assert a different client address
- **THEN** those headers are ignored
- **AND** the decision is taken on the raw socket address.

#### Scenario: The policy does not alter the opt-out
- **WHEN** enforcement is explicitly disabled by the operator
- **THEN** the address-family rule is not applied either
- **AND** disabling remains an explicit, non-default operator action.
