# Phase 5: Skills + Health Panels - Research

**Researched:** 2026-05-07
**Domain:** Claude Code hooks/skills platform · AgentLinter CLI · Sentry/Spotlight/Infisical/Linear detection · Daemon path allow-list extension · Per-route caching
**Confidence:** HIGH for hook + skill + AgentLinter facts (Context-fetched + live tool runs); MEDIUM for detection vocabulary (verified against npm + official docs); LOW for cosmetic/UI threshold choices flagged for the planner.

## Summary

Phase 5 widens the single-project view from 2-col to 3-col, ships five right-column panels, and bundles the meta-observer skill that closes Phase 4's G1 deferral end-to-end. The research surfaces **six load-bearing facts the planner must internalise**:

1. **AgentLinter (`agentlinter@0.3.3`) ships as a single-binary npm package and the `scan` subcommand the spec assumes does NOT exist.** The real CLI is `npx agentlinter [path]` with `--local` (skip upload) and `--json` (machine output). Spec language "`npx agentlinter scan`" must be reinterpreted as `npx agentlinter --local --json [path]`. JSON shape is `{ score, categories[], diagnostics[], files[], timestamp }` with `severity ∈ {info, warning, error}` (only three values, NOT four — D-5-16 needs an explicit coercion to D-4-16's four glyphs).
2. **Claude Code SessionEnd hooks DO expose `CLAUDE_PROJECT_DIR` directly** — D-5-07's CWD walk-up is a fallback, not the primary mechanism. Hook input arrives as **JSON on stdin** with `{ session_id, transcript_path, cwd, hook_event_name, ... }`. Hook scripts can be any executable language (bash/node/python/etc.) via shebang, with a `"shell"` frontmatter field for the bash/PowerShell choice on `` !`cmd` `` injection — irrelevant to a SessionEnd command hook.
3. **Skills declare hooks DIRECTLY in their SKILL.md frontmatter via a `hooks:` field** — no separate `hooks/` directory glue, no settings.json registration step. The meta-observer skill's `SessionEnd` hook is one frontmatter block + one script file; install is `claude skill install` (or copy into `.claude/skills/`).
4. **The `transcript_path` field in the hook payload IS the session transcript on disk** (`~/.claude/projects/<encoded-cwd>/<session>.jsonl`). The meta-observer reads this file to extract the `## Workflow commitment` block and the per-tool-call hook firings — it does NOT need to subscribe to PostToolUse events. This collapses scope dramatically: one SessionEnd hook + transcript reader.
5. **`.infisical.json` schema is well-defined**: required `workspaceId` (string), optional `defaultEnvironment` (string), optional `gitBranchToEnvironmentMapping` (record). Validity check = JSON.parse + `workspaceId` is a non-empty string. Anything beyond that is Phase 7 territory.
6. **Sentry detection vocabulary is settled**: `@sentry/<framework>` package family for SDK, `@sentry/cli` for the CLI (NOT `sentry-cli` as standalone npm — that's a reserved squat). `.sentryclirc` is INI-format, walked up from CWD to `~/.sentryclirc`. Spotlight is `@spotlightjs/spotlight` + `@spotlightjs/sidecar`. Linear is `@linear/sdk` + `LINEAR_API_KEY` env var (no project file).

**Primary recommendation:** Plan two largely independent work streams in parallel:
- **Stream A (Right column):** 5 SPA panels + 5 daemon routes + 5 schemas + extended path allow-list. ~7 plans, mostly mechanical extensions of Phase 4.
- **Stream B (Meta-observer):** `packages/meta-observer/` workspace package with one SessionEnd hook script that reads `transcript_path`, extracts commitment + hook firings, atomic-writes per-session files. ~2 plans, including the end-to-end dogfood gate per D-5-10.

The streams converge at the closure gate (D-5-10): meta-observer installed in this repo → real session run → CommitmentBlock + HookFirings populate → screenshot.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout transition (Phase 4 → Phase 5)**
- **D-5-01** Widen grid in place — `1fr 1.5fr 1fr`. Single CSS rule change in `SingleProjectView.tsx` (`grid-cols-[1fr_1.5fr]` → `grid-cols-[1fr_1.5fr_1fr]`); add `<section data-testid="health-column" aria-label="Health">` as the third column. No layout rework, no responsive break-out for Phase 5.
- **D-5-02** One component per panel under `packages/spa/src/components/panels/` — `InstalledSkills.tsx`, `SkillHealth.tsx`, `ObservabilityHealth.tsx`, `SecretsHealth.tsx`, `IntegrationsHealth.tsx`, plus `*.test.tsx` for each (Phase 4 D-4-11 convention).
- **Always-expanded panels** (Phase 4 D-4-13 carries forward). Row-level click-to-expand inside `SkillHealth` (D-5-16) is content interaction, not panel disclosure.

**Transcript persister (G1 unblocker)**
- **D-5-03** Persister ships in Phase 5 as `packages/meta-observer/` workspace package alongside `agent` / `spa` / `shared`.
- **D-5-04** Claude Code SessionEnd hook is the writer. Single hook entry point fires once per Claude session at natural session boundary; no per-message overhead, no PostToolUse high-frequency write path.
- **D-5-05** Persister writes both `.md` (commitment blocks) and `.jsonl` (hook firings). Closes BOTH DISC-01 (CommitmentBlock) and DISC-02 (HookFirings); DISC-03 RationalizationFires also derives from the JSONL stream.
- **D-5-06** One file per session, named `{ISO date+time}--{sessionId}.md` and `.jsonl`. Pattern: `2026-05-06T17-55-12--{sessionId}.md`. Each session is an atomic write target; latest-by-mtime read in Phase 4 D-4-05 still picks the most recent commitment unchanged.
- **D-5-07** Project root resolved via CWD walk-up looking for `.planning/` or `.claude/`. Mirrors `cli/discover.ts:18`. Refuses to write if no project root found (silent skip; no daemon error path). **Researcher confirms whether Claude Code SessionEnd hooks expose `CLAUDE_PROJECT_DIR` or equivalent — if so, prefer that over the walk-up.** ✅ See `[VERIFIED]` below.
- **D-5-08** Forward-only — no backfill on first install.
- **D-5-09** Manual `claude skill install meta-observer` per project. Matches the DISC-04 install-hint copy Phase 4 already shipped.
- **D-5-10** Phase 5 closure gate = end-to-end populated panels on this dashboard repo. Phase 5 doesn't ship until: (a) install meta-observer skill in `agenticapps-dashboard/.claude/skills/`, (b) run a real Claude session against this repo, (c) verify CommitmentBlock + HookFirings populate, (d) capture screenshot for HUMAN-UAT. The G1 deferral does NOT recur as UAT debt — it must close *in this phase*.

**Path allow-list extension**
- **D-5-11** Top-level project metadata files via dedicated daemon-side scanners — no `/read` exposure. SPA never names a top-level path; it calls dedicated routes (`/api/projects/:id/observability`, `/secrets`, `/integrations`) and gets pre-parsed JSON back.
- **D-5-12** Global skills via singleton `/api/skills/global` route, no projectId. Daemon-side allow-list anchored at `os.homedir() + '/.claude/skills'`; reads `*/SKILL.md` frontmatter only. One cache, all projects share. Per-project `/api/projects/:id/skills/local` route handles per-project skills. SPA's InstalledSkills panel calls both and merges client-side with `scope: global|local`.
- **D-5-13** Reuse `resolveAllowed` pattern with extended root sets. Name-restricted variant — e.g. `resolveAllowed(projectRoot, name, { roots: [projectRoot], allowedNames: ['package.json', '.infisical.json'] })`. CI-workflow reads use `{ roots: [projectRoot/.github/workflows], extension: '.yml' }`.

**AgentLinter integration**
- **D-5-14** Cache key = `(projectId, max-mtime across all SKILL.md)`, 1h hard ceiling on top of mtime invalidation. Daemon walks `<root>/.claude/skills/**/SKILL.md` + `~/.claude/skills/**/SKILL.md`, takes max mtime; cache hit when both projectId and max-mtime unchanged AND age < 1h.
- **D-5-15** Distinct empty states per failure class. Four explicitly-designed states:
  - **Linter not installed / network unreachable** → "AgentLinter not installed. Run `npm install -g agentlinter` to enable scoring."
  - **Scan timeout (default 30s)** → "Lint scan timed out — retry?" with retry button bypassing 1h cache for one call.
  - **Non-zero exit with parseable error message** → render the linter's stderr inline.
  - **Non-zero exit, unparseable output** → "Lint scan failed (exit N) — see daemon log."
  Cached-stale-fallback (Sentry pattern) is explicitly NOT used here.
- **D-5-16** SkillHealth surfaces score badge + Position Risk count per row; rows expand inline on click to show specific warnings. **Severity bucket mapping to D-4-16's four glyphs (🔴 critical / 🟠 high / 🟡 medium / ⚪ low) — researcher confirms what severities AgentLinter actually emits and aligns the mapping.** ✅ See `[VERIFIED]` below.

**Detection vocabulary (Observability + Integrations)**
- **D-5-17** ObservabilityHealth uses multi-signal detection per tool. Each tool detected via ANY-OR signal set; panel surfaces which signals matched ("detected via @sentry/node + .sentryclirc"). Vocabulary:
  - **Sentry**: `package.json` deps/devDeps include `@sentry/*` || scripts mention `sentry-cli` || `<root>/.sentryclirc` exists || env file mentions `SENTRY_DSN`.
  - **Spotlight**: deps include `@spotlightjs/*` || `<root>/.spotlight/` directory present.
  - **sentry-cli**: standalone binary on PATH || in `package.json` scripts || in CI YAML.
- **D-5-18** SecretsHealth = `.infisical.json` file presence + JSON-validity check. Surface state: `present + valid` / `present but invalid` / `absent`. Informational only — no Infisical API calls, no secret content read.
- **D-5-19** IntegrationsHealth uses three-state per integration (`configured` / `present-but-not-configured` / `not-detected`). Couples ObservabilityHealth → IntegrationsHealth at the data-flow level: detected-but-unconfigured is a stronger nudge than not-detected-at-all.
- **D-5-20** 'Configure to enable' guides live as inline panel copy, one paragraph each. Three paragraphs total (Sentry, Linear, Infisical) — each must be tight: install line + env var name + what gets enabled.

### Claude's Discretion

- AgentLinter subprocess execution model (stdio capture vs streaming).
- AgentLinter cache persistence across daemon restarts (in-memory vs `~/.agenticapps/dashboard/cache.json` mode `0600`).
- Position Risk severity mapping to D-4-16's four glyphs (researcher confirms vocabulary; see below).
- `/api/skills/global` cache TTL (60s vs 5min vs 1h).
- meta-observer JSONL event vocabulary (passthrough vs discriminated union).
- meta-observer hook script language (Bash / Node / Deno / TS).
- meta-observer atomic write pattern (`.tmp` + rename vs direct write).
- 3-col responsive behaviour at narrow widths (threshold + transition).
- Daemon-side scanner organisation (per-file vs single `healthScan.ts`).
- TanStack Query cache keys for new panel queries.

### Deferred Ideas (OUT OF SCOPE for Phase 5)

- Optional integration data fetching (Sentry events, Linear issues, Infisical secrets) — Phase 7.
- `agentic-dashboard install-launchd` / `install-systemd` — Phase 6.
- Keyboard shortcuts (`R` refresh, `?` help, `/` focus search) — Phase 6.
- impeccable ≥ 90 hard gate — Phase 6.
- README install/pair/FAQ/troubleshooting — Phase 6.
- Header line 2 (Linear badge, ADR-touched, settings link) — deferred from Phase 4; revisit Phase 7.
- meta-observer backfill of historical Claude Code transcripts — explicitly forward-only.
- meta-observer auto-install at register time — would violate INV-01.
- meta-observer global install (one for all projects) — cross-project leak risk.
- Lockfile parsing (yarn.lock / pnpm-lock.yaml) for transitive Sentry deps — package.json signals only.
- Monorepo / multi-root project handling — single project root via CWD walk-up suffices.
- Cross-phase ReviewStatus aggregation — Phase 6 if needed.
- 3-col responsive break-out at narrow widths — desktop-first.
- Cached-stale-fallback for AgentLinter — explicitly rejected.
- `/api/skills/global` on-disk cache persistence — in-memory by default.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **HEALTH-01** | InstalledSkills: `~/.claude/skills/` (global) + project `.claude/skills/` | `Standard Stack` (gray-matter or hand-rolled YAML parser); `Architecture Patterns / Pattern 2`; reuse Phase 4 `findSkillPath()` for canonical/bundle layout probing. |
| **HEALTH-02** | SkillHealth: AgentLinter scores + Position Risk warnings (cached 1h) | `Code Examples / AgentLinter JSON shape` documents actual `--json` output (not `scan` subcommand); `Architecture Patterns / Pattern 4` (subprocess with execa + cache). |
| **HEALTH-03** | ObservabilityHealth: Spotlight / Sentry SDK / sentry-cli detection via grep | `Standard Stack / Detection vocabulary`; multi-signal detection rules per D-5-17. |
| **HEALTH-04** | SecretsHealth: `.infisical.json` presence (informational only) | `Code Examples / .infisical.json schema`; `Don't Hand-Roll / INI parsing`. |
| **HEALTH-05** | IntegrationsHealth: three-state (configured / present-but-not-configured / not-detected) | `Architecture Patterns / Pattern 5` (env-var + signal coupling). |
| **INV-03** | Dashboard renders fully and gracefully when Sentry / Linear / Infisical unconfigured | `Validation Architecture / Empty-state assertions`. |
| (Closes) **DISC-01** | CommitmentBlock data path (Phase 4 deferred to Phase 5+) | `Architecture Patterns / Pattern 6` (meta-observer SessionEnd hook reads `transcript_path`). |
| (Extends) **AUTH-01..02** | Bearer + CORS still apply to all 7 new daemon routes | Phase 1 D-21 / D-23 patterns reused via `app.ts` middleware chain (no new auth code). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

**Hard architectural invariants — non-negotiable, all carry into Phase 5 unchanged:**

1. **Read-only on project filesystems.** Daemon never writes to a project. Sole exception: `POST /api/projects/{id}/open` editor spawn (NOT in Phase 5 scope). The meta-observer skill writes to `<projectRoot>/.planning/skill-observations/`, but it runs **as the user's Claude Code session, not as the daemon** — INV-01 holds.
2. **Path allow-list per project.** `/api/projects/{id}/read` stays locked to `.planning` + `.claude`. New top-level metadata signals (`package.json`, `.infisical.json`, `.github/workflows/*.yml`) get DEDICATED daemon routes — they are NOT exposed via `/read` (D-5-11). SPA never names top-level paths.
3. **Daemon writes confined to `~/.agenticapps/dashboard/`.** Mode `0600`. If Phase 5 adds an on-disk AgentLinter cache, it lives here at `0600` (planner's call per Claude's-Discretion).
4. **No native dependencies in `packages/agent/`.** Carries to `packages/meta-observer/` per INV-05.
5. **Bearer-token auth on every route.** CORS locked to `https://dashboard.agenticapps.eu` (prod) and `http://localhost:5174` (dev). Existing `app.ts` middleware chain covers all new routes — no new auth code.
6. **Optional integrations stay optional.** Phase 5 IntegrationsHealth surfaces *configuration state*, never makes API calls (those land in Phase 7).
7. **No Cloudflare Workers / Pages Functions in v1.** SPA stays pure-static.
8. **Dashboard's own UI must pass `impeccable:critique` ≥ 90.** Phase 6 owns the gate; Phase 5 inherits Phase 2/3/4 anti-slop discipline.

**Repo workflow constraints (CLAUDE.md + global ~/.claude/CLAUDE.md):**

- TDD on every panel + every daemon route + every parser + every meta-observer file.
- Two-stage review (`/review` Stage 1 → `superpowers:requesting-code-review` Stage 2). Stages do NOT collapse.
- `/cso` is **mandatory** for Phase 5 — adds 7 new HTTP read routes + a transcript persister + extends path allow-list (the most security-sensitive change since Phase 1 D-23).
- `pnpm lint` is mandatory in pre-PR check (memory feedback).
- Pre-phase hook: UI plans MUST run `superpowers:brainstorming` for UI/UX alternatives. The right-column panel design is a candidate.
- `/qa` if dev server reachable on `localhost:5174`.
- Feature branches + PRs to main. Never commit directly to main.

## Standard Stack

### Core (already in repo — verify, do not reinstall)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | `^4.12.18` (catalog) | New panel routes follow Phase 1/3/4 pattern | [VERIFIED: npm view hono version → 4.12.18, 2026-05-07]. Phase 4 routes use the same. |
| `zod` | `^3.25.0` (catalog) | Schemas for the 5 new panel responses + meta-observer JSONL | [VERIFIED: npm view zod version → 4.4.3 latest, but repo pinned to 3.25.0 catalog]. Stay on 3.25.x — bumping zod is a separate phase. |
| `execa` | `^9.6.1` | AgentLinter subprocess runner | [VERIFIED: npm view execa version → 9.6.1]. Phase 4 already uses it for git. |
| `@tanstack/react-query` | `^5.100.8` (catalog) | Per-panel queries with 5s/60s/1h staleTime | [VERIFIED via package.json catalog]. Same patterns as Phase 4. |
| `react` | `^18.3.1` (catalog) | SPA components | Already locked. |
| `tailwindcss` | `^4.2.4` (catalog) | Panel styling via existing tokens | No new tokens — D-5-02 reuses Phase 2 design tokens. |
| `vitest` | `^4.1.5` (catalog) | Tests for everything | TDD mandate; framework already wired. |

**No new SPA or agent dependencies for Phase 5.** [CITED: 05-CONTEXT.md `<code_context>` "No new SPA deps for Phase 5" + "No new agent deps for Phase 5"].

### External tooling (NOT a runtime dependency — invoked via subprocess)

| Tool | Version | Purpose | Detection |
|------|---------|---------|-----------|
| `agentlinter` | `0.3.3` | SkillHealth scoring + Position Risk | [VERIFIED: `npm view agentlinter version` → `0.3.3`, published 2 months ago, MIT, 70.5kB unpacked, no transitive deps]. Invoked via `npx agentlinter --local --json [path]`. |

### Don't add — already in catalog or unneeded

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gray-matter` for SKILL.md frontmatter | hand-rolled YAML parser | Frontmatter is `---\nkey: val\n---\n...`. Hand-roll a 30-line parser (split on `---`, parse simple `key: value` pairs, no nested structures). Avoids a 10kB dep for what we actually need. **Recommendation:** hand-roll, given INV-05 spirit of "audited dependency list". |
| `dotenv` for `.env` parsing | hand-rolled | Same logic: simple `KEY=VALUE` lines, no need for the npm package. |
| `ini` for `.sentryclirc` | hand-rolled | INI format is trivially regexable; section headers `[auth]` + `key = value` lines. Hand-roll. |

### Installation (no commands to run — verification only)

```bash
# Verify already-present versions in catalog (no installs needed)
node -e "const p=require('./packages/agent/package.json');console.log({execa:p.dependencies.execa,hono:p.dependencies.hono})"
# Expect: { execa: '^9.6.1', hono: '^4.12.16' }

# Probe AgentLinter availability on the dev machine
which agentlinter || npx --yes agentlinter --help
```

**Version verification (2026-05-07):**

| Package | Latest | Repo pin | Action |
|---------|--------|----------|--------|
| `agentlinter` | `0.3.3` | (subprocess only — not in package.json) | None — invoked via npx |
| `@sentry/node` | `10.52.0` | (detected, not depended on) | None — detection only |
| `@sentry/cli` | `4.11.3` | (detected, not depended on) | None — detection only |
| `@spotlightjs/spotlight` | `4.10.0` | (detected, not depended on) | None — detection only |
| `@spotlightjs/sidecar` | `2.5.0` | (detected, not depended on) | None — detection only |
| `@linear/sdk` | `83.0.0` | (env-var detection only) | None — env detection only |

## Architecture Patterns

### Recommended Project Structure (additive only — extends Phase 4)

```
packages/
├── agent/src/
│   ├── lib/
│   │   ├── skillsScan.ts          # NEW — SKILL.md frontmatter reader (global + local)
│   │   ├── projectMetadataScan.ts # NEW — package.json / .infisical.json / .sentryclirc / CI YAML
│   │   ├── agentLinterRunner.ts   # NEW — execa + 1h cache + failure classification
│   │   ├── integrationsState.ts   # NEW — env-var × signal three-state computation
│   │   ├── healthCache.ts         # NEW (or generalize phaseCache) — multi-TTL cache
│   │   └── paths.ts               # EDIT — add resolveAllowedNamed variant per D-5-13
│   └── routes/
│       ├── skills.ts              # NEW — GET /api/skills/global + GET /:id/skills/local
│       ├── agentlinter.ts         # NEW — GET /api/projects/:id/agentlinter
│       ├── observability.ts       # NEW — GET /api/projects/:id/observability
│       ├── secrets.ts             # NEW — GET /api/projects/:id/secrets
│       ├── integrations.ts        # NEW — GET /api/projects/:id/integrations
│       └── server/app.ts          # EDIT — wire 5 new routes
├── meta-observer/                 # NEW workspace package
│   ├── package.json               # workspace:*, no native deps, catalog versions
│   ├── SKILL.md                   # Frontmatter with hooks: SessionEnd
│   ├── hooks/
│   │   └── session-end.{sh|mjs}   # Reads transcript_path, writes .md + .jsonl
│   ├── lib/
│   │   ├── projectRoot.ts         # CLAUDE_PROJECT_DIR env first, then CWD walk-up
│   │   ├── readTranscript.ts      # JSONL transcript parser
│   │   ├── extractCommitment.ts   # Find last `## Workflow commitment` block
│   │   ├── extractFirings.ts      # Convert tool_use / hook events to HookFiringSchema
│   │   └── atomicWrite.ts         # write-to-.tmp + rename
│   └── test/                      # vitest coverage
├── shared/src/schemas/
│   ├── skills.ts                  # NEW — SkillFrontmatterSchema, GlobalSkillsResponseSchema, LocalSkillsResponseSchema
│   ├── agentlinter.ts             # NEW — AgentLinterScoreSchema, DiagnosticSchema, AgentLinterResponseSchema (with failure-class discriminator)
│   ├── observability.ts           # NEW — ObservabilitySignalSchema, ObservabilityResponseSchema
│   ├── secrets.ts                 # NEW — SecretsResponseSchema (present-valid | present-invalid | absent)
│   └── integrations.ts            # NEW — IntegrationStateSchema (3-state), IntegrationsResponseSchema
└── spa/src/
    ├── components/
    │   ├── SingleProjectView.tsx  # EDIT — grid 1fr_1.5fr → 1fr_1.5fr_1fr + <section data-testid="health-column">
    │   └── panels/
    │       ├── InstalledSkills.tsx     # NEW
    │       ├── SkillHealth.tsx         # NEW
    │       ├── ObservabilityHealth.tsx # NEW
    │       ├── SecretsHealth.tsx       # NEW
    │       └── IntegrationsHealth.tsx  # NEW
    └── lib/projectQueries.ts      # EDIT — add 6 new hooks (useGlobalSkills, useLocalSkills, useAgentLinter, useObservability, useSecrets, useIntegrations)
```

### Pattern 1: Singleton (no projectId) global skills route — D-5-12

**What:** A `/api/skills/global` route with no projectId path segment. One cache, all projects share. Allow-list anchored at `os.homedir() + '/.claude/skills'`.

**When to use:** Anything that's user-scoped, not project-scoped (and the dashboard daemon already runs as the user, so this is a natural fit).

**Example:**
```typescript
// Source: packages/agent/src/routes/skills.ts (NEW)
// Pattern derived from existing routes/observations.ts shape.
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Hono } from 'hono'
import { GlobalSkillsResponseSchema } from '@agenticapps/dashboard-shared'

import { readGlobalSkills } from '../lib/skillsScan.js'
import { getHealthCache, setHealthCache } from '../lib/healthCache.js'
import { outbound } from '../server/middleware/errors.js'

export const skillsRoute = new Hono<Env>()

const GLOBAL_SKILLS_TTL_MS = 60_000  // Claude's-Discretion: 60s default per CONTEXT.md

skillsRoute.get('/skills/global', async (c) => {
  const cacheKey = 'skills:global'  // No projectId — singleton
  const cached = getHealthCache(cacheKey)
  if (cached !== null) {
    return outbound(c, GlobalSkillsResponseSchema.parse.bind(GlobalSkillsResponseSchema), cached)
  }
  const root = join(homedir(), '.claude', 'skills')
  const value = await readGlobalSkills(root)
  setHealthCache(cacheKey, value, GLOBAL_SKILLS_TTL_MS)
  return outbound(c, GlobalSkillsResponseSchema.parse.bind(GlobalSkillsResponseSchema), value)
})
```

### Pattern 2: SKILL.md frontmatter reader (canonical OR bundle layout)

**What:** Read `<root>/<dirName>/SKILL.md` first (canonical), then `<root>/<dirName>/skill/SKILL.md` (bundle). Parse the YAML frontmatter (everything between the first two `---` lines). Return `{ name, description, version?, paths?, ...extras }`.

**Why prior art exists:** `phaseDetail.ts` already implements `findSkillPath()` (lines 129–137) for the dual-layout probe. Phase 5 reuses this directly — no new probe code.

**Example:**
```typescript
// Source: packages/agent/src/lib/skillsScan.ts (NEW)
// findSkillPath() is the existing helper from phaseDetail.ts:129-137
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type SkillFrontmatter = {
  name: string
  description?: string
  version?: string
  // passthrough — preserve unknown fields per D-4-06 philosophy
  [k: string]: unknown
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/m

export function parseFrontmatter(skillMdPath: string): SkillFrontmatter | null {
  let raw: string
  try { raw = readFileSync(skillMdPath, 'utf8') } catch { return null }
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return null
  const body = m[1]!
  const out: Record<string, unknown> = {}
  // Hand-rolled simple `key: value` parser. Multi-line values via `|` not supported
  // for v1 — claude-code SKILL.md convention is single-line values.
  for (const line of body.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (key) out[key] = val
  }
  // name is required-ish; if missing, fall back to dirname-based name
  if (typeof out.name !== 'string') {
    out.name = skillMdPath.split('/').slice(-2, -1)[0] ?? 'unknown'
  }
  return out as SkillFrontmatter
}
```

**Note on `description: |` multi-line:** The existing `agentic-apps-workflow` SKILL.md uses `description: |` followed by an indented block. For HEALTH-01 we only need the first line of `description` for the panel listing — a simple parser that takes the literal value after `:` is fine if we also handle `|` by reading subsequent indented lines. Planner picks: full multi-line YAML support OR truncate description at first newline (the latter is simpler and sufficient given Claude Code's 1,536-character description cap [CITED: code.claude.com/docs/en/skills frontmatter reference]).

### Pattern 3: Name-restricted resolveAllowed extension — D-5-13

**What:** Variant of `resolveAllowed` that asserts both the realpath under an allowed root AND the basename in an explicit whitelist.

**When to use:** Any read of a top-level project metadata file (`package.json`, `.infisical.json`, `.sentryclirc`) or a CI YAML.

**Example:**
```typescript
// Source: packages/agent/src/lib/paths.ts (EDIT — append, don't replace)
import { realpath } from 'node:fs/promises'
import { resolve, isAbsolute, sep, basename } from 'node:path'

export interface ResolveAllowedNamedOpts {
  /** Allowed root directories (each will be realpath'd). */
  roots: string[]
  /** Permitted basenames. Mutually exclusive with extension. */
  allowedNames?: string[]
  /** Permitted file extension (e.g. '.yml'). Mutually exclusive with allowedNames. */
  extension?: string
}

export async function resolveAllowedNamed(
  candidatePath: string,
  opts: ResolveAllowedNamedOpts,
): Promise<string> {
  if (isAbsolute(candidatePath)) {
    // For named reads we ALLOW absolute paths IF realpath under one of opts.roots.
    // (Caller passes absolute paths like join(projectRoot, 'package.json') —
    // they aren't user-supplied path segments.)
  }
  let real: string
  try { real = await realpath(candidatePath) } catch { throw new PathViolation('not accessible') }

  const realRoots = await Promise.all(opts.roots.map(async (r) => {
    try { return await realpath(r) } catch { return resolve(r) }
  }))
  const inRoot = realRoots.some((r) => real === r || real.startsWith(r + sep))
  if (!inRoot) throw new PathViolation('outside allowed roots')

  const name = basename(real)
  if (opts.allowedNames && !opts.allowedNames.includes(name)) {
    throw new PathViolation(`name not in allow-list: ${name}`)
  }
  if (opts.extension && !name.endsWith(opts.extension)) {
    throw new PathViolation(`extension not allowed: ${name}`)
  }
  return real
}
```

**Don't break the existing `resolveAllowed`** — it's the contract for `/api/projects/:id/read`. Add a sibling function so the existing tests don't churn.

### Pattern 4: AgentLinter subprocess + cache + failure classification

**What:** Run `npx agentlinter --local --json <projectRoot>` via execa, parse JSON output, cache with mtime + 1h ceiling key, classify failure modes per D-5-15.

**Example:**
```typescript
// Source: packages/agent/src/lib/agentLinterRunner.ts (NEW)
import { execa } from 'execa'

const TIMEOUT_MS = 30_000  // D-5-15 timeout threshold
const CACHE_TTL_MS = 3_600_000  // 1h hard ceiling per D-5-14

export type AgentLinterResult =
  | { kind: 'ok'; data: AgentLinterReport }
  | { kind: 'not-installed' }
  | { kind: 'timeout' }
  | { kind: 'error'; exitCode: number; stderr: string }
  | { kind: 'unparseable'; exitCode: number; rawStdout: string }

export async function runAgentLinter(projectRoot: string): Promise<AgentLinterResult> {
  let proc
  try {
    proc = await execa('npx', ['--yes', 'agentlinter', '--local', '--json', projectRoot], {
      timeout: TIMEOUT_MS,
      reject: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e: any) {
    if (e?.timedOut) return { kind: 'timeout' }
    return { kind: 'not-installed' }  // npx couldn't even start
  }
  if (proc.timedOut) return { kind: 'timeout' }
  // Detect "command not found" — npx prints "npm error 404 Not Found" or similar
  if (proc.exitCode !== 0) {
    if (/E404|not found/i.test(proc.stderr ?? '')) return { kind: 'not-installed' }
    // Try to parse JSON error envelope; otherwise classify unparseable
    try {
      const parsed = JSON.parse(proc.stdout)
      return { kind: 'ok', data: parsed }  // Some errors still emit valid JSON
    } catch {
      return { kind: 'error', exitCode: proc.exitCode ?? -1, stderr: proc.stderr ?? '' }
    }
  }
  try {
    return { kind: 'ok', data: JSON.parse(proc.stdout) }
  } catch {
    return { kind: 'unparseable', exitCode: proc.exitCode ?? 0, rawStdout: proc.stdout }
  }
}
```

**Cache key shape (D-5-14):** `{ projectId, maxMtime }`. Compute `maxMtime` by walking `<root>/.claude/skills/**/SKILL.md` + `~/.claude/skills/**/SKILL.md` and taking the max `mtimeMs`. Cache hit when both `projectId` and `maxMtime` match AND `now - cachedAt < 1h`.

### Pattern 5: Three-state IntegrationsHealth — D-5-19

**What:** For each integration (Sentry, Linear, Infisical), compute one of `configured` / `present-but-not-configured` / `not-detected` based on the cross product of (env var present on daemon) × (signal detected in project).

**Logic table:**

| Env var on daemon | Signal in project | State |
|-------------------|-------------------|-------|
| Yes | Any | `configured` |
| No | Yes | `present-but-not-configured` |
| No | No | `not-detected` |

**Per-integration env vars:**

| Integration | Env var | Project signal source |
|-------------|---------|----------------------|
| Sentry | `SENTRY_AUTH_TOKEN` | ObservabilityHealth Sentry signals (D-5-17) |
| Linear | `LINEAR_API_KEY` | branch name regex `^[A-Z]{2,}-\d+` OR commit subject mentions Linear-style ID |
| Infisical | (any of `INFISICAL_TOKEN`, `INFISICAL_API_TOKEN`) | SecretsHealth `present-valid` (.infisical.json) |

**Example:**
```typescript
// Source: packages/agent/src/lib/integrationsState.ts (NEW)
export type IntegrationState = 'configured' | 'present-but-not-configured' | 'not-detected'

export function computeState(
  envVarPresent: boolean,
  signalDetected: boolean,
): IntegrationState {
  if (envVarPresent) return 'configured'
  if (signalDetected) return 'present-but-not-configured'
  return 'not-detected'
}
```

### Pattern 6: SessionEnd hook reads `transcript_path` (THE meta-observer pattern)

**What:** Claude Code's SessionEnd hook receives JSON on stdin including `transcript_path` — the absolute path to the session's JSONL transcript. The hook reads that file and extracts:
1. The most recent `## Workflow commitment` block from any user/assistant message (write to `.md`).
2. All hook-firing-relevant events (write to `.jsonl`, validated against `HookFiringSchema`).

**Why this is the right shape (and what the original CONTEXT.md missed):** D-5-04 picked SessionEnd as the writer; D-5-05 said the persister writes `.md` + `.jsonl`. The unstated assumption was that the meta-observer would somehow capture per-tool-call events itself. **It doesn't need to** — Claude Code already records the entire session, including all tool calls, in `transcript_path`. The meta-observer's job is purely **post-processing the transcript at session end**. This collapses scope significantly and removes the need for a high-frequency PostToolUse hook (which D-5-04 already rejected).

**Hook payload (verified):**
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/donald/.claude/projects/-Users-donald-Sourcecode-agenticapps-dashboard/abc123.jsonl",
  "cwd": "/Users/donald/Sourcecode/agenticapps-dashboard",
  "hook_event_name": "SessionEnd"
}
```

**Project root resolution (`D-5-07` path):**

```typescript
// Source: packages/meta-observer/lib/projectRoot.ts (NEW)
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function resolveProjectRoot(payload: { cwd?: string }): string | null {
  // Prefer CLAUDE_PROJECT_DIR (verified exposed by Claude Code, see RESEARCH).
  const envRoot = process.env.CLAUDE_PROJECT_DIR
  if (envRoot && (existsSync(join(envRoot, '.planning')) || existsSync(join(envRoot, '.claude')))) {
    return envRoot
  }
  // Fall back to CWD walk-up per D-5-07
  let dir = payload.cwd ?? process.cwd()
  const root = '/'
  while (dir !== root) {
    if (existsSync(join(dir, '.planning')) || existsSync(join(dir, '.claude'))) return dir
    dir = dirname(dir)
  }
  return null  // silent skip per D-5-07
}
```

**Example SKILL.md frontmatter for the meta-observer skill:**

```yaml
---
name: meta-observer
description: Records this session's commitment block and hook firings into .planning/skill-observations/ at session end. Used by the AgenticApps dashboard to populate Discipline panels.
disable-model-invocation: true
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: ${CLAUDE_SKILL_DIR}/hooks/session-end.mjs
          timeout: 30
---

# meta-observer (silent persister; no user-facing skill body needed beyond install verification)
```

[CITED: code.claude.com/docs/en/skills, frontmatter reference + Hooks in skills section]

### Anti-Patterns to Avoid

- **Exposing top-level metadata via `/read`** — Phase 1 D-23's `ALLOWED_SUBDIRS = ['.planning', '.claude']` is a security perimeter. Adding `package.json` to the read-allow list bypasses the principle that the SPA can name what it wants to read. Stay with dedicated routes (D-5-11). [VERIFIED: paths.ts:4]
- **Single-state IntegrationsHealth** — "configured / not-configured" hides the detection signal. A user who installed `@sentry/node` but didn't set `SENTRY_AUTH_TOKEN` deserves a different nudge than a user with no Sentry signals at all. D-5-19 is calibrated for that gradient.
- **PostToolUse hook for hook firings** — high-frequency write path was already rejected by D-5-04. The transcript file already contains every tool call and every hook firing — read it once at SessionEnd.
- **Caching AgentLinter results across daemon restarts via in-memory only** — the user's first dashboard load after restart will block on a 5–30s subprocess. Either disk-cache (mode `0600` per INV-02) OR show "Computing..." with the empty state copy explicitly indicating "first run". Planner picks (Claude's Discretion).
- **Hand-rolling YAML for SKILL.md `description: |` multi-line blocks without thinking** — YAML literal blocks (`|`) preserve newlines; folded blocks (`>`) collapse them. The minimum viable parser that still works on real files: when a value is exactly `|`, read subsequent lines that begin with whitespace deeper than the key indent, joined with `\n`. Anything else is over-engineering for v1.
- **Direct write of `.md` / `.jsonl`** — non-atomic. The Phase 4 CommitmentBlock reader uses `mtimeMs` + `readFileSync` and could pick up a half-written file. Use write-to-`.tmp` + rename (planner default per Claude's Discretion).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess execution with timeout + reject:false + stdio capture | Custom `child_process.spawn` wrapper | `execa` (already in package.json) | Phase 4 already uses this for git; same patterns + tests. |
| HTTP route + bearer + CORS | Hand-rolled http.createServer | Hono (already in package.json) | Existing `app.ts` middleware chain handles bearer + CORS + CIDR. New routes plug in. |
| Schema validation at the wire boundary | Custom validators | Zod via `outbound()` helper | Phase 1 D-16 + D-23 patterns. Existing `outbound(c, parser, value)` helper in middleware/errors.ts. |
| Path traversal defense | Re-implement realpath check | Reuse `resolveAllowed` family in paths.ts (extend per D-5-13) | Single defence pattern across codebase, well-tested. |
| TanStack Query polling + 401 handling | Custom fetch + interval | Existing `apiFetch` + `queryClient` infrastructure | Phase 2 D-06/D-07/D-09 + Phase 4 patterns. RepairBanner + SchemaDriftState already wired. |
| `.infisical.json` parsing | bespoke schema validator | `JSON.parse` + simple `typeof workspaceId === 'string'` check | Spec says "informational only; no API calls" — minimal schema check is sufficient. |
| `.sentryclirc` INI parsing | a full INI lib | hand-rolled regex (`/^\s*\[(\w+)\]/` for sections + `/^\s*([\w_-]+)\s*=\s*(.*)$/` for k/v) | We only need to assert "file is present + parses without throwing". We don't extract any values. |
| YAML CI workflow parsing | `js-yaml` | grep for `sentry-cli` substring + `actions/` references | We don't need a real YAML parser for "does this file mention sentry-cli". Substring grep is honest about what we're doing. |

**Key insight:** Phase 5 has many panels but they all reduce to **detect + render**. The detection logic is grep-and-parse; the rendering is "render this object". Both halves are explicitly NOT a great place to introduce new dependencies. Phase 5 ships ~7 plans of pure file-edit work using the existing toolbox.

## Runtime State Inventory

> N/A — this is a greenfield additive phase, not a rename/refactor/migration. No existing runtime state needs migration. The closest thing is the cache eviction call (`evictPhaseCacheProject`) on `/unregister` — Phase 4 already added this hook; Phase 5 reuses the same cache module via `evictHealthCacheProject(projectId)` (or generalises `phaseCache` to a single cache module — Claude's Discretion per CONTEXT.md).

## Common Pitfalls

### Pitfall 1: AgentLinter `scan` subcommand doesn't exist
**What goes wrong:** The spec literally says "runs `npx agentlinter scan`" (`docs/spec/dashboard-prompt.md:338`). The actual CLI doesn't have a `scan` subcommand — it's `npx agentlinter [path]` with `--local` and `--json` flags.
**Why it happens:** AgentLinter changed its CLI surface (or the spec was written from imagination). 2026-05-07 actual `--help` output: `Usage: npx agentlinter [path]`. There's no `scan`.
**How to avoid:** The plan's daemon code MUST use `npx --yes agentlinter --local --json <projectRoot>`, NOT `npx agentlinter scan`. Plan tests must spawn the real binary at least once to catch CLI drift. [VERIFIED: ran `npx --yes agentlinter --help` against the live registry, 2026-05-07]
**Warning signs:** `proc.exitCode === 1` with stderr "unknown command 'scan'" or a help-page dump on stdout.

### Pitfall 2: AgentLinter only emits `info | warning | error` — D-4-16 has FOUR glyphs
**What goes wrong:** D-4-16 locked four severity glyphs (🔴 critical / 🟠 high / 🟡 medium / ⚪ low) for the unified Phase 4 + Phase 5 surface. AgentLinter emits only three: `info`, `warning`, `error` (verified against actual JSON output 2026-05-07).
**Why it happens:** Different tools, different vocabularies. CSO emits `critical | high | medium | low`. Phase 3/4 unified to four. AgentLinter never had four.
**How to avoid:** Lock a coercion table in shared schema:

| AgentLinter | Phase 4 D-4-16 glyph |
|-------------|----------------------|
| `error` | 🔴 critical |
| `warning` | 🟠 high |
| `info` | ⚪ low |
| (no medium) | (medium glyph unused for AgentLinter findings) |

Document this in the schema comment so future readers don't confuse "no medium" with a bug. Surface the choice as a planner-locked decision (D-5-21 candidate). [VERIFIED: `npx --yes agentlinter --local --json` against this repo, 2026-05-07 — diagnostics array contains exactly `severity: "info" | "warning"` values, plus `error` per the docs]

### Pitfall 3: `--local` flag matters
**What goes wrong:** Default `npx agentlinter` UPLOADS the report to AgentLinter's hosted service. The dashboard daemon would be silently shipping CLAUDE.md content off-machine.
**Why it happens:** AgentLinter's `--local` (alias `--no-share`) disables this; default behaviour is "lint & share report".
**How to avoid:** ALWAYS pass `--local` AND `--json`. Test must assert the actual command invoked includes both flags. The privacy invariant ("no remote services storing my data" — CLAUDE.md) is at stake. [VERIFIED: `npx --yes agentlinter --help` 2026-05-07: `Usage: npx agentlinter [path] - Lint & share report (default); --local: skip upload`]

### Pitfall 4: `agentlinter` invoked at the project root scans CLAUDE.md, not skills
**What goes wrong:** The spec says "runs against the project's CLAUDE.md tree" (line 339). AgentLinter detects `CLAUDE.md`, `AGENTS.md`, etc. — but it does NOT recurse into `.claude/skills/*/SKILL.md` automatically.
**Why it happens:** AgentLinter's job is the agent config itself, not the skill bundles.
**How to avoid:** Consider invoking the linter once per skill directory: `npx agentlinter --local --json <root>/.claude/skills/<skill>/`. Cost: N subprocess invocations per project. Alternative: invoke once at project root for the "CLAUDE.md health" signal AND surface skills' `SKILL.md` count separately (HEALTH-01 already does this). Planner picks. **Recommendation:** ship v1 with project-root invocation only (matches spec); add per-skill invocation in Phase 6 polish if SkillHealth feels too coarse.

### Pitfall 5: `transcript_path` may be huge
**What goes wrong:** A long Claude Code session's transcript can be many MB. Reading it synchronously into memory at SessionEnd blocks the hook for noticeable time.
**Why it happens:** Transcripts are append-only JSONL; nothing prunes them.
**How to avoid:** Use `node:readline` streaming (the same pattern Phase 4 already uses in `readSkillObservations`). Single pass: extract all `## Workflow commitment` markers (keep last) + filter for tool/hook events.
**Warning signs:** Hook timeout on long sessions. The default hook timeout is generous (typically 60s+) but "command timeout: 30" in the SKILL.md frontmatter would cap it.

### Pitfall 6: Path allow-list ambiguity for `.github/workflows/*.yml`
**What goes wrong:** The spec calls for grepping CI files (line 500). `<root>/.github/workflows/` is NOT under `.planning` or `.claude`. The existing `resolveAllowed` rejects it.
**Why it happens:** Phase 5's allow-list extension (D-5-13) is for top-level metadata files (`package.json`, `.infisical.json`). CI files are a different category.
**How to avoid:** Use `resolveAllowedNamed` with `roots: [join(projectRoot, '.github/workflows')], extension: '.yml'`. Test must assert that `<root>/.github/workflows/../../etc/passwd` rejects via realpath check. Test must also assert that `<root>/.github/no-workflows/foo.yml` rejects (different folder under `.github`).

### Pitfall 7: Caching mtime across two roots (project + global)
**What goes wrong:** D-5-14 keys cache on max mtime "across all SKILL.md". Walking `~/.claude/skills/` in addition to `<root>/.claude/skills/` doubles the I/O, AND a SKILL.md change in ANY project's local skills will not invalidate the cache (only mtime in THIS project + global counts).
**Why it happens:** Cache is per-projectId, but the AgentLinter scan covers BOTH project + global skills. If global skill changes, EVERY project's cache should invalidate.
**How to avoid:** Cache key MUST include max(maxMtime(project), maxMtime(global)). Walking global skills once and remembering the result for 60s avoids per-request global walks.
**Recommendation:** Compose two cache layers — `globalSkillsMaxMtime` (60s TTL, single cell) + `projectAgentLinterCache` (1h TTL, keyed by projectId + max(globalMtime, projectMtime)).

### Pitfall 8: Spotlight package family (sidecar vs spotlight)
**What goes wrong:** D-5-17 says "deps include `@spotlightjs/*`". The package family includes BOTH `@spotlightjs/spotlight` (the overlay) AND `@spotlightjs/sidecar` (the proxy). Some setups install only the sidecar.
**Why it happens:** Spotlight is two packages by design — UI + transport.
**How to avoid:** Match `^@spotlightjs/`. Don't anchor the regex to `spotlight` specifically. [CITED: npmjs.com/package/@spotlightjs/spotlight + npmjs.com/package/@spotlightjs/sidecar, 2026-05-07].

### Pitfall 9: `sentry-cli` is `@sentry/cli`, not standalone `sentry-cli`
**What goes wrong:** D-5-17 mentions `sentry-cli`. Searching npm for `sentry-cli` finds a 1-version squat at `0.0.0`. The actual package is `@sentry/cli` (latest 4.11.3 at 2026-05-07).
**Why it happens:** Sentry rebranded; the unscoped name was reserved.
**How to avoid:** When grepping `package.json` deps for sentry-cli usage, look for `@sentry/cli` AND `sentry-cli` (the latter as a CLI script reference). When detecting the binary on PATH, look for the executable name `sentry-cli` (still works regardless of how it was installed). [VERIFIED: `npm view sentry-cli` and `npm view @sentry/cli`, 2026-05-07].

### Pitfall 10: `paths:` skill frontmatter activates only on file matches
**What goes wrong:** `paths:` glob patterns in SKILL.md frontmatter limit when Claude loads the skill. If meta-observer SKILL.md uses `paths: .planning/**`, the SessionEnd hook may not fire on sessions that never touched `.planning/`.
**Why it happens:** Hooks scoped to skill lifecycle fire only when the skill is active.
**How to avoid:** Do NOT set `paths:` in meta-observer SKILL.md. Set `disable-model-invocation: true` so the skill never auto-loads but the SessionEnd hook still fires (per the docs: hooks "scoped to component lifetime" — but a SessionEnd hook on a never-activated skill could be a footgun). **Researcher's recommendation:** test this with a real skill install before shipping. If skill-scoped hooks don't fire when the skill is dormant, fall back to declaring the hook in `.claude/settings.json` instead of skill frontmatter — the meta-observer SKILL.md becomes a docs marker only. [LOW confidence — needs live test in Wave 0]

## Code Examples

### Skill frontmatter parsing — works against real SKILL.md files

```typescript
// Source: packages/agent/src/lib/skillsScan.ts (NEW)
// Tested against: ~/.claude/skills/agentic-apps-workflow/SKILL.md (real file 2026-05-07)
// which uses both `description: |` block style and inline keys.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export function readGlobalSkills(root: string): {
  scope: 'global'
  skills: Array<SkillFrontmatter & { dir: string }>
} {
  let entries: string[]
  try { entries = readdirSync(root) } catch { return { scope: 'global', skills: [] } }
  const skills: Array<SkillFrontmatter & { dir: string }> = []
  for (const dir of entries) {
    // Probe canonical first, then bundle (per Phase 4 findSkillPath pattern)
    const canonical = join(root, dir, 'SKILL.md')
    const bundle = join(root, dir, 'skill', 'SKILL.md')
    let path: string | null = null
    try {
      readFileSync(canonical, 'utf8')
      path = canonical
    } catch {
      try {
        readFileSync(bundle, 'utf8')
        path = bundle
      } catch { /* skip — neither exists */ }
    }
    if (!path) continue
    const fm = parseFrontmatter(path)
    if (fm) skills.push({ ...fm, dir })
  }
  return { scope: 'global', skills }
}
```

### AgentLinter actual JSON output (verified 2026-05-07 against this repo)

```json
{
  "score": 92,
  "categories": [
    { "name": "Structure", "score": 100, "weight": 0.12, "issues": 0 },
    { "name": "Clarity", "score": 69, "weight": 0.2, "issues": 15 },
    { "name": "Completeness", "score": 95, "weight": 0.12, "issues": 1 },
    { "name": "Security", "score": 95, "weight": 0.15, "issues": 1 },
    { "name": "Consistency", "score": 100, "weight": 0.08, "issues": 0 },
    { "name": "Memory", "score": 100, "weight": 0.1, "issues": 0 },
    { "name": "Runtime Config", "score": 99, "weight": 0.13, "issues": 1 },
    { "name": "Skill Safety", "score": 100, "weight": 0.1, "issues": 0 }
  ],
  "diagnostics": [
    {
      "severity": "info",
      "category": "clarity",
      "rule": "clarity/has-examples",
      "file": "CLAUDE.md",
      "message": "No examples found...",
      "fix": "Add a ## Examples section..."
    },
    {
      "severity": "warning",
      "category": "clarity",
      "rule": "clarity/escape-hatch-missing",
      "file": "CLAUDE.md",
      "line": 36,
      "message": "Absolute rule without escape hatch...",
      "fix": "Add an exception path..."
    }
    // ... 15 more diagnostics in this run
  ],
  "files": ["CLAUDE.md"],
  "timestamp": "2026-05-07T10:21:00.512Z"
}
```

**The "Position Risk" surface (D-5-16) IS the diagnostics list filtered by category.** AgentLinter doesn't have an explicit "Position Risk" category in the actual output — it has `clarity`, `completeness`, `security`, `consistency`, `memory`, `runtime`, `skill-safety`, and `structure`. The spec's "Position Risk" terminology is from an older AgentLinter version OR an aspirational name. **Recommendation:** map "Position Risk" in the panel UI to the count of `severity in {warning, error}` diagnostics, OR rename the panel to "AgentLinter findings". Surface this to the planner / discuss-phase as needing user confirmation. [VERIFIED via live tool run 2026-05-07]

### Zod schemas (concrete shapes for the new wire surfaces)

```typescript
// Source: packages/shared/src/schemas/skills.ts (NEW)
import { z } from 'zod'

