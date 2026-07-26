# Verify second-device access over Tailscale

## Why

Remote access from a second device is a founding use case: the original spec
describes opening the dashboard on an iPad and pointing it at a Tailscale
hostname. The daemon implements it — `--bind tailscale`, Tailscale-hostname pair
URLs, and CIDR enforcement are all specified in `daemon-runtime` and
`auth-and-pairing` and are covered by unit and integration tests.

What has never happened is an end-to-end run on real hardware. Decision D-14-04
deferred it as infra-gated, and the v1.2 close carried it forward noting it was
"verified at code/test level only". A second device and a working tailnet cannot
be simulated in the test suite.

Source: `docs/legacy-planning/STATE.md` §"Deferred Items" (infra-gated).

## What changes

No product change is expected. This is a verification pass against behaviour
already specified. If it uncovers defects, those become their own changes.

## Capabilities

None expected. `daemon-runtime` and `auth-and-pairing` already specify the
behaviour being verified; this change only produces evidence that it holds on
real infrastructure.

## Non-goals

- Adding new remote-access transports. Tailscale is the supported path.
- Relaxing CIDR enforcement to make the test easier. If enforcement blocks a
  legitimate device, that is a finding, not an obstacle to route around.

## Open questions

> [GAP: If verification uncovers a defect, does it get fixed inside this change
> or spun out? Recommended: spin out, so this change stays a clean evidence
> record and the fix carries its own spec delta.]
