# Tasks

Small and independent of the v2 sequence. Can run at any point.

## 1. Pin the existing policy (characterisation, not TDD)

These tests are **green on first run** — the behaviour already exists. They are
characterisation tests that stop a later refactor from silently changing the
accepted set. They deliberately carry no TDD flag: a test that cannot fail first
is not a red-green cycle, and labelling it as one would be the red flag it looks
like.

- [ ] Test: a CGNAT address in IPv6-mapped form is accepted — pins the mapping strip
- [ ] Test: a CGNAT address as a plain dotted quad is accepted
- [ ] Test: a tailnet IPv6 address is refused
- [ ] Test: a routable IPv4 address outside the range is refused
- [ ] Test: default `127.0.0.1` loopback mode does not install CIDR middleware
- [ ] Test: tailscale and `0.0.0.0` modes do install it unless explicitly disabled
- [ ] Test: a loopback-source request against `0.0.0.0` is subjected to CIDR enforcement and refused as outside the accepted range
- [ ] Test: an existing explicit non-loopback IPv4 bind remains accepted and enables CIDR enforcement by default
- [ ] Test: request-ID middleware runs before CIDR middleware and supplies the existing `requestId`
- [ ] Test: forwarded client-address headers do not affect the raw-socket admission decision
- [ ] Test: `0.0.0.0` retains its startup warning banner
- [ ] Test: `--bind tailscale` with a CGNAT IPv4 address still binds it and uses the Tailscale hostname in the pair URL

## 2. Classify the refusal (TDD — this is the red test)

- [ ] Test first: `unsupported-family`, `outside-range`, and `address-unavailable` are distinguishable in daemon diagnostics
- [ ] Implement the classification
- [ ] Test: each refusal diagnostic contains its classification and existing `requestId`, but neither the raw nor normalised client address
- [ ] Test: the classification appears in no HTTP response on any route, for authenticated callers as well as rejected ones
- [ ] Test: all refusal classes return the same status, public error code, and field set
- [ ] Test: IPv6-mapped `::ffff:8.8.8.8` normalises first and reports `outside-range`
- [ ] Test first: `--bind tailscale` distinguishes a missing/unavailable installation from a running node without a CGNAT IPv4 address
- [ ] Implement the distinct Tailscale setup diagnostics
- [ ] Test first: explicit `::1` is loopback; dual-stack `::` starts with enforcement, warns, admits mapped CGNAT IPv4, and refuses raw IPv6
- [ ] Test first: a specific non-loopback IPv6 literal fails before startup while enforcement is enabled
- [ ] Test first: a specific non-loopback IPv6 literal binds with the explicit opt-out
- [ ] Test: the opt-out skips both admission rules, admitting a raw IPv6 peer and an out-of-range IPv4 peer
- [ ] Implement explicit IPv6 bind classification and the fail-fast setup diagnostic

## 3. Documentation

- [ ] Update `README.md` Pair and FAQ sections to state the IPv4-only boundary where a second-device operator meets it
- [ ] Update `README.md` Troubleshooting with the workaround: leave IPv4 enabled on both daemon and client nodes
- [ ] In `README.md`, name IPv6-only mode as a supported Tailscale configuration that this daemon does not support
- [ ] Document that a specific non-loopback IPv6 literal requires the explicit CIDR opt-out and that enforced `::` serves only mapped CGNAT IPv4 peers
- [ ] Document that CIDR enforcement on `0.0.0.0` also refuses a local loopback-source request unless explicitly disabled
- [ ] Keep CLI help and `README.md` consistent with explicit IPv4 and IPv6 bind inputs
- [ ] Record the accepted policy and consequences in `docs/decisions/0002-tailnet-ipv6-policy.md`

## 4. Verify

- [ ] `openspec validate --all` green
- [ ] Fresh independent OpenSpec change review approves the revised artifacts before implementation
- [ ] `pnpm lint` green; agent tests green
- [ ] Confirm the accepted address set is unchanged — this change classifies refusals, it does not widen or narrow the boundary

## Out of scope

- [ ] Do NOT add the tailnet IPv6 range to the accepted set — that is a separate change needing evidence of a peer that cannot connect
- [ ] Do NOT relax CIDR enforcement or change the opt-out flag's default
- [ ] Do NOT begin trusting forwarding headers
- [ ] Do NOT expose the refusal classification in any HTTP response
- [ ] Do NOT log client IP addresses
