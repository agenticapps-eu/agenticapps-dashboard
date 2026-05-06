# Phase 4: Single-project View — Discipline + Phase Progress - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 04-single-project-view-discipline-phase-progress
**Areas discussed:** Endpoint shape & data flow; Discipline-panel parsing rules; Layout: header + 3-column shell with missing right column; Empty / missing / install-hint states

---

## Endpoint shape & data flow

### Q1 — How should Phase 4's daemon API be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Panel-split endpoints (Recommended) | Five small Hono routes (commitment, observations/recent, phase-progress, security, discipline). Each with own 5s memo. Schema-drift on one panel doesn't break others. Mirrors Phase 3 D-01 per-card-isolation pattern. | ✓ |
| Single composite /single-project-view | One GET /api/projects/:id/view returning everything. Single fetch, single cache key, single drift surface — but one drift blanks the whole detail page. | |
| Extend /overview with detail mode | ?detail=1 query param adds detail fields. Couples card and view contracts. | |

**User's choice:** Panel-split endpoints
**Notes:** Captured as D-4-01.

### Q2 — Polling cadence for the Phase 4 view?

| Option | Description | Selected |
|--------|-------------|----------|
| Same 5s as home (Recommended) | All Phase 4 queries 5s + 5s daemon memo + refetchIntervalInBackground:false. Matches Phase 3 D-02/D-03. | ✓ |
| Slower 10–15s | Reduces filesystem reads, worse UX feedback on /review runs. | |
| Per-panel cadence (commitment 2s, others 10s) | Best polish, extra config surface. | |

**User's choice:** Same 5s as home
**Notes:** Captured as D-4-02.

### Q3 — Reuse Phase 3's projectOverview parsers, or fork?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse + extend lib/projectOverview.ts (Recommended) | Single source of truth for parsing. | ✓ |
| Fork into new lib/phaseDetail.ts | Phase 4 owns parsing entirely; risk of drift. | |

**User's choice:** Reuse + extend
**Notes:** Captured as D-4-03. Planner may still split into a sibling `lib/phaseDetail.ts` for organization — single test surface is what matters.

---

## Discipline-panel parsing rules

### Q1 — Where does the 'last ## Workflow commitment' block live?

