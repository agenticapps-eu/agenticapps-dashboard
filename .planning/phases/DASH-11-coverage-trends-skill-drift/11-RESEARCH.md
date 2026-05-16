# Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle — Research

**Researched:** 2026-05-16
**Domain:** Local-only daemon snapshot persistence (NDJSON + in-process scheduler) + cross-repo skill aggregation + SPA matrix polish
**Confidence:** HIGH on existing-code surfaces (all reusables verified in-tree), MEDIUM on cron mechanism (Phase 6's launchd plist is a KeepAlive daemon, not a cron — D-11-02 needs reinterpretation), HIGH on schema + route patterns (Phase 10 templates directly applicable)

## Summary

Phase 11 closes v1.1 by adding the **drift-over-time** half to the dashboard's observability story. The work splits cleanly into three sub-tracks with very different risk profiles:

1. **Coverage trends** — adds the *first* daemon write path beyond `registry.json` / `auth.json` (`~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`). The scope is small but `/cso` will audit this carefully because INV-02 (mode `0600` enforcement) was previously enforced only on two singletons; Phase 11 generalises the policy to a new directory. The biggest discovered risk is that **Phase 6's launchd install is a `KeepAlive=true` long-running daemon, not a cron** — D-11-02's "extend the existing plist with `StartCalendarInterval`" is not a clean fit. The correct path is an **in-process daily scheduler** inside the running daemon (a single `setTimeout` chain anchored to midnight local time), which preserves the existing service model and adds no new OS-level integration.

2. **Skill drift** — pure aggregation work over existing Phase 5 primitives. `skillsScan.ts` (`readLocalSkills`) and `agentLinterRunner.ts` / `agentLinterCache.ts` all exist as named in CONTEXT and can be wrapped without modification. One discovery: **the registry does not carry family metadata** (`client: null`, `tags: []` for every entry on the live machine). Family derivation must reuse Phase 10's path-prefix logic from `repoDiscovery.ts` — match `root` against `~/Sourcecode/{agenticapps,factiv,neuroflash}/<repo>`, fall back to a `"unknown"` bucket for off-family registrations. This is the same logic Phase 10 already implements; we extend it to registry entries instead of family-walk discoveries.

3. **Phase 10.6 polish bundle** — two tiny one-file changes. Both verified in source: `CoverageRow.tsx:120` starts with literal `opacity-0`, and `PageHeader.tsx:22` has no sticky support today. `AppShellV2.tsx:49` confirms `<main>` is the scroll container (`overflow-y-auto`), so `position: sticky; top: 0` on `PageHeader`'s outer div will pin it to the top of `<main>` correctly — no wrapper or scroll-container hoist needed.

**Primary recommendation:** Use a **daemon in-process scheduler** for the daily snapshot trigger (not `StartCalendarInterval` on launchd), use an **append-only `fs.appendFile` writer with `{ flag: 'a', mode: 0o600 }`** for snapshot persistence (one line per repo per day), expose **two sibling routes** (`GET /api/coverage/history` cell-scoped + `POST /api/skills/drift/agentlinter` single-project-scoped), and treat the matrix endpoint payload server-side (return `{ direction, daysSince }`) to keep the SPA dumb.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coverage trends (Candidate A):**
- **D-11-01:** Snapshot retention window — **14 days** (rolling). NDJSON-append plus a daily pruner that drops lines older than 14 days.
- **D-11-02:** Snapshot trigger — **daily cron only** via the existing Phase 6 launchd / systemd install. One snapshot per ISO date; no opportunistic on-load writes. (See research below: Phase 6's install is a `KeepAlive=true` long-running daemon, not a cron — the "via Phase 6 install" wording requires reinterpretation.)
- **D-11-03:** Drift surface — **inline indicator only** (▲Nd / ▼Nd). Component name MUST avoid `InlineDrift.tsx` (Phase 6 schema-drift panel). Use `CoverageDriftBadge` or similar.

**Skill drift (Candidate B):**
- **D-11-04:** Aggregation level — **per-skill matrix** primary view (rows = skills, columns = projects).
- **D-11-05:** AgentLinter integration depth — **on-demand AgentLinter run per project from the matrix**. Reuses Phase 5 `agentLinterRunner.ts` + `agentLinterCache.ts`. New invocation context, not new spawn surface.
- **D-11-06:** Cross-family vs in-family — **both, per-family default with cross-family via filter chip**. Reuses Phase 10 `CoverageToolbar` pattern (200ms debounce + URL sync).

**Scope + IA:**
- **D-11-07:** Family-aggregate Coverage trends — **deferred to v1.2**.
- **D-11-08:** Sidebar IA — **2 entries under `Observability`: `Coverage`, `Skill drift`**.

**Polish bundle:**
- **D-11-09:** Sticky `PageHeader` primitive — add `sticky?: boolean` prop, default `false`.
- **D-11-10:** Coverage row-refresh icon opacity — `opacity-0` → `opacity-30` default, hover/focus still bumps to `opacity-100`.

**Wire schema strategy:**
- **D-11-11:** **Sibling endpoint** for history (`GET /api/coverage/history`), NOT a field on `CoverageResponseSchema`.
- **D-11-12:** **New shared schema files** `packages/shared/src/schemas/coverageHistory.ts` + `packages/shared/src/schemas/skillDrift.ts`; barrel re-export from `packages/shared/src/index.ts`.

**Trust-boundary deltas (for `/cso`):**
- **D-11-13:** New **daemon write path** — `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` (mode `0600`, append-only by writer, pruner drops files older than 14d).
- **D-11-14:** **Widened AgentLinter spawn surface** — new call-site at cross-repo Skill drift route. Same binary, same args, same cache. Must not escape per-project root constraint and must not run >1 project's lint per request.

### Claude's Discretion

- **Component naming** for the inline drift surface (`CoverageDriftBadge` / `DriftIndicator` / `TrendBadge` — Claude picks at plan time; NOT `InlineDrift`).
- **NDJSON record shape** internal to `coverage-history/*.ndjson` files (record per row per day vs record per cell per day). Wire shape locked by `CoverageHistorySchema` regardless.
- **Cron implementation detail** — extend existing Phase 6 launchd plist with a `StartCalendarInterval` entry, or wire a separate timer; planner decides based on what tests cleanest.

### Deferred Ideas (OUT OF SCOPE)

**v1.2 candidates surfaced by Phase 11 scope-trimming:**
- Family-aggregate Coverage trends (per-family 3-up or fleet-level line chart on the Coverage page) — D-11-07. Better home: Phase 12's `/observability/trend` route.
- 12-tick mini-sparkline on `CoverageCell` — alternative to D-11-03; revisit if v1.1 user feedback shows the inline indicator misses magnitude/trend signal.
- Hover-only progressive disclosure for drift — rejected for touch-device incompatibility.
- Per-project Skill drift matrix view (rows = projects, columns = skills) — D-11-04 chose per-skill; per-project remains accessible via Phase 5 single-project Skills panel.

**Phase 10.6 polish backlog (not folded into Phase 11):**
- 3 remaining P3 items in `10-IMPECCABLE.md` "Additional follow-up" — stay in the polish backlog for a future bundle phase (likely Phase 13+).

## Phase Requirements

The planner will mint final REQ-IDs during `/gsd-plan-phase`. Working stems and proposed mappings (from ROADMAP §"Phase 11: ..."):

| Proposed ID | Description | Research Support |
|----|-------------|------------------|
| TRD-01 | Daemon writes daily NDJSON snapshot to `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` (mode 0600) | Reuses Phase 10 `scanCoverageInternal`; new `snapshotWriter.ts`; D-11-13 audited write path |
| TRD-02 | Snapshot pruner drops files older than 14 days; runs before each write | Lazy or per-tick — see §"Snapshot pruner trigger" below |
| TRD-03 | `GET /api/coverage/history?repoId=&cell=` returns drift summary for a single (repo, cell) coordinate | New schema `CoverageHistorySchema` (sibling to `coverage.ts`); 1h cache TTL |
| TRD-04 | Daily snapshot trigger fires once per ISO date while daemon is running | In-process scheduler (anchored to midnight local time); reinterprets D-11-02 — see §"Cron mechanism" |
| TRD-05 | `CoverageCell.tsx` renders `▲Nd` / `▼Nd` inline indicator when state transition occurred within rolling window | New `CoverageDriftBadge.tsx`; text-only, uses `text-status-success` / `text-status-error` tokens |
| SKD-01 | Daemon aggregator iterates registered projects, calls `readLocalSkills` per project, produces per-skill rows | New `skillDriftScan.ts`; wraps Phase 5 `skillsScan.ts`; `Promise.allSettled` partial-failure isolation |
| SKD-02 | `GET /api/skills/drift` returns aggregated matrix; cached 30s daemon-side (matches Phase 10 cadence) | New schema `SkillDriftSchema`; mirrors Phase 10 cache pattern |
| SKD-03 | `POST /api/skills/drift/agentlinter` runs AgentLinter for ONE project, returns result; bearer-auth + body validation | Reuses `runAgentLinter` + `agentLinterCache`; D-11-14 audited spawn-context widening |
| SKD-04 | New SPA route `/observability/skill-drift` renders per-skill matrix; cross-family filter chip toggles family scope | New `SkillDriftPage.tsx`; reuses `CoverageToolbar` chip pattern (200ms debounce, URL sync) |
| SKD-05 | Sidebar `Observability` section graduates from 1 entry to 2 (`Coverage`, `Skill drift`) | One-line addition to `Sidebar.tsx`; uses existing `SidebarItem` primitive (NOT `SidebarSubItem`) |
| PLI-01 | `PageHeader` gains `sticky?: boolean` prop (default `false`); when `true`, header sticks to top of `<main>` scroll container | Single-file change; `<main>` already has `overflow-y-auto` in `AppShellV2` |
| PLI-02 | `CoverageRow` per-row refresh button: `opacity-0` → `opacity-30` default; hover/focus still bumps to `opacity-100` | One-token swap on `CoverageRow.tsx:120` |
| PLI-03 | `/coverage` opts into sticky `PageHeader` (sets `sticky` prop to `true`) | Phase 11 Coverage opts in immediately; other routes adopt during their own cycles |
| INV-01..INV-05 | All architectural invariants remain enforced; new write path stays within `~/.agenticapps/dashboard/` (INV-02 generalised); read-only-on-projects (INV-01) preserved; schema parsed at both ends (INV-04); no native deps added (INV-05) | See §"Project Constraints" below |

## Project Constraints (from CLAUDE.md)

These are non-negotiable directives. Any plan or task that violates one of these surfaces as an error.

- **Read-only on project filesystems.** No daemon route writes to a registered project's files. Sole exception: `POST /api/projects/{id}/open`. *Phase 11 impact:* all new writes confined to `~/.agenticapps/dashboard/coverage-history/`; nothing writes to a project root.
- **Path allow-list per project.** `/api/projects/{id}/read` only resolves under `<root>/.planning` or `<root>/.claude`. *Phase 11 impact:* the new history + skill-drift routes do NOT use `/api/projects/{id}/read` — they live under `/api/coverage/history` and `/api/skills/drift` and scan via daemon-internal scanners (same pattern as Phase 10's `/api/coverage`).
- **Daemon writes confined to `~/.agenticapps/dashboard/`.** Registry, auth, env files are mode `0600`; daemon refuses to start if permissions are looser. *Phase 11 impact:* `coverage-history/` directory creation must use `mode: 0o700`; each NDJSON file written with `mode: 0o600`. INV-02 generalises from "files" to "directory tree."
- **No native dependencies in `packages/agent/`.** *Phase 11 impact:* no cron daemon (`node-cron` is fine, pure JS — but recommend avoiding it; use plain `setTimeout` chain). No file-watcher libs. Scheduler is pure Node 20+ built-ins.
- **Bearer-token auth on every route.** CORS locked to `https://dashboard.agenticapps.eu` (prod) and `http://localhost:5174` (dev). *Phase 11 impact:* both new routes inherit `bearerAuth` + `cors` middleware from `server/app.ts` chain — no per-route auth code needed.
- **Optional integrations stay optional.** *Phase 11 impact:* if a project is unreachable (`existsSync(root) === false`), the skill-drift aggregator returns a `degraded` row for that project, never a 500.
- **No Cloudflare Workers / Pages Functions in v1.** *Phase 11 impact:* drift indicator computation happens either daemon-side (recommended — see §"Coverage history endpoint" below) or in the SPA `CoverageCell` render path. No third party.
- **Every frontend-touching phase commits an `<N>-IMPECCABLE.md` artifact.** Composite floor ≥ 87 (provisional per D-10.5-03). *Phase 11 impact:* Phase 11 IS calibration data point #2. Affected routes: `/coverage` (with new drift badge + sticky header + opacity polish) AND new `/observability/skill-drift` route. Two route critiques required.

## Standard Stack

### Core (all already in tree — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | ≥ 20.0.0 | Runtime for daemon; built-in `fs`, `fs/promises`, `os`, `path`, `crypto`, `setTimeout` | Lock file in `engines` field; no native deps allowed (INV-05) |
| Zod | (existing — same as Phase 10) | Schema validation at both ends; new `CoverageHistorySchema` + `SkillDriftSchema` files | Single source of truth invariant (INV-04); `parseOrDrift` discipline preserved |
| Hono | (existing) | Two new routes mount via `app.route()` in `server/app.ts` | Bearer-auth + CORS inherited from middleware chain — no per-route auth code |
| TanStack React Router | (existing) | New `/observability/skill-drift` route under `_appshell` layout | Mirrors Phase 10 `/coverage` lazy + zodValidator pattern |
| TanStack Query | (existing) | New hooks `useCoverageHistory(repoId, cell)` + `useSkillDrift({ scope })` | Query keys include scope params for cache safety (Phase 5 precedent) |
| Tailwind 4 (`@theme`) | (existing) | New badge uses existing `text-status-success` / `text-status-error` tokens from `tokens.css` | NO new hex literals; `tokenSourceOfTruth.test.ts` would fail otherwise |
| Vitest | (existing) | Test framework; `environment: 'node'` for agent tests, `jsdom` for SPA component tests | Used Phase 0 onwards |
| execa | (existing) | Subprocess spawn for AgentLinter; reused by D-11-14 | Already passes `--local` + argv-array spawn (no shell) |

**No new packages.** [VERIFIED: `package.json` review — all primitives in tree]

### Supporting (Node built-ins to use directly)

| Module | Function | Purpose | Notes |
|---------|---------|---------|-------|
| `node:fs/promises` | `appendFile(path, data, { flag: 'a', mode: 0o600, encoding: 'utf8' })` | Append one NDJSON record per scheduler tick | `flag: 'a'` + `mode: 0o600` semantics — see §"NDJSON append semantics" |
| `node:fs` | `mkdirSync(dir, { recursive: true, mode: 0o700 })` | Create `coverage-history/` on first write; matches launchd logDir pattern (Phase 6) | Mode `0o700` keeps other local users out (Phase 6 D-6-06 precedent) |
| `node:fs` | `readdirSync(coverageHistoryDir).filter(...)` + `unlinkSync(staleFile)` | 14-day rolling prune | Run before each write (lazy) — see §"Pruner trigger" |
| `node:fs/promises` | `readFile(path, 'utf8')` then split on `\n` | Read NDJSON for history endpoint | Streaming overkill at ~14 files × 45 lines |
| `node:path` | `join(homedir(), '.agenticapps', 'dashboard', 'coverage-history')` | Resolve snapshot root | Mirrors existing daemon-internal pattern; do NOT use `os.tmpdir()` |
| `node:timers` (global) | `setTimeout(tick, msUntilNextMidnight)` then re-arm | In-process daily scheduler | NO `setInterval` — see §"Cron mechanism" |
| `node:fs` | `realpathSync(homeDir)` once at boot | Resolve `~/.agenticapps/dashboard/coverage-history/` for symlink-escape defence | Same defence used by `coverageResolver.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Recommendation |
|------------|-----------|----------|----------------|
| In-process scheduler | OS-level cron (`StartCalendarInterval` in launchd, `OnCalendar=` in systemd timer) | OS-level fires even when daemon is down → but daemon writing while NOT running requires a separate process invocation which contradicts the current install model (`KeepAlive=true`); also doubles the install surface | **In-process** — matches existing service model, no new OS integration, gap when daemon is down is acceptable per D-11-02 |
| `fs.appendFile` | `fs.createWriteStream({ flags: 'a' })` | Stream is faster for many writes; once-per-day is one write → no benefit | `appendFile` |
| One-record-per-row-per-day | One-record-per-cell-per-day | Cell-per-day is 4× more records (45 × 4 × 14 = 2520 lines vs 45 × 14 = 630) but per-cell drift lookup is O(N) cheaper because no row JSON parse needed for unrelated cells | **One-record-per-row-per-day** — see §"NDJSON record shape" below |
| Server-side drift computation | Client-side computation on raw transitions array | Server-side keeps wire schema flat (`{ direction, daysSince }`); client-side needs richer transitions array | **Server-side** — D-11-11 already chose sibling endpoint; symmetric to keep the payload minimal |
| Background AgentLinter for all projects | On-demand per-project | All-projects burns CPU + crosses trust boundary N times per scan; on-demand respects D-11-14 (one project per request) | **On-demand** — already locked by D-11-05 |
| `SidebarSubItem` for Skill drift | `SidebarItem` (same level as Coverage) | `SidebarSubItem` indents 16px more (intended for project sub-list under Projects); using it here misaligns Skill drift visually with Coverage | **`SidebarItem`** — CONTEXT mentions `SidebarSubItem` but pattern review (Sidebar.tsx:69-73) shows Coverage uses `SidebarItem`. Use `SidebarItem` for the new entry. |

**Installation:** No installation step — Phase 11 adds zero new npm dependencies.

**Version verification:** All version pins inherited from Phase 10. No new packages → no version drift surface.

## Architecture Patterns

### Recommended Project Structure

```
packages/shared/src/
├── schemas/
│   ├── coverage.ts             # EXISTING — untouched (D-11-12)
│   ├── coverageHistory.ts      # NEW — CoverageHistorySchema sibling [TRD-03]
│   └── skillDrift.ts           # NEW — SkillDriftSchema sibling [SKD-02]
└── index.ts                    # EXTEND — barrel-export new schemas

packages/agent/src/
├── lib/
│   ├── snapshots/              # NEW DIR (CONTEXT calls for it)
│   │   ├── snapshotWriter.ts   # NEW — fs.appendFile + mode 0o600 + dir creation
│   │   ├── snapshotWriter.test.ts
│   │   ├── snapshotPruner.ts   # NEW — 14d cutoff, unlink stale files
│   │   ├── snapshotPruner.test.ts
│   │   ├── snapshotReader.ts   # NEW — parse NDJSON, return transitions for (repoId, cell)
│   │   ├── snapshotReader.test.ts
│   │   ├── snapshotScheduler.ts # NEW — in-process daily tick (setTimeout chain)
│   │   └── snapshotScheduler.test.ts
│   ├── skillDriftScan.ts       # NEW — wraps skillsScan per registered project
│   ├── skillDriftScan.test.ts
│   ├── skillDriftCache.ts      # NEW — 30s memo (matches Phase 10 coverageCache.ts shape)
│   └── skillDriftCache.test.ts
├── routes/
│   ├── coverageHistory.ts      # NEW — GET /api/coverage/history?repoId=&cell=
│   ├── coverageHistory.test.ts
│   ├── skillDrift.ts           # NEW — GET /api/skills/drift, POST /api/skills/drift/agentlinter
│   └── skillDrift.test.ts
└── server/app.ts               # EXTEND — register new routes (2 app.route calls)

packages/spa/src/
├── components/
│   ├── panels/coverage/
│   │   ├── CoverageCell.tsx        # EXTEND — accept optional `drift` prop [TRD-05]
│   │   ├── CoverageDriftBadge.tsx  # NEW — text-only ▲Nd / ▼Nd indicator
│   │   ├── CoverageDriftBadge.test.tsx
│   │   ├── CoverageRow.tsx         # EXTEND — opacity polish [PLI-02]
│   │   └── CoverageToolbar.tsx     # UNCHANGED — pattern reused by SkillDriftToolbar
│   ├── panels/skill-drift/         # NEW DIR
│   │   ├── SkillDriftMatrix.tsx    # NEW — rows × cols rendering
│   │   ├── SkillDriftMatrix.test.tsx
│   │   ├── SkillDriftToolbar.tsx   # NEW — per-family/cross-family chip + URL sync
│   │   ├── SkillDriftToolbar.test.tsx
│   │   └── SkillDriftCell.tsx      # NEW — per-(skill, project) cell (presence + version)
│   ├── panels/InlineDrift.tsx      # EXISTING — UNCHANGED (schema-drift panel; name collision warning)
│   └── ui/
│       ├── PageHeader.tsx          # EXTEND — sticky?: boolean prop [PLI-01]
│       ├── Sidebar.tsx             # EXTEND — add Skill drift SidebarItem [SKD-05]
│       └── PageHeader.test.tsx
├── routes/
│   ├── coverage.lazy.tsx           # EXTEND — opt into sticky=true PageHeader [PLI-03]
│   └── observability.skill-drift.lazy.tsx  # NEW — lazy route
├── router.tsx                      # EXTEND — register new lazy route under _appshell
├── lib/
│   ├── useCoverageHistory.ts       # NEW — TanStack Query hook (1h staleTime)
│   └── useSkillDrift.ts            # NEW — TanStack Query hook (30s staleTime; matches Phase 10 cadence)
```

[VERIFIED: tree paths match existing repo layout. `packages/agent/src/lib/scanners/` does NOT exist as a directory — all Phase 10 scanners actually live flat in `packages/agent/src/lib/` (e.g., `coverageScan.ts`, `repoDiscovery.ts`). CONTEXT incorrectly references `lib/scanners/`. Phase 11's snapshot files create a new subdirectory `lib/snapshots/` which is consistent with the CONTEXT's stated intent.]

### Pattern 1: NDJSON snapshot writer (append-only, mode 0o600)

**What:** Each scheduler tick reads the latest `scanCoverageInternal()` output and appends one NDJSON line per row to `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`.

**When to use:** Daily cron tick + (test only) explicit invocation.

**Example:**
```typescript
// Source: synthesized from Phase 10 atomicWrite.ts + Node 20 fs/promises docs
// packages/agent/src/lib/snapshots/snapshotWriter.ts
import { appendFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { scanCoverageInternal } from '../coverageScan.js'
import { pruneSnapshotsOlderThan } from './snapshotPruner.js'
import { resolveSnapshotDir } from './snapshotPaths.js'

const RETENTION_DAYS = 14

export interface SnapshotRecord {
  ts: string         // ISO timestamp at write
  family: string
  repo: string
  claudeMd: string   // CoverageState ('fresh' | 'stale' | 'missing' | 'not-applicable')
  gitNexus: string
  wiki: string
  workflowVersion: string
}

export async function writeDailySnapshot(opts?: { now?: Date }): Promise<{ written: number; path: string }> {
  const now = opts?.now ?? new Date()
  const isoDate = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const dir = resolveSnapshotDir()

  // Lazy directory creation. mode 0o700 matches Phase 6 logDir pattern (D-6-06).
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode: 0o700 })
  }

  // D-11-01: prune before write. Cheap (≤ 14 file stats), serialized with the write,
  // and ensures the directory shrinks as days roll off the back of the window.
  pruneSnapshotsOlderThan(dir, RETENTION_DAYS, now)

  const { response } = await scanCoverageInternal()
  const path = join(dir, `${isoDate}.ndjson`)

  // Build all lines in memory, single appendFile call. Records are < 200 bytes each;
  // 45 repos × 200 bytes = 9 KB total — well under the 4096-byte pipe atomicity boundary
  // is NOT relevant here because we're appending to a regular file with a single call.
  // appendFile with flag: 'a' + mode: 0o600:
  //   - flag: 'a' opens with O_APPEND so concurrent writers cannot interleave fragments
  //     mid-line (POSIX guarantees a single write(2) ≤ PIPE_BUF is atomic on regular
  //     files; Node's appendFile issues a single write for buffers ≤ ~64KB on Linux/macOS)
  //   - mode: 0o600 applies ONLY to file CREATION; subsequent appends do not re-chmod.
  //     The test must explicitly fs.chmod after first creation to assert mode-on-disk.
  const lines = response.rows.map((row): SnapshotRecord => ({
    ts: now.toISOString(),
    family: row.family,
    repo: row.repo,
    claudeMd: row.claudeMd.state,
    gitNexus: row.gitNexus.state,
    wiki: row.wiki.state,
    workflowVersion: row.workflowVersion.state,
  }))

  const body = lines.map((r) => JSON.stringify(r)).join('\n') + '\n'
  await appendFile(path, body, { flag: 'a', mode: 0o600, encoding: 'utf8' })

  return { written: lines.length, path }
}
```

[CITED: Node 20 fs/promises docs — `appendFile` accepts `flag` + `mode` in options. `mode: 0o600` applies only when the file is created (per POSIX `open(2)` semantics); subsequent appends to an existing file do NOT re-chmod. The snapshot writer relies on the file being created on first call of the day with `0o600`; same-day re-invocation appends without touching mode.]

### Pattern 2: Daily in-process scheduler (setTimeout chain, NOT setInterval)

**What:** A single `setTimeout` armed at boot for `msUntilNextMidnight`, the callback writes one snapshot then re-arms itself for exactly 24 hours later.

**When to use:** Daemon start path (`packages/agent/src/cli/start.ts` or wherever the Hono server boots) — fire-and-forget.

**Example:**
```typescript
// Source: synthesized from Node 20 timers docs + project pattern (no setInterval in existing daemon code)
// packages/agent/src/lib/snapshots/snapshotScheduler.ts

import { writeDailySnapshot } from './snapshotWriter.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

let activeTimer: NodeJS.Timeout | null = null

export function startSnapshotScheduler(opts?: { now?: () => Date }): () => void {
  const now = opts?.now ?? (() => new Date())

  function scheduleNext(): void {
    const current = now()
    const tomorrow = new Date(current)
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    // 3:00 AM local — avoid midnight DST edge AND avoid colliding with any cron-style
    // user backups that run at 00:00. Off-peak; daemon almost certainly idle.
    tomorrow.setHours(3, 0, 0, 0)

    const msUntil = tomorrow.getTime() - current.getTime()
    activeTimer = setTimeout(() => {
      writeDailySnapshot()
        .catch((err) => {
          // Never throw out of the timer — the daemon must keep running.
          console.error('[snapshotScheduler] writeDailySnapshot failed:', err)
        })
        .finally(() => scheduleNext())
    }, msUntil)

    // Unref so the scheduler does NOT keep the event loop alive when the daemon
    // is shutting down (matches Phase 1 pidfile cleanup pattern).
    activeTimer.unref()
  }

  scheduleNext()

  // Return disposer for graceful shutdown + test isolation.
  return () => {
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
  }
}
```

[VERIFIED: existing daemon code uses `setTimeout` (search results show only one `setTimeout` use in `boot.ts:90` for shutdown grace) and has NO `setInterval` or `setImmediate` schedulers. The pattern is greenfield for Phase 11 — recommend the `setTimeout`-chain idiom because (a) it tolerates DST shifts (re-anchors each tick from `new Date()` instead of accumulating drift), (b) it allows `unref()` for clean shutdown, and (c) it's testable by injecting a `now()` fn + `vi.useFakeTimers()`.]

**Critical caveat re: D-11-02:** Phase 6's installed launchd plist (verified at `packages/agent/src/cli/installLaunchd.ts:46`) sets `KeepAlive=true` + `RunAtLoad=false` — this is a long-running daemon, NOT a cron entry. **Adding a `StartCalendarInterval` to that plist would not "extend" the existing entry — it would either (a) make launchd attempt to spawn a NEW daemon process at that calendar time (which `KeepAlive=true` would also keep alive, producing duplicate daemons) or (b) be ignored because `KeepAlive=true` overrides interval semantics.** The clean fix is in-process scheduling inside the already-running daemon; the cron "trigger" lives in JS, not in launchd/systemd. CONTEXT D-11-02 says "via the existing Phase 6 launchd / systemd install" — the in-process scheduler satisfies that intent (the daemon is the process launchd runs; the scheduler runs inside it) without modifying the plist or service unit. Recommend the planner adopt this framing explicitly and flag the reinterpretation in PLAN-DECISIONS.

### Pattern 3: Sibling history route (cell-scoped, server-side drift computation)

**What:** `GET /api/coverage/history?repoId={id}&cell={claudeMd|gitNexus|wiki|workflowVersion}` returns a compact `CoverageHistoryResponse` containing the most-recent positive/negative transition within the 14d window.

**When to use:** SPA fetches lazily, per cell that needs a drift indicator. Cache 1h daemon-side (history only changes once per day at most, per D-11-02 daily-tick).

**Example:**
```typescript
// Source: synthesized from packages/agent/src/routes/coverage.ts (sibling pattern)
// packages/agent/src/routes/coverageHistory.ts

import { Hono } from 'hono'
import { z } from 'zod'

import { CoverageHistoryResponseSchema } from '@agenticapps/dashboard-shared'
import { readDriftForCell } from '../lib/snapshots/snapshotReader.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const coverageHistoryRoute = new Hono<Env>()

const QuerySchema = z.object({
  repoId: z.string().regex(/^[a-z0-9\-]+\/[a-z0-9\-_]+$/), // "family/repo" — see Schema §
  cell: z.enum(['claudeMd', 'gitNexus', 'wiki', 'workflowVersion']),
})

coverageHistoryRoute.get('/coverage/history', async (c) => {
  // 1. Validate query (rejects path traversal, off-enum cells, malformed repoId).
  const parsed = QuerySchema.safeParse({
    repoId: c.req.query('repoId'),
    cell: c.req.query('cell'),
  })
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid_query' }, 400)
  }

  // 2. Daemon-internal read — NDJSON parse, transition extraction.
  //    Server-side computation keeps wire schema flat.
  const drift = await readDriftForCell(parsed.data.repoId, parsed.data.cell)
  // drift: { direction: 'up' | 'down' | null; daysSince: number | null }

  // 3. Outbound schema parse — INV-04 ("schema drift" warnings).
  return outbound(c, CoverageHistoryResponseSchema.parse.bind(CoverageHistoryResponseSchema), drift)
})
```

**Cache strategy:**
- 1h daemon-side memo (`coverageHistoryCache.ts` — separate file from `coverageCache.ts` because TTL + invalidation rules differ).
- Cache key: `${repoId}:${cell}` — multi-cell support without cross-key invalidation.
- Invalidated implicitly by the daily writer (next tick = new `<ISO-date>.ndjson` file = next cell query sees fresh data after TTL).
- 1h TTL is comfortably below the ≥24h "next snapshot arrives" cycle so users always see latest data within 1h of the daily tick (still 23h faster than the day-resolution data demands).
- SPA staleTime mirrors 1h (TanStack Query default to keep history out of the 5s polling that drives `/coverage`).

### Pattern 4: Cross-family Skill drift aggregator (Promise.allSettled + family derivation)

**What:** Iterate registered projects, derive family from `root` path, run `readLocalSkills` per project, fold into a per-skill matrix.

**Example:**
```typescript
// Source: synthesized from packages/agent/src/lib/coverageScan.ts (Promise.allSettled pattern + family discovery)
// packages/agent/src/lib/skillDriftScan.ts

