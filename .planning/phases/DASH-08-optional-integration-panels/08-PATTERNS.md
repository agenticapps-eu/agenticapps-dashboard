# Phase 8: Optional Integration Panels — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/agent/src/routes/sentry.ts` | route | request-response + cache | `packages/agent/src/routes/integrations.ts` | exact (env-gate + inline-Map cache + outbound) |
| `packages/agent/src/routes/linear.ts` | route | request-response + cache | `packages/agent/src/routes/integrations.ts` | exact (same pattern, different API shape) |
| `packages/agent/src/lib/outboundFetch.ts` | utility | request-response | `packages/agent/src/routes/integrations.ts` (cache shape) + `packages/agent/src/lib/atomicWrite.ts` (control-flow safety) | partial (extracts new helper, no direct analog) |
| `packages/agent/src/lib/envFile.ts` | utility | file-I/O | `packages/agent/src/lib/auth.ts` | exact (ensureAuthFile/assertSecurePermissions/atomicWriteFile/parseOrCorrupt pattern) |
| `packages/agent/src/cli/envCmd.ts` | cli | CRUD | `packages/agent/src/cli/registryCmd.ts` + `packages/agent/src/cli/token.ts` | role-match |
| `packages/agent/src/constants.ts` | config | — | `packages/agent/src/constants.ts` (modify existing) | exact (add ENV_FILE alongside AUTH_FILE) |
| `packages/shared/src/schemas/sentry.ts` | schema | — | `packages/shared/src/schemas/integrations.ts` + `packages/shared/src/schemas/observability.ts` | exact (z.object + dual export + z.enum) |
| `packages/shared/src/schemas/linear.ts` | schema | — | `packages/shared/src/schemas/integrations.ts` | exact |
| `packages/shared/src/schemas/env.ts` | schema | — | `packages/shared/src/schemas/auth.ts` | exact (version literal + z.record) |
| `packages/shared/src/index.ts` | config | — | `packages/shared/src/index.ts` (modify — add re-exports) | exact |
| `packages/spa/src/components/panels/SentryPanel.tsx` | component | request-response | `packages/spa/src/components/panels/ObservabilityHealth.tsx` + `IntegrationsHealth.tsx` | exact (query hook + 4-state render + PanelContainer) |
| `packages/spa/src/components/panels/LinearPanel.tsx` | component | request-response | `packages/spa/src/components/panels/ObservabilityHealth.tsx` | exact |
| `packages/spa/src/lib/projectQueries.ts` | hook | request-response | `packages/spa/src/lib/projectQueries.ts:267-280` (modify — add hooks) | exact (useIntegrations pattern) |
| `packages/agent/src/cli/start.ts` | cli | — | `packages/agent/src/cli/start.ts` (modify — add loadEnvFile call) | exact |
| `packages/agent/src/server/app.ts` | config | — | `packages/agent/src/server/app.ts` (modify — add route mounts) | exact |
| `packages/agent/src/routes/integrations.ts` | route | — | `packages/agent/src/routes/integrations.ts` (modify — INFI-03 scope from .infisical.json) | exact |

---

## Pattern Assignments

### `packages/agent/src/routes/sentry.ts` (route, request-response + cache)

**Primary analog:** `packages/agent/src/routes/integrations.ts`
**Secondary analog (project-id guard shape):** `packages/agent/src/routes/read.ts:27-43`

**Imports pattern** (`integrations.ts` lines 19-33):
```typescript
import { Hono } from 'hono'
import { SentryRecentResponseSchema } from '@agenticapps/dashboard-shared'

import { parseSentryClirc, detectSentryDsnEnv } from '../lib/projectMetadataScan.js'
import { runAllowedGit } from '../lib/git.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'
// Also import the shared outbound helpers once lib/outboundFetch.ts exists:
import { fetchWithTimeout, classifyError, type CacheEntry } from '../lib/outboundFetch.js'
```

**Env-gate + inline-Map cache pattern** (`integrations.ts` lines 36-61):
```typescript
// Copy exactly — same inline Map shape, same TTL_MS constant name, same CacheEntry interface
interface CacheEntry {
  value: unknown
  cachedAtMs: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000   // Sentry/Linear use 60s (not integrations.ts's 5s)

sentryRoute.get('/:id/sentry/recent', async (c) => {
  // 1. env-gate (copy from integrations.ts line 66 pattern)
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return c.json({ ok: false, error: 'not_configured', requestId: c.get('requestId') }, 404)
  }

  // 2. project lookup (copy from read.ts lines 35-43)
  const projectId = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) {
    return c.json({ ok: false, error: 'project_not_found', requestId: c.get('requestId') }, 404)
  }

  // 3. cache hit (copy from integrations.ts lines 58-61)
  const now = Date.now()
  const cached = cache.get(projectId)
  if (cached && now - cached.cachedAtMs < TTL_MS) {
    return outbound(c, SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema), cached.value)
  }

  // 4. fetch + lastGood fallback (see outboundFetch.ts pattern below)
  // 5. outbound(c, SentryRecentResponseSchema.parse.bind(...), value)
})
```

