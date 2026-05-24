# Phase 13: GitNexus scoped scan actions — Research

**Researched:** 2026-05-24
**Domain:** Daemon subprocess orchestration (gitnexus CLI) + scoped UI affordances on Coverage matrix
**Confidence:** HIGH (most findings verified live against installed code or live binaries)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 11 implementation decisions are ratified (D-13-01 … D-13-11b). The planner MUST treat these as fixed inputs, NOT design choices:

- **D-13-01** — Daemon spawns `gitnexus analyze` subprocess via `execa` (already a dep). No library import.
- **D-13-02** — Progress transport: short-poll `GET /api/gitnexus/scan/{id}` every 1–2s. No SSE.
- **D-13-03** — Per-repo lock. 409 on collision. Family scan = orchestrated sequence sharing the per-repo lock primitive.
- **D-13-04** — Family scans process repos sequentially (alphabetical by registry name).
- **D-13-05** — Partial-success semantics — each repo ends with its own final state; family toast: `"N/M scanned, K failed — retry failed?"`.
- **D-13-06** — Remove page-header `IndexGitNexusButton` entirely (incl. its mount in `CoveragePage.tsx`).
- **D-13-07** — Binary not installed → hide Scan affordances; surface existing `InstallGitNexusButton` clipboard CTA.
- **D-13-08** — On `not-installed` / `installed-no-registry` rows, replace ✗ cell content with `Scan` pill. Mid-scan: spinner + "Scanning…".
- **D-13-09** — On scan success SPA invalidates `useCoverage` / `useConformance`; cell flips ✓ on refetch. No optimistic update.
- **D-13-10** — Reuse `buildGitnexusIndexClipboardString` from `@agenticapps/dashboard-shared`. Extend to return `{ string, argv }` so daemon + clipboard stay in lockstep.
- **D-13-11** — Daemon refuses scan routes when bind ≠ `127.0.0.1`. Returns 403. No `--allow-remote-scan` flag in v1.3.0.
- **D-13-11b** — Health/conformance response exposes `gitnexus.canScan = installed && bindIsLoopback`. SPA renders Scan pills disabled with tooltip when `canScan === false` but installed.

### Claude's Discretion

- Scan job id format (UUID v4 vs ULID vs short hash)
- In-memory scan job state design (Map shape, TTL, retention)
- Polling cadence (start at 1500ms)
- Error code taxonomy for `/api/gitnexus/scan`
- Toast copy strings (UI-Spec phase will refine — research recommends; planner refines)

### Deferred Ideas (OUT OF SCOPE)

- Bounded-parallel family scans (v1.3.x candidate)
- Scan-all-families action
- Scan over Tailscale (flag-based opt-in if user later asks)
- Cancelable scans
- Streaming gitnexus stderr to UI
- Scan scheduling / cron
- Per-skill / per-language scan targeting
</user_constraints>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives the planner MUST verify against:

- **Read-only project FS** — daemon never writes to a registered project. Phase 13 obeys this: gitnexus writes go inside `<repo>/.gitnexus/` (LadybugDB) and `~/.gitnexus/registry.json` — both happen as subprocess side effects, NOT as daemon file writes. The daemon's process tree contains the write, but the daemon code never opens project files for write. **This is the precise spec carve-out and must be called out in PLAN.md `<threat_model>` as an explicit `/cso`-acknowledged exception.**
- **No native deps in `packages/agent`** — `execa@^9.6.1` is already a dep; no new natives.
- **Daemon writes confined to `~/.agenticapps/dashboard/`** — `~/.gitnexus/` is OUTSIDE this boundary. Carve-out logic: the daemon does not write there; the spawned `gitnexus` binary does. Documented in `coverageSpawn.ts` precedent.
- **Bearer-token auth on every route** — POST `/api/gitnexus/scan` + GET `/api/gitnexus/scan/{id}` inherit from `app.use(bearerAuth(...))` middleware chain. No per-route hand-rolling.
- **CORS lock** — `PROD_ORIGIN` + `DEV_ORIGIN` only. Phase 13 inherits.
- **Two-stage review + IMPECCABLE ≥ 87** — Phase 13 is calibration data point #6 for D-10.5-03 floor recalibration. Includes the `<N>-IMPECCABLE.md` artifact requirement.

## Summary

**The core change is a small one** — Phase 13 takes the existing synchronous `POST /api/coverage/refresh` route (Phase 10) and evolves it into an **async, job-id, short-poll** shape that the SPA can drive from per-row and per-family scope. The architectural primitives the planner needs (per-repo lock map, execa spawn pattern, schema-drift defence, atomic SPA invalidation hook) all exist as recent Phase 10 / Phase 12 code we can clone almost line-for-line.

**The key external finding (HIGH confidence, verified live):** gitnexus@1.6.4 writes `~/.gitnexus/registry.json` via plain `fs.writeFile(path, JSON.stringify(entries))` — **no atomic rename, no file lock, no fsync, no per-process serialisation**. Two concurrent `gitnexus analyze` runs in different repos can both read the JSON, both write a serialised array, and the second writer silently clobbers the first writer's registry entry. **D-13-03's per-repo lock does NOT save us from this** — the per-repo locks compose, but the per-repo locks are about *one repo's analyze running once*, not about *two different repos racing to update `registry.json`*. The family-scan sequential decision (D-13-04) does protect us within a family, but two parallel single-repo scans across families (e.g. the user clicks one row in agenticapps, then immediately clicks one in factiv) would still race.

**Primary recommendation:** Add a **global scan serialisation lock** layered on top of D-13-03's per-repo lock, scoped to the lifetime of the gitnexus subprocess only. This is a 1-line addition to D-13-03's lock implementation — `scanInProgressGlobal: Promise<void> | null` — and converts the "different families, different repos" race into a sequential queue. The user experience cost is ~30s–2min wait if a user double-clicks across families; that's strictly preferable to a corrupted `registry.json`. (See §"Resolved Discretion Decisions" — D-13-EXT-01.)

**Other key findings:**
- gitnexus is installed locally at `~/.local/state/fnm_multishells/.../bin/gitnexus@1.6.4`. The `analyze` subcommand exists, accepts an optional `[path]` argument, and exits with conventional Unix codes (0 success, non-zero on parse / git / disk errors). Help text captured below — no surprises in flag set.
- The bindMode signal currently lives in `boot.ts` BootOptions but is **NOT exposed to route handlers** via the Hono `Env.Variables` shape. Phase 13 must add a `bindMode` variable to `Variables`, set it in `createApp`, and read it in the new route. This is a 3-line change but it's a real gap.
- `buildGitnexusIndexClipboardString` lives in `packages/shared/src/clipboard.ts:34` and currently returns `'gitnexus analyze'` (no path arg). Extending to `{ string, argv }` requires changing only the return type — both existing call sites (`IndexGitNexusButton.tsx`, retained per spec) consume only the string form.
- The `useRegistryFixPath` donor pattern lives in `packages/spa/src/lib/conformanceQueries.ts:100-124` (NOT in a file named `registryFixPath.ts` as the orchestrator brief assumed). Phase 13's `useGitnexusScan` should mirror its shape exactly: mutation + per-row in-flight Set in the consumer + post-mutation `invalidateQueries`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `execa` | `^9.6.1` (already in `packages/agent/package.json:51`) | Spawn `gitnexus analyze` subprocess | Already battle-tested in `coverageSpawn.ts`. Argv-array form (T-10-03-02) defends against argument injection. [VERIFIED: `package.json`, `coverageSpawn.ts`] |
| `node:crypto.randomUUID` | builtin (Node ≥14.17 / 19.0) | Scan job id generation | Zero deps; URL-safe; sufficient entropy; verified live (`node -e "..."` → produced valid UUID v4). [VERIFIED: `node -e` probe] |
| `hono` | already a dep | Route framework | Phase 10/12 precedent. [VERIFIED: `app.ts`] |
| `@hono/zod-validator` | already a dep | Request body validation (only the POST has a body; for v1.3.0 the body is empty `{}` per per-repo scoping via path param) | Pattern donor: `registryFixPath.ts:98-104`. [VERIFIED] |
| `@agenticapps/dashboard-shared` (zod schemas) | local workspace | Wire-shape source of truth | INV-04. [VERIFIED] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` (mutation + query hooks) | already a dep | SPA-side polling + mutation | Donor: `conformanceQueries.ts`. |
| `lucide-react` (`Sparkles`, `Loader2`, `Play`) | already a dep | Icon set for Scan pill | Consistent with existing `Index/InstallGitNexusButton` (`Sparkles`, `Download`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto.randomUUID` | `ulid` (npm) | ULID is sort-friendly + shorter, but: (a) adds a dep — violates "no new natives" spirit even though ulid is pure-JS; (b) the daemon's in-memory Map doesn't need sort order; (c) UUID v4 is more recognisable in logs. Recommend UUID v4. |
| Short hash (8-char) | `randomBytes(4).toString('hex')` | Collision probability acceptable for ≤22 in-flight scans, but log readability is worse. UUID v4 wins. |
| Short-poll (D-13-02, locked) | SSE | Locked. Mentioned only because the daemon's existing 30s-TTL cache pattern was built for slow-changing data; the new poll endpoint must explicitly **bypass** that cache. |