import { homedir } from 'node:os'
import { join, sep } from 'node:path'

import { readRegistry } from './registry.js'
import { readLocalSkills } from './skillsScan.js'
import type { SkillDriftResponse } from '@agenticapps/dashboard-shared'

const FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
type Family = typeof FAMILIES[number] | 'other'

function deriveFamily(root: string): Family {
  const sourcecode = join(homedir(), 'Sourcecode')
  if (!root.startsWith(sourcecode + sep)) return 'other'
  const rel = root.slice(sourcecode.length + 1).split(sep)
  const head = rel[0]
  return FAMILIES.includes(head as Family) ? (head as Family) : 'other'
}

export async function scanSkillDrift(): Promise<SkillDriftResponse> {
  const reg = readRegistry()

  // Phase 10 precedent: Promise.allSettled — one project's failure does not poison
  // the whole response. AGREED-2 from Phase 10 codifies this; reuse it here.
  const perProject = await Promise.allSettled(
    reg.projects.map(async (p) => ({
      projectId: p.id,
      projectName: p.name,
      family: deriveFamily(p.root),
      skills: await readLocalSkills(p.root),
    })),
  )

  // Fold per-skill rows — same {skillId × {projectId → version}} matrix shape used in Phase 5 SPA.
  // ...
  return { schemaVersion: 1, generatedAtIso: new Date().toISOString(), /* ... */ } as SkillDriftResponse
}
```

[VERIFIED: `readLocalSkills` exists at `packages/agent/src/lib/skillsScan.ts:133`. `readRegistry` exists at `packages/agent/src/lib/registry.ts:174`. Family derivation logic is greenfield but mirrors `repoDiscovery.ts:50` (which walks `~/Sourcecode/{family}/` directly). Confirmed via live registry inspection that `client` is null for every project on this machine, so family must come from path, not from registry metadata.]

### Pattern 5: On-demand AgentLinter route (single-project, per-D-11-14)

**What:** `POST /api/skills/drift/agentlinter` accepts `{ projectId }` body, validates that the project is registered, runs AgentLinter for that ONE project only.

**Example:**
```typescript
// Source: synthesized from packages/agent/src/routes/agentlinter.ts (existing pattern)
// packages/agent/src/routes/skillDrift.ts (excerpt)

