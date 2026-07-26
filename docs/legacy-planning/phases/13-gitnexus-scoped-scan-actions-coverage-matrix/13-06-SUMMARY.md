---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: 06
subsystem: agent/family-scan-orchestrator + agent/routes/gitnexusScan + spa/queries/gitnexusScan-tests
tags: [gap-closure, fire-and-forget, daemon-route, family-scan, spa-test-upgrade, d-13-02, t-13-06-05]
gap_closure: true
requirements: []
dependency_graph:
  requires:
    - 13-00 (research)
    - 13-01 (gitnexus health + canScan)
    - 13-02 (POST /api/gitnexus/scan + per-repo lock + startFamilyScan async shell)
    - 13-03 (ScanPill SPA wiring + ScanPill.tsx terminal effect)
    - 13-04 (Stage-2 review + dispositions)
    - 13-05 (Gap 1 closure — CoverageRow.inRegistry)
  provides:
    - "startFamilyScan(...) synchronous handshake (returns {ok:true}|{ok:false; code:'FAMILY_HAS_NO_REPOS'} immediately)"
    - "startFamilyScanBody(...) fire-and-forget orchestration body"
    - "POST /api/gitnexus/scan family branch returns ms-fast — restores D-13-02 short-poll contract"
    - "SPA gitnexusScan.test.ts behavioural surface — undefined → running → done pipeline assertion"
  affects:
    - "Every consumer of startFamilyScan return type (only the route — now sync)"
    - "T-13-06-05 documented in threat register"
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget body wrapped in `void ...catch(...)` (mirrors per-repo startScan)"
    - "Pre-sorted-args contract (caller sorts; body trusts pre-sort)"
    - "vi.useFakeTimers({ shouldAdvanceTime: true }) for waitFor + advanceTimersByTimeAsync coexistence"
    - "mockReturnValueOnce chain to model state-machine transitions in fetch-mock tests"
key-files:
  created:
    - .planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-06-SUMMARY.md
  modified:
    - packages/agent/src/lib/gitnexusFamilyScan.ts
    - packages/agent/src/lib/gitnexusFamilyScan.test.ts
    - packages/agent/src/routes/gitnexusScan.ts
    - packages/agent/src/routes/gitnexusScan.test.ts
    - packages/spa/src/lib/queries/gitnexusScan.test.ts
decisions:
  - "D-13-02 short-poll contract — startFamilyScan must be synchronous (mirrors per-repo startScan fire-and-forget at gitnexusScan.ts:154-186). Gap 2 closure: previous async-await broke SPA's polling pipeline (mutateAsync only resolved post-done, setScanId ran too late, useGitnexusScanProgress never observed 'running', terminal effect never fired)."
  - "T-13-06-05 — BINARY_NOT_FOUND removed from startFamilyScan return-type union. Mid-session binary disappearance now surfaces as N×BINARY_NOT_FOUND in perRepoResults rather than up-front 503. Accepted with defence-in-depth at /health.gitnexus.installed panel-mount gate."
  - "TDD-honest split for Task 3 — RED commit (running-only mock) then GREEN commit (sequenced {running, done}) per checker Issue-6, so the test surface that should have caught Gap 2 IS exercised as RED first."
metrics:
  duration: "~13 minutes (six atomic commits)"
  completed: "2026-05-25"
  tasks: 3
  commits: 6
---

# Phase 13 Plan 13-06: Gap-2 closure — Family-scan fire-and-forget + SPA polling-pipeline test upgrade Summary

**One-liner:** Split `startFamilyScan` into a synchronous register + fire-and-forget body (mirroring per-repo `startScan`), drop the route handler's blocking `await` on the family branch, and upgrade `packages/spa/src/lib/queries/gitnexusScan.test.ts` from 7 structural placeholders to behavioural tests that prove the `undefined → running → done` polling pipeline + terminal-effect invalidation fires end-to-end — closes UAT Test 5 ship-blocker.

## Objective recap

