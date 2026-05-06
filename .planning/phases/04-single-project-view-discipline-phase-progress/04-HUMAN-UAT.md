---
status: partial
phase: 04-single-project-view-discipline-phase-progress
source: [04-VERIFICATION.md]
started: "2026-05-06T12:00:00Z"
updated: "2026-05-06T12:00:00Z"
---

## Current Test

[awaiting human testing — verifier passed 5/5 must-haves; 3 items below need a real daemon + browser]

## Tests

### 1. Live navigation to project detail
expected: Start daemon (`agentic-dashboard start`) and dev server (`pnpm --filter @agenticapps/dashboard-spa dev`). On `/`, click any project card. Browser routes to `/projects/{id}` and renders the ProjectHeader breadcrumb plus the two-column grid (Discipline left, Phase Progress center) with all 8 panel headings visible — no phantom placeholder text, no `data-slot` stubs.
result: [pending]

### 2. CommitmentBlock live data
expected: Register a project that has at least one `.planning/skill-observations/*.md` file containing a `## Workflow commitment` heading. Navigate to its detail page. The CommitmentBlock panel shows the most recent commitment markdown verbatim in a `<pre>` block, with a "Source: filename" line below.
result: [pending]

### 3. WR-03 install-hint visual confirmation
expected: Navigate to a project that does NOT have `~/.claude/skills/meta-observer/SKILL.md` installed but DOES have `.planning/skill-observations/*.jsonl` files. The HookFirings panel shows the install-hint copy (`claude skill install meta-observer`) and NOT the entry rows. Confirms the API contract deviation flagged in 04-REVIEW.md WR-03 (daemon returns populated entries when `skillInstalled: false`) is invisible at the UI layer because the SPA correctly conditional-renders on `skillInstalled`.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
