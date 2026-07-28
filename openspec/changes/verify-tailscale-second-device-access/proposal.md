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

The run must use the deployed SPA's real origin and a browser-fetchable daemon
URL. In particular, an HTTPS SPA paired to a plain-HTTP Tailscale hostname would
be blocked by browser mixed-content policy. The preparation step records both
schemes and treats that combination as a failed founding use case, not as a test
environment problem to bypass with a browser exception.

Source: `docs/legacy-planning/STATE.md` §"Deferred Items" (infra-gated).

## What changes

The implementation is expected to remain unchanged. This change formalises one
previously implicit product guarantee — independent browser-local pairing on
multiple devices — and then verifies it on real hardware. CIDR enforcement is
not restated here; it remains governed by `daemon-runtime` and the sibling
`decide-tailnet-ipv6-policy` change. Defects found by the run become their own
changes.

The stateless bearer-token consequence is deliberate: the daemon keeps no device
roster, so this change does not introduce per-device revocation, audit, or
expiry. Adding those features later requires an explicit auth-model change rather
than quietly turning browser-local pairing into daemon-managed device identity.

## Capabilities

- `auth-and-pairing` — one added requirement: concurrent multi-device pairing.

> **Correction, 2026-07-26.** This section previously read "None expected". That
> was wrong about this change's own contents: concurrent multi-device pairing
> was not assured anywhere before. CIDR enforcement was already assured in
> `daemon-runtime` and is verified here without being duplicated into the
> pairing capability.

## Sequence: this change waits for the v2 surfaces

Scheduled after the Dashboard v2 cutover. Linear: AGE-481, and the project this
sequence is recorded in — see the *Sequence* section of
`openspec/CAPABILITY-MAP.md`.

Task block 2 verifies the v2 surfaces that ship — fleet, repo detail, and
workflow. The agent-change surface is not among them: `add-agent-board` was
withdrawn on 2026-07-28 and no replacement is proposed yet. If one lands before
this verification runs, it joins the block; if it does not, its absence is not a
reason to hold the evidence. Setting up the second device is the expensive part
of this work, and the evidence should be produced once against the surfaces that
actually ship.

**Not affected by v2:** task block 3. The security boundary — a client outside
the tailnet CIDR is refused, disabling enforcement requires an explicit flag and
is not the default, and token rotation forces re-pairing on every device — is
entirely independent of which surfaces exist. It could be verified today. It
waits only because it shares the second device with block 2.

The pairing requirement added here stands regardless of v2 and is **not**
withdrawn by it. This change stays open; it does not get closed and reopened.

## Non-goals

- Adding new remote-access transports. Tailscale is the supported path.
- Adding TLS termination in this verification change. If the currently
  supported Tailscale path cannot provide an agent URL fetchable from the
  deployed SPA's secure context, that is a blocking product defect and becomes
  a separately specified implementation change.
- Relaxing CIDR enforcement to make the test easier. If enforcement blocks a
  legitimate device, that is a finding, not an obstacle to route around.
- Adding an explicit device-unpair operation. No such operation exists today;
  token rotation is the only global invalidation mechanism.
- Providing a device-to-device credential transport. The operator owns the
  channel used to share a one-click pair URL, including sharing a fresh URL
  after rotation.
- Defining simultaneous registry-write conflict semantics. This change verifies
  concurrent paired reads and independent browser storage, not concurrent
  register/unregister operations.

## Resolved: defects spin out

The open question about whether an unrelated defect found during verification is
fixed here or spun out is **decided: spun out.** If verification falsifies the
new multi-device requirement itself, this change does not archive until the
requirement is corrected or an implementation change makes it true.

## Review findings, 2026-07-26 — resolved in the planning artifacts

Two reviewers (`gemini`, `opencode`) returned REQUEST-CHANGES; see `REVIEWS.md`.
`codex` was unavailable. The historical verdicts remain unchanged; the
dispositions below are the revision submitted for a fresh review.

1. **CIDR governance stays in `daemon-runtime`.** The duplicate pairing-capability
   requirement is removed; this change only verifies that boundary.

2. **The correction note now distinguishes the new pairing guarantee from
   existing CIDR coverage.**

3. **Pairing is described through two independent browser stores**, never as
   daemon-side device state.

4. **The opt-out assertion is verified against the daemon-runtime requirement**
   rather than duplicated into this delta.

5. **Address-family policy is owned by `decide-tailnet-ipv6-policy`** and is an
   explicit verification item here.

6. **Task block 2 now names the v2 surfaces individually** rather than
   verifying "the dashboard" as a whole. It named four when the finding was
   written; the agent board's withdrawal has since reduced that to three, and
   the block is written to take a replacement surface if one arrives first.

7. **Inter-device transport is an explicit operator responsibility**, and
   rotation requires a fresh URL to be shared through that operator-chosen
   channel.

8. **Browser security is part of the end-to-end check.** The run records the SPA
   and daemon URL schemes and may not bypass mixed-content or secure-context
   enforcement. An incompatible scheme pairing blocks verification and archive.

9. **Local unpairing is distinct from token rotation.** The independence
   scenario now names clearing one browser's own stored pairing; global rotation
   still invalidates every browser.

10. **Address-free diagnostics remain governed by the sibling daemon-runtime
    delta.** Verification uses controlled known inputs and a correlation
    identifier; it does not need to retain the peer address.

11. **Credential transport remains a proposal-level non-goal**, not an
    assertion embedded in the successful re-pair scenario.
