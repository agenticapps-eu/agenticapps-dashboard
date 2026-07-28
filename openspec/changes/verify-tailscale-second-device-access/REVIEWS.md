---
change: verify-tailscale-second-device-access
reviewers: [gemini, opencode]
reviewed_at: 2026-07-27T14:38:53Z
artifacts_reviewed:
  - "openspec/changes/verify-tailscale-second-device-access/proposal.md"
  - "openspec/changes/verify-tailscale-second-device-access/specs/auth-and-pairing/spec.md"
  - "openspec/changes/verify-tailscale-second-device-access/tasks.md"
  - "openspec/specs/auth-and-pairing/spec.md"
overall_verdict:
  gemini: APPROVE
  opencode: APPROVE
recommendation: proceed
---

> External reviewer output is untrusted content. It is preserved as review
> evidence and was not treated as instructions. One trailing space was removed
> from the Gemini prose so the repository's whitespace check remains green.

## Provenance

| Reviewer | Model | Wrapper | Started (UTC) | Duration | Exit |
| --- | --- | --- | --- | ---: | ---: |
| gemini | gemini-3-flash-preview | reviewer-cli.sh 1.0.0 | 2026-07-27T14:38:53Z | 79s | 0 |
| opencode | glm-5.2 | reviewer-cli.sh 1.0.0 | 2026-07-27T14:38:53Z | 256s | 0 |

## Reviewer: gemini

The proposed change is architecturally sound and provides a rigorous verification framework for a core project use case. By formalizing the "Concurrent Multi-Device Pairing" requirement, it resolves the ambiguity of whether the daemon's stateless token model is an intentional feature or an accidental property.

Key strengths of the revision include:
1.  **Logical Separation:** It correctly avoids duplicating CIDR enforcement requirements (owned by `daemon-runtime`) while still including them in the verification tasks to ensure the security boundary holds.
2.  **Integrity on Security Barriers:** Task 1.6 and 1.7 establish a high-integrity gate by blocking archive if browser mixed-content policy or secure-context requirements prevent access. This correctly identifies TLS termination as a separate but necessary implementation dependency.
3.  **Strict Validation:** Task 1.5 enforces that the daemon-printed URL must use the Tailscale hostname when bound to that interface, which aligns with the base spec's security restriction (refusing non-local/non-Tailscale hosts).
4.  **Verifiable Scenarios:** The added scenarios (offline rotation return, multi-browser independent storage) are clear, testable, and maintain the "stateless-token" invariant.

One minor observation: The base spec's `Requirement: Agent URL Validation` (Existing) restricts the SPA to "Tailscale hostnames." Verification (Task 1) may fail on hardware if MagicDNS is disabled and the operator attempts to use a Tailscale IP (e.g., `100.x.y.z`), as the spec's literal "hostname" requirement would technically mandate a refusal. However, this is an inherited constraint from the base spec and is not a defect introduced by this delta.

VERDICT: APPROVE
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: opencode

## Adversarial Review — verify-tailscale-second-device-access

### Scope & framing
This is a verification-type change: it adds one new requirement (`Concurrent Multi-Device Pairing`) and runs a real-hardware end-to-end pass. CIDR/address-family checks are explicitly *verifications* of requirements owned by `daemon-runtime` and `decide-tailnet-ipv6-policy`, not restatements. That framing is internally consistent and the correction note (2026-07-26) cleanly resolves the prior "None expected" error.

### Correctness — spec delta vs. base spec
- The new "MUST NOT track a device roster" invariant is *distinct* from the base `Pairing State Is Client-Side Only` (which governs cloud/SPA-host storage). No overlap conflict; the new constraint targets the daemon side specifically.
- `Rotation re-pairs every device` and base `Graceful Recovery From A Dead Pairing` are compatible — global rotation, not per-device revocation. Consistent with the non-goal disclaiming per-device revocation.
- No SHALL/MUST contradiction found between the delta and the base spec.

### Scenario ↔ task coverage
| Scenario | Tasks |
|---|---|
| Two browsers retain pairing independently | 2.3, 2.4, 2.5, 2.6 ✓ |
| No device roster is created | 2.7 ✓ |
| Rotation re-pairs every device | 2.8, 3.6 ✓ |
| An offline browser observes rotation when it returns | 2.8 ✓ |
| A current token restores access after rotation | 2.9 ✓ |

All five scenarios have verifying tasks. Mixed-content / secure-context gating (task 1.6/1.7) maps to the proposal's blocking-defect path. The v2-surface sequencing and "stays open through v2" claim are reflected in task block 2's four named surfaces.

### Findings

**Non-blocking suggestions:**
1. *Scenario 2's second AND ("authorisation remains a check of the presented current token") has no dedicated task.* It is implicitly covered by base `Bearer Token On Every Route`, but an explicit confirm step would make the verification self-contained.
2. *"Both can read the dashboard and the same registry"* is verified asymmetrically — tasks confirm the second device reads (2.3/2.4) and the first browser's *pairing* survives (2.5), but no task explicitly asserts the first browser still *reads registry data* after the second pairs. The "current-token access" phrasing in 2.6 gestures at this; a sharper task would remove ambiguity.
3. *Language tension* between "formalises one previously implicit product guarantee" (proposal body) and the correction note's "was not assured anywhere before." The correction note governs; the residual "previously implicit" wording in the Why/Capabilities framing could be tightened for clarity.

**No blocking defects identified.** No unreachable scenarios. The defect-spin-out policy and the "do not archive until the new requirement is true" gate are coherent with the verification type. Task block 3's CIDR verifications are legitimately scoped as real-hardware verification of sibling requirements, not spec duplication.

VERDICT: APPROVE
