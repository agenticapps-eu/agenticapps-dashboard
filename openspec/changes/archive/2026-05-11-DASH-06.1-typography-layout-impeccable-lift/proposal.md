# Phase 06.1: typography-layout-impeccable-lift -

**Archived from GSD phase `DASH-06.1-typography-layout-impeccable-lift`. Completed 2026-05-11.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-06.1-typography-layout-impeccable-lift/` — that tree, not this file, is the authoritative record.

## Why

Lift Typography (82 → ≥ 90) and Layout (88 → ≥ 90) sub-scores on `/`, and bring all 6 v1.0 user-touched routes' composite scores to ≥ 90 at the desktop (lg, 1440x900) breakpoint per D-6-21 — closing the impeccable gate gap measured by Phase 6 Plan 06-06's post-polish baseline (range 83–87 across all 6 routes).

This is **UX architecture work**, not visual polish. Phase 6 Plan 06-06 already closed all 8 deterministic detector violations and lifted Color from 85 → 90 (gate met for Color). The remaining gap requires structural changes to information architecture (progressive disclosure), typography hierarchy (line-length), accessibility semantics (ARIA), and empty-state treatment (/pair).

**Out of scope (explicit non-goals):**
- Mobile/tablet responsive support (deferred per D-6-21)
- New color palette work (Color is closed)
- Token system additions (no new colors, radii, or fonts per D-5.1-*)
- Animations, transitions, skeletons, gradient text, glassmorphism (anti-AI-slop per D-43, D-5.1-10)
- Re-architecting the AppShellV2 sidebar (that's Phase 5.1's contract)
- Changing existing OnboardingHero on `/` (Phase 5.1 approved it)

**Definition of done:**
- `node scripts/check-impeccable-score.mjs /tmp/imp-*.json` exits 0 against fresh captures of all 6 routes at 1440x900
- Composite ≥ 90 on /, /projects/:id, /settings, /help, /onboarding, /pair
- Typography sub-score ≥ 90 on / @ 144

## Capabilities affected

- `openspec/specs/design-system/spec.md`

## What shipped

**06.1-01**

**One-liner:** Applied `max-w-[75ch]` Tailwind 4 cap to all multi-sentence prose paragraphs on /onboarding and /help routes via strict TDD red-green, excluding headings, code blocks, and kbd cells per D-6.1-01.

**06.1-02**

`<MaskedToken value={string} label?={string} />` — a self-contained React primitive in `packages/spa/src/components/ui/` that closes D-6.1-03.

**Exports:**
- `MaskedToken` — the component function (`React.JSX.Element`)
- `MaskedTokenProps` — the Props interface (`value: string`, `label?: string`)

**State machine:** `masked=true` (default) → click Reveal → `masked=false` + 5s `setTimeout` → auto-re-mask → `masked=true`. Manual "Hide" click cancels the timer immediately.

**Security invariants:**
- Token value never appears in DOM text until `masked === false`
- Copy uses `navigator.clipboard.

**06.1-03**

PanelContainer extended with optional `defaultCollapsed` prop; 5 right-column panels wire isEmpty logic and collapse in empty/configure-to-enable states; multi-sentence empty-state prose capped at max-w-[75ch].

**06.1-04**

### Task 1: ARIA on Sidebar

**SidebarItem** — The active `<Link>` now carries `aria-current="page"` when `isActive` is true; when inactive the attribute is omitted entirely (not set to "false" — semantic difference per WCAG SC 4.1.2). Applied via `aria-current={isActive ? 'page' : undefined}`.

**SidebarItemDisabled** — All 3 disabled OBSERVE buttons (Skills, Health, Reviews) now carry `aria-label={\`${label} section, available in Phase 6\`}` alongside the existing `title="Available in Phase 6"`. Screen readers announce purpose rather than just "button".

**SidebarSubItem** — Same `aria-curre

**06.1-06**

## What was done

Re-measured the impeccable composite + sub-scores against the live SPA + agent on the developer's
local stack after Plans 01-05 shipped. Ran Assessment B (deterministic detector) once and Assessment A
(LLM heuristic scoring via Playwright MCP browser inspection) across all 6 v1.0 user-touched routes
at 1440x900 (per D-6-21).

**06.1-07**

## Objective

Close the remaining 1-5 point gap to ≥ 90 composite across all 6 v1.0 routes
at 1440x900 per D-6-09 + D-6-21. Six surgical edits, one per route.

## Gates recorded

- _(no gate artifacts recorded)_