**Installation:** No new package installs required. All dependencies already in the workspace.

**Version verification:**
```bash
npm view execa version                # 9.6.1 (verified — matches package.json)
gitnexus --version                    # 1.6.4 (verified live)
node -e "console.log(require('node:crypto').randomUUID())"   # works (verified live)
```

## Architecture Patterns

### Recommended Code Layout

```
packages/agent/src/
├── routes/
│   └── gitnexusScan.ts                          # NEW — POST + GET routes
├── lib/
│   ├── gitnexusScan.ts                          # NEW — job registry + spawn orchestrator
│   ├── gitnexusScanFamily.ts                    # NEW — sequential family-scan orchestrator
│   └── coverageSpawn.ts                         # EXISTING — reused; extend with optional path arg if needed
├── server/
│   ├── app.ts                                   # MOD — mount route at /api/gitnexus, add bindMode to Env.Variables
│   └── boot.ts                                  # MOD — pass bindMode through to createApp via opts
└── routes/health.ts                              # MOD — extend HealthResponse with gitnexus.{installed,canScan}

packages/shared/src/
├── clipboard.ts                                  # MOD — buildGitnexusIndexClipboardString returns { string, argv }
└── schemas/
    └── gitnexusScan.ts                          # NEW — request/response/job-state schemas

packages/spa/src/
├── components/panels/coverage/
│   ├── CoveragePage.tsx                         # MOD — remove IndexGitNexusButton mount (D-13-06)
│   ├── CoverageRow.tsx                          # MOD — render Scan pill on non-present rows
│   ├── CoverageFamilySection.tsx                # MOD — render Scan family button in header
│   └── ScanPill.tsx                              # NEW — per-row/per-family Scan affordance primitive
└── lib/queries/
    └── gitnexusScan.ts                          # NEW — useGitnexusScan + useGitnexusScanProgress hooks
```

### Pattern 1: Daemon mutation route shape (mirror `registryFixPath.ts`)

**What:** Phase 12 codified the shape — Zod parse → rate limit → business logic in a lock → cache invalidation → `outbound()` schema-drift parse on response.

**When to use:** Every new daemon mutation route in v1+.

**Example (literal donor — copy this skeleton):**
```typescript
// Source: packages/agent/src/routes/registryFixPath.ts:96-253
export const gitnexusScanRoute = new Hono<Env>()

gitnexusScanRoute.post('/scan', async (c) => {
  // 1. bindMode refusal (D-13-11)
  const bindMode = c.get('bindMode')          // requires Env.Variables to carry it
  if (bindMode !== 'loopback') {
    return c.json({ ok: false, error: 'BIND_REFUSED', requestId: c.get('requestId') }, 403)
  }
  // 2. Body parse (Zod) — body: { repoId: 'family/repo' } | { familyId: '...' }
  // 3. Rate limit (rlConsume) — 10/10s same as registryFixPath
  // 4. Resolve repo from registry (404 if missing)
  // 5. Per-repo lock check (409 SCAN_ALREADY_RUNNING if held)
  // 6. Acquire global scan lock (queues across-family races, see D-13-EXT-01)
  // 7. Create scanId via randomUUID, register in Map, start spawn fire-and-forget
  // 8. Return { ok: true, scanId } 200
})

gitnexusScanRoute.get('/scan/:id', (c) => {
  // 1. bindMode refusal (D-13-11)
  // 2. Look up job in Map; 404 SCAN_NOT_FOUND if absent (TTL evicted)
  // 3. Return { ok: true, state: 'running' | 'done' | 'error', ... }
})
```

### Pattern 2: Subprocess spawn (clone `coverageSpawn.ts`)

**What:** Resolve binary via `which`, execa argv-array form, discriminated-union result.

**When to use:** Phase 13 spawn is functionally identical to Phase 10's. The only diff is that Phase 13 may need to spawn `gitnexus analyze` with no path arg (current pattern passes only `['analyze']` and sets `cwd`).

**Example:**
```typescript
// Source: packages/agent/src/lib/coverageSpawn.ts:60-81
const result = await execa(cmd, ['analyze'], {
  cwd: repoAbsPath,
  timeout: SPAWN_TIMEOUT_MS,    // 5min — keep this
})
```

**Verbatim reuse:** `spawnGitNexusAnalyze(repoAbsPath)` already returns the right shape (`SpawnResult` discriminated union). Phase 13's job runner can call it directly.

### Pattern 3: Per-repo in-memory lock map (clone `coverage.ts:66`)

**What:** `Map<string, Promise<JobState>>` keyed by `family/repo`. Concurrent POSTs on the same key wait on the existing promise; different keys run in parallel.

**Verbatim donor:**
```typescript
// Source: packages/agent/src/routes/coverage.ts:62-74
const refreshLocks = new Map<string, Promise<CoverageRefreshResponse>>()
export function _resetRefreshLocksForTests(): void { refreshLocks.clear() }
```

**Phase 13 evolution:** The map value becomes `{ jobId, promise }` so the GET route can look up by `jobId` without scanning. Use a second `Map<scanId, ScanJob>` for the GET lookup.

### Pattern 4: SPA mutation hook with per-row in-flight Set (clone `useRegistryFixPath` + `PathDriftPanel`)

**What:** TanStack Query `useMutation` for the POST, separate `useQuery` with short polling for the GET, per-row in-flight Set in the consumer (NOT the hook — the hook is stateless).

**Verbatim donor:**
```typescript
// Source: packages/spa/src/lib/conformanceQueries.ts:100-124 (useRegistryFixPath)
// Source: packages/spa/src/components/panels/conformance/PathDriftPanel.tsx:88-130 (PathDriftPanel — Set + mutateAsync + try/finally + toast.show)
const [inFlightRefreshes, setInFlightRefreshes] = useState<ReadonlySet<string>>(() => new Set())
// ... on click:
setInFlightRefreshes((prev) => new Set(prev).add(key))
try {
  await mutation.mutateAsync(...)
  // success
} catch (err) {
  // map error.code → human message via errorCodeToMessage(); toast
} finally {
  setInFlightRefreshes((prev) => { const next = new Set(prev); next.delete(key); return next })
}
```

**Why this pattern (Phase 11.2 stage-1 review finding):** TanStack Query's `mutation.isPending` is *shared* across all callers; two concurrent row-level mutateAsync calls collapse into a single `isPending=true` flag. Storing per-row keys in a Set restores per-row spinner state.

### Pattern 5: Polling query (NEW — no exact donor, but use `useQuery` with `refetchInterval`)

**What:** Once the SPA receives a `scanId` from POST, it issues `useQuery({ queryKey: ['gitnexusScan', scanId], refetchInterval: 1500 })`. The query function unconditionally fetches GET; when `state === 'done' | 'error'`, the query returns `{ refetchInterval: false }` from the function form of `refetchInterval`.

**Cache behaviour:** `staleTime: 0`, `gcTime: 60_000` so a recently-completed scan stays in cache for 1min (matches D-13-EXT-04 retention window — see below).

**Example:**
```typescript
useQuery({
  queryKey: ['gitnexusScan', scanId],
  queryFn: async () => apiFetch(`/api/gitnexus/scan/${scanId}`, GitnexusScanProgressSchema),
  refetchInterval: (q) => q.state.data?.state === 'running' ? 1500 : false,
  staleTime: 0,
  gcTime: 60_000,
  enabled: Boolean(scanId),
})
```

### Anti-Patterns to Avoid

