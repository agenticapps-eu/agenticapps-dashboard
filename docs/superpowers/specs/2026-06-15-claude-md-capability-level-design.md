# Design: CLAUDE.md Capability-Level Evaluation

**Date:** 2026-06-15
**Status:** Approved (brainstorming) — ready for planning
**Author:** Donald (with Claude)
**Source idea:** "CLAUDE.md best practices — From Basic to Adaptive" (Gábor Mészáros / RepoRails), capability levels L0–L6.

## Summary

Add a per-repo **capability-level evaluation** of each registered project's `CLAUDE.md`/`AGENTS.md`
setup, graded against the RepoRails **L0–L6 ladder**, surfaced two ways:

1. An **L-level badge column** in the existing fleet **Coverage Matrix**, with a click-to-open drawer.
2. A richer **"CLAUDE.md Maturity" panel** in the single-project view.

Both show **why** a level was assigned (per-rung evidence) and **what to do to improve**
(the unmet predicates of the next rung, rendered as concrete advice).

This is **new scope**. v1.3 (open-source readiness, Phase 9) remains the current next milestone;
this feature does not block or depend on it and should be scheduled as its own milestone/phase pair.

## Background & relationship to existing features

Two existing pieces sit on adjacent axes; this feature deliberately lands between them and reuses both:

- **Coverage Matrix** (DASH-10) already reports per-repo CLAUDE.md **presence/freshness** across the
  fleet — but by explicit design (`T-10-02-03`) the `claudeMdScanner` only does `existsSync`; it
  **never reads content**, only `fresh` vs `missing`. Capability level is a *new, content-aware axis*.
- **AgentLinter** (`packages/agentlinter`) already **parses and scores** CLAUDE.md content across rich
  quality rules (clarity, completeness, consistency, freshness, memory…). Its parser is reused here;
  its *quality score* is a different axis from the *structural maturity ladder*.

The L0–L6 ladder is a **structural maturity** measure — almost entirely detectable from on-disk
structure, which is exactly what the daemon already does for coverage.

## Capability-level model

The headline level uses **strict cumulative** semantics: `level = highest N such that rungs 1..N all pass`.
The detail views additionally render a **per-rung ✓/○ list with evidence**, so a repo with detectable
higher-rung signals but an unmet lower rung (e.g. L6 skills present but L5 maintenance unproven) shows the
gap honestly even though the headline number caps at the break.

| Rung | Name | Predicate (deterministic unless noted) |
|---|---|---|
| L0 | Absent | No `CLAUDE.md` and no `AGENTS.md` at repo root |
| L1 | Basic | File exists **and** is git-tracked (`git ls-files CLAUDE.md`/`AGENTS.md`) |
| L2 | Scoped | Parsed body contains an explicit constraint: `MUST` / `MUST NOT` / `NEVER` |
| L3 | Structured | Body has `@import` references **or** ≥2 instruction files exist |
| L4 | Abstracted | `.claude/rules/*.md` exists with `paths:` frontmatter (path-scoped loading) |
| L5 | Maintained | **Inferred** (see below) — flagged as such, never claimed as certain |
| L6 | Adaptive | `.claude/skills/*/SKILL.md` exists **and** `mcp.json` exists |

### L5 "Maintained" — inferred, flagged

