# Phase 14: Understand-Anything Integration — Research

**Researched:** 2026-06-07
**Domain:** Static SPA sub-path hosting, Hono data-endpoint re-implementation, Coverage matrix column extension, Token-gated viewer architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-14-01** — Viewer assets installed via `agentic-dashboard install-understand-viewer`. Locates plugin cache, builds core then dashboard, copies `dist/` to `~/.agenticapps/dashboard/understand-viewer/<version>/`. Mirrors `install-launchd` pattern.
- **D-14-02** — Version-drift: detect + hint, manual re-run. Daemon compares installed viewer version vs newest plugin-cache version at startup. `/health` exposes both. SPA renders hint on mismatch. No auto-rebuild.
- **D-14-03** — Scoped read-only viewer token, stored 0600 in `~/.agenticapps/dashboard/`. Valid ONLY for `/understand/*` data endpoints. Dashboard SPA builds viewer links with `?token=` query param. Full-privilege bearer token never appears in viewer URLs.
- **D-14-04** — Full Tailscale parity for `/understand/*`. Served on every bind mode. Read-only surface; categorically different from Phase 13's scan refusal.
- **D-14-05** — `file-content.json` may serve any file whose normalised path appears as a node `filePath` in that repo's `knowledge-graph.json`. All upstream guards replicated: reject `..`/absolute/NUL, realpath containment, graph-membership check, 1 MB cap, binary rejection. `/cso` MUST audit this route.
- **D-14-05b** — Graph JSON sanitised before sending: absolute `filePath` values relativised to repo root; absolute paths outside root reduced to basename.
- **D-14-06** — New sidebar section "Code Intelligence" with a page listing analyzed projects + staleness + viewer links. Section built with growth room.
- **D-14-07** — Viewer opens in new tab at `/understand/{repoId}/?token=…`. No iframe.
- **D-14-08** — Staleness = commit-hash mismatch: stale when `meta.json` `gitCommitHash` ≠ current HEAD.
- **D-14-09** — Viewer routes and status use `deterministicRepoRoot()` (D-13-EXT-08/09 precedent, registry-first then FS fallback).
- **D-14-10** — Copy pill copies `cd ~/Sourcecode/{family}/{repo} && claude "/understand"`. Shared helper returns `{ string, argv }` pattern. Pill appears on missing AND stale rows.

### Claude's Discretion

- Vite `base` configuration for sub-path serving (resolved in this research — see Critical Question 1)
- Exact shape of `understand` block in `/health` and coverage wire schema
- `domain-graph.json` / `diff-overlay.json` 404 behavior (resolved — upstream returns empty `res.end()` for non-knowledge-graph missing files)
- Viewer-token rotation story
- Sidebar section + page naming ("Code Intelligence" is working name)
- Caching/TTL for status detection
- Build-prerequisite error messages for `install-understand-viewer`

### Deferred Ideas (OUT OF SCOPE)

- Daemon-triggered understand scans (headless `claude -p`)
- Family-level "analyze all" actions
- `/understand-diff` overlay surfacing
- GitNexus explorer page in Code Intelligence section
- Embedded viewer (iframe) inside dashboard shell
- Auto-rebuild of viewer assets on plugin update

</user_constraints>

---

## Summary

Phase 14 integrates the `understand-anything` Claude Code plugin viewer into the dashboard as a daemon-hosted SPA at `/understand/{repoId}/`. The central challenge is sub-path serving: the upstream viewer builds with no Vite `base` setting (defaults to `/`), so all asset references and ALL data fetch URLs in the viewer's runtime code use **root-absolute paths** (`/knowledge-graph.json`, `/file-content.json`, etc.). This means a naive sub-path serve won't work. The architecture that does work is: serve the static viewer SPA files at `/understand/{repoId}/` but also mount the 6 data endpoints at the **root-relative path the viewer hardcodes**, namespaced under the same `/understand/{repoId}/` prefix via a Hono sub-application — effectively each repo gets its own Hono sub-app with its own data routes and its own static file mount. The `rewriteRequestPath` option on `serveStatic` (already in `@hono/node-server@2.0.1`) handles path rewriting for assets. Data routes are just regular Hono routes registered before the static fallback.

The 6 upstream data endpoints (`knowledge-graph.json`, `meta.json`, `config.json`, `domain-graph.json`, `diff-overlay.json`, `file-content.json`) are a clean vite dev-server plugin in the upstream code — fully documented in `vite.config.ts` (~363 lines). The Hono re-implementation is straightforward: the endpoint logic is all pure-Node.js (no Vite internals needed) and can be lifted almost verbatim.

The Coverage matrix extension follows the established pattern from Phases 10–13. A new `understand` optional column (back-compat per D-13-EXT-10) with 3-state detection (present/stale/missing via `existsSync` + `meta.json` parse + git HEAD compare) folds into `coverageScan.ts`. The SPA column wiring follows `COVERAGE_COL_WIDTHS`, `coverageColumnTooltips`, and `CoverageRow` patterns exactly.

**Primary recommendation:** Serve the viewer per-repo as a Hono sub-application at `/understand/{repoId}/` with all 6 data endpoints co-located under that prefix. Build the viewer once with `--base=./` (relative Vite base) to make asset chunk URLs relative — but keep data fetches at root paths by intercepting them at the sub-app level. This is the only architecture that does not require modifying the upstream viewer source.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Viewer asset build (`install-understand-viewer`) | CLI (agent) | — | One-time build into `~/.agenticapps/dashboard/`; no daemon at runtime |
| Viewer static file serving | API/Backend (Hono) | — | Daemon reads installed dist/; serves via serveStatic |
| 6 data endpoints (`knowledge-graph.json` etc.) | API/Backend (Hono) | — | Requires FS reads of per-repo `.understand-anything/`; bearer/scoped-token auth |
| Scoped viewer token storage | API/Backend (daemon) | — | Stored 0600 alongside auth.json; daemon mints on demand |
| Understand status detection (analyzed/stale/missing) | API/Backend (daemon) | — | Pure FS reads in `coverageScan.ts`; no subprocess |
| Coverage matrix "Understand" column | Frontend (SPA) | API/Backend | SPA renders; daemon supplies data via `/api/coverage` |
| Code Intelligence sidebar section + page | Frontend (SPA) | API/Backend | Route + query for analyzed projects listing |
| Viewer tab link construction | Frontend (SPA) | — | SPA builds `${agentUrl}/understand/{repoId}/?token=…` using pairing data |
| Copy pill (buildUnderstandCommand) | Frontend (SPA) + Shared | — | `packages/shared/src/clipboard.ts` builder, called from SPA |

---

## Critical Question 1: Sub-Path Serving Architecture

**VERIFIED by direct source read.**

### The Problem: Root-Absolute Fetch URLs

The upstream viewer has TWO categories of URL references:

1. **Asset chunk URLs** (JS/CSS): These are determined by Vite's `base` setting. Default `base: "/"` generates `/assets/index-xxxx.js`. Setting `base: "./"` generates `./assets/index-xxxx.js` — relative, safe for sub-path hosting.

2. **Data fetch URLs** (runtime JavaScript in `App.tsx` and `CodeViewer.tsx`): These are **hardcoded root-absolute** at compile time:
   ```typescript
   // App.tsx line ~63:
   function dataUrl(fileName: string, token: string | null): string {
     const path = `/${fileName}`;              // ROOT-ABSOLUTE: always /knowledge-graph.json
     return token ? `${path}?token=${encodeURIComponent(token)}` : path;
   }
   
   // CodeViewer.tsx line ~26:
   function fileContentUrl(filePath: string, token: string): string {
     const params = new URLSearchParams({ token, path: filePath });
     return `/file-content.json?${params.toString()}`;  // ROOT-ABSOLUTE
   }
   
   // TokenGate.tsx line ~22:
   const res = await fetch(`/knowledge-graph.json?token=${encodeURIComponent(token)}`); // ROOT-ABSOLUTE
   ```

