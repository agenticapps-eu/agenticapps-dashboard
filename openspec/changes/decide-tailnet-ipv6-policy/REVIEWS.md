## Reviewer: gemini
_generated 2026-07-26T15:12:15Z · timeout 180s_

VERDICT: REQUEST-CHANGES
*   The specification creates a contradiction for loopback addresses. It states the check applies to "non-loopback binds," but the requirement mandates that *only* IPv4 CGNAT addresses are accepted. This implies that a connection from the IPv6 loopback address (`::1`) would be incorrectly rejected. The spec needs a scenario to confirm that loopback addresses for both families are always accepted.
*   The triggering condition "non-loopback binds" is ambiguous. This should be clarified to state whether it refers to the daemon's bind configuration (e.g., listening on `0.0.0.0` or `[::]`) or the nature of the incoming request's address.
*   The policy's reliance on a hardcoded CGNAT range assumes the daemon is exclusively used with Tailscale. If the daemon could be used with other overlay networks that use different private ranges, this policy would incorrectly block them. This assumption should be stated explicitly.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 18ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms

## Reviewer: codex
_generated 2026-07-26T15:14:48Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The proposal says “a client … can tell” the rejection reasons apart, while the requirement explicitly forbids exposing that distinction. Change “client” to “operator via daemon diagnostics.”
- “No behaviour change” is false: adding reason-specific diagnostics is observable behavior. State instead that the accepted address set is unchanged.
- The unconditional “SHALL accept only” conflicts with the opt-out scenario and existing optional enforcement. Qualify it with “WHEN CIDR enforcement is enabled.”
- The compatibility premise is incomplete: Tailscale supports disabling IPv4 per-node or tailnet-wide, producing legitimate IPv6-only peers that this policy makes unusable. The change must explicitly declare that supported Tailscale configuration unsupported and document a workaround, or reconsider the policy. [Tailscale CGNAT-conflict documentation](https://tailscale.com/docs/reference/troubleshooting/network-configuration/cgnat-conflicts)
- “Outside the tailnet” is an invalid diagnostic conclusion. `100.64.0.0/10` is shared CGNAT space, and failure of this range check proves only “outside the allowed range.” Define separate classifications for native IPv6, malformed/missing socket addresses, and mapped IPv4 outside the range.
- The task requiring byte-identical responses is impossible while each response contains a distinct `requestId`. Require identical status, public error code, headers, and schema, excluding correlation values.
- The IPv6-prefix open question is already answered by current first-party documentation: `fd7a:115c:a1e0::/48` is Tailscale’s reserved prefix, not a per-tailnet configurable prefix. Also, adding a `/48` would not merely “double” the address space. [Tailscale reserved addresses](https://tailscale.com/docs/reference/reserved-ip-addresses)
- “Diagnostics” is underspecified for security and PII: define the reason codes, output channel, and whether raw client IPs are logged. Prefer a reason enum plus `requestId`; do not implicitly authorize logging addresses or spoofable forwarding headers.

## Reviewer: opencode
_generated 2026-07-26T15:16:11Z · timeout 180s_

I read `proposal.md`, `tasks.md`, the spec delta, the existing `daemon-runtime` spec, `cidr.ts`, `cidr.test.ts`, and the sibling change's `REVIEWS.md`.

VERDICT: REQUEST-CHANGES

- **Internal contradiction: "no behaviour change" vs. mandated new diagnostics.** The proposal's "No behaviour change is proposed" is contradicted by the requirement that "A refusal caused by address family SHALL be distinguishable, in the daemon's own diagnostics…" — that distinction does not exist today (`cidr.ts:48` emits a single `cidr_violation`). Tasks 1.3 ("Record the refusal reason… distinguishing address family from out-of-range") is a real, operator-visible behaviour change. Reframe the proposal: *the only* behaviour change is daemon-side diagnostics; the accepted address set is unchanged.

- **"Byte-identical for both refusal reasons" is unsatisfiable.** The rejection body is `{ ok:false, error:'cidr_violation', requestId }` where `requestId = generateRequestId()` is per-request random (cidr.ts:9,50). Two refusals are byte-distinct by construction. Scenario 3's "both clients receive the same response" and tasks 1.4's "byte-identical" cannot both hold. Soften both to *structural* indistinguishability (same status, same `error` field, no field reveals the rule).

- **Missing the symmetric out-of-CGNAT-IPv4 scenario.** Only "tailnet IPv6 address is refused" is scenario'd. The diagnosability contract has two halves — family-vs-range — but the IPv4-out-of-range case (e.g. `8.8.8.8`) being refused *and diagnosed as out-of-range (not address-family)* is not pinned. Add the WHEN/THEN or a future "widening" could conflate `8.8.8.8` with `fd7a:…`.

- **Spec structure ignores the sibling change's own review.** `verify-tailscale-second-device-access/REVIEWS.md` (line 25) already concluded "CIDR enforcement" belongs on `daemon-runtime`'s existing "Bind Modes And Network Exposure" requirement. Adding a parallel top-level Requirement duplicating CIDR governance risks drift between two requirements over the same check. Prefer MODIFIED scenarios on the existing requirement.

- **"Distinguishable in diagnostics" is under-specified.** No observable contract: an implementer could log free-text `cidr_violation` for both and claim distinguishability. Pin the mechanism (e.g., a distinct `reason` value in the structured daemon log), and state the diagnostics live **only** in internal logs — never in any HTTP response, including `/health` — so a *paired* peer cannot probe the distinction (the spec only forbids exposing it to the rejected client).

- **TDD label misapplied.** Tasks 1.2 labels the IPv6-refusal test "TDD — asserts the policy, not a bug," but the policy is already implemented (`isIPv4(clean)===false` rejects pure IPv6 today), so the test is green on first run — it's characterization, not red→green. The genuinely-red test is the new diagnostic (task 1.3); that one should carry the TDD flag.

- **Minor: no scenario for plain-dotted-quad CGNAT acceptance.** Only the mapped form is scenario'd; the symmetric plain-IPv4-in-CGNAT case is implied by existing code but unscenariod in this delta. Low priority.

- **Minor PII note:** the requirement pushes more peer-address metadata into `~/.agenticapps/dashboard/logs/` (already 0600 per filesystem-access-policy, so safe); recommend stating that only the *reason* (family vs range) need be logged, not the full source IP, to avoid gratuitous IP retention.

