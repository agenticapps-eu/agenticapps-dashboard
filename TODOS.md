# TODOS

Captured from `/review` of phase 12 (`feat/dash-12-followup`, PR #39).
Tier 3 informational findings deferred from the PR. Each entry cites
the source agent and the finding's confidence at review time.

## Phase 12 followup — Tier 3 (informational)

### Backend

- **[INFORMATIONAL] (Security #4 / Testing #7, confidence 7/10)** — `/api/observability/conformance` has no rate-limit and no single-flight dedup. On cold cache N concurrent GETs from the same token each invoke `scanConformance()` (every call reads every family's `.git/config` + registry + 90 days of NDJSON). Add `rlConsume(tokenHashOf(token))` at route entry OR wrap `scanConformance` in an inflight-promise singleton.
  - File: `packages/agent/src/routes/conformance.ts:35`
- **[INFORMATIONAL] (Adversarial F3, confidence 7/10)** — `conformanceScan.pathToRepoId` compares against the raw `COVERAGE_ROOTS[family]()` value, not its realpath. On macOS where `/Users` ≠ `/private/Users` for `/tmp`, drift detection and scoring disagree silently. Realpath family roots once at module init.
  - File: `packages/agent/src/lib/conformanceScan.ts:59-72`
- **[INFORMATIONAL] (Security #5, confidence 6/10)** — fix-path family-root containment allows `canonical === root` (i.e. registering a family root itself). Tighten to strict `canonical.startsWith(root + sep)`.
  - File: `packages/agent/src/routes/registryFixPath.ts:152`
- **[INFORMATIONAL] (Adversarial F14, confidence 6/10)** — `delta14d` wire field name locks in a 14-day window. Future 30d/60d toggles break the schema. Consider renaming to `deltaBaseline` + `baselineDays: number` for v1.3+.
  - File: `packages/shared/src/schemas/conformance.ts:112-119`
- **[INFORMATIONAL] (Adversarial F9, confidence 7/10)** — `inferSuggestedPath` is O(F × M × readFile) per drift-detection cycle. With many drifted entries the first cold-cache `/api/observability/conformance` call could take seconds. Add a fan-out cap or a brief readFile concurrency limit.
  - File: `packages/agent/src/lib/registryPathDrift.ts:108-135`
- **[INFORMATIONAL] (Adversarial F10, confidence 5/10)** — `readdirSync(familyRoot)` in `inferSuggestedPath` can hang on a symlink loop named to match an origin URL. Add explicit symlink-target rejection (lstat then check `isSymbolicLink`) before descent.
  - File: `packages/agent/src/lib/registryPathDrift.ts:115`
- **[INFORMATIONAL] (followup from withRegistryLock fix #9)** — `withRegistryLock` does not detect stale lock files (crashed holder leaves `<registry>.lock` until the next 5s timeout). Add a PID-aware staleness check: if the lockfile is older than 30s AND the PID inside is dead, evict it.
  - File: `packages/agent/src/lib/registry.ts` (after fix #9)
- ~~**[INFORMATIONAL] (Codex F4 followup)** — CLI commands (`agentic-dashboard register/unregister/rename/tag`) still RMW the registry without `withRegistryLock`. The daemon's lock means nothing if CLI bypasses it. Wrap each CLI mutation site in `withRegistryLock`.~~
  - ~~Files: `packages/agent/src/cli/register.ts`, `packages/agent/src/cli/registryCmd.ts`~~
  - **CLOSED 2026-05-20** by `feat/dash-12.1-registry-lock-everywhere`. Wider fix than the TODO described: `withRegistryLock` is now pushed INSIDE `addProject`/`removeProject`/`renameProject`/`setTags`, so all callers (CLI commands AND the daemon's `/register`, `/unregister`, `/register-confirm`, `/:id/rename`, `/:id/tags` routes — which had the same symmetric gap) inherit the lock through the API surface. Impossible to bypass by adding a new callsite.

### Frontend

- **[INFORMATIONAL] (Adversarial F12, confidence 7/10)** — `FleetTrendChart` hover/focus state machine has multi-modality bugs: tab-focusing one cell + mouse-hovering another overwrites the panel; 90 sequential `tabIndex=0` rects create 90 tab stops. Replace with a single keyboard navigator (arrow keys move a cursor, Enter opens panel).
  - File: `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx:74-89`
- **[INFORMATIONAL] (Adversarial F13)** — `PathDriftPanel` manual-path input has no client-side family-root validation hint. Combined with the rate-limit, users can blow through 10 bad paste attempts in 10 seconds with no actionable guidance. Add inline help text listing the three family roots, or surface the family-root list from the daemon.
  - File: `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx:157-167`

### Test coverage gaps (from testing specialist)

- **(Testing #4)** — `snapshotFleetReader` window cutoff boundary untested. Add tests pinning `cutoffIso` inclusive (file dated exactly cutoff included, cutoff-1 excluded) for both `windowDays=7` and `windowDays=90`.
- **(Testing #5)** — `T-12-RACE-PRUNER` catch (`readFileSync` ENOENT mid-walk → skip day) untested. Spy on `fs.readFileSync` to throw ENOENT for one file; assert that day absent, others present, no throw.
- **(Testing #6)** — Test P9 weak assertion (post-fix #2 it's strengthened, but the parameterised P9-* tests could verify the raw `apiFetch` body parsing more directly, not just the final toast text).
- **(Testing #8)** — Concurrent fix-path race untested. Fire two parallel POSTs with same id, different newPaths; assert one returns 200 and one returns either 200 or `registry_lock_timeout` (after fix #9, both succeed serially).
- **(Testing #10)** — Two remaining 422 codes from fix #2 still un-asserted at SPA layer: `rate_limited` and `project_not_found` toast paths.
- **(Testing #11)** — `inferSuggestedPath` malformed `.git/config` case (after fix #2 the per-section parser handles it, but no test pins `[remote "origin"]` with no url + nothing else → null return).
