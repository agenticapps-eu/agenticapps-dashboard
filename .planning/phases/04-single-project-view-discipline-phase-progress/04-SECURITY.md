---
phase: 4
slug: single-project-view-discipline-phase-progress
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-06
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 4 ships the single-project detail view (Discipline + Phase Progress columns).
> 43 threats across 6 plans verified against implementation. State B audit (no prior SECURITY.md) — created from PLAN/SUMMARY artifacts on 2026-05-06.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Schema definition → wire | Zod schemas in `@agenticapps/dashboard-shared` govern what shapes the daemon may emit and the SPA may accept; outbound() validates every response. | Wire payloads (CommitmentBlockResponse, ObservationsRecentResponse, DisciplineResponse, PhaseProgressResponse, SecurityResponse). |
| Daemon → project filesystem (read) | Plan 02 parsers read `<root>/.planning/...` and `<root>/.claude/...` via hardcoded `join()` segments. Root is the canonical realpath stored at registration time (Phase 1 D-23). INV-01 read-only invariant preserved. | Markdown text, JSONL hook firings, SKILL.md tables, REVIEW.md `<finding>` blocks, SECURITY.md content (≤ 4096 chars), VERIFICATION.md bullets. |
| Daemon → git subprocess | `parseExecutionTimeline` shells out to `git log` via execa argv-array (no shell). Cwd is the canonical project root; argv is fixed; `GIT_SUBPROCESS_TIMEOUT_MS=5000` bounds runtime. | git commit subjects + SHAs + ISO dates. |
| JSONL stream → daemon memory | `readSkillObservations` streams via `node:readline` (line-at-a-time, constant memory) before `JSON.parse` per line in try/catch, then Zod-validates downstream. | Hook firing events from `.planning/skill-observations/*.jsonl`. |
| Daemon → cache | `phaseCache` keys `${id}:${routeName}` (and `:${limit}` for observations); 5s TTL, lazy expiry; `evictPhaseCacheProject(id)` clears all entries on unregister. | Per-route memoised parser output (5 routes × N projects). |
| SPA → daemon (HTTP) | All five Phase 4 routes are bearer-token gated by `app.ts` middleware (AUTH-01). CORS locked to PROD_ORIGIN + DEV_ORIGIN; unchanged in this phase. | Bearer token (Authorization header), JSON request bodies are GET-only. |
| TanStack Query cache (browser memory) | Each query cache entry keyed by `[name, projectId(, limit)]`. Cross-project leakage prevented by E2E7 assertion. parseOrDrift gates every response; drift throws `Error('schema_drift:<path>')`. | Browser-side cached daemon responses. |
| Daemon → SPA panel render | All panels render data via React text interpolation only. `<pre>` preserves whitespace but does not interpret HTML. No raw-HTML injection sinks introduced anywhere in Phase 4 (verified via grep — zero occurrences across all 8 panels + ProjectHeader + SingleProjectView). | Rendered DOM text (filenames, commit subjects, audit content, rationalization labels, hook events). |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01-01 | I | HookFiringSchema.passthrough() preserves arbitrary unknown fields end-to-end | accept | D-4-06; bearer-gated; SPA renders only ts/skill/hook | closed (Accepted Risks Log row 1) |
| T-04-01-02 | T | Conflicting FindingCountsSchema (3-bucket) vs ReviewFindingCountsSchema (4-bucket) | mitigate | Two distinct schemas; Test 2.5 enforces wire-shape rejection between them. Evidence: `packages/shared/src/schemas/phaseDetail.ts:29-35` | closed |
| T-04-01-03 | I | CsoSummarySchema/DbSentinelSummarySchema unbounded `content` string | mitigate | Parser-side cap `SECURITY_CONTENT_CAP = 4_096` via `slice(0, ...)`. Evidence: `packages/agent/src/lib/phaseDetail.ts:347,371` | closed |
| T-04-01-04 | D | PhaseProgressResponseSchema unbounded `files`/`tdd.timeline` arrays | accept | Phase dirs have ≤30 files; ExecutionTimeline filters to single phase prefix; bearer-gated | closed (Accepted Risks Log row 2) |
| T-04-01-05 | T | RationalizationRowSchema.label is unbounded user-supplied string | mitigate | Bearer-token gated + React text interpolation only (no raw-HTML sinks). Evidence: `packages/shared/src/schemas/discipline.ts:8-12` + `packages/spa/src/components/panels/RationalizationFires.tsx:97` | closed |
| T-04-02-01 | T | Path traversal via `join(root, ...)` with attacker-controlled segments | mitigate | All path segments are HARDCODED string literals; no segment originates from request. Evidence: `packages/agent/src/lib/phaseDetail.ts:78,129,131` | closed |
| T-04-02-02 | D | Massive .jsonl file overwhelming readSkillObservations | mitigate | `node:readline` streaming via `createReadStream` + `createInterface`. Evidence: `packages/agent/src/lib/phaseDetail.ts:14-15,143-144` | closed |
| T-04-02-03 | D | git log with millions of commits | mitigate | `GIT_SUBPROCESS_TIMEOUT_MS = 5_000` from constants.js bounds runtime; `reject:false` graceful empty. Evidence: `packages/agent/src/lib/phaseDetail.ts:20,305` | closed |
| T-04-02-04 | T | Malicious JSONL line injecting unexpected JSON shapes | mitigate | Per-line `JSON.parse` in try/catch; lines failing parse silently skipped; ts/skill/hook minima check. Evidence: `packages/agent/src/lib/phaseDetail.ts:148-157` | closed |
| T-04-02-05 | D | parseSecurityReports loading a 50MB SECURITY.md | mitigate | `slice(0, SECURITY_CONTENT_CAP)`. Evidence: `packages/agent/src/lib/phaseDetail.ts:347,371` | closed |
| T-04-02-06 | I | parseRationalizationRows reads SKILL.md content into memory | accept | Bearer-gated; SKILL.md is part of project's own filesystem | closed (Accepted Risks Log row 3) |
| T-04-02-07 | T | parseExecutionTimeline regex bypass via crafted commit subject | accept | Bearer-gated + project-scoped + timeline is informational only (no security action triggered) | closed (Accepted Risks Log row 4) |
| T-04-02-08 | T | phaseCache key collision via projectId containing `:` | mitigate | Registry slugs are `[a-z0-9-]+` (Phase 1 slugify) — no colons possible. Evidence: `packages/agent/src/lib/phaseCache.ts:14` + `packages/agent/src/lib/registry.ts:40` | closed |
| T-04-02-09 | D | parseVerificationDetail unbounded items array on malformed VERIFICATION.md | accept | Verification files have ≤30 must_have bullets in practice; bearer-gated | closed (Accepted Risks Log row 5) |
| T-04-03-01 | T | `:id` path param could contain unexpected chars | mitigate | Exact-equality lookup `reg.projects.find(p => p.id === id)` on every route. Evidence: `packages/agent/src/routes/{commitment,observations,discipline,phaseProgress,security}.ts` (each has `p.id === id` once) | closed |
| T-04-03-02 | I | Cross-project leak via cache key collision | mitigate | Cache key `${id}:${routeName}` + `evictPhaseCacheProject(id)` clears all `${id}:*`. Evidence: `packages/agent/src/lib/phaseCache.ts:54` + unregister handler eviction | closed |
| T-04-03-03 | D | observations route with `?limit=999999` filling memory | mitigate | `MAX_LIMIT = 100`, `Math.min(parsed, MAX_LIMIT)`. Evidence: `packages/agent/src/routes/observations.ts:21-22,38` | closed |
| T-04-03-04 | D | phase-progress fans out to 4 parsers + 2 git subprocesses | mitigate | `getPhaseCache`/`setPhaseCache` 5s memo + `Promise.all` parallelisation + `GIT_SUBPROCESS_TIMEOUT_MS`. Evidence: `packages/agent/src/routes/phaseProgress.ts:32,47,58,112` | closed |
| T-04-03-05 | I | Schema drift exposing internal data structures | mitigate | `outbound(c, Schema.parse.bind(Schema), value)` on every route. Evidence: 5 route files × 2 outbound() calls each (cache hit + miss) | closed |
| T-04-03-06 | T | observations cache key includes `:limit:${n}` — `?limit=evil` collision | mitigate | `parseInt(rawLimit, 10)` + `Number.isFinite(parsed) && parsed > 0` fallback to DEFAULT_LIMIT. Evidence: `packages/agent/src/routes/observations.ts:36-39` | closed |
| T-04-03-07 | I | Stale phase data after re-registering project with same id | mitigate | `evictPhaseCacheProject(body.id)` in unregister handler directly after `evictOverviewCache`. Evidence: `packages/agent/src/routes/registry.ts:36,105-106` | closed |
| T-04-03-08 | T | Hono path matching `:id` overlap risk | accept | Hono path-template matching with explicit segment counts; deployed/tested in Phase 3 | closed (Accepted Risks Log row 6) |
| T-04-04-01 | I | Cross-project leak via cache key reuse | mitigate | Every queryKey includes `projectId`; observations queryKey also includes `limit`. Evidence: `packages/spa/src/lib/projectQueries.ts:44,63,85,104,123` | closed |
| T-04-04-02 | T | URL injection via projectId in fetch path | mitigate | TanStack Router URL-decodes; daemon validates by exact-match registry slug lookup. Evidence: `packages/spa/src/lib/projectQueries.ts:46,65,87,106,125` (apiFetch boundary) + Plan 03 routes | closed |
| T-04-04-03 | T | observations `limit` URL parameter accepts any string | mitigate | Daemon-side clamp `MAX_LIMIT=100` + parseInt fallback. Evidence: `packages/agent/src/routes/observations.ts:36-39` | closed |
| T-04-04-04 | I | document.title leaks projectId outside the page | accept | Browser-local; never network-transmitted | closed (Accepted Risks Log row 7) |
| T-04-04-05 | T | XSS via name/client/branch values in ProjectHeader | mitigate | React text interpolation only; no raw-HTML injection sinks. Evidence: `packages/spa/src/components/ProjectHeader.tsx:57,59` (text interpolation only — grep across all Phase 4 files returns 0 occurrences of raw-HTML props) | closed |
| T-04-04-06 | D | 5 simultaneous polls per project at 5s cadence | mitigate | Daemon 5s phaseCache memo + `refetchIntervalInBackground: false` (5 occurrences). Evidence: `packages/spa/src/lib/projectQueries.ts:35,53,75,94,113,132` | closed |
| T-04-04-07 | T | TanStack Router path param `:projectId` containing path traversal | mitigate | Daemon matches registry by EXACT EQUALITY (T-04-03-01 inheritance); no filesystem path constructed from param. Evidence: same as T-04-03-01 (all 5 routes use `p.id === id`) | closed |
| T-04-05-01 | T | Hostile content in commitment markdown including script tags | mitigate | Rendered inside `<pre>` via React text interpolation; React escapes `<`, `>`, `&`. Evidence: `packages/spa/src/components/panels/CommitmentBlock.tsx:72` (`<pre>{markdown}</pre>` — text interpolation only) | closed |
| T-04-05-02 | T | Hostile content in HookFiring.skill/.hook fields | mitigate | React text children auto-escaped. Evidence: `packages/spa/src/components/panels/HookFirings.tsx` (no raw-HTML props introduced; React default escaping) | closed |
| T-04-05-03 | T | Hostile rationalization label injecting via SKILL.md table | mitigate | React text interpolation; parser strips quotes; bearer-gated. Evidence: `packages/spa/src/components/panels/RationalizationFires.tsx:97` `{r.label}` | closed |
| T-04-05-04 | I | Install-hint copy command is placeholder pending Phase 6 | accept | Public CLI invocation; no security exposure | closed (Accepted Risks Log row 8) |
| T-04-05-05 | D | Massive HookFirings list crashing the panel | accept | Daemon clamps observations limit to MAX_LIMIT=100 (T-04-03-03); 100-row max | closed (Accepted Risks Log row 9) |
| T-04-05-06 | T | Index-based React key on hook-firings list could cause stale state on reorder | accept | List is render-only (no per-row interactive state); ts is primary discriminator | closed (Accepted Risks Log row 10) |
| T-04-05-07 | I | Copy button leaks install command to clipboard | accept | Public CLI invocation; no secrets involved | closed (Accepted Risks Log row 11) |
| T-04-06-01 | T | Hostile content in cso `content` field | mitigate | Daemon caps content at 4096 chars (T-04-02-05); React text interpolation in `<pre>`. Evidence: `packages/spa/src/components/panels/SecurityStatus.tsx:74-75,84-85` | closed |
| T-04-06-02 | T | Hostile commit subject in ExecutionTimeline | mitigate | React text interpolation. Evidence: `packages/spa/src/components/panels/ExecutionTimeline.tsx:120-121` | closed |
| T-04-06-03 | I | Cross-project cache leak when navigating /projects/acme → /projects/beta | mitigate | E2E7 explicitly asserts independent cache entries. Evidence: `packages/spa/src/__tests__/projects-detail-e2e.test.tsx:290,297-308` | closed |
| T-04-06-04 | D | Massive PhaseProgress.files array overwhelming the panel | accept | Daemon-side bounded (≤30 files in practice); no virtualisation | closed (Accepted Risks Log row 12) |
| T-04-06-05 | D | ExecutionTimeline with hundreds of task groups | accept | Phase prefix filter bounds entries to commits matching `04-NN`; no virtualisation | closed (Accepted Risks Log row 13) |
| T-04-06-06 | T | Shared InlineDrift refactor — Plan 05 panel tests must still pass | mitigate | Refactor preserves call sites verbatim; Plan 05 tests run as regression check. Evidence: `packages/spa/src/components/panels/{CommitmentBlock,HookFirings,RationalizationFires}.tsx` each `import { InlineDrift } from './InlineDrift.js'` (3 imports) | closed |
| T-04-06-07 | I | document.title set in SingleProjectView includes projectId | accept | Browser-local; no network exposure | closed (Accepted Risks Log row 14) |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationalization | Accepted By | Date |
|---------|------------|-----------------|-------------|------|
| AR-04-01 | T-04-01-01 | HookFiringSchema.passthrough() preserves unknown future meta-observer fields end-to-end. D-4-06 explicitly accepts this so future meta-observer fields round-trip without forcing a dashboard release. Source data is the user's own filesystem; bearer-token gated; no cross-tenant leakage. SPA renders only ts/skill/hook — unknown fields stay in cache memory and are not displayed. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-02 | T-04-01-04 | PhaseProgressResponseSchema unbounded `files` and `tdd.timeline` arrays. Phase directories contain ≤~25 files; ExecutionTimeline filters to a single phase prefix (≤~30 commit pairs). No realistic input drives unbounded growth. Re-evaluate if a project amasses >100 phases (multi-year horizon). | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-03 | T-04-02-06 | parseRationalizationRows reads SKILL.md content into memory. Bearer-gated; SKILL.md is part of the project's own filesystem and the bearer holder is by design authorized to read it. No cross-project leakage (parser invoked per-project root). | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-04 | T-04-02-07 | parseExecutionTimeline regex could match a crafted commit subject "anything `test(99-99): RED`" if at start of subject. Disposition: bearer-token gate + project scope + timeline is informational only (no security action triggered). The harm is UI confusion only. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-05 | T-04-02-09 | parseVerificationDetail unbounded items array on a malformed VERIFICATION.md. Verification files have ≤~30 must_have bullets in practice. No realistic input grows the array unboundedly. Bearer-token gated. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-06 | T-04-03-08 | Hono path matching: `/:id/observations/recent` only matches that exact 3-segment shape. Pattern verified to coexist with existing `/:id/overview`, `/:id/read`, `/:id/git` routes (Phase 3 deployed and tested). | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-07 | T-04-04-04 | document.title set to `${projectId} — AgenticApps Dashboard` is browser-local; never network-transmitted. projectId is the user's own slug from their own registry — no cross-tenant exposure. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-08 | T-04-05-04 | Install-hint copy `claude skill install meta-observer` is a placeholder pending Phase 6 confirmation. The placeholder may not be the canonical CLI invocation; v1 cost is the user pasting a wrong command and looking up the right one. Phase 6 polish item. No security exposure. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-09 | T-04-05-05 | Massive HookFirings list crashing the panel: daemon clamps observations limit to MAX_LIMIT=100 (T-04-03-03 mitigation). The panel renders ≤100 rows with no virtualisation. UI-SPEC explicitly waived virtualisation for the 20-row default. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-10 | T-04-05-06 | Index-based React key `${e.ts}-${i}` on hook-firings list could cause stale state on reorder. The list is render-only (no per-row interactive state); reordering on poll causes a flash repaint, not state corruption. ts is primary discriminator. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-11 | T-04-05-07 | CodeBlock copy button writes the install command to clipboard. The CodeBlock component is reused from Phase 3; commands are public CLI invocations. No secrets involved. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-12 | T-04-06-04 | PhaseProgress.files array bounded by daemon (phase directory has <30 files in practice). PhaseProgress renders without virtualisation; UI-SPEC explicitly waived virtualisation. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-13 | T-04-06-05 | ExecutionTimeline with hundreds of task groups: phase prefix filter (Plan 02) bounds entries to commits matching `04-NN`. A 100-task phase is the realistic ceiling. Panel renders without virtualisation. | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |
| AR-04-14 | T-04-06-07 | document.title set in SingleProjectView includes projectId; browser-local, no network exposure. projectId is the user's own slug. (Same rationalization as AR-04-07; the title is set in SingleProjectView's useEffect rather than the route component.) | Phase 4 plan author (locked at PLAN time) | 2026-05-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-06 | 43 | 43 | 0 | gsd-security-auditor (State B: created from PLAN/SUMMARY artifacts) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer) — 29 mitigate, 14 accept, 0 transfer
- [x] Accepted risks documented in Accepted Risks Log (14 entries: AR-04-01..14)
- [x] `threats_open: 0` confirmed (43/43 closed)
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-06

---

## Notes

- All 6 SUMMARY.md files (04-01..04-06) declare `## Threat Flags: None`. No unregistered attack surface introduced beyond the threat register.
- Verification methodology: each `mitigate` threat verified by grepping the declared mitigation pattern in the cited implementation file(s) and recording the file:line evidence in the Threat Register. Each `accept` threat verified by presence in the Accepted Risks Log above.
- Implementation files were treated read-only; this audit produced no code modifications.
- ASVS Level 1 scope: bearer-token gating on every daemon route (AUTH-01 inheritance), CORS lock unchanged, no native dependencies introduced, no new resolveAllowed bypass, no raw-HTML injection sinks introduced anywhere in Phase 4 (verified via grep across all 8 panels + ProjectHeader + SingleProjectView — zero occurrences).
- E2E test `packages/spa/src/__tests__/projects-detail-e2e.test.tsx` test E2E7 explicitly asserts cross-project cache isolation — closes T-04-06-03 and reinforces T-04-04-01.
