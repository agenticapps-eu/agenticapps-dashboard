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

- `auth-and-pairing` — two added requirements: concurrent multi-device pairing,
  and reachability confined to the tailnet.

> **Correction, 2026-07-26.** This section previously read "None expected". That
> was wrong about this change's own contents: the `auth-and-pairing` delta in
> `specs/` adds two requirements, because neither behaviour was assured anywhere
> before. The delta is correct; the self-description had fallen behind it.

## Sequence: this change waits for the v2 surfaces

Scheduled after the Dashboard v2 cutover. Linear: AGE-481, and the project this
sequence is recorded in — see the *Sequence* section of
`openspec/CAPABILITY-MAP.md`.

Task block 2 verifies that a single-project view renders in full, including the
panels that spawn subprocesses. Those are precisely the panels
`retire-v1-surfaces` withdraws. Verifying against a surface that is weeks from
deletion produces evidence with an expiry date, and the run would have to be
repeated afterwards anyway. Setting up the second device is the expensive part of
this work, and it should be paid once.

**Before running:** rewrite task block 2 against the four v2 surfaces — fleet,
repo detail, workflow, board.

**Not affected by v2:** task block 3. The security boundary — a client outside
the tailnet CIDR is refused, disabling enforcement requires an explicit flag and
is not the default, and token rotation forces re-pairing on every device — is
entirely independent of which surfaces exist. It could be verified today. It
waits only because it shares the second device with block 2.

The two requirements added here stand regardless of v2 and are **not** withdrawn
by it. This change stays open; it does not get closed and reopened.

## Non-goals

- Adding new remote-access transports. Tailscale is the supported path.
- Relaxing CIDR enforcement to make the test easier. If enforcement blocks a
  legitimate device, that is a finding, not an obstacle to route around.

## Open questions

> [GAP: If verification uncovers a defect, does it get fixed inside this change
> or spun out? Recommended: spin out, so this change stays a clean evidence
> record and the fix carries its own spec delta.]
