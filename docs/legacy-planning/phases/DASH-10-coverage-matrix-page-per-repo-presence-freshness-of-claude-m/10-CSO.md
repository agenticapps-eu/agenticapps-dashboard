# Phase 10: /cso Audit Document

**Auditor:** Claude (claude-sonnet-4-6) — security-focused review of Phase 10 changes  
**Branch:** phase-10-coverage-matrix  
**Diff base:** main  
**Audit date:** 2026-05-13  
**Scope:** Cross-repo filesystem trust boundary expansion, subprocess spawn surface, concurrent-request hygiene, schema-bound disclosure.  
**Prior findings cross-referenced:** CODEX HIGH-1, HIGH-2, HIGH-3, CODEX MED-14, D-5-21.

---

## A. Filesystem Trust Boundary Expansion

### A1. New allowed roots — reachability audit

Phase 10 adds 4 new filesystem roots that the daemon reads from:

| Root | Added in | Purpose |
|------|----------|---------|
| `~/.gitnexus` | `paths.ts` `COVERAGE_ROOTS.gitnexus` | GitNexus registry.json |
| `~/Sourcecode/agenticapps` | `paths.ts` `COVERAGE_ROOTS.agenticapps` | Family repo scan |
| `~/Sourcecode/factiv` | `paths.ts` `COVERAGE_ROOTS.factiv` | Family repo scan |
| `~/Sourcecode/neuroflash` | `paths.ts` `COVERAGE_ROOTS.neuroflash` | Family repo scan |

**Reachability check — /api/projects/:id/read isolation:**

The existing `/api/projects/:id/read` route validates via `resolveAllowed()` (Phase 1 original), which uses project-specific roots only (`.planning/` and `.claude/` under the registered project root). Phase 10's `COVERAGE_ROOTS` are declared in `paths.ts` but are **not passed to** `resolveAllowed()` in the read route. The read route code was not modified in Phase 10 (diff confirms no changes to `packages/agent/src/routes/projects.ts`). Therefore, the 4 new roots are **not reachable** via `/api/projects/:id/read`.

**Reachability check — new /coverage routes:**

The `GET /api/coverage` and `POST /api/coverage/refresh` routes are the ONLY paths that exercise the 4 new roots. They do so via `makeCoverageResolver()` (not via `resolveAllowed` / `resolveAllowedNamed`), which is scoped to those 4 roots exclusively.

<finding severity="info" req="COV-02" file="packages/agent/src/lib/paths.ts">
  Title: COVERAGE_ROOTS exported as a named export but not consumed by resolveAllowedNamed
  Detail: COVERAGE_ROOTS is used indirectly — callers (coverageResolver.ts) read its values to populate the allowedRoots array. This is correct architecture. The export is documentation-facing and test-convenient, not a security surface.
  Fix: None required.
</finding>

**Verdict: The new roots are correctly isolated to the dedicated coverage scanner path. INV-01 preserved — old project-read route unchanged. CONFIRMED.**

---

### A2. Scanner reads through coverageResolver (CODEX HIGH-3)

**Audit:** All 5 scanner files accept a `resolve: PathResolver` callback argument and route every external `readFileSync` / `existsSync` call through it.

Verification per scanner:

**claudeMdScanner.ts**  
- Reads: `<repo>/CLAUDE.md`, `<repo>/AGENTS.md`  
- Every read: `resolve(claudeMdPath, { allowedNames: ['CLAUDE.md', 'AGENTS.md'], roots: [repoAbsPath] })`  
- No bare `readFileSync`/`existsSync` calls on external paths.

**gitNexusScanner.ts**  
- Reads: `~/.gitnexus/registry.json`  
- Read via: `resolve(registryPath, { allowedNames: ['registry.json'], roots: [gitnexusHome] })`  
- `existsSync(gitnexusHome)` used for the "not-installed" early-exit check — this is a directory existence check (not a file read of user-controlled content), and the path is constructed from the pre-computed `gitnexusHome` override or `homedir()+'/.gitnexus'`. Acceptable.

**wikiScanner.ts**  
- Reads: `<family>/.wiki-compiler.json`, `<family>/.knowledge/wiki/.compile-state.json`  
- Both reads go through `resolve(configPath, { allowedNames: ['.wiki-compiler.json'], roots: [familyAbsPath] })` and `resolve(statePath, { allowedNames: ['.compile-state.json'], roots: [familyAbsPath] })`.  
- `existsSync(resolvedConfig)` and `existsSync(resolvedState)` are called AFTER the resolver validates the path — acceptable (existence check on an already-validated path).