export const SkillFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
}).passthrough()
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>

export const SkillEntrySchema = SkillFrontmatterSchema.extend({
  dir: z.string(),
  scope: z.enum(['global', 'local']),
})
export type SkillEntry = z.infer<typeof SkillEntrySchema>

export const GlobalSkillsResponseSchema = z.object({
  scope: z.literal('global'),
  skills: z.array(SkillEntrySchema),
})
export const LocalSkillsResponseSchema = z.object({
  scope: z.literal('local'),
  skills: z.array(SkillEntrySchema),
})
```

```typescript
// Source: packages/shared/src/schemas/agentlinter.ts (NEW)
import { z } from 'zod'

export const AgentLinterSeveritySchema = z.enum(['info', 'warning', 'error'])

export const AgentLinterDiagnosticSchema = z.object({
  severity: AgentLinterSeveritySchema,
  category: z.string(),
  rule: z.string(),
  file: z.string(),
  line: z.number().optional(),
  message: z.string(),
  fix: z.string().optional(),
})

export const AgentLinterCategoryScoreSchema = z.object({
  name: z.string(),
  score: z.number(),
  weight: z.number(),
  issues: z.number(),
})

export const AgentLinterReportSchema = z.object({
  score: z.number(),
  categories: z.array(AgentLinterCategoryScoreSchema),
  diagnostics: z.array(AgentLinterDiagnosticSchema),
  files: z.array(z.string()),
  timestamp: z.string(),
})

