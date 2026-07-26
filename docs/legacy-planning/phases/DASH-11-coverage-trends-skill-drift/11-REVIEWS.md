---
phase: 11
reviewers: [gemini, codex]
reviewed_at: 2026-05-16T12:53:27Z
plans_reviewed:
  - 11-01-PLAN.md
  - 11-02-PLAN.md
  - 11-03-PLAN.md
  - 11-04-PLAN.md
  - 11-05-PLAN.md
  - 11-06-PLAN.md
overall_verdict:
  gemini: LOW
  codex: MEDIUM
recommendation: rework
---

# Cross-AI Plan Review — Phase 11 (Coverage trends + Skill drift + 10.6 polish)

Two independent AI reviewers (gemini, codex) read the full Phase 11 plan
bundle (CONTEXT + VALIDATION + 6 plans, ~5057 LOC + 250 KB prompt).
This document captures both reviews verbatim and synthesizes consensus.

The skip rules in `~/.claude/get-shit-done/workflows/review.md` excluded
`claude` (this reviewer is itself running inside Claude Code CLI;
`CLAUDE_CODE_ENTRYPOINT=cli` triggers the self-skip). CodeRabbit and
OpenCode are not installed on this host.

## Gemini Review

### 1. Summary

This is an exceptionally high-quality set of implementation plans. They are
thorough, well-researched, and demonstrate a deep understanding of the
project's architecture, constraints, and existing patterns. The TDD-first
approach, rigorous security analysis (STRIDE), and clear dependency
management across waves are exemplary. The plans not only fulfill the
requirements of Phase 11 but do so in a way that is safe, maintainable, and
consistent with the established codebase. The overall risk of implementation
is very low due to this meticulous planning.

### 2. Per-Plan Strengths

- **Plan 11-01 (Schemas):** Correctly isolates the foundational schema
  changes into a dependency-free, Wave 0 plan. The TDD approach ensures the
  data contracts are solid before any implementation begins.
- **Plan 11-02 (Coverage Trends Daemon):** Demonstrates outstanding security
  discipline. It correctly identifies and mitigates risks for the new daemon
  write path, including subtle issues like `fs.appendFile` mode semantics
  and symlink escapes. The critical re-interpretation of the cron trigger
  (PD-11-01) based on a review of the existing `launchd` service is a prime
  example of proactive, evidence-based planning.
- **Plan 11-03 (Skill Drift Daemon):** Excels at reusing existing code
  (`agentLinterRunner`, `skillsScan`). It enforces the "single project per
  request" security constraint for the new AgentLinter call site at the
  schema level, providing a strong structural guarantee. The plan correctly
  identifies that project "family" must be derived from the file path,
  showing good research into the live system state.
- **Plan 11-04 (Coverage Trends SPA):** Shows strong component-driven
  thinking. It correctly avoids a name collision with an existing component
  (`InlineDrift.tsx`), uses existing design tokens, and plans for good
  accessibility with `aria-label`. The iterative task breakdown to first
  build the component and then wire it to the data hook is solid.
- **Plan 11-05 (Skill Drift SPA):** This is the largest plan, and it's
  handled beautifully. It reuses existing UI patterns from the Coverage
  page for consistency, correctly identifies the right sidebar component
  to use (`SidebarItem` vs. `SidebarSubItem`) based on code review, and
  implements the full feature from data hooks to the final route
  registration.
- **Plan 11-06 (Polish Bundle):** A model for a small, focused polish plan.
  It correctly ensures backward compatibility for the shared `PageHeader`
  component by defaulting the new `sticky` prop to `false`. The plan is
  self-contained and rightly placed in an early wave due to its lack of
  dependencies.

### 3. Concerns

- **(LOW) Plan 11-02: Re-interpretation of a User Decision.**
  The plan correctly identifies a technical conflict between the user's
  decision D-11-02 (use `StartCalendarInterval` in the existing `launchd`
  plist) and the service's `KeepAlive=true` property. The proposed solution
  (PD-11-01: an in-process scheduler) is technically superior and safer.
  This is not a flaw in the plan — quite the opposite — but it is a
  deviation from a written decision and should be explicitly acknowledged
  and approved. The plan's documentation of this as "PD-11-01" is the
  correct way to surface it.