**Cache eviction export** (`integrations.ts` lines 104-106):
```typescript
// Add this at bottom — called from registry unregister
export function evictSentryCacheProject(id: string): void {
  cache.delete(id)
}
```

**What to copy vs change:**
- COPY: `Hono<Env>` instantiation, `readRegistry`, `outbound(c, Schema.parse.bind(Schema), value)` pattern
- COPY: `if (!entry)` 404 guard verbatim (same error key `project_not_found`)
- COPY: inline Map + TTL_MS check structure
- CHANGE: TTL_MS = `60_000` (not integrations.ts's `5_000`)
- CHANGE: env-gate checks `SENTRY_AUTH_TOKEN` and returns `not_configured` (not a 3-state response)
- ADD: `lastGood` sub-entry in CacheEntry (see outboundFetch.ts section)
- ADD: slug resolution cache (separate Map, 10-min TTL per RESEARCH Pitfall 5)

---

### `packages/agent/src/routes/linear.ts` (route, request-response + cache)

**Analog:** `packages/agent/src/routes/integrations.ts`

**Key divergences from sentry.ts:**
- Cache key is `${projectId}:${issueId}` (not projectId alone — RESEARCH Anti-Pattern / Pitfall 7)
- Route is `/:id/linear/issue/:issueId` (param extraction: `c.req.param('issueId')`)
- Env-gate checks `LINEAR_API_KEY`
- Git detection (branch + log) reuses the existing `LINEAR_BRANCH_RE` from integrations.ts

**Branch + log detection pattern** (`integrations.ts` lines 75-86 + RESEARCH Finding 4):
```typescript
// Copy from integrations.ts lines 44-45, 79-86:
const LINEAR_BRANCH_RE = /[A-Z]{2,}-\d+/g   // note: /g for matchAll in log
// Branch detection (copy):
const branchResult = await runAllowedGit('branch', root)
// Log detection (new — runAllowedGit('log') already has '--oneline -20' baked in):
const logResult = await runAllowedGit('log', root)
```

Note from `git.ts` lines 13-17: `log` command runs `['log', '--oneline', '-20']` — the 20-commit cap is already built in. No flag injection needed (RESEARCH Pitfall 6 is pre-solved by `ARGV_BY_CMD`).

**What to copy vs change:**
- COPY: env-gate, project lookup, cache hit/miss structure from integrations.ts
- COPY: `runAllowedGit('branch', root)` + `runAllowedGit('log', root)` pattern
- CHANGE: cache key = `${projectId}:${issueId}`
- CHANGE: Linear GraphQL POST (not a GET) for the actual API call
- CHANGE: `LINEAR_BRANCH_RE` with `/g` flag for `matchAll` on log output

---

### `packages/agent/src/lib/outboundFetch.ts` (utility, request-response)

**No direct codebase analog.** Closest pattern references:
- `packages/agent/src/routes/integrations.ts` lines 36-40: the `CacheEntry` shape to extend
- `packages/agent/src/lib/atomicWrite.ts`: control-flow safety pattern (try/finally cleanup)

**CacheEntry extension** (extend integrations.ts `CacheEntry` interface):
```typescript
// Integrations.ts uses:  { value: unknown; cachedAtMs: number }
// outboundFetch.ts adds: lastGood sub-entry (D-08-09)
export interface CacheEntry<T> {
  value: T
  cachedAtMs: number
  lastGood?: { value: T; cachedAtMs: number }   // D-08-09: survives TTL expiry
}
```

**fetchWithTimeout pattern** (from RESEARCH Finding 5 — no codebase analog):
```typescript
// Node 22 globals: fetch, AbortController — no import needed
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 5_000,
): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)  // mirrors atomicWrite.ts: always cleanup, even on throw
  }
}
```

**classifyError pattern** (RESEARCH Finding 6):
```typescript
export type OutboundErrorCategory = 'unreachable' | 'unauthorized' | 'rate-limited'

export function classifyError(err: unknown, status?: number, body?: unknown): OutboundErrorCategory {
  if (err instanceof Error && err.name === 'AbortError') return 'unreachable'
  if (err instanceof TypeError) return 'unreachable'    // DNS / ECONNREFUSED
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  // Linear-specific: HTTP 400 + errors[0].extensions.code === 'RATELIMITED' (RESEARCH Pitfall 1)
  if (status === 400 && isLinearRateLimited(body)) return 'rate-limited'
  return 'unreachable'
}
```

**What to copy vs change:**
- COPY: `CacheEntry` shape from integrations.ts and extend with `lastGood`
- COPY: try/finally pattern from atomicWrite.ts for cleanup discipline
- WRITE NEW: `fetchWithTimeout` + `classifyError` — no existing analog

---

### `packages/agent/src/lib/envFile.ts` (utility, file-I/O)

**Analog:** `packages/agent/src/lib/auth.ts`

**Imports pattern** (`auth.ts` lines 1-28):
```typescript
import { lstatSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, basename } from 'node:path'

import { EnvFileSchema, type EnvFile } from '@agenticapps/dashboard-shared'

import { ENV_FILE, CONFIG_DIR } from '../constants.js'
import { atomicWriteFile } from './atomicWrite.js'
import { agentError } from './logging.js'
import { parseOrCorrupt } from './stateCorruption.js'
// Re-use assertSecurePermissions from auth.ts — do NOT reimplement (RESEARCH "Don't Hand-Roll")
import { assertSecurePermissions } from './auth.js'
```

**loadEnvFile pattern** (`auth.ts` `readAuthFile` + `ensureAuthFile` lines 101-141 as template):
```typescript
export function loadEnvFile(filePath: string = ENV_FILE): void {
  if (!existsSync(filePath)) return   // env.json is optional — copy from ensureAuthFile line 126
  assertSecurePermissions(filePath)   // reuse auth.ts:67 — NOT stat, lstat inside
  const raw = readFileSync(filePath, 'utf8')  // copy from readAuthFile line 102
  const data = parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')  // line 103 shape
  for (const [key, value] of Object.entries(data.vars)) {
    if (!(key in process.env)) {    // D-08-12: process.env wins
      process.env[key] = value
    }
  }
}
```

**writeEnvFile pattern** (`auth.ts` `writeAuthFile` lines 112-116):
```typescript
export function writeEnvFile(data: EnvFile, filePath: string = ENV_FILE): void {
  const validated = EnvFileSchema.parse(data)         // copy line 113
  ensureConfigDir(dirname(filePath))                   // copy line 114 — reuse from auth.ts
  atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)  // copy line 115
}
```

Note: `ensureConfigDir` is `private` in auth.ts (not exported). Either export it, or inline the same logic in envFile.ts. Preferred: export it from auth.ts (it is already called from two places: `ensureAuthFile` and `writeAuthFile`).

**What to copy vs change:**
- COPY verbatim: `assertSecurePermissions` call (do not reimplement `lstatSync` check)
- COPY verbatim: `atomicWriteFile(path, body, 0o600)` pattern
- COPY verbatim: `parseOrCorrupt(Schema, JSON.parse(raw), 'env.json')` pattern
- COPY verbatim: `existsSync(filePath) return` early-exit guard
- CHANGE: `loadEnvFile` merges under `process.env` (auth.ts has no equivalent — new behavior)
- CHANGE: `EnvFileSchema` not `AuthFileSchema` (schema defined in shared/schemas/env.ts)

---

### `packages/agent/src/cli/envCmd.ts` (cli, CRUD)

**Primary analog:** `packages/agent/src/cli/registryCmd.ts`
**Secondary analog:** `packages/agent/src/cli/token.ts`

**CLI structure pattern** (`registryCmd.ts` lines 1-10 + `token.ts` lines 106-121):
```typescript
import pc from 'picocolors'
import { agentError, agentLog } from '../lib/logging.js'
import { loadEnvFile, writeEnvFile, readEnvFile } from '../lib/envFile.js'
import { AllowedEnvKeySchema, EnvFileSchema } from '@agenticapps/dashboard-shared'
import { ENV_FILE } from '../constants.js'
```

**runEnvSet pattern** (mirrors `runRename` from registryCmd.ts lines 47-62):
```typescript
export async function runEnvSet(key: string, value: string): Promise<void> {
  // Validate key against allow-list (D-08-13) — mirrors registryCmd.ts error pattern
  const keyResult = AllowedEnvKeySchema.safeParse(key)
  if (!keyResult.success) {
    agentError(`unknown env key: ${key}. Allowed: ${AllowedEnvKeySchema.options.join(', ')}`)
    process.exit(1)
  }
  // Read-merge-write (mirrors registryCmd.ts try/catch + agentError pattern)
  try {
    // ... read existing, merge key, write
    writeEnvFile(merged)
    agentLog(pc.green(`${key} saved. Restart the daemon to apply.`))
    process.exit(0)
  } catch (err) {
    agentError(`env set failed: ${(err as Error).message}`)
    process.exit(1)
  }
}
```

**runEnvList pattern** (mirrors `runList` from registryCmd.ts lines 8-44 — tabular output):
```typescript
export async function runEnvList(): Promise<void> {
  // D-08-14: redacted — key + set/unset + source + last-4 at most
  // Output format mirrors registryCmd.ts column pattern
  for (const key of ALLOWED_ENV_KEYS) {
    const fromEnv = key in process.env
    const fromFile = /* check env.json */
    const source = fromEnv ? 'process.env' : fromFile ? 'env.json' : '—'
    const masked = fromEnv || fromFile ? `****${(process.env[key] ?? fileVal).slice(-4)}` : '—'
    agentLog(`${key.padEnd(25)}  ${(fromEnv || fromFile ? 'set' : 'unset').padEnd(6)}  ${source.padEnd(12)}  ${masked}`)
  }
  process.exit(0)
}
```

**What to copy vs change:**
- COPY: `agentError(...); process.exit(1)` error pattern from registryCmd.ts
- COPY: `agentLog(pc.green(...)); process.exit(0)` success pattern from token.ts line 110
- COPY: tabular `padEnd` column format from registryCmd.ts lines 20-43
- CHANGE: allow-list validation before write (no equivalent in registryCmd.ts)
- CHANGE: D-08-14 value redaction (no equivalent — new behavior)

---

### `packages/agent/src/constants.ts` (modify — add ENV_FILE)

**Analog:** `packages/agent/src/constants.ts` lines 9-10 (existing file)

**Pattern to copy** (`constants.ts` lines 9-11):
```typescript
export const CONFIG_DIR = join(homedir(), '.agenticapps', 'dashboard')
export const AUTH_FILE = join(CONFIG_DIR, 'auth.json')
export const REGISTRY_FILE = join(CONFIG_DIR, 'registry.json')
```

**What to add** (after `AUTH_FILE`, matching exact style):
```typescript
export const ENV_FILE = join(CONFIG_DIR, 'env.json')
```

---

### `packages/shared/src/schemas/sentry.ts` (new schema)

**Analog:** `packages/shared/src/schemas/integrations.ts` (dual export pattern) + `packages/shared/src/schemas/observability.ts` (z.object + z.enum + z.array structure)

**Full pattern** (`integrations.ts` lines 1-24):
```typescript
import { z } from 'zod'

// Pattern: named Schema const + inferred type, both exported
export const IntegrationStateSchema = z.enum([...])
export type IntegrationState = z.infer<typeof IntegrationStateSchema>

export const IntegrationsResponseSchema = z.object({
  sentry: IntegrationStateSchema,
  ...
})
export type IntegrationsResponse = z.infer<typeof IntegrationsResponseSchema>
```

**Apply to sentry.ts:**
```typescript
import { z } from 'zod'

export const SentryIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.enum(['fatal', 'error', 'warning', 'info', 'debug']),
  count: z.string(),          // Sentry returns count as JSON string (RESEARCH Pitfall 2)
  lastSeen: z.string(),
  permalink: z.string().url(),
  shortId: z.string(),
})
export type SentryIssue = z.infer<typeof SentryIssueSchema>

export const SentryRecentResponseSchema = z.object({
  issues: z.array(SentryIssueSchema).max(5),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type SentryRecentResponse = z.infer<typeof SentryRecentResponseSchema>
```

---

### `packages/shared/src/schemas/linear.ts` (new schema)

**Analog:** Same as sentry.ts — `integrations.ts` dual-export pattern.

```typescript
import { z } from 'zod'

export const LinearIssueSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  url: z.string().url(),
  stateName: z.string(),
  stateType: z.enum(['started', 'completed', 'cancelled', 'backlog', 'unstarted']),
  assigneeName: z.string().nullable(),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type LinearIssue = z.infer<typeof LinearIssueSchema>

export const LinearIssueResponseSchema = z.object({
  issue: LinearIssueSchema.nullable(),
})
export type LinearIssueResponse = z.infer<typeof LinearIssueResponseSchema>
```

---

### `packages/shared/src/schemas/env.ts` (new schema — daemon-only, NOT re-exported to SPA)

**Analog:** `packages/shared/src/schemas/auth.ts`

**Auth schema pattern** (`auth.ts` — read via shared/src/schemas/auth.ts):
```typescript
import { z } from 'zod'

export const AuthFileSchema = z.object({
  version: z.literal(1),
  token: TokenSchema,
  rotatedAt: z.string(),
  agentVersion: z.string(),
})
export type AuthFile = z.infer<typeof AuthFileSchema>
```

**Apply to env.ts:**
```typescript
import { z } from 'zod'

export const ALLOWED_ENV_KEYS = ['SENTRY_AUTH_TOKEN', 'LINEAR_API_KEY', 'INFISICAL_TOKEN'] as const
export const AllowedEnvKeySchema = z.enum(ALLOWED_ENV_KEYS)
export type AllowedEnvKey = z.infer<typeof AllowedEnvKeySchema>

export const EnvFileSchema = z.object({
  version: z.literal(1),
  vars: z.record(AllowedEnvKeySchema, z.string()),
})
export type EnvFile = z.infer<typeof EnvFileSchema>
```

Note: `env.ts` is imported by the **daemon only** (lib/envFile.ts, cli/envCmd.ts). It must be present in `packages/shared/src/schemas/` but should NOT be re-exported from `packages/shared/src/index.ts` to the SPA — secrets schema has no SPA surface.

---

### `packages/shared/src/index.ts` (modify — add re-exports)

**Analog:** `packages/shared/src/index.ts` lines 120-127 (integrations re-export block as template)

**Pattern to copy** (lines 120-127):
```typescript
export {
  IntegrationStateSchema,
  IntegrationsResponseSchema,
} from './schemas/integrations.js'
export type {
  IntegrationState,
  IntegrationsResponse,
} from './schemas/integrations.js'
```

**Add for Phase 8 (Sentry + Linear only; env.ts is daemon-only):**
```typescript
// Phase 8 — Sentry data panel schemas (D-08-03, INV-04)
export {
  SentryIssueSchema,
  SentryRecentResponseSchema,
} from './schemas/sentry.js'
export type {
  SentryIssue,
  SentryRecentResponse,
} from './schemas/sentry.js'

// Phase 8 — Linear data panel schemas (D-08-07, INV-04)
export {
  LinearIssueSchema,
  LinearIssueResponseSchema,
} from './schemas/linear.js'
export type {
  LinearIssue,
  LinearIssueResponse,
} from './schemas/linear.js'
```

---

### `packages/spa/src/components/panels/SentryPanel.tsx` (component, request-response)

**Analog:** `packages/spa/src/components/panels/ObservabilityHealth.tsx` (4-state render) + `packages/spa/src/components/panels/IntegrationsHealth.tsx` (configure-to-enable empty state)

**Component skeleton pattern** (`ObservabilityHealth.tsx` lines 1-88 — full structure):
```typescript
import React from 'react'
import { ExternalLink } from 'lucide-react'   // for D-08-04 link-out

import { useSentryRecent } from '../../lib/projectQueries.js'
import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type SentryPanelProps = { projectId: string }

const PANEL_ID = 'sentry-panel'
const PANEL_TITLE = 'Sentry'

export function SentryPanel({ projectId }: SentryPanelProps): React.JSX.Element {
  const query = useSentryRecent(projectId)

  // 1. Schema drift (copy ObservabilityHealth.tsx lines 37-47 verbatim)
  if (query.error?.message?.startsWith('schema_drift:')) { ... }

  // 2. Loading (copy ObservabilityHealth.tsx lines 49-56 verbatim)
  if (query.isLoading) { ... }

  // 3. Unreachable (copy ObservabilityHealth.tsx lines 58-65 verbatim)
  if (query.error || !query.data) { ... }

  const data = query.data

  // 4a. not_configured empty state — STATIC JSX (T-05-05-Static-Copy-Trust)
  //     Copy IntegrationsHealth.tsx "not-detected" paragraph pattern (lines 162-169)
  //     Empty state: defaultCollapsed (D-6.1-02 pattern from IntegrationsHealth.tsx line 149)

  // 4b. Happy path: list of issues with link-out (D-08-04)
  //     PanelContainer with stale prop when data.stale === true
  return (
    <PanelContainer
      panelId={PANEL_ID}
      title={PANEL_TITLE}
      stale={data.stale}   // PanelContainer.tsx line 36: stale prop renders 'Stale' pill
    >
      ...
    </PanelContainer>
  )
}
```

**Stale pill pattern** (`PanelContainer.tsx` lines 80-84):
```tsx
{stale && (
  <span className="rounded-md bg-card-bg-hover px-2 py-0.5 text-xs font-semibold text-status-warning">
    Stale
  </span>
)}
```

**Link-out pattern** (D-08-04 — no existing analog, but Tailwind classes from IntegrationsHealth):
```tsx
<a
  href={issue.permalink}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
>
  {issue.shortId}
  <ExternalLink size={12} aria-hidden="true" />
</a>
```

**Empty-state copy rule** (T-05-05-Static-Copy-Trust, from IntegrationsHealth.tsx lines 41-93):
- All "Configure to enable" copy is a JSX literal — no daemon content interpolated
- Only error `title`, `shortId`, `level`, `count`, `lastSeen` from daemon (React-escaped automatically)

**What to copy vs change:**
- COPY verbatim: 4-state guard block (drift/loading/unreachable/happy) from ObservabilityHealth.tsx lines 37-65
- COPY verbatim: `PanelContainer` with `stale` prop
- COPY: `defaultCollapsed` empty state from IntegrationsHealth.tsx line 149
- ADD: `stale` banner text when `data.staleFrom` present ("Sentry API unreachable — using cached data from {time}")
- ADD: link-out with `<ExternalLink>` icon per D-08-04

---

### `packages/spa/src/components/panels/LinearPanel.tsx` (component, request-response)

**Analog:** `packages/spa/src/components/panels/ObservabilityHealth.tsx` (same 4-state structure)

**What to copy vs change:**
- COPY verbatim: same 4-state guard block as SentryPanel.tsx
- COPY: `PanelContainer` with `stale` prop
- COPY: empty-state `defaultCollapsed` pattern
- ADD: list of up to 3 issues (capped per D-08-07) each with `identifier`, `title`, `stateName`, `assigneeName`
- ADD: link-out to `issue.url` per D-08-07 (same `<ExternalLink>` pattern as SentryPanel)
- ADD: static "Configure to enable" JSX copy when data is null/not_configured

---

### `packages/spa/src/lib/projectQueries.ts` (modify — add useSentryRecent + useLinearIssues)

**Analog:** `packages/spa/src/lib/projectQueries.ts` lines 267-280 (`useIntegrations` hook)

**Exact pattern to copy** (lines 267-280):
```typescript
export function useIntegrations(id: string | null) {
  return useQuery({
    queryKey: ['integrations', id] as const,
    queryFn: async (): Promise<IntegrationsResponse> => {
      const result = await apiFetch(`/api/projects/${id}/integrations`, IntegrationsResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}
```

**useSentryRecent — copy and change:**
```typescript
const SENTRY_TTL_MS = 60_000   // mirror SKILLS_TTL_MS = 60_000 at line 59

export function useSentryRecent(id: string | null) {
  return useQuery({
    queryKey: ['sentry-recent', id] as const,   // per-project key (T-05-05-Cross-Project-Cache)
    queryFn: async (): Promise<SentryRecentResponse> => {
      const result = await apiFetch(`/api/projects/${id}/sentry/recent`, SentryRecentResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: SENTRY_TTL_MS,
    refetchInterval: SENTRY_TTL_MS,
    refetchIntervalInBackground: false,
  })
}
```

**useLinearIssues — note:** the Linear route is per-issueId (`/linear/issue/:issueId`), not a list endpoint. The SPA needs to first detect issue IDs from branch/log (which comes from the existing git route) then fetch each — OR the daemon returns a list endpoint. Per the architecture diagram in RESEARCH.md, the SPA calls `useLinearIssues(id)` which maps to a new `GET /api/projects/:id/linear/issues` list endpoint that does detection + multi-fetch internally. Confirm with planner which endpoint shape to use. If daemon-side aggregation:

```typescript
export function useLinearIssues(id: string | null) {
  return useQuery({
    queryKey: ['linear-issues', id] as const,
    queryFn: async (): Promise<LinearIssuesResponse> => {  // new response type
      const result = await apiFetch(`/api/projects/${id}/linear/issues`, LinearIssuesResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: SENTRY_TTL_MS,
    refetchInterval: SENTRY_TTL_MS,
    refetchIntervalInBackground: false,
  })
}
```

**Imports to add** at the top of the existing import block (lines 30-53):
```typescript
import {
  SentryRecentResponseSchema,
  type SentryRecentResponse,
  LinearIssueResponseSchema,
  type LinearIssueResponse,
} from '@agenticapps/dashboard-shared'
```

---

### `packages/agent/src/cli/start.ts` (modify — add loadEnvFile call)

**Analog:** `packages/agent/src/cli/start.ts` lines 45-54 (existing boot sequence)

**Existing sequence** (lines 45-54):
```typescript
ensureRegistryFile()
let auth = ensureAuthFile()
ensureViewerSecretFile()   // D-14-03

if (shouldAutoRotate(auth)) {
  auth = rotateToken()
}

assertNoStaleDaemon()
```

**What to add** (after `ensureAuthFile`, wrapped in try/catch per RESEARCH Pitfall 4):
```typescript
// Phase 8 D-08-12/15: load env.json, merge under process.env (must not block start)
try {
  loadEnvFile()
} catch (e) {
  agentError(`env.json corrupt or unreadable — skipping env merge; run \`env set\` to reset: ${(e as Error).message}`)
  // daemon continues — D-08-15 "never blocks boot"
}
```

Insert between `ensureViewerSecretFile()` (line 47) and `if (shouldAutoRotate(auth))` (line 50).

---

### `packages/agent/src/server/app.ts` (modify — add route mounts)

**Analog:** `packages/agent/src/server/app.ts` lines 174-197 (route mounting block)

**Existing pattern** (lines 191-192):
```typescript
app.route('/api/projects', integrationsRoute)
app.route('/api/projects', secretsRoute)
```

**What to add** (after `integrationsRoute` mount, matching exact style):
```typescript
app.route('/api/projects', sentryRoute)    // Phase 8 D-08-03: GET /:id/sentry/recent
app.route('/api/projects', linearRoute)    // Phase 8 D-08-07: GET /:id/linear/issue/:issueId
```

And add imports at the top of app.ts (after `integrationsRoute` import, matching style):
```typescript
import { sentryRoute } from '../routes/sentry.js'
import { linearRoute } from '../routes/linear.js'
```

---

### `packages/agent/src/routes/integrations.ts` (modify — INFI-03 scope reflection)

**Analog:** `packages/agent/src/routes/integrations.ts` lines 88-96 (existing Infisical detection)

**Existing Infisical detection** (lines 88-96):
```typescript
const infisicalEnvPresent = !!(process.env.INFISICAL_TOKEN || process.env.INFISICAL_API_TOKEN)
const infisicalConfig = await parseInfisicalConfig(root)
const infisicalSignalDetected = infisicalConfig.state === 'present-valid'
```

**What INFI-03 adds:** When `infisicalConfig.state === 'present-valid'`, expose `workspaceId` and `defaultEnvironment` in the response. Requires extending `IntegrationsResponseSchema` in shared:

```typescript
// In shared/src/schemas/integrations.ts: add optional infisical scope fields
export const IntegrationsResponseSchema = z.object({
  sentry: IntegrationStateSchema,
  linear: IntegrationStateSchema,
  infisical: IntegrationStateSchema,
  // INFI-03: optional scope metadata (safe fields — not secrets)
  infisicalWorkspaceId: z.string().optional(),
  infisicalEnvironment: z.string().optional(),
})
```

Then in integrations.ts, extend the value object (lines 93-97):
```typescript
const value = {
  sentry: computeIntegrationState({ envVarPresent: sentryEnvPresent, signalDetected: sentrySignalDetected }),
  linear: computeIntegrationState({ envVarPresent: linearEnvPresent, signalDetected: linearSignalDetected }),
  infisical: computeIntegrationState({ envVarPresent: infisicalEnvPresent, signalDetected: infisicalSignalDetected }),
  // INFI-03: safe metadata fields (workspaceId + defaultEnvironment are not secrets)
  ...(infisicalConfig.state === 'present-valid' && {
    infisicalWorkspaceId: infisicalConfig.workspaceId,
    infisicalEnvironment: infisicalConfig.defaultEnvironment,
  }),
}
```

---

## Shared Patterns

### outbound() schema-drift defense
**Source:** `packages/agent/src/server/middleware/errors.ts` lines 22-37
**Apply to:** ALL new route handlers (sentry.ts, linear.ts)
```typescript
// NEVER do: c.json(Schema.parse(value))
// ALWAYS do:
return outbound(c, SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema), value)
// outbound() catches schema_drift internally, returns 500 with error='schema_drift'
```

### Project lookup guard
**Source:** `packages/agent/src/routes/read.ts` lines 38-43 + `integrations.ts` lines 51-55
**Apply to:** All new routes that take `:id`
```typescript
const reg = readRegistry(c.get('registryFile') as string | undefined)
const entry = reg.projects.find((p) => p.id === projectId)
if (!entry) {
  return c.json({ ok: false, error: 'project_not_found', requestId: c.get('requestId') }, 404)
}
```

### Env-gate pattern
**Source:** `packages/agent/src/routes/integrations.ts` lines 66, 76, 89 (per-integration env checks)
**Apply to:** sentry.ts, linear.ts
```typescript
if (!process.env.SENTRY_AUTH_TOKEN) {
  return c.json({ ok: false, error: 'not_configured', requestId: c.get('requestId') }, 404)
}
```

### assertSecurePermissions (lstat, not stat)
**Source:** `packages/agent/src/lib/auth.ts` lines 67-88
**Apply to:** `lib/envFile.ts` — IMPORT AND REUSE, do not reimplement
```typescript
// auth.ts uses lstatSync at line 68 to reject symlinks
// Call assertSecurePermissions(filePath) before any readFileSync on env.json
```

### atomicWriteFile (0600 mode)
**Source:** `packages/agent/src/lib/atomicWrite.ts` lines 24-63
**Apply to:** `lib/envFile.ts` writeEnvFile
```typescript
atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)
//                                                             ^^^^ must match auth.json mode
```

### parseOrCorrupt (state file validation)
**Source:** `packages/agent/src/lib/stateCorruption.ts` lines 26-33
**Apply to:** `lib/envFile.ts` — all JSON reads from env.json
```typescript
const data = parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')
// Throws StateCorruptionError (not ZodError) — caught by errorHandler as 500 schema_drift
```

### TanStack Query hook shape
**Source:** `packages/spa/src/lib/projectQueries.ts` lines 267-280
**Apply to:** `useSentryRecent`, `useLinearIssues` in projectQueries.ts
```typescript
// Three invariants (copy from useIntegrations):
queryKey: ['key-name', id] as const   // id in key = cross-project cache safety
enabled: id !== null                   // null-safe
refetchIntervalInBackground: false     // D-4-02 — no background polling
```

### Schema dual-export (INV-04)
**Source:** `packages/shared/src/schemas/integrations.ts` lines 1-24
**Apply to:** sentry.ts, linear.ts, env.ts in schemas/
```typescript
// Always: export const XSchema + export type X = z.infer<typeof XSchema>
// Always: re-export both from index.ts using named blocks
```

### Static copy JSX (T-05-05-Static-Copy-Trust)
**Source:** `packages/spa/src/components/panels/IntegrationsHealth.tsx` lines 41-93
**Apply to:** SentryPanel.tsx, LinearPanel.tsx — "Configure to enable" copy
```typescript
// Empty state copy is JSX literals, NOT daemon-supplied strings
// The integration data (titles, issue IDs) IS daemon-supplied — it is React-escaped automatically
// NEVER do: <p>{configureMessage}</p> where configureMessage comes from query.data
// ALWAYS do: <p>Set <code>SENTRY_AUTH_TOKEN</code> to enable the panel.</p>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/agent/src/lib/outboundFetch.ts` | utility | request-response | First outbound HTTP helper in the codebase; `fetchWithTimeout` + `classifyError` have no existing analog. Use RESEARCH Finding 5/6 patterns directly. |

---

## Metadata

**Analog search scope:** `packages/agent/src/`, `packages/shared/src/`, `packages/spa/src/`
**Files scanned:** 20 source files read directly
**Key design invariants confirmed from codebase:**
- `runAllowedGit('log', root)` uses `['log', '--oneline', '-20']` (ARGV_BY_CMD in git.ts line 14) — 20-commit cap already built in; RESEARCH Pitfall 6 is pre-solved
- `outbound()` wraps ALL route responses — never bare `c.json(Schema.parse(...))`
- All CLI commands: `agentError(...); process.exit(1)` on error; `agentLog(...); process.exit(0)` on success
- `integrations.ts` exports `evictIntegrationsCacheProject(id)` — new routes should do the same
- `IntegrationsResponseSchema` in shared must be extended (not replaced) for INFI-03 to add optional scope fields
- `env.ts` schema goes in `packages/shared` but is NOT re-exported from `index.ts` to the SPA
**Pattern extraction date:** 2026-06-11
