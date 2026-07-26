---
phase: DASH-12-observability-conformance-surface
artifact: HUMAN-UAT
qa_date: 2026-06-10
mode: safe browser pass (non-destructive — no registry mutation, no fix-path clicks)
scenarios_total: 4
scenarios_pass: 4
overall: PASS
---

# 12-HUMAN-UAT.md — Phase 12 (Observability Conformance Surface)

Retrospective `/qa` walkthrough of the shipped `/observability/conformance` + `/coverage` surfaces. **Safe browser pass** (D-12-28 coverage minus the invasive fix-path/drift scenarios, per close-out decision 2026-06-10): chart reveal, family tiers, and responsive collapse verified live; fix-path flows recorded as code/test-verified, not live-exercised (seeding drift would mutate the real registry).

## Scenario Results

| # | Scenario | Verdict | Evidence |
|---|----------|---------|----------|
| 1 | Conformance trend chart reveal (1440×900) | **PASS** | Heading "Fleet conformance" + 3 family cards + SVG 90-day chart render with real data. 19 focusable per-day hit rects (`tabindex=0`, aria-labels e.g. "2026-05-18 — fleet 20%"). Keyboard focus reveals breakdown panel (date + per-family numbers); **Escape closes**; **Tab advances day + breakdown updates** (2026-05-28 → 29). **Hover** also reveals/updates (2026-05-21 → fleet 13% / agenticapps 11% / factiv 20% / neuroflash 8%). Both keyboard and pointer paths work. |
| 2 | Family card tiers (1440×900) | **PASS (observed)** | agenticapps **30** / red / ▼3 14d; factiv **58** / red / ▲12 14d; neuroflash **8** / red / — (flat). All three render correct tier mapping for the live data (all <70 → red). Green/amber boundary cases not exercisable without seeded data — not attempted (covered by `conformanceScore.test.ts` tier-boundary unit tests instead). |
| 3 | Coverage responsive collapse (key item) | **PASS** | **767px → CARDS** (0 tables, `matchMedia('(min-width:768px)')`=false, stacked per-repo cards with CLAUDE.MD/GITNEXUS/WIKI/WORKFLOW/UNDERSTAND labels). **768px → TABLE** (3 tables, 3 colgroups, 21 `<th>`, mq=true). **1024px → TABLE** with all 7 columns + sticky header + colgroups. Collapse fires exactly at the 768px boundary; Phase 11.1 `<colgroup>` invariant intact in the table branch. |
| 4 | Console health (both routes) | **PASS (one benign nit)** | No errors, no 404s, no React warnings on either route. Only output: Vite HMR logs, React DevTools dev notice, and a benign a11y warning — "A form field element should have an id or name attribute" (the search input(s)). No regressions. |

## Not Exercised (recorded, not run)

- **Fix-path happy path / error paths** (12-06 Scenarios 3–4) — require seeding registry path-drift (renaming/symlinking a registered project dir), which mutates the real `~/.agenticapps/dashboard/registry.json`. Intentionally **not** run in this safe pass. Coverage stands on: 10 conformance test files including `registryFixPath` tests asserting 422 `newPath_blocked` / `newPath_outside_family_roots`, 429 rate-limit, and atomic-write behavior (see `12-SECURITY.md` threat verification with file:line evidence). PathDriftPanel correctly auto-hides when there is no drift (verified live).
- **Green/amber tier boundaries** — current live data is all red-tier; boundary coloring (≥90 green, 70–89 amber) is covered by `conformanceScore.test.ts` unit tests rather than live seeding.

## Overall Verdict

**PASS.** The conformance breakdown reveals correctly via keyboard (focus/Tab/Escape) and hover; all three family cards render real red-tier data; the Coverage responsive collapse flips cleanly CARDS↔TABLE at the 768px boundary. The sole console finding is a low-severity missing id/name on the search input(s) — cross-referenced as a minor follow-up (not a conformance-surface regression). Invasive fix-path/drift scenarios deferred to code/test evidence per the safe-pass decision.

---
*Method: chrome-devtools browser automation, non-destructive. Live render confirmed real-data (not unpaired). Search-input id/name nit logged as a minor follow-up.*