- **(LOW) Plan 11-04: Underspecified Prop Drilling.**
  Task 3 notes that `repoId` and `cellKey` may need to be threaded down
  from the parent `CoverageRow.tsx` component to `CoverageCell.tsx`. While
  the plan mentions adding a regression test if this is needed, the change
  to `CoverageRow.tsx` itself is not explicitly part of the plan's file
  list or tasks. This is a minor omission, as the work is trivial, but it
  creates a small amount of unplanned scope.

### 4. Suggestions

1. **Formally Document PD-11-01:** The decision to use an in-process
   scheduler is a key technical choice. While it's noted in the plan,
   consider adding it to a more permanent project decision log or ADR
   (Architecture Decision Record) if one exists. This will ensure future
   developers understand why the daemon has its own scheduler rather than
   relying on the OS.

2. **Explicitly Add Parent Component Changes:** For Plan 11-04, if
   `CoverageRow.tsx` needs modification to pass props, that file should be
   explicitly added to the `files_modified` list and the change should be a
   small, explicit step in a task. This maintains the plan's otherwise
   perfect traceability.

3. **Unify Per-Family Filtering Logic:** Plan 11-05 leaves the exact UX for
   "per-family" filtering as an implementation choice. To ensure maximum
   consistency, the implementation should directly mirror the behavior of
   the `CoverageToolbar.tsx` from Phase 10.

### 5. Risk Assessment

**Overall Risk: LOW**

The implementation risk for this phase is exceptionally low. The plans are
among the most detailed and well-prepared this reviewer has seen.

- Technical Risk is Low: every new feature is based on established patterns.
- Scope Risk is Low: out-of-scope work is explicitly deferred; waves are
  independent.
- Regression Risk is Low: shared components (`PageHeader`) preserve
  backward compatibility.

---

## Codex Review

### Summary

The phase is well-planned overall: the plans are explicit about
constraints, TDD sequencing, trust boundaries, and phase goals, and the
wave ordering is mostly coherent (`11-01` foundation, `11-02/03/06`
parallel backend/polish, `11-04/05` SPA consumers). The main weakness is
not completeness but **interface fidelity**: several plans assume shapes
or insertion points that do not match the current codebase, especially
around `CoverageCell.tsx`, `api.ts` (`apiFetch`), `coverage.lazy.tsx`,
`CoveragePage.tsx`, and `skillsScan.ts` (`readLocalSkills`). If those
mismatches are corrected before execution, the phase is viable; if not,
the execution plans will incur avoidable churn.

### Per-Plan Strengths

**11-01:** strong contract-first approach; literal `schemaVersion` /
`windowDays` force deliberate contract changes; barrel-export discipline.

**11-02:** best security planning of the set (mode enforcement, retention,
traversal defense, cache isolation, symlink-escape checks); clean
writer/pruner/reader/scheduler separation; malformed-data resilience.

**11-03:** reuses Phase 5 surfaces (`skillsScan`, AgentLinter); single-project
enforcement is structural at the schema level; `Promise.allSettled` for
per-project failure isolation.

**11-04:** a11y + naming-collision awareness; text-only drift badge is
appropriate for the dense matrix; client-side shared-schema parsing.

**11-05:** good recognition that the sidebar IA needs to evolve, not just
bolt on a page; reuse of Coverage toolbar/query patterns reduces UX drift;
covers the full surface (hooks, page, route, sidebar, mutation path).

**11-06:** genuinely parallelizable; low-risk polish isolated from larger
work; `sticky?: false` default preserves backward compatibility.

### Concerns

- **HIGH — 11-04**: The coverage-drift SPA design is internally inconsistent.
  Task 2 makes `CoverageCell` presentational with a `drift` prop, while
  Task 3 moves data fetching into `CoverageCell` itself. Those are two
  different ownership models. Given current `CoverageCell.tsx`, this needs
  to be resolved before implementation.

