---
phase: DASH-08-optional-integration-panels
artifact: IMPECCABLE
critique_date: 2026-06-11
route: /projects/{id} (single-project view — Health column, Sentry + Linear panels)
viewport: 1440x900
theme: light / warm-paper (brand-primary)
composite: 78
nielsen_run1_prelift: 29
nielsen_run2_postlift: 26
deterministic_scan: clean (npx impeccable --json → [], exit 0)
floor: 80
verdict: WAIVED (structural-debt clause — ceiling is the ratified dual-surface integration design D-08-03/06, locked by D-08-06; 78 within the empirical 74/76/78 band)
requirement: CLAUDE.md "every frontend-touching phase commits an <N>-IMPECCABLE.md" (D-10.5-02); composite floor ≥ 80 with per-phase structural-debt waiver (D-10.5-03.calibration-2)
---

# 08-IMPECCABLE.md — Phase 8 (Optional Integration Panels)

Skill-driven IMPECCABLE gate for the frontend plan 08-06 (SentryPanel + LinearPanel in the
single-project Health column). Run live at 1440×900 against a paired daemon + SPA, light theme.

## Result

**Composite 78 — below the ≥80 floor — WAIVED under the per-phase structural-debt clause.**

The two new panels are, in isolation, calm, honest, secure, and on-brand (low-to-mid-80s quality).
The composite is held at 78 by a **composition-level** issue: in the not-configured state the
Health column surfaces integration status up to three times — the pre-existing `IntegrationsHealth`
panel lists Sentry/Linear/Infisical detection, and the dedicated `SentryPanel`/`LinearPanel` restate
"not configured" directly below it. That overlap is an **intentional, ratified architecture**, not an
accident, and the in-scope fix is forbidden by a locked decision (see Waiver below).

| Signal | Value |
|--------|-------|
| Composite (both independent assessments) | **78 / 100** |
| Nielsen total — run 1 (pre-lift) | 29 / 40 |
| Nielsen total — run 2 (post-lift) | 26 / 40 (variance = how hard each assessor weighted the redundancy) |
| Deterministic detector (`npx impeccable --json` on both panels + host) | **clean — `[]`, exit 0** |
| AI-slop verdict | Not slop at the component level; mild slop at the *composition* level (triple status) |

## Method (two isolated assessments + deterministic scan)

Per `impeccable:critique`, two independent design reviews were run without seeing each other's output:

- **Assessment A — LLM design review** (two isolated sub-agents, one pre-lift, one post-lift): live
  browser inspection at 1440×900 + panel source + brand context, scored against Nielsen's 10 + an
  8-item cognitive-load check + persona red flags. Neither saw the deterministic result.
- **Assessment B — deterministic detector**: `npx impeccable --json` over `SentryPanel.tsx`,
  `LinearPanel.tsx`, `SingleProjectView.tsx` → **clean** (no AI-slop / quality patterns).

Both Assessment-A runs landed **composite 78** and independently named the same ceiling (integration
redundancy), which is strong convergent evidence it is real and not assessor noise.

## The gate earned its keep — it caught a live spec violation (now fixed)

