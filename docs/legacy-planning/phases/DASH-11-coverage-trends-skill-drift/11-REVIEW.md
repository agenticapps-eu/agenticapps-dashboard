---
phase: 11-coverage-trends-skill-drift
reviewed: 2026-05-16T15:00:53Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - packages/agent/src/lib/coverageHistoryCache.ts
  - packages/agent/src/lib/skillDriftCache.ts
  - packages/agent/src/lib/skillDriftScan.ts
  - packages/agent/src/lib/snapshots/snapshotPaths.ts
  - packages/agent/src/lib/snapshots/snapshotPruner.ts
  - packages/agent/src/lib/snapshots/snapshotReader.ts
  - packages/agent/src/lib/snapshots/snapshotScheduler.ts
  - packages/agent/src/lib/snapshots/snapshotWriter.ts
  - packages/agent/src/routes/coverageHistory.ts
  - packages/agent/src/routes/skillDrift.ts
  - packages/agent/src/server/app.ts
  - packages/agent/src/server/boot.ts
  - packages/shared/src/index.ts
  - packages/shared/src/schemas/coverageHistory.ts
  - packages/shared/src/schemas/skillDrift.ts
  - packages/spa/src/components/panels/coverage/CoverageCell.tsx
  - packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx
  - packages/spa/src/components/panels/coverage/CoveragePage.tsx
  - packages/spa/src/components/panels/coverage/CoverageRow.tsx
  - packages/spa/src/components/panels/skill-drift/SkillDriftCell.tsx
  - packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx
  - packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx
  - packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.tsx
  - packages/spa/src/components/ui/PageHeader.tsx
  - packages/spa/src/components/ui/Sidebar.tsx
  - packages/spa/src/lib/coverageHistoryQueries.ts
  - packages/spa/src/lib/skillDriftQueries.ts
  - packages/spa/src/router.tsx
  - packages/spa/src/routes/observability.skill-drift.lazy.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-16T15:00:53Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 11 introduces two new daemon trust-boundary deltas (the first-ever
daemon write path under `~/.agenticapps/dashboard/coverage-history/` and a
widened AgentLinter spawn call-site) plus a sticky-PageHeader/Sidebar IA
graduation. The implementation correctly honours the locked decisions
(D-11-01..D-11-14 and PD-11-01..PD-11-03):

- Bulk-per-repo `/api/coverage/history` shape is correctly implemented
  end-to-end (schema → route → reader → cache key → SPA hook → fanout in
  `CoverageRow`). `CoverageCell` stays presentational with a `drift?` prop
  (PD-11-02 ownership model is structurally enforced).
- `/api/skills/drift/agentlinter` is single-project-per-request, enforced
  structurally by `.strict()` Zod (D-11-14). The widened spawn surface
  reuses `runAgentLinter` and `agentLinterCache` unchanged.
- The new daemon write path enforces mode `0o600` on every file write
  (Pitfall 2 defence with `chmod` after every append), filenames are
  regex-anchored (`^\d{4}-\d{2}-\d{2}\.ndjson$`) to defend pruner/reader
  walks, and a boot-time `realpathSync` check rejects a snapshot dir whose
  realpath escapes the daemon home (T-11-02-03).
- Sidebar IA correctly graduates `Observability` from 1 entry to 2 peer
  entries (D-11-08), avoiding the user-memory anti-pattern of peer
  top-level items.
- Component name `CoverageDriftBadge` correctly avoids the Phase 6
  `InlineDrift` namespace collision.
- Bearer-auth, CORS, and outbound-schema-drift defences are inherited
  uniformly from `app.ts` middleware — both new routes are mounted under
  the same chain (no exemptions).
- `skillDriftScan` is read-only on project filesystems (only reads
  `<projectRoot>/.claude/skills` via the existing Phase 5 scanner).

The 4 Warnings are correctness/robustness issues: a never-populated
schema field, missing cache eviction on unregister, an unenforced
directory-mode contract, and a missing graceful-loading state on a
mutation. The Info items are minor code-quality observations. No
Critical issues found.

## Warnings

### WR-01: SkillDriftCell.lastModifiedIso is effectively always null

