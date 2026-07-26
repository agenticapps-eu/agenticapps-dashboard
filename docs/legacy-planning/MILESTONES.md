# Milestones

## v1.2 Optional integrations & fleet-conformance follow-through (Shipped: 2026-06-12)

**Scope:** Phase 8 (net-new) + Phase 12 / 12.1 / 13 / 14.1 (carry-over close-out of v1.1-shipped work).
**Phases:** 5 | **Plans:** 6 (Phase 8) + 4 close-out/lift phases | **Timeline:** 2026-06-10 → 2026-06-12
**Git:** 66 commits since v1.1 tag; merged to `main` via PR #58 (code) + #59 (planning); tagged `v1.2`.

### Key accomplishments

- **Optional integration panels (Phase 8)** — read-only Sentry, Linear, and Infisical surfaces. Env-gated daemon routes (`/sentry/recent`, `/linear/issues`) with 60s cache, last-good stale fallback, and token-safe responses; `env set/list/unset` CLI writing `~/.agenticapps/dashboard/env.json` at `0600`; Infisical-aware `process.env` loading + read-only `.infisical.json` status reflection. All three panels render "configure to enable" with zero env set and the dashboard stays fully functional (INV-03). Shared Zod schemas as single source of truth. (SENTRY-01..03, LINEAR-01..03, INFI-01..03)
- **Phase 12 gate close-out** — ran the deferred `12-06` close-out gate retrospectively: `12-REVIEW.md` (0 crit), `12-SECURITY.md` (SECURED 27/27), `12-HUMAN-UAT.md` (4/4 PASS), `12-IMPECCABLE.md` (composite 80), `12-VERIFICATION.md`. (GATE-12-01..03)
- **Conformance chart legibility (Phase 12.1)** — persistent legend + 70/90 threshold labels on `FleetTrendChart.tsx`; re-critique composite **84**, legible without hover. (IMPV-12.1-01)
- **Phase 13 gate close-out** — confirmed `13-04` gate complete (CSO PASS, two-stage REVIEW with HIGH S1-01 addressed, IMPECCABLE 84, UAT resolved) and wrote `13-VERIFICATION.md`. Phase 13 flipped ⚠️ → ✅. (GATE-13-01)
- **`/code-intelligence` IMPECCABLE lift (Phase 14.1)** — composite **74 → 81** (error recovery + Retry, communicative cells, relative time, header consistency, real status-pill tokens); structural-debt waiver retired. (IMPV-01)

### Known deferred items at close (acknowledged as tech debt — see STATE.md "Deferred Items")

22 open-artifact-audit items, all carried over from already-shipped v1.0/v1.1 phases (none v1.2/Phase 8):

- **Verification `human_needed`** on Phases 00/01/02/03/04/06, 05.1, 10, 11.1, 11.2 (historical sign-off backlog).
- **UAT pending** — Phase 01 (2 scenarios) still partial; remaining phase UATs closed/resolved with 0 open scenarios.
- **2 open debug sessions** — `family-scan-no-ui-feedback` (unknown), `per-row-scan-repo-not-registered` (diagnosed).
- **Tailscale second-device viewer access (D-14-04)** — infra-gated; bind parity verified at code/test level only.
- **`08-IMPECCABLE.md` composite 78** — below the ≥80 floor; accepted under the per-phase structural-debt waiver clause (D-10.5-03.calibration-2).

### Versioning note

This is the **second** use of the "v1.2" label. The v1.1-archived ROADMAP/REQUIREMENTS bodies historically labeled Phases 12–14 as "v1.2 — Fleet conformance & drift visibility"; those were folded into **v1.1** at its 2026-06-08 close. This milestone (Phase 8 + the 12/13/14.1 close-outs) is the real, tagged v1.2.

---

## v1.1 Cross-family observability (Shipped: 2026-06-08)

**Scope:** Phases 10, 10.5, 10.6, 11, 11.1, 11.2, 12, 13, 14 (the post-v1.0 cross-family observability arc).
**Phases:** 9 | **Plans:** ~55 | **Timeline:** 2026-05-13 → 2026-06-08
**Git:** ~114 commits since 2026-05-12; final ship PR #54 (merge `f5771fb`).

### Key accomplishments

