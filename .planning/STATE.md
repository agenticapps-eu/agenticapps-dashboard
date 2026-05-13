---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Cross-family observability (Coverage Matrix)
status: discussing
stopped_at: Phase 10 added to roadmap 2026-05-13. About to run /gsd-discuss-phase 10.
last_updated: "2026-05-13T09:15:00.000Z"
last_activity: 2026-05-13
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 64
  completed_plans: 64
  percent: 77
next_milestone: v1.0.1 follow-ups still pending; Phase 8 still held
current_phase: 10
current_phase_name: Coverage Matrix Page
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.
**Current focus:** Phase 10 — Coverage Matrix Page. New milestone v1.1 (cross-family observability) just opened. Ships as migration 0008 in claude-workflow.

## Current Position

Phase: 10 — Coverage Matrix Page
Plan: Not started (entering /gsd-discuss-phase 10)
Milestone: v1.1 — Cross-family observability — 0%
Status: Discussing. Next action: adaptive questioning + 4 brainstorms (data acquisition, refresh granularity, cross-family display, override surfacing).
Last activity: 2026-05-13

Progress: v1.0 [██████████] 100% complete  •  v1.1 [          ] 0% (Phase 10 discussing)

## v1.0.1 Follow-ups (deferred from Phase 7)

Captured in `.planning/phases/07-help-docs-v1-0/deferred-items.md`:

- **Impeccable scoring tool drift** — `npx impeccable critique` removed in v2.1.8 (only `detect` survives). Decision needed: pin to last critique-capable version, or migrate gate to `detect`. Phase 7 closure was not blocked (0 new findings introduced).
- **`text-text-tertiary` token contrast bump** — current `#9c95a8` is 2.8:1 against warm paper bg; needs ≥ 3:1. Cross-phase patch against Phase 5.1 tokens. 5 inherited low-contrast hits all come from this single token.

## Performance Metrics

**Velocity:**

- Total plans completed: 53
- Average duration: —
- Total execution time: 0 h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 | 5 | - | - |
| 02 | 6 | - | - |
| 03 | 11 | - | - |
| 05 | 6 | - | - |
| 05.1 | 6 | - | - |
| 06.1 | 7 | - | - |
| 06 | 7 | - | - |
| 07 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 05 P01 | 75 | 4 tasks | 28 files |
| Phase 05 P02 | 70 | 3 tasks | 11 files |
| Phase 05 P03 | 80 | 3 tasks | 13 files |
| Phase 05 P04 | 9 | 3 tasks | 6 files |
| Phase 05 P05 | 10 | 3 tasks | 8 files |
| Phase 05.1 P05 | resumed multi-session | 2 tasks | 47 files |
| Phase 07 P01 | 10min | 8 tasks | 15 files |
| Phase 07 P04 | 11min | 7 tasks | 10 files |

## Accumulated Context

### Roadmap Evolution

