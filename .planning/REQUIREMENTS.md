# Requirements: AgenticApps Pipeline Dashboard — v1.2

**Defined:** 2026-06-10
**Milestone:** v1.2 "Optional integrations & fleet-conformance follow-through"
**Core Value:** A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.

> Scope note: v1.2 is mostly **carry-over close-out** of v1.1-shipped work; only Phase 8 (integration panels) is net-new feature work. Requirement IDs SENTRY-/LINEAR-/INFI- are promoted from the v1.1 v2-backlog (`.planning/milestones/v1.1-REQUIREMENTS.md`). Gate/quality requirements (GATE-/IMPV-) capture the deferred verification rituals recorded in `.planning/MILESTONES.md`.

## v1.2 Requirements

### Sentry integration panel (Phase 8)

- [ ] **SENTRY-01**: `GET /api/projects/{id}/sentry/recent` returns recent errors when `SENTRY_AUTH_TOKEN` is set on the daemon
- [ ] **SENTRY-02**: Response cached ~60s; on API failure the panel falls back to "Sentry API unreachable — using cached data from {time}" and never crashes
- [ ] **SENTRY-03**: Without `SENTRY_AUTH_TOKEN`, the panel shows a "Configure to enable" empty state with a one-paragraph setup guide (link to `/help`)

### Linear integration panel (Phase 8)

- [ ] **LINEAR-01**: `GET /api/projects/{id}/linear/issue/{issueId}` returns issue title/status/assignee when `LINEAR_API_KEY` is set on the daemon
- [ ] **LINEAR-02**: Branch-name / commit pattern detection links commits/PRs to Linear issue IDs (the static `Linear: ACME-123` link needs no API call)
- [ ] **LINEAR-03**: Without `LINEAR_API_KEY`, the panel shows a "Configure to enable" empty state

### Infisical surface (Phase 8)

- [ ] **INFI-01**: Daemon reads its env from `process.env`; running under `infisical run` makes it Infisical-aware with **no code change**
- [ ] **INFI-02**: `agentic-dashboard env set` writes to `~/.agenticapps/dashboard/env.json` (mode `0600`) for non-Infisical users
- [ ] **INFI-03**: Read-only Infisical **status reflection** in the IntegrationsHealth surface — configured-or-not + scope, with a "configure" link. Reflects the separately-built `secrets-platform` (cparx pilot); makes **no** privileged Infisical calls and stores no secrets. Deliberately minimal — not a secrets manager.

### Phase 12 gate close-out (carry-over)

- [x] **GATE-12-01**: Execute the deferred `12-06` close-out gate — code-quality review (`12-REVIEW.md`, 0 crit) + `/cso` security audit (`12-SECURITY.md`, SECURED 27/27) + safe `/qa` (`12-HUMAN-UAT.md`, 4/4 PASS). *Retrospective via GSD retro-tools.*
- [x] **GATE-12-02**: `12-VERIFICATION.md` produced with 1:1 gate evidence; REQ-12-* validated by shipped+reviewed+secured+QA'd implementation
- [x] **GATE-12-03**: `12-IMPECCABLE.md` authored for `/observability/conformance` — composite **80** (at ratified ≥ 80 floor; 2 P1 chart-legibility gaps → Phase 12.1)

### Phase 13 gate close-out (carry-over)

- [x] **GATE-13-01**: ✅ Confirmed `13-04` gate complete — `13-CSO.md` (PASS, 0 HIGH), `13-REVIEW.md` (both stages; HIGH S1-01 addressed), `13-IMPECCABLE.md` (composite 84, clears ≥80 floor), `13-UAT.md` (resolved/pass) — and wrote `13-VERIFICATION.md` (PASS). gitnexusScan tests 45 green.

### Phase 12.1 conformance chart legibility (emerged from 12-IMPECCABLE)