The headline value of running the live critique: with **no `SENTRY_AUTH_TOKEN` / `LINEAR_API_KEY` set**
— the default for every user today — both new panels rendered **"Agent unreachable — retrying…"**
instead of the spec-mandated configure-to-enable empty state (CLAUDE.md "optional integrations stay
optional"; 08-06-PLAN.md AC:18). Every prior gate (code review, verification) passed because the SPA
tests mocked a `200 {issues:[]}` response while the **real daemon returns `404 not_configured`** — the
two were verified in isolation and their integration was never exercised live.

Fixed across three TDD commits before this artifact:

1. **`e820efa` — INV-03 contract fix.** `useSentryRecent`/`useLinearIssues` now map the daemon's
   `not_configured` (404) `ApiError.code` to a `'not_configured'` sentinel (mirroring the
   `schema_drift:` convention). The panels render the configure-to-enable copy on `not_configured`,
   and a genuine **"No recent {Sentry,Linear} issues."** line on the configured-but-empty (`200 []`)
   path — which previously wrongly told a configured user to set the token again. A
   `key="not-configured"` forces a fresh `PanelContainer` mount across the loading→not_configured
   transition so `defaultCollapsed` actually applies live (covered by a transition test that
   reproduced the live/jsdom gap).
2. **`4fcefa9` — glance-ability lift.** Additive `PanelContainer.collapsedHint` prop: the collapsed
   header now reads **"Sentry — not configured" / "Linear — not configured"** (subtle
   `text-xs text-text-tertiary`, shown only while collapsed). Lifts H1 visibility and signals the
   optional-vs-core distinction without forcing an expand.
3. **`c2274f0` — typography polish.** Configure copy `text-base` → `text-sm` to match every sibling
   empty/loading state (both assessors flagged the unconfigured paragraph as the loudest text).

Full SPA suite **1263 green**; `pnpm -r typecheck` clean; `pnpm lint` 0 errors (239 pre-existing
warnings, unchanged).

## Nielsen movers (post-lift assessment)

| # | Heuristic | Score | Note |
|---|-----------|-------|------|
| 1 | Visibility of status | 3 | collapsed "— not configured" hint + Stale pill + "using cached data from {staleFrom}" banner; −1 for status shown twice |
| 2 | Match system / real world | 3 | "not configured" / "No recent Sentry issues" plain & literal; minor vendor jargon (level codes, raw `staleFrom`) |
| 3 | User control & freedom | 3 | collapse/expand reversible + keyboard-accessible; per-page-load only (by design, D-6.1-02) |
| 4 | Consistency & standards | 2→3 | typography aligned to `text-sm` (`c2274f0`); residual: Linear identifier link `font-semibold` vs Sentry shortId not |
| 5 | Error prevention | 4 | http(s) link-out guard, static JSX configure copy, schema-drift→InlineDrift; read-only surface |
| 6 | Recognition over recall | 3 | collapsed hint removes the expand-to-learn step; −1: `/help` is a generic target, not a setup deep-link |
| 7 | Flexibility & efficiency | 2 | no panel-hide for non-integration users; three integration-ish panels cost vertical space when unconfigured |
| 8 | Aesthetic & minimalist | 2 | **the ceiling** — default column restates integration absence up to three times (structural; see Waiver) |
| 9 | Error recovery | 3 | unreachable row + stale banner + InlineDrift retry — clear and recoverable |
| 10 | Help & documentation | 2 | single `/help` "Learn more"; no inline "where the env var goes" |

## What's working

- Honest, distinct empty states: "No recent Sentry issues." (healthy) vs configure copy (unset) vs
  stale banner — the corrected 4-state guard reads true.
- Collapsed-by-default + "— not configured" hint is an elegant, low-noise default for a calm panel.
- Trust/security discipline: static configure copy (T-05-05), http(s)-only link-outs,
  `rel="noopener noreferrer"`, schema-drift surfaced inline. No silent failures (deterministic clean).

## Persona red flags (residual, post-lift)

- **First-run dev (no integrations — today's default):** still sees Sentry/Linear "not configured"
  in the Integrations panel *and* as two dedicated panels — can read as the dashboard repeating
  itself. Mitigated (not removed) by collapse-default + the glance hint.
- **Dev with Sentry configured + live issues:** Integrations panel still shows a Sentry detection row
  while the dedicated panel shows live errors — duplicate signal in two different forms.

## Waiver (per-phase structural-debt clause — D-10.5-03.calibration-2)

The composite ceiling is the **integration-status redundancy**, and the "one source of truth" fix is
blocked by ratified, locked decisions:

- **D-08-03 / D-08-07** deliberately made Sentry/Linear *standalone* data-feed panels, distinct from
  the detection-status `IntegrationsHealth` panel.
- **D-08-06** (and 08-06-PLAN.md) explicitly forbid modifying `IntegrationsHealth.tsx` — "its Linear
  row must stay API-free." So Sentry/Linear cannot be removed from it.
- The spec requires the dedicated panels to **show** a configure-to-enable state when unset, so
  "don't render them when unconfigured" is also disallowed.

Removing the redundancy therefore requires reversing a ratified architecture decision — out of scope
for Phase 8 and declined by the user when offered as a broader lift. This is exactly the case the
per-phase structural-debt waiver was ratified for. **78 is dead-center in the established empirical
band** (Phase 10 = 74, Phase 11 = 76, Phase 14 /coverage = 80; D-10.5-03.calibration-2), confirming
the floor is reachable elsewhere but this content-dense surface sits at band.

**Verdict: WAIVED at 78.** Recorded in 08-VERIFICATION.md. Residual non-structural polish deferred
(below).

## Residual / deferred polish (non-blocking)

- **[P2]** `/help` "Learn more" → deep-link to the Sentry/Linear setup section (`/help#sentry-token`)
  and verify the route resolves; or inline the one-line setup like IntegrationsHealth does.
- **[P3]** Align link weight between panels (Linear identifier `font-semibold` vs Sentry shortId).
- **[Strategic / out of scope]** Reconcile the dual-surface integration model (IntegrationsHealth
  detection vs dedicated data feeds) into one source of truth — a roadmap decision, not a polish fix.
  This is the lever that would move the composite past 80 on this surface.

---
*Method: live browser critique (1440×900, light) → caught INV-03 not_configured→unreachable regression
→ TDD fix + glance-hint lift + typography polish (3 commits) → two isolated re-assessments (both 78) +
clean deterministic scan → structural-debt waiver per D-10.5-03.calibration-2. Evidence PNGs:
`evidence-default-unconfigured.png` (broken before), `evidence-lift-collapsed-hint.png` (fixed default),
`evidence-fixed-configure-expanded.png` (expanded copy).*