const AgentLinterDriftRequestSchema = z.object({
  projectId: z.string().min(1),
})

skillDriftRoute.post('/skills/drift/agentlinter', async (c) => {
  // Body validation
  let body: { projectId: string }
  try {
    body = AgentLinterDriftRequestSchema.parse(await c.req.json())
  } catch {
    return c.json({ ok: false, error: 'invalid_request_body' }, 400)
  }

  // Registry lookup — fails closed (404) when project unknown.
  // This is the per-project root constraint enforcement D-11-14 requires.
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === body.projectId)
  if (!entry) return c.json({ ok: false, error: 'project_not_found' }, 404)

  // Reuse Phase 5 cache (1h) + Phase 5 runner — same binary, same args, same timeout.
  const maxMtime = await computeMaxMtime(entry.root)
  const cached = getAgentLinterCached(entry.id, maxMtime)
  if (cached) return outbound(c, AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema), enrichWithCachedAt(cached.result, cached.cachedAt))

  const fresh = await runAgentLinter(entry.root)
  const cachedAt = new Date().toISOString()
  setAgentLinterCached(entry.id, { result: fresh, cachedAt, maxMtime })
  return outbound(c, AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema), enrichWithCachedAt(fresh, cachedAt))
})
```

[VERIFIED: existing route at `packages/agent/src/routes/agentlinter.ts:33-70` follows exactly this shape. Phase 11's POST shape mirrors it almost identically; only difference is POST + body validation (vs GET + query). One-project-per-request is structurally guaranteed by accepting a single `projectId` in the body — the route does not loop over projects.]

### Pattern 6: Inline drift badge component (text-only, status tokens)

**What:** Tiny presentational component that renders `▲Nd` (improved) or `▼Nd` (regressed) using existing status tokens.

**Example:**
```typescript
// Source: synthesized from packages/spa/src/components/panels/coverage/CoverageCell.tsx (token usage)
// packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx

import React from 'react'

export interface CoverageDriftBadgeProps {
  direction: 'up' | 'down'
  daysSince: number
}

export function CoverageDriftBadge({ direction, daysSince }: CoverageDriftBadgeProps): React.JSX.Element {
  const arrow = direction === 'up' ? '▲' : '▼'
  // text-status-success for improvements (▲), text-status-error for regressions (▼).
  // Both tokens already exist in tokens.css; no new hex literals (preserves
  // tokenSourceOfTruth.test.ts invariant).
  const colorClass = direction === 'up' ? 'text-status-success' : 'text-status-error'
  return (
    <span
      className={`text-xs font-semibold ${colorClass}`}
      aria-label={`${direction === 'up' ? 'Improved' : 'Regressed'} ${daysSince} day${daysSince === 1 ? '' : 's'} ago`}
    >
      {arrow}
      {daysSince}d
    </span>
  )
}
```

**Placement inside `CoverageCell.tsx`:** Add as a sibling to the existing `<span className="text-xs text-text-tertiary whitespace-nowrap">{subtext}</span>` (line 134). The cell already has `flex flex-col items-center gap-0.5` so a third stacked element fits without layout change. Render only when `props.drift` is truthy. [VERIFIED: CoverageCell.tsx:126-137]

### Pattern 7: Sticky PageHeader (opt-in prop)

**What:** Add `sticky?: boolean` prop; when `true`, the outer `<div>` gets `sticky top-0 z-10 bg-app-bg` classes (preserving the existing `mb-6` margin).

**Example:**
```typescript
// Source: existing packages/spa/src/components/ui/PageHeader.tsx + Tailwind 4 sticky utility
// Only the outer div className changes.

export function PageHeader({ title, helper, actions, children, sticky = false }: PageHeaderProps): React.JSX.Element {
  const stickyClasses = sticky ? 'sticky top-0 z-10 bg-app-bg' : ''
  return (
    <div className={`mb-6 flex flex-col gap-1 ${stickyClasses}`}>
      {/* ... unchanged ... */}
    </div>
  )
}
```

**Why this works for AppShellV2:**
- `AppShellV2.tsx:49` has `<main id="main" className="flex-1 overflow-y-auto p-6">` — `<main>` is the scroll container. [VERIFIED]
- `sticky top-0` anchors to the nearest scroll ancestor (`<main>`), not the viewport. So PageHeader pins to the top of the page-content area, BELOW TopBar + RepairBanner. Correct visual outcome.
- `z-10` matches the existing `--z-sticky: 10` token from `tokens.css:71`. Stays below `--z-overlay: 100` (skip-to-main link) and `--z-modal: 1000`.
- `bg-app-bg` — without an opaque background the scrolled content would visibly pass *behind* the header. App background token is `#FAFAF7` (verified in `tokens.css:12`).
- `mb-6` (24px) preserved per CONTEXT §Specifics: "Sticky `PageHeader` should retain the 24px bottom margin (`mb-6`) below the title row." This already works because `mb-6` is on the outer div, not the inner content.

### Anti-Patterns to Avoid

- **`setInterval` for daily scheduling** — accumulates drift over weeks; doesn't handle DST cleanly. Use `setTimeout` chain re-anchored to `new Date()` each tick.
- **`fs.writeFile` for NDJSON snapshots** — overwrites the file. Must use `appendFile` with `flag: 'a'` to preserve append-only semantics (single-day re-invocation should add more lines, not overwrite).
- **Opportunistic-on-load snapshot writes** — explicitly forbidden by D-11-02. Adding "snapshot if today's file is missing" inside `GET /api/coverage` couples the request path to disk writes and bypasses the per-day-uniqueness invariant.
- **Storing absPath in the NDJSON record** — same INV-01 concern as Phase 10's CODEX HIGH-1. Use `family + repo` (or canonical `family/repo` repoId) — never the daemon-internal `absPath`.
- **Reading the entire NDJSON history into the SPA** — D-11-11 chose sibling route specifically to keep the matrix payload tight; sending raw history would inflate `/api/coverage` by ~14×.
- **Using `SidebarSubItem` for top-level Skill drift entry** — CONTEXT says "SidebarSubItem under the existing Observability section" but the existing `Coverage` entry is a `SidebarItem` (verified in `Sidebar.tsx:69-73`). Two peer entries must use the same primitive. **Use `SidebarItem`.**
- **Adding `StartCalendarInterval` to the Phase 6 launchd plist** — explained above; this either spawns duplicate daemons or is silently ignored under `KeepAlive=true`.
- **Hand-rolling a YAML / TOML parser for the NDJSON record** — NDJSON is plain `JSON.stringify` + `\n`. No parser needed beyond `JSON.parse(line)`.
- **Per-request lint over all projects in `POST /api/skills/drift/agentlinter`** — D-11-14 forbids; route accepts ONE `projectId` and runs ONE lint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron / scheduler | Custom file-watcher → epoch tick loop | `setTimeout` chain (Pattern 2) | Pure JS; testable with `vi.useFakeTimers()`; no native deps; survives DST cleanly because each tick re-anchors |
| NDJSON serialization | Custom field-separator format | `JSON.stringify(record) + '\n'` per line | Existing tooling parses NDJSON; one-line failure doesn't corrupt the rest |
| Atomic file append | Lock files + manual sync | `fs.appendFile(path, body, { flag: 'a', mode: 0o600 })` | POSIX `O_APPEND` guarantees one `write()` call lands atomically at EOF; Node 20's `appendFile` issues a single syscall for buffers ≤ ~64 KB |
| Cross-project family derivation | New family-tag field in registry | Path-prefix match against `~/Sourcecode/{agenticapps,factiv,neuroflash}/` | Live registry has `client: null` for every entry; path-prefix logic already exists in `repoDiscovery.ts:50` |
| AgentLinter spawn | New subprocess invocation | Existing `runAgentLinter(root)` in `agentLinterRunner.ts` | Existing fn already passes `--local`, uses argv array (no shell), 30s timeout, classifies into 5 result kinds; D-5-21 supply-chain invariant baked in |
| Drift-direction inference in the SPA | Client-side transition walker | Server-side `readDriftForCell` returning `{ direction, daysSince }` | Keeps wire schema flat; centralizes test surface in the daemon (vitest unit) instead of jsdom render tests |
| Date-only ISO string | Custom `format(YYYY-MM-DD)` | `new Date().toISOString().slice(0, 10)` | Built-in; UTC anchor avoids timezone bugs on the snapshot filename |
| Stale snapshot pruning | `find ... -mtime +14 -delete` shell-out | `readdirSync(dir).filter(filename → isoDateOlderThanCutoff(filename, cutoff)).forEach(unlinkSync)` | Filename IS the date (`<ISO-date>.ndjson`) — no stat needed; pure JS; matches no-shell-out invariant |

**Key insight:** Every primitive Phase 11 needs already exists in the codebase or in Node 20 core. The work is composition + glue, not invention. The biggest plan risk is incorrect framing of D-11-02 (the launchd-as-cron mismatch) — surfacing the in-process-scheduler reinterpretation early prevents wasted plan cycles.

## Runtime State Inventory

> Phase 11 is additive (new files, new routes, new directory) — there is no rename or migration. Runtime state inventory is straightforward:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 11 INTRODUCES the first new stored-data path (`~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`); no pre-existing data to migrate | New write path documented under `/cso` D-11-13; pruner handles aging |
| Live service config | None — Phase 11 adds no new external services; the daemon's own launchd/systemd unit files are reused unchanged (in-process scheduler, not `StartCalendarInterval`) | Verify in CSO audit that Phase 6 plist is NOT modified |
| OS-registered state | None to update — D-11-02's "via Phase 6 install" intent is satisfied by in-process scheduling; no new launchd entries, no new systemd units | If the planner DOES choose to extend launchd (not recommended), they must ALSO ship `install-launchd` test updates for the new entry |
| Secrets/env vars | None — Phase 11 reads no new env vars and writes no new env files | None |
| Build artifacts | New: `packages/agent/dist/snapshots/*.js` (bundled by existing tsup config), `packages/shared/dist/schemas/coverageHistory.js`, `packages/shared/dist/schemas/skillDrift.js` — emitted by existing build, no config change | Verify `pnpm -r build` runs clean after Phase 11 lands |

**Nothing found in category:** Stored data, live service config, OS-registered state, and secrets/env vars are confirmed empty after explicit search — verified by reading `~/.agenticapps/dashboard/registry.json` (no fields reference Phase 11 surfaces), `packages/agent/src/cli/installLaunchd.ts` (no schedule), and grepping the agent source for `setInterval|cron|schedule` (one shutdown-timeout match in `boot.ts:90` only).

## Common Pitfalls

### Pitfall 1: launchd `KeepAlive=true` collides with `StartCalendarInterval`
**What goes wrong:** Adding `<key>StartCalendarInterval</key>` to a plist with `KeepAlive=true` does not "schedule" the existing process — launchd either spawns a second copy at the calendar time (immediately kept alive forever by `KeepAlive`), or ignores the calendar entry. Net: confusing behaviour or duplicate daemons.
**Why it happens:** `StartCalendarInterval` is a launchd job-spawn trigger; `KeepAlive=true` is a job-respawn directive. They're not orthogonal in the way "cron + always-on" would be.
**How to avoid:** Adopt the in-process scheduler (Pattern 2). The daemon process launchd runs already stays up under `KeepAlive=true`; the daily tick lives inside that process.
**Warning signs:** Two `agentic-dashboard` processes appearing in `ps aux` after install; daemon log shows duplicate startup banners.

