---
phase: DASH-15-capability-level-engine-fleet-matrix
plan: "02"
subsystem: agent-scanners
tags: [scanner, capability-level, coverage-scan, cml-01, cml-02, cml-03, cml-04, cml-05, cml-06, tdd]
dependency_graph:
  requires:
    - ClaudeMdEval (packages/shared, Plan 01)
  provides:
    - scanClaudeMdLevel (packages/agent)
    - coverageScan eval field (7th allSettled slot)
  affects:
    - packages/spa (Plan 04 renders the eval field this scanner produces)
tech_stack:
  added: []
  patterns:
    - never-throws outer wrapper (overrideSentinelScanner analog)
    - execFileSync argv-array git ls-files (T-10-02-01)
    - resolver-mediated reads (CODEX HIGH-3)
    - parseFrontmatter reuse (workflowVersionScanner precedent)
    - async IIFE allSettled slot with spread-conditional field assembly (Phase 14 understand precedent)
    - TDD red-green cycle (34 scanner tests)
key_files:
  created:
    - packages/agent/src/lib/scanners/claudeMdLevelScanner.ts
    - packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts
  modified:
    - packages/agent/src/lib/coverageScan.ts
decisions:
  - "L5 Maintained is always inferred:true — OR of mtime-within-90-days proxy + 4 backbone-doc existence proxies; coverage-history proxy is NOT evaluatable at scan time (evidence note only, Pitfall 7)"
  - "Headline level is strict-cumulative — highest N where rungs 1..N all pass; higher-rung signals under an unmet lower rung stay visible as passed:false-with-evidence; inferred=true propagates if the contributing chain crossed the inferred L5 rung"
  - "Scanner wired as 7th allSettled slot (lvS, index 6) — NOT 6th; Phase 14 understandScanner already holds slot 6 (Pitfall 1)"
  - "async IIFE wrapper on the slot is mandatory so a sync throw resolves to a rejected promise rather than crashing the fan-out (Pitfall 2)"
  - "eval field assembled via spread-conditional — present on fulfilled, key fully absent (not undefined) on rejected, with a claudeMdLevel note pushed to rowDegraded (CML-06 degrades-not-500)"
  - "Evidence strings are human-readable summaries only — never raw file bytes or matched line content (T-15-02-04 information-disclosure)"
metrics:
  duration: "~9 min"
  completed: "2026-06-17T14:16:00Z"
  tasks: 3
  files: 3
---

# Phase DASH-15 Plan 02: claudeMdLevelScanner Engine — Summary

**One-liner:** Deterministic L0–L6 `claudeMdLevelScanner` that grades a repo's CLAUDE.md/AGENTS.md against the capability ladder and returns a full `ClaudeMdEval`, wired as the 7th `Promise.allSettled` slot in `coverageScan` with degrades-not-500 semantics.

## What Was Built

Plan 02 is the engine of the phase — the deterministic grader that produces the `ClaudeMdEval` the SPA renders in Plans 03–04.

`packages/agent/src/lib/scanners/claudeMdLevelScanner.ts` (450 lines) implements `scanClaudeMdLevel({ repoAbsPath, resolve }): ClaudeMdEval` as a never-throws outer wrapper (returns an `ABSENT_EVAL` constant — level 0, all six rungs `passed:false` with an evidence note — on any inner failure, mirroring `overrideSentinelScanner`). Per-rung deterministic predicates:

- **L1 Basic** — resolver + `existsSync` of CLAUDE.md/AGENTS.md, then `execFileSync('git', ['ls-files','--error-unmatch', filename], …)` in argv-array form with a 5s timeout (git-tracked check, T-10-02-01)
- **L2 Scoped** — `/\bMUST\b|\bMUST NOT\b|\bNEVER\b/` over resolved content
- **L3 Structured** — `/@\w+/m` (@import) OR ≥2 instruction files (root CLAUDE.md/AGENTS.md + `.md` directly under `.claude/`, excluding `rules/` and `skills/`, Pitfall 4)
- **L4 Abstracted** — `.claude/rules/*.md` carrying `paths:` frontmatter (`parseFrontmatter` reuse, per-file resolver)
- **L5 Maintained** — inferred: `statSync(claudeMd).mtimeMs` within `L5_MTIME_WINDOW_DAYS = 90` OR existence of `.claude/INDEX.md|.claude/MAP.md|docs/INDEX.md|docs/MAP.md`; always `inferred:true`; coverage-history proxy left as an evidence note only
- **L6 Adaptive** — `.claude/skills/*/SKILL.md` AND repo-root `mcp.json` (root-only, Pitfall 5)

