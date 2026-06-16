# Requirements: v1.3 — CLAUDE.md Capability-Level Evaluation

**Milestone goal:** Grade each registered repo's `CLAUDE.md`/`AGENTS.md` against the RepoRails
**L0–L6** capability ladder and surface **why** the level was assigned + **how to improve** —
across the fleet Coverage Matrix and in a per-project panel.

**Binding input:** `docs/superpowers/specs/2026-06-15-claude-md-capability-level-design.md` (brainstormed + approved).

**Source idea:** "CLAUDE.md best practices — From Basic to Adaptive" (Gábor Mészáros / RepoRails).

## v1.3 Requirements

### Capability-Level Engine (daemon)

- [ ] **CML-01**: The daemon evaluates each registered repo's `CLAUDE.md`/`AGENTS.md` against the L0–L6 ladder, returning `level`, `levelLabel`, `rungs[]`, `nextSteps`, and `inferred`.
- [ ] **CML-02**: Each rung L1/L2/L3/L4/L6 is decided by a deterministic structural predicate:
  - L1 Basic — file exists **and** is git-tracked
  - L2 Scoped — body contains an explicit `MUST` / `MUST NOT` / `NEVER` constraint
  - L3 Structured — body has `@import` references **or** ≥2 instruction files exist
  - L4 Abstracted — `.claude/rules/*.md` exists with `paths:` frontmatter
  - L6 Adaptive — `.claude/skills/*/SKILL.md` exists **and** `mcp.json` exists
- [ ] **CML-03**: L5 "Maintained" is **inferred** from freshness + coverage-history signals (CLAUDE.md mtime within the repo's recent-commit window, or a backbone/map doc present, or coverage-history shows updates) and is flagged `inferred=true` — never presented as hard-verified.
- [ ] **CML-04**: The headline `level` uses strict-cumulative semantics (`highest N such that rungs 1..N pass`); per-rung pass/fail + evidence are retained so a higher-rung signal under an unmet lower rung is still visible.
- [ ] **CML-05**: `nextSteps` surfaces the unmet predicates of the next rung as concrete improvement advice — deterministic, no LLM.
- [ ] **CML-06**: The scanner is read-only + resolver-mediated and folds into the existing `coverageScan` fan-out (6th scanner), degrading to a partial result (not a 500) on error — no new daemon route, no new native/cloud dependencies.

### Shared Contract

- [ ] **CML-07**: A `ClaudeMdEval` Zod schema in `packages/shared` is the single source of truth, validated by both daemon and SPA; mismatch surfaces as schema drift.

### Fleet View (Phase A)

- [ ] **CML-08**: The Coverage Matrix shows a per-repo L-level badge column.
- [ ] **CML-09**: Clicking a matrix row opens a drawer with the per-rung ✓/○ list (with evidence) and the next-steps list.

### Per-Project View (Phase B)

- [ ] **CML-10**: The single-project view has a "CLAUDE.md Maturity" panel showing the full ladder, per-rung evidence, the inferred-L5 flag, and the next-steps checklist.

## Invariants (must hold — carried from v1.0–v1.2)

- **INV-01** Read-only on project filesystems — the scanner only reads; never writes to a registered project.
- **INV-02** No native/cloud dependencies — pure Node + existing AgentLinter parser; no LLM, no external CLI.
- **INV-04** Shared schema is the contract — both ends validate `ClaudeMdEval`.

## Future Requirements (deferred)

- Historical capability-level **trends** (level over time) — coverage-history machinery exists; layer on later if wanted.
- Capability-level **drift alerts** (repo dropped a rung) — depends on trends.

## Out of Scope

- **LLM-generated narrative or advice** — deterministic predicates only.
- **Shelling out to the upstream RepoRails CLI** — early/unstable; we own the predicates.
- **Editing / auto-fixing CLAUDE.md from the dashboard** — read-only constraint (INV-01).
- **A standalone capability-level API route** — folds into `coverageScan`.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CML-01..07 | (Phase A — TBD by roadmapper) | pending |
| CML-08..09 | (Phase A — TBD by roadmapper) | pending |
| CML-10 | (Phase B — TBD by roadmapper) | pending |

*(Traceability finalized by the roadmapper in ROADMAP.md.)*