### Pitfall 2: `fs.appendFile` `mode` only applies on creation
**What goes wrong:** A test asserts the snapshot file is mode `0600` after second-write-of-the-day and finds it's actually whatever umask granted on the first write (e.g., `0644`).
**Why it happens:** POSIX `open(2)` with `O_CREAT` only sets mode if the file is being created; existing files retain their existing mode. Node's `appendFile` honours this.
**How to avoid:** Either (a) explicitly call `fs.chmod(path, 0o600)` after the first write of the day, or (b) test mode-on-disk against the first-write-only case and document the invariant. Easier still: write via `atomicWriteFile` (which uses `O_EXCL` for the tmp file and renames into place with the explicit mode), trading the append idiom for a read-then-rewrite cycle. **Recommend (a)** — single chmod after first creation; cheaper than rewriting the file each tick.
**Warning signs:** Local `ls -l ~/.agenticapps/dashboard/coverage-history/*.ndjson` shows `0644` after Phase 11 lands; `/cso` audit flags loose permissions.

### Pitfall 3: NDJSON line interleaving on concurrent writers
**What goes wrong:** Two writers append to the same NDJSON file simultaneously; one line ends up split across two writes, producing an unparseable mid-line concatenation like `{"family":"factivapps","repo":"...`{"family":"agenticapps",...`.
**Why it happens:** POSIX `O_APPEND` guarantees the seek-and-write is atomic *per `write(2)` syscall*, but a buffered Node write can fragment across multiple syscalls if the buffer is large. For records < `PIPE_BUF` (4 KB on Linux/macOS), this is not an issue.
**How to avoid:** (a) Build all per-row records into a single `body` string in memory, issue ONE `appendFile` call per tick (Pattern 1 already does this). (b) Even on a worst-case 45-row write (45 × ~200 bytes = 9 KB), the file-write path in Node bypasses pipe-atomicity rules — regular file writes are typically atomic up to ~`SSIZE_MAX`. (c) The daily-cron-only trigger (D-11-02) eliminates the concurrent-writer scenario entirely — there's only one writer.
**Warning signs:** Mid-line JSON parse errors when reading history; intermittent failures only under load.

### Pitfall 4: Snapshot files named with local-tz date when reader assumes UTC
**What goes wrong:** Writer uses `toLocaleDateString()` and reader uses `toISOString().slice(0, 10)` — pre-midnight UTC writes land in tomorrow's local file but yesterday's UTC bucket on read.
**Why it happens:** ISO date vs local date asymmetry.
**How to avoid:** Use `toISOString().slice(0, 10)` (UTC date) **everywhere**. The scheduler still fires at 03:00 LOCAL time (off-peak), but the *filename* is UTC. Daily cadence is preserved (one UTC date per day); local tz only affects timing.
**Warning signs:** Test fails near midnight UTC; manual snapshot run produces a file the reader can't find.

### Pitfall 5: Path traversal in `repoId` query param
**What goes wrong:** SPA accidentally (or attacker-controlled) sends `repoId=../etc/passwd` → daemon reads outside `coverage-history/`.
**Why it happens:** A naive history reader uses `repoId` directly in a filesystem path.
**How to avoid:** `repoId` is NOT a filesystem path. It's a logical `family/repo` key (regex-validated in `QuerySchema` — see Pattern 3). The NDJSON reader matches `repoId` against records *inside* a known-safe file (`<ISO-date>.ndjson` whose filename is regex-validated too). No filesystem traversal possible.
**Warning signs:** History endpoint returns content from outside `coverage-history/`; vitest unit must include a path-traversal probe.

### Pitfall 6: Stale `agentLinterCache` entry for unregistered project
**What goes wrong:** User unregisters a project, re-registers it with the same id, sees a stale lint result.
**Why it happens:** AgentLinter cache is keyed by `projectId` only; unregister-then-register reuses the id.
**How to avoid:** Already handled by `evictAgentLinterCacheProject(id)` (verified at `agentLinterCache.ts:130`) called on unregister. Phase 11 must verify this hook STILL fires from the new POST route's failure path (if a project disappears mid-request, the cache entry should evict — though that's an existing Phase 5 behaviour, not a Phase 11 regression risk).
**Warning signs:** Stale lint scores in the Skill drift matrix after a re-registration cycle.

### Pitfall 7: Scheduler keeps test process alive
**What goes wrong:** Vitest unit imports `snapshotScheduler.ts`, the scheduler arms a `setTimeout`, the test process never exits because the timer holds the event loop open.
**Why it happens:** Default `setTimeout` is ref'd.
**How to avoid:** Call `.unref()` on the returned timer (Pattern 2 already does this). Additionally, expose a disposer function `() => clearTimeout(activeTimer)` so tests can clean up explicitly.
**Warning signs:** `vitest --run` hangs after the test file completes; CI times out.

### Pitfall 8: Sticky PageHeader blocked by overflow:hidden ancestor
**What goes wrong:** Sticky positioning silently fails because a wrapper has `overflow: hidden` (Phase 10's `CoverageFamilySection` originally had this — fixed in Phase 10 P0 #2).
**Why it happens:** `overflow: hidden | auto | scroll` on an ancestor establishes a non-default containing block that neuters `sticky` positioning above it.
**How to avoid:** PageHeader sits DIRECTLY inside `<main>` (the scroll container itself). `<main>` has `overflow-y-auto` which DOES establish a scroll context — sticky pins inside it correctly. No further intermediate `overflow` clipping at the page-content level (verified by reading `AppShellV2.tsx:49`).
**Warning signs:** Header scrolls away on `/coverage` despite the `sticky` prop being `true`; only visible after route opt-in.

### Pitfall 9: CoverageHistory cache cross-bleeding between repos
**What goes wrong:** A planner uses a single-key cache (like `coverageCache.ts`) for `/api/coverage/history` — every history call invalidates every other repo's cache.
**Why it happens:** Single-key memo doesn't fit the (repoId, cell) tuple.
**How to avoid:** New `coverageHistoryCache.ts` uses `Map<string, { value, expiresAt }>` keyed by `${repoId}:${cell}` — same pattern as `agentLinterCache.ts:43` (`Map<string, CachedRow>`). Each (repoId, cell) tuple has independent TTL.
**Warning signs:** Loading the matrix shows the SAME drift indicator for every cell on the first paint after warm-up.

## Code Examples

### Common Operation 1: Schema files (locked structure)

```typescript
// Source: synthesized from packages/shared/src/schemas/coverage.ts (sibling pattern)
// packages/shared/src/schemas/coverageHistory.ts

import { z } from 'zod'

import { CoverageStateSchema } from './coverage.js'

// Direction = which way the most recent transition moved within the window.
// 'up'   = improved (e.g., missing → fresh, stale → fresh)
// 'down' = regressed (e.g., fresh → stale, stale → missing)
// null   = no transition within the rolling window — SPA hides the indicator.
export const CoverageDriftDirectionSchema = z.enum(['up', 'down'])
export type CoverageDriftDirection = z.infer<typeof CoverageDriftDirectionSchema>

// Per-(repoId, cell) drift summary.
export const CoverageHistoryResponseSchema = z.object({
  schemaVersion: z.literal(1),
  repoId: z.string(),                         // 'family/repo'
  cell: z.enum(['claudeMd', 'gitNexus', 'wiki', 'workflowVersion']),
  direction: CoverageDriftDirectionSchema.nullable(),
  daysSince: z.number().int().nonnegative().nullable(),  // null when direction is null
  windowDays: z.literal(14),                  // mirrors D-11-01 retention window
})
export type CoverageHistoryResponse = z.infer<typeof CoverageHistoryResponseSchema>
```

```typescript
// packages/shared/src/schemas/skillDrift.ts

import { z } from 'zod'

// Per-(skill, project) cell shape — matrix cell for the Skill drift page.
export const SkillDriftCellSchema = z.object({
  present: z.boolean(),
  version: z.string().nullable(),       // SKILL.md frontmatter `version` (null if missing)
  lastModifiedIso: z.string().datetime().nullable(),
})
export type SkillDriftCell = z.infer<typeof SkillDriftCellSchema>

// Per-skill row: skill id + map of {projectId → cell}.
export const SkillDriftRowSchema = z.object({
  skillId: z.string(),                  // SKILL.md frontmatter `name` (or dirname fallback)
  byProject: z.record(z.string(), SkillDriftCellSchema),
})
export type SkillDriftRow = z.infer<typeof SkillDriftRowSchema>

// Top-level response — registered projects in matrix-column order, then per-skill rows.
export const SkillDriftResponseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAtIso: z.string().datetime(),
  projects: z.array(z.object({
    projectId: z.string(),
    projectName: z.string(),
    family: z.enum(['agenticapps', 'factiv', 'neuroflash', 'other']),
    degraded: z.string().optional(),    // present when the per-project readLocalSkills threw
  })),
  rows: z.array(SkillDriftRowSchema),
})
export type SkillDriftResponse = z.infer<typeof SkillDriftResponseSchema>
```

### Common Operation 2: Barrel re-export

```typescript
// packages/shared/src/index.ts — APPEND ONLY (locked existing exports untouched per D-11-12)

export {
  CoverageDriftDirectionSchema,
  CoverageHistoryResponseSchema,
} from './schemas/coverageHistory.js'
export type {
  CoverageDriftDirection,
  CoverageHistoryResponse,
} from './schemas/coverageHistory.js'

export {
  SkillDriftCellSchema,
  SkillDriftRowSchema,
  SkillDriftResponseSchema,
} from './schemas/skillDrift.js'
export type {
  SkillDriftCell,
  SkillDriftRow,
  SkillDriftResponse,
} from './schemas/skillDrift.js'
```

[VERIFIED: existing barrel at `packages/shared/src/index.ts:152-177` follows exactly this pattern. Two-section block per schema file (Schema → type) is the established convention.]

### Common Operation 3: Route mount

```typescript
// packages/agent/src/server/app.ts — INSERT after line 133 ("app.route('/api', coverageRoute)")

import { coverageHistoryRoute } from '../routes/coverageHistory.js'
import { skillDriftRoute } from '../routes/skillDrift.js'

// ...

  app.route('/api', coverageRoute)
  app.route('/api', coverageHistoryRoute)    // NEW — TRD-03
  app.route('/api', skillDriftRoute)         // NEW — SKD-02, SKD-03