**workflowVersionScanner.ts**  
- Reads: `~/Sourcecode/agenticapps/claude-workflow/migrations/*.md`, `<repo>/.claude/skills/*/SKILL.md`  
- Migration files: `resolve(migFile, { extension: '.md', roots: [migrationsDir] })` per file.  
- SKILL.md probes: `resolve(skillPath, { allowedNames: ['SKILL.md'], roots: [repoAbsPath] })`.  
- `readdirSync(migrationsDir)` for file listing — migrationsDir is a pre-computed path (not user input); the readdir result is then filtered through resolver calls per file.

**overrideSentinelScanner.ts**  
- Reads: `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinels  
- Discovery via `readdirSync(phasesDir)` — `phasesDir = join(repoAbsPath, '.planning', 'phases')`, path resolved through resolver first.  
- Sentinel existence: `existsSync(sentinelPath)` on post-resolver path.  
- Git-log timestamp: `spawnSync('git', ['log', '-1', '--format=%aI', '--', sentinelPath], { cwd: repoAbsPath })` — git is invoked as argv-array, cwd is pre-validated repoAbsPath, sentinelPath is on the resolved-and-validated path. No shell interpolation.

<finding severity="info" req="COV-02" file="packages/agent/src/lib/scanners/gitNexusScanner.ts">
  Title: existsSync(gitnexusHome) bypasses resolver for directory presence check
  Detail: The not-installed early-exit (`if (!existsSync(gitnexusHome)) return { installed: false, entries: [] }`) checks the directory directly rather than routing through resolve(). The path is hardcoded from homedir()+'/.gitnexus' (or test override), not from user input, and it is a directory existence check only (no content read). This is a minimal and acceptable bypass — the resolver's purpose is to prevent path traversal on user-controlled inputs; gitnexusHome is not user-controlled.
  Fix: None required. Document in scanner comments as intentional (already present in source comment).
</finding>

**Verdict: CODEX HIGH-3 CONFIRMED CLOSED. Every scanner routes all content reads through the PathResolver. The sole resolver bypass (gitNexusScanner directory-existence check) is on a daemon-controlled path only.**

---

### A3. repoDiscovery symlink escape guard (CODEX HIGH-2)

**Audit:** `repoDiscovery.ts` — symlink escape rejection.

For each candidate repo under a family root:
1. `realpathSync(repoAbs)` → `realRepo`
2. `realpathSync(familyRoot)` → `realFamily`
3. Assert: `realRepo === realFamily || realRepo.startsWith(realFamily + sep)`
4. If assertion fails: log `safety.symlink-escape` event, `continue` (skip repo entirely)

The check uses `path.sep` (OS path separator, not hardcoded `/`) — correct for macOS.

The check runs BEFORE the `statSync(repoAbs).isDirectory()` check — symlink detection precedes directory check, so a symlink to a file (not a directory) is caught by symlink escape guard first.

Broken symlinks (realpathSync throws): caught by the `try/catch` block → silently skipped. Acceptable behavior — a broken symlink is not a valid repo.

<finding severity="info" req="COV-02" file="packages/agent/src/lib/repoDiscovery.ts">
  Title: Symlink escape guard emits structured warn log but does not surface to user
  Detail: When a symlink escape is detected, `agentError(JSON.stringify({ event: 'safety.symlink-escape', ... }))` is called. This is correct for operational logging but the /coverage page silently excludes the repo without informing the user. A user who accidentally creates a symlink in a family root gets no visibility into why a repo is missing from the matrix.
  Fix: Consider adding a `skippedRepos` count or similar to the CoverageResponse for future observability. Not blocking for Phase 10 — the logged warning is the correct security response.
</finding>

**Verdict: CODEX HIGH-2 CONFIRMED CLOSED. repoDiscovery rejects symlinks that escape the family root via realpathSync + family-root prefix assertion.**

---

## B. Subprocess Spawn Surface

### B1. Binary resolution — PATH lookup, no npx (D-5-21)

**Audit:** `coverageSpawn.ts` `resolveGitNexusBin()`.

```
execFileP('which', ['gitnexus'])
```

- Uses `execFile` (not `exec`) with argv-array — no shell.
- `which` binary is assumed to be at OS PATH — standard POSIX utility, not user-supplied.
- Returns the trimmed stdout (absolute path to the binary) or `null` if not found.
- If null: returns `{ kind: 'not-installed' }` — NEVER falls back to `npx`.

**D-5-21 contract: CONFIRMED CLOSED.** The "no npx" rule holds. Grep of the entire Phase 10 diff confirms zero occurrences of `'npx'` in spawn or exec calls.

### B2. argv-array form only (T-10-03-02)

**Audit:** `spawnGitNexusAnalyze()` call:

```typescript
await execa(cmd, ['analyze'], { cwd: repoAbsPath, timeout: SPAWN_TIMEOUT_MS })
```

- `cmd` is the absolute PATH-resolved binary path (not a shell string).
- `['analyze']` is a literal array — no template literals, no string concatenation.
- `cwd` is `repoAbsPath` — the already-canonicalized absolute path (canonicalized AGAIN via realpathSync in the route before calling spawn).
- No `execa.command()`, no shell: true, no template literal construction.

**T-10-03-02 (argv-array invariant): CONFIRMED.**

`overrideSentinelScanner.ts` git-log spawn:
```typescript
spawnSync('git', ['log', '-1', '--format=%aI', '--', sentinelRelPath], { cwd: repoAbsPath })
```
- Binary: `'git'` — trusted OS binary.
- Args: literal array — no interpolation.
- `sentinelRelPath` is a relative path derived from `readdirSync` output (not user input).

**No shell-string helpers found anywhere in Phase 10 diff. All subprocess invocations use argv-array form.**

### B3. POST /refresh TOCTOU mitigation (CODEX HIGH-3 realpathSync re-canonicalization)

**Audit:** `coverage.ts` route POST handler.

1. `discoverRepos()` — synchronous path lookup at request time.
2. `match = repos.find(r => r.family === body.family && r.name === body.repo)` — finds the match.
3. **Before spawn:** `realpathSync(match.absPath)` → `canonicalAbs`.
4. **Immediately after:** `realpathSync(join(homedir(), 'Sourcecode', body.family))` → `familyRoot`.
5. Assert: `canonicalAbs.startsWith(familyRoot + sep)` — any symlink swap between discovery and spawn is caught here.
6. If assertion fails: returns error response. Spawn NEVER invoked.

The TOCTOU mitigation is in-request — no cached state between discovery and spawn. The re-canonicalization happens within the same lock scope (inside `inflight` async closure).

**CODEX HIGH-3 TOCTOU mitigation: CONFIRMED CLOSED.**

`body.family` is validated by `CoverageFamilySchema = z.enum(['agenticapps', 'factiv', 'neuroflash'])` at request body parse — path traversal via family parameter is impossible.

`body.repo` is a `z.string()` — the route uses it only for `.find()` matching against `discoverRepos()` output, never interpolated into a filesystem path directly. The path comes from the trusted `match.absPath` (from discoverRepos, then re-canonicalized). Acceptable.

---

## C. Concurrent-Request Hygiene

### C1. Per-repo refresh lock (CODEX MED-14)

**Audit:** `coverage.ts` `refreshLocks: Map<string, Promise<CoverageRefreshResponse>>`.

Lock key: `${body.family}/${body.repo}` — scoped per family+repo.

Protocol:
1. If `existing = refreshLocks.get(lockKey)` → await existing, return its result. Second concurrent POST shares the result.
2. Build `inflight` promise, `refreshLocks.set(lockKey, inflight)`.
3. `await inflight`.
4. `finally { refreshLocks.delete(lockKey) }` — cleanup after settle (success or error).

**MED-14 finding: second concurrent POST against the same {family, repo} awaits the first. CONFIRMED CLOSED.**

### C2. Different repos refresh in parallel

**Audit:** Lock key is `family/repo` — two different repos get different keys and do NOT share a lock. A POST for `agenticapps/agenticapps-dashboard` and a POST for `neuroflash/api` run concurrently without blocking each other.

The `refreshLocks` map is an in-process singleton (module-level `const`). Across processes or across daemon restarts, there is no lock persistence — acceptable, as the daemon is single-process.

**Different repos refresh in parallel: CONFIRMED.**

### C3. Batch-refresh UI serialization (AGREED-4)

**Audit:** `RefreshAllStaleButton.tsx` — `for...of await` loop, one `onRefresh()` call at a time. The loop is intentionally sequential (AGREED-4 comment: "NEVER Promise.all over spawnable actions").

The SPA serializes the batch. A second tab/client could theoretically submit concurrent POSTs — but the daemon-side per-repo lock (C1 above) ensures the same repo is never processed twice simultaneously. Different repos in a batch from two concurrent tabs would each proceed, which is safe (they operate on different directories).

**Concurrent-request hygiene: CONFIRMED for both daemon-side lock (C1) and SPA-side serialization (AGREED-4).**

---

## D. Schema-Bound Disclosure

### D1. Public CoverageResponse carries no absPath (CODEX HIGH-1)

**Audit:** `coverageScan.ts` `InternalCoverageRow extends CoverageRow { absPath: string }`.

`stripInternal()` function:
```typescript
function stripInternal(internal: InternalCoverageRow): CoverageRow {
  const { absPath: _omit, ...publicRow } = internal
  return publicRow
}
```

Called in `scanCoverageInternal()` at Step 6 before building `CoverageResponse`:
```typescript
rows: internalRows.map(stripInternal)
```

`CoverageRowSchema` (shared package): no `absPath` field. If strip fails (e.g., future code adds absPath back to the schema), Zod's `outbound()` call would catch unknown keys (depending on schema strictness) or simply not include them.

**SPA absPath references:**
- `CoverageRow.tsx`: comment "NEVER renders row.absPath (it's daemon-internal only)" — JSX source confirms no `row.absPath` render.
- `CoveragePage.tsx`: comment "CODEX HIGH-1: absPath NEVER rendered anywhere."
- `CoverageCell.tsx`: comment "CODEX HIGH-1: never references absPath."
- Full grep of `packages/spa/src/` for `absPath` shows only comments and the `buildHelpRoutes.tsx` local variable (unrelated to coverage).

**CODEX HIGH-1: CONFIRMED CLOSED. absPath is structurally absent from the public schema and all SPA rendering.**

### D2. SPA components do not reference absPath anywhere in JSX or imports

**Audit:** Covered in D1. Grep result: no JSX expression `{row.absPath}` or similar in coverage components. TypeScript would also catch this at compile time since `CoverageRow` type (from shared) has no `absPath` property.

**D2: CONFIRMED.**

---

## E. Additional Security Surface (not in original plan threat model)

### E1. git invocation in overrideSentinelScanner

`spawnSync('git', ['log', '-1', '--format=%aI', '--', sentinelRelPath], { cwd: repoAbsPath })`

- `git` binary: trusted OS installation.
- `sentinelRelPath`: relative path from `readdirSync` within `.planning/phases/` — constrained to the repo's `.planning/phases/` directory, which is already within the path-allow-list established by Phase 1 API-02.
- `cwd`: `repoAbsPath` — a discover-validated, resolver-mediated path.
- No shell: `spawnSync` with argv-array. Format string is a literal (`'%aI'`) — not user-supplied.

No injection surface identified. The git invocation reads commit metadata for a file that the scanner already confirmed exists via `existsSync` on a resolver-validated path.

### E2. CoverageFamily enum as injection guard on refresh route

`body.family` is gated by `CoverageFamilySchema = z.enum(['agenticapps', 'factiv', 'neuroflash'])`. Any other string causes a Zod parse error and a 400 response before the route handler executes. Path construction from `body.family` is therefore constrained to 3 known strings.

This prevents injection of `../../` or other traversal sequences through the family parameter. **CONFIRMED effective.**

### E3. Cache poisoning surface

The 30s memo cache (`coverageCache.ts`) is an in-memory Map. It stores the daemon-computed `CoverageResponse` object (already stripped of absPath). No user input is used as a cache key or stored in the cache value. Cache invalidation (`invalidateCoverageCache()`) is unconditional. No injection surface via cache.

---

## CSO Audit Summary

| Section | Finding | Severity | Status |
|---------|---------|----------|--------|
| A1 — New roots isolation | Roots not reachable via /read route | — | PASS |
| A2 — CODEX HIGH-3 resolver-everywhere | All 5 scanners route through PathResolver | info | PASS |
| A2 — gitNexusScanner existsSync bypass | Directory-only, daemon-controlled path | info | PASS (acceptable) |
| A3 — CODEX HIGH-2 symlink escape | realpathSync + family-root assertion in repoDiscovery | info | PASS |
| B1 — D-5-21 no npx | PATH lookup only; `which` resolves binary | — | PASS |
| B2 — argv-array invariant | No shell strings anywhere in Phase 10 | — | PASS |
| B3 — CODEX HIGH-3 TOCTOU | realpathSync re-canonicalization before spawn | — | PASS |
| C1 — CODEX MED-14 per-repo lock | refreshLocks Map; concurrent same-repo awaits | — | PASS |
| C2 — Different repos parallel | Lock keyed per family/repo | — | PASS |
| C3 — Batch serialization (AGREED-4) | Sequential for-of await in SPA | — | PASS |
| D1 — CODEX HIGH-1 absPath strip | stripInternal(); CoverageRowSchema has no absPath | — | PASS |
| D2 — SPA absPath non-reference | TypeScript + comment enforcement | — | PASS |
| E1 — git invocation safety | argv-array, cwd-confined, no user-controlled args | — | PASS |
| E2 — family enum injection guard | CoverageFamilySchema z.enum gate | — | PASS |
| E3 — Cache poisoning | In-memory, no user input in key/value | — | PASS |

**Total findings: 0 errors, 0 warnings, 3 info.**

**CODEX HIGH-1/2/3, CODEX MED-14, and D-5-21 all explicitly cross-referenced and confirmed closed.**

**CSO result: PASS** — zero blocking security findings.

---

*Authored by plan executor (claude-sonnet-4-6) as part of 10-09-PLAN.md Task 3.*