- **HIGH — 11-04, 11-02**: Per-cell history fetching is likely too chatty.
  TanStack Query dedup will not help much because the keys are unique per
  `(repoId, cell)`. On a dense matrix this can become hundreds of requests
  on first paint. The plan acknowledges fan-out, but the mitigation is too
  weak for the chosen endpoint design.

- **MEDIUM — 11-02**: The proposed `repoId` regex is probably too
  restrictive. A pattern like `^[a-z0-9-]+/[a-z0-9-_]+$` can reject
  legitimate repo IDs with dots or other safe characters. Since `repoId`
  is compared, not executed, validation should be safer and more
  data-driven.

- **MEDIUM — 11-02**: Same-day snapshot semantics are muddy. The writer
  explicitly appends on repeated same-day calls, but the reader derives
  day identity from filename and computes one timeline from that. If
  duplicate same-day writes occur, the plan does not clearly define how
  to collapse them.

- **MEDIUM — 11-02**: Scheduler/boot integration is more invasive than
  the plan suggests. Current `boot.ts` has no callback/disposer registry,
  so wiring `startSnapshotScheduler()` into graceful shutdown is not a
  small additive change.

- **MEDIUM — 11-03**: The plan's pseudo-implementation does not match
  current `readLocalSkills`, which returns `{ scope: 'local'; skills }`,
  not a raw array. The plan says to verify this, but the mismatch is
  material and suggests the task isn't fully grounded yet.

- **MEDIUM — 11-03**: Requiring reads from the real
  `~/.agenticapps/dashboard/registry.json` is a portability smell. That
  is useful for research, not for plan execution. Tests should remain
  fixture-driven and hermetic.

- **MEDIUM — 11-05**: The scope model is still underdefined. The objective
  says `useSkillDrift({ scope })`, but the sample hook ignores scope
  entirely and seems to filter client-side. The matrix behavior for
  "per family" vs "cross family" is still being decided inside the plan,
  which is too late.

- **LOW — 11-06**: The plan initially points at `coverage.lazy.tsx` for
  the `PageHeader` opt-in, but current `PageHeader` usage is in
  `CoveragePage.tsx`, not the lazy route wrapper. The task text partly
  catches this, but it should be corrected up front.

- **LOW — 11-05**: The SPA mutation hook introduces a loose local
  AgentLinter response schema even though the codebase already has an
  established daemon response shape via `agentlinter.ts`. Reuse would be
  cleaner.

### Suggestions

- **Decide one drift-data ownership model now.** Preferred: fetch drift
  outside `CoverageCell` and keep `CoverageCell` presentational. Given
  current `CoverageRow.tsx`, `CoverageRow` or `CoveragePage` is a better
  place to stitch in history data.
- **Revisit the sibling history endpoint shape** if needed. If Phase 11
  keeps it, add a batching strategy:
  - prefetch visible row history at page level, or
  - add a bulk history route keyed by repo, or
  - extend `/api/coverage` with optional drift when explicitly requested.
- **Replace the hardcoded `repoId` regex** with either a broader safe
  charset, or validation against known row IDs/registry entries after parse.
- **Tighten same-day snapshot semantics**: either enforce one snapshot per
  day, or explicitly define reader behavior as "last record per repo/cell
  per date wins".
- **Correct plan text against the current code before execution:**
  - `apiFetch` currently takes `(path, schema, init)` and returns
    `ParseOrDrift`, not an options object.
  - `CoveragePage`, not `coverage.lazy.tsx`, owns the `PageHeader`.
  - `readLocalSkills` returns `{ scope, skills }`.
- **Finalize skill-drift scope behavior before implementation.** Pick one:
  - family sections by default + cross-family flat view, or
  - explicit family selector + cross-family toggle.
  Reflect the choice consistently in hook API, toolbar tests, matrix tests.
- **Add one explicit performance gate for Phase 11:**
  - measure first-paint request count for `/coverage`,
  - verify no N×4 history burst exceeds an agreed threshold.
