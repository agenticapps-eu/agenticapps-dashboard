# Phase 11.1: Impeccable P1 polish bundle

**Archived from GSD phase `DASH-11.1-impeccable-p1-polish-bundle`. Completed 2026-05-18.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-11.1-impeccable-p1-polish-bundle/` — that tree, not this file, is the authoritative record.

## Why

Bundle the **four Phase-10-inherited P1s** surfaced by 11-IMPECCABLE.md into a single polish phase. Targeted lift: **Composite 76 → ~82**, Nielsen 24/40 → ~30/40. This produces **calibration data point #3** which, combined with Phase 10 (74) and Phase 11 (76), settles the D-10.5-03 floor recalibration question (provisional ≥87 floor confirmed empirically unreachable under the skill-driven gate).

**In scope (4 P1s):**

1. **Column-width lock across `CoverageFamilySection`** — each section currently renders an independently auto-widthed `<table>`; cross-family eye-tracing of a single column is broken (Repo column: 272/239/280px; GitNexus column: 92/131/100px). Fix: shared `<colgroup>` with fixed widths via `table-fixed` so all three family tables share identical column tracks.
2. **Sticky `CoverageToolbar`** — once Donald scrolls into `neuroflash`'s 33 rows the filter chips + search input scroll off; he can't see the active filter or refine search without scrolling back. Fix: fold the toolbar into the existing sticky `PageHeader` block via its `children` slot so the toolbar inherits the same sticky surface.
3. **Toast primitive wired for clipboard-write feedback** — six clipboard call sites (the "Index with GitNexus" purple CTA, family-header `Copy npm install` link, per-row `/wiki-compile` + `workflow update` popover entries, `CoverageEmptyState` install button, `InstallGitNexu

## Capabilities affected

- `openspec/specs/design-system/spec.md`

## What shipped

**11.1-01**

**Pure-JS WCAG 2.1 contrast calculator, token-pair invariant lock, and `--color-text-tertiary` swap to `#706B85` clearing WCAG AA body-text floor on both warm-paper backgrounds.**

**11.1-02**

**`COVERAGE_COL_WIDTHS` frozen constants module + `<colgroup>` in every `CoverageFamilySection` + `table-fixed` + per-`<td>` width stamps in `CoverageRow` — identical column tracks across all 3 family sections.**

**11.1-03**

**Hand-rolled Toast primitive: React Context provider, createPortal to document.body, single-slot replace, opacity-only animation, success/error ARIA variants. Zero call sites in this plan -- Plan 06 owns the wiring.**

**11.1-04**

**ResizeObserver hook measures sticky PageHeader height and publishes it as --ph-h CSS custom property on documentElement; 56px first-paint default in tokens.css; global RO mock in vitest.setup.ts enables mounted-component TDD harness.**

**11.1-05**

**CoverageToolbar moved into PageHeader children slot (sticky inheritance) and CoverageFamilySection sticky offsets switched from hardcoded px values to calc(var(--ph-h)) expressions consuming the ResizeObserver-published CSS variable.**

**11.1-06**

- `AppShellV2.tsx` wraps its outermost return in `<ToastProvider>` — every authenticated route now inherits the toast context without any call site needing its own provider.
- Six clipboard call sites wired with `async onClick` pattern: await `writeToClipboard()`, then call `toast.show()` with a contextual success message or a generic error message.
- Per-site wording (PD-11.1-02 applied):
  - `IndexGitNexusButton`: "Copied — paste in terminal to index your repos with GitNexus"
  - `InstallGitNexusButton`: "Copied — paste in terminal to install GitNexus"
  - `CoverageEmptyState` (no-gitnexus):

## Gates recorded

- verification — `11.1-VERIFICATION.md`
- code review — `11.1-REVIEW.md`
- design critique — `11.1-IMPECCABLE.md`
- human UAT — `11.1-HUMAN-UAT.md`