- Phase 05.1 inserted after Phase 5: UI redesign Cloudflare-inspired sidebar dashboard shell (URGENT) — design pass before more functionality piles on; Cloudflare dashboard-inspired minimal aesthetic with sidebar nav. Inserted 2026-05-09.
- Phase 06.1 inserted after Phase 6: typography-layout-impeccable-lift (URGENT) — Phase 6 Wave 2 (06-06) measured composite scores 83-87 across all 6 v1.0 routes after closing all 8 deterministic detector violations; Color sub-score reached 90 but Typography (82) and Layout (88) need UX architecture work (ARIA on OBSERVE items, max-w-[75ch] line-length, progressive disclosure on integration panels, empty-canvas treatment on /pair, token-masking on settings) to clear the ≥ 90 gate. Must close before Phase 6's 06-07 closing-ritual PR triggers the gate. Inserted 2026-05-10.
- Phase 10 added 2026-05-13: Coverage Matrix Page — per-repo presence + freshness of CLAUDE.md, GitNexus index, family wiki, workflow version across the three client families (~/Sourcecode/{agenticapps,factiv,neuroflash}). Ships as migration 0008 in claude-workflow. Depends on Phase 7 (skips held Phases 8/9). Opens a new milestone (v1.1: cross-family observability) beyond the closed v1.0 milestone.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 2026-05-02: Hand-derive `.planning/` from `docs/spec/dashboard-prompt.md` rather than running `/gsd-new-project` interview — spec is comprehensive enough to use as authoritative source.
- [Phase 05]: CLAUDE_PROJECT_DIR exposed in SessionEnd hook payload — use as primary project root resolver (D-5-07 resolved)
- [Phase 05]: SessionEnd hook fires for dormant skills — skill frontmatter hooks:SessionEnd is primary path, no settings.json fallback needed
- [Phase 05]: AgentLinterSeveritySchema is 3-value enum (info/warning/error) — agentlinter@0.3.3 confirmed, NOT 4 values
- [Phase 05]: Route path pattern: agentlinterRoute uses /:id/agentlinter internally (not /projects/:id/agentlinter) when mounted at /api/projects
- [Phase 05]: description: | literal block: full multi-line read in parseFrontmatter; SPA CSS-clamps to 1 line
- [Phase 05]: bypassCache=1 does NOT call setAgentLinterCached (one-call skip per D-5-15)
- [Phase 05]: resolveAllowedNamed allowedNames+extension mutually exclusive (PathViolation on both); parseSentryClirc existence-only (no INI); detectSentryDsnEnv evidence=file:line never DSN value; Linear detection via runAllowedGit branch regex /[A-Z]{2,}-\d+/
- [Phase 05]: Cross-project cache safety: useLocalSkills + useAgentLinter include projectId in queryKey; proven by cross-project cache isolation tests
- [Phase 05]: SkillHealth retry wiring: direct apiFetch with bypassCache=1 + queryClient.setQueryData (outside TanStack Query) — avoids query key mutation
- [Phase 05]: Severity glyph 3-of-4: AgentLinter emits info/warning/error only; yellow-circle glyph unused — honest reflection of 3-value severity vocab (UI-SPEC §OQ3 resolved)
- [Phase 05]: SecretsHealth renders only { state } from query.data — workspaceId and defaultEnvironment never extracted or rendered (T-05-05-NoSecretRead-SPA privacy invariant)
- [Phase 05]: INTEGRATIONS table stores nudges+paragraphs as React JSX literals — no daemon content interpolation in configure-to-enable guides (T-05-05-Static-Copy-Trust)
- [Phase 05.1]: Batch-migrated 24 additional pre-05.1-state files to achieve zero legacy alias coverage; worktree discrepancy treated as sub-task per plan NOTE
- [Phase 05.1]: Wave 5 precondition met: zero [--*] alias patterns remain in packages/spa/src/ after plans 01-05
- [Phase 07]: vitest.config.ts plugin chain must mirror vite.config.ts — discovered when MDX smoke RED→GREEN cycle revealed transform-time .mdx parsing failure
- [Phase 07]: @types/mdx must be a direct devDep — transitive peer dep of @mdx-js/react is insufficient for tsc to resolve mdx/types
- [Phase 07]: Plan 07-04: Mermaid-as-JSX in MDX (<MermaidBlock code={...}/>) decouples content from Plan 07-05's pre-mapping wiring
- [Phase 07]: Plan 07-04: MDX heading anchors require explicit <h2 id> (not kramdown {#anchor}); acorn parses {...} as JS expression
- [Phase 07]: Plan 07-04: mermaid.parse() syntax test must run in jsdom env; mermaid v11 DOMPurify init needs window

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-05-12T14:55:00.000Z
Stopped at: Phase 7 shipped via PR #21 + #22 (squash-merged to main 2026-05-12). STATE + ROADMAP reconciled to reflect v1.0 closure.
Resume file: None
Next action: address v1.0.1 follow-ups (impeccable + contrast) or pick a non-Phase-8 task (worktree cleanup, branch pruning).