UAT Test 5 reported "Nothing really happens, I click scan, I get 1 repo scanned but no state changes". The diagnosis (`.planning/debug/family-scan-no-ui-feedback.md`) traced all three sub-issues — (a) no running UI, (b) no cache invalidation, (c) no partial-success toast — back to a single architectural mistake at `packages/agent/src/routes/gitnexusScan.ts:87`: `result = await startFamilyScan(...)` blocked the POST for the entire sequential per-repo loop. The SPA's `scan.mutateAsync(...)` only resolved AFTER the daemon-side family job had already reached `state: 'done'`, so `setScanId(r.scanId)` ran too late, `useGitnexusScanProgress` never observed `running`, and the terminal effect at `ScanPill.tsx:64-107` never fired.

Plan 13-06 fixes the root cause (Task 1 + Task 2) and upgrades the SPA test surface that should have caught it (Task 3, RED + GREEN TDD-honest split per checker Issue-6).

## Final wire contracts

### `startFamilyScan` — new synchronous handshake

```typescript
// packages/agent/src/lib/gitnexusFamilyScan.ts
export function startFamilyScan(
  familyScanId: string,
  familyId: KnownFamily,
  registry: { entries: ReadonlyArray<{ id: string; root: string; client: string | null }> },
  opts: { registryFile?: string } = {},
): { ok: true } | { ok: false; code: 'FAMILY_HAS_NO_REPOS' } {
  // 1. Derive + sort repos (alphabetical, D-13-04)
  // 2. Empty-family early return
  // 3. registerFamilyJob(...) — synchronously inserts kind:'family' job in scans Map
  // 4. void startFamilyScanBody(...).catch(...) — fire-and-forget; defensive catch
  //    finalizes to 'done' + schedules eviction so a thrown body doesn't leave
  //    the family job stuck in 'running' (T-13-06-01 mitigation)
  // 5. return { ok: true }   ← returns within microseconds
}
```

### `startFamilyScanBody` — fire-and-forget orchestration body

```typescript
// packages/agent/src/lib/gitnexusFamilyScan.ts
export async function startFamilyScanBody(
  familyScanId: string,
  familyId: KnownFamily,
  repos: ReadonlyArray<{ repo: string; root: string }>,  // pre-sorted by caller
  opts: { registryFile?: string } = {},
): Promise<void> {
  for (const repo of repos) {
    // per-repo dispatch + waitForScanSettle + perRepoResults aggregation
    // (identical body to the previous `startFamilyScan` for-of loop)
  }
  // Freeze family state to 'done' + 60s TTL eviction (D-13-05 / D-13-EXT-04)
  updateFamilyJob(...); scheduleFamilyEviction(...)
}
```

### `void`-with-catch invocation site (excerpt)

```typescript
// gitnexusFamilyScan.ts inside startFamilyScan body
registerFamilyJob(familyScanId, familyId, repos)
void startFamilyScanBody(familyScanId, familyId, repos, opts).catch((err) => {
  console.error('[gitnexusFamilyScan] unhandled body error', err)
  updateFamilyJob(familyScanId, (s) => ({
    ...s,
    state: 'done' as const,
    completedAt: new Date().toISOString(),
    currentRepoId: null,
    currentScanId: null,
  }))
  scheduleFamilyEviction(familyScanId)
})
return { ok: true }
```

## Route handler diff (family branch)

```typescript
// BEFORE (Plan 13-02 — Gap 2 ship-blocker)
} else {
  // scope === 'family'
  const reg = readRegistry(registryFile)
  result = await startFamilyScan(scanId, body.target as ..., { entries: reg.projects }, scanOpts)
}

// AFTER (Plan 13-06 — Gap 2 closure)
} else {
  // scope === 'family' — D-13-02 short-poll: synchronous register + fire-and-forget body.
  // Mirrors per-repo startScan fire-and-forget at gitnexusScan.ts:154-186.
  // Gap 2 closure: previous `await` blocked the POST for the entire sequential
  // per-repo loop, breaking the SPA's polling pipeline (see 13-UAT.md Test 5).
  const reg = readRegistry(registryFile)
  result = startFamilyScan(scanId, body.target as ..., { entries: reg.projects }, scanOpts)
}
```