- **Keep test data hermetic.** Avoid any plan step that depends on the
  reviewer's real registry or homedir contents unless it is clearly
  labeled as manual research, not execution.

### Risk Assessment

**Overall risk: MEDIUM**

The backend pieces are thoughtfully decomposed and security-aware, and
the phase does map to the stated goal: coverage trend persistence,
cross-repo skill drift, and the two leftover polish items are all
represented. The risk comes from execution friction, not missing scope.
Several plans are slightly ahead of the actual codebase shape, and
`11-04` in particular has an unresolved design problem that could create
both performance issues and refactor churn. If those interface and
ownership issues are corrected before work starts, this drops toward
medium-low.

---

## Consensus Summary

### Verdict

| Reviewer | Risk | Action |
|---|---|---|
| gemini | LOW  | proceed with three polish tweaks |
| codex  | MEDIUM | rework 11-04 ownership + 11-02 endpoint shape before execution |

**Recommendation: `/gsd-plan-phase 11 --reviews`** to incorporate codex's
HIGH-severity findings on Plan 11-04 (ownership model + fan-out) before
execution. The codex findings are grounded in the current code shape and
were independently verified during this review (see *Reviewer-Specific
Verifications* below). The plans are not yet ready to execute as-is.

### Agreed Strengths (both reviewers)

- **Schema-first contract design (11-01)** — barrel exports, literal
  `schemaVersion` / `windowDays` fields, dependency-free Wave 0.
- **Security planning in 11-02** — mode `0600` enforcement, retention,
  traversal defense, symlink-escape checks.
- **Reuse discipline in 11-03** — leverages existing `skillsScan` +
  AgentLinter surfaces; single-project enforcement is structural.
- **A11y + naming-collision awareness in 11-04** — explicit avoidance of
  `InlineDrift.tsx` collision; aria-label planning.
- **Sidebar IA evolution in 11-05** — recognizes need for new section
  rather than ad-hoc bolt-on.
- **Backward compatibility in 11-06** — `sticky?: false` default
  preserves all existing `PageHeader` callers.
- **Wave ordering is coherent** — Wave 0 (schemas) → Wave 1 (daemon +
  polish) → Wave 2 (SPA consumers).

### Agreed Concerns

| # | Severity | Plans | Concern | Gemini framing | Codex framing |
|---|---|---|---|---|---|
| 1 | **HIGH / LOW** | 11-04 | CoverageCell drift-data ownership is unresolved | "underspecified prop drilling" (LOW) | "Task 2 vs Task 3 are two ownership models — fix before implementation" (HIGH) |
| 2 | (codex only) HIGH | 11-04, 11-02 | Per-cell history fetch fan-out — hundreds of requests on first paint | not raised | "TanStack dedup does not help; needs batching strategy" |
| 3 | LOW / MEDIUM | 11-05 | Per-family scope behaviour is decided inside the plan, not before it | "unify with `CoverageToolbar.tsx` from Phase 10" | "underdefined — pick one, reflect in hook + toolbar + matrix tests" |

### Divergent Views

- **Overall risk rating.** Gemini = LOW; codex = MEDIUM. The divergence is
  driven by codex grounding its review in the current code (`apiFetch`,
  `readLocalSkills`, `CoveragePage`) and finding shape mismatches that
  Gemini did not surface. These were independently verified during this
  review and are real — see below.

- **PD-11-01 (in-process scheduler vs `launchd` `StartCalendarInterval`).**
  Gemini flags this as a LOW deviation from user decision D-11-02 worth
  acknowledging in an ADR. Codex does not raise it.

- **`repoId` regex strictness, same-day snapshot semantics, and boot
  disposer wiring (all 11-02).** Codex raises all three as MEDIUM; Gemini
  does not raise any.

### Reviewer-Specific Verifications

Performed during this REVIEWS.md assembly (claude reading codex's claims
against the actual code on `feat/coverage-trends-skill-drift`):

