# TODOS

Captured from `/review` of phase 12 (`feat/dash-12-followup`, PR #39).
Tier 3 informational findings deferred from the PR. Each entry cites
the source agent and the finding's confidence at review time.

## Phase 12 followup — Tier 3 (informational)

### Backend

- ~~**[INFORMATIONAL] (Security #4 / Testing #7, confidence 7/10)** — `/api/observability/conformance` has no rate-limit and no single-flight dedup. On cold cache N concurrent GETs from the same token each invoke `scanConformance()` (every call reads every family's `.git/config` + registry + 90 days of NDJSON). Add `rlConsume(tokenHashOf(token))` at route entry OR wrap `scanConformance` in an inflight-promise singleton.~~
  - ~~File: `packages/agent/src/routes/conformance.ts:35`~~
  - **CLOSED 2026-05-21** by `fix/dash-12-conformance-inflight-dedup`. Took the inflight-promise singleton option (not the rate-limit) since it's the closer fit for "N concurrent callers run scanConformance once" and doesn't add per-token state. `getOrComputeConformance(compute)` lives in `lib/conformanceCache.ts` and owns the cache + inflight slot together; route collapses to `await getOrComputeConformance(() => scanConformance())`. Failure resets the inflight slot (try/finally) so rejected scans don't poison subsequent calls. Tests: 5 helper-level + 2 route-level (RED concurrent-fan-out + retry-after-reject). Rate-limit-style protection against a single misbehaving token is a separate concern; not added here.
- ~~**[INFORMATIONAL] (Adversarial F3, confidence 7/10)** — `conformanceScan.pathToRepoId` compares against the raw `COVERAGE_ROOTS[family]()` value, not its realpath. On macOS where `/Users` ≠ `/private/Users` for `/tmp`, drift detection and scoring disagree silently. Realpath family roots once at module init.~~
  - ~~File: `packages/agent/src/lib/conformanceScan.ts:59-72`~~
  - **CLOSED 2026-05-21** by `fix/conformance-pathToRepoId-realpath`. Per-call realpathSync inside pathToRepoId rather than module-init: tests mutate COVERAGE_ROOTS at runtime (registryFixPath.test pattern) and a module-init cache wouldn't see those mutations. Per-entry cost is sub-ms; the loop runs < 10× per scan. Defensive ENOENT skip so an absent family dir on this machine doesn't throw out of the hot drift-translation loop. RED test plants a symlinked family root (cross-platform — doesn't rely on macOS /tmp quirk) and shows agenticapps score flips from 100 (drift exclusion silently broken) to 0 (works).
- ~~**[INFORMATIONAL] (Security #5, confidence 6/10)** — fix-path family-root containment allows `canonical === root` (i.e. registering a family root itself). Tighten to strict `canonical.startsWith(root + sep)`.~~
  - ~~File: `packages/agent/src/routes/registryFixPath.ts:152`~~
  - **CLOSED 2026-05-21** by `fix/registry-fix-path-strict-family-containment`. Dropped the `canonical === r` arm at registryFixPath.ts:175. Pure tightening — every previously-valid input (subpaths of family roots) still works; only the boundary case (newPath = a family root itself) flips from 200 to 422 newPath_outside_family_roots. New Test 8c covers the boundary; the four other family-root tests (6, 7, 8, 8b) are unchanged. No corresponding tightening added to `addProject` / the CLI register path — that's a separate question (a family root with a `.git/config` is registrable via `agentic-dashboard register` today). Out of scope for this TODO entry.
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

- ~~**[INFORMATIONAL] (Adversarial F12, confidence 7/10)** — `FleetTrendChart` hover/focus state machine has multi-modality bugs: tab-focusing one cell + mouse-hovering another overwrites the panel; 90 sequential `tabIndex=0` rects create 90 tab stops. Replace with a single keyboard navigator (arrow keys move a cursor, Enter opens panel).~~
  - ~~File: `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx:74-89`~~
  - **CLOSED 2026-05-21** by `fix/fleet-trend-chart-keyboard-nav`. Chart now has ONE tab stop (the SVG itself with `tabIndex=0` + `role="application"`); the 90 per-day rects are `tabIndex=-1` and serve as mouse/touch hit targets only. Keyboard nav: ArrowLeft/ArrowRight step a `cursorIdx` state by one day; Home/End jump to the extremes; Enter/Space pin the cursor at the current position; Escape clears it. Multi-modality fix: hover state and cursor state are now SEPARATE — `activeIdx = hoverIdx ?? cursorIdx`, so a mouse hover wins while the mouse is over a rect and the keyboard cursor takes back over the moment the mouse leaves. A vertical accent line marks the keyboard-cursor position (rendered only when hover is null). 3 new tests added: ArrowLeft from focused SVG advances cursor + opens panel; Home/End jump correctly; mouse-hover-wins-over-cursor pin (S12b); exactly-one-tab-stop assertion (S12c). Existing S9/S11/S12 tests refactored to query `rect[tabindex="-1"]` and to fire keyDown on the SVG instead of focus on rects.
- **[INFORMATIONAL] (Adversarial F13)** — `PathDriftPanel` manual-path input has no client-side family-root validation hint. Combined with the rate-limit, users can blow through 10 bad paste attempts in 10 seconds with no actionable guidance. Add inline help text listing the three family roots, or surface the family-root list from the daemon.
  - File: `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx:157-167`

### Test coverage gaps (from testing specialist)

- **(Testing #4)** — `snapshotFleetReader` window cutoff boundary untested. Add tests pinning `cutoffIso` inclusive (file dated exactly cutoff included, cutoff-1 excluded) for both `windowDays=7` and `windowDays=90`.
- **(Testing #5)** — `T-12-RACE-PRUNER` catch (`readFileSync` ENOENT mid-walk → skip day) untested. Spy on `fs.readFileSync` to throw ENOENT for one file; assert that day absent, others present, no throw.
- **(Testing #6)** — Test P9 weak assertion (post-fix #2 it's strengthened, but the parameterised P9-* tests could verify the raw `apiFetch` body parsing more directly, not just the final toast text).
- **(Testing #8)** — Concurrent fix-path race untested. Fire two parallel POSTs with same id, different newPaths; assert one returns 200 and one returns either 200 or `registry_lock_timeout` (after fix #9, both succeed serially).
- **(Testing #10)** — Two remaining 422 codes from fix #2 still un-asserted at SPA layer: `rate_limited` and `project_not_found` toast paths.
- **(Testing #11)** — `inferSuggestedPath` malformed `.git/config` case (after fix #2 the per-section parser handles it, but no test pins `[remote "origin"]` with no url + nothing else → null return).
