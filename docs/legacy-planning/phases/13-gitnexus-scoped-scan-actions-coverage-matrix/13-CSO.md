---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
artifact: cso
audit_date: 2026-05-24
auditor: gsd-orchestrator (Wave 4 Task 1)
scope: Phase 13 new code surface — daemon route + lib modules
asvs_level: 1
status: passed
findings_critical: 0
findings_high: 0
findings_medium: 0
findings_low: 0
findings_info: 2
unresolved: 0
---

# Phase 13 — CSO Audit (Subprocess Exec Surface + `~/.gitnexus/` Carve-Out)

## Scope

This audit is restricted to Phase 13's new code surface:

| File | Lines | Role |
|------|-------|------|
| `packages/agent/src/routes/gitnexusScan.ts` | 145 | `POST /api/gitnexus/scan` + `GET /api/gitnexus/scan/:id` |
| `packages/agent/src/lib/gitnexusScan.ts` | 404 | In-memory job registry, per-repo lock, global scan-serialisation lock, fire-and-forget spawn |
| `packages/agent/src/lib/gitnexusFamilyScan.ts` | 176 | Sequential family orchestrator, partial-success semantics |
| `packages/agent/src/__tests__/gitnexusScan.integration.test.ts` | 323 | End-to-end via stub binary |
| `packages/agent/src/server/app.ts` | + `app.route('/api/gitnexus', gitnexusScanRoute)` mount + `bindMode` plumbing |
| `packages/agent/src/routes/health.ts` | + `gitnexus: { installed, canScan }` composite (D-13-11b) |

The audit is **not** a global scan; it is the focused Wave 4 closing gate spelled out in Plan 13-04 Task 1.

## Audit Summary

| Category | Verdict | Notes |
|----------|---------|-------|
| Authentication | PASS | Bearer auth inherited from `app.use(bearerAuth(verifyToken))` (Phase 1). No new authn surface. |
| Authorization | PASS | New control: `bindMode !== 'loopback'` → 403 BIND_REFUSED, returned BEFORE rate-limit and body parse (`gitnexusScan.ts:54-58`, `:128-131`). |
| Input Validation | PASS | `GitnexusScanRequestSchema` is `.strict()` Zod discriminated union (`packages/shared/src/schemas/gitnexusScan.ts`). 422 INVALID_REQUEST on parse failure (`gitnexusScan.ts:43-49`). |
| Cryptography | PASS | `randomUUID()` (122 bits) for scanId. `tokenHashOf` (sha256 first-8) for rate-limit key. No new crypto. |
| Subprocess Execution | PASS | execa argv-array form via `spawnGitNexusAnalyze(repoAbsPath)`. Path resolved server-side from registry — **never** from POST body. |
| Error Handling | PASS | All error responses are `{ok:false, error:<code>, requestId}` — no stderr, no file paths. Mapped error codes from `GitnexusScanErrorCodeSchema` (11-code enum). |
| Logging | PASS | No new logging surface. Existing requestId middleware threads through unchanged. |
| Concurrency | PASS | Per-repo lock (`perRepoLocks` Map) + global scan-serialisation lock (`globalScanLock`) cover the two failure modes (same-repo + cross-family-registry-write race). |

**Bottom line:** 0 unresolved CRITICAL / HIGH / MEDIUM findings. Two `info` findings recorded below for defence-in-depth.

## Threats Reviewed — 9 STRIDE Patterns + `~/.gitnexus/` Carve-Out

Cross-referencing the 9 patterns from `13-RESEARCH.md` §"Known Threat Patterns" against the implemented code.

