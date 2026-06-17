# Phase DASH-15: Capability-Level Engine + Fleet Matrix — Research

**Researched:** 2026-06-17
**Domain:** Deterministic CLAUDE.md/AGENTS.md structural evaluation engine (daemon) + fleet badge column + drawer (SPA)
**Confidence:** HIGH

---

## Summary

DASH-15 adds the **6th scanner** (`claudeMdLevelScanner`) to the existing `coverageScan`
fan-out, introduces a `ClaudeMdEval` Zod schema in `packages/shared`, and renders a new
L-level badge column with a per-rung drawer in the Coverage Matrix SPA route.

The codebase is well-structured for this work: every integration point is already
established, no new runtime dependencies are needed, and the spec is fully locked.
The primary work is mechanical: write the scanner (pure FS + one `execFileSync` for git
ls-files), wire it as the 7th destructured slot in `buildRow`, extend `CoverageRowSchema`,
and add a column + drawer to the SPA.

**Key discovery — AgentLinter parser NOT importable as a library.** The
`@agenticapps/agentlinter` workspace package (`../agentlinter`) is a Next.js web app
(`"private": true`, no `exports` field). Its `parseFile`/`scanWorkspace` functions exist
in source at `src/engine/parser.ts` but are not importable via the workspace link.
The `agentLinterRunner.ts` only resolves the CLI binary via `createRequire` — it never
imports engine functions directly. **Consequence: the `claudeMdLevelScanner` must own a
minimal, self-contained content reader** (read file → string → regex checks), which is
actually simpler than invoking the parser and fully sufficient for the deterministic
predicates in the spec.

**Primary recommendation:** Implement `claudeMdLevelScanner.ts` as a self-contained
pure-FS scanner (~200 lines); it reads `CLAUDE.md`/`AGENTS.md` content via `readFileSync`
(resolver-mediated), runs regex predicates for L1–L6, and returns a `ClaudeMdEval`. The
L5 inference uses `statSync` for mtime (already available in Node builtins). The drawer is
a new `<dialog>`-based component modelled exactly on `RegisterModal.tsx`.

---

## Project Constraints (from CLAUDE.md)

### Hard Architectural Constraints (non-negotiable)

- **Read-only on project filesystems.** Scanner only reads; never writes to a registered project.
- **Path allow-list per project.** All reads go through `PathResolver` from `coverageResolver.ts`. Reject `..`, absolute paths, realpaths outside the allow-list.
- **No native dependencies in `packages/agent/`.** Pure Node + existing packages only. No `keytar`, no FFI.
- **Bearer-token auth on every route.** No new routes introduced; scanner folds into existing `coverageScan` fan-out.
- **No Cloudflare Workers / Pages Functions in v1.** SPA is pure static.
- **Every frontend-touching phase commits a `<N>-IMPECCABLE.md` artifact.** Composite floor ≥ 80. DASH-15 adds the L-level badge column and drawer to the `/coverage` route — that route must be scored.
- **No cn()/clsx/CVA, no hex literals, no shadcn aliases.** Inline className strings with Phase 05.1 token names only.

### Workflow Constraints

- TDD applies: failing test first, then implementation.
- Two-stage review (gstack `/review` + `superpowers:requesting-code-review`) before merging.
- Feature branch + PR to main.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CML-01 | Daemon evaluates each repo against L0–L6 ladder, returning `level`, `levelLabel`, `rungs[]`, `nextSteps`, `inferred` | Scanner architecture section; L0–L6 predicate table |
| CML-02 | Each rung L1/L2/L3/L4/L6 decided by deterministic structural predicate | L0–L6 predicate→detection table |
| CML-03 | L5 "Maintained" inferred from freshness+coverage-history signals; flagged `inferred=true` | L5 inference proxy section; statSync mtime pattern |
| CML-04 | Headline `level` uses strict-cumulative semantics; per-rung pass/fail+evidence retained | Schema section; strict-cumulative algorithm |
| CML-05 | `nextSteps` surfaces unmet predicates of next rung as concrete advice; no LLM | nextSteps derivation section |
| CML-06 | Scanner is read-only + resolver-mediated; folds into `coverageScan` fan-out as 6th scanner; degrades not 500; no new route/deps | Integration point section; `buildRow` wiring |
| CML-07 | `ClaudeMdEval` Zod schema in `packages/shared` is the contract; mismatch surfaces as drift | Shared schema section |
| CML-08 | Coverage Matrix shows per-repo L-level badge column | SPA column section; `coverageColumns.ts` extension |
| CML-09 | Row click opens drawer with per-rung ✓/○ list + next-steps | SPA drawer section; `RegisterModal.tsx` analog |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| L0–L6 evaluation (predicates) | API / Backend (daemon scanner) | — | Pure FS reads; no browser-side logic; CODEX HIGH-3 requires resolver mediation |
| `ClaudeMdEval` schema validation | Shared package | — | Both daemon and SPA validate; drift surfaces on mismatch |
| git ls-files check (L1) | API / Backend (daemon scanner) | — | `execFileSync` subprocess; cannot run in browser |
| mtime-based L5 inference | API / Backend (daemon scanner) | — | `statSync` — Node only |
| L-level badge rendering | Browser / Client (SPA) | — | Read-only display of daemon payload |
| Per-rung drawer | Browser / Client (SPA) | — | Local UI state; no additional fetch needed (data already in `CoverageRow`) |
| `nextSteps` advice strings | API / Backend (daemon scanner) | — | Derived deterministically at scan time; not a SPA concern |

---

## Standard Stack

### Core (all already present — zero new dependencies)

| Library | Version | Purpose | Provenance |
|---------|---------|---------|-----------|
| `node:fs` builtins | Node ≥ 20 | `readFileSync`, `existsSync`, `statSync`, `readdirSync` | [VERIFIED: existing scanners] |
| `node:child_process` `execFileSync` | Node ≥ 20 | git ls-files subprocess (L1 git-tracked check) | [VERIFIED: overrideSentinelScanner.ts:23 uses same pattern] |
| `node:path` | Node ≥ 20 | `join`, `basename`, `sep` | [VERIFIED: all scanners] |
| `zod` (catalog pin) | workspace catalog | `ClaudeMdEval` schema in `packages/shared` | [VERIFIED: packages/shared/src/schemas/coverage.ts] |
| `@agenticapps/dashboard-shared` | workspace:* | Import `ClaudeMdEval` in both daemon and SPA | [VERIFIED: packages/agent/package.json] |