- **Building a generic job framework.** "Async job + polling" is tempting to generalise. Don't. Phase 13 has exactly one job type; build it inline. If Phase 14 needs another, generalise then.
- **Streaming stderr to the SPA.** Deferred per CONTEXT. Even returning `error.stderr` in the GET response leaks subprocess output (T-13-EXFIL — see threat model). The GET response carries only `{state, error?: {code, message}}`.
- **Storing scan history on disk.** D-13 CONTEXT explicitly chose in-memory. A daemon restart loses in-flight scans — the SPA's poll gets 404 `SCAN_NOT_FOUND` → toast "scan was interrupted". Acceptable for ~30s–2min jobs.
- **Optimistic update of the cell to ✓ before the spawn resolves.** D-13-09 locked this out: refetch is cheap and the latency is hidden by the spinner.
- **Reading bindMode from `process.env` in the route.** Plumb it through `Env.Variables` so tests can override it cleanly (matches `registryFile` / `authFile` pattern in `app.ts:43`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for scan id | A custom hash | `node:crypto.randomUUID()` | Builtin, zero-dep, recognisable format, sufficient entropy. [VERIFIED live] |
| Subprocess spawn boilerplate | `child_process.spawn` directly | `execa` argv-array form | Already a dep; argv-array form is the documented T-10-03-02 mitigation against argument injection. |
| Job state machine | A state-machine library (xstate etc.) | A discriminated union `'queued' \| 'running' \| 'done' \| 'error'` with a `Map<id, ScanJob>` | Three states. Inline. |
| Per-repo serialisation | A semaphore library | The `Map<string, Promise>` pattern from `coverage.ts:66` | One file of code already in tree. |
| Rate limiting | Per-route hand-roll | `rlConsume(tokenHashOf(token))` from `lib/rateLimiter.ts:24` | Phase 1 precedent, already wired across 5 routes. |
| Schema-drift detection | Custom checks | `outbound()` from `server/middleware/errors.ts:22` + `apiFetch` + `parseOrDrift` on SPA | INV-04 invariant — re-use the existing primitive at both ends. |
| Toast UX | A custom popover | `useToast()` from `components/ui/Toast.tsx` | Phase 11.1 IMP-03 ratified; already wired into `CoveragePage`. |

**Key insight:** Phase 13 is almost entirely composition of existing primitives. The genuinely NEW code is (1) the in-memory job Map, (2) the family-scan orchestrator (sequential `for-of` loop awaiting each per-repo scan), and (3) the bindMode plumbing through `Env.Variables`. Everything else is "copy `registryFixPath.ts` and `useRegistryFixPath`, change names, add polling".

## External CLI Research

### `gitnexus --version` and `gitnexus analyze --help` — VERIFIED LIVE

- Installed at `~/.local/state/fnm_multishells/3344_1779448100304/bin/gitnexus` (symlink → `gitnexus/dist/cli/index.js`). [VERIFIED]
- Version: **1.6.4** (matches Phase 10's pinned `RegistryEntry` shape from `gitNexusScanner.ts:5`). [VERIFIED]
- Help output (preserved verbatim — planner can pin invocation flags against this):

```
Usage: gitnexus analyze [options] [path]

Index a repository (full analysis)

Options:
  -f, --force                     Force full re-index even if up to date
  --embeddings [limit]            Enable embedding generation (off by default)
  --drop-embeddings               Drop existing embeddings on rebuild
  --skills                        Generate repo-specific skill files
  --skip-agents-md                Skip updating AGENTS.md / CLAUDE.md
  --no-stats                      Omit volatile file/symbol counts
  --skip-git                      Treat path as index root, skip git-root discovery
  --name <alias>                  Register repo under custom name in ~/.gitnexus/registry.json
  --allow-duplicate-name          Allow same --name alias on multiple paths
  -v, --verbose                   Verbose ingestion warnings (default false)
  --max-file-size <kb>            Default 512 KB; hard cap 32768 KB
  --worker-timeout <seconds>      Worker sub-batch idle timeout. Default 30.
  --embedding-* (4 flags)         ONNX embedding tuning (off by default — irrelevant for v1.3.0)
  -h, --help
```

**Phase 13 invocation contract:** `gitnexus analyze` (no flags, no path arg, `cwd: <repo>`). Matches Phase 10's `spawnGitNexusAnalyze` exactly — no new flag handling needed.

### Exit code conventions

- gitnexus uses commander's standard exit codes: 0 on success, 1 on most user-facing errors, 2 on help/parse errors. [CITED: commander.js defaults]
- The `execa` layer in `coverageSpawn.ts:73-80` already maps these into `{kind: 'error', exitCode, stderr}` correctly. **Reuse without modification.** [VERIFIED in `coverageSpawn.ts`]

### Concurrency safety of `~/.gitnexus/registry.json` — DEFINITIVE FINDING

**Verified by reading installed source directly:** `~/.local/state/fnm_multishells/3344_1779448100304/lib/node_modules/gitnexus/dist/storage/repo-manager.js:240-260`:

```js
export const readRegistry = async () => {
    try {
        const raw = await fs.readFile(getGlobalRegistryPath(), 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    }
    catch { return []; }
};

const writeRegistry = async (entries) => {
    const dir = getGlobalDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(getGlobalRegistryPath(), JSON.stringify(entries, null, 2), 'utf-8');
};
```

[VERIFIED: installed gitnexus@1.6.4 source]

**What this means:**
- `readRegistry` then in-memory mutate then `writeRegistry` is the canonical write path. It is a textbook read-modify-write race.
- There is NO `proper-lockfile`, NO temp-file-and-rename, NO fsync, NO retry on EBUSY.
- The package's own `ARCHITECTURE.md` confirms a `lbug.lock` exists — but that's a SQLite-like single-writer lock on `<repo>/.gitnexus/lbug.lock`, scoped to the repo's LadybugDB, **not a lock on `~/.gitnexus/registry.json`**. [CITED: github.com/abhigyanpatwari/GitNexus/blob/main/ARCHITECTURE.md via WebFetch]

**Concurrency hazard breakdown:**

| Scenario | Outcome under D-13-03 per-repo lock |
|----------|--------------------------------------|
| Two clicks on the same row | SAFE — second POST returns 409 SCAN_ALREADY_RUNNING. |
| One click in agenticapps family, one click in factiv family at the same time | **UNSAFE — both spawn, both read+modify+write registry.json, last writer wins; the first writer's entry is lost.** |
| Family scan in agenticapps (sequential by D-13-04) | SAFE within the family — sequential. |
| Family scan in agenticapps + single-row click in factiv | **UNSAFE — the per-repo locks compose for repo-level concurrency but do NOT serialise registry.json writes across families.** |
| Daemon scan + user runs `gitnexus analyze` in a terminal | **UNSAFE — outside daemon's control. Documented as "don't do this" in PLAN.md FAQ; not mitigated.** |

**RECOMMENDATION (filed under D-13-EXT-01 below):** Add a global single-writer lock around the spawn — a single `Promise<void> | null` module-level slot that every per-repo spawn awaits before invoking execa. Acquired before spawn, released on settle. This converts cross-family races into a queue. The maximum user-visible cost is one extra ~30s–2min wait when a user clicks two scans across families simultaneously, which is strictly preferable to silent registry corruption.

### Typical scan duration

- gitnexus's own README states "1-5 minutes for a small/medium repo" for the initial full analyze, "seconds" for incremental re-analyze. [CITED: package README]
- The existing `coverageSpawn.ts:18` sets `SPAWN_TIMEOUT_MS = 5 * 60 * 1000` (5min). Reuse this directly. [VERIFIED]
- For a 22-repo family fleet, worst-case wall-clock for a full family scan: 22 × ~30s = ~11min. This is acceptable per CONTEXT D-13-04 (sequential chosen knowingly).

### Binary PATH detection

The existing daemon code already does this two different ways:

1. `coverageSpawn.ts:28-38` — `which gitnexus` via `execFile` (returns null if not on PATH). Used at spawn time.
2. `gitNexusScanner.ts:140-200` — stat-based probe of well-known prefixes (XDG, fnm, nvm, npm-global, volta, bun, homebrew, /usr/local). Used at startup detection time. Crucially: **no shell-out, no PATH dependence**, so it works under launchd's minimal PATH.

**Recommendation:** For Phase 13's startup health-response, **reuse `detectGitNexusBinary()` from `gitNexusScanner.ts:140`** — it's already the canonical "is gitnexus installed" answer for this codebase. The new POST/spawn path keeps using `coverageSpawn.ts:resolveGitNexusBin()` (the `which`-based version) because it returns the actual absolute path needed for execa. Two checks, same source-of-truth gitnexus binary.

**Env override:** No need for a new `AGENTIC_DASHBOARD_GITNEXUS_BIN` var. `coverageSpawn.ts:28` already routes through `which`, which respects PATH, which is the natural user-controllable knob. Adding an env override now is YAGNI.

## Code Reconnaissance

Concrete file:line references for every donor pattern and every modification target. The planner can lift these verbatim.

### Files to be modified

| File | Purpose | What changes |
|------|---------|--------------|
| `packages/agent/src/server/app.ts` | Add `bindMode` to `Env.Variables` (line 38-44) and to `CreateAppOptions` (line 46-53); set it in middleware closure (around line 75-83); mount the new route at `/api/gitnexus` after line 141 | ~10 lines |
| `packages/agent/src/server/boot.ts:137-202` | Pass `bindMode` from `BootOptions` into `createApp({bindMode, ...})` | 1 line |
| `packages/agent/src/cli/start.ts:107` | `createApp({ enforceCIDR, bindMode })` — pass bindMode through | 1 line |
| `packages/agent/src/routes/health.ts:12-24` | Extend `HealthResponse` with `gitnexus: { installed, canScan }` (computed daemon-side: `installed = detectGitNexusBinary()`, `canScan = installed && bindMode === 'loopback'`) | ~6 lines |
| `packages/shared/src/schemas/observability.ts` (or wherever `HealthResponseSchema` lives — `grep` to confirm) | Extend `HealthResponseSchema` with the gitnexus field (`.strict()` per INV-04 convention) | ~4 lines |
| `packages/shared/src/clipboard.ts:34-36` | Change `buildGitnexusIndexClipboardString()` to return `{ string: 'gitnexus analyze', argv: ['analyze'] }`. Update single SPA caller in `IndexGitNexusButton.tsx:28` to read `.string` (NOTE: D-13-06 removes that mount, but the file is retained per the comment in CONTEXT §Reusable Assets). | ~3 lines + 1 call site |
| `packages/shared/src/clipboard.test.ts:54-58` | Update test to assert the new shape | ~3 lines |
| `packages/spa/src/components/panels/coverage/CoveragePage.tsx:36-39, 316-327` | Delete `IndexGitNexusButton` import + the `installed-no-registry` branch that renders it. Both states fall through to per-row Scan pills (since `canScan` lives on health response, the page no longer renders a header CTA in this branch). | ~10 lines |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx:38-57, 100-191` | New: replace ✗ in `gitNexus` cell with `<ScanPill>` when row status is non-present + `canScan === true`; render disabled `<ScanPill>` w/ tooltip when `canScan === false`. Existing refresh-popover stays for non-gitnexus actions. | ~30 lines |
| `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx:171-217` | Add per-family `<ScanFamilyButton>` to header bar (next to aggregate chips). | ~15 lines |

### Files to be created

| File | Purpose | Approx size |
|------|---------|-------------|
| `packages/agent/src/routes/gitnexusScan.ts` | POST `/scan` + GET `/scan/:id` route handlers — clone shape from `registryFixPath.ts` (~250 lines) | ~250 lines |
| `packages/agent/src/lib/gitnexusScan.ts` | Job registry Map + spawn orchestrator + TTL cleanup | ~150 lines |
| `packages/agent/src/lib/gitnexusFamilyScan.ts` | Sequential family-scan orchestrator | ~80 lines |
| `packages/shared/src/schemas/gitnexusScan.ts` | Request + response + job-state Zod schemas (`.strict()` everywhere — Phase 12 convention) | ~60 lines |
| `packages/spa/src/lib/queries/gitnexusScan.ts` | `useGitnexusScan` (mutation) + `useGitnexusScanProgress` (polling query) | ~120 lines |
| `packages/spa/src/components/panels/coverage/ScanPill.tsx` | The per-row + per-family affordance primitive (consumes `useGitnexusScan` + `useGitnexusScanProgress`) | ~100 lines |

### Donor patterns to clone verbatim

| Donor | Lines | Target |
|-------|-------|--------|
| `packages/agent/src/routes/registryFixPath.ts:96-253` | full file | `routes/gitnexusScan.ts` — mutation route shape (Zod parse → rate limit → handler → outbound) |
| `packages/agent/src/routes/coverage.ts:62-74` | refreshLocks Map + `_resetRefreshLocksForTests` | `lib/gitnexusScan.ts` — per-repo lock Map |
| `packages/agent/src/lib/coverageSpawn.ts:60-81` | `spawnGitNexusAnalyze` | reuse as-is from `lib/gitnexusScan.ts` |
| `packages/agent/src/lib/rateLimiter.ts:24-39` | `consume()` | invoke in the new route exactly like `registryFixPath.ts:111` |
| `packages/spa/src/lib/conformanceQueries.ts:100-124` | `useRegistryFixPath` | `lib/queries/gitnexusScan.ts` — `useGitnexusScan` mutation hook (with onSuccess invalidation of `['coverage']`) |
| `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx:88-130` | per-row in-flight Set + mutateAsync + try/finally + toast.show | `ScanPill.tsx` consumer pattern |

## Runtime State Inventory

> Phase 13 is a feature-add phase, not a rename/refactor. This section is included to confirm there's no runtime state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. The daemon doesn't persist scan jobs (CONTEXT chose in-memory). `~/.gitnexus/registry.json` is written by the gitnexus subprocess as a side effect — daemon writes nothing. | None |
| Live service config | None. No external services are configured for this phase. | None |
| OS-registered state | None. Phase 6's launchd plist boots the daemon; Phase 13 changes daemon code but not launchd registration. | None |
| Secrets/env vars | None. No new env vars; bindMode is determined by CLI flag at start. | None |
| Build artifacts | None. Pure source changes; tsup/vite rebuilds handle the rest. | None |

**Verified by code search:** `grep -rn "AGENTIC_DASHBOARD\|process.env\." packages/agent/src` returned only test-fixture HOME overrides and one `AGENTLINTER_REAL` test gate. No prod env vars added by Phase 13.

## Common Pitfalls

### Pitfall 1: `gitnexus analyze` registry.json read-modify-write race (THE big one)
**What goes wrong:** Two concurrent `gitnexus analyze` processes (different repos) both call `readRegistry()` → in-memory mutate → `writeRegistry()`. Whichever finishes second clobbers the first writer's entry. Symptom: rows that were "just scanned and ✓" silently revert to ✗ on the next coverage refresh.
**Why it happens:** Verified live — `repo-manager.js:255-259` uses plain `fs.writeFile` with no atomic rename or lock.
**How to avoid:** Add a global scan-serialisation lock (D-13-EXT-01 below). Per-repo lock alone is insufficient.
**Warning signs:** Family scan completes "successfully" but the matrix shows fewer ✓ than scan count suggests. Hard to detect manually — the symptom is silent loss.

### Pitfall 2: `bindMode` not in `Env.Variables`
**What goes wrong:** Route handler can't read bindMode → D-13-11 refusal logic has nothing to check → 403 path is dead code.
**Why it happens:** `app.ts:38-44` defines `Variables = { requestId, registryFile?, authFile? }` — bindMode isn't there.
**How to avoid:** Extend `Variables` with `bindMode: 'loopback' | 'tailscale' | '0.0.0.0'`. Thread through `CreateAppOptions` → middleware closure (around `app.ts:80`) → handler.
**Warning signs:** Unit test for the 403 path passes only when the route reads `process.env.BIND_MODE` directly — that's the smell. Plumb it properly.

### Pitfall 3: Long-poll vs short-poll cache header
**What goes wrong:** GET `/api/gitnexus/scan/{id}` is mistakenly wrapped in the 30s-TTL cache (`coverageCache` / `conformanceCache` pattern). SPA polls every 1.5s, daemon returns stale `state: 'running'` for 30s after the spawn actually completed, cell stays "Scanning…" forever.
**Why it happens:** The 30s-cache pattern is the default for Phase 10/11/12 read routes. Easy to copy-paste it into the new route.
**How to avoid:** Explicitly do NOT wire `getGitnexusScanCache` / `setGitnexusScanCache`. The handler reads directly from the in-memory `Map<scanId, ScanJob>`.
**Warning signs:** SPA spinner never resolves on a known-fast scan; daemon logs show the spawn settled but the GET still returns `running`.

### Pitfall 4: TanStack `mutation.isPending` shared across rows
**What goes wrong:** Two rows are scanning concurrently; both spinners flip off when the first one settles because `useMutation().isPending` is shared module-state.
**Why it happens:** TanStack mutation state is per-hook-instance, not per-call. Two row components share the same hook instance via context.
**How to avoid:** Mirror the Phase 11.2 fix: per-row `inFlightRefreshes: ReadonlySet<string>` in the consumer + `mutateAsync` + try/finally. The mutation's `isPending` is ignored entirely.
**Warning signs:** First row to finish "frees" the second row's spinner.
**Donor code:** `CoveragePage.tsx:101-103, 149-190` — read this carefully; it's already the right pattern.

### Pitfall 5: Scan job evicted from Map before SPA's last poll
**What goes wrong:** Daemon evicts the job from `Map<scanId, ScanJob>` immediately on settle. SPA's poll lands 100ms later, gets 404 SCAN_NOT_FOUND, shows "scan was interrupted" toast — even though the scan succeeded.
**Why it happens:** Naive cleanup with no retention window.
**How to avoid:** TTL the entry: keep `done | error` jobs in the Map for 60s after settle (D-13-EXT-04 below). Use `setTimeout(..., 60_000).unref()` per job.
**Warning signs:** Random success-then-error toasts in user testing; pattern: error fires ~50-200ms after success.

### Pitfall 6: Schema-drift if `outbound()` is skipped on the POST 200 response
**What goes wrong:** Wire shape evolves out from under SPA expectation; SPA crashes on `result.scanId` access (TS thinks it's there, runtime says undefined).
**Why it happens:** The Phase 12 pattern wraps every 200 response in `outbound(c, Schema.parse.bind(Schema), payload)` (see `registryFixPath.ts:251`). Easy to forget on a "simple" POST that returns `{ok: true, scanId}`.
**How to avoid:** Wrap every success response in `outbound()`. INV-04 invariant.
**Warning signs:** SPA tests pass against a hand-built mock; integration test fails.

### Pitfall 7: Family-scan partial-success failure mode loses individual error context
**What goes wrong:** Family scan completes; toast says "6/9 scanned, 3 failed". User clicks "retry failed" — but the SPA doesn't know which 3 failed because the family-level response only carried aggregate counts.
**Why it happens:** D-13-05 calls for partial success; the implementation can drop per-repo error state if not careful.
**How to avoid:** Family-scan job state carries `{ total, completed, failed, currentRepoId, perRepoResults: Array<{repoId, state, error?}> }`. SPA reads `perRepoResults` to drive the retry button.
**Warning signs:** "Retry failed" button retries the whole family.

### Pitfall 8: `IndexGitNexusButton` import left behind after D-13-06
**What goes wrong:** Mount removed in `CoveragePage.tsx:316-327` (the `installed-no-registry` branch), but the `import IndexGitNexusButton` at line 38 is left in. Vite produces a dead-import warning; eslint catches it; CI fails.
**Why it happens:** D-13-06 says "remove the page-header CTA" — surface-level read may not catch the import.
**How to avoid:** Search-replace check. The Phase 13 PR should have ZERO remaining references to `IndexGitNexusButton` anywhere in `packages/spa/src/components/panels/coverage/` (file itself stays per CONTEXT §"Reusable Assets" — but if it's never imported, eslint flags it as unused-export). Decide: delete the file outright (cleaner, but the comment says "keep as fallback") OR keep the file and add an eslint-disable comment.
**Recommended:** Delete the file. The comment in CONTEXT says "keep `InstallGitNexusButton`" — `IndexGitNexusButton` was the one being removed; the comment was about the install variant.

## Code Examples

### Example 1: New route skeleton (POST + GET)

```typescript
// packages/agent/src/routes/gitnexusScan.ts
// Source pattern: packages/agent/src/routes/registryFixPath.ts
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import {
  GitnexusScanRequestSchema,
  GitnexusScanProgressSchema,
} from '@agenticapps/dashboard-shared'
import { consume as rlConsume, tokenHashOf } from '../lib/rateLimiter.js'
import {
  startScan,
  getScanJob,
} from '../lib/gitnexusScan.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const gitnexusScanRoute = new Hono<Env>()

gitnexusScanRoute.post('/scan', zValidator('json', GitnexusScanRequestSchema), async (c) => {
  const requestId = c.get('requestId')
  const bindMode = c.get('bindMode')
  if (bindMode !== 'loopback') {
    return c.json({ ok: false, error: 'BIND_REFUSED', requestId }, 403)
  }
  // rate limit
  const token = c.req.header('Authorization')?.slice('Bearer '.length).trim() ?? ''
  const rl = rlConsume(tokenHashOf(token))
  if (!rl.allowed) {
    return c.json({ ok: false, error: 'RATE_LIMITED', requestId }, 429, { 'Retry-After': String(rl.retryAfter) })
  }
  const body = c.req.valid('json')
  const scanId = randomUUID()
  const result = await startScan(scanId, body)   // → { ok: true } | { ok: false, code: '...' }
  if (!result.ok) {
    const status = result.code === 'SCAN_IN_FLIGHT' ? 409 :
                   result.code === 'REPO_NOT_REGISTERED' ? 404 :
                   result.code === 'BINARY_NOT_FOUND' ? 503 : 500
    return c.json({ ok: false, error: result.code, requestId }, status)
  }
  return outbound(c, ...)  // { ok: true, scanId }
})

gitnexusScanRoute.get('/scan/:id', (c) => {
  const requestId = c.get('requestId')
  const bindMode = c.get('bindMode')
  if (bindMode !== 'loopback') {
    return c.json({ ok: false, error: 'BIND_REFUSED', requestId }, 403)
  }
  const job = getScanJob(c.req.param('id'))
  if (!job) {
    return c.json({ ok: false, error: 'SCAN_NOT_FOUND', requestId }, 404)
  }
  return outbound(c, GitnexusScanProgressSchema.parse.bind(GitnexusScanProgressSchema), job.publicShape())
})
```

### Example 2: In-memory scan registry shape

```typescript
// packages/agent/src/lib/gitnexusScan.ts
type ScanJobState =
  | { state: 'running'; startedAt: string }
  | { state: 'done'; startedAt: string; completedAt: string; repoId: string }
  | { state: 'error'; startedAt: string; completedAt: string; repoId: string; error: { code: string; message: string } }

type FamilyScanJobState =
  | { state: 'running'; startedAt: string; familyId: string; total: number; completed: number; failed: number; currentRepoId: string | null; currentScanId: string | null; perRepoResults: Array<{ repoId: string; state: 'done' | 'error'; error?: { code: string; message: string } }> }
  | { state: 'done' | 'error'; /* same shape, frozen */ ... }

const scans = new Map<string, ScanJobState | FamilyScanJobState>()

// Global single-writer lock for registry.json safety (D-13-EXT-01)
let globalScanLock: Promise<void> | null = null

export async function startScan(scanId: string, req: GitnexusScanRequest): Promise<...> {
  // ...resolve repo from registry, per-repo lock check, claim globalScanLock, spawn, register cleanup...
}

export function getScanJob(id: string): ScanJob | null {
  return scans.get(id) ?? null
}

// TTL — keep done/error entries for 60s so SPA's final poll succeeds
function scheduleEviction(scanId: string): void {
  setTimeout(() => scans.delete(scanId), 60_000).unref()
}

export function _resetForTests(): void {
  scans.clear()
  globalScanLock = null
}
```

### Example 3: Family-scan orchestrator (sequential)

```typescript
// packages/agent/src/lib/gitnexusFamilyScan.ts
export async function startFamilyScan(familyScanId: string, familyId: CoverageFamily): Promise<void> {
  const repos = listReposForFamily(familyId).sort((a, b) => a.repo.localeCompare(b.repo))
  scans.set(familyScanId, { state: 'running', familyId, total: repos.length, completed: 0, failed: 0, currentRepoId: null, currentScanId: null, perRepoResults: [], startedAt: new Date().toISOString() })

  for (const repo of repos) {
    const childScanId = randomUUID()
    updateFamilyState(familyScanId, (s) => ({ ...s, currentRepoId: `${familyId}/${repo.repo}`, currentScanId: childScanId }))
    try {
      await startScan(childScanId, { repoId: `${familyId}/${repo.repo}` })  // synchronous wait — sequential
      await waitForScanSettle(childScanId)  // poll-internally until done|error; child uses globalScanLock so it's serialised
      const child = scans.get(childScanId)
      updateFamilyState(familyScanId, (s) => ({
        ...s,
        completed: s.completed + (child?.state === 'done' ? 1 : 0),
        failed: s.failed + (child?.state === 'error' ? 1 : 0),
        perRepoResults: [...s.perRepoResults, { repoId: `${familyId}/${repo.repo}`, state: child?.state ?? 'error', ...(child?.state === 'error' ? { error: child.error } : {}) }],
      }))
    } catch { /* registered as a failed perRepoResult */ }
  }
  freezeFamilyState(familyScanId, 'done')
  scheduleEviction(familyScanId)
}
```

### Example 4: SPA mutation + polling hook composition

```typescript
// packages/spa/src/lib/queries/gitnexusScan.ts
export function useGitnexusScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: GitnexusScanRequest) => {
      const r = await apiFetch('/api/gitnexus/scan', GitnexusScanResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`schema_drift:${r.drift.path}`)
      return r.data
    },
    onSuccess: () => {
      // No coverage invalidation HERE — happens after polling reaches 'done'.
    },
  })
}

