---
phase: 03-multi-project-home-page
date: 2026-05-05
mode: critique
gate: ">=90 (per CLAUDE.md and docs/spec/dashboard-prompt.md §Visual style)"
gate_phase: 6
score: 83
verdict: BELOW_GATE_BUT_PHASE_6_BLOCKER_NOT_PHASE_3
register: product
---

# Phase 3 — `impeccable:critique`

The dashboard's own UI scored against the impeccable rubric. The ≥90 gate is a Phase-6-acceptance-criterion per the spec ("Phase 6 — polish, install-launchd, **impeccable critique gate**, CF Access"), not a per-phase PR blocker. Phase 3 lands at 83/100 with three sub-90 pillars all rooted in design-token decisions that are deliberately deferred to Phase 6 polish.

## Surfaces audited (live at `localhost:5174`)

1. **Multi-project home (dark theme, default)** — `screenshots/impeccable/01-home-dark.png`
2. **Register modal** — `screenshots/impeccable/02-register-modal.png`
3. **Cmd+K command palette** — `screenshots/impeccable/03-palette.png`
4. **Multi-project home (light theme)** — `screenshots/impeccable/04-home-light.png`

## Per-pillar score

| Pillar | Score | Verdict | Drivers |
|---|---|---|---|
| Color | 76 | sub-90 | `--bg #0a0a0a` and `--text #fafafa` are pure neutrals (impeccable rule "Never use #000 or #fff. Tint every neutral toward the brand hue"). Tokens are HEX, not OKLCH. `--accent #3b82f6` is Tailwind blue-500 — the canonical "AI-dashboard" reflex color. `--color-brand: oklch(0.65 0.18 260)` is defined in `@theme` but `--accent` doesn't consume it. |
| Typography | 78 | sub-90 | `--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif`. Spec says "**NOT Inter.** Pick something distinctive. Suggestion: iA Writer Mono for headers, Söhne or Inter Display for body." Implementation falls back through Inter. Type scale (label/body/heading/display) and step ratios meet the rubric (≥1.25). |
| Layout | 84 | pass | Sticky h-14 header. Centered grid with `min-card-width: 288px`. Toolbar rhythm (chips → search → sort) is consistent. Light slop pull: at N=many projects the grid becomes "identical card grids" (an absolute ban). Hover-expand defuses this for now. Empty horizontal whitespace is wide on 1280px viewports. |
| Motion | 88 | pass | D-42/D-43 enforced — 120ms `motion-safe:transition-[max-height,opacity] ease-out` on the card expand; `transition-colors duration-100 ease-out` on hover bg/border. Zero bounce/shimmer/rotate/scale/glow. Modal entrance has no transition — could be a 100ms ease-out from translateY 4px for polish. |
| AI-slop indicators | 84 | pass | First-order reflex (dashboard → dark blue) is structurally present in the tokens but rarely renders — accent is used only for focus rings (Tab key reveals it). Rendered experience is monochrome, which dodges the worst of the reflex. The dashed-border Register card is a non-card affordance, smart pick. No emoji, no decorative gradient, no glassmorphism, no hero-metric template, no modal-as-first-thought. The slop pull is in the unused tokens, not the visible UI. |
| Hierarchy | 86 | pass | Header reads as "where am I / count / freshness" in one line. Card hierarchy is title → status → last-commit, three clear tiers. "Phase 03 · In Progress" and "last commit 7m ago" are visually equal but informationally different — small differentiation (weight, status pill) would help. Theme + Settings icons share visual weight without distinction. |

**Composite: 83 / 100** (equal weight, six pillars).

## What it would take to reach ≥90 (Phase 6 work)

### Lift Color from 76 → 90+ (~30 min)

In `packages/spa/src/styles/global.css`:

1. Move all neutrals to OKLCH with a small chroma tilt toward the brand hue. Keeps the visual feel; satisfies the no-#000/#fff rule.

   ```css
   .dark {
     --bg:               oklch(0.16 0.005 260);  /* was #0a0a0a */
     --surface:          oklch(0.22 0.005 260);  /* was #171717 */
     --surface-elevated: oklch(0.28 0.005 260);  /* was #262626 */
     --text:             oklch(0.97 0.005 260);  /* was #fafafa */
     --text-muted:       oklch(0.70 0.005 260);  /* was #a3a3a3 */
     /* …same pattern for borders */
   }
   ```

2. Pick a **non-blue** AgenticApps brand accent. The spec already says the accent is "configurable via `~/.agenticapps/dashboard/theme.json`". Until that's wired, choose something distinctive in code. Candidates that dodge the dashboard-blue reflex while staying restrained:
   - Copper — `oklch(0.65 0.13 50)` (warm, cohesive on dark, not yet saturated in tooling)
   - Chartreuse-ish lime — `oklch(0.78 0.15 110)` (energetic, terminal-ish)
   - Magenta-pink — `oklch(0.65 0.20 350)` (Linear-adjacent but on a different axis from blue)

3. Update `--accent`, `--accent-hover`, `--ring` for both themes to consume the new brand. Keep `--accent-fg` near-white on dark accents, near-black on light accents — calculate per-accent.

### Lift Typography from 78 → 90+ (~15 min)

Pick a distinctive family per the spec's own suggestion. Cheapest credible move: load **iA Writer Mono S** for the brand link / headings (free, distinctive, terminal-but-not-Mono-Lisa) and either keep system-sans for body **or** load **Söhne** (paid, very distinctive). For free-only:

- Headings: iA Writer Mono S (free)
- Body: keep system stack but **drop Inter** from the fallback chain — rely on the OS-native sans (SF Pro / Segoe UI) so the font is intentionally OS-native rather than Inter-by-default.

```css
@theme {
  --font-display: "iA Writer Mono S", ui-monospace, monospace;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

### Lift AI-slop from 84 → 90+ (rolls up from Color + Typography)

Color and typography fixes above resolve the structural slop. The visible-UI score is already past the gate; cleaning the unrendered tokens lifts the holistic verdict.

## What was NOT changed in Phase 3

- **No token rewrite.** The user has authored a UI-SPEC referenced in `global.css` comments but the file isn't checked in. Choosing the accent color and font family are product decisions belonging to the spec author, not the /qa loop. Documented as Phase 6 work.
- **No Modal centering change.** /qa flagged the modal positions top-left rather than centered. Same product-decision class — could be a deliberate "anchored to the trigger" choice or an oversight; not unilaterally moved.
- **No empty-state copy strip.** UAT-7 advisory is also product-call.

## Phase 3 PR posture

Phase 3 ships the multi-project home with **clean motion discipline (88), strong layout (84), and visible-UI slop already past the bar (84)**. The structural slop sits in unrendered tokens (the focus-ring blue) and a font fallback chain. None of those are Phase 3 deliverables — they're Phase 6 polish work explicitly scoped in the spec.

## Disclaimer

`impeccable:critique` is a holistic AI-aided design review. Scores are calibrated by inspection against the impeccable rubric, not produced by a numeric algorithm. The 6-pillar weighting is informational; the gate is the user's product call.