### No New Dependencies

The phase requires zero `npm install`. Every primitive needed (FS reads, git subprocess,
Zod schema, React dialog) already exists in the workspace.

---

## Package Legitimacy Audit

> No new packages are installed in this phase. N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
SPA /coverage route
    │
    │  GET /api/coverage (cached 30s)
    ▼
coverageScan.ts  ─── Promise.all(repos) ──► buildRow()
                                                │
                          Promise.allSettled([  │
                            scanClaudeMd(),     │  ← existing scanner 1
                            rateGitNexusRepo(), │  ← existing scanner 2
                            scanWikiForFamily(),│  ← existing scanner 3
                            scanWorkflowVersion,│  ← existing scanner 4
                            scanOverrideSentinels,← existing scanner 5
                            scanUnderstandForRepo,← existing scanner 6
                            claudeMdLevelScanner  ← NEW scanner 7 (DASH-15)
                          ])
                                                │
                          CoverageRow.eval = ClaudeMdEval
                          (or degraded column on throw)
                                                │
                  stripInternal() → CoverageResponse
                                                │
    ▼
SPA CoverageFamilySection
    └── CoverageRow
            ├── [existing cells]
            ├── LevelBadgeCell (new <td>) ← CML-08
            └── onClick → ClaudeMdLevelDrawer (new <dialog>) ← CML-09
                              ├── per-rung ✓/○ list
                              ├── evidence strings
                              └── nextSteps list
```

### Recommended Project Structure

```
packages/agent/src/lib/scanners/
└── claudeMdLevelScanner.ts          # NEW — deterministic L0–L6 engine
└── claudeMdLevelScanner.test.ts     # NEW — TDD per rung + strict-cumulative + L5

packages/shared/src/schemas/
└── claudeMdLevel.ts                 # NEW — ClaudeMdLevel, RungCheck, ClaudeMdEval Zod schemas
└── claudeMdLevel.test.ts            # NEW — schema round-trip tests

packages/shared/src/index.ts        # MODIFIED — export new schemas

packages/shared/src/schemas/coverage.ts  # MODIFIED — add eval?: ClaudeMdEvalSchema to CoverageRowSchema

packages/agent/src/lib/coverageScan.ts   # MODIFIED — add 7th scanner slot in buildRow