**File:** `packages/agent/src/lib/skillDriftScan.ts:158-159`
**Issue:** The aggregator reads
`(found as Record<string, unknown>).lastModifiedIso` from a `SkillEntry`,
but the upstream `skillsScan.ts:194-197` (and `SkillFrontmatterSchema` in
`packages/shared/src/schemas/skills.ts:8-14`) never populate this field —
`SkillEntry` carries only `name`, `description?`, `version?`, `dir`,
`scope`, plus YAML frontmatter passthrough. So `lastModifiedIso` will be
`null` for every cell unless a SKILL.md author manually wrote
`lastModifiedIso: <ISO>` into the YAML frontmatter (vanishingly rare).
The wire schema (`packages/shared/src/schemas/skillDrift.ts:14`) reserves
the field as `z.string().datetime().nullable()`, which masks the bug at
the contract boundary. Net effect: a designed-for-cross-project-mtime
signal is silently inert.

**Fix:** Either (a) populate `lastModifiedIso` from
`statSync(<dir>/SKILL.md).mtime.toISOString()` inside `skillsScan.ts`'s
existing loop and surface it through `SkillEntry`, or (b) drop the field
from `SkillDriftCellSchema` if it's not actually needed for v1.1. Option
(a) is the smaller change and matches the schema intent:

```ts
// In skillsScan.ts readSkillsAt() around line 197:
const stat = statSync(mdPath)
skills.push({
  ...fm,
  dir,
  scope,
  lastModifiedIso: stat.mtime.toISOString(),
} as SkillEntry)
```

Then add `lastModifiedIso: z.string().datetime().optional()` to
`SkillFrontmatterSchema` so it survives the passthrough → schema
round-trip cleanly.

### WR-02: Phase 11 caches not evicted on project unregister

**File:** `packages/agent/src/routes/registry.ts:126-138` (unregister
hook); `packages/agent/src/lib/coverageHistoryCache.ts:60-65`;
`packages/agent/src/lib/skillDriftCache.ts:52-58`
**Issue:** `registry.ts`'s unregister handler evicts five Phase 5/3/4
caches (`evictOverviewCache`, `evictPhaseCacheProject`,
`evictSkillsCacheProject`, `evictAgentLinterCacheProject`,
`evictObservabilityCacheProject`, `evictSecretsCacheProject`,
`evictIntegrationsCacheProject`) but does NOT call
`clearCoverageHistoryCache()` or `clearSkillDriftCache()`. The
`skillDriftCache` is a single global memo — after unregistering a
project, the cached `SkillDriftResponse` keeps returning a `projects`
list with the unregistered project's `projectName` for up to 30s.
`coverageHistoryCache` keeps per-repoId entries for up to 1h. Both
modules' doc comments say "called by tests + by a future unregister
hook" — the hook is missing. Cache-coherence is the documented intent
(per Phase 5 WR-01 precedent for the other five caches).

**Fix:** Wire eviction in `registry.ts` unregister handler:

```ts
import { clearCoverageHistoryCache } from '../lib/coverageHistoryCache.js'
import { clearSkillDriftCache } from '../lib/skillDriftCache.js'

// inside the unregister handler, after the existing evict calls:
if (removed) {
  // …existing evictions…
  evictIntegrationsCacheProject(body.id)
  // Phase 11 caches (WR-02): cross-project caches must clear on
  // any registry mutation since the response shape lists all projects.
  clearSkillDriftCache()
  clearCoverageHistoryCache()
  return c.body(null, 204)
}
```