// Discriminated union for the failure-class surface (D-5-15)
export const AgentLinterResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ok'), report: AgentLinterReportSchema, cachedAt: z.string() }),
  z.object({ kind: z.literal('not-installed') }),
  z.object({ kind: z.literal('timeout') }),
  z.object({ kind: z.literal('error'), exitCode: z.number(), stderr: z.string() }),
  z.object({ kind: z.literal('unparseable'), exitCode: z.number(), rawStdout: z.string() }),
])
```

```typescript
// Source: packages/shared/src/schemas/observability.ts (NEW)
import { z } from 'zod'

export const ObservabilitySignalSchema = z.object({
  signal: z.enum([
    'sentry-sdk-dep',          // package.json deps include @sentry/*
    'sentry-cli-script',       // package.json scripts mention sentry-cli
    'sentryclirc',             // .sentryclirc exists
    'sentry-dsn-env',          // .env mentions SENTRY_DSN
    'spotlight-dep',           // package.json deps include @spotlightjs/*
    'spotlight-dir',           // .spotlight/ exists
    'sentry-cli-binary',       // sentry-cli on PATH
    'sentry-cli-script-script',
    'sentry-cli-ci',           // .github/workflows/*.yml mentions sentry-cli
  ]),
  evidence: z.string(),  // Human-readable: "@sentry/node@10.52.0", ".sentryclirc:1", etc.
})