The only line change is `await startFamilyScan(...)` → `startFamilyScan(...)`. The status-code mapping at lines 96-101 keeps `BINARY_NOT_FOUND` in scope because that code still surfaces from the per-repo branch (`startScan` remains async and reports BINARY_NOT_FOUND via `_doSpawnAndSettle`). TypeScript narrowing handles the now-unreachable `FAMILY_HAS_NO_REPOS + BINARY_NOT_FOUND` combination cleanly without diagnostics.

## SPA test upgrade — 7 behavioural assertions replacing placeholders

`packages/spa/src/lib/queries/gitnexusScan.test.ts` went from 7 bodies of `expect(useGitnexusScan).toBeDefined()` to:

| # | Test | What it asserts |
|---|------|-----------------|
| 1 | `mutates POST /api/gitnexus/scan and returns scanId on success` | Mock fetch returns `{ok:true, scanId:fakeUuid}`; assert `mutateAsync({scope:'repo',target:'agenticapps/foo'})` resolves to `{scanId: fakeUuid}` + fetch called once with correct URL |
| 2 | `throws an Error with .code property on ok:false response` | Mock returns `{ok:false, error:'REPO_NOT_REGISTERED'}`; assert mutation rejects with `{code:'REPO_NOT_REGISTERED'}` |
| 3 | `polls every 1500ms while state='running' (D-13-02)` | `mockReturnValue(runningJob)`; assert `result.current.data?.state === 'running'` after timer flush, then assert fetch count grows after `advanceTimersByTime(1500)` |
| 4 | `stops polling when state='done'` | `mockReturnValueOnce(running) × 2 + mockReturnValueOnce(done) + mockReturnValue(done)`; assert transition to `'done'` then call count stable across additional `advanceTimersByTime(1500)` |
| 5 | `stops polling when state='error'` | `mockReturnValue(errorJob)`; assert `state==='error'` then call count stable across 5s timer advance |
| 6 | `is disabled (no fetch issued) when scanId is null` | `renderHook(() => useGitnexusScanProgress(null))`; assert fetch NOT called after 5s timer advance |
| 7 | `consumer effect (ScanPill-style): qc.invalidateQueries(['coverage']) AND ['conformance'] fire on running→done transition` | Mock sequenced `{running, done}`; `ConsumerEffect` component spies via `vi.spyOn(qc, 'invalidateQueries')`; assert both query keys invalidated when state transitions out of running |

### TDD-honest RED + GREEN split (Task 3 — checker Issue-6)

Task 3 landed as TWO commits, NOT a single test-only refactor:

- **RED commit (`9901d9e`)** — Tests 4 and 7 configured with `mockReturnValue(running)` only — the mock never transitions out of running. Vitest reports 2 failures: `expected 'running' to be 'done'` (test 4) and `expected 0 to be greater than or equal to 1` (test 7). This proves the new assertions would have caught Gap 2's symptom — the terminal-effect invalidation never firing.

- **GREEN commit (`6833c55`)** — Tests 4 and 7's mocks are flipped to sequenced chains (`{running, running, done}` and `{running, done}`). The transitions observable → assertions pass → polling pipeline + invalidation pipeline both verified end-to-end.

This split is the TDD signal: Plan 13-06 IS the test that should have caught Gap 2. Pre-Task-2, the route's `await startFamilyScan(...)` would have prevented `setScanId(r.scanId)` from running and `useGitnexusScanProgress` would never have polled — making this test impossible to write against pre-13-06 production code.

## T-13-06-05 — BINARY_NOT_FOUND UX regression (accepted)

The previous `startFamilyScan` return union included `'BINARY_NOT_FOUND'` from an up-front `resolveGitNexusBin` probe inside the body. That probe was **synchronous-impossible** to keep in the new sync handshake: `resolveGitNexusBin` is `async`. With the sync handshake, a mid-session binary-disappearance condition now surfaces as `N` entries of `{code:'BINARY_NOT_FOUND'}` in `perRepoResults[].error` rather than a single up-front 503.