export function useGitnexusScanProgress(scanId: string | null) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['gitnexusScan', scanId],
    queryFn: async () => {
      const r = await apiFetch(`/api/gitnexus/scan/${scanId}`, GitnexusScanProgressSchema)
      if (!r.ok) throw new Error(`schema_drift:${r.drift.path}`)
      return r.data
    },
    enabled: scanId !== null,
    refetchInterval: (q) => q.state.data?.state === 'running' ? 1500 : false,
    staleTime: 0,
    gcTime: 60_000,
    // D-13-09: invalidate coverage on terminal state
    structuralSharing: false,    // ensure onSuccess fires on every fetch
    refetchOnWindowFocus: false,
  })
  // Consumer wraps: useEffect(() => { if (data?.state === 'done') qc.invalidateQueries(['coverage']) }, [data?.state])
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `POST /api/coverage/refresh` synchronous spawn | Phase 13: async + scan-id + short-poll | Phase 13 | UI gets per-row spinner; multi-minute scans no longer hang the request. The Phase 10 route stays for backward compat with the existing per-row refresh affordance for non-gitnexus actions. |
| Page-header `IndexGitNexusButton` (clipboard) | Per-row + per-family Scan pills (daemon-driven) | Phase 13 (D-13-06) | User can scan at the scope of intent (one repo, or one family) without leaving the page. |
| Boolean `gitnexus.installed` only | `{ installed, canScan }` composite | Phase 13 (D-13-11b) | Bind-mode awareness surfaces in UI without dead clicks. |

