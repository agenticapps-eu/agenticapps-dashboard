---
status: partial
phase: 03-multi-project-home-page
source: [03-VERIFICATION.md]
started: "2026-05-04T22:05:00Z"
updated: "2026-05-05T14:11:00Z"
---

## Current Test

[6 of 8 walked via /qa on 2026-05-05; 2 deferred — see Gaps]

## Tests

### 1. Card hover-expand visual transition
expected: Hovering a project card smoothly expands to show Stage 1 / DB-AUDIT / TDD / Verification / Branch rows; transition is 120ms max-height+opacity ease-out with no bounce, shimmer, rotate, scale, or glow (D-42/D-43)
result: pass — computed `transition: max-height, opacity 0.12s` (= 120ms), classes `motion-safe:duration-120 ease-out group-hover:max-h-[200px] group-hover:opacity-100`. All 4 rows present in the expand region (Stage 1 dots / TDD pairs 6/9 / Verification 0/0 / Branch). No bounce/shimmer/rotate/scale/glow classes. Evidence: .gstack/qa-reports/screenshots/uat-01-card-focused-expanded.png.

### 2. Touch long-press on iPad via Tailscale
expected: Long-press (500ms) on any project card opens the CardContextMenu portal at the touch position with Rename / Edit tags / Unregister options
result: deferred — needs physical iPad over Tailscale; cannot exercise from headless desktop browse session.

### 3. Cross-platform Cmd+K / Ctrl+K
expected: Cmd+K opens palette on macOS; Ctrl+K opens palette on Windows/Linux; Esc closes; ArrowDown/Up navigate; Enter activates; focus restores to previously active element
result: partial — macOS Cmd+K confirmed: opens palette, Esc closes, ArrowDown 2× selects "Refresh data", ArrowUp 2× returns to "Register project", Enter activates. Windows/Linux Ctrl+K untested (no hardware). Code path uses `metaKey || ctrlKey` per phase docs; cross-OS verification still owed before ship.

### 4. Register flow end-to-end in browser
expected: Click "+ Register project" → Step 1 path entry → POST `/api/registry/register-prepare` returns nonce → Step 2 shows nonce + detected markers + suggested name + tags → Confirm POSTs to `/api/registry/register-confirm` → new card appears in grid within 5s without page reload (acceptance criterion 4)
result: pass (with advisory) — registered `/Users/donald/Sourcecode/admin-ui` end-to-end. Step 1 → Preview path → Step 2 confirm panel → Confirm registration → new "admin-ui" card appeared in <5s with no page reload, header advanced 1→2 projects. Advisory: Step 2 panel does NOT surface the nonce or a "detected markers" list; only Resolved path / Name (auto) / Client (optional) / Tags. Likely reasonable product call (nonce is internal protocol, markers are server-side validation), but UAT line literally calls for them — needs product decision: surface them or update the UAT line. Evidence: uat-04-{home-before, step1-modal, step2-confirm, after-confirm}.png.

### 5. Palette "Register project" action wires to modal
expected: Open palette with Cmd/Ctrl+K → select "Register project" → palette closes → register modal opens (no longer a silent failure — fix verified in commit 37c5b21 closing IN-04)
result: pass — Cmd+K opened palette with "Register project" pre-selected, Enter dismissed palette and opened the register modal. Wiring from commit 37c5b21 verified live. Evidence: uat-05-palette-to-register.png.

### 6. Per-card freshness display
expected: Header shows "{N} projects · last refresh Ns ago"; timestamp increments correctly and resets after each refetch cycle
result: pass (with fix) — sampled t+1s..t+10s. Counter increments 1s→2s→3s→4s→5s, then resets to 1s on the next refetch tick (~5s cadence). Format matches. Bug found during walk: header rendered "1 projects" (wrong English) for N=1; fixed in commit 47a6d57 with two regression tests in Header.test.tsx covering singular-1 and plural-0.

### 7. Empty registry state
expected: With no projects registered, home page shows only the "+ Register project" card with no error or empty-state placeholder beyond the card itself
result: partial — functional pass (no error, the Register card is visible and works), but the home page shows additional empty-state copy: "No projects registered yet." heading + "Run `agentic-dashboard register <path>` to add one, or use the button above." help text. This is genuinely useful onboarding for first-run users but exceeds the literal UAT spec ("no … empty-state placeholder beyond the card itself"). Needs product decision: keep the help text and update UAT-7, or strip it. Evidence: uat-07-empty-state.png.

### 8. impeccable:critique baseline >= 90
expected: All Phase 3 UI surfaces score >= 90 on the impeccable:critique rubric (CLAUDE.md mandatory acceptance criterion)
result: partial — composite 83/100. Six-pillar breakdown: Color 76, Typography 78, Layout 84, Motion 88, AI-slop 84, Hierarchy 86. Three sub-90 pillars all trace to design-token product decisions deferred to Phase 6 (the spec actually places this gate at Phase 6, not Phase 3). Full breakdown + remediation plan in `03-IMPECCABLE.md`.

## Summary

total: 8
passed: 4
partial: 4
deferred: 1
issues: 1 (fixed)
pending: 0
skipped: 0
blocked: 0

(Items 3, 4, 7 are partial: pass on the path tested, hardware/product call needed to fully close.)

## Gaps

- **UAT-2** — needs physical iPad over Tailscale. Defer to post-ship hardware verification or Phase 6 polish run.
- **UAT-3 cross-OS** — Windows or Linux Ctrl+K live verification still owed.
- **UAT-4 / UAT-7** advisories — three product-call items (modal centering, empty-state copy, Step-2 surface contents). All non-blocking; flag in PR description.
- **UAT-8** — `impeccable:critique` scored 83/100; three sub-90 pillars are token-level Phase 6 work per the spec phasing. See `03-IMPECCABLE.md` for the per-pillar breakdown and concrete remediation plan.

Full /qa report: `.gstack/qa-reports/qa-report-phase-03-2026-05-05.md`.
