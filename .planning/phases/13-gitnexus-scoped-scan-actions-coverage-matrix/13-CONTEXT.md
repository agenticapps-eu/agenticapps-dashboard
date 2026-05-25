# Phase 13: GitNexus scoped scan actions (Coverage matrix) — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the clipboard-only page-header `IndexGitNexusButton` on the Coverage matrix with **scoped daemon-driven scan actions** — per-family in each section header bar, per-repo in the GitNexus column cell of any row whose status is not `present`. Daemon spawns `gitnexus analyze` as a subprocess, returns a scan job id, and the SPA short-polls until done. Coverage data auto-invalidates on success so cells flip from ✗ → ✓ without user action.

The clipboard-fallback CTA pattern (`InstallGitNexusButton`) remains for the binary-not-installed state — Phase 13 does not delete that flow, only the page-header `IndexGitNexusButton` which is being removed (D-13-06).

**Bounded by:** v1.3.0 release. Parallel family scans, scan-all-families action, scan over Tailscale, cancelable scans, streaming gitnexus stderr to the UI, scan scheduling — all deferred (see Deferred Ideas below).

</domain>

<decisions>
## Implementation Decisions

### A. UI states & placement

- **D-13-06** — Remove the page-header `IndexGitNexusButton` entirely. Per-family scope is the highest a user needs; "scan all families" is achievable by clicking each family header. Header bar reclaims the slot.
- **D-13-07** — When the `gitnexus` binary is not installed, hide the per-row and per-family Scan affordances and surface the existing `InstallGitNexusButton` (clipboard install CTA) in their place. Detection happens daemon-side at startup (PATH probe) and is reflected in the health/conformance response as `gitnexus.installed: boolean`.
- **D-13-08** — On rows where GitNexus status is `not-installed` or `installed-no-registry` (Phase 10.6 enum), replace the ✗ cell content with a `Scan` pill. The "this row has a Scan affordance" visual already implies the status; rendering ✗ + Scan duplicates signal. Mid-scan state replaces the pill with a spinner + "Scanning…" label.

### B. Daemon implementation

- **D-13-01** — Daemon spawns `gitnexus analyze` as a subprocess via `execa` (already a dep). No library import of gitnexus into the agent package's tree — preserves the "no native deps" constraint and avoids version skew with the user's installed CLI.
- **D-13-02** — Progress transport: short-poll `GET /api/gitnexus/scan/{id}` from the SPA every 1–2s while a scan is in-flight; stop on `done` or `error`. No SSE. Matches Phase 12's discipline (30s-TTL cache + manual refetch + inflight Set in `useRegistryFixPath`). No new transport infra introduced.
- **D-13-03** — Concurrency: per-repo lock. Daemon refuses a second `POST /api/gitnexus/scan` for the same repo with `409 Conflict` while a scan is in-flight. Family-scope scans are daemon-orchestrated **sequential** per-repo invocations sharing the same per-repo lock primitive — locks compose naturally. A scan of repo A in family `agenticapps` does not block a scan of repo B in family `factiv`.
- **D-13-10** — Reuse `buildGitnexusIndexClipboardString` from `@agenticapps/dashboard-shared` for command construction. Clipboard fallback and daemon scan stay in lockstep — single source of truth for "what `gitnexus analyze` invocation we run". If the shared helper currently returns only a clipboard string, extend it to also return an `argv: string[]` representation (`{ string, argv }`) so the daemon can call execa without re-quoting. This is a small surface to test once and consume in both places.

### C. Scan semantics