**Deprecated/outdated:**
- `IndexGitNexusButton.tsx` — D-13-06 removes its only mount in `CoveragePage.tsx:323`. Recommend deleting the file (see Pitfall 8). `InstallGitNexusButton.tsx` stays as the binary-missing fallback (D-13-07).

## Resolved Discretion Decisions

Each Claude's-Discretion item from CONTEXT gets a concrete recommendation with rationale.

### D-13-EXT-01: Global scan-serialisation lock for `~/.gitnexus/registry.json` safety

**Belongs to:** D-13-03 (per-repo lock) — this extends rather than overrides.

**Recommendation:** Add a module-level `globalScanLock: Promise<void> | null` to `lib/gitnexusScan.ts`. Every spawn invocation awaits `globalScanLock` before calling execa, and resets it on settle. This serialises ALL gitnexus subprocess invocations across all repos and all families.

**Rationale:** Verified — gitnexus@1.6.4 has no atomic write or lock on `~/.gitnexus/registry.json`. Per-repo locks compose for repo-level concurrency but NOT for cross-family writes to the shared registry file. Cost: at most one extra ~30s–2min wait when a user races two scans across families. Benefit: zero silent registry corruption.

**Implementation sketch:**
```typescript
let globalScanLock: Promise<void> | null = null
async function withGlobalScanLock<T>(fn: () => Promise<T>): Promise<T> {
  while (globalScanLock) await globalScanLock
  let release: () => void = () => {}
  globalScanLock = new Promise<void>((r) => { release = r })
  try { return await fn() } finally { release(); globalScanLock = null }
}
// In startScan:  await withGlobalScanLock(() => spawnGitNexusAnalyze(repoPath))
```