- [x] **IMPV-12.1-01**: ✅ Added persistent legend (4 series → exact stroke-color swatches) + labeled the 70 (floor) / 90 (target) threshold lines in `FleetTrendChart.tsx`. Re-critique composite **84** (≥83 target met). Chart legible without hover. TDD (S17/S18 RED→GREEN); closed code-review IN-06.

### Phase 14.1 IMPECCABLE lift (carry-over)

- [x] **IMPV-01**: ✅ Lifted `/code-intelligence` composite **74 → 81** (Nielsen 24→30/40; cog-load 2→0) — error recovery + Retry, communicative Status/Actions cells, relative time, de-uppercased headers, real status-pill tokens. `14.1-IMPECCABLE.md` committed; structural-debt waiver retired. TDD.

### Cross-cutting invariants (must survive every v1.2 change)

- [ ] **INV-01**: Read-only on project filesystems preserved — no new daemon route writes to a registered project's files (sole exception remains `POST /api/projects/{id}/open`)
- [ ] **INV-02**: No native dependencies added to `packages/agent` (no `keytar`, no FFI) — Sentry/Linear clients are pure-JS HTTP
- [ ] **INV-03**: Optional integrations stay optional — dashboard renders fully and all non-integration routes work with zero of `SENTRY_AUTH_TOKEN` / `LINEAR_API_KEY` / Infisical configured
- [ ] **INV-04**: Shared Zod schema is the single source of truth for any new daemon ↔ SPA wire shape (Sentry/Linear/Infisical payloads); both ends validate
- [ ] **INV-05**: Secrets-on-disk discipline — any new env value lives only in `~/.agenticapps/dashboard/env.json` at mode `0600`; no token is logged or sent to the SPA

## Deferred (not in v1.2)

| Requirement | Reason |
|-------------|--------|
| **OSS-01..03** (Phase 9 open-source readiness) | Belongs to v1.3; v1.2 stays private-repo |
| Full Infisical secrets-management UI in the dashboard | Secrets infra lives in `agenticapps-eu/secrets-platform`; dashboard only reflects status (INFI-03) |
| Tailscale second-device viewer access (D-14-04) | Infra-gated; verified at code/test level only |
| Historical human-UAT sign-offs (Phases 00–06, 05.1, 10, 11.1, 11.2) | Backlog; not blocking v1.2 feature work |

## Out of Scope (architectural — unchanged from v1.0/v1.1)

| Feature | Reason |
|---------|--------|
| Cloud-side data storage of any kind | Architectural commitment: registry/auth/project data stays local |
| Hard dependency on Sentry / Linear / Infisical | All three are optional; dashboard must work without any of them |
| Native dependencies in `packages/agent` (`keytar`, FFI) | Breaks the `npx` install story and Linux portability |
| Cloudflare Workers / Pages Functions | Keeps SPA pure-static and deployment auditable |
| Reimplementing Linear / Sentry / Infisical | Links out when configured; doesn't replace them |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SENTRY-01..03 | Phase 8 | Pending |
| LINEAR-01..03 | Phase 8 | Pending |
| INFI-01..03 | Phase 8 | Pending |
| GATE-12-01..03 | Phase 12 (close-out) | ✅ Complete (12-VERIFICATION.md) |
| GATE-13-01 | Phase 13 (close-out) | ✅ Complete (13-VERIFICATION.md) |
| IMPV-12.1-01 | Phase 12.1 | ✅ Complete (composite 84) |
| IMPV-01 | Phase 14.1 | ✅ Complete (composite 81) |
| INV-01..05 | All phases | Pending |

**Coverage:**
- v1.2 requirements: 21 total (9 Phase 8 feature + 4 gate close-out + 1 IMPECCABLE + 5 invariants + 2 implicit)
- Mapped to phases: all
- Unmapped: 0

---
*Requirements defined: 2026-06-10 at v1.2 milestone open (`/gsd-new-milestone`).*
*Phase 8 IDs promoted from `.planning/milestones/v1.1-REQUIREMENTS.md` v2 backlog. Carry-over gates sourced from `.planning/MILESTONES.md` "Known deferred items at close".*