The `dataUrl()` function **always returns** `/${fileName}?token=…` in non-DEMO mode. There is no runtime config injection, no `window.baseUrl`, no `VITE_API_BASE` env var that changes this.

### The Solution: Per-Repo Hono Sub-Application

Since data fetch URLs are root-absolute (`/knowledge-graph.json`), the only way to host the viewer at `/understand/{repoId}/` and have data fetches work is to **also mount the 6 data endpoints at `/<filename>.json` relative to the sub-app's root**. In Hono, a sub-application mounted at `/understand/{repoId}` sees requests at `/understand/{repoId}/knowledge-graph.json` but can route on `/knowledge-graph.json` internally.

**Recommended architecture:**

```
GET /understand/{repoId}/               → serve index.html (viewer entry point with ?token=)
GET /understand/{repoId}/assets/*       → serve static assets (JS/CSS chunks)
GET /understand/{repoId}/knowledge-graph.json?token=  → data endpoint (scoped-token check)
GET /understand/{repoId}/meta.json?token=             → data endpoint
GET /understand/{repoId}/config.json?token=           → data endpoint
GET /understand/{repoId}/domain-graph.json?token=     → data endpoint
GET /understand/{repoId}/diff-overlay.json?token=     → data endpoint
GET /understand/{repoId}/file-content.json?token=     → data endpoint
```

This works because the viewer's root-absolute fetches (`/knowledge-graph.json`) are resolved relative to the viewer's page origin **only when the viewer page is served at `/understand/{repoId}/`** — the browser resolves `/knowledge-graph.json` to `<origin>/knowledge-graph.json`, NOT relative to the sub-path. Therefore the 6 data endpoint routes MUST be registered at the top-level Hono app (or a sub-app mounted at `/`), not under `/understand/{repoId}/`.

**Corrected architecture:**

```
/understand/{repoId}/                  → serve index.html (viewer SPA entry)
/understand/{repoId}/assets/*          → serve static JS/CSS chunks
/knowledge-graph.json?token=           → scoped-token data endpoint (per active repoId)
/meta.json?token=
/config.json?token=
/domain-graph.json?token=
/diff-overlay.json?token=
/file-content.json?token=
```

**BUT**: this creates a design problem — how does the root-level data endpoint know which repo the viewer is serving? Answer: the scoped viewer token is **per-repo** (D-14-03). The daemon mints one scoped token per repo (stored 0600). When the viewer fetches `/knowledge-graph.json?token=<repo-scoped-token>`, the daemon validates the token, maps it to the repo, reads that repo's `.understand-anything/knowledge-graph.json`, and responds. The token carries the repo identity — no `?repoId=` param needed.

**IMPORTANT: `base: "./"` for the build still matters** — it makes asset chunks use relative URLs so `./assets/index-xxxx.js` resolves correctly when `index.html` is served from `/understand/{repoId}/`. Without it, asset chunks look for `/assets/index-xxxx.js` at origin root, which would 404.

### vite.config.demo.ts confirms relative base pattern

The upstream `vite.config.demo.ts` uses `base: "/demo/"` for sub-path demo hosting. This is the proven pattern. For the daemon-hosted build we use `base: "./"` (or a computed value like `/understand/dummy/`) because the actual repoId varies per-viewer session. Using `base: "./"` is the most portable choice; alternatively building with a dummy prefix also works since only asset references (not data endpoints) are affected by `base`.

**Summary decision:** Build with `--base=./` to make asset references relative. Mount the 6 data endpoints at the TOP LEVEL of the Hono app (under the existing bearer middleware, but using the scoped-token validator). Each data endpoint validates `?token=` against the scoped token store and maps the token to the appropriate repo root.

---

## Critical Question 2: Build Prerequisites for `install-understand-viewer`

**VERIFIED by direct source read.**

### Plugin Cache State

The plugin cache at `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/` already has:
- `node_modules/` directory present (symlinks to `../../../node_modules/.pnpm/...`)
- `@understand-anything/core` symlink: `node_modules/@understand-anything/core → ../../../core`
- `packages/core/dist/` directory present with all built artifacts (`schema.js`, `search.js`, `types.js`, `index.js`, etc.)

This means `pnpm install` has already been run for this version. The `@understand-anything/core` package is also already built (`dist/` is populated).

### Build Command Sequence

From `packages/dashboard/package.json`:
```
"build": "tsc -b && vite build"
```

The `vite.config.ts` `resolve.alias` section maps:
```
"@understand-anything/core/schema": path.resolve(__dirname, "../core/dist/schema.js")
"@understand-anything/core/search": path.resolve(__dirname, "../core/dist/search.js")
"@understand-anything/core/types":  path.resolve(__dirname, "../core/dist/types.js")
```

These point to `../core/dist/*.js`. Since `dist/` is already built in the cache, a fresh `pnpm build` (or `tsc -b && vite build`) should succeed without needing to rebuild core.

### Exact Build Sequence for `install-understand-viewer`

```bash
# 1. Locate the plugin cache
PLUGIN_CACHE="$HOME/.claude/plugins/cache/understand-anything/understand-anything"
VERSION=$(ls "$PLUGIN_CACHE" | sort -V | tail -1)  # newest semver directory
DASHBOARD_DIR="$PLUGIN_CACHE/$VERSION/packages/dashboard"

# 2. Ensure core is built (dist/ already present for v2.7.6, but check)
CORE_DIR="$PLUGIN_CACHE/$VERSION/packages/core"
if [ ! -f "$CORE_DIR/dist/schema.js" ]; then
  cd "$CORE_DIR" && pnpm build
fi

# 3. Build the dashboard with relative base for sub-path hosting
cd "$DASHBOARD_DIR"
VITE_BASE="./" pnpm vite build --base="./"

# 4. Copy dist/ to daemon home
TARGET="$HOME/.agenticapps/dashboard/understand-viewer/$VERSION/"
mkdir -p "$TARGET"
cp -r "$DASHBOARD_DIR/dist/"* "$TARGET"
```

### Failure Modes

| Failure | Detection | Error Message |
|---------|-----------|---------------|
| Plugin not installed | `PLUGIN_CACHE` dir missing | "understand-anything plugin not found. Install with: claude /plugins install understand-anything" |
| No version dirs | `ls "$PLUGIN_CACHE"` empty | "No understand-anything version found in plugin cache" |
| pnpm missing | `command -v pnpm` fails | "pnpm is required to build the viewer. Install: npm install -g pnpm" |
| core dist missing + core build fails | `pnpm build` in core/ exits non-zero | "Failed to build @understand-anything/core: {exit code}" |
| Dashboard build fails | `vite build` exits non-zero | "Failed to build understand-anything viewer: {exit code}" |
| Target write fails | `cp` fails | "Failed to install viewer to ~/.agenticapps/dashboard/understand-viewer/" |

Note: `@hono/node-server/dist/serve-static.d.mts` exists — `serveStatic` is already a dependency. `root` option is relative to process CWD (not an absolute path), so we need `rewriteRequestPath` to prefix the installed viewer path, OR pass `root` as a relative path computed from `process.cwd()`.

---

## Critical Question 3: The 6 Data Endpoints Contract

**VERIFIED by direct source read of vite.config.ts (363 lines).**

### Endpoint Summary Table

