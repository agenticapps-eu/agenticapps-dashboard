---
phase: DASH-12-observability-conformance-surface
audit_date: 2026-06-10
asvs_level: L1
block_on: high
auditor: gsd-security-auditor (retrospective; register_authored_at_plan_time true)
threats_total: 27
threats_closed: 27
threats_open: 0
threats_accepted: 7
verdict: SECURED
---

# SECURITY.md — Phase 12 (Observability Conformance Surface)

**Phase:** 12 — Observability Conformance Surface
**Audit date:** 2026-06-10 (retrospective close-out; phase shipped in v1.1)
**ASVS Level:** L1 · **block_on:** high
**Auditor:** gsd-security-auditor (`register_authored_at_plan_time: true` — verify mitigations, do not scan for new threats)

---

## Overall Verdict: SECURED

All 27 declared threats are CLOSED. No documented mitigation is absent from the implementation. Two informational notes (a containment-predicate asymmetry and a narrow pre-lock TOCTOU window) are logged below; neither constitutes a blocker under L1 at this threat model's severity ratings.

---

## Threat Verification Table

| Threat ID | Category | Component | Severity | Disposition | Evidence (file:line) | Verdict |
|-----------|----------|-----------|----------|-------------|----------------------|---------|
| T-12-PATH-TRAVERSAL | Tampering | `registryFixPath.ts` — `newPath` body field | HIGH | mitigate | `realpath(body.newPath)` line 150; family-root containment `canonical.startsWith(r + sep)` line 178; `assertRegistrationAllowed` lines 131–141 + 160–170 | CLOSED |
| T-12-SYMLINK-ESCAPE | Tampering | `registryFixPath.ts` (planted symlink) | HIGH | mitigate | realpath before containment (line 150); `atomicWriteFile` tmp `O_NOFOLLOW \| O_EXCL` (atomicWrite.ts:31-33); second `assertRegistrationAllowed(canonical)` lines 160–170 | CLOSED |
| T-12-CONCURRENT-WRITE | Tampering / DoS | registry.json mutation race | MEDIUM | mitigate | `atomicWriteFile` O_EXCL + fsync + rename (atomicWrite.ts:24-63); rate-limiter 10/10s/token (registryFixPath.ts:111-118); `withRegistryLock` O_EXCL cross-process lock (registry.ts:220–270, invoked line 204) — exceeds plan | CLOSED |
| T-12-CSRF | Spoofing | `POST /api/admin/registry/fix-path` | MEDIUM | mitigate | CORS locked to `[PROD_ORIGIN, DEV_ORIGIN]` (app.ts:137-143; constants.ts:5-6); bearer (not cookie) auth (app.ts:161-172) | CLOSED |
| T-12-AUTH | Spoofing | bearer middleware on both routes | HIGH | mitigate | `timingSafeEqual` constant-time, rejects empty (app.ts:161-172); both routes mounted behind it (app.ts:195-196) | CLOSED |
| T-12-ROUTE-AUTH-BYPASS | Spoofing | `/observability/conformance` route | MEDIUM | mitigate | `conformanceRoute` + `registryFixPathRoute` mounted at app.ts:195-196, after bearerAuth at line 161 | CLOSED |
| T-12-INFO-DISCLOSURE | Info disclosure | error response bodies | MEDIUM | mitigate | Structured codes only: `invalid_request`/`rate_limited`/`newPath_unresolvable`/`newPath_blocked`/`newPath_outside_family_roots`/`project_not_found` (registryFixPath.ts:102,115,152,163-166,182-184,241); no FS path echoed | CLOSED |
| T-12-PAGE-ERROR-LEAK | Info disclosure | `ConformancePage` ErrorState | LOW | mitigate | Generic "Could not load conformance data."; `PathDriftPanel.errorCodeToMessage` maps codes to friendly strings (PathDriftPanel.tsx:40-61), never `err.message` | CLOSED |
| T-12-REGISTRY-CORRUPTION | Tampering | registry.json mode regression | HIGH | mitigate | `writeRegistry` → `atomicWriteFile(..., 0o600)` (registry.ts:209); `ensureRegistryFile` creates 0o600 (registry.ts:193); O_EXCL prevents overwrite | CLOSED |
| T-12-DENIAL-OF-SERVICE | Availability | fix-path repeated calls | LOW | mitigate | Rate-limiter `WINDOW_MS=10_000`, `BURST_CAP=10` (rateLimiter.ts:5-6,24-38); 429 + `Retry-After` (registryFixPath.ts:113-118) | CLOSED |
| T-12-INPUT-OVERFLOW | DoS | `PathDriftPanel` manual paste input | LOW | mitigate | `maxLength={4096}` (PathDriftPanel.tsx:181); daemon `RegistryFixPathRequestSchema.min(1)` (conformance.ts:146-150) | CLOSED |
| T-12-SUPPLY-CHAIN | Tampering | new runtime deps | HIGH | mitigate | `registryPathDrift.ts` imports only `node:fs`/`node:fs/promises`/`node:path`; zero new deps; no `child_process`; `readGitOrigin` readFile+regex (registryPathDrift.ts:93-100) | CLOSED |
| T-12-IDEMPOTENT-FAIL | Tampering | fix-path replay | LOW | accept | Idempotent by design — same payload → same final state. Accepted (logged below). | CLOSED |
| T-12-CACHE-STALE | Tampering | conformance cache after fix | MEDIUM | mitigate | `invalidateConformanceCache()` + `invalidateCoverageCache()` from `writeRegistry` (registry.ts:216-217), invoked inside `withRegistryLock` (registryFixPath.ts:227) — stronger than plan (fires on all mutations) | CLOSED |
| T-12-MALFORMED-NDJSON | Tampering / DoS | `snapshotFleetReader` JSON.parse | LOW | mitigate | `try { JSON.parse } catch { continue }` (snapshotFleetReader.ts:166-169); type guard line 171; malformed lines skipped | CLOSED |
| T-12-RETENTION-LEAK | Info disclosure | `coverage-history/` | LOW | accept | `RETENTION_DAYS = 90` (snapshotPaths.ts:25); mode 0o600. Accepted (logged below). | CLOSED |
| T-12-RACE-PRUNER | Race condition | files unlink during walk | LOW | accept | `readFileSync` ENOENT → `catch { continue }` (snapshotFleetReader.ts:154-158); worst case one missing day. Accepted (logged below). | CLOSED |
| T-12-SCORE-OVERFLOW | Integer overflow | `scoreFamilyRecords` | LOW | accept | Max 90×50×4 = 18,000 cell counts; within safe-integer; `Math.round` bounded 0-100. Accepted (logged below). | CLOSED |
| T-12-SCHEMA-DRIFT | Tampering | `ConformanceResponseSchema` consumers | MEDIUM | mitigate | `.strict()` on every nested object (conformance.ts:60,89,111,116,133); `outbound(...)` guard (conformance.ts:37-41); `parseOrDrift` in `useConformance` | CLOSED |
| T-12-FILENAME-TRAVERSAL | Tampering | `snapshotFleetReader` file walk | LOW | mitigate | `isSnapshotFilename` anchored regex `/^\d{4}-\d{2}-\d{2}\.ndjson$/` (snapshotPaths.ts:34) applied before FS access (snapshotFleetReader.ts:144) | CLOSED |
| T-12-DRIFT-SET-LEAK | Info disclosure | `driftedRepoIds` set | LOW | accept | Daemon-side ephemeral, never serialised/returned directly. Accepted (logged below). | CLOSED |
| T-12-XSS | Tampering / Info disclosure | SPA components | HIGH | mitigate | Paths rendered as JSX text interpolation (PathDriftPanel.tsx:163-170); no `dangerouslySetInnerHTML`/`innerHTML` in any of FleetTrendChart/FamilyCard/PathDriftPanel | CLOSED |
| T-12-SCHEMA-DRIFT-RENDER | Tampering | `useConformance` fetch / render | MEDIUM | mitigate | `parseOrDrift` returns `{ ok:false, drift }` on schema failure; ConformancePage renders `SchemaDriftState`, never raw data | CLOSED |
| T-12-TOAST-LEAK | Info disclosure | `useToast` error in PathDriftPanel | LOW | mitigate | `errorCodeToMessage` friendly strings (PathDriftPanel.tsx:40-61); raw `err.message` never in toast; default "Fix failed" (line 59) | CLOSED |
| T-12-CONCURRENT-FIX | Tampering | PathDriftPanel double-click | LOW | mitigate | `inFlightRefreshes` guard `if (...has(entry.id)) return` (PathDriftPanel.tsx:102); button `disabled={isInFlight \|\| !canFix}` (line 190) | CLOSED |
| T-12-RESPONSIVE-DRIFT | Tampering | mobile branch divergence | LOW | mitigate | Both viewport branches consume identical `CoverageRow` shared type; test asserts all 4 column states render mobile | CLOSED |
| T-12-COLGROUP-REGRESSION | Tampering | Phase 11.1 colgroup invariant | HIGH | mitigate | Viewport branch early-returns before desktop JSX; Phase 11.1 `<colgroup>` assertion runs at 1024px (desktop branch) | CLOSED |