```

Both new routes inherit `bearerAuth` + `cors` + `logger` + `requestId` from the middleware chain (lines 71-113). [VERIFIED: middleware ordering documented in `app.ts:54-67`.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 1's `auth.json` + `registry.json` as the only daemon-writeable files | Phase 11 adds `coverage-history/` as a new write path under the same `~/.agenticapps/dashboard/` root | Phase 11 | INV-02 generalises from "files" to "directory tree" — `/cso` must verify mode `0o700` on the new dir + `0o600` on each NDJSON file |
| Phase 6's `KeepAlive=true` long-running daemon (no scheduled work) | Daemon now hosts a daily in-process scheduler | Phase 11 | One new `setTimeout` chain inside the daemon process; no launchd/systemd changes |
| Phase 10's request-path scanner (`scanCoverage` on every GET) | Phase 11 separates request-path scanning from snapshot-path writing | Phase 11 | Daily snapshot uses `scanCoverageInternal` independently; request path unchanged |
| Phase 10's single-key `coverageCache.ts` (one entry, 30s TTL) | Phase 11 introduces TWO new caches: `coverageHistoryCache.ts` (Map keyed by `repoId:cell`, 1h TTL) + `skillDriftCache.ts` (single-key, 30s TTL) | Phase 11 | Each cache file follows the existing primitive's TTL/eviction patterns |
| Phase 5's per-project AgentLinter route (`GET /api/projects/:id/agentlinter`) | Phase 11 adds a parallel call-site (`POST /api/skills/drift/agentlinter`) but reuses the same runner + cache | Phase 11 | D-11-14 requires `/cso` to confirm the new call-site does NOT loop over projects |

**Deprecated/outdated:**
- The pre-10.6 boolean `gitNexusInstalled` is gone (replaced by `gitNexusInstallState` enum). Phase 11 snapshot records the FOUR per-column states (`fresh/stale/missing/not-applicable`); the 3-state install enum is a top-level field on `CoverageResponse`, not per-row, so it's NOT in the snapshot record shape. Drift detection operates per-cell, per-row.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.x (existing — same as Phase 10) |
| Config file | `packages/agent/vitest.config.ts` (Node env), `packages/spa/vitest.config.ts` (jsdom), `packages/shared/vitest.config.ts` (Node env) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` (or `-spa` / `-shared`) |
| Full suite command | `pnpm -r test` (160+ tests across packages as of Phase 1 close) |
| Phase gate | Full suite green before `/gsd-verify-work`; impeccable critique re-run on 2 routes |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRD-01 | `writeDailySnapshot` writes NDJSON line per row, dir mode 0o700, file mode 0o600, ISO-date filename | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/snapshotWriter.test.ts` | ❌ Wave 0 |
| TRD-01 | Re-invoking same-day appends additional lines (does NOT overwrite) | unit | same file | ❌ Wave 0 |
| TRD-01 | `chmod 0o600` enforced after first creation (Pitfall 2 defence) | unit | same file | ❌ Wave 0 |
| TRD-02 | Pruner unlinks files whose ISO-date filename is older than `now - 14d`; leaves newer files alone | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/snapshotPruner.test.ts` | ❌ Wave 0 |
| TRD-02 | Pruner runs IMMEDIATELY before each write (lazy trigger — no second scheduler) | unit | `snapshotWriter.test.ts` integration with mocked pruner | ❌ Wave 0 |
| TRD-03 | `GET /api/coverage/history` rejects path traversal in `repoId` (422) | unit | `pnpm --filter @agenticapps/dashboard-agent test src/routes/coverageHistory.test.ts` | ❌ Wave 0 |
| TRD-03 | `GET /api/coverage/history` rejects unknown `cell` enum (400) | unit | same file | ❌ Wave 0 |
| TRD-03 | `GET /api/coverage/history` requires bearer auth (401 without token) | unit | same file | ❌ Wave 0 |
| TRD-03 | Server-side drift computation returns `{ direction, daysSince }` correctly across 4 transition scenarios (no-change, fresh→stale, stale→fresh, multiple-transitions) | unit | `src/lib/snapshots/snapshotReader.test.ts` | ❌ Wave 0 |
| TRD-04 | Scheduler arms `setTimeout` to next 03:00 local; ticks fire `writeDailySnapshot`; re-arms after each tick | unit | `src/lib/snapshots/snapshotScheduler.test.ts` (uses `vi.useFakeTimers()` + injected `now` fn) | ❌ Wave 0 |
| TRD-04 | Scheduler `.unref()`s timer (does not keep test process alive); disposer clears active timer | unit | same file | ❌ Wave 0 |
| TRD-04 | Scheduler swallows `writeDailySnapshot` errors and re-arms anyway | unit | same file | ❌ Wave 0 |
| TRD-05 | `CoverageDriftBadge` renders `▲Nd` with `text-status-success` when direction='up' | unit | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/coverage/CoverageDriftBadge.test.tsx` | ❌ Wave 0 |
| TRD-05 | `CoverageDriftBadge` renders `▼Nd` with `text-status-error` when direction='down' | unit | same file | ❌ Wave 0 |
| TRD-05 | `CoverageCell` renders no badge when `drift` prop absent (regression guard) | unit | `src/components/panels/coverage/CoverageCell.test.tsx` (existing — extend) | ❌ Wave 0 (extension) |
| SKD-01 | `scanSkillDrift` calls `readLocalSkills` per registered project | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/skillDriftScan.test.ts` | ❌ Wave 0 |
| SKD-01 | `scanSkillDrift` derives family from `root` path prefix; falls back to 'other' for non-Sourcecode roots | unit | same file | ❌ Wave 0 |
| SKD-01 | `scanSkillDrift` isolates per-project failures via `Promise.allSettled` — one rejection does not poison response | unit | same file | ❌ Wave 0 |
| SKD-02 | `GET /api/skills/drift` returns `SkillDriftResponse` with bearer auth + 30s cache | unit | `pnpm --filter @agenticapps/dashboard-agent test src/routes/skillDrift.test.ts` | ❌ Wave 0 |
| SKD-03 | `POST /api/skills/drift/agentlinter` validates body, 404s on unknown project, runs ONE lint, reuses cache | unit | same file | ❌ Wave 0 |
| SKD-03 | Body validation rejects extra projectIds (route accepts singular projectId only) — D-11-14 enforcement | unit | same file | ❌ Wave 0 |
| SKD-04 | `SkillDriftMatrix` renders one row per skill, one column per project | unit | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/skill-drift/SkillDriftMatrix.test.tsx` | ❌ Wave 0 |
| SKD-04 | `SkillDriftToolbar` chip toggles per-family/cross-family scope, URL-syncs `?scope=`, 200ms debounce on text input | unit | `src/components/panels/skill-drift/SkillDriftToolbar.test.tsx` | ❌ Wave 0 |
| SKD-05 | `Sidebar` now exposes both `Coverage` and `Skill drift` items under `Observability` | unit | `src/components/ui/Sidebar.test.tsx` (existing — extend) | ❌ Wave 0 (extension) |
| PLI-01 | `PageHeader` with `sticky={true}` adds `sticky top-0 z-10 bg-app-bg` classes; default false preserves current behavior | unit | `src/components/ui/PageHeader.test.tsx` (existing — extend with sticky case) | ❌ Wave 0 (extension) |
| PLI-02 | `CoverageRow` refresh button starts at `opacity-30`; hovers/focuses to `opacity-100` | unit | `src/components/panels/coverage/CoverageRow.test.tsx` (existing — extend) | ❌ Wave 0 (extension) |
| PLI-03 | `/coverage` page passes `sticky={true}` to `PageHeader` | unit | `src/routes/coverage.lazy.test.tsx` (existing — extend) | ❌ Wave 0 (extension) |
| Integration | Full cron-tick → snapshot file → endpoint read → SPA `CoverageCell` renders badge | integration | New test file `src/integration/snapshotFlow.integration.test.ts` (agent only, no SPA — daemon E2E) | ❌ Wave 0 |
| Integration | `scanSkillDrift` output → `/api/skills/drift` response → `SkillDriftMatrix` jsdom render | integration | New test file `src/integration/skillDriftFlow.integration.test.tsx` | ❌ Wave 0 |
| Impeccable | `/coverage` re-critique (drift badge + sticky header + opacity polish) | impeccable artifact | manual `/impeccable critique http://localhost:5174/coverage` | manual (gate) |
| Impeccable | `/observability/skill-drift` first critique | impeccable artifact | manual `/impeccable critique http://localhost:5174/observability/skill-drift` | manual (gate) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/` (or relevant package filter)
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green + both IMPECCABLE artifacts committed before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/agent/src/lib/snapshots/snapshotWriter.test.ts` — covers TRD-01 (write semantics + mode enforcement)
- [ ] `packages/agent/src/lib/snapshots/snapshotPruner.test.ts` — covers TRD-02 (14d rolling cutoff)
- [ ] `packages/agent/src/lib/snapshots/snapshotReader.test.ts` — covers server-side drift computation
- [ ] `packages/agent/src/lib/snapshots/snapshotScheduler.test.ts` — covers TRD-04 (timer arming + dispose)
- [ ] `packages/agent/src/routes/coverageHistory.test.ts` — covers TRD-03 (route auth + validation + traversal defence)
- [ ] `packages/agent/src/lib/skillDriftScan.test.ts` — covers SKD-01 (aggregator + family derivation + isolation)
- [ ] `packages/agent/src/lib/skillDriftCache.test.ts` — covers SKD-02 cache semantics (30s TTL + invalidation)
- [ ] `packages/agent/src/routes/skillDrift.test.ts` — covers SKD-02 + SKD-03 (both routes, body validation, single-project enforcement)
- [ ] `packages/spa/src/components/panels/coverage/CoverageDriftBadge.test.tsx` — covers TRD-05 visual
- [ ] `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.test.tsx` — covers SKD-04 matrix render
- [ ] `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.test.tsx` — covers SKD-04 toolbar URL sync + debounce
- [ ] `packages/spa/src/lib/useCoverageHistory.test.ts` — covers TanStack Query hook (cache + suspense behaviour)
- [ ] `packages/spa/src/lib/useSkillDrift.test.ts` — covers TanStack Query hook
- [ ] Integration: `packages/agent/src/integration/snapshotFlow.integration.test.ts` — covers full end-to-end on daemon side
- [ ] Test fixtures: extend `packages/agent/src/lib/__fixtures__/` with `coverage-history/` example NDJSON files for snapshot-reader unit tests (use small synthetic data — 3 repos, 5 days, 2 known transitions)

Framework install: none — vitest already wired.

## Security Domain