| Codex claim | Verified? | Evidence |
|---|---|---|
| `apiFetch` is `(path, schema, init) -> ParseOrDrift`, not an options object | ✅ confirmed | `packages/spa/src/lib/api.ts:62-66` |
| `PageHeader` is in `CoveragePage.tsx`, not `coverage.lazy.tsx` | ✅ confirmed | 5 `PageHeader` usages at `CoveragePage.tsx:206/227/242/250+`; zero in `coverage.lazy.tsx` |
| `readLocalSkills` returns `{ scope: 'local'; skills }`, not a raw array | ✅ confirmed | `packages/agent/src/lib/skillsScan.ts:133-135` |
| Plan 11-04 conflates two ownership models | ✅ confirmed | Task 2 (`11-04-PLAN.md:331-352`) extends CoverageCell with a `drift` prop; Task 3 (`11-04-PLAN.md:373-410`) calls `useCoverageHistory` *inside* CoverageCell |

### Action Items Before Execution

Ordered by severity. All must be addressed (or explicitly accepted) before
`/gsd-execute-phase 11`:

1. **(HIGH, 11-04) Resolve drift-data ownership.** Pick one of:
   - **Option A (presentational):** Keep `CoverageCell` as the drift-prop
     consumer; move `useCoverageHistory` up to `CoverageRow` or
     `CoveragePage` and pass the result down. Add `CoverageRow.tsx` to
     `files_modified`.
   - **Option B (smart cell):** Drop the `drift` prop entirely; let
     `CoverageCell` call `useCoverageHistory` internally and accept only
     `repoId` + `cellKey`.
   - **Option C (page-level prefetch + bulk endpoint):** Replace the
     per-cell endpoint with a bulk `/api/coverage/history?repoId=` route
     and prefetch once at page level. Solves both the ownership question
     and the fan-out concern in one move.
2. **(HIGH, 11-04 + 11-02) Define a performance budget for first-paint
   request count on `/coverage`** and pick a mitigation that meets it
   (Option C above is the cleanest; per-cell-with-suspense + virtualized
   row prefetch is the alternative).
3. **(MEDIUM, 11-02) Loosen the `repoId` regex** or validate against
   parsed registry entries instead of a regex.
4. **(MEDIUM, 11-02) Specify same-day snapshot dedup semantics** — pick
   either "one write per repo/cell per date" (writer enforces) or
   "last-record-wins" (reader collapses).
5. **(MEDIUM, 11-02) Add a `boot.ts` disposer-registry sub-task** to
   Plan 11-02 so the scheduler is wired into graceful shutdown explicitly,
   not assumed.
6. **(MEDIUM, 11-03) Update Plan 11-03 pseudo-code** to match
   `readLocalSkills`' `{ scope, skills }` return shape.
7. **(MEDIUM, 11-03) Switch all 11-03 test inputs to fixtures**; remove
   references to the reviewer's real `~/.agenticapps/dashboard/registry.json`.
8. **(MEDIUM, 11-05) Pick a scope model** (family sections + cross-family
   flat view, OR family selector + cross-family toggle) and propagate
   through hook signature, toolbar tests, and matrix tests.
9. **(LOW, 11-06) Correct PageHeader location** in Plan 11-06 text:
   `CoveragePage.tsx`, not `coverage.lazy.tsx`.
10. **(LOW, 11-05) Reuse the existing AgentLinter daemon response schema**
    in the mutation hook rather than defining a local copy.
11. **(LOW, 11-02 — gemini)** Capture PD-11-01 (in-process scheduler vs
    `launchd` `StartCalendarInterval`) as an explicit deviation from
    D-11-02. Either accept the deviation in CONTEXT.md or revisit D-11-02.

### Next Step

Run `/gsd-plan-phase 11 --reviews` to incorporate this REVIEWS.md into
the next planning pass. Items 1, 2, and 8 are the load-bearing ones —
they change plan structure (file lists, endpoint shape, hook contracts);
the rest are text corrections or single-task additions.

After replan, regenerate `11-VALIDATION.md` to confirm the consensus
action items are addressed before re-attempting `/gsd-execute-phase 11`.