---

## Accepted Risks Log

| Threat ID | Rationale |
|-----------|-----------|
| T-12-IDEMPOTENT-FAIL | fix-path twice with same `{ id, newPath }` → same registry state. Intentional idempotent-PUT semantics. No confidentiality/integrity risk. |
| T-12-RETENTION-LEAK | Retention 14 → 90 days widens on-disk coverage state window. Mode 0o600 / dir 0o700; boot-time symlink-escape check still applies. ~750KB. Single-user machine; OS file perms protect at rest. |
| T-12-RACE-PRUNER | File unlinked between `readdirSync` and `readFileSync` is caught; day skipped. Worst case one missing day in the 90-day series. Matches Phase 11 precedent. |
| T-12-SCORE-OVERFLOW | ≤18,000 integer additions/call; within `Number.MAX_SAFE_INTEGER`; `Math.round` clamps 0-100. No realistic overflow surface. |
| T-12-DRIFT-SET-LEAK | `driftedRepoIds` ephemeral, per-request, never persisted/returned. Wire surface (`PathDriftEntrySchema`) scoped to IDs + paths already known to the authenticated caller. |
| T-12-MATCHMEDIA-LEAK | `useViewportBreakpoint` uses standard `window.matchMedia`; discloses no more than `window.innerWidth`. SPA-only. |
| T-12-SIDEBAR-INJECTION | Sidebar label/path are compile-time literals; no user input in rendering. No injection surface. |