- **Coverage Matrix (Phase 10 + 10.6)** — `/coverage` page showing per-repo presence + freshness of CLAUDE.md, GitNexus index, family wiki, and workflow version across `~/Sourcecode/{agenticapps,factiv,neuroflash}`, with four-state freshness, family grouping, filters, and a three-state GitNexus detection enum. Ships as migration 0008 in claude-workflow. (COV-01..12)
- **Skill-driven impeccable gate (Phase 10.5)** — retired the broken CI impeccable gate; adopted a per-phase `<N>-IMPECCABLE.md` artifact authored by running `impeccable:critique`. Calibrated across data points to **D-10.5-03.calibration-2** (composite floor ≥ 80 + per-phase structural-debt waiver clause), ratified 2026-06-08.
- **Coverage trends + Skill drift (Phase 11)** — daily NDJSON snapshots under `~/.agenticapps/dashboard/coverage-history/` (14-day retention, in-process scheduler), per-cell drift badges, and a `/observability/skill-drift` cross-repo skill matrix with on-demand AgentLinter. (TRD-01..05, SKD-01..05, PLI-01..03)
- **Impeccable polish bundles (Phase 11.1 + 11.2)** — column-width lock via `<colgroup>` SoT, sticky toolbar (`--ph-h` hook), Toast primitive + 8 call sites, WCAG contrast invariant test, in-house Tooltip primitive, 44×44 touch targets, controlled search. (IMP-01..05)
- **Observability Conformance Surface (Phase 12)** — `/observability/conformance` with a pure-SVG 90-day fleet trend chart (≤120 LOC, no chart lib), per-family conformance scores, registry path-drift detection + `POST /api/admin/registry/fix-path`, and responsive Coverage collapse below 768px. (REQ-12-* — substantially shipped; see deferred items)
- **GitNexus scoped scan actions (Phase 13)** — per-family and per-repo daemon-driven `gitnexus analyze` from the Coverage matrix (replacing clipboard CTAs), with per-repo concurrency locks, progress polling, and a `/cso`-audited `~/.gitnexus/` write carve-out.
- **Understand-Anything integration (Phase 14)** — daemon-hosted knowledge-graph viewer at `/understand/{projectId}/` behind per-repo scoped HMAC v2 tokens, a Code Intelligence sidebar section, an understand column on Coverage, and an `install-understand-viewer` CLI. Shipped via PR #54.

### Known deferred items at close (recorded as tech debt — see STATE.md "Deferred Items")

- **Phase 12 not formally closed** — gate plan `12-06` (Stage 1/2 review, `/cso`, `/qa`, `12-IMPECCABLE.md`) was never executed and there is no `12-VERIFICATION.md`. Implementation plans 12-00…12-05 shipped; the closing ritual did not. REQ-12-* remain unchecked in the requirements archive.
- **Phase 13 gate plan `13-04`** marked incomplete in the roadmap (gates ritual). Implementation 13-00…13-03 shipped; `13-UAT.md` resolved.
- **2 open debug sessions** — `family-scan-no-ui-feedback` (unknown), `per-row-scan-repo-not-registered` (diagnosed).
- **Verification `human_needed`** on Phases 00–06, 05.1, 10, 11.1, 11.2 (historical human-UAT sign-off backlog).
- **UAT pending** — Phase 01 (2 scenarios) still partial.
- **Tailscale second-device viewer access (D-14-04)** — infra-gated; bind parity verified at code/test level only.
- **`/code-intelligence` IMPECCABLE composite ~74** — structural-debt waiver (D-10.5-03.calibration-2); lift work deferred to a 14.1 polish bundle.

### Versioning note

The ROADMAP phase bodies and the archived requirements label Phases 12–14 as "v1.2 — Fleet conformance & drift visibility." That labeling was superseded: STATE.md's `milestone: v1.1` pointer and the 2026-06-08 commit "mark Phase 14 complete + v1.1 milestone complete" fold all post-v1.0 observability work (Phases 10–14) into **v1.1**. The "v1.2" strings in the archived ROADMAP/REQUIREMENTS are historical.

---

*Prior releases (tagged but not archived via this workflow): v1.0.0 / v1.0.1 — Phases 0–7 (working dashboard + `/help` docs). See `.planning/milestones/v1.1-ROADMAP.md` for the full phase history.*
