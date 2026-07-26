# Phase 5: Skills + Health Panels - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 05-skills-health-panels
**Areas discussed:** Transcript persister (G1), Path allow-list extension, AgentLinter integration shape, Observability + Integrations detection vocabulary

---

## Transcript persister (G1)

### Q: What ships the writer that fills `.planning/skill-observations/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate skill, this phase | New `meta-observer` skill ships as part of Phase 5 — producer + consumer close together. | ✓ |
| Sub-phase 5.1 | Insert decimal phase after Health panels close. Keeps Phase 5 scope intact. | |
| Push to Phase 6 polish | Persister becomes polish work; v1.0 ships with empty Discipline panels. | |
| Separate skill repo | meta-observer in its own repo with independent release cadence. | |

**Notes:** User's reasoning: shipping with permanently-empty CommitmentBlock + HookFirings panels would dilute the "what every project's pipeline is doing right now" value prop across all of v1.0. The dashboard owns producer + consumer for the discipline data path.

### Q: What technical mechanism writes the files?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Code SessionEnd hook | Single hook entry point at session boundary. Zero per-message overhead. | ✓ |
| Inline `meta-observer` skill | Skill invoked by workflow skill's commitment ritual itself. | |
| PostToolUse hook + filter | Per-tool-call write with throttling. Highest fidelity. | |
| User decides at plan time | Lock venue, defer mechanism to researcher. | |

**Notes:** SessionEnd at natural session boundary covers commitment blocks + hook firings without the per-message overhead of PostToolUse. Crashed-session blind spot acknowledged — covered by D-4-14's "no commitment block found yet" empty state.

### Q: What does the persister write?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: commitment markdown + hook JSONL | One skill, two output streams; closes G1 + DISC-02 + DISC-03 paths. | ✓ |
| Commitment blocks only (markdown) | Smaller scope; defers half the problem to a later writer. | |
| Hook JSONL only | Inverts which panel goes empty. | |
| User decides at plan time | Lock venue + mechanism, defer file format split. | |

### Q: Install story for projects?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual `claude skill install` per project | Matches Phase 4's DISC-04 install hint. | ✓ |
| Auto-install when project registers | Violates INV-01 (daemon writes into project FS). | |
| Bundled with agenticapps-workflow skill | Couples workflow skill release to dashboard data needs. | |
| Globally installed once, reads project context | Cross-project leak risk. | |

### Q: Where does the meta-observer skill live in this repo?

| Option | Description | Selected |
|--------|-------------|----------|
| `packages/meta-observer/` workspace pkg | Shares root tooling, can import shared schemas directly. | ✓ |
| `skills/meta-observer/` (top-level) | Outside pnpm workspace; cleaner skill-bundle layout. | |
| Separate repo | Cleanest scope but undermines "this phase" commitment. | |
| Researcher decides | Defer to current Claude Code skill conventions. | |

### Q: Phase 5 closure gate for the persister side?

| Option | Description | Selected |
|--------|-------------|----------|
| End-to-end populated panels | Skill installed + session run + populated panels + screenshot before phase closes. | ✓ |
| Skill exists + unit-tested, populated state UAT-deferred | Risk: G1 re-defers via UAT debt. | |
| Skill exists, populated state next-session | No live verification in phase. | |

### Q: File rotation strategy for `.planning/skill-observations/`?

| Option | Description | Selected |
|--------|-------------|----------|
| One file per session, date+session-id | Atomic write target per session; CommitmentBlock latest-by-mtime works unchanged. | ✓ |
| One file per day, append-only | Concurrent sessions collide; markdown boundaries get tricky. | |
| Single rolling file | Unbounded growth on long-running projects. | |
| Researcher decides | Defer until SessionEnd payload shape is known. | |

### Q: Cross-project safety model for the skill?

| Option | Description | Selected |
|--------|-------------|----------|
| Project root from CWD walk-up | Walks upward looking for `.planning/` or `.claude/`; matches `cli/discover.ts:18`. | ✓ |
| Project root from session-init recorded path | Tighter; needs SessionStart hook on top of SessionEnd. | |
| Project root from agentic-dashboard registry | Skill becomes useless for unregistered projects. | |
| Researcher decides | Confirm against `CLAUDE_PROJECT_DIR` env var if exposed. | |

### Q: Backfill semantics on first install?

| Option | Description | Selected |
|--------|-------------|----------|
| No backfill, forward-only | First session post-install seeds writes; one empty session acceptable. | ✓ |
| Backfill on install | Privacy/scope concerns; depends on transcript-history surface. | |
| Manual backfill command | Opt-in retrofit; adds CLI surface. | |

---

## Path allow-list extension

### Q: How should the daemon read top-level project metadata files?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-route read with explicit allow-list, no `/read` exposure | Dedicated daemon-side scanners; SPA never names a top-level path. | ✓ |
| Extend `/read` allow-list with explicit top-level filenames | Widens network-attacker surface. | |
| Sibling `/api/projects/:id/metadata` route returning fixed bundle | Single route, all top-level signals at once. | |
| Researcher decides | Pick after studying current `lib/paths.ts`. | |

