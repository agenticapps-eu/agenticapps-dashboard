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

## Resolved: defects spin out

The open question about whether a defect found during verification is fixed here
or spun out is **decided: spun out.** `tasks.md` already adopts it. Recorded as a
decision so the executor does not re-litigate it, and so this change stays a
clean evidence record.

## Review findings, 2026-07-26 — recorded, not yet resolved

Two reviewers (`gemini`, `opencode`) returned REQUEST-CHANGES; see `REVIEWS.md`.
`codex` was unavailable. Carried here for the next editor. **None is fixed yet.**

1. **The CIDR requirement may be in the wrong capability.**
   `CAPABILITY-MAP.md` assigns CIDR enforcement to `daemon-runtime` and tokens,
   CORS, and the pair flow to `auth-and-pairing`. This change's second added
   requirement puts a daemon-runtime mechanism into `auth-and-pairing`. Either
   move it, or restate it as a remote-access policy that references the mechanism
   without duplicating it.

2. **The correction note overstates its case.** It says neither behaviour was
   assured anywhere before. `daemon-runtime` already carries "rejects clients
   outside the Tailscale CIDR unless that enforcement is explicitly disabled", so
   the second requirement partly restates existing coverage. The first
   requirement — concurrent multi-device pairing — is genuinely new.

3. **A scenario implies daemon-side state that does not exist.** `auth-and-pairing`
   specifies that pairing state is client-side only; the daemon tracks no paired
   devices. "A second device pairs against a daemon that already has a paired
   device" cannot be arranged from the daemon side. Restate as observable
   browser-side behaviour.

4. **The opt-out flag has no scenario of its own.** Task 3.2 asserts that
   disabling enforcement requires an explicit flag and is not the default, but
   that assertion is folded into the off-tailnet rejection scenario instead of
   having its own.

5. **Address family is unspecified.** A tailnet IPv6 peer is refused, because the
   boundary is IPv4 CGNAT. This is a spec gap rather than a defect — the code
   matches the spec — and is addressed by the separate change
   `decide-tailnet-ipv6-policy`. Verification should exercise it rather than
   discover it.

6. **Task block 2 is stale.** The sequence note above requires rewriting it
   against the four v2 surfaces before the run. It still names the v1
   three-column view and its subprocess-spawning panels. Rewrite it before
   execution, or an executor will run it as written.

7. **Inter-device transport of the bearer token is unspecified.** Multi-device
   pairing introduces a device-to-device hop for the pair URL, which carries a
   credential. Existing specs cover daemon-to-browser transport only. Either
   state that the operator owns that hop as a non-goal, or specify re-sharing
   after rotation.
