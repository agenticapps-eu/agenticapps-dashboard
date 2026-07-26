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

## 2. Classify the refusal (TDD — this is the red test)

- [ ] Test first: a refusal on address family and a refusal on range are distinguishable in the daemon's diagnostics (fails today — one undifferentiated violation is emitted)
- [ ] Implement the classification
- [ ] Diagnostics record the classification and the request correlation identifier — **not** the client address
- [ ] Test: the classification appears in no HTTP response on any route, for authenticated callers as well as rejected ones
- [ ] Test: two refusals of different classes return the same status, the same public error code, and the same field set, differing only in per-request correlation values

> **Not** byte-identical responses. The rejection body carries a per-request
> random correlation id, so byte equality is unsatisfiable by construction. The
> guarantee is structural indistinguishability.

## 3. Documentation

- [ ] State the IPv4-only boundary where an operator setting up a second device will meet it
- [ ] Document the workaround for an IPv6-only tailnet node: leave IPv4 enabled on the node running the dashboard client
- [ ] Name this as a supported Tailscale configuration that this daemon does not support, rather than implying it cannot occur

## 4. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; agent tests green
- [ ] Confirm the accepted address set is unchanged — this change classifies refusals, it does not widen or narrow the boundary

## Out of scope

- [ ] Do NOT add the tailnet IPv6 range to the accepted set — that is a separate change needing evidence of a peer that cannot connect
- [ ] Do NOT relax CIDR enforcement or change the opt-out flag's default
- [ ] Do NOT begin trusting forwarding headers
- [ ] Do NOT expose the refusal classification in any HTTP response
- [ ] Do NOT log client IP addresses
