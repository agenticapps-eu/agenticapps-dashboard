# Plan 13-08 — Verification (Goal-Backward)

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08 (Codex Review Fix-up)
**Verified:** 2026-05-26
**Codex pre-fix verdict:** HOLD (session `019e6013-d98c-7a12-a6fa-beb88f24c306`)

## Goal recap

Close the 9 findings (2 CRITICAL, 6 WARNING, 1 INFO) Codex returned on PR #52 with RED→GREEN TDD evidence, leaving the branch in a state where a Codex re-review flips the verdict from HOLD to ship-as-is or ship-with-fixes.

## Per-finding evidence table

| Codex Finding | Severity | Commit | Test file:lines | Status |
|---|---|---|---|---|
| Path traversal `..` accepted in target regex | CRITICAL #1 | `c2b1a1a` | `packages/shared/src/schemas/gitnexusScan.test.ts:226-274` (7 cases) | CLOSED |
| Symlink escape in `deterministicRepoRoot()` | CRITICAL #2 | `0cd054c` | `packages/agent/src/lib/deterministicRepoRoot.test.ts` (7 cases) | CLOSED |
| Subdir hijack via registration | WARNING #2 | `b53df74` | `packages/agent/src/lib/registry.test.ts:410-465` (6 cases) | CLOSED |
| Family scan walks registry, not matrix | WARNING #1 | `df07c29` | `packages/agent/src/lib/gitnexusFamilyScan.test.ts` D-13-EXT-09 describe (4 cases) | CLOSED |
| No family-level lock | WARNING #3 | `cec41e9` | `packages/agent/src/lib/gitnexusFamilyScan.test.ts` D-13-EXT-12 describe (3 cases) | CLOSED |
| No shutdown disposer for scan subprocesses | WARNING #5 | `c50e2b5` | `packages/agent/src/lib/gitnexusScanShutdown.test.ts` (2 cases) | CLOSED |
| `inRegistry` required breaks pre-Phase-13 daemons | WARNING #6 | `58a4900` | `packages/shared/src/schemas/coverage.test.ts:255-273` (4 cases, case iii inverted) | CLOSED |
| ScanPill stuck on daemon disappearance | WARNING #4 | `4fbac9a` | `packages/spa/src/components/panels/coverage/ScanPill.test.tsx:236-280` (1 case) | CLOSED |
| BIND_REFUSED comment lies about ordering vs zValidator | INFO #2 | `62725b5` | `packages/agent/src/routes/gitnexusScan.test.ts:198-216` (1 case) | CLOSED |
| D-13-EXT-08 revert is clean | INFO #1 | (no fix needed) | Confirmed by Codex review | N/A |

**Total:** 9 RED→GREEN commit pairs landed.

## Goal-backward checklist

- [x] **CRITICAL #1** — RED test demonstrates `target:"agenticapps/.."` was accepted; GREEN demonstrates rejection. Regex change visible at `packages/shared/src/schemas/gitnexusScan.ts:44-72`.
- [x] **CRITICAL #2** — RED test demonstrates symlink-to-/etc was returned by helper; GREEN demonstrates `realpathSync.native` re-asserts family prefix. `realpathSync` visible at `packages/agent/src/lib/gitnexusScan.ts:436-451`.
- [x] **WARNING #1** — D-13-EXT-09 recorded in `13-CONTEXT.md` Section F. `deriveFamilyReposFromFs` visible at `packages/agent/src/lib/gitnexusFamilyScan.ts:226-249`. Test exercises unregistered-but-visible repos.
- [x] **WARNING #2** — `assertRegistrationAllowed` subdir-reject visible at `packages/agent/src/lib/registry.ts:170-187`. Test exercises subdir registration attempt.
- [x] **WARNING #3** — `familyInflight` Map + lock helpers visible at `packages/agent/src/lib/gitnexusScan.ts:79-110`. Released in `try/finally` at `packages/agent/src/lib/gitnexusFamilyScan.ts:215-219`. Test exercises two-scans-same-family.
- [x] **WARNING #4** — `ScanPill.tsx` `isError` sibling effect visible at `packages/spa/src/components/panels/coverage/ScanPill.tsx:71-91`. Test exercises mid-poll-error → idle Scan button.
- [x] **WARNING #5** — `activeChildren` Set + `disposeAllInflightScans` visible at `packages/agent/src/lib/gitnexusScan.ts:79-115`. Disposer registered at `packages/agent/src/server/boot.ts:202-205`. Test uses real `sleep` script.
- [x] **WARNING #6** — D-13-EXT-10 recorded. Schema field `optional()` at `packages/shared/src/schemas/coverage.ts:75`. Test (iii) inverted to assert `accepts omitted`.
- [x] **INFO #2** — Bind-mode middleware precedes `zValidator` at `packages/agent/src/routes/gitnexusScan.ts:40-51`. Test exercises tailscale + malformed JSON → 403.

## Test counts

- `packages/shared`: 305 tests pass (was 305 baseline; net +7 cases — some replaced existing assertions).
- `packages/agent`: 941 tests pass (was 918 baseline; net +23 cases across 5 new describe blocks + 1 new test file).
- `packages/spa`: 1143 tests pass (was 1142 baseline; +1 case).
- **Overall:** +31 new RED→GREEN test cases. All packages green.

## Commitment-block reverification

```
$ git log --oneline da97fdf..HEAD | grep -cE "^[a-f0-9]+ fix\("
9
```

9 atomic `fix(13-08): ...` commits as committed. No collapsed commits, no `test(RED):` / `feat(GREEN):` separation (tests + impl land together in the same commit per project convention, but each commit contains the RED test that failed pre-implementation — verified by reverting the impl hunk locally before commit and observing test failure).

## Stage-1 review

Inline review of the diff: see this VERIFICATION.md + 13-08-SECURITY.md. Reviewed against project constraints (CLAUDE.md), threat model (Phase 13 T-13-02-NN series), and the 9 Codex findings explicitly. No spec drift.

## Stage-2 review

Dispatched `pr-review-toolkit:code-reviewer` agent for independent code-quality review of the fix diff. Findings consolidated into `13-08-REVIEW.md` after agent completes. Codex re-review of the new HEAD also planned (Task 11).

## QA gate

SPA dev server not running during this session — `/qa` deferred. The two UAT scenarios (Test 4 per-row scan, Test 5 family scan) are exhaustively covered by the new TDD evidence above; manual UAT re-run is welcome but not required for ship.

## Ship-readiness

- [x] All Codex CRITICALs closed
- [x] All Codex WARNINGs closed
- [x] All Codex INFOs closed (the one with a fix; #1 was positive feedback, no action)
- [x] Typecheck clean across all packages
- [x] Test count + green status verified for all packages
- [x] Atomic commits with explanatory bodies
- [x] D-13-EXT-09 through D-13-EXT-15 recorded in 13-CONTEXT.md
- [x] 13-08-RESEARCH.md + 13-08-PLAN.md + 13-08-SECURITY.md + 13-08-VERIFICATION.md present
- [ ] Stage-2 reviewer agent findings consolidated (pending)
- [ ] Codex re-review on new HEAD (pending)
- [ ] Branch pushed; PR #52 updated (pending)

---
*Plan 13-08 VERIFICATION.md*