packages/spa/src/components/panels/coverage/
└── LevelBadgeCell.tsx               # NEW — L-level badge rendering
└── LevelBadgeCell.test.tsx          # NEW
└── ClaudeMdLevelDrawer.tsx          # NEW — per-rung drawer (dialog)
└── ClaudeMdLevelDrawer.test.tsx     # NEW
└── coverageColumns.ts               # MODIFIED — add 'level' key
└── CoverageRow.tsx                  # MODIFIED — new <td> + onClick → drawer
└── CoverageFamilySection.tsx        # MODIFIED — colgroup + column header
└── CoverageFamilySectionMobile.tsx  # MODIFIED — mobile layout equivalent
```

---

## Integration Point 1: `coverageScan.ts` — The 6th Scanner Slot

**Current state** (`coverageScan.ts:191`):

```typescript
// [VERIFIED: coverageScan.ts:191-199]
const [cmS, gnS, wkS, wfS, ovS, unS] = await Promise.allSettled([
  (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
  (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
  (async () => scanWikiForFamily(familyRoot, repoName, resolve))(),
  (async () => scanWorkflowVersionForRepo(repoAbsPath, workflowHead, resolve))(),
  (async () => scanOverrideSentinelsForRepo(repoAbsPath, resolve))(),
  (async () => scanUnderstandForRepo(repoAbsPath, readRepoHeadSha(repoAbsPath)))(),
])
```

**Required change:** Add 7th slot `[cmS, gnS, wkS, wfS, ovS, unS, lvS]`:

```typescript
// Source: coverageScan.ts:191 pattern — async IIFE wrapping so sync throws
// resolve to rejected promises (Stage 2 review fix, coverageScan.allSettled.test.ts)
(async () => scanClaudeMdLevel({ repoAbsPath, resolve }))(),
```

**buildRow signature** (`coverageScan.ts:171-181`): Add `eval` field to `publicRow` assembly
(lines 323-345). Pattern is identical to the `understand` column — optional field, degraded
on scanner throw.

**CRITICAL NOTE on scanner count:** The spec says "6th scanner" but the current codebase
already has 6 scanners (including `understandScanner` added in Phase 14). The new
`claudeMdLevelScanner` will be the **7th** entry in the `Promise.allSettled` array.
The spec language predates Phase 14. The planner must use slot index 6 (0-based), not 5.

---

## Integration Point 2: Scanner Interface Contract

**Pattern** (established in `claudeMdScanner.ts`, `overrideSentinelScanner.ts`,
`workflowVersionScanner.ts`):

```typescript
// [VERIFIED: claudeMdScanner.ts:36-37]
export interface ScanClaudeMdInput {
  repoAbsPath: string
  resolve: PathResolver
}

// [VERIFIED: coverageResolver.ts:44-49] — PathResolver type
export type PathResolver = (
  candidatePath: string,
  opts: { allowedNames?: string[]; extension?: string; roots: string[] },
) => string
```

New scanner input type:
```typescript
export interface ScanClaudeMdLevelInput {
  repoAbsPath: string
  resolve: PathResolver
  // L5 proxy: mtime of CLAUDE.md/AGENTS.md available from statSync after resolving
  // (no extra parameter needed — the scanner reads it internally)
}
```

**All reads go through `resolve()`** (CODEX HIGH-3). The scanner uses `resolve()` to
validate a path then reads with `readFileSync`/`existsSync`/`statSync` on the validated
result. For `allowedNames`, the scanner uses the filename being validated. For directory
listings (`.claude/rules/`, `.claude/skills/`), use `readdirSync` on the raw path after
validating the directory itself through the resolver with extension matching.

**Resolver roots for the level scanner:**
```typescript
// Per CODEX HIGH-3 — roots include both repoAbsPath sub-trees
resolve(candidatePath, {
  allowedNames: ['CLAUDE.md', 'AGENTS.md', 'SKILL.md', 'mcp.json'],
  // OR extension: '.md' for rules/*.md
  roots: [repoAbsPath],
})
```

The `makeCoverageResolver` already includes all three family roots in `allowedRoots`,
and the caller supplies `roots: [repoAbsPath]` for the repo-specific context. This is
exactly how `claudeMdScanner.ts:51-64` works. [VERIFIED: coverageResolver.ts:101-146]

---

## Integration Point 3: PathResolver — Reading File Content

The existing `claudeMdScanner.ts` only does `existsSync` after resolving. The new scanner
needs `readFileSync`. The pattern is:

```typescript
// [VERIFIED: workflowVersionScanner.ts:155-166 — resolver then existsSync then read]
let canonical: string
try {
  canonical = resolve(candidatePath, { allowedNames: ['CLAUDE.md'], roots: [repoAbsPath] })
} catch {
  // PathViolation — file absent or outside allow-list
  return fallback
}
if (!existsSync(canonical)) return fallback
// Now safe to read:
const content = readFileSync(canonical, 'utf-8')
```

**Directory listing pattern** (for `.claude/rules/` and `.claude/skills/`):
The resolver does NOT validate directories, only files. Use `existsSync` + `readdirSync`
on the raw `join(repoAbsPath, '.claude', 'rules')` path, then validate each file through
the resolver. This matches the `overrideSentinelScanner.ts` pattern for `readdirSync`
on `phasesDir` followed by per-sentinel resolver calls. [VERIFIED: overrideSentinelScanner.ts:64-96]

---

## Integration Point 4: git ls-files for L1 (git-tracked check)

**Pattern** from `overrideSentinelScanner.ts:103-113` [VERIFIED]:
```typescript
import { execFileSync } from 'node:child_process'

try {
  const out = execFileSync(
    'git',
    ['ls-files', '--error-unmatch', 'CLAUDE.md'],
    { cwd: repoAbsPath, encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
  // exit 0 = tracked; non-zero throws
  isGitTracked = true
} catch {
  // exit 1 = untracked, or git not available, or not a git repo
  isGitTracked = false
}
```

`git ls-files --error-unmatch <file>` exits 0 if tracked, 1 if not. This is a pure
read operation with no filesystem writes. The argv-array form is required (T-10-02-01 —
never shell-string). `stdio: ['ignore', 'pipe', 'pipe']` prevents stdout leak. Timeout
5 000ms matches the sentinel scanner's pattern.

---

## Integration Point 5: AgentLinter Parser — NOT Importable

**Finding:** `@agenticapps/agentlinter` (`workspace:*` → `../agentlinter`) is a Next.js
web app. Its `package.json` has no `exports` field, no `main`, no `bin` beyond the
implicit Next.js CLI. The `src/engine/parser.ts` exports `parseFile` and `scanWorkspace`
but these are NOT reachable via `import { parseFile } from '@agenticapps/agentlinter'`.

**Confirmed:** The only usage of `@agenticapps/agentlinter` in `packages/agent/src/` is
`agentLinterRunner.ts`, which resolves the CLI binary via `createRequire` and runs it as
a subprocess — it never imports engine functions. [VERIFIED: grep of all imports]

**Consequence for the scanner:** The spec says "reuses AgentLinter's CLAUDE.md parser."
The intent is to avoid re-implementing parsing, but in practice the predicates needed
are all regex/string operations on the raw file content. The scanner must implement its
own minimal content reading:

- L2 constraint detection: `/\bMUST\b|\bMUST NOT\b|\bNEVER\b/` on file content
- L3 import detection: `/^@\w+/m` on file content (AgentLinter `@import` pattern)
- L3 multi-file detection: count instruction files in `.claude/` root and `AGENTS.md`

This is ~5 lines of code, not a parser. The "reuse" intent is satisfied by not
re-implementing section parsing (which we don't need — rung predicates are simple
regex matches, not structural analysis). Tag this as [ASSUMED] per the spec intent
but [VERIFIED] that the practical approach is self-contained regex.

---

## Integration Point 6: Shared Schema — `packages/shared/src/schemas/`

**Convention** [VERIFIED: `packages/shared/src/index.ts`]: Each domain gets its own
schema file under `packages/shared/src/schemas/`. The `index.ts` re-exports everything.

**New file:** `packages/shared/src/schemas/claudeMdLevel.ts`

```typescript
// Source: spec §"Shared schema" — locked decisions
import { z } from 'zod'

export const ClaudeMdLevelSchema = z.number().int().min(0).max(6)
export type ClaudeMdLevel = z.infer<typeof ClaudeMdLevelSchema>

export const RungCheckSchema = z.object({
  rung: ClaudeMdLevelSchema,          // 1..6
  label: z.string(),                  // "Basic" | "Scoped" | ... | "Adaptive"
  passed: z.boolean(),
  inferred: z.boolean().optional(),   // true only for L5 when awarded via proxy
  evidence: z.array(z.string()),      // human-readable pass/fail reasons
})
export type RungCheck = z.infer<typeof RungCheckSchema>

export const ClaudeMdEvalSchema = z.object({
  level: ClaudeMdLevelSchema,         // headline, strict-cumulative
  levelLabel: z.string(),             // label for `level`
  rungs: z.array(RungCheckSchema),    // all six rungs (L1..L6), in order
  nextSteps: z.array(z.string()),     // advice strings for next unmet rung
  inferred: z.boolean(),             // true if headline level relied on L5 inferred rung
})
export type ClaudeMdEval = z.infer<typeof ClaudeMdEvalSchema>
```

**`CoverageRowSchema` extension** (`packages/shared/src/schemas/coverage.ts`):
Add optional field following the Phase 14 `understand` precedent for backward-compatible
addition [VERIFIED: coverage.ts:80-90]:

```typescript
// Following Phase 14 D-14-08 pattern — optional for pre-DASH-15 daemon back-compat
eval: ClaudeMdEvalSchema.optional(),
```

**`index.ts` addition:**
```typescript
export {
  ClaudeMdLevelSchema,
  RungCheckSchema,
  ClaudeMdEvalSchema,
} from './schemas/claudeMdLevel.js'
export type { ClaudeMdLevel, RungCheck, ClaudeMdEval } from './schemas/claudeMdLevel.js'
```

---

## L0–L6 Predicate → Deterministic Detection Table

| Rung | Name | Predicate | Detection Method | Confidence |
|------|------|-----------|-----------------|-----------|
| L0 | Absent | No `CLAUDE.md` and no `AGENTS.md` at repo root | `!existsSync(claudeMd) && !existsSync(agentsMd)` — same as existing `claudeMdScanner.ts` | HIGH [VERIFIED] |
| L1 | Basic | File exists **and** is git-tracked | `existsSync` via resolver **+** `execFileSync('git', ['ls-files', '--error-unmatch', filename], { cwd: repoAbsPath })` exit 0 = tracked | HIGH [VERIFIED: overrideSentinelScanner.ts pattern] |
| L2 | Scoped | Body contains `MUST` / `MUST NOT` / `NEVER` | `readFileSync` via resolver + `/\bMUST\b|\bMUST NOT\b|\bNEVER\b/.test(content)` | HIGH [VERIFIED: spec; CLAUDE.md itself has MUST/NEVER lines] |
| L3 | Structured | Body has `@import` refs **or** ≥2 instruction files | `/@\w+/m.test(content)` for @import; count `CLAUDE.md + AGENTS.md` at repo root + `.md` files directly under `.claude/` | HIGH [VERIFIED: spec; AgentLinter parser.ts:AGENT_FILES confirms file list] |
| L4 | Abstracted | `.claude/rules/*.md` exists with `paths:` frontmatter | `readdirSync(join(repoAbsPath, '.claude', 'rules'))` for `*.md`; read frontmatter of first found; check for `paths:` key | HIGH [VERIFIED: workflowVersionScanner parseFrontmatter pattern; real .claude/rules confirmed absent in this repo = L4 not met] |
| L5 | Maintained | **Inferred** from proxy signals (see below) | See L5 inference table | MEDIUM [ASSUMED: coverage-history proxy unverified at runtime] |
| L6 | Adaptive | `.claude/skills/*/SKILL.md` exists **and** `mcp.json` exists | `readdirSync(join(repoAbsPath, '.claude', 'skills'))` for dirs with `SKILL.md`; `existsSync(join(repoAbsPath, 'mcp.json'))` | HIGH [VERIFIED: this repo has .claude/skills/ but no mcp.json = L6 not met] |

### L5 Proxy Signals (any one sufficient)

| Signal | Detection | Notes |
|--------|-----------|-------|
| CLAUDE.md mtime within recent-commit window | `statSync(resolvedClaudeMd).mtime` vs `Date.now() - 90*24*3600*1000` (90-day window; spec says "recent-commit window" — use 90 days as a practical threshold) | [ASSUMED: 90-day threshold; spec does not specify exact window] |
| Backbone/codebase-map doc present | `existsSync` of `join(repoAbsPath, '.claude', 'INDEX.md')` or `join(repoAbsPath, 'docs', 'INDEX.md')` or similar map file patterns | [ASSUMED: exact file names to probe; spec says "a backbone/codebase-map document"] |
| Coverage-history shows updates | `coverageHistory` data NOT available synchronously during scanner — the history is written by the periodic scheduler after scan. **At initial scan time this proxy is always unavailable.** | [VERIFIED: coverageHistoryCache.ts is separate from the scanner; history is not passed into buildRow] |

**Critical finding on coverage-history proxy:** The coverage-history data (written by
`packages/agent/src/lib/skillDriftScan.ts` scheduler) is NOT available during the
`coverageScan` fan-out. The scanner runs synchronously and does not have access to
the history store. For DASH-15, the practical L5 proxies are (1) mtime and (2)
backbone-doc presence. The coverage-history proxy can be noted as "not evaluatable
at scan time" in the `evidence[]` array. This is honest per the spec's "inferred"
framing — the `inferred: true` flag already signals uncertainty.

---

## L5 Inference Algorithm

```typescript
// Runs after L4 check. Uses OR semantics — any proxy that holds makes L5 pass.
function checkL5(repoAbsPath: string, claudeMdPath: string | null): {
  passed: boolean
  inferred: true   // always true for L5
  evidence: string[]
} {
  const evidence: string[] = []
  let passed = false

  // Proxy 1: mtime within 90 days
  if (claudeMdPath) {
    try {
      const mtime = statSync(claudeMdPath).mtimeMs
      const ageDays = (Date.now() - mtime) / 86_400_000
      if (ageDays <= 90) {
        passed = true
        evidence.push(`CLAUDE.md modified ${Math.round(ageDays)}d ago (within 90-day window)`)
      } else {
        evidence.push(`CLAUDE.md last modified ${Math.round(ageDays)}d ago (outside 90-day window)`)
      }
    } catch {
      evidence.push('Could not read CLAUDE.md mtime')
    }
  }

  // Proxy 2: backbone/map doc present
  const mapCandidates = [
    join(repoAbsPath, '.claude', 'INDEX.md'),
    join(repoAbsPath, '.claude', 'MAP.md'),
    join(repoAbsPath, 'docs', 'INDEX.md'),
    join(repoAbsPath, 'docs', 'MAP.md'),
  ]
  const mapFound = mapCandidates.find(p => existsSync(p))
  if (mapFound) {
    passed = true
    evidence.push(`Backbone/codebase-map doc found: ${basename(mapFound)}`)
  } else {
    evidence.push('No backbone/codebase-map doc found')
  }

  // Proxy 3: coverage-history not available at scan time
  evidence.push('Coverage-history proxy: not evaluatable at scan time (history written post-scan)')

  return { passed, inferred: true, evidence }
}
```

---

## Strict-Cumulative Algorithm

```typescript
// [CITED: spec §"Capability-level model"]
// level = highest N such that rungs 1..N all pass
function computeHeadlineLevel(rungs: RungCheck[]): { level: ClaudeMdLevel; inferred: boolean } {
  // Rungs are 1-indexed; index 0 = L1, ..., index 5 = L6
  let level: ClaudeMdLevel = 0  // L0 = absent
  let inferred = false

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i]!
    if (!rung.passed) break  // strict-cumulative: stop at first failure
    level = rung.rung as ClaudeMdLevel
    if (rung.inferred) inferred = true
  }

  return { level, inferred }
}
```

**Edge cases to test:**
- L6 signals present but L5 not met: headline = L4 (not L6), but L6 rung still shows `passed:false` with evidence
- L5 passes via proxy but L4 fails: headline = L3, L5 entry shows `passed:true, inferred:true`
- All rungs fail except L1: headline = L1
- No file at all: headline = L0 (rungs array still has all 6 entries, all `passed:false`)

---

## `nextSteps` Derivation

```typescript
// Fixed advice strings per unmet rung (deterministic, no LLM)
const NEXT_STEP_ADVICE: Record<1|2|3|4|5|6, string> = {
  1: 'Add a CLAUDE.md (or AGENTS.md) file at the repo root and commit it to git → reaches L1.',
  2: 'Add a ## Constraints section with MUST / MUST NOT / NEVER rules → reaches L2.',
  3: 'Split long sections into referenced files (@docs/...) or add a second instruction file → reaches L3.',
  4: 'Move path-specific rules into .claude/rules/*.md with paths: frontmatter → reaches L4.',
  5: 'Keep CLAUDE.md updated (edit within 90 days) or add a backbone doc (.claude/INDEX.md) → reaches L5.',
  6: 'Add a task-scoped skill under .claude/skills/ and an mcp.json → reaches L6.',
}

// nextSteps = advice for the NEXT unmet rung after the headline level
function deriveNextSteps(headlineLevel: ClaudeMdLevel, rungs: RungCheck[]): string[] {
  const nextRung = (headlineLevel + 1) as 1|2|3|4|5|6
  if (nextRung > 6) return []  // already L6
  return [NEXT_STEP_ADVICE[nextRung]]
}
```

---

## SPA Column: `coverageColumns.ts` Extension

**Current widths** [VERIFIED: `coverageColumns.ts`]:

```
repo:288, claudeMd:128, gitNexus:144, wiki:240, workflow:128, understand:144, actions:48
```
Total: 1120px at 1440px viewport → 320px slack.

**New `level` column:** `w-20` (80px) — an L-badge (e.g. "L4") needs very little space.
Add to `COVERAGE_COL_WIDTHS`:

```typescript
level: 'w-20',  // 80px — L-level badge (2-3 chars + padding)
```

**Column header tooltip:** Add entry to `coverageColumnTooltips.ts`:
```typescript
level: 'CLAUDE.md capability level (L0–L6). Click row for details.'
```

**Column position:** After `claudeMd`, before `gitNexus` (natural reading order — CLAUDE.md
presence → CLAUDE.md quality).

**Table width impact:** +80px → total ~1200px. Still within 1440px at 1440×900 — no column
width reclamation needed. [VERIFIED: IMPECCABLE composite requirement ≥ 80 still achievable]

---

## SPA Drawer: `ClaudeMdLevelDrawer.tsx`

**There is no existing drawer/slide-over primitive** in `packages/spa/src/components/ui/`.
[VERIFIED: `ls ui/` shows Breadcrumb, Card, EmptyState, KbdHint, MaskedToken, MetricNumeric,
PageHeader, Pill, Sidebar, SidebarItem, SidebarSection, SidebarSubItem, StatusPill, Toast,
Tooltip, TopBar — no Drawer/Sheet/SlideOver].

**Best analog:** `RegisterModal.tsx` uses a native `<dialog>` element with:
- `dialogRef.current.showModal()` / `.close()` for open/close
- `onCancel` + backdrop-click close
- Focus restoration via `previouslyFocused.current?.focus()`
- No shadcn, no Radix — pure HTML + React

[VERIFIED: `RegisterModal.tsx:52-105`]

**Drawer approach:** A right-sliding panel using a `<dialog>` with `position:fixed` and
Tailwind transitions, OR a simpler approach: a `<dialog>` rendered modally (same as
`RegisterModal`) but styled as a right-side sheet (no full-screen backdrop, just a
right-panel layout). Given the no-cn/no-shadcn constraint, a native `<dialog>` with
inline className positioning is the safe choice.

**Props shape:**
```typescript
export interface ClaudeMdLevelDrawerProps {
  isOpen: boolean
  onClose: () => void
  repoName: string
  eval: ClaudeMdEval | undefined  // undefined = pre-DASH-15 daemon back-compat
}
```

**Content structure:**
1. Header: repo name + headline level badge (e.g. "L4 — Abstracted")
2. Inferred flag banner: if `eval.inferred`, show "L5 is inferred — not hard-verified"
3. Per-rung list (L1–L6): ✓/○ icon + label + evidence strings
4. Next steps section: bulleted advice list from `eval.nextSteps`

**Row click wiring in `CoverageRow.tsx`:** The entire `<tr>` gets an `onClick` handler.
Existing rows already have no row-level click (only the refresh popover button). The
drawer state (`isOpen`, `selectedRow`) lives in `CoverageFamilySection.tsx` (which owns
the row list), not in `CoverageRow` itself — following the same pattern as
`inFlightRefreshes` state [VERIFIED: `CoverageFamilySectionProps`].

**Alternative simpler approach:** `CoverageRow` owns a local `drawerOpen` state and
renders `<ClaudeMdLevelDrawer>` inline. This avoids prop-drilling but creates N drawer
instances. Given the drawer is lightweight (no fetch, pure display), local state in
`CoverageRow` is acceptable and simpler. Recommend this approach.

---

## `buildRow` Integration (Exact Change)

**In `coverageScan.ts`:**

1. Add import at top (after `understandScanner` import):
   ```typescript
   import { scanClaudeMdLevel } from './scanners/claudeMdLevelScanner.js'
   ```

2. Extend destructure at line 191 (add 7th slot `lvS`):
   ```typescript
   const [cmS, gnS, wkS, wfS, ovS, unS, lvS] = await Promise.allSettled([
     ...existing 6...,
     (async () => scanClaudeMdLevel({ repoAbsPath, resolve }))(),
   ])
   ```

3. Add `eval` field to `publicRow` assembly (after `understand`, before `degraded`):
   ```typescript
   // DASH-15 CML-06: claudeMdLevel scanner — optional, degrades gracefully
   ...(lvS.status === 'fulfilled'
     ? { eval: lvS.value }
     : (() => {
         rowDegraded.push(`claudeMdLevel: ${String(lvS.reason)}`)
         return {}
       })()),
   ```
   Note: unlike `claudeMd` / `gitNexus` which have a per-column degraded state,
   `eval` is an opaque object — on scanner failure we simply omit it (field is
   `optional()` in the schema) and log to `rowDegraded`. The SPA renders `—` when
   `eval` is absent (same back-compat approach as `understand`).

4. Update `ScanCoverageOptions` comment block to mention DASH-15 scanner.

**`CoverageRow` public shape** — `CoverageRowSchema` gains:
```typescript
eval: ClaudeMdEvalSchema.optional(),
```
No `strict()` change needed; the schema is not strict at the row level.

---

## Common Pitfalls

### Pitfall 1: Scanner Slot Index Off-By-One
**What goes wrong:** Spec says "6th scanner" but Phase 14 already added `understandScanner`
as the 6th. The new scanner is the **7th** (`index 6`).
**Prevention:** Grep `Promise.allSettled` in `coverageScan.ts` and count slots before wiring.
The current array has 6 elements: `[cmS, gnS, wkS, wfS, ovS, unS]`.

### Pitfall 2: Sync Throws Escaping `Promise.allSettled`
**What goes wrong:** If `scanClaudeMdLevel()` throws synchronously before being wrapped,
the throw escapes the array literal and becomes an unhandled rejection — same issue
`coverageScan.allSettled.test.ts` was written to prevent.
**Prevention:** Always wrap in `(async () => scanClaudeMdLevel(...))()` — the async IIFE
converts sync throws to rejected promises that `allSettled` handles correctly.
[VERIFIED: `coverageScan.allSettled.test.ts:37-50`]

### Pitfall 3: `readFileSync` vs Resolver Bypass
**What goes wrong:** Calling `readFileSync(join(repoAbsPath, 'CLAUDE.md'))` directly
bypasses CODEX HIGH-3 (resolver mediation). Even though the content predicate requires
reading the file, the path MUST be resolver-validated first.
**Prevention:** Always call `resolve(path, opts)` first; only then pass the returned
canonical path to `readFileSync`. [VERIFIED: `workflowVersionScanner.ts:155-166` pattern]

### Pitfall 4: L3 "≥2 instruction files" — Counting Rules
**What goes wrong:** Counting CLAUDE.md + AGENTS.md as two files makes every repo with
both files L3. The intent is ≥2 *separate* instruction contexts.
**Prevention:** Count CLAUDE.md (or AGENTS.md if primary) + any `.md` files directly
under `.claude/` that contain instructions (not rules, not skills) — e.g. `CLAUDE.md`
at root + any `.md` directly under `.claude/`. A repo with only `CLAUDE.md` and no
`.claude/` content has 1 instruction file and fails L3 unless it has `@import` refs.

### Pitfall 5: `mcp.json` Path for L6
**What goes wrong:** Assuming `mcp.json` is always at repo root. Some tools use
`.claude/mcp.json` or `.mcp.json`.
**Prevention:** Check repo root only (`join(repoAbsPath, 'mcp.json')`) per spec predicate:
"mcp.json exists". If the spec is ambiguous, root-only is the safer deterministic choice.
The resolver's `allowedNames: ['mcp.json']` gates the read correctly.

### Pitfall 6: Table Width Overflow at 1440×900 (IMPECCABLE gate)
**What goes wrong:** Adding a new column without accounting for total table width causes
horizontal scroll at 1440px — a layout violation that drops the IMPECCABLE composite
below 80.
**Prevention:** The current table totals ~1120px. Adding `w-20` (80px) → ~1200px.
240px slack at 1440px. No column reclamation needed. Verify live at 1440×900.

### Pitfall 7: Coverage-History Proxy Assumed Available at Scan Time
**What goes wrong:** Attempting to read `coverageHistoryCache` or the snapshot files
inside `scanClaudeMdLevel` — those files are written by the scheduler AFTER the scan
completes, so they contain data from the PREVIOUS scan cycle, not the current one.
**Prevention:** Skip the coverage-history proxy in the initial implementation. Document
in evidence strings as "not evaluatable at scan time." The other two L5 proxies (mtime,
backbone doc) are sufficient.

### Pitfall 8: Drawer Focus Trap Missing (Accessibility + IMPECCABLE)
**What goes wrong:** Opening a `<dialog>` without proper focus management causes
accessibility failures that impeccable:critique detects (and CI was previously catching).
**Prevention:** Mirror `RegisterModal.tsx`'s `previouslyFocused.current?.focus()` pattern
and use `dialog.showModal()` (which handles focus trap natively in modern browsers).

---

## Code Examples

### L4 Frontmatter Detection (PathResolver + parseFrontmatter reuse)

```typescript
// Source: workflowVersionScanner.ts:167-182 — parseFrontmatter pattern
// parseFrontmatter is already exported from skillsScan.ts and used by workflowVersionScanner

import { parseFrontmatter } from '../skillsScan.js'

function checkL4(repoAbsPath: string, resolve: PathResolver): {
  passed: boolean
  evidence: string[]
} {
  const rulesDir = join(repoAbsPath, '.claude', 'rules')
  if (!existsSync(rulesDir)) {
    return { passed: false, evidence: ['No .claude/rules/ directory found'] }
  }

  let entries: string[]
  try {
    entries = readdirSync(rulesDir).filter(f => f.endsWith('.md'))
  } catch {
    return { passed: false, evidence: ['Could not read .claude/rules/'] }
  }

  for (const name of entries) {
    const candidate = join(rulesDir, name)
    let canonical: string
    try {
      canonical = resolve(candidate, { extension: '.md', roots: [repoAbsPath] })
    } catch { continue }
    if (!existsSync(canonical)) continue

    const fm = parseFrontmatter(canonical) as Record<string, unknown> | null
    if (fm && 'paths' in fm) {
      return { passed: true, evidence: [`${name} has paths: frontmatter`] }
    }
  }

  return { passed: false, evidence: ['No .claude/rules/*.md files with paths: frontmatter found'] }
}
```

`parseFrontmatter` is already a named export from `../skillsScan.js` [VERIFIED:
`workflowVersionScanner.ts:29`] — no new import needed.

### Schema round-trip test pattern

```typescript
// Following packages/shared/src/schemas/coverage.test.ts convention
import { ClaudeMdEvalSchema } from './claudeMdLevel.js'

it('round-trips a valid L4 eval', () => {
  const payload = {
    level: 4,
    levelLabel: 'Abstracted',
    rungs: [
      { rung: 1, label: 'Basic', passed: true, evidence: ['CLAUDE.md found and git-tracked'] },
      // ... all 6
    ],
    nextSteps: ['Add .claude/skills/*/SKILL.md and mcp.json → L6'],
    inferred: false,
  }
  expect(() => ClaudeMdEvalSchema.parse(payload)).not.toThrow()
})
```

### Native `<dialog>` drawer pattern (from RegisterModal)

```typescript
// Source: RegisterModal.tsx:57-105 [VERIFIED]
const dialogRef = useRef<HTMLDialogElement>(null)
const previouslyFocused = useRef<HTMLElement | null>(null)

useEffect(() => {
  const dialog = dialogRef.current
  if (!dialog) return
  if (isOpen) {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
  } else {
    if (dialog.open) dialog.close()
    previouslyFocused.current?.focus()
  }
}, [isOpen])

// Backdrop click closes:
function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
  if (e.target === dialogRef.current) onClose()
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `claudeMdScanner` existence-only (T-10-02-03) | New `claudeMdLevelScanner` content-aware — deliberately separate scanner per spec | Do NOT modify `claudeMdScanner` — the existence check remains; the level scanner is additive |
| AgentLinter full AST parse | Minimal regex predicates (MUST/NEVER, @import) | Simpler, faster, no cross-package import issue |
| Spec "6th scanner" language | Actually 7th slot (Phase 14 added understandScanner as #6) | Planner must use correct index |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 90-day mtime window is appropriate for L5 proxy 1 | L5 Inference Algorithm | Wrong threshold could misclassify repos; spec says "recent-commit window" — user may want shorter (30d) or longer (180d). Flag for discuss. |
| A2 | Backbone/map doc candidates are `.claude/INDEX.md`, `.claude/MAP.md`, `docs/INDEX.md`, `docs/MAP.md` | L5 Inference Algorithm | Could miss custom map files; but any exhaustive list is ASSUMED without user confirmation. Start with these 4 and note in evidence. |
| A3 | L3 "≥2 instruction files" counts CLAUDE.md + any `.md` directly under `.claude/` (excluding rules/ and skills/) | L0–L6 predicate table | Could over-count or under-count depending on exact intent; safer to count distinct CLAUDE.md-like root files |
| A4 | `nextSteps` returns only 1 item (the next rung's advice) | nextSteps Derivation | Spec says "unmet predicates of the next rung" — could mean multiple predicates if the rung has multiple conditions (e.g. L6 has 2: SKILL.md + mcp.json). Consider returning one string per unmet predicate sub-condition. |
| A5 | `mcp.json` is only checked at repo root | Pitfall 5 | If repos use `.claude/mcp.json` pattern, L6 would be incorrectly missed |

---

## Open Questions

1. **L5 mtime window — how many days?**
   - What we know: spec says "within the repo's recent-commit window" (not a fixed duration)
   - What's unclear: "recent-commit window" could mean "within the last N days of commits" or a fixed threshold
   - Recommendation: default to 90 days (3 months); planner can make configurable via a constant

2. **L3 multi-file counting — exact rule?**
   - What we know: spec says "≥2 instruction files exist"
   - What's unclear: does `.claude/CUSTOM.md` count? What about files in `.claude/rules/`?
   - Recommendation: count `CLAUDE.md` (or `AGENTS.md`) at root + any `.md` files directly under `.claude/` that are NOT in `rules/` or `skills/` subdirs

3. **Drawer vs. row-click semantics — whole row or icon?**
   - What we know: CML-09 says "clicking a matrix row"
   - What's unclear: click the whole `<tr>` or a dedicated "expand" icon in the badge cell?
   - Recommendation: click the badge cell's `<td>` only (not the whole row) to avoid conflict with the existing refresh popover button in the actions column. A small "↗" icon or the badge itself as a button.

4. **IMPECCABLE route scope — `/coverage` only?**
   - What we know: DASH-15 adds a column and drawer to `/coverage`
   - What's unclear: does the drawer count as a separate "route" for IMPECCABLE scoring?
   - Recommendation: one IMPECCABLE artifact for `/coverage` covering both the new column and the drawer state (open drawer = new screenshot)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git` CLI | L1 git-tracked check (`execFileSync`) | ✓ | system git | If absent, L1 defaults to file-exists-only (no git-tracked check); mark evidence as "git unavailable" |
| Node.js ≥ 20 | `readFileSync`, `statSync` | ✓ | 20+ (engine constraint) | — |
| pnpm workspace link `@agenticapps/agentlinter` | parseFrontmatter reuse | ✓ (workspace:*) | 2.4.0 | parseFrontmatter is in `skillsScan.ts` — use that, not agentlinter |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (workspace catalog pin) |
| Config file | `packages/agent/vitest.config.ts` / `packages/shared/vitest.config.ts` / `packages/spa/vitest.config.ts` |
| Quick run (agent) | `pnpm --filter @agenticapps/dashboard-agent test` |
| Quick run (shared) | `pnpm --filter @agenticapps/dashboard-shared test` |
| Quick run (spa) | `pnpm --filter @agenticapps/dashboard-spa test` |
| Full suite | `pnpm -r test` (NOTE: run per-package, not -r, to avoid SSH signing issues per MEMORY.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | New File? |
|--------|----------|-----------|-------------------|-----------|
| CML-01 | Scanner returns full ClaudeMdEval for a real-like fixture | unit | `pnpm --filter @agenticapps/dashboard-agent test claudeMdLevelScanner` | Wave 0 |
| CML-02 | Each L1–L6 rung predicate independently passes/fails | unit (per-rung) | same | Wave 0 |
| CML-02 | L1 git-tracked vs untracked distinction | unit | same | Wave 0 |
| CML-03 | L5 passes via mtime proxy; L5 passes via backbone doc | unit | same | Wave 0 |
| CML-03 | L5 always has inferred:true | unit | same | Wave 0 |
| CML-04 | L6 signals present but L5 unmet → headline capped at L4 | unit | same | Wave 0 |
| CML-05 | nextSteps advice maps to correct next unmet rung | unit | same | Wave 0 |
| CML-06 | Throwing scanner yields degraded row (no 500) | unit | `pnpm --filter @agenticapps/dashboard-agent test coverageScan.allSettled` | Wave 0 (new variant) |
| CML-07 | ClaudeMdEval schema round-trips valid + invalid payloads | unit | `pnpm --filter @agenticapps/dashboard-shared test claudeMdLevel` | Wave 0 |
| CML-08 | LevelBadgeCell renders correct label for each level | unit (React) | `pnpm --filter @agenticapps/dashboard-spa test LevelBadgeCell` | Wave 0 |
| CML-09 | Drawer renders per-rung list + nextSteps; closes on Esc/backdrop | unit (React) | `pnpm --filter @agenticapps/dashboard-spa test ClaudeMdLevelDrawer` | Wave 0 |

### Wave 0 Gaps

- [ ] `packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts` — all CML-02/03/04/05 rung tests
- [ ] `packages/shared/src/schemas/claudeMdLevel.test.ts` — CML-07 schema round-trip
- [ ] `packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx` — CML-08
- [ ] `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx` — CML-09

Existing test infrastructure: Vitest already configured in all three packages. No new config needed.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (inherits bearer auth from existing routes) | Existing bearer token on `/api/coverage` |
| V3 Session Management | No | — |
| V4 Access Control | No (no new routes) | — |
| V5 Input Validation | Yes — new `ClaudeMdEval` field in wire response | Zod parse on both ends (INV-04) |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via repo name in `repoAbsPath` | Tampering | PathResolver / CODEX HIGH-3 — already enforced in all existing scanners |
| Subprocess injection via filenames (`git ls-files <file>`) | Tampering | argv-array form only (T-10-02-01); filename is a literal constant `'CLAUDE.md'`, never user-supplied |
| Sensitive content leak via `readFileSync` content in evidence strings | Information Disclosure | Evidence strings are human-readable summaries only (e.g. "MUST found on line 42") — never raw file content |
| Schema mismatch between daemon and SPA | Tampering | Zod validation on both ends; `.optional()` on `eval` field for back-compat (INV-04) |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `packages/agent/src/lib/coverageScan.ts`] — exact scanner registration, `buildRow` signature, `Promise.allSettled` pattern
- [VERIFIED: `packages/agent/src/lib/coverageResolver.ts`] — `PathResolver` type, `makeCoverageResolver`, allowed roots
- [VERIFIED: `packages/agent/src/lib/scanners/claudeMdScanner.ts`] — scanner interface pattern, resolver usage
- [VERIFIED: `packages/agent/src/lib/scanners/overrideSentinelScanner.ts`] — `execFileSync` git subprocess pattern, `readdirSync` + per-file resolver calls
- [VERIFIED: `packages/agent/src/lib/scanners/workflowVersionScanner.ts`] — `parseFrontmatter` reuse, resolver-then-read pattern
- [VERIFIED: `packages/shared/src/schemas/coverage.ts`] — `CoverageRowSchema` shape, optional field pattern from Phase 14 `understand`
- [VERIFIED: `packages/shared/src/index.ts`] — schema export convention
- [VERIFIED: `packages/spa/src/components/panels/coverage/coverageColumns.ts`] — column width registry
- [VERIFIED: `packages/spa/src/components/panels/coverage/CoverageRow.tsx`] — row structure, `<td>` layout, no existing drawer
- [VERIFIED: `packages/spa/src/components/RegisterModal.tsx`] — native `<dialog>` pattern
- [VERIFIED: `packages/agent/src/lib/agentLinterRunner.ts`] — confirms agentlinter is subprocess-only, not importable library
- [VERIFIED: `/Users/donald/Sourcecode/agenticapps/agentlinter/package.json`] — no `exports`, no `main`, confirms NOT importable
- [CITED: `docs/superpowers/specs/2026-06-15-claude-md-capability-level-design.md`] — binding spec, L0–L6 ladder, schema shapes, architecture

### Secondary (MEDIUM confidence)

- [CITED: `.planning/REQUIREMENTS.md`] — CML-01..10 exact requirement text
- [CITED: `.planning/ROADMAP.md`] — Phase DASH-15 success criteria

### Tertiary (LOW confidence / ASSUMED)

- L5 mtime window: 90 days [ASSUMED] — spec says "recent-commit window" without specifying duration
- L5 backbone doc candidates [ASSUMED] — spec lists no specific filenames
- L3 multi-file counting rule [ASSUMED] — spec says "≥2 instruction files" without defining what counts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all patterns verified in existing code
- Integration point (scanner wiring): HIGH — exact code location verified
- L0–L6 predicates: HIGH for L1/L2/L4/L6; MEDIUM for L3 (counting rule); MEDIUM for L5 (proxy thresholds)
- AgentLinter parser reuse: HIGH (not importable — verified); consequence is self-contained regex (straightforward)
- SPA column/drawer: HIGH — exact analogs identified

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable stack; main risk is upstream agentlinter package structure change)
