---
phase: DASH-12-observability-conformance-surface
artifact: IMPECCABLE
critique_date: 2026-06-10
route: /observability/conformance
viewport: 1440x900
render_state: real-data (3 family cards + SVG 90-day trend; PathDriftPanel auto-hidden, no drift)
composite: 80
nielsen_total: 27
cognitive_load_failures: 2
deterministic_scan: source-clean
floor: 80
floor_decision: D-10.5-03.calibration-2 (ratified 2026-06-08)
verdict: AT-FLOOR (marginal pass; 2 P1 chart-legibility gaps carried to Phase 12.1)
calibration_data_point: 5
---

# 12-IMPECCABLE.md — Phase 12 (Observability Conformance Surface)

Retrospective close-out critique of the shipped `/observability/conformance` route. Two isolated assessments (LLM design review + deterministic detector), synthesized. **Calibration data point #5** for D-10.5-03.

## Composite Verdict

**Composite: 80 / 100 — AT FLOOR (marginal pass).**

- Assessment A (LLM design director): Nielsen **27/40**, cognitive load **2/8** (moderate), holistic estimate **~79**.
- Assessment B (deterministic detector): conformance component **source-clean** (`impeccable detect --json` → `[]`, exit 0); 7 live-URL findings, all triaged to false-positive (2 conformance-adjacent heuristic mis-fires) or out-of-scope global shell (5). Detector sanity-checked against a known-bad probe (fired correctly).

The composite sits exactly on the ratified ≥80 floor (D-10.5-03.calibration-2). It is carried by genuine aesthetic cleanliness and a strong a11y scaffold; it is *held down* by two real chart-legibility gaps that keep the surface's core job — "read the fleet trend at a glance" — behind hover interaction. The phase **does not require the structural-debt waiver** to reach floor, but the two P1s below are the honest reason it is not comfortably above it.

### Calibration series (D-10.5-03)

| Phase | Surface | Nielsen | Composite | Notes |
|-------|---------|---------|-----------|-------|
| 10 | Coverage matrix | 24/40 | 74 | baseline |
| 11 | Coverage trends | 24/40 | 76 | +drift badges |
| 11.1 | Impeccable P1 bundle | 26/40 | ~81 | column-lock, sticky toolbar, Toast |
| 11.2 | Impeccable P2 bundle | 28/40 | ~83–85 | tooltip primitive, touch targets |
| **12** | **Conformance surface** | **27/40** | **80** | **data point #5; clean source, chart-legibility P1s** |

Data point #5 is consistent with the ratified ≥80 floor: a fresh, content-rich surface (new SVG chart + family cards + drift panel) lands at floor on first critique, with legibility polish as the path to the 83–85 band that the Coverage surfaces reached after their P-bundles.

## Anti-Patterns Verdict

**Not AI-generated.** Actively dodges the "observability → dark Datadog/Grafana dense dataviz" category reflex in favor of a calm warm-paper instrument panel. No side-stripe borders, no gradient text, no glassmorphism, no purple-gradient hero, no banned big-number hero-metric template (the 4xl family scores are sized for fleet-scanning, not a marketing flex). The three family cards are a justified small-multiple (one per family), not filler card-grid. Deterministic scan corroborates: zero of 27 slop/quality patterns fire on conformance source.

## Nielsen Heuristic Scores

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Loading skeleton + active nav good; chart has no persistent legend, so line→family mapping is invisible until hover. |
| 2 | Match system ↔ real world | 2 | Tier label is the literal color word "red" inside a red pill ("red red") — conflates signal with meaning. |
| 3 | User control & freedom | 3 | Tooltip dismisses on Esc/blur; no destructive flows reachable (PathDriftPanel hidden — no drift). |
| 4 | Consistency & standards | 3 | Tokens/spacing consistent with Coverage; delta glyph semantics correct. Card vs chart use different visual languages. |
| 5 | Error prevention | 3 | Fix-path has maxLength + disabled-until-valid + in-flight guard (code-level); nothing destructive reachable on this view. |
| 6 | Recognition rather than recall | 2 | No chart legend = pure recall: hover each point to learn which line is which family, re-hover to recompare. |
| 7 | Flexibility & efficiency | 2 | No keyboard scrub across days; tab lands on 19 hit-rects sequentially; no family isolate/toggle; no time-window control. |
| 8 | Aesthetic & minimalist | 4 | Genuinely calm, uncluttered; warm-paper instrument-panel intent fully realized. |
| 9 | Error recovery | 3 | ErrorState copy plain, non-leaky, actionable ("check the dashboard agent is running") + Retry. |
| 10 | Help & documentation | 2 | Helper subtitles good, but the 70/90 threshold lines (the entire point of "conformance") are drawn unlabeled. |
| **Total** | | **27/40** | Movers down from 11.2's 28: chart legibility (H1/H6/H7) and unlabeled thresholds (H10). |