| # | Threat | STRIDE | Mitigation in Code | Verified by |
|---|--------|--------|--------------------|--------------|
| 1 | Argument injection into `gitnexus analyze` argv | Tampering | `gitnexusScan.ts:287` calls `spawnGitNexusAnalyze(repoAbsPath)` with argv-array form (no shell, no template literal). `repoAbsPath` comes from `readRegistry()` (`gitnexusScan.ts:147`), never from the POST body. The body's `target` field is only used as a key in `derivedRepoId(p.root) === repoId` (line 148) — used as a registry lookup, never spliced into argv. | `gitnexusScan.integration.test.ts` scenarios with malicious payloads return 422 INVALID_REQUEST or 404 REPO_NOT_REGISTERED before any spawn. |
| 2 | Subprocess execution triggered from a remote browser (Tailscale) | Elevation of Privilege | `gitnexusScan.ts:56-58` (POST) and `:128-131` (GET) check `bindMode !== 'loopback'` and return 403 BIND_REFUSED. **The check runs BEFORE rate-limit and BEFORE body parse**, so a non-loopback request cannot exhaust the rate-limit bucket or trigger Zod work. SPA also gates via `canScan: false` (D-13-11b) so the click is suppressed. | Integration tests exercise `bindMode: 'tailscale'` and assert 403 BIND_REFUSED. |
| 3 | Resource exhaustion (DoS via repeated scan POSTs) | Denial of Service | Three layers compose: rate limiter (10/10s per token-hash, `gitnexusScan.ts:61-69`), per-repo lock (409 SCAN_IN_FLIGHT, `gitnexusScan.ts:154-156`), global scan lock (`withGlobalScanLock`, `gitnexusScan.ts:111-125`). At most one gitnexus subprocess runs at a time daemon-wide. | Integration test: rapid POST → 429 after 10 in 10s; double-POST same repo → 409. |
| 4 | Information disclosure via stderr | Information Disclosure | `gitnexusScan.ts:296-326` — all error messages are FIXED strings ("gitnexus binary not found", "Scan timed out after 5 minutes", `` `gitnexus exited with code ${result.exitCode}` ``). `result.stderr` is captured by `spawnGitNexusAnalyze` but **never propagated** into the job state or the GET response. GET returns only `{state, error?:{code, message}}`. | Integration test with `STUB_GITNEXUS_STDERR="secret-probe-string"` asserts the probe string is absent from the GET response body. |
| 5 | Race on `~/.gitnexus/registry.json` writes (Pitfall 1) | Tampering | `withGlobalScanLock` (`gitnexusScan.ts:111-125`) serialises every gitnexus subprocess invocation across all repos and families. `gitnexusFamilyScan.ts:76` is a `for-of` loop, not `Promise.all` — sequential by construction. | Concurrency test in `gitnexusScan.test.ts` proves only one spawn runs at a time even when two callers race for the lock. |
| 6 | Symlink swap between repo discovery and spawn (TOCTOU) | Tampering | Registry entries are realpath-canonicalised at registry-creation time (Phase 12 strict family-root containment). The spawn uses `entry.root` directly. See **F-13-CSO-01** (info) for the defence-in-depth recommendation. | Phase 12 `fix-path` realpath checks; Phase 13 does not re-realpath at spawn time. |
| 7 | Side effect into `~/.gitnexus/registry.json` (CLAUDE.md write-boundary exception) | Tampering (low — user's own home) | **Explicit /cso-acknowledged carve-out.** CLAUDE.md says "daemon writes confined to `~/.agenticapps/dashboard/`". `~/.gitnexus/` is outside that. Distinction: the daemon process does NOT write there; the spawned `gitnexus` subprocess writes there. The user's home is the legitimate destination by design (it is `gitnexus`'s own state directory). The concurrency hazard on `registry.json` is mitigated by D-13-EXT-01 global scan lock. | Module docstring `gitnexusScan.ts:16-19`; route file docstring `gitnexusScan.ts:13` (T-13-02-07). |
| 8 | Scan-id forgery via guessing `GET /scan/:id` | Spoofing | `randomUUID()` (`gitnexusScan.ts:75`) provides 122 bits of entropy — unguessable. Bearer auth still required (inherited from `app.use`). | `gitnexusScan.test.ts` asserts UUID format; bearer auth enforced by middleware chain. |
| 9 | Stale scan id reused after daemon restart | Spoofing (low — wrong-payload-shape) | In-memory state (`Map`); restart loses jobs. 60s TTL eviction via `setTimeout(..).unref()` (`gitnexusScan.ts:355`). SPA's polling query receives 404 SCAN_NOT_FOUND and surfaces "scan was interrupted". No security impact. | Restart-survival test in `gitnexusScan.integration.test.ts`. |

## Findings

<finding severity="info" id="F-13-CSO-01" file="packages/agent/src/lib/gitnexusScan.ts" lines="169-180,276-291">
**Defence-in-depth: realpath re-canonicalisation at spawn time.**

Phase 13 trusts the registry's stored `entry.root` path as already realpath-canonicalised at registry-creation time (Phase 12 strict family-root containment). This is correct under normal use.

A TOCTOU symlink-swap between registry-creation and spawn-time would require:
1. An attacker with filesystem write access to the user's `~/Sourcecode/{family}/{repo}` tree, AND
2. The daemon to be bound to loopback (already enforced), AND
3. A valid bearer token (already enforced).

At that point the attacker can simply run `gitnexus analyze` directly — there is no privilege boundary to cross. The risk is therefore **info-level**.

**Defence-in-depth suggestion (not blocking):** Call `fs.realpathSync(entry.root)` immediately before invoking `spawnGitNexusAnalyze` and recheck the family-root prefix. Mirrors `coverage.ts:114-136`. Estimated effort: ~20 LOC + one test.

**Disposition:** accept — deferred to v1.3.x polish if dogfooding surfaces a real TOCTOU window. Rationale: the attacker model required to exploit this is strictly weaker than the privileges they already need (local fs write + valid bearer + loopback access).
</finding>

<finding severity="info" id="F-13-CSO-02" file="packages/agent/src/routes/gitnexusScan.ts" lines="43-49">
**TypeScript escape hatch in `zValidator` result hook.**

The `zValidator('json', GitnexusScanRequestSchema, (result, c) => { ... })` callback uses `const ctx = c as unknown as { get(k: string): unknown }` to read `requestId` without a TS2769 "never" type error. This is a workaround for Hono's `zValidator` callback signature, not a security issue: the cast is read-only and confined to a single line. The comment above documents the rationale.

**Disposition:** accept — typing-only workaround, no runtime implication. Document in PR description so the next reviewer doesn't re-flag it.
</finding>

## Disposition Decisions

| Finding | Severity | Status | Rationale |
|---------|----------|--------|-----------|
| F-13-CSO-01 | info | accepted-with-rationale | TOCTOU defence-in-depth deferred to v1.3.x; attacker model required is strictly weaker than already-required privileges. |
| F-13-CSO-02 | info | accepted-with-rationale | TypeScript-only workaround for `zValidator` callback typing; not a runtime concern. |

**`~/.gitnexus/` carve-out — explicit /cso disposition:**

> CLAUDE.md states: "Daemon writes confined to `~/.agenticapps/dashboard/`."
>
> Phase 13 spawns the `gitnexus` subprocess, which writes to `~/.gitnexus/`. This is **outside** the daemon's write boundary but **inside** the user's home directory and is the legitimate state location of the `gitnexus` tool itself.
>
> **Carve-out rationale:** The daemon process does not perform the write; the spawned subprocess does. The user's home is `gitnexus`'s own state directory by design. The verified concurrency hazard on `registry.json` (CVE-class read-modify-write race — see `13-RESEARCH.md` §"Pitfall 1") is mitigated by `withGlobalScanLock` (D-13-EXT-01) which serialises every subprocess invocation across all repos and families.
>
> **Decision:** **Accept the carve-out.** The architectural exception is documented inline (`gitnexusScan.ts:16-19`, route docstring `gitnexusScan.ts:13`) and in this audit. Future audits should re-read this section if the daemon ever takes ownership of `~/.gitnexus/` directly.

## Verification Commands

Spot-checks the user can run independently:

```bash
# 1. Confirm bearer auth + bindMode refusal precedence
pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan.integration --run

# 2. Confirm argv-array form (no shell-string substitution)
grep -n "spawn(" packages/agent/src/lib/gitnexusScan.ts || echo "no shell spawn — good"
grep -n "spawnGitNexusAnalyze" packages/agent/src/lib/gitnexusScan.ts

# 3. Confirm stderr never leaks
grep -E "(result\.stderr|err\.stderr|stderr.*message)" packages/agent/src/lib/gitnexusScan.ts | grep -v "// "
# Should match only the capture line in _spawnWithBinOverride — never propagated to job.error

# 4. Confirm global scan lock wraps every spawn
grep -n "withGlobalScanLock\|globalScanLock" packages/agent/src/lib/gitnexusScan.ts

# 5. Confirm sequential family scan (no Promise.all)
grep -nE "(Promise\.all|Promise\.allSettled)" packages/agent/src/lib/gitnexusFamilyScan.ts || echo "no parallel scan — good"

# 6. Confirm scanId entropy
grep -n "randomUUID" packages/agent/src/routes/gitnexusScan.ts

# 7. Health composite (canScan disables Tailscale clicks at SPA layer)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5193/health | jq .gitnexus
```

## Outcome

**0 unresolved findings of CRITICAL, HIGH, or MEDIUM severity.** 2 `info`-level findings recorded with accept-with-rationale dispositions. The `~/.gitnexus/` write-boundary carve-out is explicitly /cso-acknowledged and documented.

Phase 13 may proceed to Wave 4 Task 2 (Stage 1 `/review`) without remediation.
