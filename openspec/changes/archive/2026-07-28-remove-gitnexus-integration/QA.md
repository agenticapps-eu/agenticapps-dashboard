# QA report — remove-gitnexus-integration

**Tester:** codex-qa v0.1.0
**Mode:** phase-qa
**Dev servers:** `http://localhost:5174` and `http://127.0.0.1:5193`
**Browser:** Google Chrome, Playwright automation

## Flows tested

### Live version-2 coverage

- Opened `/coverage` against the rebuilt local daemon.
- Confirmed the live response reports `schemaVersion: 2`.
- Confirmed live row keys are limited to `family`, `repo`, `claudeMd`,
  `workflowVersion`, `understand`, overrides, and registry/degraded metadata.
- Confirmed the health response has no retired integration extension.
- Result: **pass**.

### Desktop matrix

- Confirmed each family table exposes `Repo`, `CLAUDE.md`, `Workflow`, and
  `Understand` headers.
- Confirmed exact GitNexus and Wiki labels and related actions have count zero.
- Confirmed the remaining state cells and Understand command affordance render.
- Evidence:
  [coverage-desktop.png](evidence/coverage-desktop.png)
- Result: **pass**.

### Smallest breakpoint

- Rendered at 390×844 and confirmed the card layout contains `CLAUDE.md`,
  `Workflow`, and `Understand`.
- Confirmed exact GitNexus and Wiki labels have count zero.
- Measured all 71 visible controls in the coverage main region after
  remediation; none is shorter than 44px.
- Evidence:
  [coverage-mobile.png](evidence/coverage-mobile.png)
- Result: **pass**.

### Compatibility and recovery behavior

- Opened `/coverage?status=not-applicable`; the retired filter value degraded to
  the all-selected view.
- Confirmed an existing Understand viewer link remains present and returns 200.
- Result: **pass**.

### Removed routes

- `POST /api/coverage/refresh` → 404.
- `POST /api/gitnexus/scan` → 404.
- `GET /api/gitnexus/scan/old-job` → 404.
- Result: **pass**.

## Console errors and warnings

No application console error, failed API request, or HTTP response at or above
400 was reproduced in the final pass. Chrome emitted its normal development
tooling messages only.

## Verdict

**Pass.** Ready for human UAT.

## Post-review live smoke

After the final production build and daemon restart:

- `http://localhost:5174/coverage` returned 200.
- Authenticated `/api/coverage` returned schema version 2 with row keys
  `family`, `repo`, `claudeMd`, `workflowVersion`, `overrideCount`,
  `overrides`, `inRegistry`, and `understand`.
- The serialized live response contained neither `gitNexus` nor `wiki`.

## Human UAT

- Accepted by the product owner on 2026-07-28.
- Result: **approved**.