L5 is the only rung without certain on-disk proof (it's about discipline over time). It is **inferred**
from signals the daemon already computes; if **any** hold, L5's predicate passes and the rung is badged
`inferred`:

- `CLAUDE.md` mtime falls within the repo's recent-commit window (the freshness scanner) → kept current.
- A backbone/codebase-map document is present (e.g. a map/`INDEX` doc under `.claude/` or docs).
- Coverage-history (`coverageHistory`) shows the file has been updated over time.

The `inferred` flag propagates to the schema and is shown in the UI (badge + tooltip) so the rung is
never presented as hard-verified.

## Architecture

### 1. Shared schema (`packages/shared`) — single source of truth

New Zod schemas, validated by both daemon and SPA (mismatch surfaces as schema drift):

```ts
ClaudeMdLevel = z.number().int().min(0).max(6)

RungCheck = {
  rung: ClaudeMdLevel,          // 1..6
  label: string,                // "Basic" | "Scoped" | ... | "Adaptive"
  passed: boolean,
  inferred?: boolean,           // true only for L5 when awarded via proxy
  evidence: string[],           // human-readable reasons the predicate passed/failed
}

ClaudeMdEval = {
  level: ClaudeMdLevel,         // headline, strict-cumulative
  levelLabel: string,           // label for `level`
  rungs: RungCheck[],           // all six, in order, each with pass/fail + evidence
  nextSteps: string[],          // unmet predicates of the next rung, as advice strings
  inferred: boolean,            // true if the headline level relied on an inferred rung (L5)
}
```

### 2. Daemon scanner (`packages/agent/src/lib/scanners/claudeMdLevelScanner.ts`)

A new **deterministic** scanner that returns a `ClaudeMdEval` for a repo. It:

- Reads only: repo-root `CLAUDE.md`/`AGENTS.md`, `.claude/rules/`, `.claude/skills/`, `mcp.json`.
  All filesystem access routes through the existing `PathResolver` allow-list pattern (CODEX HIGH-3),
  consistent with the other scanners. **No writes** to any project file.
- **Reuses AgentLinter's CLAUDE.md parser** for the content predicates (L2 constraints, L3 imports).
  No second parser is introduced.
- Uses the freshness/git data the coverage pipeline already gathers for the L5 inference.
- Computes the strict-cumulative `level`, the full `rungs[]` array, and `nextSteps`.

This becomes the **6th scanner** in the existing `coverageScan` fan-out (currently 5). It therefore
inherits: the 30s memo cache, `POST /coverage/refresh` routing, `Promise.allSettled` partial-failure
isolation (a scanner that throws yields a degraded result, not a 500), and `absPath` stripping so no
filesystem paths reach the SPA. **No new daemon route is added.**

### 3. "How to improve" derivation

`nextSteps` is derived deterministically from the **failed predicates of the next unmet rung**. Each
unmet predicate maps to a fixed advice string, e.g.:

- Missing L2 → "Add a `## Constraints` section with MUST / MUST NOT rules → reaches L2."
- Missing L3 → "Split long sections into referenced files (`@docs/...`) or a second instruction file → L3."
- Missing L4 → "Move path-specific rules into `.claude/rules/*.md` with `paths:` frontmatter → L4."
- Missing L6 → "Add a task-scoped skill under `.claude/skills/` and an `mcp.json` → L6."

No LLM, no guesswork.

## Delivery phases

### Phase A — Fleet column (Coverage Matrix)

- Add `eval: ClaudeMdEval` to `CoverageRow` (schema + scanner wiring).
- Render an **L-level badge** column in the Coverage Matrix.
- Row click opens a **drawer** showing the per-rung ✓/○ list (with evidence) + `nextSteps`.
- Commits `<N>-IMPECCABLE.md` for the affected matrix route (composite ≥ 80).

### Phase B — Per-project panel (Single-project view)

- New **"CLAUDE.md Maturity"** panel, peer of Discipline / Health / Skills.
- Full ladder with evidence per rung, the `inferred` flag rendered on L5, and the next-steps checklist —
  the richer "why + how to improve" view.
- Commits its own `<N>-IMPECCABLE.md` (composite ≥ 80).

A→B ordering: the panel reuses the same `ClaudeMdEval` payload the matrix phase introduces, so Phase A
lands the data model + scanner and Phase B is presentation-only on top of it.

## Hard constraints (must survive)

- **Read-only on project filesystems.** The scanner only reads; it never writes to a registered project.
- **Path allow-list / resolver mediation.** All reads go through the existing `PathResolver`; reject
  `..`, absolute paths, and realpaths outside the repo.
- **No native/cloud deps.** Pure Node + existing parser; stays within the Phases 0–6 zero-third-party rule.
  No LLM, no external CLI.
- **Schema is the contract.** Both ends validate `ClaudeMdEval`; drift surfaces in the SPA.

## Testing

- **TDD per rung predicate** — each L1–L6 predicate gets red→green tests, including the L0 (absent) case,
  the git-tracked-vs-untracked L1 distinction, and the three L5 inference signals (each independently
  sufficient).
- **Strict-cumulative semantics** — test the L6-signals-present-but-L5-unmet capping case explicitly.
- **`nextSteps` derivation** — assert the advice strings map to the correct unmet next rung.
- **Degraded-row isolation** — a throwing scanner yields a degraded eval, not a 500.
- **Schema round-trip** — `ClaudeMdEval` parses identically on both ends.
- Each frontend phase runs the `impeccable:critique` skill and commits its `<N>-IMPECCABLE.md` artifact.

## Out of scope (YAGNI)

- LLM-generated narrative or advice (deterministic only).
- Shelling out to the upstream RepoRails CLI (early/unstable; we own the predicates).
- Editing/auto-fixing CLAUDE.md files from the dashboard (read-only constraint).
- A standalone capability-level API route (folds into `coverageScan`).
- Historical level trends as a first cut (coverage-history already exists; can layer later if wanted).
```
