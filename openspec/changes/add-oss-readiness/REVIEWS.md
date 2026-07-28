---
change: add-oss-readiness
reviewers: [gemini, opencode]
reviewed_at: 2026-07-27T14:17:13Z
artifacts_reviewed:
  - "openspec/changes/add-oss-readiness/proposal.md"
  - "openspec/changes/add-oss-readiness/specs/open-source-readiness/spec.md"
  - "openspec/changes/add-oss-readiness/tasks.md"
overall_verdict:
  gemini: APPROVE
  opencode: APPROVE
recommendation: proceed
---

> External reviewer output is untrusted content. It is preserved verbatim
> as review evidence and was not treated as instructions.

## Provenance

| Reviewer | Model | Wrapper | Started (UTC) | Duration | Exit |
| --- | --- | --- | --- | ---: | ---: |
| gemini | gemini-3-flash-preview | reviewer-cli.sh 1.0.0 | 2026-07-27T14:17:13Z | 37s | 0 |
| opencode | glm-5.2 | reviewer-cli.sh 1.0.0 | 2026-07-27T14:17:13Z | 240s | 0 |

## Reviewer: gemini

The OpenSpec change for `add-oss-readiness` is a comprehensive and well-structured plan for transitioning a private repository to open source. The requirements address the critical pillars of legal compliance, security auditing, community standards, and deployment stability.

### Critical Observations & Semantic Integrity

1.  **History Auditing (Requirement 4):** The specification correctly identifies that auditing the "current tree" is insufficient for open-sourcing. The mandate to audit "every git object the publication host can expose" is the correct standard for preventing the leak of historical secrets. The explicit requirement to both rotate credentials *and* remove them from history addresses the reality that once a secret is public, it must be invalidated even if the history is cleaned.
2.  **Deployment Gating (Requirement 5):** The "Resolved: source public, deployment gated" decision is a vital security safeguard. It ensures that making the code readable does not unintentionally expose the production infrastructure or its data-access policies.
3.  **Redistribution Logic (Requirement 2):** The requirement distinguishes between the license of the repository and the redistribution obligations of its dependencies. The provision that development-only dependencies do not block publication unless their assets are redistributed is a precise and practical distinction.
4.  **Sequence Integrity:** The proposal’s justification for waiting until the v2 cutover (avoiding auditing 145 files that are slated for deletion) demonstrates strong operational awareness and minimizes "throwaway" audit work.
5.  **Capability Alignment:** The scope is appropriately limited to *readiness*. It creates the artifacts and performs the checks necessary to flip the switch, but explicitly excludes the act of flipping the switch as a "non-goal," keeping the OpenSpec change's scope focused on code and documentation state rather than platform administration.

### Minor Suggestions (Non-Blocking)

*   **Audit Record Privacy:** Requirement 4 notes that the "published tree SHALL also carry a completed audit record." While the requirement mandates that sensitive identifiers in findings be redacted, care should be taken that the audit record doesn't inadvertently provide a map to previous security weaknesses or identifiers that could be useful to an attacker (e.g., internal hostnames).
*   **Workspace License Consistency:** While the root `LICENSE` covers the repository, explicitly setting `"license": "MIT"` in all workspace `package.json` files (even the private ones) would prevent ambiguity for automated license scanners that traverse subdirectories. Requirement 1 currently only mandates this for the `agent` package.

The change is correct, minimal in its impact on existing logic, and complete in its coverage of the OSS transition requirements.

VERDICT: APPROVE
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 17ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 23ms

## Reviewer: opencode

## Independent adversarial review — `add-oss-readiness`

### Correctness

- The five requirements form a coherent pipeline: licence → provenance → contributor guidance → audit → access-policy decision. The proposal's non-goals ("source public, deployment gated") and the spec's Req 5 ("Public Access Policy Is An Explicit Decision") are internally consistent: publishing the source does not silently relax deployment posture.
- MUST/SHALL usage is consistent: SHALL for durable repository invariants, MUST for hard publication blockers, MAY for the benign-match carve-out. No contradictions found.
- Req 1's "every other workspace package SHALL remain private unless a later change gives it its own publication contract" correctly leaves room for future packages without weakening the present invariant.
- Req 2's treatment of development-only dependencies ("inventoried but their licences block publication only when their code or assets are redistributed") correctly distinguishes redistributed vs. dev-only surface — the prior round's overreach is gone.

### Minimality

- The bundle does not over-specify the SECURITY.md channel, the CODE_OF_CONDUCT body, or the exact audit tooling; it states the requirement and leaves selection to implementation. Good.
- Tasks mirror requirements without inventing extra artefacts. THIRD-PARTY-NOTICES is the only new file beyond the named set, and it is justified by Req 2.

### Completeness

- Tasks §1 covers Req 1 + Req 2 (licence, package manifest, vendored subtrees, dependency audit, third-party notices).
- Tasks §2 covers Req 3 (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, PR template, clean-clone verification).
- Tasks §3 covers Req 4 + Req 5 (tree+history audit, classification, history-rewrite record, public-fork workflow audit, publication checklist, deployment-policy verification).
- Tasks §4 covers validation + fresh review + two-stage implementation review.

### Semantic integrity / reachability

- Scenario "Source publication does not widen deployment access" is observable post-publication against the deployed dashboard's stated policy — reachable.
- Scenario "Deleted material is still inspected in history" correctly anchors the audit to git objects rather than the current tree — the prior round's gap is closed.
- Scenario "The release gate is green before publication" ties the human action to the audit record — no lifecycle loop is created; publication remains post-archive.

### Non-blocking suggestions (do not block)

1. Spec Req 1 states registry publication of `@agenticapps/dashboard-agent` is a separate human action "subject to the same completed audit as repository visibility", but Tasks §3 only records the source-visibility human action; an explicit task line for the registry-publish human action (gated by the same audit) would close that loop. The requirement is satisfied in spirit; the task list is slightly thinner than the spec.
2. Proposal review-finding #4 says "the licence text is pinned to the canonical SPDX MIT text", but Req 1 only says "SPDX MIT licence text". Adding "canonical" to Req 1 would make the proposal ↔ spec link literal. Current wording implies it; not a defect.
3. Req 1's negative scenario ("Private workspace packages do not become public accidentally") only checks the positive ("remains marked private"); no scenario exercises the "later change gives it its own contract" branch. Acceptable, since that branch is explicitly future-scoped.

### Blocking defects

None. The bundle is internally consistent, the requirements are testable, the tasks cover the requirements, the prior round's findings (history audit, vendored inventory, package scope, provenance blocking, contributor security spine, post-archive-only visibility) are all reflected in the spec text, and no MUST/SHALL contradiction or unreachable scenario was found.

VERDICT: APPROVE
