# Phase 13: GitNexus scoped scan actions (Coverage matrix)

**Archived from GSD phase `13-gitnexus-scoped-scan-actions-coverage-matrix`. Completed 2026-06-10.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/` — that tree, not this file, is the authoritative record.

## Why

Replace the clipboard-only page-header `IndexGitNexusButton` on the Coverage matrix with **scoped daemon-driven scan actions** — per-family in each section header bar, per-repo in the GitNexus column cell of any row whose status is not `present`. Daemon spawns `gitnexus analyze` as a subprocess, returns a scan job id, and the SPA short-polls until done. Coverage data auto-invalidates on success so cells flip from ✗ → ✓ without user action.

The clipboard-fallback CTA pattern (`InstallGitNexusButton`) remains for the binary-not-installed state — Phase 13 does not delete that flow, only the page-header `IndexGitNexusButton` which is being removed (D-13-06).

**Bounded by:** v1.3.0 release. Parallel family scans, scan-all-families action, scan over Tailscale, cancelable scans, streaming gitnexus stderr to the UI, scan scheduling — all deferred (see Deferred Ideas below).

## Capabilities affected

- `openspec/specs/code-intelligence/spec.md`

## What shipped

**13-00**

**One-liner:** `GitnexusIndexCommand { string, argv }` + 4 Zod schemas (11-code enum, discriminated-union request/response/progress) + POSIX stub binaries + 36 RED scaffold tests covering all Wave 1-3 module surfaces.

**13-01**

### Task 1: bindMode plumbing

- **Exported `BindMode` type** (`'loopback' | 'tailscale' | '0.0.0.0'`) from `packages/agent/src/server/app.ts` — downstream waves import it from here.
- **Extended `Env.Variables`** with `bindMode: BindMode` (required — every request carries it; default is set in middleware closure, never from HTTP input).
- **Extended `CreateAppOptions`** with `bindMode?: BindMode` (optional, defaults to `'loopback'` — safest mode per T-13-01-01).
- **Middleware closure** now calls `c.set('bindMode', bindMode)` immediately after `c.set('requestId', ...)`, before the conditional

**13-02**

### Task 1 — `lib/gitnexusScan.ts`

Core scan state module:
- `scans: Map<string, ScanJob>` — in-memory registry of all active + recently-settled jobs
- `perRepoLocks: Map<string, Promise<void>>` — per-repo concurrency gate (D-13-03, → 409 SCAN_IN_FLIGHT)
- `globalScanLock: Promise<void> | null` — global single-writer lock (D-13-EXT-01) preventing concurrent `gitnexus analyze` subprocesses from racing on `~/.gitnexus/registry.json`
- `withGlobalScanLock<T>(fn)` — while-loop pattern (not single await) handles simultaneous wakeups
- `startScan(scanId, req, opts?)` — registers job, fires spawn, r

**13-03**

SPA half of Phase 13: TanStack Query hooks for gitnexus scan POST + polling, a ScanPill primitive with 4 rendered states, per-row and per-family wiring, deletion of IndexGitNexusButton per D-13-06.

**13-05**

**One-liner:** Add required `inRegistry: boolean` to `CoverageRowSchema`, populate it daemon-side via single-read registry intersection, and gate `ScanPill` render on `row.inRegistry === true` — closes UAT Test 4 ship-blocker where unregistered rows showed a Scan affordance that produced an unrecoverable `REPO_NOT_REGISTERED` toast on click.

**13-06**

**One-liner:** Split `startFamilyScan` into a synchronous register + fire-and-forget body (mirroring per-repo `startScan`), drop the route handler's blocking `await` on the family branch, and upgrade `packages/spa/src/lib/queries/gitnexusScan.test.ts` from 7 structural placeholders to behavioural tests that prove the `undefined → running → done` polling pipeline + terminal-effect invalidation fires end-to-end — closes UAT Test 5 ship-blocker.

**13-07**

**One-liner:** Phase-13-05's Option A (gate ScanPill on `row.inRegistry`) closed the original toast but made the feature unusable. D-13-EXT-08 implements Option D (the hybrid): drop the SPA gate, add a deterministic filesystem fallback in the daemon, and await the coverage refetch in the SPA terminal effect so "Scanning…" stays visible until the row data is fresh.

**13-08**

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08
**Outcome:** All 9 Codex findings closed. PR #52 ready to merge pending Codex re-review.

## Gates recorded

- verification — `13-08-VERIFICATION.md`
- verification — `13-VERIFICATION.md`
- code review — `13-08-REVIEW.md`
- code review — `13-REVIEW.md`
- security audit — `13-08-SECURITY.md`
- security audit — `13-CSO.md`
- design critique — `13-IMPECCABLE.md`
- UAT — `13-UAT.md`
- validation — `13-VALIDATION.md`
