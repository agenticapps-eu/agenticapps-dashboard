## Reviewer: gemini
_generated 2026-07-26T14:52:15Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Risky temporal dependency:** The decision to not re-score history is entirely dependent on the `retire-v1-surfaces` change shipping in the same milestone. If that change is delayed or reverted, this change will ship a known-bad metric (a "fake improvement") to the fleet health chart. The spec should require a feature flag or other mechanism to couple these changes, or the history-rewrite task should be reinstated.

- **Unverified assumption of independence:** The spec asserts that the knowledge-graph viewer is "untouched" but provides no evidence. It's unclear if there are shared components, data schemas, or UI elements between the code-graph and knowledge-graph features that might be broken by this removal.

- **Modified requirement lacks a delta:** The `MODIFIED` requirement for `Responsive Coverage Layout` simply re-states the existing behavior of the layout. It does not describe the actual change: the removal of the code-graph column from the layout at all breakpoints. The spec delta should reflect the removal, not just the generic responsive rules.

- **Missing API impact analysis:** The change proposes deleting daemon routes without addressing whether those routes have consumers outside the dashboard UI. If any external scripts or tools hit these endpoints, this change will break them silently.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms

## Reviewer: codex
_generated 2026-07-26T14:53:25Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Removing requirements does not normatively require removing the feature. Add explicit scenarios asserting the API/schema omits code-graph data, all layouts omit its UI controls, scan/poll routes are unavailable, and the daemon cannot spawn GitNexus.
- Historical handling relies on `retire-v1-surfaces` without declaring a deployment dependency. If this lands first, the acknowledged false trend step—or strict parsing failures on old snapshots—can still occur. Specify ordering or temporary compatibility.
- “Remove the GitNexus integration” conflicts with leaving the knowledge-graph viewer untouched if that viewer uses GitNexus. Define the exact integration boundary or rename the change to avoid accidental over-removal and misleading acceptance criteria.
- `Responsive Coverage Layout` still requires each card to carry “its actions,” which is ambiguous after scan/install actions disappear. Enumerate the remaining actions and explicitly exclude removed controls in both card and table layouts.
- Persisted overrides, cached payloads, queued/running scan jobs, and stored job status are not addressed. Specify whether stale code-graph fields are ignored, migrated, or deleted and what happens to in-flight jobs during rollout.

## Reviewer: opencode
_generated 2026-07-26T14:56:12Z · timeout 180s_

I'll review this against the actual repo state before issuinga verdict.
**VERDICT: REQUEST-CHANGES**

- **Task list omits hardcoded column references that won't be caught by "remove from coverage schema."** `packages/shared/src/schemas/coverageHistory.ts:42-58` uses `.strict()` keyed on `gitNexus` as a required cell key; removing the column from `coverage.ts` while leaving history requiring `gitNexus` will throw `.strict()` runtime validation on snapshot reads *and* break tsc. `packages/agent/src/lib/snapshots/snapshotWriter.ts:35,84` hardcodes `gitNexus: string` and writes it per row. `coverage.ts:11,109` (`GitNexusInstallStateSchema` + `gitNexusInstallState` row field) and `coverage.ts:117` (`CoverageRefreshActionSchema = z.enum(['gitnexus-analyze'])` — enum goes *empty* after removal) all need explicit edits. Tasks.md blocks 1-2 say "remove the column from the coverage schema / barrel" generically; a literal executor will miss the snapshot/history/install-state surfaces and ship broken tsc + runtime `.strict()` rejection on every snapshot read.

- **Missing spec delta against `fleet-coverage` Purpose.** `openspec/specs/fleet-coverage/spec.md:11` intro reads "is the code graph indexed and fresh, is the knowledge wiki..." — that line still advertises the removed column. The MODIFIED `Responsive Coverage Layout` delta correctly rewrites "four column states" → "a state for every tracked column," but nothing touches the stale Purpose mention. Either add an intro-level delta or note that retire-v1-surfaces will retire the whole capability (it does).

- **Phantom allowed-root in the security spine.** `filesystem-access-policy` requirement "Named Allowed Roots For Fleet Scanners" scenario explicitly names `~/.gitnexus` as a scanner-read path. After this change no daemon scanner reads it. Leaving the mention mis-describes the attack surface *in the security spine spec* — matters more than ordinary drift. Add a delta removing the `~/.gitnexus` reference, or state explicitly that retire-v1-surfaces will (it won't — its filesystem-access-policy delta comes from add-workflow-fleet-conformance, not this path).

- **Descope note is stale against the renumbered tasks.md.** Proposal says "Removed as a result: task block 1 of this change... Task blocks 2 through 5 are unaffected and run as written." But `tasks.md` block 1 is now "Remove the daemon surface," which is not descoped — the continuity-recompute block was removed and the rest were renumbered. A reader checking the note against the file will conclude the daemon removal was cancelled. Fix the note to say "the original block 1 (continuity recompute) was removed; remaining blocks were renumbered 1→1, 2→2, …" or restore the original numbering with `[descoped]` markers.

- **Coupling risk not surfaced.** The descope rationale ("would have nothing left to be continuous for") and the Code-Graph Coverage Status migration text ("the step at the cutover is accepted, because retire-v1-surfaces withdraws the chart in full") both depend on `retire-v1-surfaces` actually landing. If that change is rejected or slips, this change ships a discontinuous conformance chart with no continuity mitigation and no requirement to recompute. Add an explicit ordering/dependency note — or a fallback statement that the "step is acceptable" justification stands on its own and retire-v1-surfaces is just bonus.

- **Migration text self-contradiction.** Same migration: "the 90-day trend will show a step at the cutover — accepted, because retire-v1-surfaces withdraws the conformance page, the chart, and the snapshot history in full." If the chart and history are being withdrawn wholesale, the step never renders and "accepting" it is moot — conflate two rationales (transient-window acceptability + downstream withdrawal). Tighten to one.

- **Tasks.md verification gap given the above.** "Per-package tests green (expect a large deletion in the test count)" will pass even if `coverageHistory.ts` still requires `gitNexus` and the writer fabricates an empty cell to satisfy `.strict()`. Add an explicit assertion: snapshot history records written after this change MUST NOT contain a `gitNexus` cell, and reading a pre-cutover snapshot containing `gitNexus` MUST still validate (i.e., the history schema accepts the legacy column on old records while not requiring it on new ones). Otherwise the continuity story in the descope note is unverified and likely wrong.

- **Minor: LOC/file claims unverified.** Proposal cites "~1,541 LOC product / ~2,578 LOC tests / 18 files." `find` of name-matched gitnexus files returns 16 files and ~4,029 total LOC (mixed product+test). The 18-file figure is plausible once edits to non-named files (app.ts, boot.ts, coverageScan.ts, coverage.ts, coverageHistory.ts, snapshotWriter.ts) are counted, but the cited LOC split isn't directly reconcilable. Not blocking — just flagging that an executor verifying the count will be confused.

Security/PII: removing a process-spawning scanner *improves* the posture; no PII concern. The only security-relevant issue is the orphan allowed-root in `filesystem-access-policy` documented above.

Net: intent is captured (code-graph half of code-intelligence goes, conformance loses a column, history continuity is descoped rather than silently dropped), but the task list under-specifies the schema/snapshot edits needed to make the removal actually compile and validate, and two spec slots (fleet-coverage intro, filesystem-access-policy allowed-root) carry stale text the delta does not retire.

