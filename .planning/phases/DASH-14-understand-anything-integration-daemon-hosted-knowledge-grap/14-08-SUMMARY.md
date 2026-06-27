---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: 08
type: execute
wave: 4
status: complete
completed: 2026-06-08
---

# 14-08 Summary — Phase 14 close

Closes Phase 14 (understand-anything integration, daemon-hosted knowledge graph). All four close tasks complete across two sessions (2026-06-07 build + ritual; 2026-06-08 security fixes + /qa).

## Task 1 — Full-suite phase gate ✅
Workspace gate green (run alone per package to avoid cross-package `pnpm build` contention in `pnpm -r test`):
- agent: 1115 passed (106 files), 1 skipped
- spa: 1205 passed (125 files)
- shared: 329 passed (22 files)
- typecheck: all packages Done · build: all packages success

Note: `pnpm -r test` shows ~9 agent subprocess files failing with "build failed" — this is build-contention flakiness when every package builds concurrently, not a regression (each file passes when the agent suite runs alone; the agent build succeeds directly). Earlier in the 2026-06-08 session, ~13 git-using tests also failed until the ssh-agent was loaded (the repo signs commits; temp-repo tests inherit the signing config) — environmental, not code.

### Verification-map cross-check (behavior family → covering test)
| Family | Covering test |
|---|---|
| D-14-03 token gate | `routes/understandViewer.test.ts` (Task 1 scoped-token endpoints) |
| D-14-05 traversal/12-guard suite | `routes/understandViewer.test.ts` (Task 2 file-content guards) |
| D-14-05b graph sanitization | `routes/understandViewer.test.ts` (FIX 2 sanitisation) |
| D-14-08 staleness / mtime cache | `routes/understandViewer.test.ts` (allow-list mtime cache) + `lib/coverageScan.test.ts` |
| D-14-09 repo resolution | `routes/understandViewer.test.ts` (resolution) + `lib/repoRoot.test.ts` |
| D-14-10 builder / copy pill | `lib/understandViewerUrl` (spa) + coverage column tests |
| D-14-06 sidebar/page + status | `lib/coverageScan.test.ts` + spa code-intelligence tests |
| viewer token (HMAC/exp/jti) | `lib/viewerToken.test.ts` (28) |

## Task 2 — Live e2e viewer verification ✅
Steps 1–6 user-approved 2026-06-07. Re-verified live 2026-06-08 against the rebuilt daemon (HEAD `7a3810e`): paired SPA→daemon, `/coverage` Understand column renders (copy pills + live "View" link for claude-workflow), viewer opens and renders the claude-workflow graph via the **v2** token, `/code-intelligence` lists the four analyzed repos. Step 7 (Tailscale second-device) skipped — same infra gap as Phase 13 UAT Test 10.

## Task 3 — 14-IMPECCABLE.md ✅
`14-IMPECCABLE.md` committed (`e698fc5`). Composite **~78/100** (/coverage ~80, /code-intelligence ~74) at 1440×900. Below the CLI-era 87 floor — this is Phase 14's calibration data point (the third), feeding `D-10.5-03.calibration-2`. Findings triaged into a deferred 14.1 polish bundle (state-tinted Understand cells, code-intelligence retry/empty-status, registry-path builder).

## Task 4 — Post-phase ritual ✅
Stages not collapsed:
1. **Stage 1 `/review`** ✅ (2026-06-07) — auto-fixes `7f1ebb6`; 4 ASK bundles A/B/C/D fixed via 2 worktree agents (`4f2415a`, `9b51ec0`), cross-bundle pill guard `f409c21`.
2. **Stage 2 `superpowers:requesting-code-review`** ✅ (2026-06-07) — verdict merge-with-fixes; 2 IMPECCABLE P1s + 2 minors fixed (`546d244`, `84f2245`, `2dc6f95`, `6b04b36`).
3. **`/cso`** ✅ (2026-06-07) — no CRITICAL/HIGH on default loopback bind. Four named targets: (a) D-14-05 file-content exception PASS-WITH-NOTES, (b) scoped viewer-token PASS-WITH-NOTES, (c) pre-bearerAuth mount order PASS, (d) D-14-04 all-bind posture PASS-WITH-NOTES. Five deferred items adjudicated (4 MITIGATE, 1 ACCEPT).
4. **`/qa`** ✅ (2026-06-08) — full pass, no bugs, health 98/100. Report: `.gstack/qa-reports/qa-report-dashboard-2026-06-08.md`.

### CSO MITIGATE items — all four fixed 2026-06-08 (TDD, separate signed commits)
| Item | Fix | Commit |
|---|---|---|
| 5 — installer supply-chain | `pnpm install --ignore-scripts` in core build | `d25140e` |
| 1 — token in request logs | `redactTokens()` + redacting `logger()` print fn | `3218509` |
| 3 — graph-derived allow-list (no deny-list) | `isSensitivePath()` deny-list backstop in file-content (.env/*.pem/*.key/SSH keys/.git, 403 even if graph-listed) | `b0091b7` |
| 2 — no token expiry/nonce | viewer token **v1→v2**: 8h TTL + 96-bit jti, exp enforced, HMAC-before-parse | `7a3810e` |

Item 4 (file-content TOCTOU) left **ACCEPT** per CSO (same-uid attacker gains nothing). Live validation: v2 token reads a real graph (200), bad token 403, request logs show `token=[REDACTED]` with zero raw-token occurrences.

## Decisions this close
- **Viewer-token TTL = 8 hours** (user-ratified 2026-06-08). Outlasts a viewer session (token frozen into the tab at open), bounds leaked-token replay; re-minted each coverage scan. Const `VIEWER_TOKEN_TTL_MS`.
- **Token format → v2** (middle segment is now a JSON payload, not bare repoId); v1 rejected; determinism dropped deliberately.

## Open / deferred
- `D-10.5-03.calibration-2` — finalize floor recalibration (87 → ~75) now that the third data point (78) is in. **Needs ratification.**
- 14.1 polish bundle (deferred IMPECCABLE P2/P3) — not yet planned.
- Optional openSync/fstat TOCTOU hardening for file-content (CSO item 4) — ACCEPTed; revisit only if threat model changes.
