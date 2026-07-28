# Retained-window measurement

**Captured:** 2026-07-28
**Source:** 46 dated NDJSON snapshots from 2026-05-18 through 2026-07-28
**Method:** Read-only, last-record-wins replay with the production
family-mean rounding rule and no drift exclusions, so the field-set effects are
isolated. No snapshot was rewritten or deleted.

Three variants were evaluated:

1. **Legacy four-field baseline:** `claudeMd`, `gitNexus`, `wiki`, and
   `workflowVersion`; legacy `not-applicable` cells leave the denominator.
2. **Column removal only:** `claudeMd` and `workflowVersion`; legacy
   `not-applicable` cells still leave the denominator.
3. **Current:** the same two retained fields, with retained
   `not-applicable` normalised to `missing`.

## Fleet score distribution

| Variant | Mean | Minimum | Maximum | Top-tier days | Middle-tier days | Bottom-tier days |
|---|---:|---:|---:|---:|---:|---:|
| Legacy four-field baseline | 24.24 | 13 | 38 | 0 | 0 | 46 |
| Column removal only | 36.48 | 23 | 44 | 0 | 0 | 46 |
| Current | 36.48 | 23 | 44 | 0 | 0 | 46 |

Column removal changes 43 of 46 daily fleet points and raises the retained
window's mean by 12.24 points. It does not move a fleet day across a tier
boundary.

Legacy-value normalisation changes 0 of 46 daily fleet points and contributes
0.00 points to the mean in this retained sample.

## Family score and tier distribution

| Variant | Family | Mean | Top | Middle | Bottom |
|---|---|---:|---:|---:|---:|
| Legacy baseline | agenticapps | 22.63 | 0 | 0 | 46 |
| Legacy baseline | factiv | 42.04 | 0 | 0 | 46 |
| Legacy baseline | neuroflash | 8.13 | 0 | 0 | 46 |
| Current | agenticapps | 33.37 | 0 | 0 | 46 |
| Current | factiv | 60.78 | 0 | 11 | 35 |
| Current | neuroflash | 15.35 | 0 | 0 | 46 |

The only tier redistribution is in `factiv`: 11 days move from bottom to
middle because the retired columns no longer contribute. The
normalisation-only variant is identical to the current variant for every
family and day.

## Drift-indicator effect

The active 14-day drift window contains snapshots for 2026-07-26 and
2026-07-28. Across their retained `claudeMd` and `workflowVersion` cells there
are no `not-applicable` values. Normalisation therefore changes zero
drift indicators in the current window.

This zero is sample-specific, not a relaxation of the compatibility rule: if a
retained cell carries `not-applicable`, readers map it to `missing` before
transition direction is computed.
