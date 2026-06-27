# Debug Session — family-scan-no-ui-feedback

**Date:** 2026-05-25
**Source:** UAT Test 5 (phase 13)
**Status:** root cause found
**Agent:** gsd-debugger (af0087da4ac1510df)

## Symptom (verbatim from user)

> Nothing really happens, I click scan, I get 1 repo scanned but no state changes, but after reload the first repo was scanned, afterwards nothing happens anymore.

Three distinct sub-issues:
- (a) ScanPill stays in idle "Scan" state during the scan — no running spinner / progress affordance.
- (b) The row that succeeded (`agenticapps-dashboard`) doesn't auto-update; only a manual reload reveals "0d ago" fresh state.
- (c) The partial-success informational toast (`completed/failed/total`) never appears.

## Shared root cause

**Single architectural mistake — all three sub-issues collapse onto it.**

The daemon's POST `/api/gitnexus/scan` family branch (`packages/agent/src/routes/gitnexusScan.ts:87`) `await`s `startFamilyScan(...)` for the entire sequential per-repo loop before returning the scanId. This breaks the **D-13-02 short-poll contract** that the SPA was built against.

Per-repo scans use the correct fire-and-forget pattern (`packages/agent/src/lib/gitnexusScan.ts:170` — `startScan` mints the job, kicks off `_doSpawnAndSettle(...)`, sets the per-repo lock, returns `{ok:true}` immediately). This is why per-row scans worked end-to-end in earlier UAT steps.

The family variant must be rewritten to follow the same pattern.

## Sub-issue (a) — No running UI state

**Mechanism:** The family POST handler awaits the entire sequential loop, so the SPA's `scan.mutateAsync(...)` only resolves AFTER the daemon-side job has already reached `state: 'done'`. `setScanId(r.scanId)` therefore runs after the scan is over, and `isPending = scanId !== null && (...)` (`ScanPill.tsx:131-132`) is `false` for the entire duration the user is watching. The idle "Scan" button stays mounted because polling is structurally unable to ever observe a `running` state.

**Fix direction:** Make the family handler honor the same fire-and-forget contract as per-repo `startScan` — split `startFamilyScan` into a synchronous `registerFamilyJob(...)` (already exported, currently called from inside the awaited helper) plus a fire-and-forget body. The route calls register-then-return immediately with the freshly minted scanId; the orchestration loop runs in the background (`void startFamilyScanBody(...)`). POST returns within milliseconds, SPA polls and observes `running` → `done`.

## Sub-issue (b) — No cache invalidation / manual reload required

**Mechanism:** The terminal `useEffect` at `ScanPill.tsx:64-107` correctly wires `qc.invalidateQueries({queryKey:['coverage']})` + `['conformance']` on the `progress.data?.state` transition out of `'running'` — but the effect can only fire AFTER `setScanId(uuid)` runs, which itself requires `mutateAsync` to resolve. Because the family POST blocks for the entire sequential scan (root cause of (a)), the long-running `fetch` is exposed to browser/dev-server/proxy connection-liveness timeouts before the daemon finishes. If the connection drops, `mutateAsync` rejects, `setScanId` never runs, the progress query never enables, and the invalidation effect never fires. Exactly the user's "after reload the first repo was scanned" symptom — daemon's work is persisted, but the SPA never received the resolution that would have triggered invalidation.

**Fix direction:** Free once (a) is fixed. With a fire-and-forget POST that returns within milliseconds, `setScanId` runs immediately, the progress query enables, polling observes `running` then `done`, the effect fires on the `done` transition, `invalidateQueries(['coverage'])` runs, `useCoverage`'s `queryKey:['coverage']` (`packages/spa/src/lib/coverageQueries.ts:34`) refetches, row flips to fresh. No additional SPA code change required.

## Sub-issue (c) — No partial-success toast

**Mechanism:** Same as (b). The family-branch of the terminal `useEffect` at `ScanPill.tsx:82-104` correctly derives `{completed, failed, total}` from the family job and calls `toast.show({...})` — the logic is structurally fine, but the effect never runs because `progress.data` never becomes available, because `setScanId` never runs, because the awaited POST didn't resolve.

**Fix direction:** Free once (a) is fixed. Independent hardening to consider: widen the effect's dependency to include `progress.isError` and add a fallback toast in the `mutateAsync` rejection path so users see an error message when the POST itself fails. (Today the `catch(err)` in onClick at line 154-160 does call `toast.show({variant:'error',...})` — but only if `mutateAsync` actually rejects rather than hanging.)

## Files involved

- `packages/agent/src/routes/gitnexusScan.ts:87` — `result = await startFamilyScan(...)` blocks the POST handler for the entire sequential per-repo loop. Family branch should mirror per-repo branch's fire-and-forget shape.
- `packages/agent/src/lib/gitnexusFamilyScan.ts:55-147` — `startFamilyScan` returns only after the for-of loop awaits every per-repo `waitForScanSettle`. Needs to be split: synchronous `registerFamilyJob(...)` + `void` body that performs the loop and finalizes the family job state.
- `packages/agent/src/lib/gitnexusScan.ts:154-170` — reference implementation of the fire-and-forget pattern for per-repo `startScan`.
- `packages/spa/src/components/panels/coverage/ScanPill.tsx:131-167` — SPA-side polling and effect logic is correct in isolation; no change required once daemon-side fire-and-forget is restored. Terminal effect correctly invalidates `['coverage']` + `['conformance']` and differentiates `failed===0` vs `failed>0` for toast variants.
- `packages/spa/src/lib/queries/gitnexusScan.test.ts` — Wave 0 tests are structural placeholders (`expect(useGitnexusScan).toBeDefined()`), not behavioral. The polling/invalidation pipeline was never exercised end-to-end, which is why this regression escaped to UAT. Tests should be upgraded alongside the fix to mock fetch and assert the actual `undefined → running → done` transition exercises the effect once.
