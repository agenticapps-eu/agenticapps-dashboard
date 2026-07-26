# State the tailnet boundary's address-family policy

## Why

The daemon's remote-access boundary is specified as the CIDR `100.64.0.0/10`,
which is an IPv4 CGNAT range. `isTailscaleCIDR` implements exactly that: it
strips an IPv6-mapped IPv4 prefix, requires a strict dotted quad, and rejects
everything else.

Tailscale assigns each node **both** a CGNAT IPv4 address and an IPv6 ULA from
`fd7a:115c:a1e0::/48`. A peer that reaches the daemon over its IPv6 address is
therefore refused with a CIDR violation, on a tailnet, from a legitimately paired
device.

**The code is not wrong.** It matches the spec, which names an IPv4 range and is
silent on IPv6. The gap is in the specification: it never says whether the tailnet
boundary is deliberately IPv4-only or whether IPv6 was simply not considered. A
reader today cannot tell a policy from an oversight, and neither can anyone
debugging a second device that will not connect.

Found during the OpenSpec plan review of
`verify-tailscale-second-device-access` (2026-07-26), by a reviewer that read
`packages/agent/src/server/middleware/cidr.ts` rather than only the spec.

## What changes

No behaviour change is proposed. The boundary stays IPv4 CGNAT only, and that
becomes an **explicit, reasoned policy** with a scenario, plus a diagnosable
rejection so the failure mode is legible.

Two things become true that are not true today:

1. The spec states that the tailnet boundary is IPv4-CGNAT-only, and why.
2. A client refused because it arrived over IPv6 can tell that apart from a
   client refused for being off-tailnet entirely.

## Capabilities

- `daemon-runtime` — the bind-mode and CIDR requirement gains an explicit
  address-family policy

## Why not simply widen the range

Widening a security boundary is not a free default. Adding
`fd7a:115c:a1e0::/48` would double the accepted address space on the strength of
a review finding, with no reported case of a device that could not connect. The
existing boundary has held for every device actually paired so far.

Making the narrow policy explicit costs nothing and is reversible; widening
first and discovering later that the ULA prefix is configurable per tailnet, or
that a mapped-IPv4 path was already sufficient, is not. If a real IPv6-only
tailnet peer appears, widening becomes a change with evidence behind it.

## What this change explicitly does not do

- **It does not change who can reach the daemon.** The accepted set is exactly
  what it is today.
- **It does not relax CIDR enforcement**, and does not touch the opt-out flag or
  its default.
- **It does not read `X-Forwarded-For`.** The client address continues to come
  from the raw socket; the anti-spoofing property is untouched.
- **It does not move the requirement between capabilities.** CIDR enforcement
  belongs to `daemon-runtime`, and this change keeps it there.

## Open questions

> [GAP: Whether Tailscale's IPv6 ULA prefix is fixed fleet-wide or varies per
> tailnet was not established — it determines whether a future widening can use
> a constant prefix or must discover it. Not resolved here because this change
> does not widen. Recommended: establish it before any widening, not after.]
