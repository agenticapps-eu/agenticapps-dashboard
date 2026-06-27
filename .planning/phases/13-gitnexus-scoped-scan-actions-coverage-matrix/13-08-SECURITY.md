# Plan 13-08 — Security Audit (Post-Fix)

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08 (Codex Review Fix-up)
**Audit date:** 2026-05-26
**Reviewer:** `/cso` role applied to fix diff `main..feat/phase-13-gitnexus-scoped-scan` (range `da97fdf..62725b5`)
**Scope:** Verify that the 9 Codex review findings closed by Plan 13-08 leave the Phase 13 threat model intact (no regressions) and improve the path-resolution surface (the two CRITICAL findings).

## Threat-model summary (post-fix)

Phase 13 introduced the daemon `POST /api/gitnexus/scan` family of routes that spawn `gitnexus analyze` as a subprocess with `cwd=<repo-root>`. The original threat surface (T-13-02-01 … T-13-02-08) was kept structurally intact by D-13-EXT-08; Codex review found that the structural claim was prose-only on two points (regex traversal + symlink escape). Plan 13-08 makes those claims structurally true.

### T-13-02-01 — Argument injection / path traversal (CLOSED, structurally enforced)

**Before Plan 13-08:** Wire regex `/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/` accepted `agenticapps/..` because `.` is in the repo character class. Threat-model comment claimed otherwise.

**After:** D-13-EXT-11 (commit `c2b1a1a`) tightens the regex to require repo segment to start with `[a-z0-9]` AND adds a `.refine()` that rejects `.`/`..`/embedded `..`. D-13-EXT-09 corollary in `deterministicRepoRoot()` adds defence-in-depth dot-segment rejection at the helper level so the safety invariant survives non-route call paths.

**Verification:** `packages/shared/src/schemas/gitnexusScan.test.ts` lines 226-274 — 7 cases covering `..` (trailing), `.` (trailing), `..` substring, leading `.`, leading `-`, leading `_`, plus a positive-case sweep of 9 known-good repo names from the wild.

### T-13-02-02 — Elevation of privilege over Tailscale (CLOSED, now wire-level enforced)

**Before:** Bind-mode check ran AFTER zValidator middleware (in-handler), so a non-loopback caller paid Zod parse cost on malformed JSON before receiving 403.

**After:** D-13-EXT-15 (commit `62725b5`) inserts a Hono middleware BEFORE zValidator that 403s on non-loopback bindModes. Non-loopback callers now pay zero parse cost.

**Verification:** `packages/agent/src/routes/gitnexusScan.test.ts` lines 198-216 — explicit test: tailscale + malformed JSON → 403 BIND_REFUSED (not 422 INVALID_REQUEST).

### T-13-02-NEW (Codex CRITICAL #2) — Symlink escape via deterministicRepoRoot (CLOSED)

**Before:** `deterministicRepoRoot()` ran `statSync().isDirectory()` but never `realpathSync`'d. A symlink at `~/Sourcecode/agenticapps/evil → /etc` passed the directory check and let the daemon spawn `gitnexus analyze` with `cwd=/etc`.

**After:** D-13-EXT-09 corollary (commit `0cd054c`) `realpathSync.native`s BOTH the candidate AND the family prefix; refuses unless `realCandidate.startsWith(realFamilyPrefix)`. Realpathing both sides handles macOS `/var ↔ /private/var` aliasing transparently. Mirrors the `assertSnapshotDirInDaemonHome` idiom from `server/boot.ts:98-116`.

**Verification:** `packages/agent/src/lib/deterministicRepoRoot.test.ts` — 7 cases: symlink escape outside family root, normal dir, alias within family, regular file, dot-segments, unknown family, nonexistent.

### T-13-02-NEW (Codex WARNING #2) — Subdir hijack via registration (CLOSED)

**Before:** A registered path `~/Sourcecode/agenticapps/repo/subdir` was accepted by `assertRegistrationAllowed`. Scans for `agenticapps/repo` then resolved to the subdir because `derivedRepoId()` only reads the first two path segments past `~/Sourcecode/`.

**After:** D-13-EXT-09 corollary (commit `b53df74`) — `assertRegistrationAllowed` rejects paths with more than two trailing segments under `~/Sourcecode/{known-family}/`, throwing `RegistrationPathBlocked` with reason `'sourcecode-family-subdir'`. Rule scoped to known families; non-family paths and paths outside `~/Sourcecode/` are unaffected.

**Verification:** `packages/agent/src/lib/registry.test.ts` lines 410-465 — 6 cases: subdir reject, deeply-nested subdir reject, repo root allow, family root allow, non-family deep allow, outside-Sourcecode allow.

