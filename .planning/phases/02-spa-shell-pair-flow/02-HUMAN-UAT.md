---
status: partial
phase: 02-spa-shell-pair-flow
source: [02-VERIFICATION.md]
started: 2026-05-04T09:20:00Z
updated: 2026-05-04T09:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SPA-01 live smoke — dev server + unpaired redirect
expected: Boot the dev server with `pnpm --filter @agenticapps/dashboard-spa dev` and visit http://localhost:5174/ in a browser without any localStorage pairing. Browser redirects to /onboarding and the OnboardingHero headline "One local daemon. Every device." is visible.
result: [pending]

### 2. SPA-02 pair URL completes without manual input
expected: Run `agentic-dashboard pair` from a registered project, click the printed URL in the browser. Browser visits /pair?agent=...&token=..., briefly shows "Connecting to agent…", then navigates to / and shows the "Home" heading with the paired agentUrl visible.
result: [pending]

### 3. SPA-04 manual pair via /settings
expected: In a paired browser session, visit /settings and paste a valid agent URL + token, then click "Save & connect". Button shows "Connecting…" while calling /health, then "Connected." + "Redirecting…" and auto-navigates to / after 800ms.
result: [pending]

### 4. Theme persistence (D-02 + D-03)
expected: Click the theme toggle (sun/moon chip in header) and verify dark → light → system → dark cycle. Reload the page and confirm the localStorage key `agentic-dashboard:theme` persists the chosen theme across reload. First paint must be dark with no flash of light theme (D-02).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
