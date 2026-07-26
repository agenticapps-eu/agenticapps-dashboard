# DASH-12.1-conformance-chart-legibility

**Archived from GSD phase `DASH-12.1-conformance-chart-legibility`. Completed 2026-06-10.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-12.1-conformance-chart-legibility/` — that tree, not this file, is the authoritative record.

## Why

Fixes the two P1 findings from `12-IMPECCABLE.md`. Single-file SPA change, TDD.

## Capabilities affected

- `openspec/specs/fleet-conformance/spec.md`

## What shipped

**12.1**

- **Persistent legend** (`<ul aria-label="Chart legend">`) above the chart, outside the `role="img"` element: agenticapps/factiv/neuroflash/fleet → colored swatch (exact stroke-color parity). Family identity is now readable without hover.
- **Threshold labels**: the 70 (floor) / 90 (target) dashed rules are labeled in-chart, right-anchored.
- **Cleanup**: removed the dead `isThreshold` branch from the base-gridline loop (70/90 never in `[0,25,50,75,100]`) — closes code-review **IN-06** and keeps the file at 119 LOC (≤120 budget, D-12-08).

## Gates recorded

- design critique — `12.1-IMPECCABLE.md`