- **D-13-04** — Family scans process repos **sequentially** (alphabetical order by registry name) for v1.3.0. Predictable disk/git/CPU load, easy per-row progress UI (current row + queue). Bounded parallelism is a v1.3.x candidate after we measure real scan duration on a 22-repo fleet.
- **D-13-05** — Partial-success semantics. Each repo in a family scan ends with its own final state (`✓` or `✗ + error tooltip`). Family-scan completion toast: `"6/9 scanned, 3 failed — retry failed?"`. No all-or-nothing rollback — gitnexus's writes to `~/.gitnexus/registry.json` aren't transactional anyway, and one transient git error shouldn't waste 5 minutes of earlier work.
- **D-13-09** — On scan success the SPA invalidates the `useCoverage` / `useConformance` queries, TanStack Query refetches, the cell flips to ✓ on the response. Mirrors Phase 12's `useRegistryFixPath` post-mutation invalidation pattern. No optimistic update — refetch is cheap (30s-TTL cache invalidation reuses the daemon's existing flow) and the latency is hidden by the spinner that was already showing.

### D. Security posture

- **D-13-11** — Daemon **refuses** `POST /api/gitnexus/scan` and `GET /api/gitnexus/scan/{id}` when the daemon is bound to any address other than `127.0.0.1`. Returns `403 Forbidden` regardless of bearer auth. No `--allow-remote-scan` flag in v1.3.0 — adding a flag that disables a defense is an invitation to forget it's flipped on. `/cso` audits this as the primary new threat surface (`subprocess-exec-over-network`).
- **D-13-11b** — UX of refusal: daemon health/conformance response exposes a composite `gitnexus.canScan: boolean` field (computed daemon-side as `installed && bindIsLoopback`). SPA reads it and renders Scan pills **disabled with tooltip** `"Connect from the host device to scan"` when `canScan === false` but `installed === true` (Tailscale session). When `installed === false`, falls back to D-13-07 install CTA instead. Avoids click-then-fail.

### E. UAT Gap-closure extensions (post-UAT 2026-05-25)

- **D-13-EXT-07** (SUPERSEDED by D-13-EXT-08, kept for historical record) — Registry-membership is part of the SPA-bound coverage row contract. The wire schema's `CoverageRow.inRegistry: boolean` flag tells the SPA whether a row's path can be resolved by the daemon's registry-as-allowlist. UI affordances that require daemon-resolvable paths (today: `ScanPill`; future: any per-row mutation that calls `startScan`/equivalent) MUST gate on it. Surfaced by UAT Test 4 — filesystem-discovery set is a strict superset of the registry-membership set; the load-bearing precondition for any daemon-write affordance attached to a Coverage row is membership. Rejected alternatives: (B) relax registry-as-allowlist on daemon — would require fresh /cso, breaks T-13-02-01; (C) auto-register filesystem-discovered repos — hides a registration side-effect inside the scan path. Implementation in Plan 13-05: shared schema gains required `inRegistry: z.boolean()`; `coverageScan.ts::scanCoverageInternal` reads registry ONCE per scan and intersects filesystem-discovered repos with `family/repo` ids derived from `registry.projects[].root` (O(1) per row via `ReadonlySet<string>`); `CoverageRow.tsx` gate at the gitNexus cell now requires `row.inRegistry === true` in addition to the existing conditions. Closes UAT Test 4 ship-blocker.