| Endpoint | Auth Required | Response on Hit | Response on Miss | Notes |
|----------|--------------|-----------------|------------------|-------|
| `GET /knowledge-graph.json?token=` | `?token=` validation | 200 `{nodes:[...], ...}` with FIX 2 sanitisation | 404 `{error: "No knowledge graph found..."}` | `res.end(JSON.stringify(…))` — JSON error body |
| `GET /meta.json?token=` | `?token=` validation | 200 raw JSON | 404 empty body (`res.end()`) | No JSON error body on 404 |
| `GET /config.json?token=` | `?token=` validation | 200 JSON object | 200 `{autoUpdate: false, outputLanguage: "en"}` default | Always 200; config absence returns default |
| `GET /domain-graph.json?token=` | `?token=` validation | 200 raw JSON | 404 empty body (`res.end()`) | Optional artifact; App.tsx silently skips non-ok responses |
| `GET /diff-overlay.json?token=` | `?token=` validation | 200 raw JSON | 404 empty body (`res.end()`) | Optional artifact; App.tsx silently skips non-ok responses |
| `GET /file-content.json?token=&path=` | `?token=` validation | 200 `{path, language, content, sizeBytes, lineCount}` | 400/404/413/415 `{error: "..."}` | `readSourceFile()` guards — see below |

**Token validation:** `url.searchParams.get("token") !== ACCESS_TOKEN` → 403 `{error: "Forbidden: missing or invalid token"}`. Same pattern for all 6 endpoints.

### FIX 2 — Graph Path Sanitisation

`knowledge-graph.json` and `domain-graph.json` both apply node `filePath` sanitisation before sending:
```typescript
// For each node in raw.nodes:
const rel = abs.startsWith(projectRoot)
  ? abs.slice(projectRoot.length).replace(/^[\\/]/, "")
  : path.isAbsolute(abs)
  ? path.basename(abs)   // absolute outside root → basename only
  : abs;                 // already relative → keep as-is
```

The Hono re-implementation MUST replicate this exactly. The `projectRoot` is derived as `path.dirname(path.dirname(candidate))` where `candidate` is the path to `knowledge-graph.json` (e.g., `/repo/.understand-anything/knowledge-graph.json` → `projectRoot = /repo`).

### `readSourceFile()` Guards (Complete)

1. Missing `path` query param → 400 `{error: "Missing path"}`
2. NUL byte in path → 400 `{error: "Invalid path"}`
3. Absolute path → 400 `{error: "Absolute paths are not allowed"}`
4. `path.normalize(requestedPath)` produces `.`, `..`, starts with `../`, or is absolute → 400 `{error: "Path must stay inside the project"}`
5. `findGraphFile("knowledge-graph.json")` returns null → 404 `{error: "No knowledge graph found. Run /understand first."}`
6. `path.relative(projectRoot, absoluteFile)` traverses outside projectRoot → 400 `{error: "Path must stay inside the project"}`
7. `safeRelativePath` NOT in `graphFilePathSet` (graph-membership allow-list) → 404 `{error: "File is not in the knowledge graph"}`
8. `statSync` fails → 404 `{error: "File not found"}`
9. Not a file (`stat.isFile()` false) → 400 `{error: "Path is not a file"}`
10. `stat.size > 1MB` → 413 `{error: "File is too large to preview"}`
11. Buffer contains NUL byte (`buffer.includes(0)`) → 415 `{error: "Binary files cannot be previewed"}`
12. Success → 200 `{path, language, content, sizeBytes, lineCount}`

**D-14-05 constraint exception:** In the Hono re-implementation, `findGraphFile()` is replaced by a direct lookup: given the repoId (from the scoped token), resolve repo root via `deterministicRepoRoot()`, then `<root>/.understand-anything/knowledge-graph.json`. The `graphFilePathSet()` function (graph-membership allow-list) MUST be called per-request (not cached) since the graph can be regenerated between requests. Alternatively, cache it with a short TTL (e.g., 60s) — the planner should decide.

### `graphFileCandidates()` Replacement in Hono

The upstream uses `GRAPH_DIR` env var + CWD-relative lookup. In the Hono re-implementation, the repo root is resolved from the scoped token — no env var needed. The canonical path for each file is `<repoRoot>/.understand-anything/<fileName>`.

---

## Critical Question 4: Daemon Integration Points

**VERIFIED by direct source read.**

### app.ts Route Mounting

Existing middleware chain order (MUST be preserved):
1. logger
2. requestId + bindMode injection
3. CIDR enforcement (conditional)
4. CORS (`PROD_ORIGIN` + `DEV_ORIGIN`)
5. bearerAuth (global — ALL routes require it)
6. Business routes
7. onError

The `/understand/*` routes present a **scoped-token authentication challenge**: the viewer uses `?token=` (not `Authorization: Bearer`) because it's a browser-opened new tab, not an API call from the SPA. The bearer middleware at step 5 will REJECT the data endpoint requests because they have no `Authorization` header.

