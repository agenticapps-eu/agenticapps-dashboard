---
status: partial
phase: 11-coverage-trends-skill-drift
source: [11-VERIFICATION.md]
started: 2026-05-16T15:14:06Z
updated: 2026-05-16T15:14:06Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Coverage drift badges — visual smoke
expected: On `/coverage`, when a registered repo has had a state transition in the last 14 days for any of its 4 cells, the corresponding `CoverageCell` shows an inline `▲Nd` (improvement, newer state better) or `▼Nd` (regression) badge. Badge uses the design-token typography (calm, no new SVG), stays presentational, and is absent when no transition occurred. Touch-friendly (not hover-only).
result: [pending]

### 2. Skill drift page — visual smoke + scope toggle
expected: `/observability/skill-drift` renders a per-skill matrix (rows = skills, columns = projects). `SkillDriftToolbar` single-select chip (family / cross-family) toggles correctly; URL updates with 200ms debounce; on reload the URL drives the active scope. Sidebar entry "Skill drift" appears as the **2nd** entry under the Observability section (after "Coverage") with the Layers icon — never as a peer top-level item.
result: [pending]

### 3. Sticky PageHeader scroll behavior
expected: On `/coverage` the PageHeader stays sticky during long-list scroll (`sticky top-0 z-10 bg-app-bg`). On all non-opted-in routes (`/help`, `/settings`, `/skills`, `/`, `/projects/:id`, `/pair`, `/onboarding`) the PageHeader scrolls away normally — no regression. Verify in both directions.
result: [pending]

### 4. Row-refresh button opacity discoverability
expected: On `/coverage`, the per-row refresh button is visible at `opacity-30` in idle state (touchpad/keyboard users can discover it without hover). On hover/focus it bumps to `opacity-100`. Test with: trackpad hover, keyboard Tab traversal, mobile-touch simulation.
result: [pending]

### 5. AgentLinter spawn from skill drift matrix
expected: On `/observability/skill-drift`, the per-cell "Run AgentLinter" play button on a project column triggers the new POST `/api/skills/drift/agentlinter` route. Real spawn through real binary, 30s timeout enforced, results refresh the matrix cell. Re-clicking during in-flight should NOT spawn a second invocation (gap noted in WR-04 — this is the human verification that gap exists; expectation here is "single project per request" works correctly per D-11-14).
result: [pending]

### 6. Daily snapshot scheduler — overnight tick or simulated time-skip
expected: With daemon running, a new NDJSON file appears under `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` once per ISO date (mode 0o600). The in-process scheduler (PD-11-01) ticks daily without launchd/systemd cron. Simulated path: stop daemon, manually advance system clock or wait for next UTC midnight, restart, verify a new dated file appears.
result: [pending]

### 7. Symlink-escape boot refusal
expected: Setup: `rm -rf ~/.agenticapps/dashboard/coverage-history && ln -s /tmp ~/.agenticapps/dashboard/coverage-history`. Restart daemon. The daemon MUST refuse to start with an error message like `coverage-history dir escapes daemon home: <realpath>`. Restoring to a real directory restarts cleanly.
result: [pending]

### 8. IMPECCABLE skill-driven gate (D-10.5-03 calibration data point #2)
expected: Run `/impeccable critique` against `/coverage` and `/observability/skill-drift` at 1440×900. Produces `.planning/phases/DASH-11-coverage-trends-skill-drift/11-IMPECCABLE.md` with composite ≥ 87 (D-6-09.v1 floor, provisional per D-10.5-03). Captures per-heuristic scores + persona red flags + findings. This is the gate that replaced Phase 6's deleted CI workflow.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
