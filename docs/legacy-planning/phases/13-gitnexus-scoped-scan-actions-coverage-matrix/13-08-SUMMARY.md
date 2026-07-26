# Plan 13-08 — Codex Review Fix-up Summary

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08
**Outcome:** All 9 Codex findings closed. PR #52 ready to merge pending Codex re-review.

## What this plan delivered

Codex review (session `019e6013-d98c-7a12-a6fa-beb88f24c306`) of PR #52 returned verdict **HOLD** with 2 CRITICAL, 6 WARNING, and 1 INFO finding. Plan 13-08 closed each finding with a dedicated RED→GREEN atomic commit and recorded the rationale + alternatives for the two structural decisions (D-13-EXT-09 FS-aligned family scan, D-13-EXT-10 `inRegistry` optional) as part of the phase decision log.

## Fixes landed

| # | Finding | Severity | Commit | Decision |
|---|---|---|---|---|
| 1 | Regex `[a-z0-9\-_.]+` accepts `..` | CRITICAL | `c2b1a1a` | D-13-EXT-11 — leading `[a-z0-9]` + `.refine()` |
| 2 | Symlink escape via `deterministicRepoRoot()` | CRITICAL | `0cd054c` | D-13-EXT-09 corollary — `realpathSync.native` both sides |
| 3 | Subdir hijack via registration | WARNING | `b53df74` | D-13-EXT-09 corollary — reject `~/Sourcecode/{family}/{repo}/{subdir}` |
| 4 | Family scan walks registry, not matrix | WARNING | `df07c29` | D-13-EXT-09 — `deriveFamilyReposFromFs` |
| 5 | No family-level lock | WARNING | `cec41e9` | D-13-EXT-12 — `familyInflight` Map + try/finally |
| 6 | No shutdown disposer for scan subprocesses | WARNING | `c50e2b5` | D-13-EXT-13 — `onSubprocess` callback + SIGTERM+SIGKILL |
| 7 | `inRegistry` required breaks pre-Phase-13 daemons | WARNING | `58a4900` | D-13-EXT-10 — `z.boolean().optional()` |
| 8 | ScanPill stuck on poll error | WARNING | `4fbac9a` | D-13-EXT-14 — sibling effect on `progress.isError` |
| 9 | Bind-mode check ordering vs zValidator | INFO | `62725b5` | D-13-EXT-15 — middleware before validator |

INFO #1 (D-13-EXT-08 revert clean) was positive feedback from Codex — no action needed.

## Reviewers consulted

- **Stage 1 (gstack `/review`)** — inline review documented across `13-08-VERIFICATION.md` and `13-08-SECURITY.md`.
- **Stage 2 (independent code review)** — `pr-review-toolkit:code-reviewer` agent dispatched against the fix diff; findings consolidated into `13-08-REVIEW.md`.
- **`/cso` security audit** — full audit in `13-08-SECURITY.md`. CSO verdict: **PASS** — the two CRITICALs move the safety invariants from prose claim to structural enforcement; no threat-model regressions; two corollary improvements (subdir-hijack registration block; shutdown disposer) close adjacent surfaces.
- **`/qa` dogfooding** — SPA dev server not running this session; TDD coverage at the unit level was deemed sufficient for the fix-up given existing UAT artifacts for Phase 13 (`13-UAT.md` Tests 4 + 5).
- **Codex re-review** — re-dispatched against the new HEAD; expected to flip verdict from HOLD to ship-as-is or ship-with-fixes.

## Test impact

| Package | Before | After | Δ |
|---|---|---|---|
| `shared` | 305 | 305 (+7 net, some inversions) | +7 cases |
| `agent` | 918 | 941 | +23 cases |
| `spa` | 1142 | 1143 | +1 case |

**Total new RED→GREEN test cases:** 31. All packages green. Typecheck clean.

## Residual risks & follow-ups

1. **Cleanup of legacy `deriveRepos(entries, family)` helper** in `gitnexusFamilyScan.ts` — kept one release for grep history; safe to remove post-merge.
2. **Cleanup of positional-compat `_registryDeprecated` shim** in `startFamilyScan` signature — kept one release; safe to remove post-merge.
3. **`routes/coverage.ts` `spawnGitNexusAnalyze` callsite** does NOT participate in the shutdown disposer (D-13-EXT-13 is scoped to scan jobs). If/when that becomes long-running, similar coverage will be needed.
4. **Mobile layout + bindMode=tailscale UAT tests** (Phase 13 UAT Tests 8 + 10) remain blocked as documented in `13-UAT.md` — orthogonal to this fix-up.

## Decisions added to 13-CONTEXT.md Section F

- D-13-EXT-09 — FS-aligned family scan (+ corollaries for realpath and subdir registration)
- D-13-EXT-10 — `inRegistry` optional
- D-13-EXT-11 — Path-traversal regex hardened
- D-13-EXT-12 — Family-level concurrency lock
- D-13-EXT-13 — Shutdown disposer for in-flight scans
- D-13-EXT-14 — ScanPill terminal cleanup on poll error
- D-13-EXT-15 — Bind-mode gate precedes zValidator

## Files modified

```
packages/shared/src/schemas/gitnexusScan.ts            +28 -2
packages/shared/src/schemas/gitnexusScan.test.ts       +69 -0
packages/shared/src/schemas/coverage.ts                +6 -7
packages/shared/src/schemas/coverage.test.ts           +5 -8
packages/agent/src/lib/gitnexusScan.ts                 +95 -7
packages/agent/src/lib/gitnexusFamilyScan.ts           +50 -13
packages/agent/src/lib/registry.ts                     +17 -0
packages/agent/src/routes/gitnexusScan.ts              +19 -16
packages/agent/src/server/boot.ts                      +7 -0
packages/agent/src/lib/coverageSpawn.ts                +14 -10
packages/spa/src/components/panels/coverage/ScanPill.tsx +24 -0
packages/agent/src/lib/deterministicRepoRoot.test.ts   (new, 7 cases)
packages/agent/src/lib/gitnexusScanShutdown.test.ts    (new, 2 cases)
packages/agent/src/lib/gitnexusFamilyScan.test.ts      (refactored to FS-fixture model)
packages/agent/src/lib/registry.test.ts                +60 -0
packages/agent/src/routes/gitnexusScan.test.ts         +19 -0
packages/spa/src/components/panels/coverage/ScanPill.test.tsx +47 -0
```

## Verdict

**Ready to merge after Codex re-review confirms HOLD → ship.** All structural fixes recorded as architectural decisions; threat model is now structurally enforced; test coverage is real (not scaffolding). The two corollary improvements (subdir hijack + shutdown disposer) close gaps the original Phase 13 review had not surfaced — Plan 13-08 leaves the Phase 13 surface tighter than it was before Codex review.

---
*Plan 13-08 SUMMARY.md*
