# Tasks

Small and independent of the v2 sequence. Can run at any point.

## 1. Make the policy explicit and diagnosable

- [ ] Test first: a tailnet CGNAT address in IPv6-mapped form is accepted (this already passes — pin it so a refactor cannot silently drop the mapping strip)
- [ ] Test first: an address in the tailnet's IPv6 range is refused (TDD — asserts the policy, not a bug)
- [ ] Record the refusal reason in the daemon's own diagnostics, distinguishing address family from out-of-range
- [ ] Confirm the client-facing response is byte-identical for both refusal reasons
- [ ] Confirm the decision still reads the raw socket address and ignores forwarding headers

## 2. Documentation

- [ ] State the IPv4-only boundary where an operator setting up a second device will meet it, so a refused IPv6 peer is diagnosable without reading the source

## 3. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; agent tests green
- [ ] Confirm no change to the accepted address set — this change makes a policy explicit, it does not widen or narrow it

## Out of scope

- [ ] Do NOT add the tailnet IPv6 range to the accepted set — that is a separate change, and it needs evidence of a real peer that cannot connect
- [ ] Do NOT relax CIDR enforcement or change the opt-out flag's default
- [ ] Do NOT begin trusting forwarding headers
- [ ] Do NOT reveal the refusal reason to the rejected client