export const ObservabilityToolStateSchema = z.object({
  detected: z.boolean(),
  signals: z.array(ObservabilitySignalSchema),
})

export const ObservabilityResponseSchema = z.object({
  sentry: ObservabilityToolStateSchema,
  spotlight: ObservabilityToolStateSchema,
  sentryCli: ObservabilityToolStateSchema,
})
```

```typescript
// Source: packages/shared/src/schemas/secrets.ts (NEW)
import { z } from 'zod'

export const SecretsResponseSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('present-valid'), workspaceId: z.string(), defaultEnvironment: z.string().optional() }),
  z.object({ state: z.literal('present-invalid'), reason: z.string() }),
  z.object({ state: z.literal('absent') }),
])
```

```typescript
// Source: packages/shared/src/schemas/integrations.ts (NEW)
import { z } from 'zod'

export const IntegrationStateSchema = z.enum(['configured', 'present-but-not-configured', 'not-detected'])

export const IntegrationsResponseSchema = z.object({
  sentry: IntegrationStateSchema,
  linear: IntegrationStateSchema,
  infisical: IntegrationStateSchema,
})
```

### `.infisical.json` validity check (real schema 2026)

```typescript
// Source: packages/agent/src/lib/projectMetadataScan.ts (NEW, partial)
// Schema verified against infisical.com/docs/cli/project-config 2026-05-07.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { z } from 'zod'
import type { SecretsResponseSchema } from '@agenticapps/dashboard-shared'

