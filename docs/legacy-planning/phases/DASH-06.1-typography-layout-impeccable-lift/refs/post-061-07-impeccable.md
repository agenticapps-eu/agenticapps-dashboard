# Phase 06.1 — Post-Closure-Polish Re-measurement (captured 2026-05-10)

## Composite scores per route at 1440x900

| Route | Pre-06.1 (06-06) | Post-06.1 (06.1-06) | Post-06.1-07 (this) | Δ vs 06-06 | Pass (≥ 90)? |
|-------|------------------|---------------------|---------------------|------------|--------------|
| / | 86 | 88 | 89 | +3 | no |
| /projects/:id | 81 | 85 | 87 | +6 | no |
| /settings | 86 | 89 | 90 | +4 | yes |
| /help | 86 | 87 | 90 | +4 | yes |
| /onboarding | 87 | 89 | 90 | +3 | yes |
| /pair | 83 | 87 | 88 | +5 | no |

## Gate result

`node scripts/check-impeccable-score.mjs .playwright-mcp/scores/imp-all-061-07.json` exited **1**.

**REMAINING DELTA** — 3 of 6 routes cleared the ≥ 90 gate; 3 remain below.

## Per-route notes

### `/` — 88 → 89 (+1)
- Edit applied: `max-w-[60ch]` on `MultiProjectHome` empty-state prose and ProjectCard no-.planning span.
- Impact: Marginal Typography lift (+1) because the grid was populated (3 projects); empty-state path not exercised in this session's scoring.
- Remaining blockers: Typography 86 (card subtitles/meta unbounded), Spacing 88, Accessibility 88.
- Gap to gate: 1 point.

### `/projects/agenticapps-dashboard` — 85 → 87 (+2)
- Edit applied: Sentry/Linear/Infisical not-detected paragraphs trimmed from 2-3 dense sentences to 1 sentence + code snippet each.
- Impact: Typography 82→85, Hierarchy 88→90. Integration rows now scan in one glance.
- Remaining blockers: Commitment block monospace wrapping still creates visual density (Color 85, Spacing 84, Accessibility 84).
- Gap to gate: 3 points.

### `/settings` — 89 → 90 (+1) ✓ GATE CLEARED
- Edit applied: `ThemeToggle` wrapped in `rounded-card border border-border-subtle bg-card-bg p-6` section matching `ManualPairForm` container.
- Impact: Layout 88→91 (peer sections visually consistent), Hierarchy 86→88.
- Composite 89→90 — gate cleared.

### `/help` — 87 → 90 (+3) ✓ GATE CLEARED
- Edit applied: Added "Common tasks" section below Keyboard shortcuts with 4 short items using KbdHint references.
- Impact: Layout 88→92 (3 sections fill 900px viewport), Hierarchy 86→90.
- Composite 87→90 — gate cleared.

### `/onboarding` — 89 → 90 (+1) ✓ GATE CLEARED
- Edit applied: Step-number circles changed from `bg-card-bg-hover text-text-primary` to `bg-accent/10 text-accent` on all 3 steps.
- Impact: Color 87→90 (numbered ladder now reads as colored accent sequence).
- Composite 89→90 — gate cleared.

### `/pair` — 87 → 88 (+1)
- Edit applied: `mx-auto max-w-[60ch]` added to pairing-state `<ol>`.
- Impact: Layout 86→88 (centered, reading-width-constrained in pairing state).
- Remaining blockers: Color 85, Spacing 86 in the failed/error state (inherent to single-card error page with large empty area).
- Gap to gate: 2 points.

## Summary of gate status

| Route | Status | Gap |
|-------|--------|-----|
| /settings | ✓ PASS (90) | 0 |
| /help | ✓ PASS (90) | 0 |
| /onboarding | ✓ PASS (90) | 0 |
| / | ✗ BELOW (89) | −1 |
| /pair | ✗ BELOW (88) | −2 |
| /projects/:id | ✗ BELOW (87) | −3 |

Overall gate: **FAIL** (exit code 1). 3/6 routes pass; 3/6 remain below threshold.

All 6 routes improved vs the 06-06 baseline (total range: +3 to +6 points).
Plans 01-07 together lifted the composite range from 81-87 (06-06) to 87-90 (post-06.1-07).