- **D-13-EXT-08** — Supersedes D-13-EXT-07. **`row.inRegistry` is metadata only, not a render gate.** The Option-A gate from D-13-EXT-07 closed the original `REPO_NOT_REGISTERED` toast but also hid `ScanPill` on 21/22 typical filesystem-discovered rows, making the feature unusable (user feedback during UAT re-verification: *"there is no way to start a scan for a repo, this does not make sense at all"*). D-13-EXT-08 implements **Option D** (the hybrid):
  - **SPA:** `CoverageRow.tsx` renders `ScanPill` on every missing/not-applicable row when `gitnexusInstalled===true`, regardless of `row.inRegistry`. The metadata flag remains in the wire schema for future use (e.g. "Registered" tooltip, registration-aware tooling), but does NOT gate UI affordances.
  - **Daemon:** `startScan()` resolves the repo root via a 2-step lookup: (1) dashboard project registry, (2) fallback to `~/Sourcecode/{family}/{repo}` if that directory exists on disk. A new exported helper `deterministicRepoRoot(repoId)` performs the inverse of `derivedRepoId` (forward mapping `family/repo` → absolute path) and only returns a non-null value when the directory exists. Family allow-list (`agenticapps`|`factiv`|`neuroflash`) is enforced. `REPO_NOT_REGISTERED` is now only returned when BOTH the registry miss AND the filesystem path is missing.
  - **T-13-02-01 mitigation is preserved.** The original concern with Option B was that "daemon's write surface expands beyond registered paths". This is incorrect: gitnexus writes only to `~/.gitnexus/` (its own home), never to the target repo. The daemon's spawn just passes the target path. Path-traversal is structurally impossible because `GitnexusScanRequestSchema.target` is regex-constrained to `/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/` — `..`, `/`, NUL all rejected at the wire. Additional defence-in-depth: `existsSync` + `statSync().isDirectory()` checks prevent spawning against a symlink or regular file.
  - **Threat-model net:** T-13-02-01 unchanged (path traversal still blocked at wire). No new write surface (gitnexus's destination is unchanged). New (small) read surface: any directory under `~/Sourcecode/{family}/` may now be scanned without prior registration — judged acceptable since the daemon is loopback-only by default (`bindMode=tailscale` → `canScan=false`), the user authorized the daemon at startup, and the scan target was already enumerable via Coverage discovery.
  - Implementation in Plan 13-07 (4 commits: 2× RED/GREEN pairs). The `inRegistry` field, scanner intersection logic, and shared schema additions from Plan 13-05 are preserved.

### F. Codex review fix-up extensions (post-PR-#52 Codex review 2026-05-25)

Codex (session `019e6013-d98c-7a12-a6fa-beb88f24c306`) returned verdict HOLD with 2 CRITICAL + 6 WARNING + 1 INFO. Plan 13-08 closes each finding; the two architectural decisions are recorded here.

- **D-13-EXT-09** — Family-scan source-of-truth: **filesystem-aligned, not registry-driven** (closes Codex WARNING #1 — the family-level twin of D-13-EXT-08). `startFamilyScan` previously walked `registry.entries` filtered by family prefix; coverage matrix discovery is FS-driven and a strict superset, so unregistered-but-visible repos were silently skipped. New helper `deriveFamilyReposFromFs(familyId)` reads `~/Sourcecode/{family}/` directly and accepts each subdirectory that passes the hardened `deterministicRepoRoot()` (family allow-list + realpath + directory check). Rejected alternatives: (A1) keep registry-only — leaves Codex WARNING #1 open with no UX rationale; (A3) union registry∪FS — equivalent to A2 since FS is already a superset, adds dedupe overhead. Path-safety holds because `deterministicRepoRoot` is the single chokepoint for ALL family-allow-list / realpath / directory-existence enforcement, and D-13-EXT-09 hardens it (per D-13-EXT-09-corollary below) to reject symlink escapes. The legacy `deriveRepos(entries, family)` helper is retained one release for grep history and deleted post-merge. Implementation in Plan 13-08 Task 4.

  - **D-13-EXT-09 corollary (security)** — `deterministicRepoRoot()` is now realpath-guarded: after the existence + directory checks, `realpathSync.native(root)` is called and the resolved path must equal `root` OR start with the family prefix. Closes Codex CRITICAL #2 (symlink escape). Mirrors the `assertSnapshotDirInDaemonHome` idiom from `server/boot.ts:98-116`. Implementation in Plan 13-08 Task 2.

  - **D-13-EXT-09 corollary (registration)** — `assertRegistrationAllowed` now rejects paths that are subdirectories of `~/Sourcecode/{family}/{repo}` (more than one path segment past the family prefix). Closes Codex WARNING #2 (subdir hijack — a registered `.../repo/subdir` previously hijacked scans for `family/repo`). Throws `RegistrationPathBlocked` with reason `'sourcecode-family-subdir'`. Paths outside `~/Sourcecode/` are unaffected. Implementation in Plan 13-08 Task 3.

- **D-13-EXT-10** — `CoverageRow.inRegistry` is **optional** (closes Codex WARNING #6 — back-compat with pre-Phase-13 daemons). Required `z.boolean()` made the entire `/api/coverage` payload fail Zod parse against an older daemon, dropping the SPA into `SchemaDriftState`. Rejected alternatives: (B1) default-false — risks future consumers reading a synthetic value as truth; (B3) remove field entirely — out of scope for this fix-up, higher blast radius; (B4) bump `schemaVersion` to 2 — heaviest, one metadata field does not earn a version bump. Chose B2 (`z.boolean().optional()`) — older daemons surface as `undefined` honestly; current consumers post-D-13-EXT-08 treat `undefined` the same as `false`. Implementation in Plan 13-08 Task 7.

- **D-13-EXT-11** — Path-traversal regex hardened against `..` (closes Codex CRITICAL #1). The previous regex `/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/` accepted `agenticapps/..` because the repo character class includes `.`, making `..` two valid characters. The D-13-EXT-08 threat-model claim ("`..`, `/`, NUL all rejected at the wire") was prose-only, not structurally true. Fix is two-layered: (i) regex requires repo segment to START with `[a-z0-9]` (blocks `.hidden` / `-leading-dash` / `_underscore`); (ii) `.refine()` additionally rejects exact `.`/`..` segments and any `..` substring within the segment. Implementation in Plan 13-08 Task 1.

- **D-13-EXT-12** — Family-level concurrency lock (closes Codex WARNING #3). `familyInflight: Map<KnownFamily, string>` in `gitnexusScan.ts`; `tryAcquireFamilyLock` / `releaseFamilyLock` / `familyLockHeldBy` helpers. `startFamilyScan` returns `{ok:false, code:'SCAN_IN_FLIGHT'}` (HTTP 409) when held; lock released in `startFamilyScanBody`'s `finally` so a thrown body cannot wedge the lock. Different families remain independent — the global scan lock (D-13-EXT-01) still serialises gitnexus subprocesses across families. Implementation in Plan 13-08 Task 5.

- **D-13-EXT-13** — Shutdown disposer reaps in-flight gitnexus subprocesses (closes Codex WARNING #5). `activeChildren: Set<ResultPromise>` tracked in `gitnexusScan.ts`; `disposeAllInflightScans()` SIGTERMs each (execa `forceKillAfterDelay: 2000`). Registered via `registerDisposer(...)` in `server/boot.ts` so `gracefulShutdown` drains it on both the happy-path close branch AND the kill-timer fallback. Implementation in Plan 13-08 Task 6.

- **D-13-EXT-14** — `ScanPill` terminal cleanup on poll-error (closes Codex WARNING #4). Sibling effect keyed on `progress.isError` handles the case where the daemon disappears mid-poll; best-effort refetches coverage, shows error toast, clears `scanId` so the pill returns to idle. Implementation in Plan 13-08 Task 8.

- **D-13-EXT-15** — Bind-mode gate precedes `zValidator` (closes Codex INFO #2). Hono middleware before the validator returns 403 BIND_REFUSED on non-loopback bindModes; non-loopback callers no longer pay the Zod parse cost on malformed JSON. The prose comment that previously claimed this order was now structurally true. Implementation in Plan 13-08 Task 9.

### Claude's Discretion

The following are technical details the user explicitly trusts the planner/researcher to resolve. Capture in PLAN.md, not here:

- Scan job id format (UUID v4 expected, but flag any reason to prefer ULID/short hash)
- In-memory vs on-disk scan job state. Phase 13 v1.3.0 is in-memory — daemon restart loses in-flight scans (and the SPA's poll gets a 404 → toast "scan was interrupted"). On-disk persistence is over-engineering for ~30s scan lifetimes.
- Polling cadence — start at 1500ms, planner can adjust based on Phase 12 precedent
- Error code taxonomy for `/api/gitnexus/scan` failures — mirror Phase 12's `registryFixPath` shape (`code: 'BINARY_NOT_FOUND' | 'REPO_NOT_REGISTERED' | 'SCAN_FAILED' | 'BIND_REFUSED' | ...`)
- Exact toast copy strings — UI-Spec phase will refine

### Folded Todos

None — no pending todos matched Phase 13's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `docs/spec/dashboard-prompt.md` — Hard architectural constraints. **Critical for Phase 13:** `gitnexus analyze` writes to `~/.gitnexus/`, which is **outside** the daemon's normal write boundary (`~/.agenticapps/dashboard/`). Plan must surface this as an explicit, `/cso`-audited exception with documented rationale ("subprocess write side-effect to user-owned directory; daemon does not directly touch that path").
- `.planning/PROJECT.md` — Constraints list: no native deps, bearer-token auth, no Cloudflare Workers/Functions, read-only project FS.
- `.planning/ROADMAP.md` §"Phase 13" — Sub-track table + D-13-01..11 anticipated decision set (now ratified in this CONTEXT.md).

### Phase prerequisites
- `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/` — Coverage page wire schema, `CoverageRow` / `CoverageFamilySection` row+section primitives, column anatomy.
- `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — Composite floor (≥87) + calibration policy. Phase 13's IMPECCABLE artifact is calibration point #6.
- `.planning/phases/DASH-11-coverage-trends-skill-drift/11-CONTEXT.md` — D-11-02 (no hover-only disclosure — touch-compatible); D-11-03 (zero third-party JS stance).
- `.planning/phases/DASH-12-observability-conformance-surface/12-CONTEXT.md` — `useRegistryFixPath` + `PathDriftPanel` pattern (inflight Set + error-code mapping + post-mutation invalidation). Phase 13's new daemon route follows the same discipline.

### Code that Phase 13 touches or precedents
- `packages/spa/src/components/panels/coverage/IndexGitNexusButton.tsx` — Page-header CTA being removed (D-13-06).
- `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` — Clipboard install CTA being retained as the binary-missing fallback (D-13-07).
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx` — Composition point where header CTA is mounted (deletion target).
- `packages/spa/src/components/panels/coverage/CoverageRow.tsx` — Per-row composition; the GitNexus column cell becomes the per-repo Scan affordance (D-13-08).
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx` — Section header where the per-family Scan button mounts.
- `packages/agent/src/lib/coverageScan.ts` + `coverageResolver.ts` + `coverageSpawn.ts` — Daemon-side scanner precedent for subprocess invocation patterns.
- `packages/agent/src/routes/registryFixPath.ts` — Phase 12 mutation-route precedent: error codes, threat model entries, response shape.
- `packages/shared/src/...` (find `buildGitnexusIndexClipboardString`) — Shared command builder to extend with `argv` form (D-13-10).

### External
- gitnexus CLI behavior (`gitnexus analyze --help`, exit codes, stderr format). Researcher: confirm whether `gitnexus analyze` is safe to invoke concurrently on different repos against the shared `~/.gitnexus/registry.json` — if it isn't, downgrade family scan to globally-sequential even though our D-13-03 lock is per-repo.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IndexGitNexusButton.tsx` / `InstallGitNexusButton.tsx` — keep `InstallGitNexusButton` as-is (binary-missing fallback per D-13-07); delete `IndexGitNexusButton` (replaced by per-row/per-family Scan affordances per D-13-06).
- `buildGitnexusIndexClipboardString` (shared) — extend to also return `argv: string[]` so daemon and clipboard share command construction (D-13-10).
- `useRegistryFixPath` + `PathDriftPanel` (Phase 12) — direct pattern donor for `useGitnexusScan` (inflight Set, error-code mapping, post-mutation invalidation).
- `coverageSpawn.ts` (agent) — subprocess spawn pattern using execa.
- `useCoverage` / `useConformance` — TanStack Query hooks whose `queryClient.invalidateQueries` calls fire on scan success (D-13-09).
- `Toast` (single-slot, established) — partial-success messaging surface (D-13-05).

### Established Patterns
- **Daemon mutation route shape** — `POST` returns `{ok: true, id}` or `{ok: false, code, message}`; SPA hook follows TanStack Query's `useMutation` + `invalidateQueries` on success. Phase 12 codified this in `registryFixPath`.
- **30s-TTL daemon cache + manual refetch** — Phase 12 precedent. Phase 13's poll endpoint is **not** cached (in-flight state changes too fast).
- **3-state column status enum** — `present | installed-no-registry | not-installed` from Phase 10.6. D-13-08's "replace ✗ with Scan pill" applies to both non-present states. The `installed-no-registry` state surfaces a Scan pill (because gitnexus is installed but the registry hasn't been populated) — important for the user's most common transition path.
- **Bind-mode awareness** — daemon already tracks bind mode in `bindMode: '127.0.0.1' | 'tailscale' | '0.0.0.0'`. Phase 13 reads it for the D-13-11 refusal logic.

### Integration Points
- **Daemon routes**: new `packages/agent/src/routes/gitnexusScan.ts` (POST + GET). Wired in `app.ts` after the existing `registryFixPath` route. Bearer-auth middleware applies automatically.
- **Health/conformance response**: extend the existing health response with `gitnexus: { installed: boolean, canScan: boolean }`. Daemon computes `canScan = installed && bindMode === '127.0.0.1'`.
- **SPA queries**: new `packages/spa/src/lib/queries/gitnexusScan.ts` exporting `useGitnexusScan` (mutation) + `useGitnexusScanProgress` (polling query). Mirrors `packages/spa/src/lib/queries/registryFixPath.ts`.
- **Coverage row**: `CoverageRow.tsx` branches on `gitnexus.canScan` + per-repo status to render Scan pill / disabled pill / ✗ / install CTA.
- **Family section**: `CoverageFamilySection.tsx` header bar gets a `Scan family` button next to the existing summary chip.

</code_context>

<specifics>
## Specific Ideas

- The user reviewed the current Coverage page (1440×900) before this discussion and called the existing page-header CTA "weird — it is not clear what it does". The motivation for Phase 13 is that direct UX complaint, not theoretical cleanup.
- The user's deployment context: Starlink with CGNAT. The bind-mode refusal (D-13-11) reflects an awareness that Tailscale is the only way they reach the dashboard from another device, and that allowing remote scan triggers from such a session would be a meaningful expansion of attack surface for marginal UX benefit.
- 22 registered repos across 3 families (agenticapps, factiv, neuroflash) — sequential family scans (D-13-04) are realistic at this fleet size.

</specifics>

<deferred>
## Deferred Ideas

- **Bounded-parallel family scans** — v1.3.x candidate. Requires (a) confirming gitnexus's `~/.gitnexus/registry.json` writes are concurrency-safe, (b) measuring real-world scan duration to know if the win is worth the disk thrash, (c) bounded-parallel orchestrator in the daemon. (D-13-04 chose sequential for v1.3.0.)
- **Scan-all-families action** — Not in v1.3.0. User flow: click each family header. If this turns out to be a real friction point in dogfooding, fold into v1.3.x as a single header-bar action with confirm-modal.
- **Scan over Tailscale** — Not in v1.3.0 (D-13-11). If users later request it, the flag-based opt-in option (D-13-11 option 2) is a small change.
- **Cancelable scans** — Not in v1.3.0. gitnexus runs are ~10s–2min; cancel UI would consume more design surface than it's worth. Revisit if scan duration grows or a hung scan ever happens in dogfooding.
- **Streaming gitnexus stderr to the UI** — Final status + retry affordance is enough. Streaming would require SSE (Phase 13 chose short-poll, D-13-02) and a stderr panel UI.
- **Scan scheduling / cron from the dashboard** — Lives in the user's launchd / Tailscale-side automation, not in the UI.
- **Per-skill / per-language scan targeting** — Out of scope; gitnexus's whole-repo behavior is what users want.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 13's scope.

</deferred>

---

*Phase: 13-gitnexus-scoped-scan-actions-coverage-matrix*
*Context gathered: 2026-05-24*
