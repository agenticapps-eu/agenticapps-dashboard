# Phase 11.2: Impeccable P2 Polish Bundle

**Archived from GSD phase `DASH-11.2-impeccable-p2-polish-bundle`. Completed 2026-05-19.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-11.2-impeccable-p2-polish-bundle/` — that tree, not this file, is the authoritative record.

## Why

Close the **5 follow-up items** surfaced in `11.1-IMPECCABLE.md` §"Phase 11.2 candidate" so the `/coverage` IMPECCABLE composite lifts from **~81 → ~85–87** without invoking the calibration-2 structural-debt waiver clause.

The 5 items, ordered by priority:

1. **[P1] Column-header tooltips** — `<th>` elements have no explanatory mechanism for "GitNexus" / "Wiki" / "CLAUDE.md" / "Workflow" vocabulary. (Carried over from Phase 10 P2 #5 → Phase 11 P2 #5 → Phase 11.1 P1 #2. This is calibration-2's "deficit composed of inherited items" — Phase 11.2 closes one tier per the waiver discipline.)
2. **[P1] Per-row in-flight feedback for `gitnexus-analyze`** — `useCoverageRefresh.isPending` exists but the row gives no visible signal during the mutation. New P1 from Phase 11.1.
3. **[P2] Wiki column width** — `w-[22rem]` (352px) over-allocates whitespace against the common case (`<sha> · <relative-time>` rarely exceeds ~150px).
4. **[P2] iPad refresh-icon touch target** — currently ~18×18px button (14px icon + `p-0.5`), well below Apple HIG 44×44pt minimum. Persona red flag for iPad-Donald.
5. **[P3] Controlled search input** — `CoverageToolbar.tsx:122` uses `defaultValue={search}`; URL back-button navigation does not re-seed the input.
6. **[P3] PageHeader subtitle line length** — detector finding from Phase 11.1: `<p>` helper paragraph has no `max-w` constraint, so long subtitles exceed

## Capabilities affected

- `openspec/specs/design-system/spec.md`

## What shipped

**11.2-01**

Three deliverables executed in strict TDD red-green order:

1. **`Tooltip.tsx`** — ~76 LOC hand-rolled React primitive. Opens on mouseenter/focus after 100ms delay (setTimeout ref), closes on mouseleave/blur/Escape instantly. Panel stays mounted when closed (`opacity-0 pointer-events-none`) to avoid remount reflow. ARIA: trigger `aria-describedby={tooltipId}`, panel `role="tooltip" id={tooltipId}`. Z-index `var(--z-overlay)=100`. Zero Radix deps, zero `cn()`/`clsx`/CVA, zero hex literals.

2. **`coverageColumnTooltips.ts`** — 15 LOC SoT file with the 4 D-11.2-05 copy strings for CLAUDE.md, Git

**11.2-02**

Three components modified in strict TDD red-green order:

1. **`CoverageRow.tsx`** — New optional `pending?: boolean` prop (default `false`). When `true`: `<tr>` gains `aria-busy="true"`, the refresh button gains `disabled`, `aria-busy="true"`, `opacity-100` (forced, no group-hover variants), and the `<RefreshCw>` icon gets `animate-spin`. Normal idle state (`opacity-30 group-hover:opacity-100 focus-within:opacity-100 focus:opacity-100`) is fully preserved when `pending=false`. Touch-target padding (`p-0.5`) unchanged — Plan 04 owns that widening.

2. **`CoverageFamilySection.tsx`** — Two new

**11.2-03**

Plan 03 closes P2 #3 from `11.1-IMPECCABLE.md`: the wiki column over-allocated whitespace (352px) against a typical content width of ~150px (`<sha> · <relative-time>`). A single string change in `coverageColumns.ts` (the column-width single source of truth) propagates automatically to both `CoverageFamilySection`'s `<colgroup>` and `CoverageRow`'s `<td>` elements via the IMP-01 SoT contract — no per-call-site changes needed.

### Changes Made

**`packages/spa/src/components/panels/coverage/coverageColumns.ts`**
- Changed `wiki: 'w-[22rem]'` to `wiki: 'w-72'` (352px → 288px)
- Added 3-line comm

**11.2-04**

Plan 04 closes P2 #4 from `11.1-IMPECCABLE.md`: the per-row refresh button had a ~18×18px hit area (padding `p-0.5` = 2px each side + 14px icon), well below Apple HIG's 44px minimum. "iPad-Donald" persona red flag.

Two coordinated changes in the single-writer pattern:

### Task 1 — Actions column width: w-8 → w-12

**`packages/spa/src/components/panels/coverage/coverageColumns.ts`**
- Changed `actions: 'w-8'` to `actions: 'w-12'` (32px → 48px)
- Added 4-line comment chain entry (PD-11.2-02) referencing D-11.2-12, Apple HIG 44px touch target, the button geometry (min-w/h + p-[15px]), and net t

**11.2-05**

**One-liner:** Converted CoverageToolbar search input from `defaultValue={search}` to a hybrid controlled component using `useState(search)` + `useEffect([search])` mirror-state pattern, fixing URL back-button re-seeding while preserving the 200ms debounce encapsulation.

**11.2-06**

Single-token addition to `PageHeader.tsx`: the subtitle `<p>` element at line 58 gains `max-w-prose` so long helper text wraps at Tailwind's 65ch boundary (within the WCAG-recommended 45–75ch optimal reading band). Zero prop API changes; applies retroactively to all 4 routes consuming PageHeader (Coverage, Skill Drift, Pair, Home).

## Gates recorded

- verification — `11.2-VERIFICATION.md`
- code review — `11.2-REVIEW.md`
- security audit — `11.2-SECURITY.md`
- design critique — `11.2-IMPECCABLE.md`
- human UAT — `11.2-HUMAN-UAT.md`
