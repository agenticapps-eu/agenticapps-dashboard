## Reviewer: gemini
_generated 2026-07-26T14:30:15Z · timeout 180s_

VERDICT: REQUEST-CHANGES
*   The spec correctly removes routes for withdrawn surfaces, but does not define the required behavior for a user navigating to a legacy URL (e.g., from a browser bookmark). Should these routes hard-404, or should they redirect to the main fleet view to provide a better transition experience?
*   The term "inert" for abandoned historical data files is ambiguous. The change should be more explicit, stating that this data is no longer read or written by the v2 system and should be considered for a separate, future cleanup or archival process to avoid becoming technical debt.
*   In the "Fleet Trend Chart" withdrawal, the reasoning for dropping the history recomputation is sound. However, the change should explicitly state that the underlying principle (a measurement change must not be presented as a health change) remains a core value for any future time-series data the product might adopt.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 17ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: opencode
_generated 2026-07-26T14:35:30Z · timeout 180s_

I'll review this against the actual repo state to verify the claims. Let me check keyfacts.
I verified counts against `openspec/specs/` and the related change folders. Counts check out (7+10+9+5+11=42; 42+8=50; code-intelligence 5 here + 2 in `remove-gitnexus-integration`). But several issues stand.

VERDICT: REQUEST-CHANGES

- **Capability-count arithmetic is wrong.** "Capability count goes 12 → 10" — withdrawing 5 capabilities from 12 yields **7**, not 10. Even folding in the new v2 capabilities (repo-readiness, workflow-fleet-conformance, …) the figure doesn't resolve to 10 from this change's own scope, and this change only withdraws. A reader checking the proposal in isolation gets a false number; either justify the net (name the +N additions) or state "12 → 7 by this change."
- **Undefined anchor "reference width."** The new `Dense Rows And Aligned Figures` requirement uses "at the reference width" twice, but `design-system/spec.md` defines breakpoints, not a single reference width. No numeric anchor exists; the scenarios are untestable until "reference width" is defined (or rewritten against the existing breakpoint vocabulary).
- **Ungoverned typography clause.** `Dense Rows…` asserts "Typography SHALL stay within one family, a small set of sizes, and a small set of weights" — no scenario covers it, and "small set" has no bound. A SHALL with no test and no threshold will validate green while being unenforceable. Either add a scenario that enumerates the allowed sizes/weights or downgrade to a non-normative note.
- **Latent name-resolution hazard.** retire's REMOVED list names `Change Progress Column` and `Capability Panel`, neither of which exists on `main` (both arrive via `add-openspec-project-reader`, which renames `Phase Progress Column` and adds the panel). The prose dependency is correct, but the delta does not validate against `main` alone. The ordering should be enforced structurally (ordering assertion in tasks.md / a §18 dependency edge), not just by prose, so a reordering can't silently break `openspec validate`.
- **Tautological second scenario.** In `State Is Never Signalled By Colour Alone`, the "rule holds across surfaces" scenario restates the SHALL ("the second channel is present on all of them") instead of exhibiting a failing case. Replace with a concrete negation: e.g., a status chip that swaps hue with no glyph/shape/fill change fails the requirement.
- **The "vacuous" withdrawal of `optional-integrations`'s works-without guarantee is a real semantic relaxation, not just a wording cleanup.** Withdrawing the requirement leaves no standing constraint in the spec slot; a future add-integration change would have to re-derive it from an archived proposal. The open-question flag is honest, but the safer resolution is to keep one requirement ("if any integration exists, the dashboard must render all other surfaces without it configured") — vacuous now, binding later — rather than relying on a future author reading the archive.
- **Migration/retention text can contradict AGE-474.** Multiple migrations state files (snapshots, `env.json`) are "left in place rather than deleted; they become inert," but actual deletion is AGE-474. Either cross-reference AGE-474's scope to confirm it does NOT remove those files, or move the retention statement into AGE-474. As written, two changes can contradict on whether the files survive cutover.
- **"Absence marker" is undefined.** In `A Value Is Shown Where One Exists`, the absence-marker scenario forbids a placeholder number but never says what an absence marker is (dash? em-dash? the word "none"?). A reader can't distinguish a correct absence render from a missing-render bug. Pin a single canonical marker or reference the readiness vocabulary's `never`/`na` glyphs.
- **Minor: PII/security.** No new data flow is introduced (this is a withdrawal change), and the `Secrets Manager Status Reflection Only` and `Environment Configuration Without A Secret Store` migrations correctly state nothing changes about secret handling. No security regression from the withdrawal itself — flagging only to confirm I checked.