The headline level is computed by a strict-cumulative loop; `nextSteps` surfaces the single fixed `NEXT_STEP_ADVICE` string for `headlineLevel+1` (verbatim from the UI-SPEC copywriting contract), `[]` at L6. Every filesystem read is resolver-mediated.

`packages/agent/src/lib/coverageScan.ts` adds the import after `understandScanner`, extends the destructure to `[cmS, gnS, wkS, wfS, ovS, unS, lvS]`, and adds the 7th async-IIFE slot. The `eval` field is assembled after `understand` via a spread-conditional: present on `fulfilled`, omitted (key absent) on `rejected` with a `claudeMdLevel:` note pushed to `rowDegraded`.

## Verification Results

- `pnpm --filter @agenticapps/dashboard-agent test claudeMdLevelScanner` — 34 tests green (per-rung, strict-cumulative capping, L5-inferred, nextSteps advice strings, degraded/never-throws)
- `pnpm --filter @agenticapps/dashboard-agent test coverageScan` — 20 tests green (including the allSettled degraded-row contract: a throwing scanner yields a row without an `eval` key plus a degraded note, never a 500)
- `pnpm --filter @agenticapps/dashboard-agent typecheck` — exits 0
- Behavior confirmed: a fresh git-tracked CLAUDE.md with MUST + @import + `.claude/rules/x.md(paths:)` yields level ≥ 4 with L5 `inferred:true`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Per-rung + strict-cumulative scanner tests (RED) | `8db6436` | claudeMdLevelScanner.test.ts |
| 2 | Implement claudeMdLevelScanner engine (GREEN) | `7188c1e` | claudeMdLevelScanner.ts |
| 3 | Wire scanner as 7th allSettled slot + eval assembly | `901b3fb` | coverageScan.ts |

## Deviations from Plan

None to the implementation. **Process note:** the executor agent completed all three task commits but terminated before writing this SUMMARY.md; the orchestrator authored and committed it from the captured commit history and diff during the Wave 2 merge. The code, tests, and commit sequence are exactly as the plan specified.

TDD cycle completed correctly:
- RED: `8db6436` — 10 describe blocks, all failing (scanner module absent)
- GREEN: `7188c1e` — scanner implemented, 34 tests pass
- Integration: `901b3fb` — 7th slot wired, coverageScan suite + typecheck green

## Known Stubs

None. The coverage-history L5 proxy is intentionally not evaluated at scan time (documented as an evidence note, per RESEARCH Pitfall 7) — this is a design decision, not a stub.

## Threat Flags

All dispositions from the plan threat model are implemented:
- **T-15-02-01** (path traversal/symlink escape) — every `existsSync`/`readFileSync`/`statSync`/per-file `readdirSync` read is resolver-mediated against `roots:[repoAbsPath]`
- **T-15-02-02** (subprocess injection) — `git ls-files` uses argv-array form with literal constant filenames, `stdio:['ignore','pipe','pipe']`, 5s timeout
- **T-15-02-03** (DoS via huge file) — single resolved-file reads only (no recursive trees); any throw degrades the row
- **T-15-02-04** (info disclosure) — evidence strings are human-readable summaries only, never raw bytes
- **T-15-02-05 / T-15-02-SC** (no new auth surface / no new deps) — rides the existing bearer-authenticated `/api/coverage` fan-out; zero new packages

## Self-Check: PASSED

- [x] `packages/agent/src/lib/scanners/claudeMdLevelScanner.ts` — exists, 450 lines, exports `scanClaudeMdLevel` + `ScanClaudeMdLevelInput`
- [x] `packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts` — exists, 461 lines, 34 tests green
- [x] `packages/agent/src/lib/coverageScan.ts` — `scanClaudeMdLevel` referenced 2× (import + IIFE); 7-slot destructure present
- [x] Commit `8db6436` (RED) — verified in git log
- [x] Commit `7188c1e` (GREEN) — verified in git log
- [x] Commit `901b3fb` (wire) — verified in git log
- [x] Every FS read resolver-mediated; git via argv-array; evidence summary-only
