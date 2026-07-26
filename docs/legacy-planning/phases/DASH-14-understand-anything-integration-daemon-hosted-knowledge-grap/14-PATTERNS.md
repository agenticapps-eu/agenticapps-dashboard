# Phase 14: Understand-Anything Integration — Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/agent/src/routes/understandViewer.ts` | route | request-response (static-serve + 6 data endpoints) | `packages/agent/src/routes/gitnexusScan.ts` + `packages/agent/src/routes/health.ts` | role-match |
| `packages/agent/src/lib/repoRoot.ts` | utility | transform | `packages/agent/src/lib/gitnexusScan.ts` (extract of `deterministicRepoRoot`) | exact (extract) |
| `packages/agent/src/lib/viewerToken.ts` | utility | CRUD | `packages/agent/src/lib/auth.ts` | exact |
| `packages/agent/src/lib/understandScan.ts` | utility | file-I/O | `packages/agent/src/lib/scanners/gitNexusScanner.ts` | role-match |
| `packages/agent/src/lib/scanners/understandScanner.ts` | utility | file-I/O | `packages/agent/src/lib/scanners/gitNexusScanner.ts` (`rateGitNexusRepo`) | exact |
| `packages/agent/src/cli/installUnderstandViewer.ts` | CLI command | batch | `packages/agent/src/cli/installLaunchd.ts` | role-match |
| `packages/agent/src/server/app.ts` (modify) | config | request-response | self | N/A (modify) |
| `packages/agent/src/routes/health.ts` (modify) | route | request-response | self | N/A (modify) |
| `packages/agent/src/lib/coverageScan.ts` (modify) | service | batch | self | N/A (modify) |
| `packages/agent/src/constants.ts` (modify) | config | — | self | N/A (modify) |
| `packages/shared/src/schemas/coverage.ts` (modify) | schema | — | `packages/shared/src/schemas/coverage.ts` (gitNexus optional field precedent) | exact |
| `packages/shared/src/schemas/health.ts` (modify) | schema | — | `packages/shared/src/schemas/health.ts` (`gitnexus` block precedent) | exact |
| `packages/shared/src/clipboard.ts` (modify) | utility | transform | `packages/shared/src/clipboard.ts` (`buildGitnexusIndexClipboardString`) | exact |
| `packages/spa/src/components/ui/Sidebar.tsx` (modify) | component | request-response | self (Observability section pattern) | N/A (modify) |
| `packages/spa/src/components/panels/coverage/UnderstandCopyPill.tsx` | component | request-response | `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` | exact |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx` (modify) | component | request-response | self (gitNexus cell pattern) | N/A (modify) |
| `packages/spa/src/components/panels/code-intelligence/CodeIntelligencePage.tsx` | component | request-response | `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` | role-match |
| `packages/spa/src/routes/code-intelligence.lazy.tsx` | route | request-response | `packages/spa/src/routes/observability.skill-drift.lazy.tsx` | exact |
| `packages/spa/src/lib/healthQueries.ts` (modify) | hook | request-response | self | N/A (modify) |
| `packages/spa/src/router.tsx` (modify) | config | — | self | N/A (modify) |

---

## Pattern Assignments

### `packages/agent/src/routes/understandViewer.ts` (route, request-response)

**Analog 1:** `packages/agent/src/routes/health.ts` (thin Hono route shape)
**Analog 2:** `packages/agent/src/routes/gitnexusScan.ts` (Hono route with inline middleware, `c.get('bindMode')`, outbound validation)

**Imports pattern** (`health.ts` lines 1-9, `gitnexusScan.ts` lines 18-31):
```typescript
import { timingSafeEqual } from 'node:crypto'
import { join, normalize, relative, isAbsolute, dirname, basename } from 'node:path'
import { existsSync, statSync, readFileSync, createReadStream } from 'node:fs'

import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'

import { getViewerToken } from '../lib/viewerToken.js'
import { deterministicRepoRoot } from '../lib/repoRoot.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'
```

**Scoped-token middleware pattern** (before any route handlers; mirrors `app.ts` lines 116-127 `bearerAuth` shape but using `?token=` query param and `timingSafeEqual`):
```typescript
export const understandViewerRoute = new Hono<Env>()

