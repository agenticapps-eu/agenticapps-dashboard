# Tasks

Small and independent of the v2 sequence. Can run at any point.

## 1. Pin the existing policy (characterisation, not TDD)

These tests are **green on first run** — the behaviour already exists. They are
characterisation tests that stop a later refactor from silently changing the
accepted set. They deliberately carry no TDD flag: a test that cannot fail first
is not a red-green cycle, and labelling it as one would be the red flag it looks
like.

- [x] Test: a CGNAT address in IPv6-mapped form is accepted — pins the mapping strip
- [x] Test: a CGNAT address as a plain dotted quad is accepted
- [x] Test: a tailnet IPv6 address is refused
- [x] Test: a routable IPv4 address outside the range is refused
- [x] Test: default `127.0.0.1` loopback mode does not install CIDR middleware
- [x] Test: tailscale and `0.0.0.0` modes do install it unless explicitly disabled
- [x] Test: a loopback-source request against `0.0.0.0` is subjected to CIDR enforcement and refused as outside the accepted range
- [x] Test: an existing explicit non-loopback IPv4 bind remains accepted and enables CIDR enforcement by default
- [x] Test: request-ID middleware runs before CIDR middleware and supplies the existing `requestId`
- [x] Test: forwarded client-address headers do not affect the raw-socket admission decision
- [x] Test: `0.0.0.0` retains its startup warning banner
- [x] Test: `--bind tailscale` with a CGNAT IPv4 address still binds it and uses the Tailscale hostname in the pair URL

## 2. Classify the refusal (TDD — this is the red test)

- [x] Test first: `unsupported-family`, `outside-range`, and `address-unavailable` are distinguishable in daemon diagnostics
- [x] Implement the classification
- [x] Test: each refusal diagnostic contains its classification and existing `requestId`, but neither the raw nor normalised client address
- [x] Test: the classification appears in no HTTP response on any route, for authenticated callers as well as rejected ones
- [x] Test: all refusal classes return the same status, public error code, and field set
- [x] Test: IPv6-mapped `::ffff:8.8.8.8` normalises first and reports `outside-range`
- [x] Test first: `--bind tailscale` distinguishes a missing/unavailable installation from a running node without a CGNAT IPv4 address
- [x] Implement the distinct Tailscale setup diagnostics
- [x] Test first: explicit `::1` is loopback; dual-stack `::` starts with enforcement, warns, admits mapped CGNAT IPv4, and refuses raw IPv6
- [x] Test first: a specific non-loopback IPv6 literal fails before startup while enforcement is enabled
- [x] Test first: a specific non-loopback IPv6 literal binds with the explicit opt-out
- [x] Test: the opt-out skips both admission rules, admitting a raw IPv6 peer and an out-of-range IPv4 peer
- [x] Implement explicit IPv6 bind classification and the fail-fast setup diagnostic

## 3. Documentation

- [x] Update `README.md` Pair and FAQ sections to state the IPv4-only boundary where a second-device operator meets it
- [x] Update `README.md` Troubleshooting with the workaround: leave IPv4 enabled on both daemon and client nodes
- [x] In `README.md`, name IPv6-only mode as a supported Tailscale configuration that this daemon does not support
- [x] Document that a specific non-loopback IPv6 literal requires the explicit CIDR opt-out and that enforced `::` serves only mapped CGNAT IPv4 peers
- [x] Document that CIDR enforcement on `0.0.0.0` also refuses a local loopback-source request unless explicitly disabled
- [x] Keep CLI help and `README.md` consistent with explicit IPv4 and IPv6 bind inputs
- [x] Record the accepted policy and consequences in `docs/decisions/0002-tailnet-ipv6-policy.md`

## 4. Verify

- [x] `openspec validate --all` green
- [~] Fresh independent OpenSpec change review approves the revised artifacts before implementation
      — **NOT satisfied; deliberately overridden.** One reviewer (claude) approved the
      round-5 bundle and the change-gate counts it as zero, because claude is also the
      implementing host. Gemini and OpenCode produced no output (quota 0, 300s timeout).
      The operator accepted this explicitly; implementation ran under
      `GSD_SKIP_REVIEWS=1`. Both reviewer failures are transient, so this item can still
      be closed against the same packet hash. See REVIEWS.md and ADR 0002.
- [x] `pnpm lint` green; agent tests green
- [x] Confirm the accepted address set is unchanged — this change classifies refusals, it does not widen or narrow the boundary

## Out of scope

- [x] Do NOT add the tailnet IPv6 range to the accepted set — that is a separate change needing evidence of a peer that cannot connect
- [x] Do NOT relax CIDR enforcement or change the opt-out flag's default
- [x] Do NOT begin trusting forwarding headers
- [x] Do NOT expose the refusal classification in any HTTP response
- [x] Do NOT log client IP addresses

## Verification evidence (2026-07-28)

- `openspec validate decide-tailnet-ipv6-policy --strict` — valid.
- `openspec validate --all` — 19 passed, 0 failed.
- Characterisation: 25 tests, green on first run, before any production change.
- RED/GREEN: three cycles, each with the RED failure count recorded in its
  commit message (9/5, 5/3, 7/6 failed-passed).
- `pnpm -r typecheck` — clean across 5 packages.
- `pnpm lint` — 0 errors. The one warning this change introduced was fixed; the
  188 remaining warnings are pre-existing and untouched.
- Agent suite — 1150 passed, 1 skipped, 0 failed. Shared — 308 passed.
- Accepted-set sweep — ~4,000 addresses agree with an independent reference
  implementation of the requirement.

### Post-implementation gates (2026-07-28)

- `cso` security gate — RUN, diff-scoped. 1 MEDIUM finding (the fail-open bind
  fallthrough), since fixed. Report at `.gstack/security-reports/`.
- Stage-3 implementation review — RUN, two independent reviewers including a
  genuine cross-vendor (codex) pass. Verdict from codex was REQUEST-CHANGES.
  Five defects found and fixed; see the Stage-3 section of REVIEWS.md.
- Post-fix verification: agent suite 1201 passed / 1 skipped / 0 failed;
  typecheck clean across 5 packages; lint 0 errors, no warnings in any changed
  file; `openspec validate --all` 19/19.

### Refusal-diagnostic volume — ruled on and closed (2026-07-28)

- [x] Rate limit refusal diagnostics: one correlated line per class per window,
      repeats collapsed into a reported count. Spec delta and ADR 0002 record
      the requirement and the two rejected alternatives.
- [x] Amending the spec delta after the frozen-packet review is recorded in
      REVIEWS.md as spending the override's artifact scoping, rather than being
      carried forward silently.

Final verification: agent suite 1208 passed / 1 skipped / 0 failed; typecheck
clean across 5 packages; lint 0 errors with no warnings in any changed file;
`openspec validate --all` 19/19.

The only item still carrying `[~]` is the pre-implementation plan review, which
was overridden and never satisfied. It is left open deliberately: the Stage-3
implementation review does not retroactively discharge a gate that exists to run
*before* code.