### D-13-EXT-02: Scan job id format

**Belongs to:** Claude's Discretion #1.

**Recommendation:** UUID v4 via `node:crypto.randomUUID()`. Verified to work locally (`node -e` probe). Zero deps, URL-safe, recognisable in logs.

**Rationale:** ULID would be marginally shorter and sort-friendly, but: the daemon's Map doesn't need sort order, and ULID adds a dep that violates the spirit of "no new deps". Short hashes have collision risk too high to ignore even at 22-repo scale. UUID v4 is the cheap right answer.

### D-13-EXT-03: In-memory job state Map shape

**Belongs to:** Claude's Discretion #2.

**Recommendation:** Two `Map`s — `scans: Map<scanId, ScanJob>` (per-repo) and the same Map also holds family-scan jobs (different shape, discriminated union via `kind: 'repo' | 'family'`). One Map keeps eviction logic simple.

**Job shape (single-repo):**
```typescript
type RepoScan = {
  kind: 'repo'
  scanId: string
  repoId: `${CoverageFamily}/${string}`
  state: 'running' | 'done' | 'error'
  startedAt: string
  completedAt?: string
  error?: { code: GitnexusScanErrorCode; message: string }
}
```

**Job shape (family):**
```typescript
type FamilyScan = {
  kind: 'family'
  scanId: string
  familyId: CoverageFamily
  state: 'running' | 'done'   // family never reports 'error' — partial success per D-13-05
  startedAt: string
  completedAt?: string
  total: number
  completed: number
  failed: number
  currentRepoId: `${CoverageFamily}/${string}` | null
  currentScanId: string | null
  perRepoResults: Array<{ repoId: string; state: 'done' | 'error'; error?: { code: string; message: string } }>
}
```

### D-13-EXT-04: Job retention TTL after settle

**Belongs to:** Claude's Discretion #2 (implied).

**Recommendation:** **60s** after `state` transitions to `done | error`. Implementation: `setTimeout(() => scans.delete(scanId), 60_000).unref()` armed inside the spawn's finally block.