**Solution:** Mount the understand viewer sub-application BEFORE the global `bearerAuth` middleware, but with its own scoped-token validation middleware. Alternatively, use Hono's `app.use('/understand/*', ...)` to intercept before global bearerAuth fires.

In Hono, middleware runs in registration order. The `bearerAuth` middleware is registered globally at app level. To bypass it for `/understand/*`, the route must either:
- (A) Be mounted on a separate Hono sub-app created before `createApp()` that does NOT apply bearerAuth — then compose the two apps. This is clean but requires changing `createApp()`.
- (B) Use `app.use('/understand/*', ...)` before the `bearerAuth` registration to intercept + respond, short-circuiting the bearer check.

**Recommended approach (B):** Before the global `bearerAuth` registration, add:
```typescript
app.use('/understand/*', scopedTokenMiddleware(/* viewer token store */))
```
The `scopedTokenMiddleware` validates `?token=` against the scoped token store and calls `next()` on success. On failure it returns 403. The global `bearerAuth` will still run for these routes UNLESS the middleware terminates the chain — so the scoped middleware should set a context variable that the bearerAuth `verifyToken` function checks, OR the route should be placed before bearerAuth using a sub-router that short-circuits.

**Simplest correct solution:** Create a separate `understandRouter = new Hono<Env>()`, add the scoped-token middleware only on that router, and mount it in `app.ts` BEFORE the global `bearerAuth` is added. Since Hono executes routes/middleware in registration order, `app.route('/understand', understandRouter)` before `app.use(bearerAuth(...))` means `/understand/*` requests are handled entirely by `understandRouter` without reaching the global bearerAuth.

```typescript
// In createApp() — BEFORE the bearerAuth middleware registration:
app.route('/understand', understandViewerRoute)  // has its own scoped-token check

// Then the existing:
app.use(bearerAuth({ verifyToken: ... }))        // applies to all other routes
```

### deterministicRepoRoot() Extraction

Currently in `packages/agent/src/lib/gitnexusScan.ts`. Must be extracted to a shared lib module (`packages/agent/src/lib/repoRoot.ts`) so both `gitnexusScan.ts` and the new `understandViewer.ts` can import it without circular deps. All its security invariants (D-13-EXT-09 corollary, D-13-EXT-11) travel with it.

### coverageScan.ts Integration

The new `understandScan.ts` (or inline in `scanners/understandScanner.ts`) adds:
- `existsSync(join(repoRoot, '.understand-anything', 'meta.json'))` — presence check
- `JSON.parse(readFileSync(meta.json))` → extract `gitCommitHash`
- Compare against repo's current HEAD (already computed per-repo in `coverageScan.ts` — see `buildRow()`)
- Returns `UnderstandState: 'present' | 'stale' | 'missing'`

Current git HEAD per repo: `coverageScan.ts` line ~113+ calls `buildRow()` per repo. Check how `workflowVersionScanner` gets git HEAD — it likely reuses the existing git utilities. The `understandScanner` should call the same git HEAD helper (currently not explicitly shown, but the commit hash is already available in the phase 10 git scanner).

### health.ts Extension

Current shape:
```typescript
const payload: HealthResponse = {
  ok: true,
  version: ...,
  daemonVersion: ...,
  registryCount: ...,
  paired: ...,
  gitnexus: { installed, canScan },
}
```

New `understand` block (add to `HealthResponseSchema` in shared):
```typescript
understand: z.object({
  viewerInstalled: z.boolean(),
  viewerVersion: z.string().nullable(),  // semver string or null
  pluginVersion: z.string().nullable(),  // newest in plugin cache, or null
  updateAvailable: z.boolean(),          // viewerVersion !== pluginVersion
}).strict().optional()  // optional for back-compat per D-13-EXT-10 precedent
```

### Static File Serving via serveStatic

`@hono/node-server@2.0.1` (already a dependency) exports `serveStatic` from `@hono/node-server/serve-static`. The `root` option is **relative to process CWD**, not absolute. This requires either:
- Computing a relative path at serve-time: `path.relative(process.cwd(), installedViewerPath)`
- Using `rewriteRequestPath` to prepend the absolute base, then adjusting `root` accordingly

**Recommended pattern (avoids process.cwd() brittleness):**
```typescript
import { serveStatic } from '@hono/node-server/serve-static'

// In understandViewerRoute, for static asset fallback:
understandApp.use('/:repoId/*', async (c, next) => {
  const viewerDir = getInstalledViewerPath()  // ~/.agenticapps/dashboard/understand-viewer/<ver>/
  if (!viewerDir) return c.text('Viewer not installed', 503)
  const relPath = path.relative(process.cwd(), viewerDir)
  return serveStatic({ root: relPath })(c, next)
})
```

Note: `serveStatic` does NOT support absolute `root` paths — this is a known constraint documented in `@hono/node-server` types. The daemon is always started from a fixed CWD (process.cwd() is constant for a given daemon process lifetime), so computing the relative path once at startup is safe.

**Alternative:** Use `createReadStream` + Hono `c.stream()` directly for full control over absolute paths — avoids the relative-root constraint. This is slightly more code but more robust.

### Scoped Viewer Token Storage

Pattern from `auth.ts`:
- `generateToken()` → 32 random bytes hex, chunked `xxxx-xxxx-…` format
- `atomicWriteFile(filePath, JSON.stringify(data), 0o600)` — atomic write at 0600
- `assertSecurePermissions()` on read — lstat, isFile(), mode === 0600

New file: `~/.agenticapps/dashboard/viewer-token.json` (0600)
```typescript
// ViewerTokenFile schema:
z.object({ version: z.literal(1), token: z.string(), rotatedAt: z.string() })
```

The token is loaded into memory at daemon startup (same pattern as `activeToken`). The daemon stores one global viewer token (not per-repo) — the token is scoped to viewer endpoints only, and the repo identity is encoded in the URL prefix `/understand/{repoId}/`. The scoped-token middleware validates `?token=` against this in-memory token.

**Viewer token rotation:** Rotate alongside `rotate-token` OR as a separate `rotate-viewer-token` command. Since the viewer token has fewer privileges (read-only, viewer paths only), the simplest story is to rotate it together with the main token. SPA already gets the new main token post-rotation; the viewer links use the viewer token which it can re-fetch from `/health`.

---

## Critical Question 5: SPA Integration Points

**VERIFIED by direct source read.**

### Sidebar Section Registration

Current sidebar sections in `Sidebar.tsx`:
1. WORKSPACE (Projects list)
2. Observability (Coverage / Skill drift / Conformance)
3. ACCOUNT (Settings / Help)

New section "Code Intelligence" should be inserted between Observability and ACCOUNT:
```tsx
<SidebarSection label="Code Intelligence">
  <SidebarItem
    to="/code-intelligence"
    icon={<Network size={16} aria-hidden="true" />}  // or GitBranch, or Network
    label="Knowledge graphs"
  />
</SidebarSection>
```

`SidebarSection` and `SidebarItem` primitives are in `packages/spa/src/components/ui/`. All existing Observability items use `SidebarItem` (not `SidebarSubItem`) — the new section follows the same pattern per user's sidebar-architecture preference.

### Coverage Column: COVERAGE_COL_WIDTHS Extension

Current columns:
```typescript
repo: 'w-72', claudeMd: 'w-32', gitNexus: 'w-36', wiki: 'w-72', workflow: 'w-32', actions: 'w-12'
```

New column: `understand: 'w-36'` (same as gitNexus — similar content: ✓/⚠/✗ + copy pill).

**Changes needed:**
1. `coverageColumns.ts` — add `understand: 'w-36'`
2. `coverageColumnTooltips.ts` — add `understand: 'Understand-anything knowledge graph. Built by \`/understand\`; stored under \`<repo>/.understand-anything/\`.'`
3. `CoverageFamilySection.tsx` — add `<col>` + `<th>` for understand column
4. `CoverageRow.tsx` — add understand cell with link (when present) or copy pill (when stale/missing)
5. `CoverageFamilySectionMobile.tsx` — add understand cell to mobile card layout

### InstallGitNexusButton Pattern → UnderstandCopyPill

`InstallGitNexusButton.tsx` uses:
```typescript
const ok = await writeToClipboard(buildGitnexusInstallClipboardString())
toast.show(ok ? { ... success ... } : { ... error ... })
```

New `UnderstandCopyPill.tsx` uses the same pattern:
```typescript
const cmd = buildUnderstandCommand(family, repo)  // from packages/shared
const ok = await writeToClipboard(cmd.string)
toast.show(ok ? { message: 'Copied — paste in terminal to analyze', variant: 'success' } : ...)
```

The pill also renders a link when the understand state is `present`:
```tsx
<a href={viewerUrl} target="_blank" rel="noopener noreferrer">
  View knowledge graph ↗
</a>
```

Where `viewerUrl = `${pairing.agentUrl}/understand/${repoId}/?token=${viewerToken}``

### SPA Pairing Data for Viewer Link

From `pairing.ts`:
```typescript
const pairing = getPairing()  // { agentUrl: 'http://127.0.0.1:5193', token: '...' }
```

The viewer link uses `pairing.agentUrl` + viewer token (NOT the main `pairing.token`). The viewer token is returned from `/health` in the new `understand.viewerToken` field, OR from a new endpoint `/api/viewer-token`. Including it in `/health` is simpler.

**Recommended:** Add `viewerToken: z.string().optional()` to `HealthResponse.understand`. The SPA reads `useHealth()` to get the viewer token. This avoids a separate endpoint.

### Wire Schema Extension for CoverageRow

Following D-13-EXT-10 precedent (optional for back-compat):
```typescript
// packages/shared/src/schemas/coverage.ts — add to CoverageRowSchema:
understand: z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,  // 'present' | 'stale' | 'missing' | 'not-applicable'
  lastAnalyzedAt: z.string().optional(),  // meta.json.lastAnalyzedAt ISO string
  analyzedCommit: z.string().optional(),  // meta.json.gitCommitHash (short)
  analyzedFiles: z.number().int().optional(),  // meta.json.analyzedFiles
  label: z.string().optional(),           // human-readable e.g. "stale — 3 commits behind"
}).strict().optional()  // optional — back-compat with pre-Phase-14 daemons
```

---

## Critical Question 6: `.understand-anything/` Data Layout

**VERIFIED by direct inspection of live data at `claude-workflow/.understand-anything/`.**

```
.understand-anything/
├── .understandignore      # 1.2k — gitignore-style exclusions
├── config.json            # 25b — {"outputLanguage": "en"}
├── fingerprints.json      # 44k — file hash registry for incremental analysis
├── knowledge-graph.json   # 143k — main graph data
├── meta.json              # 155b — {"lastAnalyzedAt": "...", "gitCommitHash": "...", "version": "1.0.0", "analyzedFiles": 110}
└── intermediate/          # working dir for analyzer
```

**meta.json fields (exact schema):**
```json
{
  "lastAnalyzedAt": "2026-06-06T09:09:18Z",   // ISO8601 UTC
  "gitCommitHash": "01435ab91d1067eedb54b096fe7b68cef7598d1c",  // full SHA
  "version": "1.0.0",           // understand-anything plugin version
  "analyzedFiles": 110          // count
}
```

**domain-graph.json:** NOT present in the live example. This is optional — the viewer's `App.tsx` silently skips if the fetch returns non-ok.

**diff-overlay.json:** NOT present. Also optional.

**Staleness check (D-14-08):** Compare `meta.json.gitCommitHash` (full SHA) against `git rev-parse HEAD` in the repo. The current coverage scanner already reads git HEAD per-repo (for the workflowVersionScanner) — the understand scanner can reuse the same git HEAD value.

**config.json:** Simple JSON, always present. Value: `{"outputLanguage": "en"}`.

---

## Standard Stack

### Core (existing — no new packages needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@hono/node-server` | 2.0.1 | `serveStatic` for viewer assets | Already in agent package.json |
| `hono` | 4.12.16 | Data endpoint routes + middleware | Already in agent package.json |
| `zod` | catalog | Schema validation for new wire types | Already in use |

### No New Agent-Side Packages Required

The `@hono/node-server` package already includes `serveStatic`. All functionality needed (FS reads, path manipulation, JSON serving, static file serving) is available without any new npm dependencies. This preserves INV-05 (no native deps).

### Build-Time Tools (for `install-understand-viewer` command)

| Tool | Source | Requirement |
|------|--------|-------------|
| `pnpm` | User's system | Must be in PATH to build viewer; daemon checks at CLI command run time (not at daemon startup) |
| `vite` | Already in plugin's `node_modules` | Run as `pnpm vite build` inside plugin cache dir |
| `tsc` | Already in plugin's `node_modules` | Run as `tsc -b` inside plugin cache dir |

### Package Legitimacy Audit

No new npm packages are installed by this phase. All dependencies are already present in `packages/agent/package.json`. The `pnpm build` run during `install-understand-viewer` executes within the existing plugin cache — no new packages are introduced into the dashboard's own `node_modules`.

| Package | Status |
|---------|--------|
| `@hono/node-server` (serveStatic) | Already installed, already verified in Phase 1 |
| No new packages | — |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (new tab)
    │
    │  GET /understand/{repoId}/  (HTML)
    │  GET /assets/index-xxxx.js  (JS chunks — relative paths, ./assets/…)
    │  GET /knowledge-graph.json?token=<viewer-token>  (ROOT-ABSOLUTE fetch)
    │  GET /file-content.json?token=<viewer-token>&path=src/foo.ts
    ▼
Hono Daemon (127.0.0.1:5193)
    │
    ├── understandViewerRoute (mounted BEFORE global bearerAuth)
    │   ├── scopedTokenMiddleware (validates ?token= against viewer token)
    │   ├── GET /understand/:repoId/           → serveStatic index.html
    │   └── GET /understand/:repoId/assets/*   → serveStatic chunks
    │
    ├── 6 data endpoints (root-level, also BEFORE global bearerAuth)
    │   ├── GET /knowledge-graph.json?token=   → reads <repoRoot>/.understand-anything/knowledge-graph.json (FIX 2 sanitize)
    │   ├── GET /meta.json?token=              → reads meta.json raw
    │   ├── GET /config.json?token=            → reads config.json or default
    │   ├── GET /domain-graph.json?token=      → reads if present, 404 empty otherwise
    │   ├── GET /diff-overlay.json?token=      → reads if present, 404 empty otherwise
    │   └── GET /file-content.json?token=&path= → readSourceFile() with all guards
    │       │
    │       └── resolves repoRoot from token → reads <repoRoot>/<normalizedPath>
    │
    ├── global bearerAuth ←── all API routes below here
    │
    ├── GET /health          → extended with understand: { viewerInstalled, viewerVersion, pluginVersion, updateAvailable, viewerToken }
    ├── GET /api/coverage    → extended with understand column per row
    └── [all existing routes]
    │
    Filesystem
    ├── ~/.agenticapps/dashboard/understand-viewer/<version>/  (built SPA assets)
    ├── ~/.agenticapps/dashboard/viewer-token.json  (0600, scoped token)
    └── <repoRoot>/.understand-anything/  (per-repo graph data)
```

### Recommended Project Structure (new files)

```
packages/agent/src/
├── cli/
│   └── installUnderstandViewer.ts     # new — CLI command implementation
├── lib/
│   ├── repoRoot.ts                    # new — extract deterministicRepoRoot() from gitnexusScan.ts
│   ├── understandScan.ts              # new — per-repo understand status detection
│   ├── viewerToken.ts                 # new — viewer token read/write (0600 pattern)
│   └── scanners/
│       └── understandScanner.ts       # new — coverage scanner integration
├── routes/
│   └── understandViewer.ts            # new — static assets + 6 data endpoints
packages/shared/src/
├── schemas/
│   └── coverage.ts                    # modify — add understand?: column schema to CoverageRowSchema
│   └── health.ts                      # modify — add understand?: block to HealthResponseSchema
└── clipboard.ts                       # modify — add buildUnderstandCommand()
packages/spa/src/
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx                # modify — add Code Intelligence section
│   └── panels/
│       ├── coverage/
│       │   ├── coverageColumns.ts     # modify — add understand column width
│       │   ├── coverageColumnTooltips.ts # modify — add understand tooltip
│       │   ├── CoverageRow.tsx        # modify — add understand cell
│       │   ├── CoverageFamilySection.tsx # modify — add understand col/th
│       │   └── UnderstandCopyPill.tsx # new — copy pill + viewer link
│       └── code-intelligence/
│           └── CodeIntelligencePage.tsx # new — /code-intelligence route
└── routes/
    └── code-intelligence.lazy.tsx     # new — lazy route for the page
```

### Pattern 1: Scoped-Token Middleware (Before bearerAuth)

```typescript
// Source: inferred from auth.ts pattern + D-14-03
// packages/agent/src/routes/understandViewer.ts

import { Hono } from 'hono'
import { getViewerToken } from '../lib/viewerToken.js'

export const understandViewerRoute = new Hono<Env>()

// Token gate FIRST — before any static/data route
understandViewerRoute.use('/*', async (c, next) => {
  const token = c.req.query('token')
  const active = getViewerToken()
  if (!token || !active) return c.json({ error: 'Forbidden: missing or invalid token' }, 403)
  // Timing-safe compare
  const a = Buffer.from(token), b = Buffer.from(active)
  if (a.length !== b.length) return c.json({ error: 'Forbidden' }, 403)
  if (!timingSafeEqual(a, b)) return c.json({ error: 'Forbidden' }, 403)
  await next()
})

// Resolve repoRoot from repoId param — applies to data endpoints
understandViewerRoute.use('/:repoId/knowledge-graph.json', knowledgeGraphHandler)
// ... other 5 data endpoints ...
// Static fallback (index.html + assets)
understandViewerRoute.use('/:repoId/*', serveViewerStatic)
```

### Pattern 2: buildUnderstandCommand() (mirrors Phase 13 D-13-10)

```typescript
// Source: packages/shared/src/clipboard.ts (to be added)
export interface UnderstandCommand {
  readonly string: string
  readonly argv: readonly string[]  // for future daemon-spawn use
}

export function buildUnderstandCommand(family: string, repo: string): UnderstandCommand {
  return {
    string: `cd ~/Sourcecode/${family}/${repo} && claude "/understand"`,
    argv: ['/understand'],  // future: for headless spawn
  }
}
```

### Anti-Patterns to Avoid

- **Mounting data endpoints under `/understand/{repoId}/`**: Root-absolute fetches from the viewer SPA will NOT hit these. They resolve against origin root, not the viewer sub-path. Mount data endpoints at the top-level Hono app (before bearerAuth).
- **Using `base: "/"` (default) in the build**: Asset chunks will be requested at `/assets/index-xxxx.js` which is the root and will be handled by OTHER routes. Use `base: "./"`.
- **Caching graphFilePathSet() across requests without TTL**: If the user re-runs `/understand`, the graph changes but the cached allow-list doesn't. Parse fresh each time (it's a 143kB read, but only on file-content requests — infrequent).
- **Passing absolute path to `serveStatic({ root })`**: `@hono/node-server`'s serveStatic requires root relative to process.cwd(). Either compute relative path or use raw FS + `c.stream()`.
- **Duplicating `deterministicRepoRoot()`**: Extract to shared module; never copy-paste.
- **Using the main `pairing.token` in viewer links**: D-14-03 — only the scoped viewer token goes in viewer URLs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving | Custom `fs.readFile` + MIME type map | `serveStatic` from `@hono/node-server` | Already a dep; handles MIME, 304/etag, range requests |
| Timing-safe token compare | `===` string comparison | `timingSafeEqual` from `node:crypto` | Already used in app.ts bearerAuth |
| Atomic file write at 0600 | `writeFileSync` | `atomicWriteFile()` from `lib/atomicWrite.ts` | Already exists; handles O_EXCL + fsync + rename |
| Path traversal prevention | Custom regex | Upstream `readSourceFile()` logic (verbatim) | All 12 guards in order; proven correct |
| Family/repo root resolution | Custom path parsing | `deterministicRepoRoot()` (extracted to `repoRoot.ts`) | Phase 13 security-hardened implementation |
| Token generation | `Math.random()` | `generateToken()` from `lib/auth.ts` | 256-bit hex, chunked format, already proven |

---

## Runtime State Inventory

This is NOT a rename/refactor/migration phase. No stored data needs migration. The only new runtime state is:

| Category | Items | Action Required |
|----------|-------|-----------------|
| New file: `~/.agenticapps/dashboard/viewer-token.json` | Does not exist yet — created by daemon on first start after Phase 14 ships | Auto-created by daemon boot, no migration |
| New dir: `~/.agenticapps/dashboard/understand-viewer/` | Does not exist yet — created by `install-understand-viewer` CLI command | User runs CLI command |
| Existing `.understand-anything/` data | No change — read-only | None |
| Stored data (ChromaDB, Mem0, etc.) | None applicable | None |
| OS-registered state | No new launchd plist changes | None |

---

## Common Pitfalls

### Pitfall 1: Root-Absolute Data Fetches vs Sub-Path Mounting

**What goes wrong:** Developer mounts all `/understand/{repoId}/` routes including data endpoints under a sub-Hono app. The viewer JS, loaded from `/understand/{repoId}/`, fetches `/knowledge-graph.json` (root-absolute). The browser resolves this to `http://127.0.0.1:5193/knowledge-graph.json` (NOT `/understand/{repoId}/knowledge-graph.json`). The root-level route for `/knowledge-graph.json` doesn't exist → 404.

**Why it happens:** Developers assume the viewer knows its base path. It doesn't — `dataUrl()` hardcodes `/${fileName}`.

**How to avoid:** Mount the 6 data endpoints at root level (before bearerAuth), not under the sub-app. See architecture diagram.

**Warning signs:** TokenGate shows in the viewer but after valid token entry, the graph never loads (console shows 404 for `/knowledge-graph.json`).

### Pitfall 2: `serveStatic` root Must Be Relative to process.cwd()

**What goes wrong:** `serveStatic({ root: '/Users/donald/.agenticapps/dashboard/understand-viewer/2.7.6/' })` — Hono's node-server serveStatic fails silently or throws because it requires CWD-relative paths.

**How to avoid:** Use `path.relative(process.cwd(), absolutePath)` or bypass serveStatic entirely for the asset files by reading with `fs.readFileSync` + `c.body()`.

**Warning signs:** 404 on all asset requests even though the files exist at the absolute path.

### Pitfall 3: Bearer Auth Intercepts Viewer Data Requests

**What goes wrong:** The 6 data endpoints use `?token=` auth (not `Authorization: Bearer`). If they're mounted after global `bearerAuth`, every data request gets 401 because the browser's fetch() for `/knowledge-graph.json` doesn't include an Authorization header.

**How to avoid:** Mount the understand routes (static + data) BEFORE the `bearerAuth` middleware registration in `createApp()`. Use Hono's ordering guarantees.

**Warning signs:** Browser console shows 401 on `/knowledge-graph.json?token=...`.

### Pitfall 4: graphFilePathSet Cache Staleness After Re-Analysis

**What goes wrong:** Cache `graphFilePathSet()` result at daemon startup. User re-runs `/understand` which adds new files. The cache denies `file-content.json` requests for newly-added files with 404.

**How to avoid:** Either no cache (re-read per request — acceptable for infrequent file-content calls) or a short TTL (60s). The 143kB JSON parse is ~1ms; acceptable per-request cost.

### Pitfall 5: FIX 2 Sanitisation Missing from domain-graph.json

**What goes wrong:** Implement `knowledge-graph.json` sanitisation but forget `domain-graph.json`. Both contain `nodes[].filePath`. Absolute paths leak to browser.

**How to avoid:** Apply FIX 2 to BOTH `knowledge-graph.json` AND `domain-graph.json`. The upstream vite.config.ts applies it to the generic "fileName is knowledge-graph.json or domain-graph.json" branch.

### Pitfall 6: Viewer Token in /health Leaks to SPA History

**What goes wrong:** The viewer token is returned in `/health` response. The SPA logs this via `console.log(health)` or TanStack Query DevTools. Browser history captures the token.

**How to avoid:** The viewer token should NOT be logged. The SPA builds viewer links but should not cache the token in localStorage (only in memory via the health query response).

### Pitfall 7: Build With Default base="/" Breaks Asset Loading

**What goes wrong:** Build the viewer with default `base: "/"`. `index.html` references `/assets/index-xxxx.js`. When the viewer is served at `/understand/{repoId}/` and the browser navigates there, it requests `/assets/index-xxxx.js` at root — which is NOT the viewer assets directory. 404 on all chunks.

**How to avoid:** Build with `base: "./"`. The `vite.config.demo.ts` demonstrates the pattern with `base: "/demo/"`. Any non-default base makes asset URLs relative or prefixed correctly.

---

## Code Examples

### readSourceFile() Hono Adaptation

```typescript
// Source: Adapted from vite.config.ts readSourceFile() — verified
// packages/agent/src/routes/understandViewer.ts

import { join, normalize, relative, isAbsolute, dirname, basename, extname } from 'node:path'
import { existsSync, statSync, readFileSync } from 'node:fs'

const MAX_SOURCE_FILE_BYTES = 1024 * 1024

function normalizeGraphPath(filePath: string, projectRoot: string): string | null {
  const rawPath = isAbsolute(filePath)
    ? filePath.startsWith(projectRoot) ? relative(projectRoot, filePath) : null
    : filePath
  if (rawPath === null) return null
  const norm = normalize(rawPath)
  if (!norm || norm === '.' || norm.includes('\0') || norm === '..' || norm.startsWith(`../`) || isAbsolute(norm)) return null
  return norm.split('/').join('/')  // normalize sep
}

function graphFilePathSet(graphFile: string, projectRoot: string): Set<string> {
  const allowed = new Set<string>()
  try {
    const raw = JSON.parse(readFileSync(graphFile, 'utf-8')) as { nodes?: Array<Record<string, unknown>> }
    for (const node of raw.nodes ?? []) {
      if (typeof node.filePath !== 'string') continue
      const normalized = normalizeGraphPath(node.filePath, projectRoot)
      if (normalized) allowed.add(normalized)
    }
  } catch { /* return empty */ }
  return allowed
}