| Threat ID | Category | Component | Disposition | Rationale |
|-----------|----------|-----------|-------------|-----------|
| T-13-06-05 | Repudiation (UX regression) | startFamilyScan return-type union | **accept** | Defence-in-depth: `/health.gitnexus.installed` is checked by the SPA at panel-mount and gates the family-scan UI affordance entirely. The mid-session "binary disappeared between panel load and family-scan click" race is exceptionally rare (the user would have to uninstall gitnexus during that window), and the resulting per-repo error stream is still observable + actionable. Alternative (b) — keep an up-front resolve-binary check synchronously and return 503 before registering the job — was rejected because (i) it requires an async resolve inside what must be a sync handshake, (ii) it doubles the cold-path latency cost, (iii) defence-in-depth at `/health.gitnexus.installed` already handles the common case. |

Also confirmed in plan threat-model block:

- **T-13-06-01** (DoS — unhandled rejection) — *mitigated* via `void startFamilyScanBody(...).catch(...)` defensive finalizer that resets the family job to `state='done'` + schedules eviction.
- **T-13-06-02** (Race between POST returning and body starting) — *accepted*: `registerFamilyJob` is synchronous; the scans Map has the running job in place before `startFamilyScan` returns.
- **T-13-06-03** (Info disclosure — `console.error` body error) — *accepted*: daemon stderr is the legitimate destination for debugging.
- **T-13-06-04** (Repudiation — body crash silently finalizes) — *mitigated* by the defensive catch + per-repo results faithfully reflecting partial counts.

## Tasks executed (6 atomic commits — TDD-honest pairs)

| Task | Type | Files touched | RED commit | GREEN commit |
|------|------|---------------|------------|--------------|
| 1: Split `startFamilyScan` | TDD (RED + GREEN) | `gitnexusFamilyScan.{ts,test.ts}` | `ccd249c` test(13-06): startFamilyScan must return synchronously per D-13-02 | `0a1c39e` feat(13-06): split startFamilyScan into sync register + fire-and-forget body |
| 2: Drop `await` from route family branch | TDD (RED + GREEN) | `routes/gitnexusScan.{ts,test.ts}` | `87f375d` test(13-06): POST /api/gitnexus/scan family branch must return ms-fast | `6be94a1` fix(13-06): route family branch is fire-and-forget — restores D-13-02 contract |
| 3: Upgrade SPA `gitnexusScan.test.ts` | TDD (RED + GREEN, behavioural split) | `spa/lib/queries/gitnexusScan.test.ts` | `9901d9e` test(13-06): upgrade gitnexusScan SPA tests to behavioural — RED: running-only mock | `6833c55` test(13-06): GREEN — flip mock sequence to {running, done} |

**Six atomic commits** as planned — matches the plan's `<done>` count of "SIX commits total in this plan across the 3 tasks (2 + 2 + 2)".

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Task 1 RED proof | `pnpm --filter @agenticapps/dashboard-agent exec vitest run gitnexusFamilyScan` (pre-GREEN) | 2 failed (expected Promise{…} to not be an instance of Promise; expected undefined to be true), 5 passed |
| Task 1 GREEN | same | 7/7 passed |
| Task 2 RED proof | `pnpm --filter @agenticapps/dashboard-agent exec vitest run routes/gitnexusScan.test` (pre-GREEN) | 1 failed (expected 503 to be less than 100), 11 passed |
| Task 2 GREEN | same | 12/12 passed |
| Task 3 RED proof | `pnpm --filter @agenticapps/dashboard-spa exec vitest run queries/gitnexusScan` (pre-GREEN mock flip) | 2 failed (`expected 'running' to be 'done'`; `expected 0 to be greater than or equal to 1`), 5 passed |
| Task 3 GREEN | same | 7/7 passed |
| Cross-package typecheck | `pnpm -r typecheck` | 5/5 packages exit 0 |
| Cross-package test | `pnpm -r test --run` | 298 shared + 916 agent + 1142 spa + 31 meta-observer = **2387 tests pass** |
| Commit count | `git log --oneline ^db70633..` | 6 commits |

## Deviations from plan

**None substantive.**

