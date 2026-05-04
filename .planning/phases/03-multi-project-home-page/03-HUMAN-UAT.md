---
status: partial
phase: 03-multi-project-home-page
source: [03-VERIFICATION.md]
started: "2026-05-04T22:05:00Z"
updated: "2026-05-04T22:05:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Card hover-expand visual transition
expected: Hovering a project card smoothly expands to show Stage 1 / DB-AUDIT / TDD / Verification / Branch rows; transition is 120ms max-height+opacity ease-out with no bounce, shimmer, rotate, scale, or glow (D-42/D-43)
result: [pending]

### 2. Touch long-press on iPad via Tailscale
expected: Long-press (500ms) on any project card opens the CardContextMenu portal at the touch position with Rename / Edit tags / Unregister options
result: [pending]

### 3. Cross-platform Cmd+K / Ctrl+K
expected: Cmd+K opens palette on macOS; Ctrl+K opens palette on Windows/Linux; Esc closes; ArrowDown/Up navigate; Enter activates; focus restores to previously active element
result: [pending]

### 4. Register flow end-to-end in browser
expected: Click "+ Register project" → Step 1 path entry → POST `/api/registry/register-prepare` returns nonce → Step 2 shows nonce + detected markers + suggested name + tags → Confirm POSTs to `/api/registry/register-confirm` → new card appears in grid within 5s without page reload (acceptance criterion 4)
result: [pending]

### 5. Palette "Register project" action wires to modal
expected: Open palette with Cmd/Ctrl+K → select "Register project" → palette closes → register modal opens (no longer a silent failure — fix verified in commit 37c5b21 closing IN-04)
result: [pending]

### 6. Per-card freshness display
expected: Header shows "{N} projects · last refresh Ns ago"; timestamp increments correctly and resets after each refetch cycle
result: [pending]

### 7. Empty registry state
expected: With no projects registered, home page shows only the "+ Register project" card with no error or empty-state placeholder beyond the card itself
result: [pending]

### 8. impeccable:critique baseline >= 90
expected: All Phase 3 UI surfaces score >= 90 on the impeccable:critique rubric (CLAUDE.md mandatory acceptance criterion)
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
