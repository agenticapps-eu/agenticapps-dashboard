---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
verified: 2026-06-08T10:42:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
waivers:
  - subject: "/code-intelligence IMPECCABLE composite ~74 (below the ratified ≥80 floor)"
    type: structural-debt
    authority: "D-10.5-03.calibration-2 (RATIFIED by user 2026-06-08), waiver clause"
    reason: "The page is under-finished (a flat status table), not flawed. Lift work (retry/empty-status, state-tinted cells, richer metadata) is captured in the deferred 14.1 polish bundle. /coverage ~80 passes the floor exactly."
    follow_up: "14.1 polish bundle (not yet planned)"
    accepted_by: "Donald"
    accepted_at: "2026-06-08"
deferred:
  - truth: "Tailscale second-device viewer access (D-14-04)"
    addressed_in: "infra-gated — same gap as Phase 13 UAT Test 10"
    evidence: "Bind-mode parity is verified at the code/test level (no bindMode gate in understandViewer mount, app.test.ts); only the live second-device walkthrough is un-run. Plan 14-08 Task 2 step 7 marks this optional / skip-with-note."
---

# Phase 14: Understand-Anything Integration — Daemon-Hosted Knowledge Graph Verification Report

**Phase Goal:** Clicking a repo's Understand link on /coverage opens a daemon-hosted understand-anything viewer in a new tab rendering that repo's live knowledge graph (incl. source preview), gated by a per-repo scoped token (NOT the bearer token); plus a /code-intelligence page listing analyzed repos; plus a CLI installer for the viewer; all read-only, with the daemon serving 6 token-gated data endpoints.
**Verified:** 2026-06-08T10:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Viewer link click on /coverage opens daemon-hosted viewer in new tab, renders live claude-workflow graph incl. source preview (D-14-01/03/05/06/07) | ✓ VERIFIED | Live e2e re-verified 2026-06-08 (HEAD 7a3810e): `/qa` report row 2 "viewer SPA loads; knowledge-graph.json fetched via v2 token → 200; graph + node list render". CoveragePage builds `/understand/{repoId}/?token=` new-tab links (`CoveragePage.test.tsx:930`). Installed viewer present: `~/.agenticapps/dashboard/understand-viewer/2.7.6/index.html`. |
| 2 | Viewer is gated by a per-repo scoped token, NOT the bearer token (D-14-03) | ✓ VERIFIED | `viewerToken.ts` mint/verify (32 tests green); `CoveragePage.test.tsx:1033` "bearer token NEVER appears in any constructed viewer URL"; bad-token 403 in `/qa`; data routes mounted pre-bearerAuth in `app.ts:146-155`. |
| 3 | 6 token-gated data endpoints served, read-only (D-14-05) | ✓ VERIFIED | All 6 registered in `understandViewer.ts:547-552` (knowledge-graph/meta/config/domain-graph/diff-overlay/file-content). 50 tests in `understandViewer.test.ts` (token gate + 12-guard file-content suite) green. No write routes; mount has no bindMode gate (D-14-04 parity). |
| 4 | /code-intelligence page lists analyzed repos (D-14-06) | ✓ VERIFIED | `CodeIntelligencePage.tsx` (11k) routed at `router.tsx:151` under _appshell; Sidebar "Code Intelligence" section (Sidebar.test S18-S20). `/qa` row 3: lists claude-workflow, callbot, cparx, fx-signal-agent (4 repos) with Open-viewer links. |
| 5 | CLI installer for the viewer exists (D-14-01) | ✓ VERIFIED | `cli.ts:126` registers `install-understand-viewer`; `installUnderstandViewer.ts` (8.6k) builds core→dashboard, installs to write boundary; produced the live `2.7.6/` install verified above. |
| 6 | Coverage Understand column: analyzed/stale/missing + copy pill (D-14-08/10) | ✓ VERIFIED | `UnderstandCopyPill.tsx` 3-state cell; `buildUnderstandCommand()` in shared `clipboard.ts`; understandScanner commit-hash staleness; `/qa` row 1: copy pill on graphless repos, live "View ↗" on claude-workflow. Column now participates in filter + family aggregates (`CoveragePage.tsx:87`, `CoverageFamilySection.tsx:99` — IMPECCABLE P1 remediated, commit 546d244). |
| 7 | 14-IMPECCABLE.md gate artifact exists for both routes at 1440×900 (D-10.5-02) | ✓ VERIFIED | `14-IMPECCABLE.md` (15k, commit e698fc5): composite ~78 (/coverage ~80, /code-intelligence ~74), per-heuristic Nielsen tables for both routes, findings + persona red flags. See floor waiver below. |
| 8 | Post-phase ritual executed: two-stage review + /cso + /qa (not collapsed) | ✓ VERIFIED | SUMMARY Task 4: Stage 1 `/review` (7f1ebb6 + bundle fixes), Stage 2 `superpowers:requesting-code-review` (merge-with-fixes), `/cso` (4 named targets, no CRITICAL/HIGH on loopback), `/qa` (PASS, health 98/100, report at `.gstack/qa-reports/qa-report-dashboard-2026-06-08.md`). |
| 9 | Four CSO MITIGATE security fixes landed (TDD, signed commits) | ✓ VERIFIED | d25140e `--ignore-scripts` (installUnderstandViewer.ts:138); 3218509 `redactTokens()` (app.ts:116, logging.test.ts); b0091b7 `isSensitivePath()` deny-list (understandViewer.ts:275,494); 7a3810e viewer token v1→v2 8h TTL+jti+exp (viewerToken.ts VIEWER_TOKEN_TTL_MS). Item 4 (TOCTOU) ACCEPTed. |
| 10 | Full workspace suite + typecheck + build green | ✓ VERIFIED | Established this close: agent 1115 / spa 1205 / shared 329; typecheck + build clean. Spot-checks re-run alone this verification: agent security suites 111/111 pass (viewerToken + understandViewer + logging); spa 73/73 pass (CoveragePage + CodeIntelligencePage + UnderstandCopyPill). |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/agent/src/routes/understandViewer.ts` | Static serving + 6 data endpoints + file-content guards | ✓ VERIFIED | 28k, 6 endpoints registered, 12-guard suite, deny-list backstop, FIX 2 sanitization |
| `packages/agent/src/lib/viewerToken.ts` | HMAC per-repo scoped token, 0600, v2 exp+jti | ✓ VERIFIED | 14k, v2 format, 8h TTL, HMAC-before-parse, rotation hook |
| `packages/agent/src/lib/repoRoot.ts` | registry-first + FS-fallback resolution (D-14-09) | ✓ VERIFIED | 5.7k, realpath-guarded, family allow-list |
| `packages/agent/src/cli/installUnderstandViewer.ts` | CLI installer, --ignore-scripts | ✓ VERIFIED | 8.6k, registered in cli.ts, write-boundary install |
| `packages/spa/.../code-intelligence/CodeIntelligencePage.tsx` | Analyzed-repos listing page | ✓ VERIFIED | 11k, routed + sidebar section |
| `packages/spa/.../coverage/UnderstandCopyPill.tsx` | 3-state Understand cell | ✓ VERIFIED | 3.7k, fresh-link/stale/missing |
| `packages/shared/src/clipboard.ts` | buildUnderstandCommand `{string, argv}` | ✓ VERIFIED | 3.8k |
| `14-IMPECCABLE.md` | composite + per-heuristic, both routes, ≥40 lines | ✓ VERIFIED | 15k, both routes scored at 1440×900 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| 14-IMPECCABLE.md | /coverage + /code-intelligence | impeccable:critique @1440×900 | ✓ WIRED | "composite" present; per-route Nielsen tables |
| CoveragePage viewer link | scoped viewerToken (not bearer) | `?token=` URL build | ✓ WIRED | negative assertion test 1033; bearer never in href |
| understandDataRoute | pre-bearerAuth mount | app.ts route order | ✓ WIRED | mounted at app.ts:154-155 before bearerAuth (162) |
| coverageScan | per-row viewerToken mint | understandScanner + viewerToken | ✓ WIRED | row token verifies back to row repoId (14-06 tests) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Security-critical agent suites pass | `npx vitest run viewerToken/understandViewer/logging` | 111 passed (3 files) | ✓ PASS |
| SPA coverage + code-intelligence suites pass | `npx vitest run CoveragePage/CodeIntelligencePage/UnderstandCopyPill` | 73 passed (3 files) | ✓ PASS |
| Viewer installed to write boundary | `ls ~/.agenticapps/dashboard/understand-viewer/` | `2.7.6/index.html` present | ✓ PASS |
| 6 data endpoints registered | grep route registrations | 6/6 present | ✓ PASS |

### Security Fix Verification

| CSO Item | Fix | Commit | Code Evidence |
|----------|-----|--------|---------------|
| 5 — installer supply-chain | `pnpm install --ignore-scripts` | d25140e | installUnderstandViewer.ts:138 + test:198 |
| 1 — token in request logs | `redactTokens()` redacting logger | 3218509 | app.ts:116 + logging.test.ts |
| 3 — no deny-list backstop | `isSensitivePath()` (.env/.pem/.key/SSH/.git → 403) | b0091b7 | understandViewer.ts:275,494 |
| 2 — no expiry/nonce | viewer token v1→v2 (8h TTL + 96-bit jti + exp) | 7a3810e | viewerToken.ts VIEWER_TOKEN_TTL_MS |

All four commits present in git history. Item 4 (file-content openSync/fstat TOCTOU) ACCEPTed per CSO (same-uid attacker gains nothing).

### IMPECCABLE Floor Waiver (D-10.5-03.calibration-2)

The composite floor was recalibrated and **RATIFIED by the user on 2026-06-08** (`D-10.5-03.calibration-2`, superseding the provisional 87 floor): a frontend phase passes its IMPECCABLE gate at **composite ≥ 80** per audited route at 1440×900, with a per-phase structural-debt waiver clause.

Phase 14 outcome:
- **`/coverage` ~80 — PASSES** the ratified floor exactly. (Coverage surface tracked 74→76→80 across Phases 10/11/14 as inherited P1s were chipped away; the two Phase-14-introduced P1s — 46px viewport overflow and Understand-column filter/aggregate exclusion — were remediated this close via commits 84f2245 / 546d244.)
- **`/code-intelligence` ~74 — BELOW FLOOR; WAIVED** under the calibration-2 structural-debt waiver clause. **Structural reason:** the page is under-finished (a flat status table), not flawed — the lift work (error retry/empty-status, state-tinted cells, richer per-graph metadata) is captured in the deferred **14.1 polish bundle**. The decision record (`10.5-DECISIONS.md:178`) explicitly directs this waiver to be recorded here.

This waiver is recorded in the frontmatter `waivers:` block above per the calibration-2 clause.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-14-01 | 14-02/07 | CLI installer + version detection | ✓ SATISFIED | install-understand-viewer + viewerInstall.ts |
| D-14-02 | 14-01/04/06 | Version-drift detect+hint, /health block | ✓ SATISFIED | health understand block; update-hint UI |
| D-14-03 | 14-02/03/05/06 | Scoped read-only viewer token | ✓ SATISFIED | viewerToken.ts; bearer-never tests |
| D-14-04 | 14-05 | Full Tailscale parity (no bindMode gate) | ✓ SATISFIED (code) | mount has no bindMode check; live 2nd-device walkthrough deferred (infra) |
| D-14-05 | 14-05 | file-content ratified exception + 12 guards | ✓ SATISFIED | 50-test suite + deny-list backstop; /cso PASS-WITH-NOTES |
| D-14-05b | 14-05 | Graph path sanitization (FIX 2) | ✓ SATISFIED | sanitization applied to kg + domain-graph |
| D-14-06 | 14-04 | Code Intelligence sidebar section + page | ✓ SATISFIED | router + Sidebar tests |
| D-14-07 | 14-03/04 | New-tab viewer, noopener | ✓ SATISFIED | UnderstandCopyPill/CoveragePage link tests |
| D-14-08 | 14-01/06 | Commit-hash staleness | ✓ SATISFIED | understandScanner readRepoHeadSha + meta hash |
| D-14-09 | 14-02 | Registry-first + FS-fallback resolution | ✓ SATISFIED | repoRoot.ts realpath-guarded |
| D-14-10 | 14-01/03 | Copy-command pill `{string, argv}` | ✓ SATISFIED | buildUnderstandCommand + pill tests |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | — | — | No unreferenced TBD/FIXME/XXX debt markers introduced in phase files; CSO MITIGATE items all closed with signed commits; ACCEPTed item 4 formally adjudicated. |

### Human Verification Required

None blocking. All live e2e steps 1-6 were user-approved (2026-06-07) and re-verified live 2026-06-08 against the rebuilt daemon, corroborated by the `/qa` PASS report. The only un-run item is the optional Tailscale second-device walkthrough (D-14-04 step 7) — an infra-gated check (same gap as Phase 13 UAT Test 10), explicitly skip-with-note in the plan, and covered at the code/test level. Recorded under `deferred:`.

### Gaps Summary

No gaps block goal achievement. Every must-have truth is VERIFIED with codebase + live evidence. The phase goal is demonstrably true end-to-end: link click → daemon-served viewer rendering the live claude-workflow graph via a scoped v2 token, source preview working, /code-intelligence listing 4 analyzed repos, CLI installer producing the live viewer install, 6 read-only token-gated endpoints, and all four CSO security fixes landed. The one residual item (`/code-intelligence` ~74 IMPECCABLE) is formally WAIVED under the ratified calibration-2 structural-debt clause with the 14.1 polish bundle as the named follow-up.

---

_Verified: 2026-06-08T10:42:00Z_
_Verifier: Claude (gsd-verifier)_