**Rationale:** SPA polls every 1.5s. A pause-tab-then-return cycle could be ~10–30s. 60s comfortably covers that without growing the Map indefinitely. 5min is overkill for ~30s scans and starts to feel like state we should persist (we shouldn't — CONTEXT chose in-memory).

### D-13-EXT-05: Polling cadence

**Belongs to:** Claude's Discretion #3.

**Recommendation:** **1500ms** (matches CONTEXT seed). TanStack `refetchInterval: (q) => q.state.data?.state === 'running' ? 1500 : false`.

**Rationale:** For typical 10s–2min scans, 1500ms means 7–80 polls. Each poll is a trivial Map lookup + JSON serialize on the daemon side (<1ms). At 22-repo family scan worst case ~11min, that's ~440 polls = ~6/s aggregate across 22 short-polling scan tabs IF the user opens 22 tabs simultaneously — they won't. Single-row scan = ~6 polls. Negligible cost.

**Alternatives ruled out:**
- 500ms — overkill; spawn launch latency alone is ~50ms.
- 3000ms — perceptible UI delay between done and ✓ flip.

### D-13-EXT-06: Error code taxonomy

**Belongs to:** Claude's Discretion #4.

Mirrors Phase 12's `registryFixPath` shape. Full enumerated set:

| Code | HTTP | When | UI mapping |
|------|------|------|------------|
| `BINARY_NOT_FOUND` | 503 | `detectGitNexusBinary()` returns false at POST time (binary uninstalled since last health response) | toast "GitNexus is not installed — install and try again" |
| `REPO_NOT_REGISTERED` | 404 | POST body `repoId` not in registry | toast "Repo not found in registry — re-register and try again" |
| `FAMILY_HAS_NO_REPOS` | 404 | Family-scan POST: no repos under that family | toast "No repos in family <familyId>" |
| `SCAN_IN_FLIGHT` | 409 | Per-repo lock held when POST arrives | toast "A scan is already running for this repo" |
| `BIND_REFUSED` | 403 | bindMode !== 'loopback' (D-13-11) | NOT shown — SPA renders disabled pill instead (D-13-11b) so this 403 should never fire from the dashboard. Logged if it does. |
| `RATE_LIMITED` | 429 | Token-hash sliding window exceeded (10/10s) | toast "Too many requests — try again in a few seconds" |
| `SCAN_NOT_FOUND` | 404 | GET `/scan/:id` after TTL eviction or daemon restart | toast "Scan was interrupted" |
| `SCAN_FAILED` | (200 with state='error', no HTTP-level error) | gitnexus subprocess exited non-zero | toast "Scan failed: gitnexus exited with code N" (no stderr) |
| `SCAN_TIMEOUT` | (200 with state='error') | execa 5-min timeout fired | toast "Scan timed out after 5 minutes" |
| `INVALID_REQUEST` | 422 | Zod body parse failure | toast "Invalid request — please reload" |
| `INTERNAL_ERROR` | 500 | Unexpected throw | toast "Scan failed — see daemon logs" |

**Note on `SCAN_FAILED` / `SCAN_TIMEOUT`:** These are observed via GET (state='error'), NOT via a POST 5xx — because the POST returns 200 immediately once the scan is registered. The progressive error surfaces in the poll cycle.

### D-13-EXT-07: Toast copy strings (researcher recommendation; UI-Spec phase refines)

Starter set — planner can adopt or tweak:

| Event | Variant | Copy |
|-------|---------|------|
| Single-repo scan started | (no toast — pill shows spinner) | — |
| Single-repo scan done | success | "Indexed <family>/<repo>" |
| Single-repo scan error | error | "Indexing failed: <mapped code message>" |
| Family scan started | (no toast — header button shows spinner + "Scanning X/Y") | — |
| Family scan done (all ✓) | success | "Scanned <N> repos in <familyId>" |
| Family scan done (partial) | error | "<C>/<N> scanned, <F> failed — retry failed?" (action: re-issue per-repo POSTs for failed ones) |
| Scan over Tailscale attempt (defence in depth) | error | NOT REACHABLE in practice — D-13-11b's disabled pill prevents click |
| Scan interrupted (SCAN_NOT_FOUND post-restart) | error | "Scan was interrupted — daemon may have restarted" |

## Validation Architecture

> Lift this entire section into PLAN.md task validation sections.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@latest` (already in workspace) |
| Config file | `packages/agent/vitest.config.ts` + `packages/spa/vitest.config.ts` + `packages/shared/vitest.config.ts` |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan` |
| Full suite command | `pnpm -r test` (160+ tests as of Phase 1 close per CLAUDE.md) |

### Phase Requirements → Test Map

Phase 13 has NO REQ-IDs mapped (`phase_req_ids: null` per orchestrator brief). Below are the implementation-level test commitments planner SHOULD include as tasks. Treat them as required acceptance.

| Behaviour | Test Type | Automated Command | File Exists? |
|-----------|-----------|-------------------|-------------|
| POST returns scanId on happy path | unit | `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan.route.test --run` | ❌ Wave 0 |
| POST 409 SCAN_IN_FLIGHT on same-repo collision | unit | (same file) | ❌ Wave 0 |
| POST 403 BIND_REFUSED when bindMode='tailscale' | unit | (same file) | ❌ Wave 0 |
| POST 404 REPO_NOT_REGISTERED on unknown repo | unit | (same file) | ❌ Wave 0 |
| POST 429 RATE_LIMITED after 10 in 10s | unit | (same file) | ❌ Wave 0 |
| GET returns state='running' immediately after POST | unit | (same file) | ❌ Wave 0 |
| GET transitions running → done after execa resolves | integration | (with stub gitnexus binary fixture) | ❌ Wave 0 |
| GET 404 SCAN_NOT_FOUND after 60s+ TTL eviction | unit | (same file, with fake timers) | ❌ Wave 0 |
| useGitnexusScan invalidates ['coverage'] on done | unit (SPA) | `pnpm --filter @agenticapps/dashboard-spa test -- gitnexusScan.test --run` | ❌ Wave 0 |
| useGitnexusScanProgress stops polling on terminal | unit (SPA) | (same file) | ❌ Wave 0 |
| ScanPill renders disabled+tooltip when canScan=false | unit (SPA) | `pnpm --filter @agenticapps/dashboard-spa test -- ScanPill.test --run` | ❌ Wave 0 |
| ScanPill renders ✗+Scan when canScan=true and state=missing | unit (SPA) | (same file) | ❌ Wave 0 |
| Per-row in-flight Set isolates two concurrent scans | unit (SPA) | (CoveragePage or ScanPill harness) | ❌ Wave 0 |
| Family scan: 3 repos, 1 fails → perRepoResults carries 2 done + 1 error | integration | (with stub binary that fails on 2nd invocation by arg pattern) | ❌ Wave 0 |
| Global scan lock serialises 2 cross-family scans (Pitfall 1) | integration | `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan.lock.test --run` | ❌ Wave 0 |
| buildGitnexusIndexClipboardString returns {string, argv} both populated | unit (shared) | `pnpm --filter @agenticapps/dashboard-shared test -- clipboard.test --run` | ✅ (extend existing test at line 54) |
| Health response carries gitnexus: {installed, canScan} | unit + integration | `pnpm --filter @agenticapps/dashboard-agent test -- health.test --run` | ✅ (extend existing) |

### Sampling Rate (Nyquist)

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan` (Wave 1 & 2) and the SPA equivalent (Wave 3)
- **Per wave merge:** `pnpm -r test` — full suite green
- **Phase gate:** Full suite green + IMPECCABLE artifact composite ≥ 87 (D-10.5-03 floor; Phase 13 is calibration data point #6) before `/gsd-verify-work`

### Wave 0 Gaps

The phase WILL need these created before Wave 1 implementation can begin:

- [ ] `packages/agent/src/routes/gitnexusScan.test.ts` — route handler tests (10 cases above)
- [ ] `packages/agent/src/lib/gitnexusScan.test.ts` — job registry + spawn orchestrator unit tests
- [ ] `packages/agent/src/lib/gitnexusFamilyScan.test.ts` — family orchestrator unit tests
- [ ] `packages/agent/src/__tests__/gitnexusScan.integration.test.ts` — end-to-end with stub binary
- [ ] `packages/spa/src/lib/queries/gitnexusScan.test.ts` — hook tests
- [ ] `packages/spa/src/components/panels/coverage/ScanPill.test.tsx` — pill component tests
- [ ] Stub `gitnexus` binary fixture (e.g. `packages/agent/test-fixtures/stub-gitnexus.sh` — executable shell script that takes `analyze [path]` and exits 0 or non-zero based on env var) — needed for integration tests

## Security Domain

`security_enforcement: true` and `security_asvs_level: 1` in `.planning/config.json`. Required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bearer-token via `app.use(bearerAuth(verifyToken))` — inherited (Phase 1) |
| V3 Session Management | yes | Same bearer model — stateless |
| V4 Access Control | yes | bindMode loopback-only check (D-13-11) is the new control — model as ASVS V4 ACL on a subprocess-exec capability |
| V5 Input Validation | yes | Zod `.strict()` on GitnexusScanRequestSchema; repoId / familyId Zod-validated against registry (404 on unknown) |
| V6 Cryptography | yes (light) | `tokenHashOf` (sha256 first-8) for rate-limit key — never logged in plaintext. No new crypto in Phase 13. |
| V10 Malicious Code | yes | execa argv-array form — no shell-string, no template literal. Argument injection structurally impossible. |
| V12 Files & Resources | yes | repoId resolved through registry (whitelist, not user-supplied path). gitnexus subprocess writes to `~/.gitnexus/` — explicit /cso carve-out (CLAUDE.md "daemon writes confined to `~/.agenticapps/dashboard/`"). |

### Known Threat Patterns for the daemon-subprocess stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Argument injection into `gitnexus analyze` argv | Tampering | execa argv-array form (T-10-03-02 precedent); repo path resolved server-side via registry lookup, NEVER from POST body |
| Subprocess execution triggered from remote browser (Tailscale) | Elevation of Privilege | D-13-11 bind-mode refusal — 403 when `bindMode !== 'loopback'` regardless of bearer; SPA also gates via `canScan` to prevent click |
| Resource exhaustion (DoS via repeated scan POSTs) | Denial of Service | Rate limiter (10/10s, per-token-hash); per-repo lock (409); global scan lock (D-13-EXT-01) serialises across families |
| Information disclosure via stderr | Information Disclosure | GET returns ONLY `{state, error?: {code, message}}` — no raw stderr, no file paths. Mapped error codes only. |
| Race on `~/.gitnexus/registry.json` writes (Pitfall 1) | Tampering | D-13-EXT-01 global scan lock — serialise all gitnexus subprocess invocations |
| Symlink swap between repo discovery and spawn (TOCTOU) | Tampering | realpath re-canonicalisation immediately before spawn + family-root containment check — same as `coverage.ts:114-136` |
| Side effect into `~/.gitnexus/registry.json` (CLAUDE.md write-boundary exception) | Tampering (low — user's own home) | Document as explicit `/cso`-acknowledged exception in PLAN.md `<threat_model>`. Justification: daemon does not write; the spawned subprocess does. User's home is the legitimate destination. |
| Scan-id forgery via guessing `GET /scan/:id` | Spoofing | randomUUID is 122 bits of entropy — unguessable. Bearer auth still required. |
| Stale scan id reused after daemon restart | Spoofing (low — wrong-payload-shape) | In-memory state; restart loses jobs; SPA gets 404 SCAN_NOT_FOUND → "scan was interrupted" toast. No security impact. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gitnexus` CLI on PATH | All scan paths | ✓ | 1.6.4 (`gitnexus --version`) | — (binary absence is the explicit D-13-07 fallback — InstallGitNexusButton) |
| `execa` | Subprocess spawn | ✓ | 9.6.1 (`packages/agent/package.json:51`) | — |
| Node `node:crypto.randomUUID` | scanId generation | ✓ | builtin (probed live) | — |
| `~/.gitnexus/` directory at test time | Some integration tests | ✗ on dev machine | — | Tests create tmp `.gitnexus` via `gitnexusHomeOverride` (Phase 10 pattern, `coverageScan.ts:79-81`) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None requiring planner action.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node:crypto.randomUUID` is available on the daemon's runtime Node version | D-13-EXT-02 | LOW — verified live; fallback to `randomBytes(16)` is trivial |
| A2 | The existing `coverageSpawn.ts:resolveGitNexusBin` + `which` flow works under launchd's minimal PATH | code recon | MEDIUM — Phase 10.6 explicitly added `detectGitNexusBinary` (stat-based) to handle launchd; recommend using BOTH (detect at health-response time, resolve at spawn time) |
| A3 | The user's per-row click → per-row Scan affordance pattern is what they want (vs. a context menu) | D-13-08 | LOW — CONTEXT.md explicitly locks "replace ✗ with Scan pill" |
| A4 | Family-scan toast copy "N/M scanned, F failed — retry failed?" satisfies UI-Spec | D-13-EXT-07 | LOW — labelled as starter; UI-Spec phase will refine |

**All `[ASSUMED]` items above are low-risk and verifiable in the first task that touches them. No user confirmation needed before planning.**

## Open Questions (RESOLVED)

1. **Should the route mount at `/api/gitnexus` or `/api/admin/gitnexus`?**
   - What we know: Phase 12's `registryFixPath` mounted at `/api/admin/registry/fix-path` (cf. `app.ts:141`). The "admin" prefix signals mutations.
   - What's unclear: Is gitnexus scan an "admin" surface or a "regular feature" surface from a route-organisation standpoint?
   - Recommendation: Mount at `/api/gitnexus/scan` (NOT admin-prefixed). Rationale: this is a per-repo user action, not a daemon-admin operation. Phase 12's `/api/admin/registry/fix-path` is admin because it mutates the registry; Phase 13 just spawns a subprocess. Matches the conceptual scope of `POST /api/coverage/refresh` (also non-admin in Phase 10).
   - **RESOLVED:** Mounted at `/api/gitnexus` (non-admin prefix) — see Plan 13-02 `<interfaces>` block `app.route('/api/gitnexus', gitnexusScanRoute)` and Task 3 step 2 (CoveragePage line reference ~141 in `app.ts`).

2. **Should the family-scan POST take `familyId` or `repoIds[]`?**
   - What we know: D-13-04 says sequential, alphabetical, all repos in the family.
   - What's unclear: Does the SPA want to drive a custom-subset scan (e.g. "scan only the 3 missing ones in this family")?
   - Recommendation: For v1.3.0, accept ONLY `{ familyId }` — server enumerates. If a custom-subset need surfaces in dogfooding, fold into v1.3.x with `{ familyId, repoIds?: string[] }`.
   - **RESOLVED:** Plan 13-00 schema accepts `{scope:'family', target: familyId}` only — the daemon enumerates repos server-side via `startFamilyScan(...)` (see Plan 13-02 Task 2). Custom-subset deferred to v1.3.x.

3. **Does the post-Phase-13 SPA still need `IndexGitNexusButton.tsx` as a file?**
   - What we know: D-13-06 removes the page-header mount. The CONTEXT §"Reusable Assets" line says "keep `InstallGitNexusButton` … delete `IndexGitNexusButton`".
   - What's unclear: Was the comment ambiguous? Re-reading carefully: "keep `InstallGitNexusButton` as-is (binary-missing fallback per D-13-07); delete `IndexGitNexusButton` (replaced by per-row/per-family Scan affordances per D-13-06)." — unambiguous.
   - Recommendation: **Delete `IndexGitNexusButton.tsx`** outright. The "indexing" affordance moves into the per-row + per-family Scan pills. See Pitfall 8.
   - **RESOLVED:** `IndexGitNexusButton.tsx` + `.test.tsx` deleted in Plan 13-03 Task 4 via `git rm`; grep verification asserts zero remaining references in `packages/spa/src/`.

## Sources

### Primary (HIGH confidence)

- **Live `gitnexus --help` + `gitnexus analyze --help`** — invocation contract verified
- **`~/.local/state/fnm_multishells/.../gitnexus/dist/storage/repo-manager.js`** (lines 240-260) — direct read confirmed no atomic write / no lock on registry.json
- **`packages/agent/src/routes/registryFixPath.ts`** — full Phase 12 donor pattern, all 253 lines
- **`packages/agent/src/routes/coverage.ts`** — Phase 10 per-repo lock + spawn precedent
- **`packages/agent/src/lib/coverageSpawn.ts`** — execa argv-array spawn pattern
- **`packages/agent/src/lib/rateLimiter.ts`** — rate-limit primitive
- **`packages/agent/src/server/app.ts`** — Env.Variables + middleware chain (the bindMode plumbing gap is visible here)
- **`packages/agent/src/server/boot.ts`** — BootOptions.bindMode source-of-truth
- **`packages/spa/src/components/panels/conformance/PathDriftPanel.tsx`** + **`packages/spa/src/lib/conformanceQueries.ts`** — Phase 12 hook + per-row-Set donor pattern
- **`packages/spa/src/components/panels/coverage/CoveragePage.tsx`** — composition site; line 38, 316-327, 100-103 in particular
- **`packages/shared/src/clipboard.ts:34-36`** — buildGitnexusIndexClipboardString current shape
- **`docs/spec/dashboard-prompt.md:693-694`** — read-only-projects + daemon-write-boundary spec language

### Secondary (MEDIUM confidence)

- **GitHub `abhigyanpatwari/GitNexus/ARCHITECTURE.md`** via WebFetch — confirmed the `lbug.lock` is per-repo, not on registry.json
- **WebSearch results for "gitnexus registry.json concurrency"** — surfaced the architecture URL; no contradictory sources found

### Tertiary (LOW confidence)

- None used as load-bearing claims.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every library and version verified against `package.json`, npm view, or live execution
- Architecture: **HIGH** — every donor pattern is current code in the repo with file:line references
- Pitfalls: **HIGH** for items 1–7 (verified live or from recent in-tree code); MEDIUM for #8 (judgement call about file deletion vs unused-export)
- gitnexus CLI behaviour: **HIGH** — verified live on the dev machine
- gitnexus concurrency safety: **HIGH** — verified by direct read of installed source

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (30 days — gitnexus CLI is on rapid rev cadence; recheck before any v1.3.x extension)

## RESEARCH COMPLETE