type SecretsResponse = z.infer<typeof SecretsResponseSchema>

export function parseInfisicalConfig(projectRoot: string): SecretsResponse {
  const candidate = join(projectRoot, '.infisical.json')
  let raw: string
  try { raw = readFileSync(candidate, 'utf8') }
  catch { return { state: 'absent' } }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return { state: 'present-invalid', reason: 'not a JSON object' }
    }
    if (typeof parsed.workspaceId !== 'string' || parsed.workspaceId.length === 0) {
      return { state: 'present-invalid', reason: 'missing or empty workspaceId' }
    }
    return {
      state: 'present-valid',
      workspaceId: parsed.workspaceId,
      defaultEnvironment: typeof parsed.defaultEnvironment === 'string' ? parsed.defaultEnvironment : undefined,
    }
  } catch (e) {
    return { state: 'present-invalid', reason: e instanceof Error ? e.message : 'parse failed' }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npx agentlinter scan` (spec) | `npx agentlinter --local --json [path]` | AgentLinter 0.x changed CLI surface | Plan must use new flags; spec-as-written would fail |
| Single-version `sentry-cli` npm | `@sentry/cli` scoped | Sentry brand consolidation | Detection must look for both names in package.json |
| Settings.json hooks only | Hooks via skill frontmatter | Claude Code skills + `hooks:` field | Meta-observer can ship as a self-contained skill bundle |
| `description` as plain string in SKILL.md | YAML literal block (`|`) for multi-line | Best practice in real skills | Frontmatter parser must handle `|` or read first line only |
| Native deps for keychain access (Phase 1 ruled out) | Bearer token in `~/.agenticapps/dashboard/auth.json` mode `0600` | Phase 1 D-13/14/15 | Already locked — Phase 5 inherits |

**Deprecated/outdated:**

- The spec phrase "`npx agentlinter scan`" — there is no `scan` subcommand. Reinterpret as `npx agentlinter --local --json [path]`.
- The spec phrase "Position Risk warnings" (line 499) — actual AgentLinter taxonomy is 8 categories (Structure, Clarity, Completeness, Security, Consistency, Memory, Runtime Config, Skill Safety) and 3 severities (`info`, `warning`, `error`). "Position Risk" appears to be aspirational naming. SkillHealth panel UX needs to choose: rename to "AgentLinter findings" OR map "Position Risk" to a specific category subset (recommendation: map to `clarity` + `consistency` issues, since those are about prompt-ordering/positioning).

## Assumptions Log

> Claims tagged `[ASSUMED]` here need user confirmation before becoming a locked Phase 5 decision (planner picks; ideally surfaced as a follow-up `/gsd-discuss-phase` round if any are load-bearing).

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Position Risk" in the spec maps to `clarity` + `consistency` AgentLinter categories | Pitfall 2 / State of the Art | UX label mismatches what the linter actually surfaces; planner can choose any sensible mapping but should commit to one. |
| A2 | Skill-scoped `SessionEnd` hooks fire even when the skill itself is dormant (i.e., never explicitly invoked in a session) | Pitfall 10 | If false: the meta-observer hook never runs, and the dashboard's CommitmentBlock + HookFirings stay empty regardless. **HIGH RISK** — Wave 0 must include a live install + dummy session test. Mitigation: fall back to a `.claude/settings.json` hook entry per project. |
| A3 | The transcript JSONL contains `## Workflow commitment` markdown verbatim in user/assistant message bodies | Pattern 6 | If transcripts encode markdown differently (e.g. as content blocks with role metadata), the regex extractor needs a different shape. Wave 0 should sample a real transcript file from `~/.claude/projects/`. |
| A4 | A 60s TTL is "long enough" for `/api/skills/global` to feel responsive after `claude skill install` | Claude's Discretion / Pattern 1 | If users install a skill and the dashboard takes >60s to surface it, install-time UX feels janky. Mitigation: planner can wire a manual "refresh" affordance in InstalledSkills panel header. |
| A5 | AgentLinter's `--json` output schema is stable across patch versions | Pattern 4 / Code Examples | If 0.4.x changes the JSON shape, the AgentLinterReportSchema needs a more permissive/passthrough shape. Mitigation: schema uses literal field names but preserves unknown keys via `.passthrough()`. |
| A6 | The meta-observer skill writes to `<projectRoot>/.planning/skill-observations/` is OK because the SKILL.md install is user-initiated (not daemon-driven), preserving INV-01 | D-5-09 + D-5-10 | The user-initiated framing is in 05-CONTEXT.md (D-5-09); legal/audit interpretation may differ. Surface to /cso review. |
| A7 | INI parse for `.sentryclirc` need only check "file is present + parses without throwing" (no value extraction) | Don't Hand-Roll | If a future panel wants to surface "DSN configured for project X", we'd need real INI parsing. Phase 5 doesn't, but Phase 7 might. |
| A8 | `LINEAR_API_KEY` is the canonical Linear env var; no `.linearrc` config file exists | Pattern 5 | [VERIFIED: linear.app/docs + @linear/sdk README, 2026-05-07] — but the project signal is weak (just branch name regex). Could feel noisy. |

## Open Questions

1. **"Position Risk" panel terminology — keep the spec name or rename to "AgentLinter findings"?**
   - What we know: Spec says "Position Risk warnings"; AgentLinter doesn't have that as a category in 2026.
   - What's unclear: Whether the spec writer was thinking of a specific AgentLinter version or a desired UX label.
   - Recommendation: planner picks "AgentLinter findings" (aligns with what the linter actually emits) and surfaces to user during plan-phase as a copy decision.

2. **Skill-scoped SessionEnd hook activation semantics**
   - What we know: Docs say hooks are "scoped to component lifetime" (skills code.claude.com/docs/en/skills).
   - What's unclear: Whether "lifetime" means "session lifetime" (always active when skill loaded) or "invocation lifetime" (only when skill is being used).
   - Recommendation: **Wave 0 live test**: install the skeleton meta-observer skill on the dashboard repo, run a non-meta-observer session, see if `session-end.mjs` fires. If not: fall back to `.claude/settings.json` hook entry — the SKILL.md still ships in `packages/meta-observer/` but its frontmatter no longer holds the hook.

3. **AgentLinter cache disk persistence — yes or no?**
   - What we know: D-5-14 says 1h TTL; CONTEXT.md `<decisions>` Claude's Discretion explicitly leaves persistence open.
   - What's unclear: Daemon restart frequency in dogfooding. The G1 closure (D-5-10) requires running a real session; Phase 5's dev-loop will restart the daemon repeatedly.
   - Recommendation: **In-memory only for v1**, with a planner note to revisit if the dogfood loop feels painful. On-disk cache adds 0600 permission enforcement code we don't otherwise need.

4. **Per-skill vs whole-project AgentLinter invocation**
   - What we know: AgentLinter scans CLAUDE.md by default; doesn't recurse into `.claude/skills/`.
   - What's unclear: Whether SkillHealth's per-skill row should each show a per-skill AgentLinter score (requires N subprocess invocations) or whether the panel shows a project-level health score plus skill listing.
   - Recommendation: project-level only for v1 (matches spec wording). SkillHealth panel groups by file: "CLAUDE.md (score 92, 17 diagnostics)". Per-skill scoring is a Phase 6 polish if visible value.

5. **Does Claude Code expose `CLAUDE_PROJECT_DIR` reliably across Mac / Linux / WSL?**
   - What we know: Docs claim it's exposed (verified via code.claude.com/docs/en/hooks 2026-05-07).
   - What's unclear: Whether all hook events get it, or only some (e.g., SessionStart sets it; SessionEnd may not).
   - Recommendation: the meta-observer's `resolveProjectRoot()` already has the CWD walk-up fallback per D-5-07. If `CLAUDE_PROJECT_DIR` is unset, it walks; tests must cover both paths.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 20 | Daemon + meta-observer | ✓ | v24.15.0 (dev machine, 2026-05-07) | — |
| `npx` | AgentLinter subprocess | ✓ | 11.12.1 | — |
| `claude` CLI | Meta-observer skill install + `claude skill install` | ✓ | found at `/Users/donald/.local/bin/claude` | Manual copy into `.claude/skills/` |
| `agentlinter` (npm) | SkillHealth scoring | ✓ | 0.3.3 (resolves via `npx --yes`) | D-5-15 `not-installed` empty state already designed |
| `sentry-cli` (PATH binary) | ObservabilityHealth detection signal | ✗ | — | Multi-signal detection — package.json + .sentryclirc + env still work |
| `.infisical.json` (in test project) | SecretsHealth `present-valid` test | ✗ | — | Test fixture writes a synthetic one |
| Pre-existing transcript JSONL files | Wave 0 transcript-shape probe (Q3 above) | ✓ | `~/.claude/projects/-Users-donald-Sourcecode-agenticapps-dashboard/` exists | — |

**Missing dependencies with no fallback:**
- None — all required tooling is available; missing tools (sentry-cli binary, .infisical.json) are themselves the absence-detection target.

**Missing dependencies with fallback:**
- AgentLinter not pre-installed: `npx --yes` resolves it on first run (~5–10s download cost on first call); D-5-15's `not-installed` state covers persistent `npx` resolution failure.

## Validation Architecture

> Phase 5 has `nyquist_validation: true` in `.planning/config.json` — full coverage required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (catalog) — already wired across all packages |
| Config file | `vitest.config.ts` per package (existing pattern) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test --run path/to/file.test.ts` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEALTH-01 | `readGlobalSkills()` reads `~/.claude/skills/*/SKILL.md` frontmatter | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/skillsScan.test.ts` | ❌ Wave 0 |
| HEALTH-01 | `readLocalSkills(projectRoot)` reads `<root>/.claude/skills/*/SKILL.md` (canonical + bundle layouts) | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/skillsScan.test.ts` | ❌ Wave 0 |
| HEALTH-01 | `GET /api/skills/global` route returns valid GlobalSkillsResponseSchema | integration (in-process Hono) | `pnpm --filter @agenticapps/dashboard-agent test src/routes/skills.test.ts` | ❌ Wave 0 |
| HEALTH-01 | `<InstalledSkills />` panel renders global + local with scope tags | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/InstalledSkills.test.tsx` | ❌ Wave 0 |
| HEALTH-02 | `runAgentLinter()` returns `kind: ok` on success, `kind: not-installed` on E404, `kind: timeout` on hang, `kind: error` on non-zero exit, `kind: unparseable` on garbage stdout | unit (mock execa for 4 of 5; 1 integration test runs real binary) | `pnpm --filter @agenticapps/dashboard-agent test src/lib/agentLinterRunner.test.ts` | ❌ Wave 0 |
| HEALTH-02 | Cache key includes `(projectId, max-mtime)`; cache hit when both unchanged + age < 1h | unit | same file | ❌ Wave 0 |
| HEALTH-02 | `<SkillHealth />` row click toggles inline detail; severity glyph mapping `info → ⚪`, `warning → 🟠`, `error → 🔴` | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/SkillHealth.test.tsx` | ❌ Wave 0 |
| HEALTH-03 | `parsePackageJsonForSentry(projectRoot)` returns signals for `@sentry/*` deps + `sentry-cli` script references | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/projectMetadataScan.test.ts` | ❌ Wave 0 |
| HEALTH-03 | `.sentryclirc` presence detected; `<root>/.spotlight/` directory presence detected | unit | same file | ❌ Wave 0 |
| HEALTH-03 | CI YAML grep finds `sentry-cli` references within `.github/workflows/*.yml` only (path-traversal rejection) | unit | same file | ❌ Wave 0 |
| HEALTH-03 | `<ObservabilityHealth />` panel renders "detected via @sentry/node + .sentryclirc" copy | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/ObservabilityHealth.test.tsx` | ❌ Wave 0 |
| HEALTH-04 | `parseInfisicalConfig(projectRoot)` returns `present-valid` / `present-invalid` / `absent` | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/projectMetadataScan.test.ts` | ❌ Wave 0 |
| HEALTH-04 | `<SecretsHealth />` renders 3 distinct UI states | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/SecretsHealth.test.tsx` | ❌ Wave 0 |
| HEALTH-05 | `computeIntegrationState({ envVarPresent, signalDetected })` returns correct state per truth table | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/integrationsState.test.ts` | ❌ Wave 0 |
| HEALTH-05 | `<IntegrationsHealth />` renders one-paragraph copy for each `not-detected` integration; install hint for `present-but-not-configured` | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/IntegrationsHealth.test.tsx` | ❌ Wave 0 |
| INV-03 | All 5 panels render gracefully when daemon returns empty/missing/error states (per D-5-15 + D-5-19 + D-4-14 patterns) | component | each panel test asserts the empty/error states above | ❌ Wave 0 |
| (Closes) DISC-01 | meta-observer SessionEnd hook reads `transcript_path`, extracts last `## Workflow commitment` block, atomically writes `.planning/skill-observations/{ISO}--{sessionId}.md` | unit | `pnpm --filter @agenticapps/dashboard-meta-observer test lib/extractCommitment.test.ts` | ❌ Wave 0 |
| (Closes) DISC-01 | meta-observer projectRoot resolver prefers `CLAUDE_PROJECT_DIR` env, falls back to CWD walk-up, returns null if neither finds `.planning/.claude` | unit | same package | ❌ Wave 0 |
| (Closes) DISC-01 | meta-observer atomic write (write-to-`.tmp` + rename) — no partial files visible to concurrent reader | unit (race test) | same package | ❌ Wave 0 |
| (Closes) D-5-10 | **Phase 5 closure gate**: install meta-observer in this repo, run a real `claude` session, verify `<CommitmentBlock />` populates with non-null markdown, capture screenshot | manual (HUMAN-UAT, scripted) | scripted: `node packages/meta-observer/test/end-to-end.mjs`; manual: SPA screenshot |  ❌ Wave 0 |
| Schema drift | Each new daemon route uses `outbound(c, Schema.parse, value)` — drifted payload returns 500 with parse error in dev / opaque 500 in prod | integration | each route test (e.g. `routes/skills.test.ts`) | ❌ Wave 0 |
| Path safety | `resolveAllowedNamed(<root>/../etc/passwd, ...)` rejects via realpath check | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/paths.test.ts` (extends existing) | ❌ Wave 0 |
| Path safety | `resolveAllowedNamed(<root>/.github/workflows/x.yml, ...)` accepts; `<root>/.github/no-workflows/x.yml` rejects | unit | same file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter <pkg> test path/to/just-edited.test.ts` (under 5s typical)
- **Per wave merge:** `pnpm -r test` (full suite — < 30s on this repo as of Phase 4 close)
- **Phase gate:** `pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm lint` all green; **plus** D-5-10 manual closure gate (real session run with screenshot in `05-HUMAN-UAT.md`)

### Wave 0 Gaps

- [ ] `packages/agent/src/lib/skillsScan.test.ts` — covers HEALTH-01
- [ ] `packages/agent/src/lib/projectMetadataScan.test.ts` — covers HEALTH-03 + HEALTH-04
- [ ] `packages/agent/src/lib/agentLinterRunner.test.ts` — covers HEALTH-02
- [ ] `packages/agent/src/lib/integrationsState.test.ts` — covers HEALTH-05
- [ ] `packages/agent/src/routes/skills.test.ts` — covers global + local skills routes
- [ ] `packages/agent/src/routes/agentlinter.test.ts` — covers caching + failure classes
- [ ] `packages/agent/src/routes/observability.test.ts` — covers signal detection wiring
- [ ] `packages/agent/src/routes/secrets.test.ts` — covers .infisical.json route
- [ ] `packages/agent/src/routes/integrations.test.ts` — covers three-state route
- [ ] `packages/spa/src/components/panels/InstalledSkills.test.tsx`
- [ ] `packages/spa/src/components/panels/SkillHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/ObservabilityHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/SecretsHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/IntegrationsHealth.test.tsx`
- [ ] `packages/shared/src/schemas/{skills,agentlinter,observability,secrets,integrations}.test.ts`
- [ ] `packages/meta-observer/test/projectRoot.test.ts`
- [ ] `packages/meta-observer/test/extractCommitment.test.ts`
- [ ] `packages/meta-observer/test/extractFirings.test.ts`
- [ ] `packages/meta-observer/test/atomicWrite.test.ts`
- [ ] `packages/meta-observer/test/end-to-end.mjs` — installs the skill in a fixture project, simulates a SessionEnd payload, verifies file written + parseable by phaseDetail.ts
- [ ] **Wave 0 transcript probe**: read one real `~/.claude/projects/.../<session>.jsonl` and document the actual JSONL line shape (assistant_message vs tool_use vs tool_result) so extractCommitment + extractFirings know what to look for. Output: a fixture file in `packages/meta-observer/test/__fixtures__/sample-transcript.jsonl`.
- [ ] **Wave 0 hook activation probe** (Open Question 2 above): install a skeleton meta-observer skill that just `echo`s "fired" to a tmp file; run a one-shot Claude session; verify the tmp file appears.
- [ ] Fixture utilities reused: `packages/agent/src/lib/__fixtures__/phase4-fixture.ts` already has `writeWorkflowSkillCanonical` + `writeMetaObserverSkillBundle` — Phase 5's tests reuse without duplicating.

## Security Domain

> Required: `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`. `/cso` is **mandatory** post-phase per CLAUDE.md.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture & Design | yes | Path allow-list extension (D-5-11/12/13) is the design control. Document the threat model in `05-SECURITY.md`: who can name what path? Answer: SPA names route names; daemon-side code names file paths. |
| V2 Authentication | yes (existing) | Bearer token already in place via Phase 1. All 7 new routes inherit `app.ts` middleware. No new auth. |
| V3 Session Management | no | Stateless API; bearer token IS the session. |
| V4 Access Control | yes | Path allow-list (Phase 1 D-23 + Phase 5 D-5-13). New routes do NOT extend the `/read` allow-list — each metadata signal gets a dedicated route with name-restricted resolveAllowed. |
| V5 Input Validation | yes | Zod schemas on every route response (`outbound()` helper). New schemas in `packages/shared/src/schemas/{skills,agentlinter,observability,secrets,integrations}.ts`. Subprocess args are passed as argv arrays (no shell), bypassing injection. |
| V6 Cryptography | no | No crypto in Phase 5. AgentLinter cache (if disk-backed) just JSON.stringify + 0600 permission — no encryption needed. |
| V7 Error Handling | yes | Existing `errorHandler` middleware (D-06 NODE_ENV-gated verbosity) covers new routes. AgentLinter failure-class discriminator (D-5-15) explicitly designs error UX. |
| V8 Data Protection | yes (privacy) | `--local` flag on AgentLinter — REQUIRED. Without it, the daemon ships CLAUDE.md content to the AgentLinter cloud service, breaking the "no cloud-side data storage" invariant. |
| V12 File Handling | yes | Realpath defence in `resolveAllowedNamed`. Extension allow-list for CI YAML reads. SecretsHealth never reads .env / actual secret content. |

### Known Threat Patterns for Phase 5 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in `package.json` / `.infisical.json` reads (e.g. registry forging a project root that escapes via `..`) | T (Tampering) | `resolveAllowedNamed` realpath check + name allow-list |
| Symlink escape from `.github/workflows/` to `/etc/` | T | realpath after `realpath()` resolves symlinks; existing pattern in `paths.ts` |
| Subprocess argument injection in AgentLinter spawn | T (command injection) | Pass `npx` argv as an array — never shell-string. `execa('npx', ['--yes', 'agentlinter', ...])` — no shell expansion. |
| Subprocess timeout DOS (AgentLinter hangs forever) | D (Denial of Service) | 30s `timeout` option in execa; failure-class `kind: 'timeout'` surface |
| AgentLinter remote network IO leaking CLAUDE.md content | I (Information Disclosure) | `--local` flag MANDATORY; tested |
| Reading `.env` files for `SENTRY_DSN` substring leaks secret content into daemon memory + cache | I | Match pattern only — extract presence, not value. Cache stores `{ signal: 'sentry-dsn-env' }`, never the DSN itself. |
| Cross-project leakage via TanStack Query cache key | I | All per-project queryKeys include `projectId` (verified pattern from Phase 4 projectQueries.ts). Global skills query has no projectId by design. |
| Meta-observer writes outside `<projectRoot>/.planning/` | T | atomicWrite tests assert path stays in `.planning/skill-observations/`. CWD walk-up returns null on no-marker; refuse silently per D-5-07. |
| Meta-observer reads transcript with malicious markdown injection | I | Output is markdown — render path uses React text children + escapeHtml-equivalent (Phase 4 already does this in HookFirings panel). |
| 0600 permissions on disk cache (if planner picks disk persistence) | T | Existing `lib/atomicWrite.ts` + Phase 1 D-INV-02 enforcement on registry/auth files — extend to cache.json. |

**`/cso` audit foci for Phase 5:**

1. **Path allow-list extension proof** — show that `resolveAllowedNamed` cannot resolve outside `opts.roots`, including realpath symlink escape, even with crafted basenames.
2. **AgentLinter `--local` enforcement** — test that the spawn argv contains `--local` regardless of cache state, regardless of failure path.
3. **CORS + bearer pass-through** — assert all 7 new routes return 401 without bearer, return CORS reject from non-allowed origin.
4. **No daemon write to project FS** — diff the daemon code; assert the only write paths target `~/.agenticapps/dashboard/` and (if disk cache picked) the cache file. The meta-observer's project FS writes happen in the user's session, NOT in the daemon process.
5. **Cache cross-projection** — verify `evictHealthCacheProject(id)` evicts ALL Phase 5 caches for that project on `/unregister`.
6. **No cloud-side network calls in Phase 5** — neither Sentry nor Linear nor Infisical APIs are called. AgentLinter has `--local`. Verify with subprocess test asserting on argv.

## Sources

### Primary (HIGH confidence)

- **Live tool execution: `npx --yes agentlinter --help`** (2026-05-07) — confirmed CLI surface, `--local`, `--json`, no `scan` subcommand. AgentLinter v0.3.3 from npm registry.
- **Live tool execution: `npx --yes agentlinter --local --json`** against `agenticapps-dashboard` (2026-05-07) — confirmed actual JSON shape (categories, diagnostics, severities `info|warning|error`).
- **`npm view agentlinter`** (2026-05-07) — confirmed version 0.3.3, MIT, no transitive deps, 70.5kB unpacked.
- **`npm view @sentry/node`** / **`@sentry/cli`** / **`@spotlightjs/spotlight`** / **`@spotlightjs/sidecar`** / **`zod`** / **`execa`** / **`hono`** (2026-05-07) — version verification.
- **code.claude.com/docs/en/hooks** (fetched 2026-05-07 via WebFetch) — Claude Code hook event catalogue, env vars (`CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR`), hook payload shape, settings.json structure, hook handler types, exit codes, language support.
- **code.claude.com/docs/en/skills** (fetched 2026-05-07 via WebFetch) — SKILL.md frontmatter reference (incl. `hooks:` field, `disable-model-invocation`, `paths`, `allowed-tools`), canonical layout, install/discovery semantics, hook scoping in skills.
- **infisical.com/docs/cli/project-config** (search-result extract, 2026-05-07) — `.infisical.json` schema (workspaceId required, defaultEnvironment optional, gitBranchToEnvironmentMapping optional).
- **docs.sentry.io/cli/configuration** (search-result extract, 2026-05-07) — `.sentryclirc` walk-up search behaviour, INI format, `~/.sentryclirc` global fallback.
- **`packages/agent/src/lib/phaseDetail.ts:129-137`** (Phase 4 prior art) — `findSkillPath()` dual-layout probe.
- **`packages/agent/src/lib/paths.ts`** — `resolveAllowed()` reference pattern.
- **`packages/agent/src/lib/__fixtures__/phase4-fixture.ts`** — `writeWorkflowSkillCanonical` + `writeMetaObserverSkillBundle` reusable fixture helpers.
- **`packages/agent/src/lib/phaseCache.ts`** — generalisable per-route cache pattern.
- **`packages/shared/src/schemas/observations.ts`** — existing `HookFiringSchema` (passthrough Zod object).

### Secondary (MEDIUM confidence)

- **npmjs.com/package/@spotlightjs/spotlight** (search-result extract, 2026-05-07) — package family, install command, current version 4.10.0.
- **linear.app/docs/api-and-webhooks** + **@linear/sdk README** (search-result extract, 2026-05-07) — `LINEAR_API_KEY` env var canonical name, SDK version 83.0.0.
- **linear.app/docs/github-integration** (search-result extract, 2026-05-07) — branch name pattern `[A-Z]{2,}-\d+` is the project marker convention.
- **AgenticApps spec** `docs/spec/dashboard-prompt.md` — binding source for panel definitions (lines 496–504), API surface (lines 320–352), optional integrations contract (lines 506–544), constraints (lines 686–712), implementation phasing Phase 5 (lines 638–641). Spec wording for `npx agentlinter scan` and "Position Risk warnings" reinterpreted in this research.

### Tertiary (LOW confidence — flagged for validation)

- **Skill-scoped SessionEnd hook activation when skill is dormant** — docs say "scoped to component lifetime" but it's unclear whether a never-invoked skill's SessionEnd hook fires. **Wave 0 must live-test.**
- **AgentLinter "Position Risk" terminology** — appears nowhere in the actual CLI output. Recommend renaming to "AgentLinter findings" in the panel UX, OR mapping to clarity+consistency category subset.

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — every package version verified against npm registry 2026-05-07.
- Architecture (panel routes, allow-list extension): HIGH — extends well-tested Phase 4 patterns.
- AgentLinter integration: HIGH — live tool run captured actual JSON shape and CLI flags.
- Meta-observer SessionEnd hook contract: HIGH for hook payload + env vars; MEDIUM for skill-scoped hook activation (Open Question 2).
- Detection vocabulary (Sentry/Spotlight/Linear/Infisical): MEDIUM — package-family naming verified but specific signal precision (e.g. exact regex for `@sentry/*`) needs Wave 0 fixture coverage.
- "Position Risk" mapping: LOW — name doesn't appear in tool output; needs planner / discuss-phase confirmation (Assumption A1).
- Meta-observer transcript shape: LOW — needs Wave 0 sample read of real transcript (Assumption A3).

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days for stable infra; 7 days for AgentLinter / Claude Code skills which are fast-moving — re-verify before final close per D-5-10 dogfood gate)

---

*Phase: 05-skills-health-panels*
*Researcher: gsd-researcher (claude-opus-4-7-1m)*
