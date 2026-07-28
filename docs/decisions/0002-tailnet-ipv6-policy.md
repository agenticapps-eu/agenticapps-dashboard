# ADR 0002: Keep the tailnet boundary IPv4-only

**Status:** Accepted
**Date:** 2026-07-28

## Context

The dashboard daemon can expose project data beyond loopback through its
Tailscale bind mode or an all-interface bind guarded by CIDR middleware.
Today that boundary accepts only Tailscale's IPv4 CGNAT range
`100.64.0.0/10`, including IPv6-mapped presentations of those IPv4 addresses.

Tailscale also supports an IPv6 ULA range and configurations with IPv4 disabled.
The previous product requirement did not say whether rejecting raw tailnet IPv6
was intentional. The daemon also emitted one undifferentiated diagnostic for
unsupported address families, out-of-range IPv4, and unavailable socket peer
data.

Widening admission would change a security boundary around a daemon with read
access to every registered project. No device evidence currently shows that the
documented IPv4 path is unusable.

## Decision

The daemon's tailnet admission boundary remains IPv4 CGNAT-only. It continues to
accept exactly `100.64.0.0/10` in dotted-quad or IPv6-mapped IPv4 form and
continues to reject raw IPv6, including Tailscale's reserved ULA range.

IPv6-only Tailscale configurations are supported upstream but unsupported by
this daemon. The documented workaround is to keep IPv4 enabled on both the
daemon and client nodes and connect to the daemon node's CGNAT IPv4 address.

Admission failures are classified internally as `unsupported-family`,
`outside-range`, or `address-unavailable`. The classification is logged with the
existing per-request `requestId`, never with the client address. Every
classification maps to the same existing public HTTP response and is unavailable
to authenticated callers as well as rejected peers.

CIDR enforcement remains selected by bind configuration: default `127.0.0.1`
does not install it. For explicit IP literals, `127.0.0.1` and `::1` are
loopback; every other literal is non-loopback. Because the admission boundary
accepts no raw IPv6, a specific non-loopback IPv6 bind fails before startup
while enforcement is enabled instead of starting a server that refuses every
peer. The existing explicit opt-out permits that bind. Dual-stack wildcard `::`
is the exception: it starts with enforcement and an all-interfaces warning,
admits mapped CGNAT IPv4, and refuses raw IPv6. Forwarding headers remain
untrusted.

`--bind tailscale` reports a missing or unavailable Tailscale installation
separately from a running node that has no CGNAT IPv4 address.

## Consequences

- The CIDR admission function's accepted address set does not change.
- A specific non-loopback IPv6 bind no longer falls through loopback-equivalent
  configuration. It fails fast by default and requires the deliberate opt-out;
  dual-stack wildcard `::` remains usable with CIDR enforcement.
- Operators can distinguish malformed socket state from intentional family or
  range refusals without retaining peer addresses.
- IPv6-only Tailscale peers cannot use the dashboard until IPv4 is enabled.
- A future tailnet IPv6 change must explicitly widen the boundary, provide
  device evidence, and review the fixed IPv6 prefix and bind behavior.
- Public errors intentionally remain less specific than internal diagnostics.

## Review record and gate exception

This ADR was accepted on **one** review, and the §18 change-gate counts that
review as **zero**. Recording the exception precisely, because an ADR that
overstates its own review evidence is worse than one with thin evidence.

The planning bundle went through five adversarial review rounds. The round-5
bundle was frozen at packet SHA-256
`992ec6286bc553751873a52ed880b38283382ce889eadbe3d4fc1f6d18f54a73` and sent to
three vendors. Only one returned a verdict:

- **claude** — `VERDICT: APPROVE`, 155s, exit 0.
- **gemini** — no output; free-tier quota `limit: 0` on `gemini-2.5-pro`.
- **opencode** — no output; timed out at 300s, plus two identical-prompt retries.

The two failures were environmental, not disagreements. Neither produced a
partial verdict.

The single approval carries a further caveat: `openspec-change-gate.sh` excludes
`claude` from the reviewer count whenever claude is the implementing host, so
the gate sees zero independent reviews and blocks. The mitigating fact is that
the planning artifacts were authored by **codex** and reviewed by a **separate
claude session** — a genuine cross-vendor review when it was performed, which
the gate has no way to observe.

The operator was shown all of this and explicitly accepted one reviewer as
sufficient. Implementation therefore proceeds with `GSD_SKIP_REVIEWS=1` set for
every write, which is a broader override than the usual single-step escape
hatch. It is deliberate and stays visible in command and commit output.

The exception is scoped to the artifacts frozen at that hash. Material change to
the proposal, design note, spec delta, or task ledger lapses it. Because both
reviewer failures are transient, a later session can still obtain the missing
reviews against the same packet without re-freezing the bundle — doing so would
retire this exception rather than merely age it.

Full evidence: `openspec/changes/decide-tailnet-ipv6-policy/REVIEWS.md`.

## References

- `openspec/changes/decide-tailnet-ipv6-policy/`
- `openspec/specs/daemon-runtime/spec.md`
- `packages/agent/src/server/middleware/cidr.ts`