`coverageHistoryCache` is keyed per-repoId, so a more precise eviction
(only the unregistered project's entry) is possible if desired, but the
nuclear clear is acceptable for a 1h TTL.

### WR-03: Snapshot dir mode 0o700 only enforced on first creation

**File:** `packages/agent/src/lib/snapshots/snapshotWriter.ts:69-71`
**Issue:** The writer chmods the day's NDJSON file to `0o600` after every
append (Pitfall 2 defence — T-11-02-01), but only sets `mode: 0o700` on
the directory when it does not exist:

```ts
if (!existsSync(dir)) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
}
```

CLAUDE.md hard constraint says "daemon refuses to start if permissions
are looser." The boot-time `assertSnapshotDirInDaemonHome` check only
verifies the realpath confinement, not the directory mode. If the
snapshot dir was created earlier (e.g., by a prior daemon run, or by a
user with a relaxed umask, or by a sibling process), and its perms are
`0o755`, the writer will happily continue appending mode-0600 files into
a world-readable parent dir — defeating the INV-02 directory-mode
invariant. The `auth.ts:88` precedent enforces the parent dir's mode
with `chmodSync(dir, 0o700)` on every lazy-init.

**Fix:** Chmod the directory on every writer call (or at boot), mirroring
the auth.ts pattern:

```ts
// snapshotWriter.ts, replace lines 69-71:
if (!existsSync(dir)) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
} else {
  // Defence-in-depth: enforce 0o700 every call so a previously-loosened
  // mode (or umask drift) cannot leave the dir readable.
  await chmod(dir, 0o700)
}
```

Alternatively, add a `chmodSync(snapshotDir, 0o700)` step to
`assertSnapshotDirInDaemonHome` in `boot.ts` so the invariant is
re-asserted at process start (cheap and matches the "refuse to start if
looser" contract more literally).

### WR-04: useAgentLinterDrift mutation in SkillDriftMatrix has no in-flight or error feedback

**File:** `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx:188-216`
**Issue:** Each `SkillDriftRow` calls `useAgentLinterDrift()` and wires
the mutate on a `Play` icon button:

```tsx
const linter = useAgentLinterDrift()
…
<button onClick={() => linter.mutate({ projectId: p.projectId })} …>
  <Play size={12} aria-hidden="true" />
</button>
```

But neither `linter.isPending` nor `linter.isError` is consumed. A user
who clicks the button gets no UI feedback that the mutation is in
flight, no error toast/inline message if AgentLinter fails (timeout,
not-installed, error variants of `AgentLinterResponseSchema`), and no
indication that the underlying matrix is refetching (`onSuccess`
invalidates the queryKey). On a slow `runAgentLinter` run (up to 30s
timeout per `agentLinterRunner.ts`), the user could re-click multiple
times and spawn redundant POSTs — `useMutation` does not dedupe by
default across separate `mutate()` calls.

**Fix:** At minimum disable the button while in-flight and surface
errors. Tighter version:

```tsx
<button
  type="button"
  disabled={linter.isPending}
  aria-label={`Run AgentLinter for ${p.projectName}`}
  onClick={() => linter.mutate({ projectId: p.projectId })}
  className={`${linter.isPending ? 'opacity-50 cursor-wait' : 'text-text-tertiary hover:text-text-secondary'} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded`}
>
  <Play size={12} aria-hidden="true" />
</button>
{linter.isError && (
  <span className="text-status-error text-xs" aria-live="polite">
    {linter.error?.message ?? 'lint failed'}
  </span>
)}
```

Also consider sharing one mutation across the whole row vs per-row — at
the moment the same mutation function is constructed once per row, so a
matrix with N rows × M projects shows M buttons per row × N rows = N×M
mutation hooks. Hook-count is fine (React is happy with this), but the
in-flight state is per-row, so two clicks in different rows can race.

## Info

### IN-01: skillDriftCache is a single global memo — registry mutations during the 30s TTL are masked

**File:** `packages/agent/src/lib/skillDriftCache.ts:26`
**Issue:** The cache is a single global entry (`let entry: Entry | null`),
intentional per the module docstring (PD-11-03: scope is a SPA-side
filter, so the daemon serves the same payload regardless). Combined with
WR-02 (no eviction on unregister), this means a register/unregister
during the 30s TTL is masked until the cache expires. Low blast radius
because the SPA also refetches every 5s via TanStack — the visible
staleness window is bounded.

**Fix:** WR-02's clear hook resolves this concretely; no separate change
needed.

### IN-02: snapshotPruner is callable with any `dir` argument

**File:** `packages/agent/src/lib/snapshots/snapshotPruner.ts:30-53`
**Issue:** `pruneSnapshotsOlderThan(dir, retentionDays, now)` accepts an
arbitrary `dir` string. The function only unlinks files matching the
anchored `SNAPSHOT_FILENAME_RE` regex, so direct filesystem traversal is
not exploitable today. But the function is exported and any future
caller passing an attacker-controlled `dir` could unlink any file
matching `^\d{4}-\d{2}-\d{2}\.ndjson$` in that dir. Production callers
go through `snapshotWriter.ts:75` with `resolveSnapshotDir()` or a test
override, so there's no current exploit path.

**Fix:** Defence-in-depth — assert at the top that `dir` resolves under
the daemon-home root before any `readdirSync` / `unlinkSync`:

```ts
import { resolveSnapshotDir } from './snapshotPaths.js'
…
const allowedRoot = resolveSnapshotDir()
if (dir !== allowedRoot) {
  // tests may pass an override — accept it but require it to be a
  // realpath-confined sibling of the daemon-home parent
  const real = realpathSync(dir)
  const expectedReal = realpathSync(join(homedir(), '.agenticapps', 'dashboard'))
  if (real !== expectedReal && !real.startsWith(expectedReal + '/')) {
    return { pruned: 0, kept: 0 } // refuse silently — defence-in-depth
  }
}
```

This is paranoia given the current callers — flagging at Info only.

### IN-03: snapshotScheduler timer race during in-flight tick

**File:** `packages/agent/src/lib/snapshots/snapshotScheduler.ts:50-71`
**Issue:** If a `tick()` is in flight (awaiting `writeDailySnapshot`)
when the disposer runs, the disposer clears `activeTimer` but the
in-flight `.finally(() => scheduleNext())` will arm a NEW timer AFTER
the disposer ran. Net effect: a fresh `setTimeout` survives the
shutdown contract briefly. In practice the timer is `.unref()`'d so it
cannot prevent process exit, and `process.exit(0)` runs immediately
after disposers — the dangling timer dies with the process. No real
correctness issue, just a contract-tightness note.

**Fix:** Set a `stopped` flag and short-circuit `scheduleNext` when set:

```ts
let stopped = false
…
function scheduleNext(): void {
  if (stopped) return
  …
}
…
return (): void => {
  stopped = true
  if (activeTimer !== null) { … }
}
```

### IN-04: SkillDriftPage shows raw schema-drift message to user

**File:** `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx:58-63`
**Issue:** The error branch renders
`body={query.error?.message ?? 'Daemon returned an error.'}` directly.
When `useSkillDrift` throws `Error('schema_drift:<path>')` (INV-04 path),
the user sees `schema_drift:projects.0.family` as the body text. By
contrast, `CoveragePage.tsx:191-200` detects the `schema_drift:` prefix
and renders the dedicated `<SchemaDriftState>` component with retry +
field detail. Consistency would help.

**Fix:** Add the same schema-drift detection:

```tsx
if (query.error?.message?.startsWith('schema_drift:')) {
  const path = query.error.message.slice('schema_drift:'.length)
  return (
    <SchemaDriftState
      firstIssue={{ path, expected: 'see schema', got: 'mismatch' }}
      fullIssues={[]}
      onRetry={() => void query.refetch()}
    />
  )
}
```

### IN-05: snapshotReader silently skips malformed JSON lines without a counter

**File:** `packages/agent/src/lib/snapshots/snapshotReader.ts:128-134`
**Issue:** `JSON.parse(line)` failures and `readFileSync` failures are
caught silently:

```ts
try { rec = JSON.parse(line) as SnapshotLine } catch { continue }
```

This is T-11-02-08 documented behaviour ("no 500s on garbage") and
matches resilience contract. However, if the NDJSON file becomes
systematically malformed (e.g., a partial write during process kill),
the user sees no drift but also no diagnostic. A debug-log line counter
would help future incident response without changing the resilience
contract.

**Fix:** Add a debug-level log of malformed line count per file when > 0:

```ts
let malformed = 0
for (const line of raw.split('\n')) {
  if (!line) continue
  let rec: SnapshotLine
  try { rec = JSON.parse(line) as SnapshotLine } catch { malformed += 1; continue }
  …
}
if (malformed > 0) {
  agentError(`[snapshotReader] ${malformed} malformed lines in ${f}`)
}
```

Or accumulate counts across files and log once per `readDriftForRepo`
call. Either way: silent corruption recovery is fine; silent corruption
swallowed without operator signal is a hygiene gap.

---

_Reviewed: 2026-05-16T15:00:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
