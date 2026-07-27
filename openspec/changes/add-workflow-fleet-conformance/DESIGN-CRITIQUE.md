# `/workflow` pre-implementation design critique

Viewport: 1440 × 900
Reference: `docs/spec/DASHBOARD-V2-SPEC.md` §6
Quality bar: 90 / 100

## Score

| Dimension | Score | Finding |
|---|---:|---|
| Typography | 94 | The existing shell hierarchy and compact table labels suit an operations surface. |
| Color | 92 | Existing semantic tokens are sufficient when every status also carries text or an icon. |
| Spatial composition | 94 | Three vertically ordered cards create a clear scan from version state to artefacts to manual checks. |
| Motion | 90 | Only laggard disclosure needs motion; it must remain usable with reduced motion. |
| Interaction design | 91 | Per-host manual controls are appropriate once busy, refused, bounded, and no-result states are explicit. |
| Responsive behavior | 86 | The reference does not specify how either wide matrix behaves below desktop width. |
| UX writing | 92 | The vocabulary is precise once “offered migration”, “no current result”, and byte identity are stated literally. |

Composite: **91 / 100 — pass with the required refinements below.**

## Required refinements

1. Keep both matrices readable rather than collapsing their meaning. At narrow
   widths, place the table in a labelled horizontal scroll region with a stable
   first column. Stack harness controls into one host card per row.
2. Treat status color as reinforcement only. Render `Current`, `Drifting`,
   `Identical`, `Divergent`, `Missing`, or `Unavailable` in visible text.
3. The accepted OpenSpec delta supersedes the older §6.3 score example. A
   harness result is `Passed` or `Failed` from exit status only; output remains
   diagnostic text and is never parsed into `n/28` or `n/12`.
4. Disable both harness buttons for a host while either harness is running.
   Render busy, refused, timed-out, and bounded-out outcomes as explicit inline
   states without replacing the last completed cached result.
5. Use the exact empty-state copy `No current result` and show result age beside
   completed results. Page load, refresh, and polling must never trigger a run.
6. Keep the page quiet when green: neutral card surfaces, compact status text,
   and no aggregate score, celebratory graphic, or red/green dashboard chrome.
   Findings remain visible in their rows without requiring a filter.

## Anti-pattern scan

- No gradients, glass effects, decorative metric cards, oversized title, or
  ornamental animation.
- No icon-only state, hidden findings, filter prerequisite, modal, drawer, or
  automatically executed harness.
- No absolute filesystem path, username, raw digest, or credential-shaped value
  is rendered.

## Verdict

**Pass.** Implement against the existing Dashboard V2 primitives and the six
refinements above. The post-implementation audit must use a 1440 × 900 render
and confirm both measured findings are visible without interaction.