### T-13-02-NEW (Codex WARNING #3) — Family-vs-family concurrency races (CLOSED)

**Before:** Two overlapping family scans for the same family both registered and ran; the loser's per-repo `startScan` calls returned `SCAN_IN_FLIGHT` and were recorded as permanent failures in `perRepoResults`.

**After:** D-13-EXT-12 (commit `cec41e9`) introduces `familyInflight: Map<KnownFamily, string>` with `tryAcquireFamilyLock` / `releaseFamilyLock`. `startFamilyScan` rejects with 409 SCAN_IN_FLIGHT when held. Release lives in `startFamilyScanBody`'s `try/finally` so a thrown body cannot wedge the lock; defence-in-depth release in the `.catch(...)` of the fire-and-forget invocation.

**Verification:** `packages/agent/src/lib/gitnexusFamilyScan.test.ts` D-13-EXT-12 describe — 3 cases: same-family reject, different-family allow, lock-released after normal completion.

### T-13-02-NEW (Codex WARNING #5) — Orphaned subprocesses on daemon shutdown (CLOSED)

**Before:** Daemon SIGTERM left `gitnexus analyze` subprocesses orphaned, holding `~/.gitnexus/registry.json` locks past daemon exit.

**After:** D-13-EXT-13 (commit `c50e2b5`):
- `coverageSpawn.spawnGitNexusAnalyze` gains optional `onSubprocess` callback.
- `gitnexusScan.ts` tracks each execa subprocess in `activeChildren` Set; `disposeAllInflightScans()` SIGTERMs each + schedules unref'd SIGKILL escalation after 2s grace.
- `server/boot.ts` registers `disposeAllInflightScans` as a disposer so `gracefulShutdown` drains it on both happy-path close AND kill-timer fallback.

**Verification:** `packages/agent/src/lib/gitnexusScanShutdown.test.ts` — 2 cases using a real `sleep` script via the bin-override seam: subprocess tracked → dispose drains set.

### T-13-02-NEW (Codex WARNING #1) — Family-scan UX/scope drift (CLOSED, no security implication)

**Before:** `startFamilyScan` walked `registry.entries` filtered by family prefix. Coverage matrix is FS-discovered (superset). A user scanned a family expecting "scan what I see"; got "scan what I registered". Same defect at the family level as the per-row defect closed by D-13-EXT-08.

**After:** D-13-EXT-09 (commit `df07c29`) — new helper `deriveFamilyReposFromFs(familyId)` reads `~/Sourcecode/{family}/` directly and filters each candidate through the hardened `deterministicRepoRoot()`. This is the same chokepoint hardened by D-13-EXT-09 corollary; path-safety holds uniformly across per-row and per-family scans.

**Security net:** No new attack surface. Same `deterministicRepoRoot` chokepoint enforces family allow-list + realpath + directory check. The only behavioural difference is which `family/repo` ids get enumerated for scanning — both sources are constrained by the same family allow-list.

## Cross-cutting verification

- **Daemon write boundary** unchanged. `gitnexus analyze` writes only to `~/.gitnexus/` (its own home), never to the target repo. Plan 13-08 changes do not extend the daemon's write surface.
- **Bearer-token auth** still applied on every route (CORS lock + auth middleware in `app.ts` unchanged).
- **Bearer-rate-limit** still applied (Phase 12 reuse). The new bind-mode middleware short-circuits BEFORE rate-limit, which is correct — refusing wire-level access does not need to consume rate-limit tokens.
- **`~/.gitnexus/registry.json` global lock** (D-13-EXT-01) unchanged. New family lock (D-13-EXT-12) is independent and additive.

## CSO verdict

**PASS** — All 9 findings closed with structurally-enforced mitigations and RED→GREEN test evidence. The two CRITICALs (`..` regex + symlink escape) move the safety invariants from "prose claim" to "structurally true". No threat-model regressions. Two corollary improvements (subdir-hijack registration block; shutdown disposer) close adjacent surfaces that the original Phase 13 review had not identified.

Recommended follow-ups (out of scope for Plan 13-08):
- Cleanup of `deriveRepos(registry.entries)` legacy helper in `gitnexusFamilyScan.ts` (kept one release for grep history; remove post-merge).
- Cleanup of the positional-compat `_registryDeprecated` shim in `startFamilyScan` signature (kept one release).
- Audit of `routes/coverage.ts`'s `spawnGitNexusAnalyze` callsite for similar shutdown-disposer coverage. Likely needed once that path also becomes long-running.

---
*Plan 13-08 SECURITY.md*