### Applicable ASVS Categories (security_asvs_level: 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer token (Phase 1 D-13/D-15) — inherited by new routes via `app.use(bearerAuth(...))` middleware |
| V3 Session Management | no | No session state; stateless bearer-token per request |
| V4 Access Control | yes | Same per-route auth + project-id validation (registry lookup) on `POST /api/skills/drift/agentlinter` |
| V5 Input Validation | yes | Zod schemas on every query (TRD-03) + body (SKD-03); regex-validated `repoId` rejects path traversal |
| V6 Cryptography | partial | Bearer token comparison uses `timingSafeEqual` (inherited from `app.ts:107`) — no new crypto code in Phase 11 |
| V7 Error Handling & Logging | yes | `outbound()` wrapper enforces outbound schema parse on every response (INV-04) — no `requestId` leakage to client beyond existing pattern |
| V8 Data Protection | yes | New NDJSON files mode `0o600`; directory mode `0o700`; INV-01 read-only-on-projects preserved (Phase 11 writes only inside daemon's home tree) |
| V12 Files and Resources | yes | Path-traversal regex on `repoId`; symlink-escape defence on `coverage-history/` realpath at boot |
| V13 API & Web Service | yes | CORS lock to known origins inherited; no new origins introduced |

### Known Threat Patterns for {Node + Hono + filesystem stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `repoId=../etc/passwd` | Tampering (T) + Information Disclosure (I) | Regex-validate `repoId` to `/^[a-z0-9\-]+\/[a-z0-9\-_]+$/`; NDJSON reader matches records by string equality (no path interpolation) |
| Symlink escape from `coverage-history/` to outside `~/.agenticapps/dashboard/` | Tampering (T) | `realpathSync` once at boot to canonicalise the snapshot dir; reject (refuse to start) if it escapes the daemon's home tree (mirrors `auth.json` 0600 enforcement pattern at `lib/auth.ts`) |
| Mode-drift on snapshot files (snapshot becomes world-readable after first write) | Information Disclosure (I) | Pitfall 2 defence: explicit `chmod 0o600` after first creation; vitest asserts mode-on-disk |
| Repudiation of AgentLinter output (attacker forges a positive lint result) | Repudiation (R) | New POST route is bearer-auth protected; cache keyed by `projectId + maxMtime` makes spoofing detectable (cached entries that don't match observed mtime are rejected by `agentLinterCache.ts:113`) |
| DoS via runaway lint spawn (attacker triggers N parallel POSTs) | Denial of Service (D) | 30s timeout per lint (existing — `agentLinterRunner.ts:42`); per-projectId cache absorbs repeated requests; D-11-14 requires single-project-per-request (route accepts only one `projectId`) |
| Information disclosure via cross-repo Skill drift aggregation | Information Disclosure (I) | Aggregation only over registered projects (`readRegistry`) — same trust boundary as existing `/api/registry` route. Daemon reads filesystem locations the user explicitly paired; no cross-machine surface |
| DoS via snapshot directory disk-filling | Denial of Service (D) | 14d rolling prune (TRD-02) bounds disk usage to ≤ 14 × ~9 KB = ~125 KB; far below any reasonable disk-pressure threshold |
| TOCTOU between repoId resolution and AgentLinter spawn | Tampering (T) | Same defence as Phase 10's CODEX HIGH-3 — re-resolve project root via registry lookup immediately before `runAgentLinter` invocation; reject if registry row vanished mid-request |
| NDJSON line injection (malicious skill version string `\n{"family":...}` smuggles a forged record) | Tampering (T) + Spoofing (S) | All snapshot record values are limited-domain enums (`'fresh' \| 'stale' \| 'missing' \| 'not-applicable'`) or simple strings already validated upstream; `JSON.stringify` escapes embedded newlines. No user-supplied free text in the NDJSON pipeline. |
| Bearer-bypass on new routes | Spoofing (S) | Middleware ordering ensures `bearerAuth` runs before route handlers; structural guarantee from `app.ts:102-113` |

## Trust Boundary Analysis

Phase 11 introduces TWO trust-boundary deltas per CONTEXT (D-11-13, D-11-14). Both deltas are enumerated below with STRIDE classification and the specific control the planner must include in PLAN.md `<threat_model>` blocks.

### Delta 1 — New daemon write path (`coverage-history/`)

**Trust boundary:** Daemon process (inside) ↔ user's filesystem under `~/.agenticapps/dashboard/` (outside, but home-tree-confined).

**What crosses:** Snapshot records (JSON-serialised, ≤ 200 bytes each, four limited-domain enum fields per row + ISO timestamp + family/repo strings).

**Direction:** Daemon writes outbound. No data flows in from outside via this surface.

**STRIDE:**
- **S — Spoofing of snapshot writer:** A second daemon process could attempt to write to the same NDJSON file. *Mitigation:* `pidfile.ts` (Phase 1) prevents two daemons binding the same port; a rogue out-of-band writer (e.g., user accidentally running `agentic-dashboard start` twice) is detected by the existing pidfile lock. The launchd `KeepAlive=true` model means only one daemon ever runs.
- **T — Tampering with NDJSON history (post-write modification):** Another local user (or attacker with same-uid access) edits or truncates `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`. *Mitigation:* mode `0o600` + directory `0o700` restrict access to the daemon's UID. Same-uid attacker mitigation matches existing `auth.json` posture per Phase 1 D-13 ("0600 in home dir is sufficient for a daemon that already only listens on loopback").
- **R — Repudiation of snapshot contents:** None — snapshots are appended timestamped records; user can always inspect them. No claim of integrity beyond local trust boundary.
- **I — Information disclosure (snapshot leak):** Snapshot contents are NOT secret (they describe public-knowledge filesystem state — repo names + coverage column states). Risk is low. Mitigation still: `0o600` + path-traversal defence on `repoId` query param prevents off-tree read via the history endpoint.
- **D — DoS via disk-filling:** 14d rolling prune bounds size (Mitigation: TRD-02). Worst case 14 files × ~9 KB = ~125 KB total.
- **E — Elevation via symlink escape:** A symlink at `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` pointing to `/etc/passwd` would cause the daemon to write into `/etc/passwd` (kernel follows the symlink). *Mitigation:* Use `O_NOFOLLOW` on the open path — `fs.open(path, O_NOFOLLOW | O_APPEND | O_CREAT, 0o600)` for the underlying write. Node's `appendFile` does NOT default to O_NOFOLLOW. The planner must use lower-level `fs.openSync(path, fs.constants.O_NOFOLLOW | ...)` for the first creation, or call `realpathSync` on the parent dir at boot and refuse to start if it escapes `homedir() + '/.agenticapps/dashboard'`. **Recommend the boot-time realpath check** — same pattern as `auth.ts` mode enforcement.

**Required mitigation list for PLAN.md `<threat_model>` block:**
1. Directory creation: `mode: 0o700` on `mkdir`.
2. File creation: `mode: 0o600` on first write; explicit `chmod 0o600` after first creation to defend against umask drift on append.
3. Symlink-escape defence: `realpathSync(snapshotDir)` once at boot; refuse to start if it escapes `~/.agenticapps/dashboard/`.
4. Path-traversal defence on history endpoint: regex-validate `repoId` query param to `/^[a-z0-9\-]+\/[a-z0-9\-_]+$/`.
5. Filename regex-validate inside reader: only `\d{4}-\d{2}-\d{2}\.ndjson` files counted.
6. Zod outbound schema parse via `outbound()` wrapper (INV-04).

### Delta 2 — Widened AgentLinter spawn surface (cross-repo invocation context)

**Trust boundary:** Daemon process ↔ subprocess (`node <bundled-agentlinter-bin>`) operating on a project's local filesystem.

**What crosses:** Subprocess argv (`[binPath, '--local', '--json', projectRoot]`); subprocess returns parsed JSON report.

**Direction:** Daemon spawns outbound (no inbound data flow beyond exit code + stdout JSON).

**STRIDE:**
- **S — Spoofing the spawn target:** Attacker tricks the route into spawning an arbitrary binary. *Mitigation:* `resolveBinPath` (`agentLinterRunner.ts:63`) uses `createRequire` resolution against the `@agenticapps/agentlinter` package — the supply-chain invariant D-5-21 (team-controlled fork, pnpm-locked) is preserved unchanged. Phase 11's new route calls the same function; no new resolution path.
- **T — Tampering with subprocess argv:** Attacker injects shell metacharacters via `projectId` body field. *Mitigation:* Body parsed by Zod → `projectId` is a plain string; route looks up `entry.root` from `readRegistry()` (NOT from the request body directly). `entry.root` is filesystem-validated at registration time. Argv is passed as an array (no shell expansion — verified at `agentLinterRunner.ts:103`).
- **R — Repudiation of lint scores:** Same mitigation as Phase 5 — cache key includes `maxMtime` so the user can detect cache lies by touching SKILL.md.
- **I — Information disclosure via AgentLinter cloud upload:** `--local` flag enforces local-only operation. *Mitigation:* Privacy invariant T-05-02-AgentLinter-Local; same code path as Phase 5 — no change in Phase 11.
- **D — DoS via runaway spawn (concurrent POSTs against many projects):** *Mitigation:* (a) Each POST runs ONE lint for ONE project (D-11-14 single-project-per-request). (b) 30s subprocess timeout (`agentLinterRunner.ts:42`). (c) Cache absorbs repeats. (d) Bearer-auth gates the route — only the paired SPA can invoke. No anonymous DoS surface.
- **E — Elevation via project root traversal:** Attacker passes a `projectId` whose registered `root` is `/`. *Mitigation:* Registration-time path validation (Phase 1 D-09/D-10/D-11) ensures `root` is a valid project directory. The new POST route trusts `entry.root` from registry — no path interpolation.

**Required mitigation list for PLAN.md `<threat_model>` block:**
1. Bearer-auth on `POST /api/skills/drift/agentlinter` (inherited).
2. Body Zod-validated to `{ projectId: string }` with `.min(1)` constraint.
3. Registry lookup fails closed (404) on unknown `projectId`.
4. Route accepts EXACTLY one `projectId` field — body schema does NOT support arrays or comma-lists. Single-project-per-request enforced structurally.
5. Spawn target resolution unchanged from Phase 5 (`createRequire` against `@agenticapps/agentlinter`).
6. `--local` flag asserted in route test (privacy invariant carries over).
7. 30s timeout unchanged from Phase 5.
8. Cache eviction on unregister (existing `evictAgentLinterCacheProject` hook still fires — verify in route test).

### Summary — what `/cso` will audit

1. ✅ No new daemon route reads/writes outside `<root>/.planning` or `<root>/.claude` on project filesystems (INV-01 preserved).
2. ✅ The single new daemon write path (`~/.agenticapps/dashboard/coverage-history/`) is under the existing daemon-home root (INV-02 generalised — `/cso` verifies mode `0o700` dir + `0o600` file).
3. ✅ No new native deps (INV-05 preserved).
4. ✅ Bearer-auth + CORS unchanged (Phase 1 contract).
5. ✅ Outbound schema parse on every new response (INV-04 preserved via `outbound()` wrapper).
6. ✅ AgentLinter spawn surface widened in CALL-SITE only; binary, args, timeout, cache, supply-chain invariant all unchanged from Phase 5.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 20.0.0 | All daemon code (built-in `fs/promises`, `setTimeout` chain) | ✓ | 20+ (per `package.json` engines lock) | — |
| `@agenticapps/agentlinter` (pnpm-locked) | `POST /api/skills/drift/agentlinter` D-11-14 | ✓ (verified — `agentLinterRunner.ts:67` resolves it via `createRequire`) | (whatever is pinned in `pnpm-lock.yaml`) | Route returns `{ kind: 'not-installed' }` (existing classification — graceful) |
| `~/.agenticapps/dashboard/` directory | Snapshot writer (existing pattern) | ✓ (Phase 1 created on first daemon start) | — | Created lazily by writer if absent (mode `0o700`) |
| Tailwind 4 + Vite + React 18 + TanStack Router (SPA stack) | All new SPA work | ✓ (Phase 5.1 / Phase 10 baseline) | per existing lockfile | — |
| vitest 1.x + jsdom | All new tests | ✓ | per existing lockfile | — |
| Dev server `localhost:5174` | Phase 11 IMPECCABLE critique (manual) | ✓ (Phase 0 / Phase 2 baseline — `pnpm --filter @agenticapps/dashboard-spa dev`) | — | — |
| `/impeccable critique` skill | D-10.5-02 gate | ✓ (skill at `~/.agents/skills/impeccable/SKILL.md` per Phase 10.5) | — | — |

**Missing dependencies with no fallback:**
- None — Phase 11 is entirely additive over Phase 10 / Phase 5 / Phase 6 surfaces.

**Missing dependencies with fallback:**
- AgentLinter package missing (e.g., on a fresh checkout without `pnpm install`): existing classification `{ kind: 'not-installed' }` returned by `runAgentLinter`; UI shows the existing "AgentLinter not installed" state. No new fallback code needed.

## Assumptions Log

> Items the planner / discuss-phase should confirm before becoming locked decisions. Most of these are recommendations within Claude's Discretion zones — they need user sign-off or planner adoption, not external research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The daily scheduler should fire at **03:00 local time** (off-peak, daemon idle) | Pattern 2 | If user expects midnight UTC: scheduler still works, change one constant; only impact is the filename's UTC date might be off-by-one from the user's intuition |
| A2 | `repoId` wire format is `"family/repo"` (e.g., `"agenticapps/agenticapps-dashboard"`) | Pattern 3, schema | If user expects bare `repo` only: query disambiguates same-named repos across families incorrectly. Two `agenticapps-dashboard` clones (one in `agenticapps/`, one elsewhere) would conflict |
| A3 | NDJSON record shape is **row-per-day** (one record per repo per day with all 4 columns inline), NOT cell-per-day | Pattern 1, alternatives table | If user prefers cell-per-day: storage 4× larger; reader scans 4× more lines; per-cell lookup marginally faster. Easy to swap if signal is wrong |
| A4 | Family derivation falls back to `'other'` for projects whose `root` is NOT under `~/Sourcecode/{agenticapps,factiv,neuroflash}/` | Pattern 4 | If user wants strict family enforcement: 'other' bucket is empty; planner can drop the fallback and reject non-family registrations in the aggregator, leaving the SPA matrix without those projects |
| A5 | The Skill drift cache uses 30s TTL (matching Phase 10's coverage cache cadence), NOT 1h | Pattern 3 alternatives | If 30s is too aggressive: cache thrashes during heavy SPA use; bumping to 60s/300s is one constant change |
| A6 | Skill drift aggregator iterates `readRegistry().projects` (all registered, not just family-resident); off-family projects appear in the `'other'` column group | Pattern 4 | If user wants family-only: trivial filter in `scanSkillDrift`; preserves current SPA matrix shape |
| A7 | The component name for the inline drift indicator is `CoverageDriftBadge` (avoiding `InlineDrift` name collision) | Pattern 6, Claude's Discretion | If user prefers `DriftIndicator` / `TrendBadge`: pure rename, no behaviour change |
| A8 | Sticky `PageHeader` uses `z-10` (matches existing `--z-sticky` token) and `bg-app-bg` for the opaque background | Pattern 7 | If header should appear above modals/toasts: bump z to `--z-overlay`. Default `z-10` is correct for sticky-below-overlays |
| A9 | In-process scheduler (NOT launchd `StartCalendarInterval`) is the right interpretation of D-11-02 | Pattern 2 + Pitfall 1 | **HIGH-RISK** — if user expects an OS-level cron entry: planner shipped wrong mechanism. Discussed above with verified evidence (`installLaunchd.ts:46` `KeepAlive=true`) — needs explicit planner adoption + decision record |
| A10 | Skill drift route uses `SidebarItem` (NOT `SidebarSubItem`) as recommended by code-pattern review, overriding CONTEXT's `SidebarSubItem` mention | Anti-Patterns table | If user wants Skill drift visually indented (sub-of-Coverage): use `SidebarSubItem` instead. But that contradicts D-11-08's "2 entries under Observability" framing — peer entries should use peer primitive |
| A11 | Pruner runs **lazily on each writer tick** (no second scheduler) | TRD-02 row | If user wants a separate prune-only scheduler: doubles the scheduler surface; lazy-on-write is simpler. Per-tick prune cost is O(14) stats — negligible |
| A12 | `chmod 0o600` is applied after first creation per UTC-date file (defends Pitfall 2) | Pitfall 2 | If user accepts default umask: file may end up `0o644` after second write; `/cso` would flag |

**A9 is the most important assumption.** It re-interprets a locked CONTEXT decision (D-11-02) based on direct source-code evidence (`installLaunchd.ts:46` review). The planner SHOULD surface this as a Plan-Decision (or fold it back through `/gsd-discuss-phase` briefly) before execution. Failing to flag it risks shipping a snapshot mechanism that the user expected to live "in the plist."

## Open Questions (RESOLVED)

1. **Should the snapshot scheduler fire when the daemon first starts (even mid-day), or only at the next 03:00 boundary?**
   - What we know: D-11-02 says "one snapshot per ISO date." First-boot-fires-immediately + per-day uniqueness suggests checking whether `<today>.ndjson` exists; if missing, write immediately and re-arm.
   - What's unclear: Whether the user wants a "missed day" backfill (e.g., daemon was down all of yesterday).
   - Recommendation: First-boot-fires-immediately IF `<today>.ndjson` doesn't exist; never backfill historical missed days (consistent with D-11-02 "Acceptable gap: days the daemon isn't running are missing from history").
   - **RESOLVED:** scheduler fires immediately on first daemon boot of the day if no snapshot yet for today (idempotent — `2026-05-16.ndjson` exists check).

2. **Should `GET /api/coverage/history` include the actual transition timestamps (so SPA can render multiple ▲ + ▼ if both occurred), or only the most-recent transition?**
   - What we know: D-11-03 says "▲Nd / ▼Nd text indicator when state transition occurred in the last 14 days" — singular, not plural.
   - What's unclear: For a cell that went `fresh → stale → fresh` (e.g., 7d ago down, 2d ago up), is the indicator only `▲2d` or also `▼7d`?
   - Recommendation: **Only the most-recent transition** (whichever direction). Keeps the badge to one glyph. If the user needs richer history, that's the v1.2 sparkline (deferred).
   - **RESOLVED:** most-recent transition only (one `▲Nd` OR one `▼Nd` per cell, never both — show whichever is newer within the 14d window).

3. **What's the projectId format on the wire for the Skill drift response — registry id, or `family/repo` like CoverageHistory uses?**
   - What we know: Registry entries have `id` (slugified name). Coverage uses `family + repo`. These are different namespaces.
   - What's unclear: Whether Skill drift columns are keyed by registry id (matches the existing skills route at `/api/projects/:id/skills/local`) or `family/repo` (matches Coverage).
   - Recommendation: **Registry id** — Skill drift extends per-project skills which are already registered-project-scoped (matches Phase 5's API surface). Coverage drift is `family/repo` because Coverage is repo-discovery-scoped (`discoverRepos()` walks the family tree).
   - **RESOLVED:** projectId on the wire = registry entry id (the canonical id from `registry.json`, not the on-disk path).

4. **For the new POST route, should we return 200 with the AgentLinter result body, or 202 + a Location header (async) for long-running lint runs?**
   - What we know: Phase 5's GET route returns 200 synchronously even for fresh runs (no 202 today).
   - What's unclear: Whether the new POST should match the GET pattern or model itself differently for spawn-semantics clarity.
   - Recommendation: **200 + sync body** — matches Phase 5; 30s timeout means a fresh run is bounded. No async layer needed.
   - **RESOLVED:** 200 sync body (AgentLinter run is bounded to ~5s per project, do not need 202+polling for a single project).

## Sources

### Primary (HIGH confidence)

- `packages/agent/src/lib/coverageScan.ts` — Phase 10 orchestrator (read end-to-end) — confirms Promise.allSettled isolation pattern + InternalCoverageRow stripping
- `packages/agent/src/lib/skillsScan.ts` — Phase 5 `readLocalSkills` exists at line 133; consumed unchanged by Phase 11 aggregator
- `packages/agent/src/lib/agentLinterRunner.ts` + `agentLinterCache.ts` — both exist as named in CONTEXT; runner exports `runAgentLinter(projectRoot)`, cache exports `getAgentLinterCached` / `setAgentLinterCached` / `computeMaxMtime`
- `packages/agent/src/cli/installLaunchd.ts` — KEY EVIDENCE for A9: line 46 sets `KeepAlive=true` / `RunAtLoad=false`; no `StartCalendarInterval` exists today
- `packages/agent/src/cli/installSystemd.ts` — systemd unit (line 47) sets `Type=simple` + `Restart=on-failure`; also a long-running service, NOT a timer
- `packages/agent/src/server/app.ts` — middleware ordering confirmed; new routes mount at `app.route('/api', ...)` after existing `coverageRoute`
- `packages/spa/src/components/AppShellV2.tsx:49` — `<main>` has `overflow-y-auto`; confirms sticky-positioning scroll container
- `packages/spa/src/components/panels/coverage/CoverageRow.tsx:120` — literal `opacity-0` confirmed
- `packages/spa/src/components/ui/PageHeader.tsx` — current shape verified; no sticky support today
- `packages/spa/src/components/ui/Sidebar.tsx:68-74` — Coverage entry uses `SidebarItem` (not `SidebarSubItem`); peer pattern confirmed
- `packages/spa/src/components/panels/InlineDrift.tsx:1-30` — schema-drift panel; name collision real
- `packages/shared/src/schemas/coverage.ts` — existing schema; Phase 11 adds siblings, does NOT modify
- `packages/shared/src/index.ts:152-185` — barrel pattern verified
- `~/.agenticapps/dashboard/registry.json` (live machine) — confirmed `client: null` for every entry; family must derive from path

### Secondary (MEDIUM confidence)

- Node 20 `fs.appendFile` semantics — `mode` applies on creation only (POSIX `open(2)` behaviour, well-established) [CITED: Node official docs trained knowledge, confirmed by Pitfall 2 framing]
- `setTimeout` chain vs `setInterval` for daily ticks — DST-tolerant idiom common in distributed scheduler libraries (e.g. node-cron's internal implementation) [ASSUMED: based on training data; recommend planner reads the Node timers docs at plan time to confirm `.unref()` returns the timer]

### Tertiary (LOW confidence)

- AgentLinter cloud-upload defence relies on `--local` flag being present in argv — verified for Phase 5 at `agentLinterRunner.ts:103`, but the upstream behaviour of the binary (does `--local` actually suppress all cloud calls?) is a CITED claim from the existing test invariant T-05-02-AgentLinter-Local — Phase 11 inherits this trust unchanged.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep already in tree; no version drift, no missing primitives
- Architecture: HIGH for SPA patterns + schema sibling pattern; MEDIUM for in-process scheduler (greenfield, but small + testable)
- Trust boundary deltas: HIGH for AgentLinter widening (mirrors existing route exactly); HIGH for new write path (matches existing `~/.agenticapps/dashboard/` pattern but generalises mode policy from singletons to a directory tree)
- Cron mechanism: **MEDIUM** — A9 reinterprets a locked decision; planner must either adopt the recommendation or explicitly choose `StartCalendarInterval` (which the research evidence shows is incompatible with the existing `KeepAlive=true` plist)
- Pitfalls: HIGH — most are direct code-pattern observations; Pitfall 2 (mode-on-append) is the only one that requires explicit defensive code

**Research date:** 2026-05-16
**Valid until:** 2026-05-30 (14 days — stable surfaces; primary risk is upstream agentlinter package movement, which is locked by pnpm-lock until next refresh)
