---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Cross-family observability
status: completed
stopped_at: Phase 11.2 context gathered
last_updated: "2026-05-18T16:30:57.847Z"
last_activity: 2026-05-18
progress:
  total_phases: 18
  completed_phases: 8
  total_plans: 51
  completed_plans: 51
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.
**Current focus:** v1.1 close-out audit; next move = ratify D-10.5-03.calibration-2 ADR or open Phase 11.2 / Phase 12

## Current Position

Phase: 11.1 SHIPPED (merge commit 8fe463a on main)
Plan: 6/6 plans complete; all 5 IMP-* requirements verified
Last shipped: Phase 11.1 (impeccable p1 polish bundle) via PR #36 on 2026-05-18
Milestone: v1.1 — Cross-family observability — substantially complete (Phase 10/10.5/10.6/11/11.1 all shipped); pending only D-10.5-03.calibration-2 ADR ratification
Status: Phase complete; awaiting next-phase route
Last activity: 2026-05-18

Progress: v1.0 [██████████] 100% complete  •  v1.1 [█████████■] ~90% (Phase 10/10.5/10.6/11/11.1 shipped; calibration ADR pending; Phase 12 prepped)

## v1.0.1 Follow-ups (✅ CLOSED 2026-05-14)

Both items captured in `.planning/phases/07-help-docs-v1-0/deferred-items.md` are resolved:

- **Impeccable scoring tool drift** — ✅ resolved: superseded by Phase 10.5 D-10.5-01 (CI gate retired) + D-10.5-02 (skill-driven per-phase artifact replaces it).
- **`text-text-tertiary` token contrast bump** — ✅ resolved 2026-05-14: `--color-text-tertiary` bumped from `#9C95A8` (2.8:1) to `#807A92` (~3.9:1) in `packages/spa/src/styles/tokens.css`. Comfortable margin above the 3:1 detector floor; tests pass (class-name invariants, not color literals).

## Performance Metrics

**Velocity:**

- Total plans completed: 59
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
| 11 | 0 | - | - |
| 11.1 | 6 | - | - |

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
| Phase 11 P01 | 4min | 3 tasks | 5 files |
| Phase 11 P02 | 15min | 7 tasks | 17 files |
| Phase 11 P03 | 9min | 2 tasks | 7 files |
| Phase 11 P06 | 10min | 1 tasks | 6 files |

## Accumulated Context

### Roadmap Evolution