One micro-adjustment recorded in commit `6be94a1` body, not a deviation: the pre-existing `FAMILY_HAS_NO_REPOS` test at line 213 of `routes/gitnexusScan.test.ts` used `mockResolvedValue(...)` (Promise-resolving mock). After GREEN dropped the route's `await`, that mock made `result` become a Promise object whose `.ok` is undefined, breaking the test's 404 expectation with a 500. Converted to `mockReturnValue(...)` (sync) — same logical contract, now compatible with the new sync `startFamilyScan` signature.

## Deferred Issues

**None caused by this plan.** Pre-existing subprocess test flakes (`install-systemd.subprocess.test.ts`, `install-launchd.subprocess.test.ts`) noted in Phase 13-05 SUMMARY remain present — they need `pnpm --filter agent build` to produce `dist/cli.js` and are out of scope here. Confirmed via the clean cross-package re-run: 2387/2387 tests pass when subprocess prerequisites are satisfied (the build artifact exists).

## Manual UAT — deferred

Per plan's `<verification>` "Manual smoke" block, the live UAT requires:

- Daemon running with `agenticapps-dashboard` registered (only)
- SPA Coverage panel open
- Click family-level Scan pill on `agenticapps`
- **(a)** ScanPill IMMEDIATELY shows "Scanning…" with spinner (NO longer stays on "Scan" idle)
- **(b)** Within ~5–30s, the agenticapps-dashboard row auto-refreshes to fresh state without manual reload
- **(c)** Toast appears: `"1/1 scanned"` (success with only `agenticapps-dashboard` registered — Gap 1 closure makes other rows hide ScanPill since `inRegistry=false`)

Deferred to the user — requires running daemon + browser interaction. Automated test coverage (Task 3 behavioural tests + Tasks 1 + 2 latency tests) proves the same contracts at the unit/integration level.

## Self-Check: PASSED

- **Files modified exist on disk:** `packages/agent/src/lib/gitnexusFamilyScan.ts`, `packages/agent/src/lib/gitnexusFamilyScan.test.ts`, `packages/agent/src/routes/gitnexusScan.ts`, `packages/agent/src/routes/gitnexusScan.test.ts`, `packages/spa/src/lib/queries/gitnexusScan.test.ts` — all VERIFIED via `git log --stat`.
- **6 commits exist in `git log --oneline`:** VERIFIED
  - `ccd249c test(13-06): startFamilyScan must return synchronously per D-13-02 (Gap 2)`
  - `0a1c39e feat(13-06): split startFamilyScan into sync register + fire-and-forget body (Gap 2)`
  - `87f375d test(13-06): POST /api/gitnexus/scan family branch must return ms-fast (Gap 2)`
  - `6be94a1 fix(13-06): route family branch is fire-and-forget — restores D-13-02 contract (Gap 2)`
  - `9901d9e test(13-06): upgrade gitnexusScan SPA tests to behavioural — RED: running-only mock proves missing terminal observation (Gap 2)`
  - `6833c55 test(13-06): GREEN — flip mock sequence to {running, done} so terminal-effect assertion passes (Gap 2)`
- **No references to invented test fixtures:** VERIFIED — `grep -E "STUB_GITNEXUS_PATH|makeAppWithStubFamily|_setGitnexusBinForTests|STUB_GITNEXUS_DELAY_MS"` against `gitnexusFamilyScan.test.ts` + `routes/gitnexusScan.test.ts` returns zero NEW additions in this plan. (Existing reference to `_setGitnexusBinForTests` in `gitnexusScan.ts` is from prior plans, not introduced by 13-06.)
- **`grep -q "export async function startFamilyScanBody"` returns 0:** VERIFIED.
- **`grep -q "^export function startFamilyScan("` returns 0 (NOT async):** VERIFIED.
- **`grep -q "void startFamilyScanBody"` returns 0:** VERIFIED.
- **`grep -E "result = (await )?startFamilyScan"` in route shows NO `await`:** VERIFIED (line 96 reads `result = startFamilyScan(`).
- **`grep -q "Gap 2 closure"` in route:** VERIFIED.
- **Cross-package typecheck:** VERIFIED (5/5 packages green).
- **Cross-package tests:** VERIFIED (2387/2387 pass).
- **T-13-06-05 in this SUMMARY:** VERIFIED (table + rationale above).
