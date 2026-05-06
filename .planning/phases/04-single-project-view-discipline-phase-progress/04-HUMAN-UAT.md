---
status: partial
phase: 04-single-project-view-discipline-phase-progress
source: [04-VERIFICATION.md]
started: "2026-05-06T12:00:00Z"
updated: "2026-05-06T15:35:00Z"
---

## Current Test

[testing paused — 1 issue (G1 + G2), 1 blocked on Phase 5 prerequisite]

## Tests

### 1. Live navigation to project detail
expected: Start daemon (`agentic-dashboard start`) and dev server (`pnpm --filter @agenticapps/dashboard-spa dev`). On `/`, click any project card. Browser routes to `/projects/{id}` and renders the ProjectHeader breadcrumb plus the two-column grid (Discipline left, Phase Progress center) with all 8 panel headings visible — no phantom placeholder text, no `data-slot` stubs.
result: pass

### 2. CommitmentBlock live data
expected: Register a project that has at least one `.planning/skill-observations/*.md` file containing a `## Workflow commitment` heading. Navigate to its detail page. The CommitmentBlock panel shows the most recent commitment markdown verbatim in a `<pre>` block, with a "Source: filename" line below.
result: issue
reported: "registered cparx — CommitmentBlock empty, HookFirings + RationalizationFires both show 'not installed' even though agentic-apps-workflow is installed at .claude/skills/agentic-apps-workflow/SKILL.md (canonical README layout). investigation revealed (a) no skill currently writes commitment markdown to .planning/skill-observations/*.md, so panel will be permanently empty until meta-observer lands in Phase 5+; (b) parser only matches bundle layout (agenticapps-workflow/skill/SKILL.md), missing canonical single-file layout (agentic-apps-workflow/SKILL.md)."
severity: major

### 3. WR-03 install-hint visual confirmation
expected: Navigate to a project that does NOT have `<root>/.claude/skills/meta-observer/SKILL.md` installed but DOES have `.planning/skill-observations/*.jsonl` files. The HookFirings panel shows the install-hint copy (`claude skill install meta-observer`) and NOT the entry rows. Confirms the API contract deviation flagged in 04-REVIEW.md WR-03 (daemon returns populated entries when `skillInstalled: false`) is invisible at the UI layer because the SPA correctly conditional-renders on `skillInstalled`.
result: blocked
blocked_by: prior-phase
reason: "No project on this machine has `.planning/skill-observations/*.jsonl` — the WR-03 deviation only manifests when the daemon returns populated entries with `skillInstalled: false`, which requires meta-observer (Phase 5+) to first produce JSONL files. The empty-state branch is verified for cparx; the populated-state conditional-render is locked by `HookFirings.test.tsx` unit assertion. Human-visual confirmation deferred to post-Phase-5."

## Summary

total: 3
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "CommitmentBlock surfaces the most recent `## Workflow commitment` from a real project's session output (REQUIREMENTS.md DISC-01)"
  status: failed
  reason: "Parser reads `.planning/skill-observations/*.md` but no skill in the v1 bundle writes commitment markdown there. Workflow skill defines the ritual as a transcript-only artifact; meta-observer (the proposed transcript persister) is Phase 5+ scope. CommitmentBlock therefore renders the empty state for every project today."
  severity: major
  test: 2
  gap_id: G1
  affects:
    - "REQUIREMENTS.md:DISC-01"
    - "ROADMAP.md L120 (commitment surfacing)"
  artifacts:
    - path: "packages/agent/src/lib/phaseDetail.ts"
      issue: "parseCommitmentBlock reads a path no shipping skill writes to"
  options:
    - "(A) Defer DISC-01 from Phase 4 acceptance until Phase 5 meta-observer ships the persister; document as known empty-state until then"
    - "(B) Re-source the parser to read commitment blocks from phase artifacts (PLAN.md/SUMMARY.md/conversation logs) — wider rewrite"
    - "(C) Ship a lightweight commitment recorder in Phase 4.x that captures `## Workflow commitment` blocks from the active session into `.planning/skill-observations/*.md`"
  missing:
    - "Decision on which option (A/B/C) closes DISC-01"
  debug_session: ""

- truth: "Skill install-hint logic correctly detects installed workflow + meta-observer skills regardless of which canonical layout is used (DISC-04 + RationalizationFires gate)"
  status: failed
  reason: "Parser hardcodes the bundle layout `<root>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (D-4-07) and `<root>/.claude/skills/meta-observer/SKILL.md` (D-4-15). The workflow README documents two valid layouts: bundle (no hyphen, with `skill/` subdir) AND canonical single-file (`agentic-apps-workflow/SKILL.md`, hyphenated). Projects on the canonical single-file layout — like cparx — get a false-negative `not installed` hint."
  severity: major
  test: 2
  gap_id: G2
  affects:
    - "REQUIREMENTS.md:DISC-04"
    - "D-4-07 (locked, would need amendment)"
    - "D-4-15 (locked, would need amendment)"
  artifacts:
    - path: "packages/agent/src/lib/phaseDetail.ts"
      issue: "Lines 128-129 (meta-observer) + 177-184 (workflow): hardcoded path misses canonical single-file layout"
    - path: "packages/spa/src/components/panels/RationalizationFires.tsx"
      issue: "Line 75 displays 'agentic-apps-workflow' but install command uses 'agenticapps-workflow' — naming inconsistency confirms the layout assumption"
  missing:
    - "Detection logic that probes BOTH `<root>/.claude/skills/<name>/SKILL.md` AND `<root>/.claude/skills/<name>/skill/SKILL.md`, with `<name>` accepting both `agentic-apps-workflow` and `agenticapps-workflow`"
    - "Same fanout for meta-observer (singular layout exists per same README convention)"
    - "ADR amendment to D-4-07 + D-4-15 documenting the dual-layout probe"
  debug_session: ""
