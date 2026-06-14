# Roadmap: AgenticApps Pipeline Dashboard

Multi-project pipeline dashboard: a hosted static SPA on Cloudflare Pages + a single local daemon that reads `.planning/`, `.claude/`, and `git log` per registered project — visible from any device, no project data leaving the machine.

**Source spec:** `docs/spec/dashboard-prompt.md` (binding).

## Milestones

- ✅ **v1.0 Working dashboard + /help docs** — Phases 0–7 (+5.1, 6.1) — shipped; tagged `v1.0.0` / `v1.0.1`
- ✅ **v1.1 Cross-family observability** — Phases 10, 10.5, 10.6, 11, 11.1, 11.2, 12, 13, 14 — shipped 2026-06-08; tagged `v1.1`
- ✅ **v1.2 Optional integrations & fleet-conformance follow-through** — Phase 8 + Phase 12/12.1/13/14.1 close-outs — shipped 2026-06-12; tagged `v1.2`
- 📋 **v1.3 Open-source readiness** (next) — Phase 9 (LICENSE, CONTRIBUTING, optional public landing)

> Full phase detail, success criteria, decisions, and close-out audits are archived per milestone in
> `.planning/milestones/v1.0-…` (history), `v1.1-ROADMAP.md`, and `v1.2-ROADMAP.md`. Requirements are
> archived alongside each (`v1.1-REQUIREMENTS.md`, `v1.2-REQUIREMENTS.md`).

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
- [x] Phase 12: Observability Conformance Surface (impl 6/7) — shipped; gate closed in v1.2
- [x] Phase 13: GitNexus scoped scan actions (impl 3/4) — shipped; gate closed in v1.2
- [x] Phase 14: Understand-Anything integration (8/8) — completed 2026-06-08 (PR #54)

Known deferred items at close: see `.planning/MILESTONES.md` and `.planning/STATE.md` "Deferred Items".

</details>

<details>
<summary>✅ v1.2 Optional integrations & fleet-conformance follow-through — SHIPPED 2026-06-12 (PR #58 + #59, tag v1.2)</summary>

- [x] Phase 8: Optional integration panels — Sentry + Linear + Infisical (6/6) — completed 2026-06-11
- [x] Phase 12 close-out: ran deferred `12-06` gate retrospectively → `12-VERIFICATION.md` (GATE-12-01..03)
- [x] Phase 12.1: conformance chart legibility — legend + 70/90 threshold labels (1/1, composite 80→84)
- [x] Phase 13 close-out: confirmed `13-04` gate complete → `13-VERIFICATION.md` (GATE-13-01)
- [x] Phase 14.1: `/code-intelligence` IMPECCABLE lift (1/1, composite 74→81; waiver retired)

Net-new: Phase 8 only. The rest closed carry-over conformance debt from v1.1.
Full detail archived in `.planning/milestones/v1.2-ROADMAP.md`. Requirements in `.planning/milestones/v1.2-REQUIREMENTS.md`.

</details>

### 📋 v1.3 Open-source readiness (next)

- [ ] Phase 9: Open-source Readiness — LICENSE, CONTRIBUTING, optional public landing (OSS-01..03)

> Not yet started. Run `/gsd-new-milestone` to define v1.3 requirements and roadmap.

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
| 12. Observability Conformance Surface | v1.1 | 7/7 | ✅ Complete (gate closed v1.2) | 2026-06-10 |
| 13. GitNexus scoped scan actions | v1.1 | 4/4 | ✅ Complete (gate closed v1.2) | 2026-06-10 |
| 14. Understand-Anything integration | v1.1 | 8/8 | ✅ Complete | 2026-06-08 |
| 8. Optional Integration Panels | v1.2 | 6/6 | ✅ Complete | 2026-06-11 |
| 12.1. Conformance chart legibility | v1.2 | 1/1 | ✅ Complete (80→84) | 2026-06-10 |
| 14.1. /code-intelligence IMPECCABLE lift | v1.2 | 1/1 | ✅ Complete (74→81) | 2026-06-10 |
| 9. Open-source Readiness | v1.3 | 0/TBD | 📋 Not started | - |
