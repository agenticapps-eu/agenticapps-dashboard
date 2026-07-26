# Phase 12: Observability Conformance Surface — Research

**Researched:** 2026-05-19
**Domain:** Cross-family fleet observability — conformance score primitive + pure-SVG trend chart + registry hygiene + responsive collapse
**Confidence:** HIGH on stack/patterns/pitfalls (codebase-grounded); MEDIUM-HIGH on 90-day window viability (depends on a Phase 11 retention bump that is NOT yet on disk — see §Risks #1)

## Summary

Phase 12 lands on top of a mature, well-tested code surface. Every primitive Phase 12 needs (`coverageScan` orchestrator, `coverageHistory` NDJSON store, `coverageHistoryCache` 1h memo pattern, `coverageHistoryRoute` Hono sibling-endpoint precedent, sticky `PageHeader`, `Toast`, `Tooltip`, `usePageHeaderHeight` ResizeObserver pattern, `atomicWriteFile` with O_NOFOLLOW + O_EXCL, `registerDisposer` boot registry) already exists and is exercised by tests. The shape of the new work is mostly composition of existing primitives — **not** new architecture.

The single load-bearing gotcha that planning MUST surface to the user: **the Phase 11 NDJSON store is configured at `RETENTION_DAYS = 14` (D-11-01)** — `packages/agent/src/lib/snapshots/snapshotPaths.ts:17`. CONTEXT.md commits to a 90-day x-axis (D-12-09) which the data store cannot supply. Either (a) Phase 12 must bump `RETENTION_DAYS` to 90 in Wave 0 (carrying the disk-cost + chmod re-test cost), OR (b) the chart caps at whatever history exists with the "Building 90-day trend — N more days of data needed" empty state (D-12-13) doing more work than CONTEXT acknowledged. This is the planner's single non-cosmetic gray-area to flag.

**Primary recommendation:** Use Wave 0 to (1) bump `RETENTION_DAYS` from 14 → 90 + re-validate the writer/pruner/reader test suites, (2) mint the `conformance.ts` shared schema, (3) spike a 30-LOC `FleetTrendChart` SVG render against a synthetic 90-day fixture to confirm the ≤120 LOC budget holds before Wave 3 commits. Defer no architectural choice past Wave 0; every decision after that is composition.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope + Sidebar IA**
- **D-12-01:** Sidebar IA — `Conformance` as 3rd entry under `Observability` (Coverage / Skill drift / Conformance). Matches user auto-memory `feedback_sidebar_section_architecture`. Locked.
- **D-12-02:** Route — sibling `/observability/conformance`, NOT widening Phase 5's `/observability` aggregator.

**Conformance score model**
- **D-12-03:** Equal-weighted % of green cells across the 4 Coverage columns (CLAUDE.md / GitNexus / Wiki / Workflow).
- **D-12-04:** Tier mapping — ≥90% green / 70–89% amber / <70% red.
- **D-12-05:** 0–100 integer score (no decimals).
- **D-12-06:** 3 family cards + 1 fleet aggregate.
- **D-12-07:** Drifted registry paths return `null` from scanner and are excluded from score denominator.

**Chart primitive**
- **D-12-08:** Pure-SVG `FleetTrendChart`, ≤120 LOC, no Recharts/Chart.js/D3. Planner may spike viability in Wave 0.
- **D-12-09:** 90-day x-axis window, fixed. (⚠ See §Risks #1 — current NDJSON retention is 14d.)
- **D-12-10:** 4 polylines — 3 family colors + 1 fleet-aggregate (heavier stroke, distinct token).
- **D-12-11:** Disclosure UX — hover + focus + keyboard reveal (no hover-only, touch-compatible).
- **D-12-12:** Y-axis 0–100%, gridlines at 0/25/50/75/100. X-axis daily ticks, label every ~14 days.
- **D-12-13:** Empty state — inline message when <14 days of history exists.

**Wire schema**
- **D-12-14:** Sibling endpoint `GET /api/observability/conformance`.
- **D-12-15:** New shared schema file `packages/shared/src/schemas/conformance.ts`. Barrel re-export.
- **D-12-16:** Response shape — bulk-per-family in a single payload:
  ```ts
  {
    today: { fleet, agenticapps, factiv, neuroflash, asOf: ISO },
    delta14d: { fleet, agenticapps, factiv, neuroflash },
    series: { date: ISO, fleet, agenticapps, factiv, neuroflash }[],  // 90 entries
    drifted: { id, storedPath, suggestedPath: string | null }[]
  }
  ```
- **D-12-17:** Daemon cache — `packages/agent/src/lib/conformanceCache.ts`, 30s TTL singleton.

**Registry path drift**
- **D-12-18:** Detector compares `registry.json` `<root>` paths against actual FS state. Flags (a) `existsSync` false, (b) `realpath` differs, (c) path inside family root but family no longer contains it. Runs daemon-side as part of `conformanceScan`.
- **D-12-19:** `POST /api/admin/registry/fix-path { id, newPath }`. Writes confined to `~/.agenticapps/dashboard/registry.json` (mode `0600`); idempotent; rejects newPath outside configured family roots.
- **D-12-20:** Drifted entries surface in a collapsible panel above the family cards. Toast feedback via Phase 11.1 `Toast` primitive.
- **D-12-21:** Suggested-path inference — best-effort: search family roots for a dir matching git origin remote (when `.git/config` readable). When inference fails, SPA prompts user to paste; NO auto-fix without confirmation.

**Coverage responsive collapse (carry-over)**
- **D-12-22:** New `useViewportBreakpoint` hook — ResizeObserver on `document.documentElement`, publishes `--vp-bp` CSS var (`xs`/`sm`/`md`/`lg`/`xl`). Lives at `packages/spa/src/lib/useViewportBreakpoint.ts`.
- **D-12-23:** `CoverageFamilySection` switches `<table>` → card-per-row under `xs:` breakpoint (<768px). 44×44 touch targets preserved.
- **D-12-24:** Responsive collapse applies to `/coverage` ONLY. `/observability/conformance` is desktop-first for v1.2.0.

**Cross-cutting reuse**
- **D-12-25:** Reuses Phase 10 `coverageScan` (extended with `aggregateByFamily`), Phase 11 NDJSON store (read-only), Phase 11.1 sticky `PageHeader` + `Toast`, Phase 5.1 status tokens, Phase 10.6 `gitNexusInstallState` (`not-installed` → 0-weight; `installed-no-registry` → counts as `missing`).

**Gates**
- **D-12-26:** `/cso` REQUIRED — new daemon write surface (registry mutation).
- **D-12-27:** Two-stage review — Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review` (NOT collapsed).
- **D-12-28:** `/qa` walkthrough on `/observability/conformance` covering trend chart, family cards (90/89/70/69 boundaries), fix-path flow, responsive collapse on `/coverage` at 767/768/1024px.
- **D-12-29:** `/impeccable critique` on `/observability/conformance` at 1440×900 → `12-IMPECCABLE.md` (calibration data point #5).

### Claude's Discretion

- Exact stroke weights / opacity for the 4 polylines.
- Per-day breakdown panel position (above/below chart, or anchored to hover position).
- Drift detector debounce / polling cadence (suggested 30s matching coverage cache).
- Suggested-path inference fallback wording when `.git/config` unreadable.
- Whether to fold Coverage `<768px` impeccable re-pass into Phase 12's artifact or punt to 12.x.
- Order of `Conformance` vs `Skill drift` under Observability section.
- Family-distinct chart-color tokens (if defined in Phase 5.1) vs planner-picked.

### Deferred Ideas (OUT OF SCOPE)

- **Per-skill conformance weighting** (fold skill drift into score) → v1.2.1+.
- **Per-project drill-down on the trend chart** (click polyline → repo-level overlay) → Coverage page covers per-repo state.
- **Export to CSV/PNG** → v1.3+.
- **Slack/email notifications on regression** → Phase 8 territory.
- **Custom per-project thresholds** → universal 90/70 for v1.2.0.
- **30/60/90 day toggle** → single 90-day window for v1.2.0.
- **Score decimals** (`87.3%` vs `87%`) → integers only.
- **Cross-family workflow upgrade orchestration** → separate phase if/when justified.
- **Conformance regression alerts in-dashboard** (red banner on drop >X in 24h) → v1.2.x.
- **Per-family chart-color customization** → planner picks from existing palette.

## Phase Requirements

> Phase requirement IDs to be minted during planning (CONTEXT.md gray-area resolution). Below is a proposed mapping from the 29 ratified decisions to REQ-12-NN IDs — the planner can adopt or revise. Working stem: `CON-*` (conformance score), `FCH-*` (fleet chart), `RPD-*` (registry path drift), `RVP-*` (responsive viewport).

| Proposed ID | Description | Decision anchor | Research support |
|---|---|---|---|
| REQ-12-CON-01 | New shared schema `conformance.ts` with `ConformanceScoreSchema` + `ConformanceResponseSchema` (D-12-16 shape). Barrel re-export from `packages/shared/src/index.ts`. | D-12-14, D-12-15, D-12-16 | §1 wire schema; §3 score formula |
| REQ-12-CON-02 | `lib/conformanceScore.ts` pure function: `computeConformanceScore(coverage: CoverageResponse, drifted: Set<string>) → Record<Family \| 'fleet', { green, amber, red, total, score }>`. Equal-weight per cell across 4 columns; drifted entries excluded from denominator (D-12-07). | D-12-03, D-12-05, D-12-07 | §3 |
| REQ-12-CON-03 | Tier mapping: ≥90 green / 70–89 amber / <70 red. Live in `lib/conformanceScore.ts` as `tierOf(score: number) → 'green' \| 'amber' \| 'red'`. | D-12-04 | §3 |
| REQ-12-CON-04 | Daemon route `GET /api/observability/conformance` returns bulk-per-family payload (D-12-16). Bearer-auth + CORS inherited. Outbound parse via `outbound()` wrapper. 30s cache via `conformanceCache.ts`. | D-12-14, D-12-17 | §5 |
| REQ-12-CON-05 | `conformanceScan` aggregator (in `coverageScan.ts` OR new `conformanceScan.ts`) reads NDJSON store via `snapshotReader` extension + computes per-family + fleet scores per day for the 90-day window. Drifted IDs excluded from per-day denominator. | D-12-06, D-12-07 | §2, §6 |
| REQ-12-FCH-01 | `FleetTrendChart.tsx` pure-SVG primitive, ≤120 LOC, no chart library. Props: `series: DayPoint[]`, `families: ('agenticapps' \| 'factiv' \| 'neuroflash')[]`, `ariaLabel: string`. | D-12-08, D-12-10 | §4 |
| REQ-12-FCH-02 | 90-day x-axis, daily tick marks, labels every 14 days (~7 labels). Y-axis 0–100 with gridlines at 0/25/50/75/100. Threshold rules at 70 (amber) and 90 (green). | D-12-09, D-12-12 | §4 |
| REQ-12-FCH-03 | Hover + focus + keyboard reveal of per-day breakdown panel. Touch-compatible. Mirrors Phase 11 D-11-02. | D-12-11 | §4 |
| REQ-12-FCH-04 | Empty state — inline "Building 90-day trend — N more days needed" when <14 days NDJSON exist. | D-12-13 | §4 |
| REQ-12-FCH-05 | A11y: `role="img" aria-label={...}` + sibling visually-hidden `<table>` (one row per day) for SR users. | D-12-11 | §4 |
| REQ-12-RPD-01 | Drift detector compares each `registry.json` entry against (a) `existsSync(root)`, (b) `realpath(root) === stored root`, (c) `root` is under one of `COVERAGE_ROOTS.{agenticapps,factiv,neuroflash}` (when stored prefix matched a family). Returns `PathDriftEntry[]`. | D-12-18 | §7 |
| REQ-12-RPD-02 | Suggested-path inference: when `.git/config` `remote.origin.url` is readable, scan family roots for a dir whose `.git/config` carries the same origin. Return `suggestedPath: string \| null`. Best-effort; never throws. | D-12-21 | §7 |
| REQ-12-RPD-03 | `POST /api/admin/registry/fix-path` route. Body `{ id: string, newPath: string }` (Zod). Validates: id in registry; newPath under one of family roots (via `COVERAGE_ROOTS` realpath); newPath realpath exists. Writes via `writeRegistry()` (already atomic + O_NOFOLLOW + mode 0o600). Returns updated entry. Bearer-auth + CORS inherited. Per-token-hash rate limit (10/10s) per Phase 1 A-01 pattern. | D-12-19, D-12-26 | §6 |
| REQ-12-RPD-04 | SPA `PathDriftPanel.tsx` collapsible panel above family cards. Per-entry: name + storedPath + suggestedPath (when present) + "Fix path" button + manual paste field (when no suggestion). Success/error via `Toast`. | D-12-20, D-12-21 | §11 |
| REQ-12-RVP-01 | `useViewportBreakpoint()` hook at `packages/spa/src/lib/useViewportBreakpoint.ts`. Returns `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`. Implementation: `window.matchMedia` per breakpoint + `useSyncExternalStore` (preferred over ResizeObserver — see §8). Also publishes `--vp-bp` CSS var as defence-in-depth. | D-12-22 | §8 |
| REQ-12-RVP-02 | `CoverageFamilySection` renders card-per-row layout under `xs:` breakpoint (<768px). Each card: repo name + 4 column status pills + actions row. 44×44 touch targets preserved per Phase 11.2 D-11.2-11/12. | D-12-23 | §9 |
| REQ-12-RVP-03 | Bounded scope — responsive collapse applies to `/coverage` only. `/observability/conformance` remains desktop-first. | D-12-24 | §9 |
| REQ-12-PAGE-01 | `/observability/conformance` route under `_appshell` layout in `router.tsx`. Lazy via `createLazyRoute`. `validateSearch: zodValidator` with optional `?date=ISO` for deep-link to specific day (defer if no use case). | D-12-02 | §11 |
| REQ-12-PAGE-02 | `ConformancePage.tsx` composes: sticky `PageHeader` + `PathDriftPanel` (when present) + `3× FamilyCard` row + `FleetTrendChart`. | D-12-01, D-12-25 | §11 |
| REQ-12-NAV-01 | Sidebar Observability section gains 3rd entry `Conformance`. Order: Coverage / Skill drift / Conformance (additive — preserves existing order). Uses `SidebarItem` primitive (peer pattern). | D-12-01 | §10 |
| REQ-12-IMP-01 | `12-IMPECCABLE.md` artifact at 1440×900 on `/observability/conformance` (composite ≥87 floor, calibration data point #5 for D-10.5-03). | D-12-29 | §12 |

## Project Constraints (from CLAUDE.md)

These directives govern Phase 12 work; the planner MUST verify compliance:

- **Read-only on project filesystems.** New daemon route `POST /api/admin/registry/fix-path` writes ONLY to `~/.agenticapps/dashboard/registry.json` — within the daemon-private home, NEVER touches any registered project's filesystem. INV-01 preserved.
- **Daemon writes confined to `~/.agenticapps/dashboard/`, mode 0600.** `writeRegistry()` already enforces this via `atomicWriteFile(..., 0o600)` + O_NOFOLLOW + O_EXCL (`packages/agent/src/lib/atomicWrite.ts:24-63`). Reuse — do NOT add a second write path.
- **No native dependencies in `packages/agent/`.** Drift detector + fix-path implementation must use only `node:fs`, `node:path`, `execa` (already approved). Concurrent-write protection comes from `atomicWriteFile`'s rename-after-fsync semantics + the in-process registry being read fresh on each route call — no `proper-lockfile` or similar.
- **Bearer-token auth on every route.** New `/api/observability/conformance` + `/api/admin/registry/fix-path` inherit the bearer middleware from `packages/agent/src/server/app.ts:104-115`. Mounted under existing `app.route('/api', ...)` calls — auth is structural.
- **CORS lock to `PROD_ORIGIN` + `DEV_ORIGIN`.** Inherited from `packages/agent/src/server/app.ts:90-98`. No per-route CORS.
- **Optional integrations stay optional.** N/A for Phase 12 (no Sentry/Linear/Infisical touch).
- **No Cloudflare Workers / Pages Functions in v1.** N/A — Phase 12 is daemon + static SPA.
- **`<N>-IMPECCABLE.md` artifact required.** D-12-29 + REQ-12-IMP-01 enforce.
- **GSD workflow.** discuss (DONE) → plan → execute → verify. TDD applies to every panel + daemon route. Two-stage review before merge.
- **Workflow commitment ritual.** Mandatory at session start.

## Standard Stack

### Core (already in workspace — Phase 12 ADDs NO new deps)

| Library | Version | Purpose | Why Standard | Source |
|---|---|---|---|---|
| `zod` | workspace pin | Shared-schema validation both ends | INV-04 single source of truth | `packages/shared/src/schemas/*` `[VERIFIED: codebase grep]` |
| `hono` | workspace pin | Daemon HTTP server | Phase 1 lock | `packages/agent/src/server/app.ts:3` `[VERIFIED]` |
| `@hono/zod-validator` | workspace pin | Body/query Zod validation | Used on every mutation route | `packages/agent/src/routes/registry.ts:3` `[VERIFIED]` |
| `react` 18 + `@tanstack/react-router` | workspace pin | SPA framework + router | Phase 2/5.1 lock | `packages/spa/src/router.tsx` `[VERIFIED]` |
| `@tanstack/react-query` | workspace pin | SPA polling/cache layer | Phase 2 lock | `packages/spa/src/lib/coverageQueries.ts` `[VERIFIED]` |
| `@tanstack/zod-adapter` | workspace pin | `validateSearch: zodValidator(...)` | Phase 7 router pattern | `packages/spa/src/router.tsx:11` `[VERIFIED]` |
| `lucide-react` | workspace pin | Icons (e.g. `LineChart`, `AlertTriangle` for sidebar entry + drift panel) | Phase 5.1 lock | `packages/spa/src/components/ui/Sidebar.tsx:16` `[VERIFIED]` |
| `execa` | workspace pin | Subprocess (for `.git/config` reads via `git config --get` — see §7) | Phase 1 lock | `packages/agent/src/lib/registry.ts:19` `[VERIFIED]` |
| `vitest` + `@testing-library/react` | workspace pin | Per-package test runners | Phase 0 lock | `packages/spa/src/components/panels/coverage/*.test.tsx` `[VERIFIED]` |

### Supporting (already in workspace)

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `node:fs/promises` | bundled | `realpath`, `stat`, `appendFile`, `chmod` | All drift detection + NDJSON reads |
| `node:os` | bundled | `homedir()` for resolving family roots | `COVERAGE_ROOTS.*()` factory |
| `node:path` | bundled | `join`, `resolve`, `relative` | Path math |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|---|---|---|---|
| Pure-SVG chart | `recharts` (~80KB gzip) | Battle-tested but exceeds zero-third-party-JS stance | **Pure-SVG** per D-12-08 (≤120 LOC budget) |
| Pure-SVG chart | `chart.js` (~60KB gzip + canvas) | Canvas loses SVG accessibility | **Pure-SVG** |
| `proper-lockfile` for concurrent registry writes | `atomicWriteFile()` rename+O_EXCL (existing) | proper-lockfile is pure-JS (no native dep) but adds a stat-loop dance; existing atomicWrite is already POSIX-atomic | **Existing atomicWriteFile** — race is bounded by O_EXCL + read-each-call (see §6) |
| `ResizeObserver` for breakpoint | `matchMedia` + `useSyncExternalStore` | RO fires on every pixel; matchMedia fires only on threshold crossings (cheaper, more accurate) | **matchMedia** (see §8) |

**Installation:** No new packages. Verify with `pnpm -r install --frozen-lockfile`. `[VERIFIED: codebase has all deps]`

## Architecture Patterns

### Recommended File Layout

```
packages/shared/src/schemas/
└── conformance.ts                              [NEW] — wire schema

packages/agent/src/
├── lib/
│   ├── conformanceCache.ts                     [NEW] — 30s TTL singleton (mirror coverageCache.ts)
│   ├── conformanceScan.ts                      [NEW] — aggregator: NDJSON → 90d series + drift detection
│   └── registryPathDrift.ts                    [NEW] — detector + suggested-path inference
└── routes/
    ├── conformance.ts                          [NEW] — GET /api/observability/conformance
    └── registryFixPath.ts                      [NEW] — POST /api/admin/registry/fix-path

packages/spa/src/
├── lib/
│   ├── useViewportBreakpoint.ts                [NEW] — matchMedia + useSyncExternalStore
│   └── conformanceQueries.ts                   [NEW] — useConformance() hook
├── components/
│   ├── panels/conformance/                     [NEW]
│   │   ├── ConformancePage.tsx
│   │   ├── ConformancePage.test.tsx
│   │   ├── FamilyCard.tsx
│   │   ├── FamilyCard.test.tsx
│   │   ├── FleetTrendChart.tsx
│   │   ├── FleetTrendChart.test.tsx
│   │   ├── PathDriftPanel.tsx
│   │   └── PathDriftPanel.test.tsx
│   ├── panels/coverage/
│   │   ├── CoverageFamilySection.tsx            [EDIT] — branch on viewport breakpoint
│   │   ├── CoverageFamilySectionMobile.tsx      [NEW] — card-per-row variant (or inline)
│   │   └── CoverageRow.tsx                      [EDIT] — pass through mobile/desktop variant
│   └── ui/Sidebar.tsx                           [EDIT] — add 3rd Observability entry
└── routes/
    └── observability.conformance.lazy.tsx       [NEW] — createLazyRoute('/observability/conformance')

packages/spa/src/lib/
└── conformanceScore.ts                          [NEW — OPTIONAL] — pure SPA-side helper if needed for client-side rendering decisions. Score is computed server-side per D-12-16; SPA only consumes scores.
```

**Note on D-12 score helper location:** CONTEXT.md mentions `lib/conformanceScore.ts`. Because the score is computed daemon-side and returned in the wire payload (D-12-16), the helper lives in `packages/agent/src/lib/conformanceScan.ts` (or a dedicated `conformanceScore.ts` next to it). SPA does NOT recompute the score; it only consumes the `today.{family}` / `series[].{family}` integers and runs `tierOf()` for color mapping. Recommend exporting `tierOf()` from `packages/shared/src/schemas/conformance.ts` so both ends agree.

### Pattern 1: Sibling-endpoint discipline (D-11-11 / D-12-02)

**What:** Every cross-cut surface gets its own route + schema file. NEVER widen an existing endpoint.

**When to use:** Any new aggregation that has a different cadence or consumer than an existing endpoint.

**Example (verified Phase 11):**
```ts
// Source: packages/agent/src/server/app.ts:135-137 [VERIFIED]
app.route('/api', coverageRoute)              // Phase 10
app.route('/api', coverageHistoryRoute)       // Phase 11 — SIBLING (NOT widening coverageRoute)
app.route('/api', skillDriftRoute)            // Phase 11 — SIBLING

// Phase 12 follows the same pattern:
app.route('/api', conformanceRoute)           // GET /api/observability/conformance
app.route('/api/admin', registryFixPathRoute) // POST /api/admin/registry/fix-path
```

### Pattern 2: 30s daemon cache singleton (Phase 10/11)

**What:** Module-scoped `let cache: T | null = null` + `getX()/setX()/invalidateX()/_resetXForTests()`.

**Source:** `packages/agent/src/lib/coverageCache.ts:1-60` `[VERIFIED]`

**Code shape** (Phase 12 `conformanceCache.ts`):
```ts
// packages/agent/src/lib/conformanceCache.ts (new)
import type { ConformanceResponse } from '@agenticapps/dashboard-shared'

export const TTL_MS = 30_000

interface CacheEntry { value: ConformanceResponse; expiresAt: number }
let cache: CacheEntry | null = null

export function getConformanceCache(now: number = Date.now()): ConformanceResponse | null {
  if (!cache || now >= cache.expiresAt) return null
  return cache.value
}

export function setConformanceCache(value: ConformanceResponse, now: number = Date.now()): void {
  cache = { value, expiresAt: now + TTL_MS }
}

export function invalidateConformanceCache(): void { cache = null }
export function _resetConformanceCacheForTests(): void { cache = null }
```

This is the exact shape of `coverageCache.ts` — copy-rename-retype.

### Pattern 3: NDJSON read via `snapshotReader` extension

**What:** Phase 12 reads the SAME NDJSON store Phase 11 writes. NEVER write.

**Source:** `packages/agent/src/lib/snapshots/snapshotReader.ts:99-168` `[VERIFIED]`

**Existing reader:** `readDriftForRepo(repoId)` — returns per-cell drift for ONE repo (bulk-per-repo).

**Phase 12 needs a sibling helper:** `readDailySeriesForFleet(now: Date): Promise<DailySeriesEntry[]>` — returns per-day per-family score arrays for the configured window. Lives in `packages/agent/src/lib/snapshots/snapshotReader.ts` (extends the file) OR a new `packages/agent/src/lib/snapshots/snapshotFleetReader.ts` if the planner prefers file-boundary discipline.

Algorithm sketch (≤80 LOC):

```ts
// Pseudo-code — extends snapshotReader.ts pattern
export interface DailySeriesEntry {
  date: string  // YYYY-MM-DD
  scores: Record<Family | 'fleet', number>  // 0-100 integer per family + fleet
}

export async function readDailySeriesForFleet(opts: {
  windowDays: number,         // 90 per D-12-09 (but see §Risks #1)
  driftedFamilyRepos: Set<string>,   // 'family/repo' strings to exclude
  dir?: string,
  now?: Date,
}): Promise<DailySeriesEntry[]> {
  // 1. readdirSync(dir).filter(isSnapshotFilename).sort()
  // 2. For each file (= one day):
  //    a. Read NDJSON, parse line-by-line (skip JSON.parse failures).
  //    b. last-record-wins per (date, family, repo) — Map.set semantics.
  //    c. For each family, count green cells / total non-NA cells across non-drifted repos.
  //    d. score = Math.round(green / total * 100); fleet = mean of 3 family scores (D-12-06).
  // 3. Return chronologically ordered array, length ≤ windowDays.
}
```

### Pattern 4: Outbound parse defence (INV-04)

**What:** Every route wraps its response through `outbound()` so schema drift surfaces as `500 schema_drift` rather than a leaked-shape `200`.

**Source:** `packages/agent/src/server/middleware/errors.ts:22-47` `[VERIFIED]`

**Code shape (Phase 12):**
```ts
return outbound(
  c,
  ConformanceResponseSchema.parse.bind(ConformanceResponseSchema),
  responseBody,
)
```

### Pattern 5: Sticky `PageHeader` (D-11-09 / PLI-01)

**What:** `<PageHeader sticky={true} title="..." helper="..." />` pins to top of `<main>` scroll container.

**Source:** `packages/spa/src/components/ui/PageHeader.tsx:46-67` `[VERIFIED]`

Phase 12 opts in:
```tsx
<PageHeader
  title="Fleet conformance"
  helper="How conformant every registered project is to the AgenticApps standard."
  sticky={true}
/>
```

### Pattern 6: Toast feedback (D-11.1-06..12)

**What:** `useToast().show({ message, variant: 'success' | 'error' })`. Single-slot replace semantics.

**Source:** `packages/spa/src/components/ui/Toast.tsx:39-52` `[VERIFIED]`. `ToastProvider` already wraps `AppShellV2` (`AppShellV2.tsx:31`) so `/observability/conformance` inherits the context.

### Anti-Patterns to Avoid

- **❌ Widening `CoverageResponseSchema` with conformance fields.** D-12-14 mandates a sibling endpoint. The 30s coverage cache must stay tight.
- **❌ Custom symlink-traversal helper.** Use existing `realpath` / `resolveAllowedNamed` / `assertRegistrationAllowed` patterns. Three independent symlink-escape guards exist (boot check at `boot.ts:84-116`, atomicWrite O_NOFOLLOW at `atomicWrite.ts:30`, `assertRegistrationAllowed` at `registry.ts:144-164`) — Phase 12 inherits all three.
- **❌ Hand-rolled lockfile or mutex.** Concurrent-write protection comes from `atomicWriteFile`'s rename-after-fsync (POSIX-atomic) + read-each-call semantics. See §6 for the race-analysis math.
- **❌ Per-(family, day) endpoint shape.** D-12-16 locks bulk-per-family. Mirrors PD-11-02 bulk-per-repo refinement.
- **❌ Hover-only chart disclosure.** D-12-11 requires focus + keyboard too. Touch devices (iPad-Tailscale) break otherwise.
- **❌ Hex literals in new components.** Phase 5.1 D-5.1-10 forbids — use status tokens (`text-status-success`, `text-status-warning`, `text-status-error`). `verify-contrast.test.ts` will fail any new tertiary-text hex.
- **❌ `setState` inside `useResizeObserver` without debounce.** ResizeObserver fires on every pixel of viewport change — see §8 for matchMedia preference.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Atomic JSON write to `registry.json` | Custom `fs.writeFile` + `fs.rename` | `atomicWriteFile()` at `lib/atomicWrite.ts:24` | Already implements O_EXCL + O_NOFOLLOW + fsync + rename + tmp-cleanup |
| Symlink-escape guard at boot | New realpath check | `assertSnapshotDirInDaemonHome()` at `server/boot.ts:98-116` | Already runs on every daemon start |
| Registry blocklist (system roots, secret dirs) | New blocklist | `assertRegistrationAllowed()` at `lib/registry.ts:144-164` | 18 system roots + 9 home secret dirs + CONFIG_DIR already covered |
| Bearer-auth middleware | Per-route check | `app.use(bearerAuth(...))` at `server/app.ts:104-115` | Constant-time compare + empty-token rejection already wired |
| CORS lock | Per-route CORS | `app.use(cors(...))` at `server/app.ts:90-98` | PROD_ORIGIN + DEV_ORIGIN already locked |
| Rate limiting | New limiter | `rlConsume(tokHash)` at `lib/rateLimiter.ts` + `tokenHashOf` | Sliding 10s/cap 10 per token hash — already applied to every registry-mutating route |
| Schema validation at SPA fetch boundary | `try { schema.parse(json) }` | `apiFetch(url, Schema)` with `parseOrDrift` wrapper | Returns `{ ok, data }` / `{ ok: false, drift: { path } }` — error becomes `'schema_drift:<path>'` |
| Tooltip / hover-reveal primitive for chart | Hand-roll a new wrapper | `Tooltip` at `components/ui/Tooltip.tsx` | Portal-based, fixed-position, scroll/resize remeasure, 100ms open delay, conditional aria-describedby |
| SVG sparkline / chart | Pull in `recharts`/`chart.js`/`d3` | Pure-SVG <120 LOC per D-12-08 | Phase 11 D-11-03 zero-third-party-JS stance |
| 30s daemon cache | New cache layer | Mirror `coverageCache.ts` pattern | 4 instances already in codebase (coverage, coverageHistory, agentLinter, overview) |
| `--ph-h` CSS var measurement | Manual ResizeObserver | `usePageHeaderHeight(ref)` at `components/ui/usePageHeaderHeight.ts:6-22` | Already invoked from `PageHeader.tsx:49` |
| Toast notifications | DOM event bus | `useToast()` at `components/ui/Toast.tsx:84-90` | `ToastProvider` wraps `AppShellV2` — context is universal |
| Schema-drift error UI | Custom panel | `SchemaDriftState` (existing component used by `CoveragePage.tsx:252-260`) | Reuse |
| Path-prefix matching family from a project root | Custom regex | `COVERAGE_ROOTS.{agenticapps,factiv,neuroflash}()` at `lib/paths.ts:147-152` | Factory pattern; realpath-applied in `resolveAllowedNamed` |
| Detecting current phase / last git commit per project | New code | `listProjectsWithStatus()` at `lib/registry.ts:336-353` | Already returns enriched entries with `currentPhase` + `lastCommitAt` |

**Key insight:** This phase is more composition than construction. Every primitive in the "Don't Hand-Roll" table is already used somewhere in the codebase and exercised by tests. The planner should treat new code as ≤ 30% of the diff; the rest is wiring.

## Runtime State Inventory

Phase 12 is **additive** — not a rename/refactor. It does, however, introduce one mutation surface (`POST /api/admin/registry/fix-path`) that edits an existing stored-state file. Verifying each runtime-state category:

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `~/.agenticapps/dashboard/registry.json` — Phase 12 MUTATES (via the new fix-path route). `~/.agenticapps/dashboard/coverage-history/<date>.ndjson` — Phase 12 READS (NEVER writes). | (1) Atomic write contract preserved via `writeRegistry()` → `atomicWriteFile()`. (2) Read path uses `snapshotReader` extension only. |
| Live service config | None — Phase 12 introduces no n8n / Datadog / Tailscale / Cloudflare state. The new sidebar entry is a static config in `Sidebar.tsx` (in-repo). | None — verified by file inspection. |
| OS-registered state | The launchd plist (`eu.agenticapps.dashboard.plist`) keeps the daemon alive. Phase 12 mounts new routes inside the same daemon — NO plist modification needed. PD-11-01 precedent. | None — verified by reading Phase 11 boot.ts. |
| Secrets/env vars | Bearer token in `~/.agenticapps/dashboard/auth.json` — Phase 12 reuses existing bearer middleware; no new env vars introduced. No SOPS / GitHub Actions secrets. | None. |
| Build artifacts / installed packages | No new pnpm deps. No native deps. SPA build output (CF Pages) gets a new route bundle (lazy-loaded). | None — `pnpm -r build` re-emits artifacts; deploy unchanged. |

**Nothing found in any category that requires data migration.** The fix-path route is a code-edit path, not a data-migration path — existing registry entries remain valid; the route only normalises paths the user explicitly clicks to fix.

## Common Pitfalls

### Pitfall 1: NDJSON retention is 14d, NOT 90d (THE big one)

**What goes wrong:** Phase 12 commits to a 90-day x-axis (D-12-09); the existing NDJSON store retains only 14 days (D-11-01, `RETENTION_DAYS = 14` at `snapshotPaths.ts:17`). Lazy pruning in `snapshotWriter.ts:75` unlinks files older than the window BEFORE each write.

**Why it happens:** Phase 11 sized retention to 14d for drift-window math (RESEARCH Q2). Phase 12 inherited "uses Phase 11 NDJSON store" without verifying retention matches the new chart's x-axis.

**How to avoid:** Wave 0 must bump `RETENTION_DAYS` from 14 → 90 in `snapshotPaths.ts`. This requires:
1. Re-running `snapshotWriter.test.ts` + `snapshotPruner.test.ts` + `snapshotReader.test.ts` (all in `packages/agent/src/lib/snapshots/`) — they assert 14-day boundaries that will need to be parameterised.
2. Confirming `CoverageHistoryResponseSchema` literal `windowDays: z.literal(14)` doesn't conflict — it doesn't (it's a Phase 11 drift-summary literal, separate from the snapshot retention window).
3. Disk-cost re-validation: 90 × ~42 rows × ~200 bytes ≈ 750 KB; trivial.
4. The 14-day pruner cutoff `dateStr < cutoffIso` (`snapshotPruner.ts:45`) becomes 90-day; no logic change beyond the constant.

**Warning signs:** A 90-day chart that only shows 14 points after the bump implies the data store didn't actually have older data to retain. This is **EXPECTED on day 0 of v1.2.0 deployment** — the empty state (D-12-13) covers it.

**Alternative if user pushes back:** Keep retention at 14d; cap the chart at 14 days; surface the empty state for the first 90 days of daemon uptime. Less ambitious but no data-loss risk during the bump.

### Pitfall 2: Score formula must handle `not-applicable` correctly

**What goes wrong:** Naïve `(green / total) * 100` would treat `not-applicable` cells as `missing`, suppressing scores when GitNexus is `not-installed` for an entire family.

**Why it happens:** Phase 10 introduced the 4-state vocabulary (`fresh` / `stale` / `missing` / `not-applicable`); Phase 10.6 split GitNexus into 3 install states where `not-installed` makes EVERY repo's GitNexus column `not-applicable`. If counted as `missing`, every family scores ~75% (3 of 4 columns max) and the gate is structurally unreachable.

**How to avoid:** Score formula explicitly excludes `not-applicable` from BOTH numerator AND denominator:

```ts
function computeFamilyScore(rows: CoverageRow[]): ConformanceScore {
  let green = 0, amber = 0, red = 0, total = 0
  for (const row of rows) {
    for (const cell of [row.claudeMd, row.gitNexus, row.wiki, row.workflowVersion]) {
      if (cell.state === 'not-applicable') continue  // exclude — column doesn't apply to this row
      total += 1
      if (cell.state === 'fresh') green += 1
      else if (cell.state === 'stale') amber += 1
      else if (cell.state === 'missing') red += 1
    }
  }
  const score = total === 0 ? 0 : Math.round((green / total) * 100)
  return { green, amber, red, total, score }
}
```

**Warning signs:** Family card shows 60-75% even when most cells are visibly green ✓ in `/coverage`. That's the GitNexus-not-installed denominator pollution.

**GitNexus state weighting (Claude's Discretion area):** Recommend the planner adopt this rule explicitly:
- `gitNexusInstallState === 'not-installed'` (page-level) → all GitNexus cells are `not-applicable` → excluded entirely
- `gitNexusInstallState === 'installed-no-registry'` → cells are `missing` (red) per existing scanner behaviour → counts AGAINST score
- `gitNexusInstallState === 'installed-with-registry'` → standard `fresh` / `stale` / `missing` rating → counted normally

This matches D-12-25 ("`installed-no-registry` → counts as `missing` for score") and CONTEXT.md's reading.

### Pitfall 3: Fleet aggregate weighting (family-equal vs sum-of-repos)

**What goes wrong:** "Average of 3 family scores" and "fraction of green cells across all 42 repos" give different numbers when families have different repo counts. CONTEXT.md says "equal-weighted families" (D-12-06) — the planner must ensure the daemon implements that, not the more obvious sum-over-all-rows formula.

**Why it happens:** Mathematical instinct is sum-of-all-cells; the spec intent is mean-of-three-family-scores.

**How to avoid:** Compute per-family scores first; fleet score is `Math.round((agenticapps + factiv + neuroflash) / 3)`. Test fixture: 3 families with 30/5/5 repos each — naïve sum gives the agenticapps-heavy weight; equal-weight gives the symmetric answer.

**Warning signs:** Fleet polyline tracks the agenticapps polyline closely instead of staying between the highest and lowest family.

### Pitfall 4: 90 daily ticks on ~720px width → label collision

**What goes wrong:** Rendering every day's date label produces unreadable overlap.

**How to avoid:** Render 90 daily tick MARKS (small vertical lines, ~1px tall, every day position) but only render TEXT labels every 14 days (≈7 labels at the recommended spacing). Anchor the 14-day cadence to the most-recent date so today's date always appears as the rightmost label.

```tsx
const TICK_EVERY = 1   // tick mark every day
const LABEL_EVERY = 14 // text label every 14 days (90/14 ≈ 6-7 labels)
const xs = days.map((_, i) => i * (chartWidth / (days.length - 1)))
// In render:
{days.map((day, i) => (
  <>
    <line x1={xs[i]} y1={chartHeight} x2={xs[i]} y2={chartHeight - 4} stroke="text-text-tertiary" />
    {(days.length - 1 - i) % LABEL_EVERY === 0 && (
      <text x={xs[i]} y={chartHeight + 16} textAnchor="middle" fontSize="11">{formatShort(day.date)}</text>
    )}
  </>
))}
```

### Pitfall 5: Touch-compatible hover requires three independent input paths

**What goes wrong:** `onMouseEnter` alone breaks on touch devices. Phase 11 D-11-02 mandates touch-compatible disclosure (Tailscale-from-iPad use case).

**How to avoid:** Wire FOUR input paths to the per-day reveal:
- `onMouseEnter` / `onMouseLeave` (desktop hover)
- `onFocus` / `onBlur` on a per-day invisible `<rect>` with `tabIndex={0}` (keyboard nav)
- `onPointerDown` (touch — falls back to mouse on desktop)
- `Escape` key closes (Phase 11.2 Tooltip pattern)

The simplest implementation is per-day invisible `<rect>` overlay with the four listeners, setting `hoverDay: number | null` state on the parent chart. Mirror `Tooltip.tsx:111-126` pattern.

### Pitfall 6: Registry write race during in-flight scans

**What goes wrong:** `POST /api/admin/registry/fix-path` writes registry while a concurrent `coverageScan` or `/api/registry` GET reads it; reader sees partial JSON.

**Why this is already safe:** `writeRegistry()` → `atomicWriteFile()` uses POSIX `rename()` which is atomic — concurrent readers see EITHER old or new file, never partial. `readRegistry()` opens a fresh fd on each call (no caching of file content). `scanCoverageInternal()` reads via `readRegistry()` (verified `lib/coverageHistoryRoute.ts:84`).

**Remaining gap:** Two concurrent fix-path POSTs from different tabs could last-write-wins. **Mitigation:** Apply the existing Phase 1 rate limiter (`rlConsume(tokHash)` — 10 req/10s/token-hash). Two simultaneous fix-path clicks become serialized with high probability; the user sees the same outcome either way (registry ends up with one of the two newPaths). If stricter ordering is needed in v1.2.x, add an in-process Mutex per CONFIG_DIR — but D-12-26 + rate limit are sufficient for v1.2.0 threat model.

### Pitfall 7: Symlink escape via `newPath`

**What goes wrong:** Attacker registers `~/Sourcecode/factiv/safe-project`, then POSTs fix-path with `newPath: '~/Sourcecode/factiv/symlink-to-etc'` where the symlink target escapes the family root. Subsequent `/api/projects/:id/read` would resolve under `/etc/.planning` if not guarded.

**How to avoid:** Use the SAME pattern Phase 10 uses for `COVERAGE_ROOTS`:
```ts
// In registryFixPath.ts handler:
const real = await realpath(body.newPath)   // follow symlinks
const familyRoots = await Promise.all(
  (['agenticapps', 'factiv', 'neuroflash'] as const).map(f => realpath(COVERAGE_ROOTS[f]()))
)
const insideFamily = familyRoots.some(r => real === r || real.startsWith(r + sep))
if (!insideFamily) return c.json({ ok: false, error: 'newPath_outside_family_roots' }, 422)
```

Additionally: `canonicaliseRoot(newPath)` is already realpath-via-realpathSync (`registry.ts:63-70`) — store the canonicalised root in the registry, not the user-supplied string. Plus `assertRegistrationAllowed(real)` defends against the system-root / secret-dir blocklist.

### Pitfall 8: SR users on the SVG chart

**What goes wrong:** `role="img" aria-label="trend chart"` is necessary but not sufficient — SR users get no way to read the 90 data points.

**How to avoid:** Render a sibling visually-hidden `<table>` (sr-only) with one row per day, columns = families + fleet. The SVG and table represent the same data; SR users get the table, sighted users get the SVG.

```tsx
<div role="img" aria-labelledby="chart-title" aria-describedby="chart-desc">
  <svg ...> {/* chart */} </svg>
  <table className="sr-only">
    <caption>Daily conformance scores by family for the last 90 days</caption>
    <thead><tr><th>Date</th><th>Fleet</th><th>agenticapps</th><th>factiv</th><th>neuroflash</th></tr></thead>
    <tbody>{series.map(d => <tr key={d.date}>...</tr>)}</tbody>
  </table>
</div>
```

### Pitfall 9: Coverage responsive collapse breaks `<colgroup>` width contract (Phase 11.1 IMP-01)

**What goes wrong:** Phase 11.1 IMP-01 asserted that all three CoverageFamilySection `<table>` elements render identical pixel widths per column via `<colgroup>` populated from `coverageColumns.ts`. The card-per-row mobile layout REPLACES the `<table>` entirely — Phase 11.1 invariants need a viewport guard or the assertion breaks at <768px.

**How to avoid:** Phase 11.1 test (`CoverageFamilySection.test.tsx`) asserting `<col>` className equality must be wrapped in a desktop-viewport guard (or use jsdom default ≥768px, which it does — confirm). New `CoverageFamilySectionMobile.test.tsx` (or the conditional branch test) asserts card semantics. Re-pass Phase 11.1 + 11.2 sticky-header tests at desktop viewport; mobile gets its own structural assertions.

**Tests to inspect for table-semantics assertions:**
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx` (3.6KB+, asserts `<table>` element + `<colgroup>` + sticky `<th>` semantics)
- `packages/spa/src/components/panels/coverage/CoverageRow.test.tsx` (asserts `<tr>` + `<td>` structure)
- `packages/spa/src/components/panels/coverage/CoveragePage.test.tsx` (composition test — already large at 31KB)

### Pitfall 10: ResizeObserver storms on `document.documentElement`

**What goes wrong:** `ResizeObserver` on `<html>` fires on every pixel of width change. Resizing the window triggers hundreds of `setState` calls — measurable in dev mode.

**How to avoid:** Use `window.matchMedia` per breakpoint + `useSyncExternalStore`. matchMedia fires ONLY on threshold crossings (5 events for 5 breakpoints over the entire drag, not 5000). See §8.

### Pitfall 11: TanStack Query stale-time mismatch

**What goes wrong:** Daemon cache is 30s (D-12-17); SPA `useConformance()` defaults to 0 staleTime → refetches on every focus/mount, stressing the daemon.

**How to avoid:** Set `staleTime: 30_000` to match. Mirror `coverageQueries.ts` (30s) NOT `coverageHistoryQueries.ts` (1h — that's a snapshot-cadence-aligned figure).

```ts
// packages/spa/src/lib/conformanceQueries.ts
export const CONFORMANCE_STALE_TIME_MS = 30_000  // match daemon cache TTL
```

## Code Examples

### Wire schema sketch (Phase 12 `conformance.ts`)

```ts
// packages/shared/src/schemas/conformance.ts (NEW)
// Source: mirrors packages/shared/src/schemas/coverageHistory.ts pattern [VERIFIED]
import { z } from 'zod'
import { CoverageFamilySchema } from './coverage.js'

/** Tier classification per D-12-04 — exported so SPA and daemon agree. */
export const ConformanceTierSchema = z.enum(['green', 'amber', 'red'])
export type ConformanceTier = z.infer<typeof ConformanceTierSchema>

export function tierOf(score: number): ConformanceTier {
  if (score >= 90) return 'green'
  if (score >= 70) return 'amber'
  return 'red'
}

/** 0-100 integer (D-12-05) — additional refinement at the wire layer. */
const ScoreSchema = z.number().int().min(0).max(100)

/** Per-day point — one entry per day in the 90-day window (D-12-09). */
export const ConformanceDayPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // YYYY-MM-DD (UTC)
  fleet: ScoreSchema,
  agenticapps: ScoreSchema,
  factiv: ScoreSchema,
  neuroflash: ScoreSchema,
}).strict()
export type ConformanceDayPoint = z.infer<typeof ConformanceDayPointSchema>

/** Drifted registry entry — surfaced on the conformance page (D-12-18..21). */
export const PathDriftEntrySchema = z.object({
  id: z.string(),                       // registry entry id
  storedPath: z.string(),               // value currently in registry.json
  suggestedPath: z.string().nullable(), // null when inference failed (D-12-21)
  reason: z.enum(['missing', 'symlink-target-changed', 'git-remote-changed']),
}).strict()
export type PathDriftEntry = z.infer<typeof PathDriftEntrySchema>

/** Bulk-per-family response (D-12-16). */
export const ConformanceResponseSchema = z.object({
  schemaVersion: z.literal(1),
  today: z.object({
    asOf: z.string().datetime(),
    fleet: ScoreSchema,
    agenticapps: ScoreSchema,
    factiv: ScoreSchema,
    neuroflash: ScoreSchema,
  }).strict(),
  delta14d: z.object({
    fleet: z.number().int(),       // signed delta in score points (-100..+100)
    agenticapps: z.number().int(),
    factiv: z.number().int(),
    neuroflash: z.number().int(),
  }).strict(),
  series: z.array(ConformanceDayPointSchema),  // 90 entries when full window; fewer when building
  drifted: z.array(PathDriftEntrySchema),
}).strict()
export type ConformanceResponse = z.infer<typeof ConformanceResponseSchema>

/** Fix-path request body. */
export const RegistryFixPathRequestSchema = z.object({
  id: z.string().min(1),
  newPath: z.string().min(1),
}).strict()
export type RegistryFixPathRequest = z.infer<typeof RegistryFixPathRequestSchema>
```

### Score primitive (Phase 12 `lib/conformanceScore.ts` daemon-side)

```ts
// packages/agent/src/lib/conformanceScore.ts (NEW)
import type { CoverageResponse, CoverageRow, CoverageFamily } from '@agenticapps/dashboard-shared'

export interface FamilyScore {
  green: number; amber: number; red: number; total: number; score: number
}

/**
 * Equal-weighted % of green cells across the 4 Coverage columns.
 * D-12-03 / D-12-05 / D-12-07: drifted entries excluded by caller (pre-filter `coverage.rows`).
 * Pitfall 2: not-applicable cells excluded from BOTH numerator and denominator.
 */
function scoreRows(rows: CoverageRow[]): FamilyScore {
  let green = 0, amber = 0, red = 0, total = 0
  for (const row of rows) {
    const cells = [row.claudeMd, row.gitNexus, row.wiki, row.workflowVersion]
    for (const cell of cells) {
      if (cell.state === 'not-applicable') continue
      total += 1
      if (cell.state === 'fresh') green += 1
      else if (cell.state === 'stale') amber += 1
      else if (cell.state === 'missing') red += 1
    }
  }
  const score = total === 0 ? 0 : Math.round((green / total) * 100)
  return { green, amber, red, total, score }
}

/**
 * D-12-06: 3 family cards + 1 fleet aggregate.
 * Pitfall 3: fleet = mean of 3 family scores (equal-weight families), NOT sum-of-all-cells.
 */
export function computeConformanceScores(
  coverage: CoverageResponse,
  driftedRepoIds: Set<string>,  // 'family/repo' strings from drift detector
): Record<CoverageFamily | 'fleet', FamilyScore> {
  const byFamily: Record<CoverageFamily, CoverageRow[]> = {
    agenticapps: [], factiv: [], neuroflash: [],
  }
  for (const row of coverage.rows) {
    const id = `${row.family}/${row.repo}`
    if (driftedRepoIds.has(id)) continue  // D-12-07 exclusion
    byFamily[row.family].push(row)
  }
  const families = (['agenticapps', 'factiv', 'neuroflash'] as const).reduce(
    (acc, fam) => ({ ...acc, [fam]: scoreRows(byFamily[fam]) }),
    {} as Record<CoverageFamily, FamilyScore>,
  )
  const fleetScore = Math.round(
    (families.agenticapps.score + families.factiv.score + families.neuroflash.score) / 3,
  )
  // Fleet green/amber/red rolled up from families (sum, not recomputed) for display only.
  const fleetTotals: FamilyScore = {
    green: families.agenticapps.green + families.factiv.green + families.neuroflash.green,
    amber: families.agenticapps.amber + families.factiv.amber + families.neuroflash.amber,
    red:   families.agenticapps.red   + families.factiv.red   + families.neuroflash.red,
    total: families.agenticapps.total + families.factiv.total + families.neuroflash.total,
    score: fleetScore,  // mean-of-family, NOT total green/total
  }
  return { ...families, fleet: fleetTotals }
}
```

### Daemon route (Phase 12 `routes/conformance.ts`)

```ts
// packages/agent/src/routes/conformance.ts (NEW)
// Source: mirrors packages/agent/src/routes/coverageHistory.ts pattern [VERIFIED]
import { Hono } from 'hono'
import { ConformanceResponseSchema } from '@agenticapps/dashboard-shared'

import { scanConformance } from '../lib/conformanceScan.js'
import { getConformanceCache, setConformanceCache } from '../lib/conformanceCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const conformanceRoute = new Hono<Env>()

conformanceRoute.get('/observability/conformance', async (c) => {
  // 30s cache short-circuit (D-12-17)
  const cached = getConformanceCache()
  const data = cached ?? await scanConformance()
  if (!cached) setConformanceCache(data)
  return outbound(c, ConformanceResponseSchema.parse.bind(ConformanceResponseSchema), data)
})
```

### Daemon route (Phase 12 `routes/registryFixPath.ts`)

```ts
// packages/agent/src/routes/registryFixPath.ts (NEW)
import { realpath } from 'node:fs/promises'
import { sep } from 'node:path'

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  RegistryEntrySchema,
  RegistryFixPathRequestSchema,
} from '@agenticapps/dashboard-shared'

import {
  readRegistry, writeRegistry, canonicaliseRoot,
  assertRegistrationAllowed, RegistrationPathBlocked,
} from '../lib/registry.js'
import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import { COVERAGE_ROOTS } from '../lib/paths.js'
import { invalidateConformanceCache } from '../lib/conformanceCache.js'
import { invalidateCoverageCache } from '../lib/coverageCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

function tokenFromAuthHeader(c: any): string | null {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice('Bearer '.length).trim()
}

export const registryFixPathRoute = new Hono<Env>()

registryFixPathRoute.post(
  '/registry/fix-path',
  zValidator('json', RegistryFixPathRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json({ ok: false, error: 'invalid_request' }, 422)
    }
  }),
  async (c) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    const token = tokenFromAuthHeader(c)
    const tokHash = token ? tokenHashOf(token) : 'no-token'

    // Rate limit (Phase 1 A-01 pattern — mirrors registry.ts:88-97)
    const rl = rlConsume(tokHash)
    if (!rl.allowed) {
      return c.json(
        { ok: false, error: 'rate_limited', requestId },
        429,
        { 'Retry-After': String(rl.retryAfter) },
      )
    }

    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined

    // 1. canonicalise newPath (follow symlinks once)
    const canonical = canonicaliseRoot(body.newPath)

    // 2. blocklist defence (system roots + secret dirs + CONFIG_DIR)
    try {
      assertRegistrationAllowed(canonical)
    } catch (err) {
      if (err instanceof RegistrationPathBlocked) {
        return c.json({ ok: false, error: 'newPath_blocked', reason: err.reason, requestId }, 422)
      }
      throw err
    }

    // 3. realpath family-root containment check (Pitfall 7)
    const familyRoots = await Promise.all(
      (['agenticapps', 'factiv', 'neuroflash'] as const).map(f => realpath(COVERAGE_ROOTS[f]())),
    )
    const insideFamily = familyRoots.some(r => canonical === r || canonical.startsWith(r + sep))
    if (!insideFamily) {
      return c.json({ ok: false, error: 'newPath_outside_family_roots', requestId }, 422)
    }

    // 4. mutate registry (atomic write under-the-hood via writeRegistry → atomicWriteFile)
    const reg = readRegistry(registryFile)
    const entry = reg.projects.find(p => p.id === body.id)
    if (!entry) return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
    entry.root = canonical
    writeRegistry(reg, registryFile)

    // 5. invalidate caches that derived from registry
    invalidateConformanceCache()
    invalidateCoverageCache()
    // Coverage history cache is per-repoId; no eviction needed unless repoId changes.

    return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), entry)
  },
)
```

### `useViewportBreakpoint` hook

```ts
// packages/spa/src/lib/useViewportBreakpoint.ts (NEW)
import { useSyncExternalStore } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Tailwind 4 default breakpoints
const BREAKPOINTS: Array<[Breakpoint, string]> = [
  ['xl', '(min-width: 1280px)'],
  ['lg', '(min-width: 1024px)'],
  ['md', '(min-width: 768px)'],
  ['sm', '(min-width: 640px)'],
  // xs is the fallback when no min-width matches
]

function current(): Breakpoint {
  if (typeof window === 'undefined') return 'lg' // safe SSR default (N/A — SPA only, but defensive)
  for (const [bp, query] of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return bp
  }
  return 'xs'
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const queries = BREAKPOINTS.map(([, q]) => window.matchMedia(q))
  for (const mq of queries) mq.addEventListener('change', callback)
  return () => {
    for (const mq of queries) mq.removeEventListener('change', callback)
  }
}

export function useViewportBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, current, () => 'lg')
}
```

Why `matchMedia` + `useSyncExternalStore` over ResizeObserver:
- `matchMedia.addEventListener('change', ...)` fires ONLY on threshold crossings, not every pixel.
- `useSyncExternalStore` is React 18's idiomatic external-store subscription with concurrent-rendering safety.
- No `setState` storms during resize drag — verified by Phase 11.1 `usePageHeaderHeight` regression class.

### FleetTrendChart sketch (target ≤120 LOC)

```tsx
// packages/spa/src/components/panels/conformance/FleetTrendChart.tsx (NEW)
// Source: pattern from CoverageDriftBadge.tsx (pure-SVG, no library) [VERIFIED]
import { useState } from 'react'
import type { ConformanceDayPoint, CoverageFamily } from '@agenticapps/dashboard-shared'

interface Props {
  series: ConformanceDayPoint[]   // 90 entries when full
  ariaLabel: string
}

const W = 720, H = 240, PAD = { top: 20, right: 16, bottom: 32, left: 36 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const FAMILY_KEYS = ['agenticapps', 'factiv', 'neuroflash'] as const
const FAMILY_STROKES: Record<CoverageFamily, string> = {
  agenticapps: 'stroke-status-info',
  factiv: 'stroke-status-warning',
  neuroflash: 'stroke-accent',
}

export function FleetTrendChart({ series, ariaLabel }: Props): React.JSX.Element {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const n = series.length
  if (n === 0) return <div className="text-text-tertiary">No history yet — empty state.</div>

  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * PLOT_W
  const y = (score: number) => PAD.top + (1 - score / 100) * PLOT_H

  const polyline = (key: keyof ConformanceDayPoint) =>
    series.map((d, i) => `${x(i)},${y(d[key] as number)}`).join(' ')

  return (
    <div role="img" aria-label={ariaLabel} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Gridlines + threshold rules */}
        {[0, 25, 50, 75, 100].map(v => (
          <line key={v} x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
                className={v === 70 || v === 90 ? 'stroke-border-subtle' : 'stroke-border-subtle/50'}
                strokeDasharray={v === 70 || v === 90 ? '4 4' : undefined} />
        ))}
        {/* Polylines */}
        {FAMILY_KEYS.map(fam => (
          <polyline key={fam} points={polyline(fam)} fill="none"
                    className={FAMILY_STROKES[fam]} strokeWidth={1.5} />
        ))}
        <polyline points={polyline('fleet')} fill="none"
                  className="stroke-text-primary" strokeWidth={2.5} />
        {/* Daily tick marks (90 small lines), labels every 14 days */}
        {series.map((d, i) => (
          <g key={d.date}>
            <line x1={x(i)} y1={H - PAD.bottom} x2={x(i)} y2={H - PAD.bottom + 4}
                  className="stroke-text-tertiary" />
            {(n - 1 - i) % 14 === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10}
                    className="fill-text-tertiary">{d.date.slice(5)}</text>
            )}
            {/* Invisible focus/hover overlay for per-day reveal */}
            <rect x={x(i) - PLOT_W / (n * 2)} y={PAD.top} width={PLOT_W / n} height={PLOT_H}
                  fill="transparent" tabIndex={0}
                  aria-label={`${d.date} — fleet ${d.fleet}%`}
                  onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                  onFocus={() => setHoverIdx(i)} onBlur={() => setHoverIdx(null)} />
          </g>
        ))}
        {/* Y-axis labels */}
        {[0, 50, 100].map(v => (
          <text key={v} x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10}
                className="fill-text-tertiary">{v}</text>
        ))}
      </svg>

      {/* Per-day breakdown panel (D-12-11) — Claude's Discretion on positioning */}
      {hoverIdx !== null && (
        <div className="absolute top-0 right-0 bg-card-bg border border-border-subtle rounded-md p-3 shadow-card text-sm">
          <div className="font-semibold">{series[hoverIdx]!.date}</div>
          <div>Fleet: <strong>{series[hoverIdx]!.fleet}%</strong></div>
          <div>agenticapps: {series[hoverIdx]!.agenticapps}%</div>
          <div>factiv: {series[hoverIdx]!.factiv}%</div>
          <div>neuroflash: {series[hoverIdx]!.neuroflash}%</div>
        </div>
      )}

      {/* SR-only table — Pitfall 8 */}
      <table className="sr-only">
        <caption>Daily fleet conformance scores (last {n} days)</caption>
        <thead><tr><th>Date</th><th>Fleet</th><th>agenticapps</th><th>factiv</th><th>neuroflash</th></tr></thead>
        <tbody>{series.map(d => (
          <tr key={d.date}><td>{d.date}</td><td>{d.fleet}</td><td>{d.agenticapps}</td><td>{d.factiv}</td><td>{d.neuroflash}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
```

LOC budget: ~105 LOC including imports + the SR table. Inside D-12-08's ≤120 budget with margin. **Planner should still spike a working render against a synthetic 90-day fixture in Wave 0** before committing.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Phase 5.1's pre-AppShellV2 chrome | AppShellV2 grid (`240px sidebar + 1fr main`) | Phase 5.1 | Phase 12 inherits — new route lives under `_appshell` layout |
| Phase 10 boolean `gitNexusInstalled` | 3-state `gitNexusInstallState` enum | Phase 10.6 | Phase 12 score formula must handle `not-installed` → exclude entire column |
| Phase 11 per-(repo, cell) drift endpoint | PD-11-02 bulk-per-repo | Phase 11 | Phase 12 mirrors — bulk-per-family in single payload |
| Phase 11 CI-enforced impeccable gate | Per-phase `<N>-IMPECCABLE.md` artifact | Phase 10.5 (D-10.5-01..02) | Phase 12 produces `12-IMPECCABLE.md` (calibration #5) |
| Phase 6's `--ph-h` first-paint hardcode | `usePageHeaderHeight` ResizeObserver-published var | Phase 11.1 | Phase 12 reuses verbatim |
| Phase 5.1's `--color-text-tertiary` at 2.8:1 | v1.1 at 4.86:1 | Phase 11.1 D-11.1-14 | Phase 12 inherits — `verify-contrast.test.ts` defends against regression |
| Phase 10's last-write-wins refresh state | Phase 11.2 `inFlightRefreshes: ReadonlySet<string>` | Phase 11.2 | Phase 12's PathDriftPanel SHOULD reuse same Set pattern for concurrent fix-path clicks |
| Phase 11's per-family install hint | Phase 10.6 hint inside `CoverageFamilySection` | Phase 10.6 | Phase 12 path-drift panel uses similar inline-affordance pattern |

**Deprecated/outdated:**
- `npx impeccable critique` CLI (removed in v2.1.8 per D-10.5-01). The phase artifact comes from the `impeccable:critique` skill, not a CLI.

## Assumptions Log

> Claims in this research that were not directly verified against running tests or live behaviour. The planner and discuss-phase use this to confirm before commit.

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Bumping `RETENTION_DAYS` from 14 → 90 has no cascading impact beyond updating constants in `snapshotPaths.ts` and corresponding test fixtures. | Pitfall 1 | If `CoverageHistoryResponseSchema.windowDays: z.literal(14)` is structurally tied to retention, the bump cascades into a schema bump (schemaVersion: 2). `[ASSUMED — partial verification: literal lives in `coverageHistory.ts:54`, but its semantic is "drift summary window", not "retention" — bumping retention should NOT cascade. Recommend planner verify by reading Phase 11 RESEARCH §"NDJSON store shape".]` |
| A2 | Per-family chart-color tokens are NOT defined in Phase 5.1's tokens.css; planner will pick from `text-status-info`, `text-status-warning`, `text-accent` palette. | Pattern 1, FleetTrendChart sketch | If Phase 5.1 actually defines family-distinct tokens elsewhere, FleetTrendChart should use those for consistency. `[ASSUMED — verified absence in `tokens.css` (no family-keyed colors), but a planner-level review of Phase 5.1's RESEARCH could surface alternative token namespaces.]` |
| A3 | `proper-lockfile` or in-process Mutex is NOT required for the fix-path race; rate-limiter + atomicWrite is sufficient. | Pitfall 6 | If two-tab simultaneous fix-path clicks need stronger ordering than "last-write-wins within rate-limit window", a Mutex would be a small addition. `[ASSUMED — based on Phase 1 D-13/14/15 atomicWrite contract; threat model from `/cso` may strengthen.]` |
| A4 | The 30s daemon cache is appropriate for conformance — matches coverage cache cadence; 1h (the snapshot-cadence figure) would make path-drift fixes visibly slow to reflect. | D-12-17 ratification | If user wants instant reflection after fix-path, the cache invalidation on POST is already wired (Pitfall 6 example); 30s cache stays fine. `[VERIFIED: D-12-17 explicit; cache invalidate-on-mutate pattern verified in `coverage.ts` refresh route.]` |
| A5 | `MOUTH OF the 90 days × 5 numbers ≈ 9KB` from CONTEXT.md is plausible: 90 entries × (10-byte ISO date + 4×3-byte ints + 4 commas + brackets) ≈ 90 × 40 = 3.6KB; with PathDriftEntry array overhead, ~5-9KB. Well under 30s daemon-cache budget. | D-12-16 ratification | None — payload size is small. `[VERIFIED: arithmetic; gzip would compress further.]` |
| A6 | `matchMedia` + `useSyncExternalStore` is the right primitive vs. ResizeObserver for `useViewportBreakpoint`. | §8, Pattern §useViewportBreakpoint | If `--vp-bp` CSS var publishing requires per-pixel tracking (CONTEXT mentions ResizeObserver), the implementation diverges. `[ASSUMED — recommendation; CONTEXT D-12-22 mentions ResizeObserver but acceptable to deviate if matchMedia is functionally superior. Surface to user if ambiguous.]` |
| A7 | The existing `assertRegistrationAllowed` blocklist (18 system roots + 9 secret dirs + CONFIG_DIR) is sufficient for `newPath` validation in fix-path. | Pitfall 7 | If `/cso` raises new threat vectors specific to fix-path (e.g. registry-to-itself loops), additional guards may be needed. `[VERIFIED: blocklist is comprehensive at `registry.ts:91-132`; reuse is sound.]` |
| A8 | Family-equal fleet aggregate (mean of 3 family scores, NOT sum-over-rows) is what D-12-06 intends. | Pitfall 3 | If user actually meant sum-over-rows ("the percentage of green cells across the WHOLE fleet"), the formula changes — heavy-family families (agenticapps with ~24 repos) would dominate. `[ASSUMED — CONTEXT's "3 family cards + 1 fleet aggregate" reads as equal-weight; specifics §1 mentions equal-weight; surface to discuss-phase if planner wants final confirmation.]` |
| A9 | The drift panel's "Fix path" action should NOT auto-confirm without user click — D-12-21 says "no auto-fix without user confirmation". | §7, REQ-12-RPD-04 | If user wants one-click batch-fix-all (rare given confirmation requirement), UI affordance changes. `[VERIFIED: D-12-21 explicit "no auto-fix without user confirmation"]` |

## Open Questions

1. **NDJSON retention bump 14 → 90:** Should this be a Wave 0 task inside Phase 12, or pre-merged as a Phase 11.3 micro-PR before Phase 12 work begins?
   - **What we know:** Retention is currently 14 (`snapshotPaths.ts:17`); 90-day chart needs 90.
   - **What's unclear:** Whether bumping retention requires a `schemaVersion: 2` bump on `CoverageHistoryResponseSchema` (likely not — the literal is for drift-window math, not retention) or test-fixture rewrites in `snapshotWriter.test.ts` / `snapshotPruner.test.ts` (definitely yes).
   - **Recommendation:** Treat as Wave 0 task; deliverable is `RETENTION_DAYS: 14 → 90` + updated snapshot test fixtures + a `gsd-verify` smoke pass on `pnpm --filter @agenticapps/dashboard-agent test`.

2. **Per-day breakdown panel position:** D-12-11 + Claude's Discretion. Above chart, below chart, or anchored to hover position?
   - **What we know:** Touch-compatibility precludes pure hover-only; the panel needs a stable focus position.
   - **Recommendation:** Anchored above the chart top-right (matches Phase 11.2 Tooltip portal pattern). Avoids covering the data. If impeccable critique flags it, fall back to below-chart for v1.2.x.

3. **Sidebar order — Conformance before or after Skill drift:** D-12-01 locks the slot but not the order within Observability.
   - **What we know:** Coverage is first (entry-point view).
   - **Recommendation:** Coverage → Conformance → Skill drift. Reasoning: Conformance is the second-most-headline cross-family surface (rolled-up "how are we doing"); Skill drift is a more specialised investigation tool. The "headline-then-detail" gradient reads naturally.

4. **`useViewportBreakpoint` implementation choice:** CONTEXT D-12-22 mentions ResizeObserver; this research recommends matchMedia + useSyncExternalStore for performance reasons.
   - **What we know:** Both work; matchMedia is cheaper and fires only on threshold crossings.
   - **Recommendation:** matchMedia. Defer the `--vp-bp` CSS var publishing to a useEffect that sets `document.documentElement.style.setProperty('--vp-bp', bp)` whenever the breakpoint changes — gives defence-in-depth for Tailwind's responsive utilities. Spike in Wave 0 to confirm RO-fallback isn't needed for any consumer.

5. **Coverage responsive collapse impeccable re-pass folded into Phase 12 or punted to 12.x?**
   - **What we know:** D-12-29 + CONTEXT.md says "folds into the same artifact if time permits — else deferred to a Phase 12.x bundle."
   - **Recommendation:** Plan for Wave 5 = responsive collapse + Wave 6 = gates; the impeccable critique runs against /observability/conformance primarily, with a 5-minute /coverage <768px screenshot pass appended. If the screenshot reveals P1s on Coverage mobile, those open as a follow-up phase. Don't gate Wave 6 on Coverage-mobile composite ≥87.

## Environment Availability

Phase 12 is a code-only delta to an existing codebase. No new external tools, runtimes, or services required.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | daemon + SPA build | ✓ (workspace) | 20+ LTS | — |
| pnpm | workspace tooling | ✓ (workspace) | workspace pin | — |
| `git` (CLI) | suggested-path inference via `.git/config` read | ✓ (system) | any modern | `existsSync(.git/config)` + `readFile` parse fallback if execa fails |
| Tailscale | (only for remote-device QA on /qa walkthrough) | depends on user setup | — | dev server + matching origin allowance |
| `~/.agenticapps/dashboard/registry.json` | fix-path mutation target | ✓ (created on first daemon boot) | — | `ensureRegistryFile()` lazy-creates |
| `~/.agenticapps/dashboard/coverage-history/` | NDJSON read | ✓ (created by Phase 11 snapshot writer on first tick) | — | empty state (D-12-13) covers cold-start |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `git` CLI for `.git/config` read — fallback to direct `readFile('.git/config')` + regex match.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | `vitest` (workspace pin) + `@testing-library/react` + `jsdom` |
| Config file | `packages/{shared,spa,agent}/vitest.config.ts` (per-package) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-spa test`<br>`pnpm --filter @agenticapps/dashboard-agent test`<br>`pnpm --filter @agenticapps/dashboard-shared test` |
| Full suite command | `pnpm -r test` (160+ tests as of Phase 1 close — Phase 11 raised it materially) |
| Phase gate | Full suite green before `/gsd-verify-work`; `12-IMPECCABLE.md` composite ≥87 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| REQ-12-CON-01 | Conformance schema round-trips through Zod (valid + invalid + .strict() extra-key rejection) | unit | `pnpm --filter @agenticapps/dashboard-shared test schemas/conformance` | ❌ Wave 0 |
| REQ-12-CON-02 | `computeConformanceScores` returns equal-weight per cell, excludes drifted IDs, excludes not-applicable | unit | `pnpm --filter @agenticapps/dashboard-agent test conformanceScore` | ❌ Wave 0 |
| REQ-12-CON-03 | `tierOf()` maps 89→amber, 90→green, 69→red, 70→amber at boundaries | unit | (same file as above) | ❌ Wave 0 |
| REQ-12-CON-04 | `GET /api/observability/conformance` returns valid response, 30s cache works, schema-drift surfaces as 500 | integration | `pnpm --filter @agenticapps/dashboard-agent test conformance.route` | ❌ Wave 1 |
| REQ-12-CON-05 | `conformanceScan` aggregator reads NDJSON, computes 90-day series, excludes drifted | integration | `pnpm --filter @agenticapps/dashboard-agent test conformanceScan` | ❌ Wave 1 |
| REQ-12-FCH-01 | `FleetTrendChart` renders 4 polylines + gridlines + threshold rules at 70 & 90 | unit | `pnpm --filter @agenticapps/dashboard-spa test FleetTrendChart` | ❌ Wave 3 |
| REQ-12-FCH-02 | Daily ticks + labels every 14 days; y-axis 0-100 | unit | (same) | ❌ Wave 3 |
| REQ-12-FCH-03 | Hover + focus + keyboard reveal works on per-day rects | unit + a11y | (same) | ❌ Wave 3 |
| REQ-12-FCH-04 | Empty state renders "N more days needed" when series.length < 14 | unit | (same) | ❌ Wave 3 |
| REQ-12-FCH-05 | sr-only `<table>` mirrors SVG data; `role="img"` + aria-label present | a11y | (same) | ❌ Wave 3 |
| REQ-12-RPD-01 | Drift detector flags missing path, changed-symlink, changed-realpath | unit | `pnpm --filter @agenticapps/dashboard-agent test registryPathDrift` | ❌ Wave 1 |
| REQ-12-RPD-02 | Suggested-path inference reads `.git/config` origin, matches family root, falls back to null | unit | (same) | ❌ Wave 1 |
| REQ-12-RPD-03 | `POST /api/admin/registry/fix-path` validates body, rejects outside-family-roots, mutates atomically, rate-limited, evicts caches | integration + security | `pnpm --filter @agenticapps/dashboard-agent test registryFixPath.route` | ❌ Wave 2 |
| REQ-12-RPD-04 | `PathDriftPanel` renders entries, "Fix path" button POSTs correctly, success/error toast wired | unit | `pnpm --filter @agenticapps/dashboard-spa test PathDriftPanel` | ❌ Wave 3 |
| REQ-12-RVP-01 | `useViewportBreakpoint` returns correct bp when matchMedia mocked at boundary widths; subscribes/unsubscribes | unit | `pnpm --filter @agenticapps/dashboard-spa test useViewportBreakpoint` | ❌ Wave 0 |
| REQ-12-RVP-02 | `CoverageFamilySection` renders `<table>` under `lg`, card layout under `xs` | unit | `pnpm --filter @agenticapps/dashboard-spa test CoverageFamilySection.responsive` | ❌ Wave 5 |
| REQ-12-RVP-03 | Card layout preserves 44×44 touch targets, all 4 columns visible as pills | unit | (same) | ❌ Wave 5 |
| REQ-12-PAGE-01 | `/observability/conformance` route registers, lazy-loads | unit | `pnpm --filter @agenticapps/dashboard-spa test router` | ❌ Wave 4 |
| REQ-12-PAGE-02 | `ConformancePage` composes header + drift panel + 3 family cards + chart; loading + error + empty states | integration | `pnpm --filter @agenticapps/dashboard-spa test ConformancePage` | ❌ Wave 4 |
| REQ-12-NAV-01 | Sidebar Observability section has 3 entries in correct order | unit | `pnpm --filter @agenticapps/dashboard-spa test Sidebar` (extends existing) | ❌ Wave 4 |
| REQ-12-IMP-01 | `/observability/conformance` composite ≥87 at 1440×900 | manual (/impeccable skill) | n/a — runs in Claude session, not vitest | ❌ Wave 6 |
| Security: traversal in `newPath` | path traversal `../..` rejected as `outside_family_roots` | security | `pnpm --filter @agenticapps/dashboard-agent test registryFixPath.route` | ❌ Wave 2 |
| Security: symlink escape | symlink in `newPath` pointing outside family root rejected | security | (same) | ❌ Wave 2 |
| Security: concurrent write race | two simultaneous POSTs rate-limit one, both produce coherent registry | integration | (same) | ❌ Wave 2 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @agenticapps/dashboard-{agent,spa,shared} test <changed-file-glob>` (~5-20s)
- **Per wave merge:** `pnpm -r test` + `pnpm -r typecheck` (~2-3 min)
- **Phase gate:** Full suite + `12-IMPECCABLE.md` artifact committed + Stage 1/2 review PASS + `/cso` PASS + `/qa` walkthrough PASS

### Wave 0 Gaps

- [ ] `packages/shared/src/schemas/conformance.ts` + `conformance.test.ts` — REQ-12-CON-01
- [ ] `packages/agent/src/lib/conformanceScore.ts` + `conformanceScore.test.ts` — REQ-12-CON-02, -03
- [ ] `packages/agent/src/lib/snapshots/snapshotPaths.ts` — `RETENTION_DAYS: 14 → 90` (Pitfall 1)
- [ ] Re-run `snapshotPruner.test.ts` + `snapshotWriter.test.ts` + `snapshotReader.test.ts` with bumped retention — parameterise test fixtures where 14 is hardcoded
- [ ] `packages/spa/src/lib/useViewportBreakpoint.ts` + `useViewportBreakpoint.test.ts` — REQ-12-RVP-01
- [ ] Spike `FleetTrendChart.tsx` against a synthetic 90-day fixture — confirm ≤120 LOC; if exceeded, escalate before Wave 3

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Bearer token (Phase 1 D-13..15) — inherited via `app.use(bearerAuth(...))`; no per-route check |
| V3 Session Management | yes | 30-day token rotation (AUTH-04) — Phase 12 inherits |
| V4 Access Control | yes | CORS lock to PROD_ORIGIN + DEV_ORIGIN (Phase 1 AUTH-02) — inherited |
| V5 Input Validation | yes | Zod at every wire boundary; `RegistryFixPathRequestSchema` `.strict()` rejects extra keys |
| V6 Cryptography | no | Phase 12 introduces no crypto — bearer compare uses existing `timingSafeEqual` in app.ts |
| V8 Data Protection | yes | Registry file mode 0600; atomicWrite O_NOFOLLOW + O_EXCL; coverage-history dir mode 0700 |
| V12 Files & Resources | yes | Path traversal + symlink escape: `realpath` family-root containment check; `assertRegistrationAllowed` blocklist; `atomicWriteFile` O_NOFOLLOW |
| V14 Configuration | yes | All daemon writes confined to `~/.agenticapps/dashboard/` (CLAUDE.md hard constraint); refuses to start if perms looser (Phase 1 boot check) |

### Known Threat Patterns for Phase 12

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Path traversal in `newPath` (`../../../etc/foo`) | Tampering / Info-disclosure | `realpath` → containment in COVERAGE_ROOTS family realpaths |
| Symlink escape via planted `newPath` symlink | Tampering / Info-disclosure | `realpath` follow + family-root prefix check (Pitfall 7) |
| Concurrent fix-path → torn registry write | Tampering / DoS | `atomicWriteFile` POSIX rename atomicity + rate-limiter (10/10s/token) |
| Registry corruption via JSON injection in `newPath` | Tampering | Zod-string validation (no special chars in path); `JSON.stringify(reg, null, 2)` writes by value |
| Symlink swap between read and write (TOCTOU) | Tampering | `realpathSync` resolves once before validation; `O_NOFOLLOW` in atomicWrite refuses planted tmp symlinks |
| Token leak via verbose error | Info-disclosure | `errorHandler` already `NODE_ENV`-gates verbosity (D-06); 422 / 429 responses carry no token data |
| Force-register a system root via fix-path | Tampering / Privilege | `assertRegistrationAllowed` blocklist (18 system roots + 9 secret dirs + CONFIG_DIR) — already invoked by `addProject`; fix-path route re-invokes |
| DoS via repeated fix-path | Availability | Rate-limiter sliding 10s/cap 10 per token hash |
| CSRF on fix-path | Spoofing | CORS lock + Bearer auth + non-cookie auth — CSRF surface is structurally absent |
| Information disclosure via drift detector output | Info-disclosure | `PathDriftEntrySchema` returns only registry-public fields (id, storedPath, suggestedPath); no `git remote.origin.url` value leaked (only the path it resolved to) |
| Suggested-path inference reads outside expected scope | Info-disclosure | Inference helper only reads `.git/config` under family roots — uses `resolveAllowedNamed({ roots: familyRoots, allowedNames: ['config'] })` |
| Race between drift detection and registration | Tampering | Drift detector is read-only; race window between detection and fix-path POST is bounded by 30s cache + user click latency — no exploit surface |

**/cso REQUIRED (D-12-26).** This phase introduces a daemon mutation surface. The threat model above is the starting point — `/cso` will surface additional vectors (e.g. registry-self-mutation loops, fix-path of an in-use registered project during a scan).

## Sources

### Primary (HIGH confidence — codebase-verified)
- `packages/shared/src/schemas/coverage.ts:1-123` — `CoverageResponse`, `CoverageRowSchema`, `CoverageStateSchema`, `GitNexusInstallStateSchema`, `CoverageFamilySchema` `[VERIFIED]`
- `packages/shared/src/schemas/coverageHistory.ts:1-65` — Phase 11 drift-summary schema `[VERIFIED]`
- `packages/agent/src/lib/snapshots/snapshotPaths.ts:1-54` — `RETENTION_DAYS = 14`, `isSnapshotFilename`, `resolveSnapshotDir` `[VERIFIED]`
- `packages/agent/src/lib/snapshots/snapshotWriter.ts:1-97` — NDJSON shape, mode 0o600 chmod-on-every-append `[VERIFIED]`
- `packages/agent/src/lib/snapshots/snapshotReader.ts:1-168` — `readDriftForRepo` bulk-per-repo, last-record-wins, NDJSON walk pattern `[VERIFIED]`
- `packages/agent/src/lib/snapshots/snapshotPruner.ts:1-53` — 14-day cutoff, isSnapshotFilename defence `[VERIFIED]`
- `packages/agent/src/lib/snapshots/snapshotScheduler.ts:1-88` — In-process setTimeout chain, disposer registration `[VERIFIED]`
- `packages/agent/src/lib/registry.ts:1-353` — `readRegistry`, `writeRegistry`, `canonicaliseRoot`, `assertRegistrationAllowed`, blocklist `[VERIFIED]`
- `packages/agent/src/lib/atomicWrite.ts:1-63` — `atomicWriteFile` O_NOFOLLOW + O_EXCL + fsync + rename + tmp-cleanup `[VERIFIED]`
- `packages/agent/src/lib/coverageCache.ts:1-60` — 30s cache singleton pattern `[VERIFIED]`
- `packages/agent/src/lib/coverageHistoryCache.ts:1-66` — 1h cache singleton; Map-keyed `[VERIFIED]`
- `packages/agent/src/lib/coverageScan.ts:1-267` — Scanner orchestrator, `scanCoverageInternal`, `Promise.allSettled` partial failure isolation `[VERIFIED]`
- `packages/agent/src/lib/paths.ts:147-152` — `COVERAGE_ROOTS` factory for family realpath containment `[VERIFIED]`
- `packages/agent/src/server/app.ts:1-143` — Middleware chain (bearerAuth, CORS, cidr, logger), route mounting `[VERIFIED]`
- `packages/agent/src/server/boot.ts:84-116` — `assertSnapshotDirInDaemonHome` symlink-escape boot check `[VERIFIED]`
- `packages/agent/src/routes/coverageHistory.ts:1-133` — Sibling-endpoint pattern, outbound parse, data-driven repoId validation `[VERIFIED]`
- `packages/agent/src/routes/registry.ts:1-364` — Rate-limiter pattern (`rlConsume(tokHash)`), zValidator with 422 on Zod failure `[VERIFIED]`
- `packages/spa/src/router.tsx:1-188` — TanStack route tree, `_appshell` layout, lazy + `validateSearch: zodValidator` + `errorComponent` pattern `[VERIFIED]`
- `packages/spa/src/components/AppShellV2.tsx:28-58` — `ToastProvider` wraps shell; `<main>` is the scroll container `[VERIFIED]`
- `packages/spa/src/components/ui/Sidebar.tsx:71-82` — Observability section with `Coverage` + `Skill drift` (Phase 12 adds 3rd entry) `[VERIFIED]`
- `packages/spa/src/components/ui/PageHeader.tsx:24-67` — Sticky `sticky?: boolean` opt-in `[VERIFIED]`
- `packages/spa/src/components/ui/Toast.tsx:1-91` — Single-slot replace, opacity-only animation, portal `[VERIFIED]`
- `packages/spa/src/components/ui/Tooltip.tsx:1-128` — Portal + scroll-remeasure, conditional aria-describedby `[VERIFIED]`
- `packages/spa/src/components/ui/usePageHeaderHeight.ts:1-22` — ResizeObserver + `--ph-h` publishing `[VERIFIED]`
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx:1-362` — Page composition pattern (loading/error/empty branches, schema-drift surface, `inFlightRefreshes: ReadonlySet<string>`) `[VERIFIED]`
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx:1-230` — Sticky family header, `<colgroup>` width contract, install hint inline pattern `[VERIFIED]`
- `packages/spa/src/components/panels/coverage/coverageColumns.ts:1-19` — Column width SoT (44px touch target via `w-12`) `[VERIFIED]`
- `packages/spa/src/styles/tokens.css:1-90` — Status/text tokens, `--ph-h`, `--z-sticky/--z-overlay/--z-modal/--z-toast` `[VERIFIED]`
- `packages/spa/src/lib/coverageHistoryQueries.ts:1-66` — `useCoverageHistory` 1h staleTime pattern `[VERIFIED]`
- `packages/agent/src/constants.ts:1-23` — `CONFIG_DIR`, `REGISTRY_FILE`, `AUTH_FILE`, `CORS_MAX_AGE_SECONDS` `[VERIFIED]`

### Secondary (HIGH-MEDIUM — CONTEXT.md / RFC-level)
- `.planning/phases/DASH-12-observability-conformance-surface/12-CONTEXT.md` — D-12-01..29 ratified `[CITED]`
- `.planning/phases/DASH-12-observability-conformance-surface/12-DISCUSSION-LOG.md` — Decision alternatives audit `[CITED]`
- `.planning/phases/DASH-11-coverage-trends-skill-drift/11-CONTEXT.md` — Phase 12 anticipation (D-11-07/08/11) `[CITED via STATE.md decisions log]`
- `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — Composite ≥87 floor (D-10.5-03), calibration data points #1..4 `[CITED]`
- `.planning/STATE.md` — Project state, recent decisions, pending todos `[CITED]`
- `.planning/REQUIREMENTS.md` — Existing reqs IDs (BOOT/DAEMON/AUTH/REG/API/SPA/HOME/DISC/PHASE/HEALTH/POLISH/HELP/COV/TRD/SKD/PLI/IMP/INV) `[CITED]`

### Tertiary (no LOW-confidence sources — Phase 12 research is codebase-grounded)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep is workspace-pinned and exercised by existing tests; no new packages.
- Architecture: HIGH — every primitive Phase 12 needs is verified in code (Pattern 1-6 sources all cite codebase paths).
- Score formula: HIGH — Pitfall 2 + Pitfall 3 give the formula; tested in REQ-12-CON-02.
- Chart primitive: MEDIUM-HIGH — 120-LOC budget is plausible per the sketch but Wave 0 spike is required before Wave 3.
- Pitfalls: HIGH — codebase-grounded; 11 pitfalls each tied to a specific source file.
- Retention bump (90d): MEDIUM — assumption that bumping is non-cascading; planner verifies before merging.
- Security domain: HIGH — leverages 4 existing defence layers (`atomicWriteFile`, `assertRegistrationAllowed`, `realpath` family containment, rate-limiter); /cso will validate.

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (30 days — codebase is stable; v1.2.0 dogfooding may surface new requirements)

## RESEARCH COMPLETE