### Q: How should the daemon read global skills at `~/.claude/skills/*/SKILL.md`?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `/api/skills/global` route, daemon-only allow-list | Singleton route, one cache shared across projects. | ✓ |
| Extend per-project `/skills/local` to merge global | Duplicates global read N times across N projects. | |
| Two routes, SPA composes | Clean cache boundaries; extra round-trip + SPA-side merge. | |

### Q: Path allow-list defence-in-depth for the new reads?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `resolveAllowed` pattern with extended root sets | One defence pattern across codebase; tested. | ✓ |
| Hardcoded paths, no traversal check | Defence-in-depth principle violated. | |
| Sandbox via `O_NOFOLLOW` / `lstat` symlink rejection | Stricter; net-new pattern with false-reject risk. | |

---

## AgentLinter integration shape

### Q: AgentLinter cache scope and key?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project, mtime-keyed across all SKILL.md files | Cache key = `(projectId, max-mtime)`; matches spec verbatim. | ✓ |
| Per-skill, mtime-keyed individually | Finer-grained; depends on AgentLinter per-skill scan support. | |
| Per-project, time-only (1h hard TTL) | Contradicts spec's "invalidates on mtime change". | |
| Researcher decides after testing actual output | Defer to actual AgentLinter JSON shape. | |

### Q: Failure mode UX when `npx agentlinter scan` fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct empty states per failure class | Four classes: not-installed, timeout, parseable error, unparseable error. | ✓ |
| Single 'lint unavailable' state | User can't tell next action. | |
| Cached-stale fallback like Sentry pattern | Stale lint against outdated skill set lies. | |
| Hide panel on failure | Violates D-4-14 always-renders-empty-state. | |

### Q: What does the SkillHealth panel actually surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Score badge + Position Risk only, click to expand | Compact list with row-level expansion for warning detail. | ✓ |
| Full warning detail per skill, no truncation | 30 skills × 5 warnings = 150-line panel. | |
| Score-only, no Position Risk inline | Hides spec's named primary signal. | |
| Sorted by lowest score, top 5 only | Hides score for skills the user maintains. | |

---

## Observability + Integrations detection vocabulary

### Q: What counts as 'Sentry installed'?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-signal: deps + scripts + DSN | `@sentry/*` deps OR sentry-cli scripts OR `.sentryclirc` OR env `SENTRY_DSN`. | ✓ |
| Deps only | Misses sentry-cli-only and env-only setups. | |
| Deps + CI workflows | Misses `.sentryclirc` and other CI providers. | |
| Researcher decides after sampling user's projects | Defer to observed reality. | |

### Q: Spotlight / sentry-cli / `.infisical.json` detection vocabulary?

| Option | Description | Selected |
|--------|-------------|----------|
| Same multi-signal philosophy across all three | Consistent UX; per-tool vocabulary defined once. | ✓ |
| File-presence only for all three | Misses npm-installed Spotlight; slow `sentry-cli` detect. | |
| Researcher confirms 2026 idioms | Defer until install patterns confirmed. | |

### Q: IntegrationsHealth configuration state surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Three-state per integration with inline guides | `configured` / `present-but-not-configured` / `not-detected`. | ✓ |
| Two-state: configured / not-configured | "Sentry deps but no env var" looks identical to "no Sentry". | |
| Use ObservabilityHealth signals to drive richer state | Mostly equivalent to option 1 with explicit panel coupling. | |

### Q: Where do 'Configure to enable' guides live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel copy, one paragraph each | Spec line 504 verbatim; zero-click; tight constraint. | ✓ |
| Inline summary + 'Read more' link to docs | Opens docs-location question; possible Phase 6 polish. | |
| Modal triggered from 'Configure' button | Re-introduces dialog complexity Phase 4 avoided. | |

---

## Claude's Discretion

Areas explicitly delegated to researcher / planner per the CONTEXT.md `<decisions>` section:

- AgentLinter subprocess execution model (stdio capture vs streaming)
- AgentLinter cache persistence across daemon restarts (in-memory vs on-disk)
- Position Risk severity bucket mapping to D-4-16's four glyphs
- `/api/skills/global` cache TTL (60s vs 5min vs 1h)
- meta-observer JSONL event vocabulary (passthrough vs discriminated union)
- meta-observer hook script language (Bash / Node / Deno / TS)
- meta-observer atomic write pattern (`.tmp` + rename vs direct write)
- 3-col responsive behaviour at narrow widths (threshold + transition)
- Daemon-side scanner organisation (per-file vs single `healthScan.ts`)
- TanStack Query cache key shapes for new panels

## Deferred Ideas

Tracked in CONTEXT.md `<deferred>` section. Highlights: optional integration data fetching (Phase 7), keyboard shortcuts + service install (Phase 6), impeccable critique gate (Phase 6), meta-observer backfill command (revisit if needed), lockfile/monorepo handling (out of v1 scope), cross-phase ReviewStatus aggregation (Phase 6 if needed).
