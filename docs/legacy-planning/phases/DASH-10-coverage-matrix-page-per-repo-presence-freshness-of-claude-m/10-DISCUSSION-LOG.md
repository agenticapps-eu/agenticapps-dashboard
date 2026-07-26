# Phase 10: Coverage Matrix Page — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `10-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 10 — Coverage Matrix Page
**Areas discussed:** Data acquisition, Refresh action granularity, Cross-family display, Override surfacing, Repo discovery, Workflow version detection, Sort + filter UX, Sidebar nav slot
**Mode:** Interactive `superpowers:brainstorming` inside `gsd-discuss-phase 10`. ADVISOR_MODE: false (no USER-PROFILE.md). `workflow.research_before_questions`: false. `workflow.discuss_mode`: discuss.

---

## Constraint 1 — Data acquisition

| Option | Description | Selected |
|--------|-------------|----------|
| Pull with per-call 30s memo cache | SPA → daemon scan-on-demand with 30s response cache | ✓ |
| Hybrid: scheduled background scan + state file + read-on-load | chokidar watcher + 5min scan + on-disk state | |
| Pure on-demand pull, no cache | Daemon scans every request | |
| Push: daemon emits state file on phase-state changes | Couples to meta-observer | |

**User's choice:** Pull with per-call 30s memo cache (Recommended).
**Notes:** Phase 4's phaseCache pattern at 5s is precedent; coverage churn is slower so 30s amortizes scan cost without introducing a background process or state file. File stats only (~50ms cold for ~30 repos).

---

## Constraint 2 — Refresh action granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row refresh, daemon-spawns when safe + clipboard for unsafe | wiki-compile + gitnexus analyze spawnable; workflow-update via clipboard | ✓ |
| All actions clipboard-only | Strictest INV-01 reading; user runs every command in terminal | |
| Family-batch only + clipboard for everything else | One refresh per family; loses fine-grained refresh-all-stale | |
| Per-row daemon-spawn for everything indexable; no clipboard fallback | Forces workflow-update headless; misuse | |

**User's choice:** Per-row refresh, daemon-spawns when safe + clipboard for unsafe (Recommended).
**Notes:** wiki-compile + gitnexus analyze are safe + idempotent + non-interactive — daemon can spawn. Workflow-update is interactive (asks confirmation per migration step) — must stay clipboard. CLAUDE.md missing is a human authoring task — no action. CSO follow-up: never use `npx <pkg>` against open registry — pin to vendored/global binaries.

---

## Constraint 3 — Cross-family display

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped sections per family, single page | Sticky family header + aggregate counts + per-family collapse | ✓ |
| Tabs per family at top of page | Tab bar; one family visible at a time | |
| Flat matrix with family as a column | Sortable + filterable single table | |
| Tree view (family → repos) expand-on-click | Hides matrix value behind expansion | |

**User's choice:** Grouped sections per family, single page (Recommended). Preview-rich AskUserQuestion with ASCII mockups (4 variants compared side-by-side).
**Notes:** Family boundary stays visually unmissable; cross-family aggregate visible on one page; matrix value always rendered (no hiding behind tree expansion). Matches the spirit of `~/Sourcecode/CLAUDE.md`'s hard family boundary while keeping the dashboard's single-page feel.

---

## Constraint 4 — Override surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `⚠ N override` chip per-row when sentinels exist | Detected sentinels only; env-var override undetectable | ✓ |
| Separate 'Overrides' column (5th column) | First-class column; inflates matrix | |
| Tooltip on the affected column only | Semantically incorrect (override isn't column-mapped) | |
| Out of scope for /coverage; capture as 'phase audit' future view | Defers to a separate future view | |

**User's choice:** Inline `⚠ N override` chip per-row when sentinels exist (Recommended).
**Notes:** Confirmed via shell that the only on-disk override surface is `<phase-dir>/multi-ai-review-skipped` sentinel (env-var `GSD_SKIP_REVIEWS=1` is ephemeral, undetectable). Currently zero sentinels exist across all 50 repos — Phase 10 is forward-looking instrumentation. Chip slot is reused for future override types if migration 0008+ codifies more.

---

## Follow-up 1 — Repo discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` one level deep | ~42 repos; surfaces full coverage gap | ✓ |
| Only repos referenced in family's `.wiki-compiler.json` sources | ~16 repos; hides wiki-link gaps | |
| Curated active-development set from migration 0007 | 7 repos; cleanest but loses cross-family visibility | |

**User's choice:** Every git repo (Recommended).
**Notes:** Surfacing "this repo isn't in .wiki-compiler.json sources" is itself useful information — the page's job is to expose gaps.

---

## Follow-up 2 — Workflow version detection

| Option | Description | Selected |
|--------|-------------|----------|
| Latest migration's `to_version` field in claude-workflow/migrations/ | Self-updating single source of truth | ✓ |
| Skill frontmatter at `~/.claude/skills/agentic-apps-workflow/skill/SKILL.md` | Reads what user has installed (may be stale) | |
| Dedicated VERSION file in claude-workflow root | Adds new file to keep in sync | |

**User's choice:** Latest migration's `to_version` (Recommended).
**Notes:** Migration 0008 (this phase) ships with `to_version: 1.8.0` — automatically becomes the new head.

---

## Follow-up 3 — Sort + filter UX

| Option | Description | Selected |
|--------|-------------|----------|
| Default sort family-then-name; filter chips for status; search box | Matches HomeToolbar pattern from Phase 3 | ✓ |
| Sortable column headers + free-text search only, no status chips | Inconsistent with rest of dashboard | |
| No filters in v1; ship the matrix, add filters in a follow-up phase | Smallest scope; 42 rows hard to eyeball | |

**User's choice:** Default sort + filter chips + search (Recommended).
**Notes:** Filter state in URL params for deep-linking; family aggregate counts reflect filtered view.

---

## Follow-up 4 — Sidebar nav slot

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level sidebar entry between 'Projects' and 'Help' | My recommended option | |
| Under a new 'Observability' sidebar section | Forward-thinking; single item in v1 | ✓ |
| Accessible only via direct URL + 'Open coverage' link in home header | Hides the feature | |

**User's choice:** New 'Observability' sidebar section (NOT my recommended option).
**Notes:** User chose the future-friendly architecture (section that can grow) over my pragmatic recommendation (peer top-level item). Pattern signal: user prefers section architecture that anticipates growth even when v1.0 puts only one entry in the section.

---

## Claude's Discretion

Items captured in CONTEXT.md `<decisions>` § Claude's Discretion. Includes: filesystem-scan parallelism; exact GitNexus registry JSON shape (researcher reads gitnexus source); wiki "last compile" detection method; CLAUDE.md vs AGENTS.md fallback; override chip click-target; refresh-all-stale concurrency; workflow-version mismatch UX detail; cache invalidation on refresh; mobile/narrow-screen behaviour.

## Deferred Ideas

Items captured in CONTEXT.md `<deferred>`. Includes: cross-family aggregate header chart; per-repo drill-down detail page; link to per-phase audit view; env-var override detection (impossible); real-time updates; multi-machine coverage; indexing personal/shared/archive; workflow VERSION file; npm-registry detection; AgentLinter as 5th column; phase-progress aggregation.
