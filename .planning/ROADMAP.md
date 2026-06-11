# Roadmap: AgenticApps Pipeline Dashboard

Multi-project pipeline dashboard: a hosted static SPA on Cloudflare Pages + a single local daemon that reads `.planning/`, `.claude/`, and `git log` per registered project — visible from any device, no project data leaving the machine.

**Source spec:** `docs/spec/dashboard-prompt.md` (binding).

## Milestones

- ✅ **v1.0 Working dashboard + /help docs** — Phases 0–7 (+5.1, 6.1) — shipped; tagged `v1.0.0` / `v1.0.1`
- ✅ **v1.1 Cross-family observability** — Phases 10, 10.5, 10.6, 11, 11.1, 11.2, 12, 13, 14 — shipped 2026-06-08; tagged `v1.1`
- 🔨 **v1.2 Optional integrations & fleet-conformance follow-through** (current — opened 2026-06-10) — Phase 8 (optional integration panels: Sentry / Linear / Infisical) + close Phase 12/13 gates + Phase 14.1 IMPECCABLE lift
- 📋 **v1.3 Open-source readiness** — Phase 9 (LICENSE, CONTRIBUTING, optional public landing)

> Full phase detail, success criteria, decisions, and the v1.1 close-out audit are archived in
> `.planning/milestones/v1.1-ROADMAP.md`. Requirements are archived in `.planning/milestones/v1.1-REQUIREMENTS.md`.

## Phases