// Token gate FIRST — scoped viewer token (D-14-03), ?token= not Authorization header
// Mounted in app.ts BEFORE global bearerAuth to short-circuit the bearer check.
understandViewerRoute.use('/*', async (c, next) => {
  const token = c.req.query('token')
  const active = getViewerToken()
  if (!token || !active) return c.json({ error: 'Forbidden: missing or invalid token' }, 403)
  const a = Buffer.from(token)
  const b = Buffer.from(active)
  if (a.length !== b.length) return c.json({ error: 'Forbidden' }, 403)
  if (!timingSafeEqual(a, b)) return c.json({ error: 'Forbidden' }, 403)
  await next()
})
```

**Static asset serving pattern** (addresses Pitfall 2 — serveStatic needs CWD-relative root):
```typescript
// Compute relative path once; CWD is stable for a daemon process lifetime.
// Alternative: use createReadStream + c.body() to bypass the CWD constraint entirely.
const relViewerRoot = path.relative(process.cwd(), getInstalledViewerPath())
understandViewerRoute.get('/:repoId/*', serveStatic({ root: relViewerRoot }))
```

**Data endpoint pattern** (mirrors vite.config.ts endpoint shape; MUST be mounted at TOP-LEVEL app before bearerAuth — see Critical Q1 from RESEARCH.md):
```typescript
// In app.ts (NOT inside understandViewerRoute): mount data endpoints at root
// so browser's root-absolute fetches (/knowledge-graph.json) resolve correctly.
app.use('/knowledge-graph.json', scopedTokenCheck, knowledgeGraphHandler)
app.use('/meta.json', scopedTokenCheck, metaJsonHandler)
// ...etc for 5 remaining endpoints
```

**Error response pattern** (`gitnexusScan.ts` lines 98-113 — code-only, no path leakage):
```typescript
const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
// 400 guard responses:
return c.json({ error: 'Missing path' }, 400)
return c.json({ error: 'Path must stay inside the project' }, 400)
// 404 guard:
return c.json({ error: 'File is not in the knowledge graph' }, 404)
// 413 / 415:
return c.json({ error: 'File is too large to preview' }, 413)
return c.json({ error: 'Binary files cannot be previewed' }, 415)
```

**outbound() pattern** (`health.ts` line 33, `gitnexusScan.ts` lines 117-122):
```typescript
// Use outbound() for JSON data responses (INV-04 schema-drift defence)
return outbound(c, SomeResponseSchema.parse.bind(SomeResponseSchema), payload)
```

---

### `packages/agent/src/lib/repoRoot.ts` (utility, transform — extract from gitnexusScan.ts)

**Analog:** `packages/agent/src/lib/gitnexusScan.ts` lines 480-558

**Core pattern** (lines 497-538 — copy verbatim, update import paths):
```typescript
import { existsSync, statSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { sep } from 'node:path'

const KNOWN_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const

/**
 * D-13-EXT-08/09 — registry-first + FS fallback with family allow-list + realpath guard.
 * See gitnexusScan.ts lines 480-538 for full commentary.
 * Extracted here so understandViewer.ts and gitnexusScan.ts share the same impl.
 */
export function deterministicRepoRoot(repoId: string): string | null {
  // ... exact body from gitnexusScan.ts lines 497-538 ...
}

export function derivedRepoId(root: string): string | null {
  // ... exact body from gitnexusScan.ts lines 546-558 ...
}
```

**Test migration pattern** (`packages/agent/src/lib/deterministicRepoRoot.test.ts` line 22):
```typescript
// Change this import after extraction:
// BEFORE: import { deterministicRepoRoot } from './gitnexusScan.js'
// AFTER:  import { deterministicRepoRoot } from './repoRoot.js'
// gitnexusScan.ts re-exports from repoRoot.ts for backward compat
```

---

### `packages/agent/src/lib/viewerToken.ts` (utility, CRUD)

**Analog:** `packages/agent/src/lib/auth.ts` (complete pattern for 0600 token file)

**Imports pattern** (`auth.ts` lines 1-21):
```typescript
import { randomBytes } from 'node:crypto'
import { lstatSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'

import { atomicWriteFile } from './atomicWrite.js'
import { parseOrCorrupt } from './stateCorruption.js'
import { CONFIG_DIR, VIEWER_TOKEN_FILE } from '../constants.js'
```

**Token file schema** (mirrors `AuthFileSchema` from `packages/shared/src/schemas/auth.ts`):
```typescript
// New in packages/shared/src/schemas/auth.ts (or a new viewerToken.ts schema):
export const ViewerTokenFileSchema = z.object({
  version: z.literal(1),
  token: z.string(),
  rotatedAt: z.string(),
}).strict()
```

**Token lifecycle pattern** (`auth.ts` lines 35-49, 94-109, 117-134):
```typescript
// In-memory ref — D-15 race-window pattern (mirrors auth.ts activeToken)
let activeViewerToken = ''
export function getViewerToken(): string { return activeViewerToken }
export function setViewerToken(token: string): void { activeViewerToken = token }

// generateToken() — REUSE from auth.ts (same 32-byte hex chunked format)
// ensureViewerTokenFile() — mirrors ensureAuthFile() exactly:
export function ensureViewerTokenFile(filePath: string = VIEWER_TOKEN_FILE): ViewerTokenFile {
  ensureConfigDir(dirname(filePath))
  if (existsSync(filePath)) {
    assertSecurePermissions(filePath)  // reuse from auth.ts
    const vt = readViewerTokenFile(filePath)
    setViewerToken(vt.token)
    return vt
  }
  const fresh: ViewerTokenFile = { version: 1, token: generateToken(), rotatedAt: new Date().toISOString() }
  atomicWriteFile(filePath, JSON.stringify(fresh, null, 2), 0o600)
  setViewerToken(fresh.token)
  return fresh
}
```

**Constants addition** (`constants.ts` — follow existing pattern lines 10-13):
```typescript
export const VIEWER_TOKEN_FILE = join(CONFIG_DIR, 'viewer-token.json')
```

---

### `packages/agent/src/lib/scanners/understandScanner.ts` (utility, file-I/O)

**Analog:** `packages/agent/src/lib/scanners/gitNexusScanner.ts` (`rateGitNexusRepo` lines 289-312)

**Imports pattern** (`gitNexusScanner.ts` lines 15-19):
```typescript
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
```

**State type pattern** (mirrors `GitNexusRepoState` at lines 81-85):
```typescript
export type UnderstandState = 'present' | 'stale' | 'missing'

export interface UnderstandScanResult {
  state: UnderstandState
  lastAnalyzedAt?: string   // meta.json.lastAnalyzedAt ISO string
  analyzedCommit?: string   // meta.json.gitCommitHash (short, 7 chars)
  analyzedFiles?: number    // meta.json.analyzedFiles
  label?: string            // 'stale' or undefined
}
```

**Core scan pattern** (pure FS reads, no subprocess — mirrors `rateGitNexusRepo` logic):
```typescript
export function scanUnderstandForRepo(
  repoRoot: string,
  currentHeadSha: string,  // full 40-char SHA from .git/HEAD + pack lookup or execSync
): UnderstandScanResult {
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

**Git HEAD reading:** No existing helper reads HEAD as a full SHA. New helper needed:
```typescript
// Read current HEAD SHA for a repo — pure FS read, no subprocess.
// .git/HEAD contains either "ref: refs/heads/main\n" or a detached SHA.
// For ref form, read .git/refs/heads/<branch> or packed-refs.
export function readRepoHeadSha(repoRoot: string): string | null {
  try {
    const headContent = readFileSync(join(repoRoot, '.git', 'HEAD'), 'utf-8').trim()
    if (!headContent.startsWith('ref: ')) return headContent  // detached HEAD
    const refPath = headContent.slice(5)  // e.g. refs/heads/main
    const refFile = join(repoRoot, '.git', refPath)
    if (existsSync(refFile)) return readFileSync(refFile, 'utf-8').trim()
    // packed-refs fallback
    const packedRefs = join(repoRoot, '.git', 'packed-refs')
    if (existsSync(packedRefs)) {
      const content = readFileSync(packedRefs, 'utf-8')
      for (const line of content.split('\n')) {
        if (line.endsWith(` ${refPath}`)) return line.split(' ')[0]
      }
    }
    return null
  } catch { return null }
}
```

---

### `packages/agent/src/cli/installUnderstandViewer.ts` (CLI command, batch)

**Analog:** `packages/agent/src/cli/installLaunchd.ts` (structure: named export `runInstallUnderstandViewer`, console.log outputs, homedir-based paths, error handling)

**Imports pattern** (`installLaunchd.ts` lines 1-8):
```typescript
import { mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'  // or execa for subprocess
```

**Structure pattern** (`installLaunchd.ts` lines 71-114):
```typescript
export async function runInstallUnderstandViewer(): Promise<void> {
  const home = homedir()
  const pluginCache = join(home, '.claude', 'plugins', 'cache', 'understand-anything', 'understand-anything')

  // 1. Locate plugin cache + find newest version (Failure 1-2 handling)
  if (!existsSync(pluginCache)) {
    console.error('understand-anything plugin not found. Install with: claude /plugins install understand-anything')
    process.exit(1)
  }
  const versions = readdirSync(pluginCache).sort(/* semver sort */)
  if (!versions.length) {
    console.error('No understand-anything version found in plugin cache')
    process.exit(1)
  }
  const version = versions[versions.length - 1]
  const dashboardDir = join(pluginCache, version, 'packages', 'dashboard')

  // 2. Check pnpm available (Failure 3)
  try { execSync('pnpm --version', { stdio: 'ignore' }) }
  catch { console.error('pnpm is required to build the viewer. Install: npm install -g pnpm'); process.exit(1) }

  // 3. Ensure core is built (step from RESEARCH.md Critical Q2)
  const coreDistSchema = join(pluginCache, version, 'packages', 'core', 'dist', 'schema.js')
  if (!existsSync(coreDistSchema)) {
    console.log('Building @understand-anything/core...')
    execSync('pnpm build', { cwd: join(pluginCache, version, 'packages', 'core'), stdio: 'inherit' })
  }

  // 4. Build dashboard with relative base
  console.log(`Building viewer from ${dashboardDir}...`)
  execSync('pnpm vite build --base="./"', { cwd: dashboardDir, stdio: 'inherit' })

  // 5. Install to daemon home — mirrors installLaunchd mkdir pattern
  const target = join(home, '.agenticapps', 'dashboard', 'understand-viewer', version)
  mkdirSync(target, { recursive: true })
  // Copy dist/* to target
  // ...
  console.log(`Viewer installed -> ${target}`)
  console.log('To serve, restart the daemon: agentic-dashboard stop && agentic-dashboard start')
}
```

---

### `packages/agent/src/server/app.ts` (modify — route mounting order)

**Analog:** self (lines 130-153) — add understand routes BEFORE `bearerAuth`

**Mount pattern** (CRITICAL — addresses Pitfall 3 from RESEARCH.md; `understandViewerRoute` and the 6 data endpoints must precede `app.use(bearerAuth(...))`):
```typescript
// In createApp(), BEFORE the bearerAuth middleware (step 5):
// Phase 14 D-14-03: understand viewer uses scoped ?token= auth — bypass global bearerAuth
app.route('/understand', understandViewerRoute)   // static SPA assets per repoId
app.route('/', understandDataRoute)               // 6 root-level data endpoints

// THEN existing step 5:
app.use(bearerAuth({ verifyToken: async (token) => { /* existing */ } }))

// Existing routes follow unchanged:
app.route('/health', healthRoute)
// ...
```

---

### `packages/agent/src/routes/health.ts` (modify — add `understand` block)

**Analog:** self, following `gitnexus` field pattern (lines 19-31)

**Extension pattern** (mirrors `gitnexus` block at lines 19-31):
```typescript
// At daemon startup, detect viewer installation:
const viewerDir = getInstalledViewerPath()   // ~/.agenticapps/dashboard/understand-viewer/<ver>/
const viewerInstalled = viewerDir !== null
const viewerVersion = viewerInstalled ? getInstalledViewerVersion() : null
const pluginVersion = getNewestPluginCacheVersion()  // newest semver in ~/.claude/plugins/cache/...

const payload: HealthResponse = {
  ok: true,
  version: AGENT_VERSION,
  // ... existing fields ...
  gitnexus: { installed, canScan },
  // NEW — D-14-02 + RESEARCH Q5:
  understand: {
    viewerInstalled,
    viewerVersion,
    pluginVersion,
    updateAvailable: viewerVersion !== null && pluginVersion !== null && viewerVersion !== pluginVersion,
    viewerToken: getViewerToken(),  // scoped token for viewer URL construction (D-14-03)
  },
}
return outbound(c, HealthResponseSchema.parse.bind(HealthResponseSchema), payload)
```

---

### `packages/agent/src/lib/coverageScan.ts` (modify — add understand column)

**Analog:** self — `buildRow()` lines 163-260, `Promise.allSettled` fan-out pattern

**Integration pattern** (mirrors how `rateGitNexusRepo` is integrated at lines 182-218):
```typescript
// In buildRow(), add to Promise.allSettled array:
const [cmS, gnS, wkS, wfS, ovS, unS] = await Promise.allSettled([
  (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
  (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
  // ... existing 3 scanners ...
  (async () => scanUnderstandForRepo(repoAbsPath, readRepoHeadSha(repoAbsPath) ?? ''))(),
])

// Build understand column (mirrors gitNexus column pattern lines 206-218):
const understand =
  unS.status === 'fulfilled'
    ? {
        kind: 'basic' as const,
        state: unS.value.state,
        ...(unS.value.lastAnalyzedAt ? { label: unS.value.label } : {}),
      }
    : (() => {
        rowDegraded.push(`understand: ${String(unS.reason)}`)
        return { kind: 'basic' as const, state: 'missing' as const, degraded: true, degradedReason: String(unS.reason) }
      })()
```

---

### `packages/shared/src/schemas/coverage.ts` (modify — add understand column)

**Analog:** self — `gitNexus: CoverageBasicColumnSchema` on `CoverageRowSchema` (line 65), optional field pattern from `inRegistry` (lines 71-76)

**Extension pattern** (add to `CoverageRowSchema` after `workflowVersion`):
```typescript
// D-13-EXT-10 pattern: optional for back-compat with pre-Phase-14 daemons
understand: z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,  // 'present' | 'stale' | 'missing' | 'not-applicable'
  lastAnalyzedAt: z.string().optional(),  // meta.json.lastAnalyzedAt ISO string
  analyzedCommit: z.string().optional(),  // meta.json.gitCommitHash (short 7 chars)
  analyzedFiles: z.number().int().optional(),  // meta.json.analyzedFiles count
  label: z.string().optional(),           // 'stale' or undefined
  degraded: z.boolean().optional(),
  degradedReason: z.string().optional(),
}).strict().optional(),  // optional — back-compat with pre-Phase-14 daemons
```

---

### `packages/shared/src/schemas/health.ts` (modify — add understand block)

**Analog:** self — `gitnexus` block (lines 12-17), `.strict().optional()` pattern

**Extension pattern** (append after `gitnexus` block at line 16):
```typescript
// Phase 14 D-14-02: understand viewer version-drift detection + viewer token
understand: z.object({
  viewerInstalled: z.boolean(),
  viewerVersion: z.string().nullable(),   // semver string or null
  pluginVersion: z.string().nullable(),   // newest in plugin cache, or null
  updateAvailable: z.boolean(),           // viewerVersion !== pluginVersion
  viewerToken: z.string().optional(),     // scoped token for viewer URL construction
}).strict().optional(),  // optional — back-compat with pre-Phase-14 daemons
```

---

### `packages/shared/src/clipboard.ts` (modify — add buildUnderstandCommand)

**Analog:** self — `buildGitnexusIndexClipboardString` (lines 39-48), `GitnexusIndexCommand` interface (lines 39-44)

**Extension pattern** (append after existing `buildGitnexusIndexClipboardString`, mirrors D-13-10 shape exactly):
```typescript
/**
 * D-14-10: single source of truth for the understand-anything invocation.
 * Same {string, argv} shape as buildGitnexusIndexClipboardString (D-13-10).
 * `string` is for clipboard / copy pills; `argv` is for future daemon-spawn (Phase 15).
 */
export interface UnderstandCommand {
  readonly string: string
  readonly argv: readonly string[]  // for future headless daemon-spawn use
}

export function buildUnderstandCommand(family: string, repo: string): UnderstandCommand {
  return {
    string: `cd ~/Sourcecode/${family}/${repo} && claude "/understand"`,
    argv: ['/understand'],
  } as const
}
```

---

### `packages/spa/src/components/panels/coverage/UnderstandCopyPill.tsx` (new component)

**Analog:** `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` (complete file — copy pattern verbatim, adapt content)

**Imports pattern** (`InstallGitNexusButton.tsx` lines 14-19):
```typescript
import React from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { buildUnderstandCommand } from '@agenticapps/dashboard-shared'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { useToast } from '../../ui/Toast.js'
```

**Component structure pattern** (`InstallGitNexusButton.tsx` lines 20-40 — full structure):
```typescript
interface UnderstandCopyPillProps {
  family: string
  repo: string
  viewerUrl?: string      // present only when state === 'present'
  state: 'present' | 'stale' | 'missing'
}

export function UnderstandCopyPill({ family, repo, viewerUrl, state }: UnderstandCopyPillProps): React.JSX.Element {
  const toast = useToast()
  const cmd = buildUnderstandCommand(family, repo)

  return (
    <div className="flex items-center gap-2">
      {/* Viewer link — only when present (D-14-07 new tab) */}
      {state === 'present' && viewerUrl && (
        <a
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md text-xs text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Open knowledge graph for ${repo} in new tab`}
        >
          View <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      {/* Copy pill — on stale AND missing (D-14-10) */}
      <button
        type="button"
        onClick={async () => {
          const ok = await writeToClipboard(cmd.string)
          toast.show(
            ok
              ? { message: 'Copied — paste in terminal to analyze', variant: 'success' }
              : { message: 'Copy failed — see help guide for the command.', variant: 'error' },
          )
        }}
        aria-label={`Copy understand command for ${repo} to clipboard`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-secondary bg-card-bg-hover hover:bg-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Copy size={12} aria-hidden="true" />
        /understand
      </button>
    </div>
  )
}
```

---

### `packages/spa/src/components/panels/coverage/CoverageRow.tsx` (modify — add understand cell)

**Analog:** self — gitNexus cell pattern (lines 148-173), `COVERAGE_COL_WIDTHS` usage (line 24)

**Column addition pattern** (add after `workflowVersion` cell at line 189, before actions cell at line 192):
```typescript
// Props extension — add alongside gitnexusInstalled/gitnexusCanScan:
viewerUrl?: string          // built by CoveragePage from health.understand.viewerToken
understandViewerInstalled?: boolean  // health.understand.viewerInstalled

// New cell (mirrors gitNexus cell pattern lines 148-173):
<td className={`${COVERAGE_COL_WIDTHS.understand} px-2 py-2`}>
  {row.understand && (row.understand.state === 'missing' || row.understand.state === 'stale') ? (
    <UnderstandCopyPill
      family={row.family}
      repo={row.repo}
      viewerUrl={row.understand.state === 'present' ? viewerUrl : undefined}
      state={row.understand.state}
    />
  ) : row.understand ? (
    <CoverageCell
      column="understand"
      state={row.understand}
      repoName={row.repo}
      drift={null}
    />
  ) : null}
</td>
```

---

### `packages/spa/src/components/panels/coverage/coverageColumns.ts` (modify)

**Analog:** self — `COVERAGE_COL_WIDTHS` (lines 3-16), same width as `gitNexus` (`w-36`)

**Addition pattern** (insert before `actions` key):
```typescript
// Add to COVERAGE_COL_WIDTHS (mirrors gitNexus width — same content density):
understand: 'w-36',  // 144px — view link + copy pill (same content density as gitNexus)
```

---

### `packages/spa/src/components/panels/coverage/coverageColumnTooltips.ts` (modify)

**Analog:** self — existing tooltip entries (lines 8-11)

**Addition pattern** (append to `coverageColumnTooltips`):
```typescript
understand: 'Understand-anything knowledge graph. Built by `/understand`; stored under `<repo>/.understand-anything/`.',
```

---

### `packages/spa/src/components/ui/Sidebar.tsx` (modify — add Code Intelligence section)

**Analog:** self — `Observability` section pattern (lines 75-91)

**Section addition pattern** (insert between Observability and ACCOUNT sections, lines 92-104):
```typescript
// New icon — Network or GitBranch from lucide-react (import at top):
import { Activity, Cog, HelpCircle, FolderKanban, Layers, TrendingUp, Network } from 'lucide-react'

// Insert after Observability SidebarSection closing tag, before ACCOUNT:
<SidebarSection label="Code Intelligence">
  <SidebarItem
    to="/code-intelligence"
    icon={<Network size={16} aria-hidden="true" />}
    label="Knowledge graphs"
  />
</SidebarSection>
```

---

### `packages/spa/src/routes/code-intelligence.lazy.tsx` (new route)

**Analog:** `packages/spa/src/routes/observability.skill-drift.lazy.tsx` (complete file — exact pattern)

**File pattern** (copy structure exactly):
```typescript
import { createLazyRoute } from '@tanstack/react-router'
import { CodeIntelligencePage } from '../components/panels/code-intelligence/CodeIntelligencePage.js'

export const Route = createLazyRoute('/code-intelligence')({
  component: CodeIntelligencePage,
})
```

---

### `packages/spa/src/router.tsx` (modify — add code-intelligence route)

**Analog:** self — `observabilitySkillDriftRoute` (lines 125-128), `conformanceRoute` (lines 138-141), route tree (lines 179-192)

**Route addition pattern** (mirrors `observabilitySkillDriftRoute` definition + tree placement):
```typescript
// Add alongside other appShellLayoutRoute children (after conformanceRoute):
const codeIntelligenceRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/code-intelligence',
}).lazy(() => import('./routes/code-intelligence.lazy.js').then((m) => m.Route))