| Option | Description | Selected |
|--------|-------------|----------|
| Latest .planning/skill-observations/*.md (Recommended) | Daemon picks newest *.md by mtime, finds last `## Workflow commitment` heading. | ✓ |
| Scan git log for commitment in commit body | Works without meta-observer skill installed; commitment blocks aren't usually committed. | |
| Scan project root for *.md with the heading | Less assumption, ambiguous, false-positive risk. | |

**User's choice:** Latest .planning/skill-observations/*.md
**Notes:** Captured as D-4-05.

### Q2 — What fields belong on HookFiringSchema?

| Option | Description | Selected |
|--------|-------------|----------|
| {ts, skill, hook, payload?} minimal (Recommended) | Tolerant to upstream evolution via z.passthrough(). | ✓ |
| Full Claude Code hook event schema | High fidelity, tightly couples to upstream. | |
| {ts, skill, line} — raw text only | Forces RationalizationFires to a separate JSONL line type. | |

**User's choice:** {ts, skill, hook, payload?} minimal
**Notes:** Captured as D-4-06.

### Q3 — Where do RationalizationFires row labels come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Read from .claude/skills/agentic-apps-workflow/skill/SKILL.md table (Recommended) | Self-updating; no version coupling. | ✓ |
| Hard-coded list in shared schema | Faster, drifts when workflow skill adds rows. | |
| Don't enumerate — show whatever JSONL emits | Panel shows nothing when no rationalizations have fired. | |

**User's choice:** Read from project's SKILL.md
**Notes:** Captured as D-4-07.

### Q4 — Recency filter for HookFirings?

| Option | Description | Selected |
|--------|-------------|----------|
| Last 20 lines across all session files, by line timestamp (Recommended) | Robust to per-file line counts. | ✓ |
| Last 20 from latest session file only | Cheaper read; quiet last session blanks panel. | |

**User's choice:** Last 20 across all files
**Notes:** Captured as D-4-08.

---

## Layout: header + 3-column shell with missing right column

### Q1 — How should the right column be handled in Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| 2-column grid now, widen to 3 in Phase 5 (Recommended) | grid-template-columns: 1fr 1.5fr; one-line CSS change in Phase 5. No visible work-in-progress artifacts. | ✓ |
| 3-column grid with stub right column | "Phase 5 — coming" panel violates anti-slop discipline. | |
| 3-column grid with empty right column | Wide empty real estate looks broken. | |

**User's choice:** 2-column grid now
**Notes:** Captured as D-4-09.

### Q2 — Header content per spec ASCII?

| Option | Description | Selected |
|--------|-------------|----------|
| Spec verbatim minus deferred bits (Recommended) | Render line 1 only: ← All Projects · name (client) · branch · phase 04 — In Progress. Line 2 dropped. | ✓ |
| Spec verbatim with stubs for deferred | Stubs violate anti-slop. | |
| Simplified to back link + project name only | Lower information density. | |

**User's choice:** Spec verbatim minus deferred bits
**Notes:** Captured as D-4-10.

### Q3 — Where do panel definitions live?

| Option | Description | Selected |
|--------|-------------|----------|
| One component per panel under src/components/panels/ (Recommended) | Each panel testable in isolation. | ✓ |
| All inline in SingleProjectView.tsx | Faster to write, harder to test, balloons file size. | |
| Group by column: DisciplineColumn.tsx + PhaseColumn.tsx | Coarse boundary, harder to add a panel later. | |

**User's choice:** One component per panel
**Notes:** Captured as D-4-11.

---

## Empty / missing / install-hint states

### Q1 — DISC-04 install hint copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Detect skill, show hint with `claude` CLI command (Recommended) | Copy-pasteable command. Exact command deferred to researcher. | ✓ |
| Generic 'install skill' link to docs | Less actionable. | |
| No hint — just empty state | Violates DISC-04 spec requirement. | |

**User's choice:** Detect + copy-pasteable command
**Notes:** Captured as D-4-15. Exact CLI command (`claude skill install meta-observer` vs alternatives) is researcher's call; planner ships placeholder + TODO marker if uncertain.

### Q2 — Per-panel empty states?

| Option | Description | Selected |
|--------|-------------|----------|
| Render panel with explicit 'no data yet' line (Recommended) | Stable layout, consistent with Phase 3 D-44. | ✓ |
| Hide panel when source missing | Layout shifts. | |
| Render panel with skeleton placeholder text | Violates Phase 3 D-42 anti-skeleton rule. | |

**User's choice:** Explicit 'no data yet' lines
**Notes:** Captured as D-4-14, with per-panel copy enumerated.

### Q3 — Hover-expand vs always-expanded?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-expanded — no progressive disclosure (Recommended) | Detail page is for reading, not scanning. | ✓ |
| Compact-default + hover-expand like Phase 3 cards | Forces extra interaction. | |

**User's choice:** Always-expanded
**Notes:** Captured as D-4-13. Removes D-43 animation constraints from Phase 4 entirely.

### Q4 — ReviewStatus parsing scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Latest phase only (Recommended) | Aligns with phase-scoped page. | ✓ |
| Phase + prior phase aggregate | Conflates active/historical. | |
| Latest phase only, but filter to <finding> blocks | Drops the frontmatter fast path. | |

**User's choice:** Latest phase only
**Notes:** Captured as D-4-16.

---

## Closing question

**Q — Anything still unclear before I write CONTEXT.md?**

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context (Recommended) | All four areas resolved with recommended choices. | ✓ |
| Explore more gray areas | Surface another decision. | |

**User's choice:** Ready for context

---

## Claude's Discretion

Items where the user deferred to Claude/planner/researcher (captured in CONTEXT.md `<decisions>` → "Claude's Discretion" subsection):

- TanStack Query cache key shapes
- Daemon-side cache structure (single map vs five maps)
- `parseExecutionTimeline` per-task grouping regex
- PhaseProgress checklist file ordering
- `PhaseFileStatusSchema` exact field names
- `HookFiringSchema` payload-field shape (whether to lock to a discriminated union later)
- `navigator.clipboard.writeText` fallback path for D-4-15 copy button
- Test layout per package
- Linear-style branch detection (deferred but cheap if planner finds it trivial)

## Deferred Ideas

Items raised during analysis as future-phase work (full list in CONTEXT.md `<deferred>`):

- Right column (HEALTH-01..05) — Phase 5
- Header line 2 (Linear badge, ADR-touched, ⚙ settings) — Phase 5/6
- `POST /api/projects/{id}/open` editor spawn — Phase 5/6
- Sub-route `/projects/{id}/settings` — Phase 6
- impeccable ≥ 90 hard gate — Phase 6
- Live updates via WebSocket/SSE — out of scope (5s polling sufficient)
- Aggregate ReviewStatus across phases — Phase 6 polish
- Persistence of UI state across sessions — Phase 6 polish
- Linear-style branch badge detection — Phase 5/7
