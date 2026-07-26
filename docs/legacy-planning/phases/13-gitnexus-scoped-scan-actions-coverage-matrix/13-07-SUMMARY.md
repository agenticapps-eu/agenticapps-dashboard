---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: "07"
subsystem: shared+agent+spa
tags: [gap-closure, regression-fix, scan-pill, deterministic-resolver, D-13-EXT-08, ux-polish]
type: regression_fix
gap_closure: true
supersedes: [D-13-EXT-07]
dependency_graph:
  requires: [13-05, 13-06]
  provides: [deterministic ~/Sourcecode/{family}/{repo} resolver, post-refetch ScanPill terminal state]
key_files:
  modified:
    - packages/agent/src/lib/gitnexusScan.ts
    - packages/agent/src/lib/gitnexusScan.test.ts
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/ScanPill.tsx
    - .planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-CONTEXT.md
decisions:
  - "D-13-EXT-08 supersedes D-13-EXT-07: row.inRegistry is metadata only, not a render gate. Daemon resolves ~/Sourcecode/{family}/{repo} deterministically for repos not in the dashboard registry."
  - "ScanPill terminal effect awaits coverage refetch before clearing scanId — 'Scanning…' state stays visible through the entire scan-→-row-refresh window (no transient idle button on a stale row)."
metrics:
  commits: 6
  completed_date: "2026-05-25"
---

# Phase 13 Plan 07: D-13-EXT-08 Regression Fix Summary

**One-liner:** Phase-13-05's Option A (gate ScanPill on `row.inRegistry`) closed the original toast but made the feature unusable. D-13-EXT-08 implements Option D (the hybrid): drop the SPA gate, add a deterministic filesystem fallback in the daemon, and await the coverage refetch in the SPA terminal effect so "Scanning…" stays visible until the row data is fresh.

## Why this plan exists

Plan 13-05 implemented D-13-EXT-07 — "registry-membership is a required precondition for any daemon-write affordance attached to a Coverage row" — and gated ScanPill render on `row.inRegistry`. Cross-package tests passed; the executor's automated verification said green. But during user re-verification on 2026-05-25, the user correctly identified that **the fix made the feature unusable**: only 1/22 typical filesystem-discovered rows are dashboard-registered, so ScanPill disappeared from 21/22 rows. User feedback (verbatim): *"now what do I do with it, there is no way to start a scan for a repo, this does not make sense at all, you broke it all"*.

The root architectural error was the threat-model reading. The rejection of Option B in 13-05 cited *"expanding daemon's write surface beyond registered paths"* — which is factually wrong. `gitnexus analyze` writes only to `~/.gitnexus/` (its own home directory), never to the target repo. The daemon's spawn just passes the target path. The actual T-13-02-01 concern is path traversal, which is **already mitigated** at the wire by `GitnexusScanRequestSchema`'s regex `/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/`.

## What landed

### Daemon — deterministic forward resolver

`packages/agent/src/lib/gitnexusScan.ts`:
- New exported helper `deterministicRepoRoot(repoId)` — inverse of `derivedRepoId`. Maps `family/repo` → absolute path under `~/Sourcecode/`. Family allow-list enforced (`agenticapps|factiv|neuroflash`). Returns null unless the directory exists AND `statSync().isDirectory()` returns true.
- `startScan()` now does a 2-step resolve: registry first (existing path), then fallback to `deterministicRepoRoot(repoId)`. `REPO_NOT_REGISTERED` is now only returned when BOTH lookups fail.
- Threat model: T-13-02-01 unchanged. No new write surface (gitnexus's destination is unchanged). Small new read surface (any `~/Sourcecode/{family}/` subdirectory scannable without prior registration) — judged acceptable; daemon is loopback-only by default, user-authorized at startup, target was already enumerable via Coverage discovery.

### SPA — drop gate + await refetch in terminal

`packages/spa/src/components/panels/coverage/CoverageRow.tsx`:
- Removed `&& row.inRegistry` from the gitNexus cell's gate. ScanPill now renders on every missing/not-applicable row when `gitnexusInstalled === true`.
- `row.inRegistry` field stays in the wire schema as metadata (kept from 13-05) for future tooltips / registration-aware tooling.

`packages/spa/src/components/panels/coverage/ScanPill.tsx`:
- Terminal effect now wraps work in async IIFE; `await qc.refetchQueries({ queryKey: ['coverage'] })` before showing toast and clearing scanId. Conformance invalidation stays fire-and-forget.
- `isPending` simplified to `scanId !== null` — "Scanning…" state remains visible through the entire scan-→-row-refresh window. Cleanup function flags `cancelled` to avoid acting on a stale effect.
- User feedback during pre-fix re-verification: *"still shows scan ... takes a while than it shows when it was scanned"* → user confirmed `pass` after the await-refetch fix.

### Docs

`.planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-CONTEXT.md`:
- D-13-EXT-07 entry marked `(SUPERSEDED by D-13-EXT-08)`, kept as historical record.
- D-13-EXT-08 entry added with full rationale, threat-model analysis, and implementation summary.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `e1685f2` | test | RED: ScanPill must render regardless of inRegistry (D-13-EXT-08) |
| `b2b8da9` | feat | GREEN: drop inRegistry gate from ScanPill render |
| `fb942f6` | test | RED: deterministic ~/Sourcecode/{family}/{repo} fallback |
| `4542b62` | feat | GREEN: deterministicRepoRoot helper + fallback in startScan |
| `9f8e772` | docs | record D-13-EXT-08 supersession of D-13-EXT-07 |
| `c8ddc38` | fix | ScanPill — await coverage refetch before clearing scanId |

## Verification

- `pnpm -r typecheck` → 5/5 packages exit 0
- `pnpm -r test --run` → 2389/2389 tests pass (298 shared + 918 agent + 1142 spa + 31 meta-observer)
- User manual UAT re-verification on 2026-05-25:
  - Per-row scan works on previously-unregistered repos (e.g. `agenticapps-workflow-core`, `agentlinter`) → user `pass`
  - ScanPill "Scanning…" state remains visible through row refresh → user `pass`

## Known Stubs

None.

## Threat Flags

T-13-02-01 mitigation preserved (regex at the wire). Net threat-model delta: small new read surface; no new write surface. Defence-in-depth via existsSync + statSync().isDirectory() prevents spawning against symlinks / regular files.

## Self-Check: PASSED