- Phase 05.1 inserted after Phase 5: UI redesign Cloudflare-inspired sidebar dashboard shell (URGENT) — design pass before more functionality piles on; Cloudflare dashboard-inspired minimal aesthetic with sidebar nav. Inserted 2026-05-09.
- Phase 06.1 inserted after Phase 6: typography-layout-impeccable-lift (URGENT) — Phase 6 Wave 2 (06-06) measured composite scores 83-87 across all 6 v1.0 routes after closing all 8 deterministic detector violations; Color sub-score reached 90 but Typography (82) and Layout (88) need UX architecture work (ARIA on OBSERVE items, max-w-[75ch] line-length, progressive disclosure on integration panels, empty-canvas treatment on /pair, token-masking on settings) to clear the ≥ 90 gate. Must close before Phase 6's 06-07 closing-ritual PR triggers the gate. Inserted 2026-05-10.
- Phase 10 added 2026-05-13: Coverage Matrix Page — per-repo presence + freshness of CLAUDE.md, GitNexus index, family wiki, workflow version across the three client families (~/Sourcecode/{agenticapps,factiv,neuroflash}). Ships as migration 0008 in claude-workflow. Depends on Phase 7 (skips held Phases 8/9). Opens a new milestone (v1.1: cross-family observability) beyond the closed v1.0 milestone. Shipped 2026-05-13 via PR #28.
- Phase 10.5 inserted 2026-05-13: impeccable skill-driven gate. Phase 6's CI gate (`.github/workflows/impeccable.yml` + `scripts/check-impeccable-score.mjs`) deleted; replaced by per-phase `<N>-IMPECCABLE.md` artifact authored by running `/impeccable critique` against affected routes at 1440×900. Triggered by tool drift discovered during Phase 10 Gate 4 (`npx impeccable critique` removed in v2.1.8). 5 decisions captured (D-10.5-01..05). Shipped bundled with Phase 10 in PR #28.
- Phase 10.6 inserted 2026-05-14: three-state GitNexus detection. Coverage scanner upgraded from `existsSync(~/.gitnexus)` boolean to a `gitNexusInstallState` enum (`not-installed` / `installed-no-registry` / `installed-with-registry`). New `detectGitNexusBinary()` probes well-known prefixes (XDG, fnm, nvm, npm-global, volta, bun, homebrew, /usr/local) stat-only — no shell-out, survives launchd-spawned daemons. New `IndexGitNexusButton` for the middle state. Per-row state under `installed-no-registry` shifts from `'not-applicable'` → `'missing'`. Shipped 2026-05-14 via PR #29 (78b6b6f).
- Phase 11.1 inserted 2026-05-18 after Phase 11: impeccable p1 polish bundle (URGENT) — addresses the 4 Phase-10-inherited P1s surfaced in `11-IMPECCABLE.md` (column-width drift in CoverageFamilySection, non-sticky CoverageToolbar, missing clipboard-write feedback, `text-text-tertiary` contrast 3.8:1 < WCAG AA 4.5:1). Estimated composite lift 76 → ~82 — produces calibration data point #3 to settle D-10.5-03 floor recalibration (Option B/C/D). Not blocking v1.1 close-out but accepted as the path to close `D-10.5-03.calibration-1` cleanly.
- Phase 11.2 inserted 2026-05-18 after Phase 11.1: impeccable P2 polish bundle (URGENT) — closes the 5 follow-ups surfaced in `11.1-IMPECCABLE.md` §"Phase 11.2 candidate" (column-header tooltips P1 carry-over from Phase 10/11/11.1, per-row in-flight feedback for `gitnexus-analyze` P1, Wiki column width tightening P2 + iPad refresh-icon touch target P2, controlled search input P3, `max-w-prose` PageHeader subtitle P3). Estimated composite lift ~81 → ~85–87 (may hit legacy ≥87 floor without invoking calibration-2 waiver clause). Scopes OUT Coverage responsive collapse below 768px (stays a Phase 12 candidate).

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
- [Phase 10]: Coverage matrix page shipped. Migration 0008 originally bumped workflow head 1.7.0 → 1.8.0; re-anchored 2026-05-14 to 1.5.0 → 1.6.0 by claude-workflow PR #17 (chain-integrity fix — coverage is a dashboard surface, not a consumer-repo capability). The 1.6 → 1.8 bump is now carried by migration 0009 (CLAUDE.md vendoring). Dashboard tests + REQUIREMENTS COV-12 + CHANGELOG re-anchored to match. CODEX HIGH-1 (absPath strip), HIGH-2 (symlink escape guard), HIGH-3 (resolver-everywhere), HIGH-5 (refresh contract pin), HIGH-6 (per-family install hint) and 13 other review findings all landed via the --reviews replan. Stage 1 /review PASS (0 errors, 1 warning, 2 info). /cso PASS (0 errors). Stage 2, /qa, and impeccable deferred to user (fresh-context + dev server required).
- [Phase 10.5]: D-10.5-01 — retire CI-enforced impeccable gate (`.github/workflows/impeccable.yml` + `scripts/check-impeccable-score.mjs` deleted). D-10.5-02 — skill-driven per-phase `<N>-IMPECCABLE.md` artifact is the gate. D-10.5-03 — composite ≥ 87 floor provisional pending 3-phase calibration. D-10.5-04 — no headless skill invocation in CI. D-10.5-05 — cross-repo update is single ADR addendum on workflow-core, no claude-workflow migration. Supersedes the CI-enforcement portions of D-6-09 / D-6-09.v1 / D-6-10 / D-6-11 / D-6-21; their score-floor commitments remain in force applied to the new artifact.
- [Phase 10.6]: 3-state enum on wire (`gitNexusInstallState`) chosen over 2 boolean flags for semantic clarity + exhaustive switch checking. Stat-based binary detection chosen over shell-out: predictable, no shell-injection surface, survives launchd minimal PATH. eslint `argsIgnorePattern: '^_'` etc. adopted globally to align with the existing underscore-discard convention used in 6 places in phase-10 scanner code.
- [Phase 11]: Plan 11-01: Bulk-per-repo CoverageHistoryResponseSchema (PD-11-02) — single response carries all four cells; cuts /coverage first-paint fan-out from ~168 to ~42 requests; CoverageCell stays presentational
- [Phase 11]: Plan 11-01: Family enum locked to ['agenticapps','factiv','neuroflash','other'] — derived from path-prefix match against ~/Sourcecode/, not from registry.client (null for every live entry)
- [Phase 11]: Plan 11-01: Literal-versioned wire fields (schemaVersion: 1, windowDays: 14) + .strict() on cells inner object — three independent structural guardrails against silent contract drift (STRIDE T-11-01-01)
- [Phase 11]: Plan 11-02: PD-11-01 in-process scheduler honoured (setTimeout chain inside the daemon process launchd keeps alive — NO plist modification)
- [Phase 11]: Plan 11-02: PD-11-02 bulk-per-repo endpoint honoured (GET /api/coverage/history?repoId=X returns all 4 cells in one response — cuts first-paint fan-out from ~168 to ≤42 requests)
- [Phase 11]: Plan 11-02: REVIEWS action items 3 (data-driven repoId validation against scanCoverageInternal ∪ readRegistry — no regex), 4 (writer appends, reader collapses with last-record-wins per (date, repo, cell)), 5 (explicit disposer registry in boot.ts — LIFO + throw-isolated + idempotent + wired into all 3 shutdown branches) all addressed
- [Phase 11]: Plan 11-02: T-11-02-03 symlink-escape boot check landed (assertSnapshotDirInDaemonHome via realpathSync — refuses to start with 'escapes daemon home' if coverage-history realpath escapes ~/.agenticapps/dashboard/)
- [Phase 11]: Plan 11-03: D-11-04 per-skill matrix view + D-11-14 single-project-per-request enforced structurally via .strict() Zod schema + REVIEWS #6 (readLocalSkills .skills destructure), #7 (fixture isolation), #10 (shared AgentLinterResponseSchema reuse) all addressed
- [Phase 11]: Plan 11-06: PageHeader sticky?: boolean opt-in (D-11-09) — default false preserves all non-opted-in routes
- [Phase 11]: Plan 11-06: CoverageRow refresh button opacity-30 default (D-11-10) — hover/focus still bumps to opacity-100
- [Phase 11]: Plan 11-06: CoveragePage opts into sticky at all 4 PageHeader render paths (PLI-03) — coverage.lazy.tsx untouched (REVIEWS #9 lock); 4 PageHeader elements verified live (plan-time count of 5 was a counting artifact)
- [Phase 11]: Post-UAT sticky-layering fix — PageHeader uses `-mt-6 sticky top-[-1.5rem] min-h-14` to sit flush with TopBar/RepairBanner (commit `89d4b2d`); family-header rebased to `top-8` + column-headers to `top-[5.0625rem]` so the three-element sticky stack is gapless (commit `1efde99`). Live-verified at scrollY 0/200/400/800/1200/1600.
- [Phase 11]: D-10.5-03.calibration-1 — interim recalibration after 2 data points (Phase 10 = 74, Phase 11 = 76, both Nielsen 24/40). Empirical band 74-76; 87 floor confirmed empirically unreachable on the Coverage surface. Candidate recalibration to ≥ 80 with structural-debt waiver clause (Option B), NOT yet ratified — final decision deferred to D-10.5-03.calibration-2 after data point #3 lands. See `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md`.

### Pending Todos

Five follow-ups (tracked in TaskList; see Session Continuity → Next action):

1. **Push ADR-0011 addendum on `agenticapps-workflow-core`** — local branch `docs/adr-0011-impeccable-cli-rename-addendum` (commit `7f2cdb6`) unpushed. Documents the upstream `pbakaus/impeccable` CLI rename. Per D-10.5-05.
2. **Migration 0008 drift investigation** — `claude-workflow` main has commits about "re-anchor 0008 (1.5→1.6)" / "0009 (1.6→1.8)". Dashboard's `migration-0008.fixture.test.ts` + `migration-0008.smoke.test.ts` still pinned to v1.8.0 contract. 2 known-pending smoke failures every CI run. Read current claude-workflow STATE.md + recent commits before re-engaging.
3. **v1.0.1 follow-ups** — (a) impeccable scoring tool drift (`npx impeccable critique` removed in v2.1.8; decision: pin to last critique-capable version, or migrate gate to `detect`). Largely resolved by D-10.5-01 (CI gate deleted) — but the `.planning/phases/07-help-docs-v1-0/deferred-items.md` entry should be retired/redirected. (b) `text-text-tertiary` token contrast bump — current `#9c95a8` is 2.8:1 against warm paper bg; needs ≥ 3:1. Cross-phase patch against Phase 5.1 tokens. 5 inherited low-contrast hits all come from this single token.
4. **Phase 10.6 polish backlog** — 5 deferred P1/P2/P3 items in `.planning/phases/DASH-10-.../10-IMPECCABLE.md` "Additional follow-up" section. Triage: drop, defer with explicit trigger, or fold into next phase.
5. **Phase 11/12 audit** — v1.1 milestone has only Phase 10 shipped under it. Candidates for v1.1 close-out: trends/history over time, cross-repo skill drift detection, cross-family workflow upgrade orchestration, GitNexus index health surfacing.

### Blockers/Concerns

- `claude-workflow` migration 0008 drift causes 2 smoke-test failures on every dashboard CI run — known-pending, not blocking merges but worsening signal-to-noise.

## Session Continuity

Last session: 2026-05-18T16:30:57.842Z
Stopped at: Phase 11.2 context gathered
Resume file: .planning/phases/DASH-11.2-impeccable-p2-polish-bundle/11.2-CONTEXT.md
Next action: work through the 5 Pending Todos above. Recommended order: (1) ADR-0011 push → (2) migration 0008 investigation → (3) v1.0.1 follow-ups → (4) 10.6 polish triage → (5) Phase 11 audit (last because it depends on the others for full state visibility).