// readSourceFile(requestedPath, repoRoot, graphFilePath) → { statusCode, payload }
// Mirrors upstream readSourceFile() exactly per D-14-05
```

### FIX 2 Graph Sanitisation

```typescript
// Source: Adapted from vite.config.ts serve-knowledge-graph plugin — verified

function sanitiseGraphNodes(raw: { nodes?: Array<Record<string, unknown>>; [key: string]: unknown }, projectRoot: string): typeof raw {
  if (!Array.isArray(raw.nodes)) return raw
  return {
    ...raw,
    nodes: raw.nodes.map((node) => {
      if (typeof node.filePath !== 'string') return node
      const abs = node.filePath
      const rel = abs.startsWith(projectRoot)
        ? abs.slice(projectRoot.length).replace(/^[\\/]/, '')
        : isAbsolute(abs)
        ? basename(abs)
        : abs
      return { ...node, filePath: rel }
    })
  }
}
```

### Coverage Row Understand Status Detection

```typescript
// Source: inferred from meta.json structure + D-14-08 — ASSUMED
// packages/agent/src/lib/scanners/understandScanner.ts

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type UnderstandState = 'present' | 'stale' | 'missing'

export interface UnderstandScanResult {
  state: UnderstandState
  lastAnalyzedAt?: string
  analyzedCommit?: string
  analyzedFiles?: number
  label?: string
}

