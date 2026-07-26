# DASH-14.1-code-intelligence-impeccable-lift

**Archived from GSD phase `DASH-14.1-code-intelligence-impeccable-lift`. Completed 2026-06-10.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-14.1-code-intelligence-impeccable-lift/` — that tree, not this file, is the authoritative record.

## Why

Lifts the `/code-intelligence` route from composite ~74 (structural-debt waiver) to **81**, clearing the ≥80 floor and retiring the last v1.1 waiver. Req IMPV-01. Single-file SPA change, TDD.

## Capabilities affected

- `openspec/specs/code-intelligence/spec.md`
- `openspec/specs/design-system/spec.md`

## What shipped

**14.1**

- **Error recovery:** friendly copy + Retry button (was raw error.message, no retry).
- **Status cell:** green "current" pill for fresh rows (was blank).
- **Actions cell:** "Install viewer to open" / "Viewer unavailable" when no link (was blank).
- **Last analyzed:** `formatRelativeTime` (was locale day-format that hid order).
- **Headers:** dropped `uppercase tracking-wider` (the generic-SaaS tic).
- **Pill tokens fix:** re-critique caught the pills (incl. the pre-existing stale pill) used non-existent `bg-*-bg` tokens → transparent. Fixed to canonical `bg-status-success/10` / `bg-status-war

## Gates recorded

- design critique — `14.1-IMPECCABLE.md`
