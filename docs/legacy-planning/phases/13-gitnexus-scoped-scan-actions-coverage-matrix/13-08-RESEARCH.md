# Plan 13-08 — Codex Review Fix · Research

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08 (Codex review fix-up, post-PR #52)
**Date:** 2026-05-25
**Codex session:** `019e6013-d98c-7a12-a6fa-beb88f24c306`
**Verdict that triggered this plan:** HOLD (2 CRITICAL, 6 WARNING, 1 INFO)

## Why this plan exists

Codex review of PR #52 on `feat/phase-13-gitnexus-scoped-scan` surfaced two CRITICAL path-resolution bugs and six WARNING-class structural defects, including one (`family-scan source-of-truth`) that is the family-level twin of the per-row defect D-13-EXT-08 fixed mid-phase. Codex returned HOLD; we do not merge until closed.

The bugs were not caught by Stage 1 `/review`, `/cso`, or `/qa` because:
- The path-traversal regex was checked *visually* during D-13-EXT-08 ("`..` rejected") but never run against the literal payload `target: "agenticapps/.."`. The character class `[a-z0-9\-_.]+` includes `.`, so `..` matches. Stage 1 read the prose claim and moved on.
- The symlink-escape and shutdown-disposer findings live in code paths exercised only by failure-mode tests we did not write.
- The family-scan/registry decoupling defect mirrors D-13-EXT-08 exactly; the per-row fix closed it for one route and left it open for the sibling route.

## Decisions requiring brainstorming

Seven of the nine fixes are mechanical (write a test that demonstrates the bug, write the smallest change that makes it pass). Two are architectural and recorded here as D-13-EXT-09 and D-13-EXT-10.

### D-13-EXT-09 — Family-scan source-of-truth (closes Codex WARNING #1)

**Context.** `startFamilyScan` (gitnexusFamilyScan.ts) derives the per-family repo list from `registry.entries` via the `deriveRepos` path-prefix walk. Coverage matrix discovery (`coverageScan.ts::scanCoverageInternal`) walks the filesystem under `~/Sourcecode/{family}/`, which is a strict superset of the registry. Result: a user clicks "Scan family" on a family that has 3 visible repos in the matrix but only 2 registered, and the third is silently skipped. If only unregistered repos exist in a family, the route returns `FAMILY_HAS_NO_REPOS` *while the Scan pill itself was rendered* — the same UX failure D-13-EXT-08 closed at the per-row level.

**Alternatives.**

| Option | What | Trade-off |
|---|---|---|
| A1 — Registry-only (status quo) | Keep walking `registry.entries`. | Cheapest. Codex WARNING #1 stays open; rationale would be "strict registry-driven scope". |
| **A2 — FS-aligned (chosen)** | Replace `deriveRepos` with the same FS walk `discoverRepos` does, scoped to the family root. Each entry flows through the (now hardened) `deterministicRepoRoot()`. | Matches the matrix exactly. Removes coupling between registration and scan visibility. Safe because CRITICAL #2 + WARNING #2 close the path-resolution surface. |
| A3 — Union (registry + FS) | Union of the two. | No new safety property over A2 (FS already a superset of registry). Adds dedupe cost. |

**Decision:** A2. UX-truth ("scan what you see") is the principle D-13-EXT-08 codified for the per-row case; applying it at the family level uniformly closes the same defect. Path-safety holds because the hardened `deterministicRepoRoot()` is the chokepoint for ALL repo-root resolution (per-row and family), and CRITICAL #2 makes that chokepoint realpath-safe.

**Implementation.** New helper `deriveFamilyReposFromFs(familyId, sourcecodeRoot)` in `gitnexusFamilyScan.ts`:
- Read `~/Sourcecode/{family}/` directory.
- For each entry: `discoverRepos`-style filter (directory + ≥1 marker file).
- Each candidate then passes through `deterministicRepoRoot(family/repo)` and is accepted iff that returns a value (proves: family allow-list, exists, is a directory, realpath stays under `~/Sourcecode/{family}/`).
- Sort alphabetically (preserve D-13-04 ordering).

The existing `deriveRepos(entries, family)` is kept as the registry-derived helper but no longer called by the scan path. (Deletion deferred to post-merge cleanup; out-of-scope churn for this fix-up.)

### D-13-EXT-10 — `inRegistry` schema back-compat (closes Codex WARNING #6)

**Context.** `CoverageRowSchema.inRegistry: z.boolean()` is REQUIRED at packages/shared/src/schemas/coverage.ts:75. Older daemon (pre-Phase 13) omits the field → SPA Zod parse fails → entire `/api/coverage` payload → `SchemaDriftState`. Phase-13 SPA against pre-Phase-13 daemon is a real upgrade scenario (user runs `git pull` to refresh the SPA, then forgets to restart the launchd-managed daemon).

**Alternatives.**

| Option | What | Trade-off |
|---|---|---|
| B1 — Optional + default false | `z.boolean().optional().default(false)` | Old daemon → `false`. Since D-13-EXT-08 removed the render gate, the value is not gating UI anyway. Safe-conservative. Slight risk if a future consumer reads it without checking. |
| **B2 — Optional, no default (chosen)** | `z.boolean().optional()` | Older daemon → `undefined`. SPA decides per-callsite. Most honest. Forces every future consumer to handle the absence explicitly. |
| B3 — Remove field | Drop `inRegistry` from the wire schema entirely. | Cleanest wire surface. Requires identifying every consumer (CoverageRow.test.tsx, tooltips, future tooling). Higher blast radius for a fix-up plan; out of scope. |
| B4 — Bump `schemaVersion` to 2 | Keep field required; SPA falls back to v1 parser if `schemaVersion === 1`. | Heaviest. One metadata field does not earn a version bump. |

**Decision:** B2. The field is metadata-only post-D-13-EXT-08; `undefined` is the most honest representation of "this old daemon does not know about this field". All current consumers can handle `undefined` cleanly (the only render-time read is the optional `.inRegistry` field, which we will adjust to use a sentinel-aware check or be dropped where unused — verified in plan).

**Implementation.** Single character-level edit in the shared schema (`z.boolean()` → `z.boolean().optional()`). All consumers grep'd in the plan task; non-optional reads upgraded to `row.inRegistry === true` where they exist.

## Decisions that are not really decisions

The remaining 7 fixes are mechanical. Recorded here for the plan task list:

| Fix | Action | TDD evidence |
|---|---|---|
| CRITICAL #1 — regex accepts `..` | Replace `[a-z0-9\-_.]+` with `(?!\.\.?$)[a-z0-9][a-z0-9\-_.]*` (must start alnum, not be literal `.`/`..`); add `.refine()` that asserts `path.basename(target)` matches the repo regex. | RED: `GitnexusScanRequestSchema.parse({scope:'repo', target:'agenticapps/..'})` succeeds. GREEN: parse rejects. |
| CRITICAL #2 — symlink escape | `deterministicRepoRoot` calls `fs.realpathSync.native(path)` and re-asserts `realPath.startsWith(familyPrefix + sep)`. Mirrors the guard `coverageScan.ts` already uses. | RED: fixture has `~/Sourcecode/agenticapps/evil` → symlink → `/etc`. Resolver returns the path. GREEN: returns null. |
| WARNING #2 — subdir hijack | Reject registration of paths that have more than one segment past `~/Sourcecode/{family}/`; OR, in the scan path, prefer the deterministic FS path over the registry's stored root when they would resolve to the same `family/repo` id but to different filesystem paths. Decision: scan path uses deterministic resolver as primary lookup; registry as fallback only. | RED: register `~/Sourcecode/agenticapps/repo/subdir`; scan `agenticapps/repo`; assert spawn target was `~/Sourcecode/agenticapps/repo`, not the subdir. |
| WARNING #3 — no family lock | Add `familyScanInflight: Map<KnownFamily, string>` (familyId → scanId); reject 409 `SCAN_IN_FLIGHT` when a family scan is in flight for the same family OR when a per-row scan is in flight for a repo that belongs to a running family scan. Release on family `state='done'`. | RED: two parallel POST /scan family=agenticapps; second returns 200 today (wrong). GREEN: second returns 409 SCAN_IN_FLIGHT. |
| WARNING #4 — ScanPill stuck on daemon death | `useGitnexusScanProgress` error branch must set a terminal state. ScanPill's terminal effect now also fires on `query.isError === true`. | RED: simulate 5xx then drop the row; remount with daemon healthy; pill stuck in "Scanning…". GREEN: pill returns to idle with error label. |
| WARNING #5 — shutdown disposer | Track active child processes in a Set inside `gitnexusScan.ts`; register a `disposers.push(killAllInflight)` in `server/boot.ts`; on shutdown signal, SIGTERM each, then SIGKILL after 2s grace. | RED: start scan, send SIGTERM to daemon, assert child still running. GREEN: child reaped. |
| INFO #2 — BIND_REFUSED ordering | Reorder middleware in `routes/gitnexusScan.ts` so the bind-mode check precedes `zValidator`. Update the comment block to match the new order. | RED: integration test that POSTs malformed JSON over tailscale bindMode currently returns 422 (parse failure). GREEN: returns 403 BIND_REFUSED without parsing. |

## Risks the plan must explicitly cover

- **D-13-EXT-08 regression** — CRITICAL #1's regex change must not narrow the legal repo-name set in a way that breaks existing registered repos. Test fixture covers: `factiv/cparx`, `agenticapps/agenticapps-dashboard`, `neuroflash/q-and-a`, `agenticapps/.well-known-test` (leading dot — currently legal, should now be rejected as that is the threat model intent). If any rejected name is one users already have in the wild, the plan must add a feature-flagged migration path. Mitigation: 22 known registered repos surveyed in plan task `survey-repo-names` BEFORE shipping the regex change.
- **Family-lock semantics for sequential family scans** — D-13-04 already runs per-repo scans sequentially within a family. The new family lock must coexist with the per-repo lock (`scanInflightPerRepo`) without deadlocking when the family loop calls `startScan` for each repo. Approach: the family lock guards only the family-vs-family and family-vs-row directions; the family loop's own per-repo `startScan` calls are exempt because they hold the family lock already (the loop is the sole holder).
- **Schema optionalisation regression** — making `inRegistry` optional must not break existing tests that read it as a present boolean. Plan task: grep all consumers and ensure each handles `undefined`. If a future test asserts `inRegistry === false`, that semantics shifts to "field is absent" — explicit migration in the test only.
- **Realpath performance** — `fs.realpathSync.native` is one syscall per scan; negligible. Coverage scan already does this for ~22 rows; we are adding ~1 more per scan invocation.

## Out of scope

- Refactoring `deriveRepos` out of the codebase (deferred to post-merge cleanup).
- Adding a feature flag for opting back into registry-only family scan (no use case; the FS-aligned behavior is strictly more capable).
- Streaming scan progress (still out of scope per D-13-02; short-poll lives).
- Cancelling in-flight scans (still out of scope; the shutdown disposer is for daemon-shutdown only).

## Verification

This plan ships when:
- All 9 Codex findings produce RED→GREEN evidence in the commit log.
- Stage-1 `/review` returns clean on the fix diff.
- Stage-2 `superpowers:requesting-code-review` returns clean on the fix diff.
- `/cso` SECURITY.md confirms T-13-02-01 mitigation is now structurally enforced (regex + realpath + family-prefix re-assert).
- `/qa` reports no regressions on the SPA dev server (manual UAT re-run of Tests 4 + 5 not required because TDD covers both — but a final eyeball pass is welcome).
- Codex is re-run on the new HEAD and returns ship-as-is or ship-with-fixes.

---

*Plan: 13-08 — Codex Review Fix-up*
*Architectural decisions: D-13-EXT-09 (A2 — FS-aligned family scan), D-13-EXT-10 (B2 — `inRegistry` optional, no default)*
