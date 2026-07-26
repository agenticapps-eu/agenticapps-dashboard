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

**The accepted address set is unchanged.** Exactly the same clients are admitted
and refused as today.

There is one behaviour change, and it is daemon-side: refusals become
**classified** in the daemon's own diagnostics as either *address family* or
*outside range*. Today a single undifferentiated violation is emitted, so an
operator debugging a second device that will not connect cannot tell an IPv6 peer
from an off-tailnet one. That classification never leaves the daemon — not to the
rejected client, and not to an authenticated caller either, so no one can probe
which rule refused a request.

An earlier draft of this proposal claimed "no behaviour change is proposed" while
mandating those diagnostics. Two reviewers caught the contradiction.

## Capabilities

- `daemon-runtime` — the bind-mode and CIDR requirement gains an explicit
  address-family policy

## Why not simply widen the range — and what that costs

Widening a security boundary is not a free default, so the narrow policy stays.
But the honest version of this argument is weaker than the first draft's, and a
reviewer was right to press on it.

**Tailscale supports disabling IPv4 per node or tailnet-wide.** An IPv6-only peer
is therefore a *supported upstream configuration*, not an exotic edge case. This
change consequently declares a supported Tailscale configuration **unsupported by
this daemon**. That is a real limitation and is stated here rather than left to be
discovered by whoever hits it.

**The workaround, for anyone who does:** leave IPv4 enabled for the node running
the dashboard client. The daemon accepts that node's CGNAT address, and no other
setting has to change.

The narrow policy is kept anyway because making it explicit is cheap and
reversible, while widening is neither. Widening means accepting a second address
family in the code path that decides who may reach a daemon holding filesystem
read access to every registered project — and doing so on the strength of a
review finding rather than a device that demonstrably cannot connect. If such a
device appears, widening becomes a change with evidence behind it, and the
workaround above is what carries the gap until then.

## What this change explicitly does not do

- **It does not change who can reach the daemon.** The accepted set is exactly
  what it is today.
- **It does not relax CIDR enforcement**, and does not touch the opt-out flag or
  its default.
- **It does not read `X-Forwarded-For`.** The client address continues to come
  from the raw socket; the anti-spoofing property is untouched.
- **It does not move the requirement between capabilities.** CIDR enforcement
  belongs to `daemon-runtime`, and this change keeps it there — as a modification
  of the existing bind-mode requirement rather than a parallel one, so two
  requirements cannot drift apart over the same check.
- **It does not log client addresses.** The diagnostics carry the classification
  and the request correlation identifier, not the peer's IP. Making a refusal
  diagnosable must not become a reason to start retaining addresses.

## Resolved: the IPv6 prefix is fixed, not per-tailnet

An earlier draft left open whether Tailscale's IPv6 prefix varies per tailnet. A
reviewer closed it against first-party documentation: `fd7a:115c:a1e0::/48` is a
**reserved prefix**, the same for every tailnet, not a per-tailnet value that
would have to be discovered.

That makes a future widening simpler than assumed — a constant prefix, matched
the same way the IPv4 range is. It also corrects a figure in the first draft:
adding a `/48` does not "double" the accepted space, it adds an address family
vastly larger than the IPv4 range. The argument against widening does not rest on
that figure, but the figure was wrong and is not left standing.