---

## Informational Notes (non-blockers)

### NOTE-1 — Containment predicate asymmetry (corroborates code-review WR-01)
`registryPathDrift.ts:213-214` treats `canonical === root` as **healthy** (not drifted); `registryFixPath.ts:178` **forbids** an incoming `newPath` equal to a family root. The auditor assessed this asymmetry as **intentional and correct**: the read-side detector should not flag a path that (at registration time) equalled a family root, while the write surface — the security boundary — correctly refuses to *create* such a path. The reasoning is documented at registryFixPath.ts:174-176. No gap; the code review's WR-01 is downgraded to a consistency/readability nit (a shared `isInsideFamilyRoot` predicate would still be a clean refactor).

### NOTE-2 — Pre-lock TOCTOU window (corroborates code-review WR-05)
realpath/blocklist/containment (steps 3-5) run before `withRegistryLock` (begins line 204). A directory could theoretically be moved between containment check and mutation. Mitigating factors: (a) rate-limiter bounds the surface; (b) the attacker needs filesystem write at the validated canonical path — a stronger capability than the HTTP bearer token; (c) `atomicWriteFile` `O_NOFOLLOW` on the tmp file blocks symlink coercion. Below L1 acceptance threshold. Not a blocker.

---

## Threat Counts

- **In register:** 27 (plans 12-00 … 12-05) · **Closed:** 27 · **Open (blocker):** 0 · **Accepted:** 7

## Audit Trail

| Date | Event |
|------|-------|
| 2026-06-10 | Retrospective close-out audit (Phase 12 already shipped in v1.1). `register_authored_at_plan_time: true` → mitigation-verification mode. Verdict SECURED; 0 open. Corroborates code-review WR-01 (NOTE-1, intentional) + WR-05 (NOTE-2, below L1). |