<details>
<summary>✅ v1.0 Working dashboard + /help docs (Phases 0–7) — SHIPPED (PR #15, tag v1.0.0; /help via PR #21/#22)</summary>

- [x] Phase 0: Bootstrap (5/5) — completed 2026-05-03
- [x] Phase 1: Daemon + Registry + Pairing (5/5) — completed 2026-05-04
- [x] Phase 2: SPA Shell + Pair Flow (6/6) — completed 2026-05-04
- [x] Phase 3: Multi-project Home (11/11) — completed 2026-05-05
- [x] Phase 4: Single-project View — Discipline + Phase Progress (6/6) — completed 2026-05-08
- [x] Phase 5: Skills + Health Panels (6/6) — completed 2026-05-08
- [x] Phase 05.1: UI redesign — Cloudflare-inspired sidebar shell (inserted, 6/6) — completed 2026-05-09
- [x] Phase 6: Polish + Service Install + Acceptance (7/7) — completed 2026-05-10
- [x] Phase 06.1: Typography + layout impeccable lift (inserted, 7/7) — completed 2026-05-11
- [x] Phase 7: Help docs v1.0 (5/5) — completed 2026-05-12

</details>

<details>
<summary>✅ v1.1 Cross-family observability (Phases 10–14) — SHIPPED 2026-06-08 (final ship PR #54)</summary>

- [x] Phase 10: Coverage Matrix Page (9/9) — completed 2026-05-13 (PR #28)
- [x] Phase 10.5: Impeccable skill-driven gate (inserted, 5/5) — completed 2026-05-13 (PR #28)
- [x] Phase 10.6: Three-state GitNexus detection (inserted, 1/1) — completed 2026-05-14 (PR #29)
- [x] Phase 11: Coverage trends + Skill drift + 10.6 polish (6/6) — completed 2026-05-18 (PR #35)
- [x] Phase 11.1: Impeccable P1 polish bundle (inserted, 6/6) — completed 2026-05-18 (PR #36)
- [x] Phase 11.2: Impeccable P2 polish bundle (inserted, 6/6) — completed 2026-05-19 (PR #38)
- [~] Phase 12: Observability Conformance Surface (6/7) — impl shipped; gate plan 12-06 not run, no 12-VERIFICATION (deferred)
- [x] Phase 13: GitNexus scoped scan actions (impl 3/4) — shipped; gate plan 13-04 incomplete (deferred)
- [x] Phase 14: Understand-Anything integration (8/8) — completed 2026-06-08 (PR #54)

Known deferred items at close: see `.planning/MILESTONES.md` and `.planning/STATE.md` "Deferred Items".

</details>

### 🔨 v1.2 Optional integrations & fleet-conformance follow-through (current)

Ordering puts the quick carry-over close-outs first (clears v1.1 debt, gives a green baseline), then the net-new Phase 8 feature work last. Phase 8 is independent of the close-outs and could run in parallel if desired.

- [x] **Phase 12 close-out** — ✅ ran deferred `12-06` gate retrospectively (GSD retro-tools): `12-REVIEW.md` (0 crit) + `12-SECURITY.md` (SECURED 27/27) + `12-HUMAN-UAT.md` (4/4 PASS) + `12-IMPECCABLE.md` (composite 80) + `12-VERIFICATION.md`. *Impl shipped in v1.1; gate only.* → GATE-12-01..03 ✅
  - **Success:** ✅ `12-VERIFICATION.md` present with 1:1 gate evidence; GATE-12-* validated. 2 P1 chart-legibility gaps routed to Phase 12.1.
- [x] **Phase 12.1: conformance chart legibility** — ✅ added persistent legend + 70/90 threshold labels to `FleetTrendChart.tsx` (TDD; closed code-review IN-06). Re-critique composite **84**. → IMPV-12.1-01 ✅
  - **Success:** ✅ `12.1-IMPECCABLE.md` composite 84 (≥83); legend + threshold labels render; chart legible without hover.
- [x] **Phase 13 close-out** — ✅ confirmed `13-04` gate complete (CSO PASS · two-stage REVIEW, HIGH S1-01 addressed · IMPECCABLE 84 · UAT resolved) + wrote `13-VERIFICATION.md` (PASS). gitnexusScan 45 tests green. → GATE-13-01 ✅
  - **Success:** ✅ Phase 13 flips ⚠️ → ✅; `13-VERIFICATION.md` present.
- [x] **Phase 14.1: `/code-intelligence` IMPECCABLE lift** — ✅ raised composite **74 → 81** (TDD; error recovery, communicative cells, relative time, header consistency, real status-pill tokens). Structural-debt waiver retired. → IMPV-01 ✅
  - **Success:** ✅ `14.1-IMPECCABLE.md` composite 81 (≥ 80); waiver retired.
- [ ] **Phase 8: Optional integration panels** — Sentry + Linear read-only data panels (env-gated daemon routes, 60s cache, graceful empty states) + Infisical-aware env loading + read-only Infisical status reflection. → SENTRY-01..03, LINEAR-01..03, INFI-01..03
  - **Success:** All three panels render "configure to enable" with zero env set; with tokens set they show live data; dashboard fully functional without any of them; no native deps; shared Zod schema for all new wire shapes.
  - **Plans:** 6 plans (4 waves)
    - [x] 08-01-PLAN.md — Shared Zod schemas (Sentry, Linear, env, INFI-03 scope) [wave 1]
    - [x] 08-02-PLAN.md — Agent libs: outboundFetch (timeout/last-good/classify) + envFile (0600) + ENV_FILE [wave 2]
    - [x] 08-03-PLAN.md — Sentry route: slug resolution + /sentry/recent (60s cache, last-good, token-safe) [wave 3]
    - [ ] 08-04-PLAN.md — env set/list/unset CLI + boot loadEnvFile + INFI-03 scope reflection [wave 3]
    - [ ] 08-05-PLAN.md — Linear route: branch+log detection + /linear/issues + mount both routes [wave 4]
    - [ ] 08-06-PLAN.md — SPA SentryPanel + LinearPanel + query hooks + SingleProjectView wiring [wave 4]

> Invariants INV-01..05 (read-only FS, no native deps, optional-stays-optional, shared-schema SoT, `0600` secrets) apply across every v1.2 phase.

#### Phase 8: Optional Integration Panels

**Goal:** Add read-only Sentry, Linear, and Infisical panels that surface live data when their env vars are configured and show graceful "configure to enable" empty states when they are not — without making the dashboard depend on any of them. Source: spec §"Optional integrations: the contract" (lines 508–544), §"Optional integration routes" (lines 354–369), and `/api/projects/{id}/integrations` (lines 347–351).

**Depends on:** Phase 6 (complete dashboard baseline). Independent of the v1.2 close-out phases.

**Scope:**
- `GET /api/projects/{id}/integrations` — configured-or-not status for all three (read from project `.env`/config, never a remote service).
- `GET /api/projects/{id}/sentry/recent` — env-gated (`SENTRY_AUTH_TOKEN`), 60s cache, 404 "not configured" body when unset.
- `GET /api/projects/{id}/linear/issue/{issueId}` — env-gated (`LINEAR_API_KEY`), 60s cache, 404 "not configured" body when unset.
- Infisical-aware env loading + read-only `.infisical.json` status reflection (no Infisical API calls).
- SPA panels for each, with "Configure {ENV_VAR} to enable" empty states and cached-data fallback copy on API failure.
- Shared Zod schemas in `packages/shared/` for every new wire shape.

**Success Criteria:**
1. With zero integration env vars set, all three panels render "configure to enable" copy and the dashboard remains fully functional.
2. With tokens set, Sentry and Linear panels show live data; Infisical status reflects `.infisical.json` presence.
3. API failures show "unreachable — using cached data from {time}" rather than crashing.
4. No native dependencies added to `packages/agent/`; secrets handling honors the `0600` constraint.
5. All new daemon↔SPA wire shapes validate against shared Zod schemas (single source of truth).

### 📋 v1.3 (much later)

- [ ] Phase 9: Open-source Readiness — LICENSE, CONTRIBUTING, optional public landing

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 0. Bootstrap | v1.0 | 5/5 | ✅ Complete | 2026-05-03 |
| 1. Daemon + Registry + Pairing | v1.0 | 5/5 | ✅ Complete | 2026-05-04 |
| 2. SPA Shell + Pair Flow | v1.0 | 6/6 | ✅ Complete | 2026-05-04 |
| 3. Multi-project Home | v1.0 | 11/11 | ✅ Complete | 2026-05-05 |
| 4. Single-project View | v1.0 | 6/6 | ✅ Complete | 2026-05-08 |
| 5. Skills + Health Panels | v1.0 | 6/6 | ✅ Complete | 2026-05-08 |
| 05.1. UI redesign (inserted) | v1.0 | 6/6 | ✅ Complete | 2026-05-09 |
| 6. Polish + Service Install | v1.0 | 7/7 | ✅ Complete | 2026-05-10 |
| 06.1. Typography + Layout lift (inserted) | v1.0 | 7/7 | ✅ Complete | 2026-05-11 |
| 7. Help docs v1.0 | v1.0 | 5/5 | ✅ Complete | 2026-05-12 |
| 10. Coverage Matrix Page | v1.1 | 9/9 | ✅ Complete | 2026-05-13 |
| 10.5. Impeccable skill-driven gate (inserted) | v1.1 | 5/5 | ✅ Complete | 2026-05-13 |
| 10.6. Three-state GitNexus detection (inserted) | v1.1 | 1/1 | ✅ Complete | 2026-05-14 |
| 11. Coverage trends + Skill drift | v1.1 | 6/6 | ✅ Complete | 2026-05-18 |
| 11.1. Impeccable P1 polish bundle (inserted) | v1.1 | 6/6 | ✅ Complete | 2026-05-18 |
| 11.2. Impeccable P2 polish bundle (inserted) | v1.1 | 6/6 | ✅ Complete | 2026-05-19 |
| 12. Observability Conformance Surface | v1.1 | 6/7 | ⚠️ Impl shipped; gate deferred | 2026-05-20 |
| 13. GitNexus scoped scan actions | v1.1 | 3/4 | ⚠️ Shipped; gate deferred | 2026-05-25 |
| 14. Understand-Anything integration | v1.1 | 8/8 | ✅ Complete | 2026-06-08 |
| 12. Conformance surface — gate close-out | v1.2 | 7/7 | ✅ Gate closed (retrospective) | 2026-06-10 |
| 12.1. Conformance chart legibility (legend + thresholds) | v1.2 | 1/1 | ✅ Complete (composite 80→84) | 2026-06-10 |
| 13. GitNexus scoped scans — gate close-out | v1.2 | 4/4 | ✅ Gate closed (retrospective) | 2026-06-10 |
| 14.1. /code-intelligence IMPECCABLE lift | v1.2 | 1/1 | ✅ Complete (composite 74→81) | 2026-06-10 |
| 14.1. `/code-intelligence` IMPECCABLE lift | v1.2 | 0/TBD | 🔨 Planned | - |
| 8. Optional Integration Panels | v1.2 | 3/6 | In Progress|  |
| 9. Open-source Readiness | v1.3 | 0/TBD | 📋 Deferred | - |