// In routeTree.addChildren array (after conformanceRoute):
codeIntelligenceRoute,  // Phase 14 D-14-06 — /code-intelligence under _appshell
```

---

### `packages/spa/src/lib/healthQueries.ts` (modify — extend for viewerToken)

**Analog:** self — `useHealth` pattern (complete file, 59 lines)

**Consumption pattern for viewer token** (no new hook needed; SPA reads from existing `useHealth()`):
```typescript
// In CoveragePage / CodeIntelligencePage:
const health = useHealth()
const viewerToken = health.data?.understand?.viewerToken  // string | undefined
const agentUrl = getPairing()?.agentUrl  // from lib/pairing.ts

// Construct viewer URL:
const viewerUrl = (viewerToken && agentUrl)
  ? `${agentUrl}/understand/${repoId}/?token=${encodeURIComponent(viewerToken)}`
  : undefined
```

---

### `packages/spa/src/components/panels/code-intelligence/CodeIntelligencePage.tsx` (new page)

**Analog:** `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` (page structure: PageHeader, loading/error states, TanStack Query data)

**Imports pattern** (from SkillDriftPage, adapt for understand):
```typescript
import React from 'react'
import { useHealth } from '../../../lib/healthQueries.js'
import { useCoverage } from '../../../lib/coverageQueries.js'
import { getPairing } from '../../../lib/pairing.js'
import { PageHeader } from '../../ui/PageHeader.js'
import { EmptyState } from '../../ui/EmptyState.js'
```

**Page structure** (health.understand drives the view; coverage rows filtered by understand.state !== 'missing'):
```typescript
// Loading / error states follow SkillDriftPage pattern.
// Content: table of repos where understand is present or stale,
// with viewer links (present) or copy pills (stale).
// Shows install hint when health.understand.viewerInstalled === false.
// Shows update hint when health.understand.updateAvailable === true.
```

---

## Shared Patterns

### Scoped Token Middleware (before global bearerAuth)
**Source:** `packages/agent/src/server/app.ts` lines 116-127 (bearerAuth `verifyToken` shape)
**Apply to:** `understandViewer.ts` route-level middleware, all 6 data endpoint handlers
```typescript
// timingSafeEqual pattern from app.ts lines 1, 117-126:
import { timingSafeEqual } from 'node:crypto'
const a = Buffer.from(token)
const b = Buffer.from(active)
if (a.length !== b.length) return c.json({ error: 'Forbidden' }, 403)
if (!timingSafeEqual(a, b)) return c.json({ error: 'Forbidden' }, 403)
```

### 0600 Atomic File Write
**Source:** `packages/agent/src/lib/atomicWrite.ts`, used in `auth.ts` line 108
**Apply to:** `viewerToken.ts` — all viewer token writes
```typescript
atomicWriteFile(filePath, JSON.stringify(data, null, 2), 0o600)
```

### outbound() Schema-Drift Defence (INV-04)
**Source:** `packages/agent/src/server/middleware/errors.ts`, used in `health.ts` line 33
**Apply to:** All JSON data endpoint responses in `understandViewer.ts`
```typescript
return outbound(c, SomeSchema.parse.bind(SomeSchema), payload)
```

### Optional Wire Fields for Back-Compat (D-13-EXT-10)
**Source:** `packages/shared/src/schemas/coverage.ts` lines 71-76 (`inRegistry: z.boolean().optional()`)
**Apply to:** `understand` field on `CoverageRowSchema`, `understand` block on `HealthResponseSchema`
```typescript
fieldName: z.object({ ... }).strict().optional()  // never .required() for new fields added mid-stream
```

### Toast + writeToClipboard Pattern
**Source:** `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` lines 25-32
**Apply to:** `UnderstandCopyPill.tsx`
```typescript
const ok = await writeToClipboard(someString)
toast.show(
  ok
    ? { message: 'Copied — paste in terminal ...', variant: 'success' }
    : { message: 'Copy failed — ...', variant: 'error' },
)
```

### Constraint: NO cn()/clsx/CVA, NO hex literals, NO shadcn aliases (D-5.1-10)
**Source:** `packages/spa/src/components/panels/coverage/CoverageRow.tsx` file header comment
**Apply to:** ALL new SPA components (`UnderstandCopyPill`, `CodeIntelligencePage`)

### Promise.allSettled Degraded-Row Pattern (AGREED-2)
**Source:** `packages/agent/src/lib/coverageScan.ts` lines 175-218
**Apply to:** `understandScanner.ts` integration in `buildRow()` — scanner failure yields `state: 'missing', degraded: true`

### FIX 2 Path Sanitisation
**Source:** RESEARCH.md Code Examples section (`sanitiseGraphNodes` function)
**Apply to:** `knowledge-graph.json` AND `domain-graph.json` handlers in `understandViewer.ts`
```typescript
// For each node with a filePath:
const rel = abs.startsWith(projectRoot)
  ? abs.slice(projectRoot.length).replace(/^[\\/]/, '')
  : isAbsolute(abs) ? basename(abs) : abs
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/agent/src/routes/understandViewer.ts` (static serving) | route | file-I/O | First use of `serveStatic` / static SPA asset hosting in this daemon; no prior static serving exists. RESEARCH.md Critical Q4 documents the CWD-relative `root` constraint |

---

## Critical Architecture Notes for Planner

1. **Data endpoint mount point** — The 6 data endpoints (`/knowledge-graph.json`, etc.) MUST be mounted at the TOP-LEVEL Hono app (not inside `understandViewerRoute`) because the viewer SPA fetches them via root-absolute paths. See RESEARCH.md Critical Q1. The per-repo token encodes repo identity; no `?repoId=` param needed.

2. **Mount order in app.ts** — Both `understandViewerRoute` and the 6 data endpoint handlers MUST be registered BEFORE `app.use(bearerAuth(...))` in `createApp()`. Hono processes routes in registration order; routes registered before `bearerAuth` are handled without reaching it.

3. **Viewer build flag** — `vite build --base="./"` makes asset chunk URLs relative, allowing `index.html` served at `/understand/{repoId}/` to load `./assets/index-xxxx.js` correctly. Without this flag, asset chunks request `/assets/index-xxxx.js` at origin root and 404.

4. **deterministicRepoRoot extraction** — The test file `deterministicRepoRoot.test.ts` already exists importing from `gitnexusScan.js`. After extracting to `repoRoot.ts`, update `gitnexusScan.ts` to re-export from `repoRoot.ts`, and update the test import to `repoRoot.js`.

5. **Git HEAD reading** — No existing coverage scanner reads git HEAD as a full 40-char SHA. The `understandScanner.ts` needs a new `readRepoHeadSha()` helper using pure FS reads (`.git/HEAD` + refs/packed-refs). No subprocess; matches "detection without execution" pattern from Phase 10.6.

6. **graphFilePathSet() caching** — Per RESEARCH.md Pitfall 4 and research Q2: parse fresh per `file-content.json` request. The 143kB JSON read costs ~1ms; caching introduces staleness when the user re-runs `/understand`. No TTL cache for v1.

---

## Metadata

**Analog search scope:** `packages/agent/src/`, `packages/shared/src/`, `packages/spa/src/`
**Files scanned:** 26 analog files read in full or in targeted sections
**Pattern extraction date:** 2026-06-07