export function scanUnderstandForRepo(repoRoot: string, currentHeadSha: string): UnderstandScanResult {
  const metaPath = join(repoRoot, '.understand-anything', 'meta.json')
  if (!existsSync(metaPath)) return { state: 'missing' }
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
      lastAnalyzedAt?: string; gitCommitHash?: string; analyzedFiles?: number
    }
    const isStale = meta.gitCommitHash !== currentHeadSha
    return {
      state: isStale ? 'stale' : 'present',
      lastAnalyzedAt: meta.lastAnalyzedAt,
      analyzedCommit: meta.gitCommitHash?.slice(0, 7),
      analyzedFiles: meta.analyzedFiles,
      label: isStale ? 'stale' : undefined,
    }
  } catch {
    return { state: 'missing' }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Phase 13: no static file serving | Phase 14: `serveStatic` from `@hono/node-server` (already dep) | First use of static serving in this daemon; no new dep needed |
| Phase 13: subprocess-exec for scans | Phase 14: pure FS reads (no subprocess) | Simpler; no async job queue needed for detection |
| Phase 13: bearer token in Authorization header | Phase 14: `?token=` query param for viewer endpoints | Required by browser-opened viewer (no JS to set Authorization header) |
| vite dev server as data server | Hono production routes re-implementing same logic | Deterministic, no dev tooling at runtime |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pnpm vite build --base="./"` correctly overrides `base` even though the CLI flag `--base` is used (not a vite.config change) | Build prerequisites | Build might ignore CLI flag and use config default; mitigated by checking `vite --help` or using an env-var override |
| A2 | Hono `app.route('/understand', subApp)` registered BEFORE `app.use(bearerAuth(...))` causes `/understand/*` requests to be handled entirely by subApp without reaching bearerAuth | Daemon integration | If Hono runs all matching middleware regardless of registration order, bearerAuth would still fire; verify by checking Hono 4.x routing semantics |
| A3 | The git HEAD value already computed per-repo in `coverageScan.ts` `buildRow()` is a full SHA string compatible with `meta.json.gitCommitHash` | Understand scanner | If git HEAD is a short SHA or branch name, comparison would fail; verify format of the existing git HEAD reader |
| A4 | The viewer token returned in `/health.understand.viewerToken` is small enough to not concern the planner about health response bloat | Health extension | A 71-char token in health is negligible; safe assumption |
| A5 | `node_modules/` in the plugin cache dashboard dir already has all deps installed (observed for v2.7.6 — symlinks confirmed present) | Build prerequisites | Could be absent for other plugin versions; `install-understand-viewer` should run `pnpm install` as a prerequisite step regardless |

---

## Open Questions

1. **Hono middleware ordering guarantee for sub-app vs global bearerAuth**
   - What we know: Hono processes middleware in registration order; `app.route()` mounts sub-apps
   - What's unclear: Does Hono's `app.route('/understand', subApp)` short-circuit global middleware registered AFTER the mount point, or does global middleware always run?
   - Recommendation: Planner should verify by checking Hono 4.x docs or writing a test. Fallback: mount data endpoints as top-level routes explicitly before `app.use(bearerAuth(...))` rather than relying on sub-app isolation.

2. **Git HEAD format in existing coverageScan.ts**
   - What we know: `workflowVersionScanner.ts` exists and uses some git reading mechanism; `meta.json` stores full 40-char SHA
   - What's unclear: Does the existing git HEAD reader in `buildRow()` return full SHA or short SHA?
   - Recommendation: Planner should grep `buildRow` + any git HEAD call before implementing the understand scanner. If short SHA: compare using `meta.json.gitCommitHash.startsWith(gitHead)`.

3. **Viewer token in /health vs separate /api/viewer-token endpoint**
   - What we know: `/health` is always the first call SPA makes; returning token there avoids an extra round-trip
   - What's unclear: Viewer token changes only on rotation, so `staleTime` on `useHealth` might cache a stale token for 30s if the token is rotated mid-session
   - Recommendation: Include in `/health` with `staleTime: 0` override on the viewer-link rendering component, OR expose a separate `/api/viewer-token` endpoint (also behind main bearer auth) that the SPA calls once per session. Planner decides.

4. **serveStatic absolute root workaround**
   - What we know: `@hono/node-server` serveStatic requires CWD-relative root; daemon CWD is constant per process lifetime
   - Recommendation: Compute `path.relative(process.cwd(), viewerDistPath)` at daemon startup and store in module constant. Safe since CWD never changes for a running process.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pnpm` | `install-understand-viewer` CLI command | ✓ | 10.33.2 | Error: "pnpm is required" |
| `@hono/node-server` serveStatic | Viewer static assets | ✓ | 2.0.1 | Already a dep |
| understand-anything plugin cache | `install-understand-viewer` | ✓ | v2.7.6 present | Error with install instructions |
| `.understand-anything/` per repo | Understand column detection | ✓ (claude-workflow) | — | State = missing |
| `@understand-anything/core/dist/` | Viewer build | ✓ | Pre-built in cache | Re-run `pnpm --filter @understand-anything/core build` |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** All have graceful degradation (viewer not installed → SPA shows install hint; repo not analyzed → missing state in coverage column).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (workspace-level, `pnpm -r test`) |
| Config file | `packages/agent/vitest.config.ts` (or workspace root) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-14-05 | `file-content.json` path traversal rejected | unit | `vitest run src/routes/understandViewer.test.ts` | ❌ Wave 0 |
| D-14-05 | `file-content.json` graph-membership allow-list enforced | unit | same file | ❌ Wave 0 |
| D-14-05 | `file-content.json` 1MB cap | unit | same file | ❌ Wave 0 |
| D-14-05 | `file-content.json` binary rejection | unit | same file | ❌ Wave 0 |
| D-14-03 | Viewer data endpoints return 403 without valid `?token=` | unit | same file | ❌ Wave 0 |
| D-14-03 | Viewer data endpoints return 403 with wrong `?token=` | unit | same file | ❌ Wave 0 |
| D-14-05b | `knowledge-graph.json` absolute filePath sanitised to relative | unit | same file | ❌ Wave 0 |
| D-14-08 | Staleness: stale when meta.json gitCommitHash ≠ HEAD | unit | `vitest run src/lib/scanners/understandScanner.test.ts` | ❌ Wave 0 |
| D-14-08 | Present: fresh when gitCommitHash === HEAD | unit | same file | ❌ Wave 0 |
| D-14-09 | deterministicRepoRoot (extracted) family allow-list enforced | unit | `vitest run src/lib/repoRoot.test.ts` | ❌ Wave 0 |
| D-14-10 | buildUnderstandCommand returns { string, argv } with correct format | unit | `vitest run packages/shared` | ❌ Wave 0 |
| D-14-02 | /health includes understand block with viewerInstalled/version | unit | `vitest run src/routes/health.test.ts` | ✅ (extend existing) |
| coverage | understand column in CoverageRow wire schema (optional field) | unit | `vitest run packages/shared` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test -- --run src/routes/understandViewer.test.ts`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/agent/src/routes/understandViewer.test.ts` — covers path-traversal suite (D-14-05), token gate 401/403s, FIX 2 sanitization
- [ ] `packages/agent/src/lib/scanners/understandScanner.test.ts` — covers staleness detection (D-14-08), missing case, stale case
- [ ] `packages/agent/src/lib/repoRoot.test.ts` — covers extracted `deterministicRepoRoot()` (can be moved from `gitnexusScan.test.ts`)
- [ ] `packages/shared/src/clipboard.test.ts` (extend) — covers `buildUnderstandCommand()` shape

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Scoped viewer token (D-14-03); timing-safe compare via `timingSafeEqual` |
| V3 Session Management | Partial | Viewer token stored in sessionStorage by viewer SPA; main token in localStorage; no server-side session |
| V4 Access Control | Yes | D-14-05 graph-membership allow-list; family allow-list in `deterministicRepoRoot()` |
| V5 Input Validation | Yes | Zod on all wire types; `readSourceFile()` path validation; `normalizeGraphPath()` |
| V6 Cryptography | Partial | Token generation: `randomBytes(32)` (32 bytes = 256 bits entropy, adequate for ASVS L1) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `file-content.json?path=../../../etc/passwd` | Tampering | 12-guard `readSourceFile()` (NUL, absolute, `..`, normalize, realpath containment, graph-membership) |
| Directory escape via symlink at repo root | Elevation | `realpath()` check under repo root before serving any file |
| Token leakage via browser history (viewer URL) | Info Disclosure | Scoped token is lower-privilege (viewer-only); main bearer token never in URLs |
| Absolute path leak via graph JSON | Info Disclosure | FIX 2 sanitisation removes `~/Sourcecode/…` from `filePath` values |
| Unregistered repo access via viewer endpoints | Unauthorized Access | `deterministicRepoRoot()` family allow-list; `.understand-anything/` must exist |
| Binary file exfiltration via file-content.json | Info Disclosure | NUL-byte check + 1MB cap from upstream `readSourceFile()` |
| CORS bypass on viewer data endpoints | Tampering | Same CORS middleware as all other routes (applies before scoped token check) |

**`/cso` MANDATE:** D-14-05 ratified exception (file-content.json serving graph-listed source files broader than .planning/.claude allow-list) is an explicit `/cso` audit target for the post-phase ritual.

---

## Sources

### Primary (HIGH confidence)

- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/vite.config.ts` — The complete 6-endpoint contract, token gate logic, FIX 2 sanitisation, `readSourceFile()` guards (all 12), `graphFileCandidates()`, `graphFilePathSet()`, `normalizeGraphPath()`
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/src/App.tsx` — All data fetch URL shapes (`dataUrl()`, all 5 endpoint calls), `resolveInitialToken()`, sessionStorage pattern
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/src/components/TokenGate.tsx` — Root-absolute `/knowledge-graph.json` fetch, token validation flow
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/src/components/CodeViewer.tsx` — Root-absolute `/file-content.json` fetch pattern
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/vite.config.demo.ts` — `base: "/demo/"` sub-path build precedent
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/package.json` — `"build": "tsc -b && vite build"` confirmed
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/core/package.json` — Build script `"build": "tsc"`; dist/ confirmed present
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/skills/understand-dashboard/SKILL.md` — `pnpm --filter @understand-anything/core build` prerequisite order
- `~/Sourcecode/agenticapps/claude-workflow/.understand-anything/meta.json` — Live meta.json schema confirmed: `{lastAnalyzedAt, gitCommitHash, version, analyzedFiles}`
- `packages/agent/src/server/app.ts` — Middleware order, route mounting, BindMode type, auth middleware
- `packages/agent/src/lib/gitnexusScan.ts` — `deterministicRepoRoot()` full implementation (lines 497-538); `derivedRepoId()`
- `packages/agent/src/lib/auth.ts` — Token generation, 0600 file pattern, `atomicWriteFile` usage
- `packages/agent/src/routes/health.ts` — HealthResponse shape + `gitnexus` block extension pattern
- `packages/agent/src/constants.ts` — `CONFIG_DIR`, `AUTH_FILE`, pattern for `VIEWER_TOKEN_FILE`
- `packages/shared/src/schemas/coverage.ts` — `CoverageRowSchema`, optional field pattern (D-13-EXT-10), `CoverageBasicColumnSchema`
- `packages/shared/src/schemas/health.ts` — `HealthResponseSchema` with `.strict().optional()` pattern
- `packages/shared/src/clipboard.ts` — `GitnexusIndexCommand` `{string, argv}` pattern for `buildUnderstandCommand()`
- `packages/spa/src/components/ui/Sidebar.tsx` — Section architecture, `SidebarItem` vs `SidebarSubItem`
- `packages/spa/src/components/panels/coverage/coverageColumns.ts` — `COVERAGE_COL_WIDTHS` SoT
- `packages/spa/src/components/panels/coverage/coverageColumnTooltips.ts` — tooltip addition pattern
- `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` — copy pill pattern
- `packages/spa/src/lib/pairing.ts` — `getPairing()` → `{agentUrl, token}` for viewer URL construction
- `node_modules/.pnpm/@hono+node-server@2.0.1_hono@4.12.16/...serve-static.d.mts` — `serveStatic` API (root: relative, rewriteRequestPath)

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions D-14-01..D-14-10 — Cross-referenced with code findings, all consistent
- Phase 13 CONTEXT.md — `deterministicRepoRoot()`, `buildGitnexusIndexClipboardString` `{string, argv}` pattern (D-13-10)

---

## Metadata

**Confidence breakdown:**
- Sub-path serving architecture: HIGH — directly verified from App.tsx + vite.config.ts source
- Build prerequisites: HIGH — package.json + dist/ presence verified by direct inspection
- 6 endpoint contract: HIGH — vite.config.ts read in full (363 lines)
- Daemon integration points: HIGH — app.ts, gitnexusScan.ts, health.ts, auth.ts all read
- SPA integration: HIGH — Sidebar.tsx, CoverageRow.tsx, InstallGitNexusButton.tsx, coverageColumns.ts all read
- Data layout: HIGH — live meta.json verified; no domain-graph.json or diff-overlay.json in live example (optional confirmed)
- serveStatic absolute-root constraint: HIGH — types file read

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (30 days — stable domain; viewer at v2.7.6, no changes expected)