## Cognitive Load — 2 failures (moderate band)

- **FAIL — Recognition/recall:** unlabeled multi-line chart forces hover-decode + inter-point memory to compare families.
- **FAIL — Visual hierarchy within the chart:** agenticapps (blue) and neuroflash (purple) lines collide near the bottom and with the dark fleet line; 4 series are not separable at a glance.
- Passing (6/8): single focus, chunking (3 cards), grouping, one-thing-at-a-time, minimal choices, progressive disclosure (drift panel hides when empty).

## What's Working

1. **Honest-data discipline is real.** neuroflash shows `8` with `—` (no change) + red pill — not a fake "0%" or hidden card. Tier mapping (≥90 / 70–89 / <70) renders correctly across all three families.
2. **Accessible chart scaffolding.** `role="img"` + descriptive aria-label, a full `sr-only` data table mirroring every series, keyboard-focusable per-day hit rects with Esc-to-close. Strong a11y baseline.
3. **Calm, on-brief aesthetic.** Warm-paper, no celebratory motion, reads as an instrument panel; sidebar shell matches the Cloudflare-inspired IA with a clear active state.

## Priority Issues

- **[P1] No chart legend / line key.** *Why:* 4 colored series with zero persistent mapping defeats the chart's purpose — the user can't answer "which family is trending down?" without hovering every point. *Fix:* add a small inline legend row (colored swatch + family name + "fleet") above/beside the plot, reusing existing stroke tokens. *Command:* `$impeccable layout` / direct FleetTrendChart edit.
- **[P1] Threshold lines are unlabeled.** *Why:* the 70 (floor) and 90 (target) dashed rules are *the* conformance reference and read as anonymous gridlines. *Fix:* right-align "90 target" / "70 floor" labels at the dashed lines, or annotate in the tooltip. *Command:* direct FleetTrendChart edit.
- **[P2] "red/amber/green" as the tier label.** *Why:* a color-word as the status label is poor microcopy + color-only meaning. *Fix:* label the pill "Non-conformant / Needs work / Conformant"; keep color as reinforcement. *Command:* `$impeccable clarify`.
- **[P2] Low-conformance lines overlap and lose contrast.** *Why:* agenticapps/neuroflash/fleet bunch at the bottom band, visually indistinguishable. *Fix:* subtle dot markers at data points or faint family fill; ensure each stroke meets 3:1 non-text contrast on warm paper. *Command:* `$impeccable colorize`.
- **[P3] Tertiary text contrast borderline.** *Why:* `rgb(112,107,133)` on `rgb(250,250,247)` ≈ 4:1 — below AA 4.5:1 for 11px "14d trend" / axis / helper copy. *Fix:* darken the tertiary token one step for small text. *Command:* `$impeccable colorize`. (Cross-refs the long-standing `text-text-tertiary` contrast debt.)

## Persona Red Flags

- **Alex (power user):** No keyboard accelerator to scrub the trend or isolate a family; tabbing 19 hit-rects is tedious; no 30/90 time-window toggle; missing legend forces hover-hunting.
- **Sam (a11y):** Good aria-label + sr-only table, but the chart conveys family identity by **color alone** (no legend text, no markers); focus indicator is a jarring full-height blue band; borderline-AA tertiary text at 11px compounds it.
- **Donald on iPad/Tailscale (primary persona):** The trend insight is interaction-gated — a tap shows one day's values; triaging "which family slipped" across the fleet at a glance (the whole point on a tablet) needs repeated taps. Cards answer "today" well; the chart doesn't answer "trend" without interaction.

## Minor Observations / Engineering Notes (not design-scored)

- **Theme-state/label inversion (cross-ref code review):** `<html class="dark">` is set while the page paints warm-paper light (`bg rgb(250,250,247)`), and the theme toggle reads "current: dark; next: light." The rendered aesthetic is the intended light theme, but the theme-state attribute and toggle label are inverted. Worth a small follow-up; not a conformance-surface design defect.
- Console on load: one 404 (favicon/asset) and one a11y warning (a form field missing id/name — the manual path input in PathDriftPanel, not rendered when there's no drift).

## Disposition

Composite **80 = at floor (pass)**. The two P1 chart-legibility items (legend + threshold labels) are the honest gap and are **carried to a Phase 12.1 polish candidate** — they are contained, high-value `FleetTrendChart.tsx` additions that would lift the surface into the 83–85 band the Coverage surfaces reached post-polish. No structural-debt waiver invoked; the floor is met on the as-shipped surface.

---
*Critique method: impeccable:critique, two isolated assessments (A: LLM design review + live browser inspection; B: `impeccable detect` deterministic scan v2.3.2). Live render confirmed real-data (not unpaired). Calibration data point #5 appended to D-10.5-03 series.*
