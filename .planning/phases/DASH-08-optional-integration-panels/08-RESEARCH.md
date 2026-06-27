# Phase 8: Optional Integration Panels — Research

**Researched:** 2026-06-11
**Domain:** Sentry REST API, Linear GraphQL API, Node built-in fetch, env.json boot plumbing, .infisical.json scope reflection
**Confidence:** HIGH (Sentry issues endpoint, Linear GraphQL, Node fetch), MEDIUM (Sentry DSN→slug via list-projects), HIGH (env.json auth.ts precedent)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-08-01:** DSN→slug resolved automatically from project's parsed DSN/`.sentryclirc` (integrations.ts already reads these); explicit slug fallback if auto-resolution proves unreliable.
- **D-08-02:** Compact top-5 recent unresolved issues: title, level badge, event count, last-seen relative time.
- **D-08-03:** New standalone Sentry panel in single-project view.
- **D-08-04:** Each error links out to its Sentry issue URL.
- **D-08-05:** Surface issues from current branch name AND recent commit messages (deduped), `[A-Z]{2,}-\d+` regex.
- **D-08-06:** Auto-fetch title/status/assignee for detected IDs, cached ~60s.
- **D-08-07:** New standalone Linear panel in single-project view, capped at 3 detected issues.
- **D-08-08:** ~5s timeout, no retry (researcher may add one retry only if rate behavior demands it).
- **D-08-09:** Serve last successful response from memory labeled "using cached data from {time}" on API failure.
- **D-08-10:** Document data-boundary exception explicitly in phase threat model.
- **D-08-11:** Sanitize upstream errors to fixed categories: `unreachable` / `unauthorized` / `rate-limited`.
- **D-08-12:** `process.env` wins; env.json only fills gaps (mandatory for `infisical run` — INFI-01).
- **D-08-13:** `env set` accepts an allow-list only: `SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, and Infisical token key.
- **D-08-14:** `env list` output is redacted — shows key + set/unset + source (env.json vs process.env), never the value.
- **D-08-15:** env.json loaded at daemon boot, merged under `process.env`; `env set` prints "restart to apply" hint.

### Claude's Discretion
- Exact Sentry DSN→slug resolution mechanism (D-08-01) — researcher decides.
- Shared Zod schema shape for `sentry/recent` and `linear/issue` payloads (INV-04).
- `/help` setup-guide copy for each integration (SENTRY-03 / LINEAR-03 link target).
- How the Infisical `scope` field (INFI-03) is populated from `.infisical.json`.

### Deferred Ideas (OUT OF SCOPE)
- Hot-reload of env values into a running daemon.
- Arbitrary-key env store.
- Forwarding rich upstream error diagnostics to the SPA.
- Full Infisical secrets-management UI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SENTRY-01 | `GET /api/projects/{id}/sentry/recent` returns recent errors when `SENTRY_AUTH_TOKEN` set | Sentry `GET /api/0/organizations/{org}/issues/` verified; DSN→slug resolution path documented |
| SENTRY-02 | ~60s cache; on failure fall back to "Sentry API unreachable — using cached data from {time}"; never crashes | Node fetch + AbortController + last-good retention pattern documented |
| SENTRY-03 | Without token: "Configure to enable" empty state + `/help` setup guide | Empty-state pattern from existing panels documented; static JSX copy rule |
| LINEAR-01 | `GET /api/projects/{id}/linear/issue/{issueId}` returns title/status/assignee | Linear GraphQL endpoint + exact query verified |
| LINEAR-02 | Branch/commit pattern detection; static link is API-free | Existing `[A-Z]{2,}-\d+` branch regex in integrations.ts; commit log via `runAllowedGit('log')` |
| LINEAR-03 | Without key: "Configure to enable" empty state | Same empty-state pattern |
| INFI-01 | Daemon reads env from `process.env`; `infisical run` works with no code change | D-08-12 process.env-wins merge documented; boot wiring identified |
| INFI-02 | `agentic-dashboard env set` writes `~/.agenticapps/dashboard/env.json` (mode `0600`) | auth.ts precedent (atomicWriteFile + assertSecurePermissions) mapped |
| INFI-03 | Read-only Infisical status reflection in IntegrationsHealth: scope, no privileged calls | `.infisical.json` already parsed by `parseInfisicalConfig`; workspaceId + defaultEnvironment safe fields identified |
| INV-01 | Read-only on project filesystems | Sentry/Linear routes read only their own API responses; no project FS writes |
| INV-02 | No native dependencies | Node built-in `fetch` (Node 22 confirmed) — no new dep needed |
| INV-03 | Optional integrations stay optional | 404 when env var unset (spec contract); all existing routes unaffected |
| INV-04 | Shared Zod schema SoT for new wire shapes | `packages/shared/src/schemas/sentry.ts` + `linear.ts` pattern documented |
| INV-05 | Secrets on disk at 0600; no token logged or sent to SPA | D-08-11 sanitization + D-08-14 redaction patterns documented |
</phase_requirements>

---

## Summary

Phase 8 introduces the first and only outbound HTTP calls the daemon makes — to Sentry and Linear APIs. Every other daemon route is purely local. This makes the outbound posture the most security-sensitive new surface: tokens must never leave via the SPA, errors must be sanitized to fixed categories, and the network path must be opt-in via env var.

The research resolves seven previously-deferred unknowns. The Sentry issues endpoint is confirmed as the org-level `GET /api/0/organizations/{org}/issues/` (the per-project endpoint is deprecated). DSN→slug resolution works by parsing the DSN for the numeric project ID, then calling `GET /api/0/projects/` (the user-scoped listing) and matching `id` — both `organization.slug` and `project.slug` are in the response. This is a two-call resolution that runs once per project and can be cached alongside the issues.

Linear's GraphQL API accepts the human-readable identifier (`BLA-123`) directly in `issue(id: "BLA-123")` — no UUID lookup required. The Authorization header uses the raw API key (`Authorization: lin_api_...`) without a `Bearer` prefix. Rate limits are 5,000 requests/hour; a 60s cache reduces that to ~60 calls/hour per project in steady state.

The env.json plumbing follows the auth.json precedent exactly: `atomicWriteFile` at mode `0600`, `assertSecurePermissions` on read, loaded in `runStart` before `bootDaemon`, merged under `process.env` so `infisical run` remains authoritative.

**Primary recommendation:** Implement the Sentry route as two calls (resolve slug → fetch issues) with the slug cached separately (10 min TTL, cleared on project unregister). Implement the Linear route as a direct GraphQL POST using the human identifier. Both routes share a single `withTimeout` + `lastGoodValue` helper to avoid duplicating the cache+fallback logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sentry issues fetch + cache | API / Backend (daemon) | — | Token lives server-side; never exposed to SPA |
| Linear issue fetch + cache | API / Backend (daemon) | — | API key lives server-side; SPA never touches it |
| Linear issue ID detection (branch + log) | API / Backend (daemon) | — | Git access is daemon-side via `runAllowedGit` |
| env.json read/write | API / Backend (daemon) | — | Secrets on disk; CLI + daemon only |
| Error sanitization to fixed categories | API / Backend (daemon) | — | Prevents token/raw-error leakage to SPA |
| Sentry panel UI + empty state | Browser / Client (SPA) | — | Static JSX; no token interpolation |
| Linear panel UI + empty state | Browser / Client (SPA) | — | Static JSX; no token interpolation |
| Infisical scope reflection | API / Backend (daemon) | SPA (render) | Daemon parses `.infisical.json`; SPA renders read-only field already in SecretsResponse |
| Shared Zod schemas | Shared (`packages/shared`) | — | Single source of truth; both ends import |

---

## Standard Stack

### Core (no new packages — all existing or built-in)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-in `fetch` | Node 22 (project minimum) | Outbound HTTP to Sentry + Linear | INV-02: no new dep; `fetch` + `AbortController` available since Node 18 [VERIFIED: Node.js docs] |
| `zod` | already in workspace | Shared schema for new wire shapes | Established project pattern (INV-04) [ASSUMED] |
| `hono` | already in workspace | New route handlers | Established project pattern [ASSUMED] |
| `@tanstack/react-query` | already in workspace | SPA query hooks | Established project pattern [ASSUMED] |

### Supporting (no new packages)
None. Every capability is covered by existing workspace packages or Node built-ins.

**Installation:** No new packages required. `packages/agent` Node 22 already ships `fetch` + `AbortController` as globals.

---

## Package Legitimacy Audit

No new external packages are introduced in Phase 8. The phase uses only:
- Node 22 built-in `fetch` / `AbortController` — runtime built-in, no registry entry
- Existing workspace packages: `hono`, `zod`, `@tanstack/react-query`, `vitest`

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Research Finding 1: Sentry DSN → Org/Project Slug Resolution (D-08-01)

### DSN Format (confirmed)
[CITED: docs.sentry.io/concepts/key-terms/dsn-explainer/]

Format: `{PROTOCOL}://{PUBLIC_KEY}@{HOST}/{NUMERIC_PROJECT_ID}`

Modern ingest DSNs: `https://<pubkey>@o<ORG_ID>.ingest.sentry.io/<NUMERIC_PROJECT_ID>`

Key insight: the DSN contains a **numeric project ID** and optionally a numeric org ID (in the subdomain). Neither is the string slug needed for the issues API.

### Resolution Mechanism
[CITED: docs.sentry.io/api/projects/list-your-projects/]

**Step 1:** Parse the DSN to extract the numeric project ID (last path segment as integer).

**Step 2:** Call `GET https://sentry.io/api/0/projects/` with `Authorization: Bearer <SENTRY_AUTH_TOKEN>`. This returns all projects accessible to the token. Each project object contains:
- `id` (string of the numeric project ID)
- `slug` (the project slug needed for the issues API)
- `organization.slug` (the org slug needed for the issues API)

**Step 3:** Find the project whose `id` matches the DSN's numeric project ID. Extract `slug` and `organization.slug`.

**Caveats and fallback:**
- The per-project listing (`GET /api/0/projects/`) requires scope `project:read`. Org-internal auth tokens (from Internal Integrations) reportedly cannot use this endpoint per a known GitHub issue — personal auth tokens (the `SENTRY_AUTH_TOKEN` user scenario) work fine. [CITED: github.com/getsentry/sentry/issues/19061]
- If the project has thousands of accessible projects, cursor pagination is required. Implement a max-pages guard (e.g. 10 pages × 100 per page = 1,000 projects) to avoid unbounded calls.
- **Fallback:** If the list-projects call fails or the numeric ID is not found after pagination, log the failure and return `unreachable` to the SPA. Require the user to set an explicit override (e.g., `SENTRY_ORG_SLUG` + `SENTRY_PROJECT_SLUG` env vars) — document in `/help`.
- **Cache the slug pair** alongside the project for ~10 minutes (much longer than the 60s issues TTL) so the resolution call is rare.

**Alternative if `.sentryclirc` is present:** The existing `parseSentryClirc` is existence-only (no INI parse, per Phase 5 RESEARCH). To extract org/project slug from `.sentryclirc`, a minimal INI-line parser is needed (lines of form `org=...` and `project=...`). This avoids the API lookup entirely when the file exists. Treat as an optimization: try `.sentryclirc` first, fall back to API resolution.

**Recommendation:** Implement resolution priority:
1. `.sentryclirc` key-value pairs (`org=`, `project=`) — local file, no API call.
2. `GET /api/0/projects/` match by numeric project ID from DSN — one API call, cached 10 min.
3. Explicit `SENTRY_ORG_SLUG` + `SENTRY_PROJECT_SLUG` env vars — user-supplied escape hatch.

---

## Research Finding 2: Sentry "Recent Unresolved Issues" Endpoint

### Recommended Endpoint
[CITED: docs.sentry.io/api/events/list-an-organizations-issues/]

The per-project issues endpoint (`GET /api/0/projects/{org}/{project}/issues/`) is **deprecated**. Use the org-level replacement:

```
GET https://sentry.io/api/0/organizations/{org_slug}/issues/
```

**Authorization:** `Authorization: Bearer <SENTRY_AUTH_TOKEN>`
**Required scope:** `event:read`

**Query parameters for top-5 recent unresolved:**
```
?query=is:unresolved
&sort=date
&limit=5
&project=<numeric_project_id>
```

The `project` param (accepts the numeric project ID) scopes the result to a single project. `sort=date` means most-recently-seen first. `limit` accepts up to 100.

**Response fields per issue (confirmed):**
- `id` — internal Sentry issue ID
- `title` — issue title
- `level` — `"error"` / `"warning"` / `"info"` / `"fatal"`
- `count` — event count (string in API response, cast to number for display)
- `lastSeen` — ISO 8601 timestamp
- `permalink` — full Sentry web URL (use for D-08-04 link-out)
- `shortId` — human-readable short ID (e.g. `PROJECT-123`)

**Rate limits:**
[CITED: docs.sentry.io/api/ratelimits/]

Sentry uses a fixed-window approach. Response headers: `X-Sentry-Rate-Limit-Limit`, `X-Sentry-Rate-Limit-Remaining`, `X-Sentry-Rate-Limit-Reset`. Rate-limited responses return **429** (standard) and include `Retry-After`. The documentation does not publish a specific req/hour ceiling. With a 60s cache the daemon makes at most 1 call/minute/project — well within any reasonable limit. No retry is needed per D-08-08.

---

## Research Finding 3: Linear GraphQL Issue Query (LINEAR-01)

### Endpoint and Authentication
[CITED: linear.app/developers/graphql]
[CITED: linear.app/developers/rate-limiting]

**Endpoint:** `POST https://api.linear.app/graphql`
**Content-Type:** `application/json`
**Authorization:** Raw API key, no `Bearer` prefix:
```
Authorization: lin_api_xxxxxxxxxxxxxxxxxxxxxxxxx
```

> NOTE: Personal API keys (`lin_api_...`) do NOT use `Bearer`. OAuth access tokens DO use `Bearer <ACCESS_TOKEN>`. Since `LINEAR_API_KEY` is the env var name and the spec shows `lin_api_...`, the format is raw key without `Bearer`. [CITED: linear.app/developers/graphql]

### Issue by Human-Readable Identifier
[CITED: linear.app/developers/graphql — confirmed `issue(id: "BLA-123")` accepts human-readable shorthand]

The `issue(id:)` field accepts **either** the UUID **or** the human-readable identifier (e.g. `ACME-123`, `BLA-456`). No pre-resolution step needed.

**Exact query:**
```graphql
query GetIssue($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    url
    state {
      name
      type
    }
    assignee {
      name
    }
  }
}
```

**Variables:** `{ "id": "ACME-123" }`

**Request body:**
```json
{
  "query": "query GetIssue($id: String!) { issue(id: $id) { id identifier title url state { name type } assignee { name } } }",
  "variables": { "id": "ACME-123" }
}
```

**Response fields:**
- `data.issue.id` — internal UUID (not needed in SPA response; omit from wire schema)
- `data.issue.identifier` — human-readable ID (e.g. `ACME-123`)
- `data.issue.title` — issue title
- `data.issue.url` — full Linear web URL (for link-out)
- `data.issue.state.name` — state label (e.g. `"In Progress"`, `"Done"`)
- `data.issue.state.type` — state type (`started`, `completed`, `cancelled`, `backlog`, `unstarted`)
- `data.issue.assignee.name` — assignee display name, or `null` if unassigned

**When issue not found:** `data.issue` is `null`; `data.errors` may be present.

**Rate limits:**
- 5,000 requests/hour per API key user
- Rate-limited: HTTP **400** with `errors[0].extensions.code === "RATELIMITED"` (note: NOT 429)
- Response headers: `X-RateLimit-Requests-Remaining`, `X-RateLimit-Requests-Reset`

The 60s cache means at most ~60 req/hour per issue ID. For 3 issues = ~180 req/hour total — well within 5,000.

---

## Research Finding 4: Linear Branch+Commit Issue ID Detection (LINEAR-02)

The existing `integrations.ts` runs `runAllowedGit('branch', root)` and tests with `/[A-Z]{2,}-\d+/`. The new Linear panel needs to detect issue IDs from **both** branch name **and** recent commit messages.

`GIT_ALLOWED_CMDS` in `constants.ts` already includes `'log'`. Pattern:
```typescript
// branch name — already done in integrations.ts
const branchOut = await runAllowedGit('branch', root)  // shows current branch with '*'

// recent commits — new
const logOut = await runAllowedGit('log', root)  // returns recent git log
// extract matches: [...logOut.stdout.matchAll(/[A-Z]{2,}-\d+/g)]
```

`runAllowedGit('log', root)` returns the last N lines of git log (check the implementation for default format). For issue detection, extract all `[A-Z]{2,}-\d+` matches from both outputs, deduplicate, and cap at 3.

---

## Research Finding 5: Outbound HTTP with Node Built-in Fetch (INV-02, D-08-08/09)

[VERIFIED: Node.js docs — fetch + AbortController are stable globals since Node 18; confirmed Node 22 in this project]

Node 22's built-in `fetch` is globally available. No import needed. `AbortController` is also a global.

**~5s timeout + last-good-value control flow:**

```typescript
interface CacheEntry<T> {
  value: T
  cachedAtMs: number
  lastGood?: { value: T; cachedAtMs: number }  // D-08-09: persists across refresh failures
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5_000): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Control flow for a cached route:
const now = Date.now()
const cached = cache.get(projectId)

if (cached && now - cached.cachedAtMs < TTL_MS) {
  return outbound(c, Schema.parse.bind(Schema), cached.value)
}

try {
  const res = await fetchWithTimeout(url, headers)
  const newValue = await parseResponse(res)           // may throw on non-2xx
  const entry = { value: newValue, cachedAtMs: now, lastGood: { value: newValue, cachedAtMs: now } }
  cache.set(projectId, entry)
  return outbound(c, Schema.parse.bind(Schema), newValue)
} catch (err) {
  const prev = cache.get(projectId)
  if (prev?.lastGood) {
    // D-08-09: serve stale good value with timestamp label
    return outbound(c, Schema.parse.bind(Schema), {
      ...prev.lastGood.value,
      staleFrom: new Date(prev.lastGood.cachedAtMs).toISOString(),
      staleReason: classifyError(err),   // D-08-11 sanitized category
    })
  }
  // No last-good: return 404 (unconfigured / never-succeeded state)
  return c.json({ ok: false, error: 'unreachable', requestId: c.get('requestId') }, 404)
}
```

**Key design notes:**
- `AbortController` abort causes `fetch` to throw `DOMException` with `name === 'AbortError'` — classify as `unreachable`.
- The `lastGood` field is a nested sub-entry retained even when the TTL has expired — this is the D-08-09 "beyond TTL" retention.
- Both Sentry and Linear routes should extract this helper into a shared `lib/outboundFetch.ts` file to avoid duplication.

---

## Research Finding 6: Error Sanitization Categories (D-08-11)

The mapping from upstream HTTP status/error → the three fixed categories:

| Upstream condition | SPA-facing category | Rationale |
|-------------------|---------------------|-----------|
| `AbortError` (timeout) | `unreachable` | Network/timeout — service not reached |
| `TypeError: fetch failed` (DNS, connection refused) | `unreachable` | Network failure |
| HTTP 401 | `unauthorized` | Token rejected |
| HTTP 403 | `unauthorized` | Token lacks scope |
| HTTP 429 | `rate-limited` | Rate limit hit (Sentry standard code) |
| Linear GraphQL 400 + `RATELIMITED` extensions code | `rate-limited` | Linear's non-standard rate signal |
| HTTP 404 | `unreachable` | Project/org not found (misconfigured slug) |
| HTTP 5xx | `unreachable` | Service down |
| Any other non-2xx | `unreachable` | Catch-all |

**Implementation note on Linear rate limits:** Linear returns HTTP 400 for rate limits, not 429. The `classifyError` function must inspect the response body's `errors[0].extensions.code` when status is 400 — if `RATELIMITED`, return `rate-limited`, else `unreachable`.

**Logging rule:** Log `agentError(...)` with the raw status + body at daemon level. Never propagate raw body, token values, or project file paths to the SPA response. Tokens are already in memory and `process.env` — the concern is outbound leak via JSON responses.

---

## Research Finding 7: env.json Boot Plumbing (D-08-12/15)

### Precedent: auth.ts + constants.ts
[VERIFIED: codebase — packages/agent/src/lib/auth.ts, packages/agent/src/constants.ts]

The auth.json model provides an exact template:
- `ensureAuthFile` creates `CONFIG_DIR` at mode `0700`, file at mode `0600`.
- `assertSecurePermissions` uses `lstatSync` (not `statSync`) to reject symlinks.
- `atomicWriteFile` (tmp+rename) prevents partial-write exposure.
- `writeAuthFile` calls `AuthFileSchema.parse(data)` before writing — always validates before persisting.

### New constants (add to `constants.ts`):
```typescript
export const ENV_FILE = join(CONFIG_DIR, 'env.json')
```

### env.json schema (new in `packages/shared/src/schemas/env.ts`):
```typescript
export const ALLOWED_ENV_KEYS = ['SENTRY_AUTH_TOKEN', 'LINEAR_API_KEY', 'INFISICAL_TOKEN'] as const
export const AllowedEnvKeySchema = z.enum(ALLOWED_ENV_KEYS)
export const EnvFileSchema = z.object({
  version: z.literal(1),
  vars: z.record(AllowedEnvKeySchema, z.string()),
})
export type EnvFile = z.infer<typeof EnvFileSchema>
```

### Boot insertion point
[VERIFIED: codebase — packages/agent/src/cli/start.ts]

`runStart()` in `packages/agent/src/cli/start.ts` is the correct insertion point. It already calls `ensureRegistryFile()`, `ensureAuthFile()`, `ensureViewerSecretFile()` before `bootDaemon()`. Add `loadEnvFile()` call here, after `ensureAuthFile()` and before `createApp()`:

```typescript
// New: load env.json, merge under process.env (D-08-12/15)
loadEnvFile()  // reads ~/.agenticapps/dashboard/env.json; fills only unset keys
```

### `loadEnvFile()` implementation (new `lib/envFile.ts`):

```typescript
export function loadEnvFile(filePath: string = ENV_FILE): void {
  if (!existsSync(filePath)) return  // env.json is optional
  assertSecurePermissions(filePath)  // reuse auth.ts's check
  const raw = readFileSync(filePath, 'utf8')
  const data = parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')
  for (const [key, value] of Object.entries(data.vars)) {
    if (!(key in process.env)) {    // D-08-12: process.env wins
      process.env[key] = value
    }
  }
}
```

**Why `process.env` wins:** `infisical run` injects values into `process.env` before the Node process reads env.json. Since `loadEnvFile()` only fills keys that are `undefined` in `process.env`, `infisical run`-injected values are never overridden. This is the zero-code-change INFI-01 guarantee.

### `env set` CLI subcommand (new `cli/envCmd.ts`):

```typescript
// agentic-dashboard env set SENTRY_AUTH_TOKEN sntrys_xxx
// agentic-dashboard env list
// agentic-dashboard env unset SENTRY_AUTH_TOKEN
```

The command calls `writeEnvFile()` which mirrors `writeAuthFile()`:
1. Validates the key against `AllowedEnvKeySchema` — unknown keys are rejected with a clear error.
2. Reads existing `env.json` (if present), merges the new key-value pair.
3. Calls `atomicWriteFile(ENV_FILE, JSON.stringify(validated, null, 2), 0o600)`.
4. Prints "Restart the daemon to apply: `agentic-dashboard restart`".

**`env list` output format (D-08-14):**
```
SENTRY_AUTH_TOKEN   set (env.json)  sntr****
LINEAR_API_KEY      unset           —
INFISICAL_TOKEN     unset           —
```
Shows: key name, set/unset, source (`env.json` vs `process.env`), masked last-4 only if set.

---

## Research Finding 8: .infisical.json Scope Reflection (INFI-03)

[VERIFIED: codebase — packages/agent/src/lib/projectMetadataScan.ts:308-355]

`parseInfisicalConfig()` already reads `.infisical.json` and returns a `SecretsResponse` discriminated union with:
- `state: 'present-valid'` includes `workspaceId: string` and `defaultEnvironment?: string`
- `state: 'present-invalid'` includes `reason: string`
- `state: 'absent'`

The `workspaceId` and `defaultEnvironment` fields are already parsed. For INFI-03 "scope" reflection:

**No new parsing needed.** The `IntegrationsHealth` component extension should:
1. Call the existing `GET /api/projects/{id}/secrets` endpoint (already returns `SecretsResponse`).
2. When `state === 'present-valid'`, display `workspaceId` as the scope identifier and `defaultEnvironment` if set.
3. The `IntegrationsResponseSchema` extension for INFI-03 is minimal: the existing `secrets` route already carries this data. The planner may choose to either re-use that route or extend the `integrations` response. Recommendation: reuse the existing `secrets` route — no duplication.

**Safe fields to show (no privileged calls):**
- `workspaceId` — identifies the Infisical project (not a secret; it's a project ID)
- `defaultEnvironment` — e.g. `"dev"`, `"prod"` (not a secret)

**T-05-05-NoSecretRead-SPA:** The SPA's `SecretsHealth` panel already has `state` only from `query.data`. Phase 5 decision records that `workspaceId` and `defaultEnvironment` are never extracted or rendered in the current `SecretsHealth`. INFI-03 allows rendering these two fields **because they are not secrets** — they are configuration metadata. The existing T-05-05 invariant referred specifically to avoiding secret-value reads. These fields are safe to render but should be clearly labeled as non-sensitive identifiers.

---

## Architecture Patterns

### System Architecture Diagram

```
SPA (browser)
  └── useSentryRecent(id) ──────────────────┐
  └── useLinearIssues(id) ──────────────────┤  TanStack Query
                                             ↓  apiFetch (Bearer)
Daemon (127.0.0.1:5193)
  ├── GET /api/projects/:id/sentry/recent ──┐
  │   ├── env-gate: SENTRY_AUTH_TOKEN?       │
  │   │   No → 404 "not_configured"          │
  │   │   Yes → check 60s cache              │
  │   │         hit → return cached          │
  │   │         miss → fetchWithTimeout(5s) → sentry.io/api/0
  │   │                  success → update cache + lastGood
  │   │                  fail    → lastGood? return stale : 404
  │   └── outbound(SentryRecentResponseSchema)
  │
  ├── GET /api/projects/:id/linear/issue/:issueId
  │   ├── env-gate: LINEAR_API_KEY?
  │   │   No → 404 "not_configured"
  │   │   Yes → check 60s cache (keyed projectId+issueId)
  │   │         hit → return cached
  │   │         miss → POST api.linear.app/graphql
  │   │                  success → update cache + lastGood
  │   │                  fail    → lastGood? return stale : 404
  │   └── outbound(LinearIssueResponseSchema)
  │
  ├── lib/outboundFetch.ts (shared helper)
  │   └── fetchWithTimeout + classifyError + lastGoodValue retention
  │
  └── boot: loadEnvFile() → merge env.json under process.env
            CLI: env set / env list / env unset
```

### Recommended Project Structure (new files only)

```
packages/agent/src/
├── lib/
│   ├── envFile.ts           # loadEnvFile, writeEnvFile, listEnvKeys
│   └── outboundFetch.ts     # fetchWithTimeout, classifyError, CacheEntry type
├── routes/
│   ├── sentry.ts            # GET /:id/sentry/recent
│   └── linear.ts            # GET /:id/linear/issue/:issueId
└── cli/
    └── envCmd.ts            # env set / env list / env unset subcommands

packages/shared/src/schemas/
├── sentry.ts                # SentryIssueSchema, SentryRecentResponseSchema
├── linear.ts                # LinearIssueSchema, LinearIssueResponseSchema
└── env.ts                   # EnvFileSchema, AllowedEnvKeySchema (daemon-only; not re-exported to SPA)

packages/spa/src/
├── components/panels/
│   ├── SentryPanel.tsx      # new standalone panel
│   └── LinearPanel.tsx      # new standalone panel
└── lib/
    └── projectQueries.ts    # add useSentryRecent, useLinearIssues hooks
```

### Pattern 1: Env-Gated Route with 60s Cache + Last-Good Fallback

**What:** Route returns 404 when env var is unset; uses a 60s TTL cache; on failure returns stale data with a fallback label; error categories sanitized.

**When to use:** Every new optional-integration route (Sentry, Linear).

```typescript
// Source: codebase pattern from integrations.ts + research Finding 5
const cache = new Map<string, CacheEntry<SentryRecentResponse>>()
const TTL_MS = 60_000

sentryRoute.get('/:id/sentry/recent', async (c) => {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return c.json({ ok: false, error: 'not_configured', requestId: c.get('requestId') }, 404)
  }

  const projectId = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) return c.json({ ok: false, error: 'project_not_found', requestId: c.get('requestId') }, 404)

  const now = Date.now()
  const cached = cache.get(projectId)
  if (cached && now - cached.cachedAtMs < TTL_MS) {
    return outbound(c, SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema), cached.value)
  }

  try {
    const data = await fetchSentryIssues(entry.root)
    const entry2 = { value: data, cachedAtMs: now, lastGood: { value: data, cachedAtMs: now } }
    cache.set(projectId, entry2)
    return outbound(c, SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema), data)
  } catch (err) {
    const prev = cache.get(projectId)
    if (prev?.lastGood) {
      const stale: SentryRecentResponse = {
        ...prev.lastGood.value,
        stale: true,
        staleFrom: new Date(prev.lastGood.cachedAtMs).toISOString(),
        staleReason: classifyError(err),
      }
      cache.set(projectId, { ...prev, value: stale })
      return outbound(c, SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema), stale)
    }
    return c.json({ ok: false, error: classifyError(err), requestId: c.get('requestId') }, 503)
  }
})
```

### Pattern 2: Shared Zod Schema (INV-04)

```typescript
// packages/shared/src/schemas/sentry.ts
import { z } from 'zod'

export const SentryIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.enum(['fatal', 'error', 'warning', 'info', 'debug']),
  count: z.string(),            // Sentry returns event count as string
  lastSeen: z.string(),         // ISO 8601
  permalink: z.string().url(),
  shortId: z.string(),
})
export type SentryIssue = z.infer<typeof SentryIssueSchema>

export const SentryRecentResponseSchema = z.object({
  issues: z.array(SentryIssueSchema).max(5),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),   // ISO 8601 — when last good data was fetched
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type SentryRecentResponse = z.infer<typeof SentryRecentResponseSchema>
```

```typescript
// packages/shared/src/schemas/linear.ts
import { z } from 'zod'

export const LinearIssueSchema = z.object({
  identifier: z.string(),       // e.g. "ACME-123"
  title: z.string(),
  url: z.string().url(),
  stateName: z.string(),        // from state.name
  stateType: z.enum(['started', 'completed', 'cancelled', 'backlog', 'unstarted']),
  assigneeName: z.string().nullable(),
  stale: z.boolean().default(false),
  staleFrom: z.string().optional(),
  staleReason: z.enum(['unreachable', 'unauthorized', 'rate-limited']).optional(),
})
export type LinearIssue = z.infer<typeof LinearIssueSchema>

export const LinearIssueResponseSchema = z.object({
  issue: LinearIssueSchema.nullable(),   // null = issue not found in Linear
})
export type LinearIssueResponse = z.infer<typeof LinearIssueResponseSchema>
```

### Anti-Patterns to Avoid

- **Forwarding raw upstream error bodies to the SPA:** A raw Sentry 401 body may contain account context. Always classify first.
- **Logging token values at any level:** Ensure `agentError` calls never interpolate `process.env.SENTRY_AUTH_TOKEN` or `process.env.LINEAR_API_KEY`.
- **Blocking the boot on env.json parse failure:** If `env.json` is corrupt, log a warning and skip the merge — the daemon must still start. Use `try/catch` around `loadEnvFile`.
- **Using `stat` instead of `lstat` for permission checks:** `assertSecurePermissions` already uses `lstatSync` — reuse it, don't re-implement.
- **Returning 404 for a stale-data scenario:** When last-good data exists, always serve it with stale metadata. Only return 404/503 when there is no prior successful fetch.
- **Caching Linear issues by issueId alone:** Cache must be keyed by `projectId + issueId` to avoid cross-project cache leakage (T-05-05-Cross-Project-Cache).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | Custom `fs.writeFile` | `atomicWriteFile` (existing `lib/atomicWrite.ts`) | Already covers tmp+rename, O_EXCL, O_NOFOLLOW, fsync |
| Permission enforcement | Custom `stat` check | `assertSecurePermissions` (existing `lib/auth.ts:67-88`) | Already covers lstat, symlink rejection, octal check, error message |
| HTTP timeout | `setTimeout` + manual cancel | `AbortController` + `clearTimeout` | Clean cancellation; `AbortError` is the signal |
| Schema validation before persist | Manual object check | `EnvFileSchema.parse(data)` via `parseOrCorrupt` | Consistent with auth.json pattern; surfaces corruption |
| Org/project slug resolution | Custom DNS or Sentry SDK | `GET /api/0/projects/` list-and-match | The SDK is a heavy dep; the list endpoint is a single fetch |

---

## Common Pitfalls

### Pitfall 1: Linear Rate-Limit Detection (400 not 429)
**What goes wrong:** Code checks `res.status === 429` for rate limits, misses Linear's rate limit signal entirely.
**Why it happens:** Linear returns HTTP **400** with `errors[0].extensions.code === "RATELIMITED"` — not 429. This is non-standard.
**How to avoid:** In `classifyError`, after checking status 401/403 for `unauthorized`, check status 400 and inspect the response body for the `RATELIMITED` code before defaulting to `unreachable`.
**Warning signs:** Linear returns errors but the daemon always reports `unreachable` rather than `rate-limited`.

### Pitfall 2: Sentry `count` Field is a String
**What goes wrong:** Rendering `issue.count` fails type checks because the schema typed it as `number`.
**Why it happens:** The Sentry issues API returns `count` as a JSON string (e.g. `"1423"`), not a number.
**How to avoid:** Type it as `z.string()` in `SentryIssueSchema`. Convert to `Number(count).toLocaleString()` in the SPA component, not in the schema.

### Pitfall 3: DSN Numeric ID String Comparison
**What goes wrong:** `project.id === dsnProjectId` always fails because one is a string and one was parsed as a number.
**Why it happens:** DSN's path segment is parsed as `parseInt`, but the Sentry API returns `id` as a string.
**How to avoid:** Compare as `project.id === String(numericProjectIdFromDsn)`.

### Pitfall 4: env.json Corrupt on Boot Crashes Daemon
**What goes wrong:** `loadEnvFile()` throws, preventing daemon from starting.
**Why it happens:** `parseOrCorrupt` throws `StateCorruptionError` on schema mismatch.
**How to avoid:** Wrap `loadEnvFile()` in a try/catch in `runStart()`. On parse failure, log `agentError('env.json corrupt — skipping env merge; run env set to reset')` and continue. The daemon must start regardless.

### Pitfall 5: Sentry Slug Resolution Call on Every Issues Request
**What goes wrong:** Every `/sentry/recent` poll (every 60s) makes a `GET /api/0/projects/` call in addition to the issues call, doubling API traffic.
**Why it happens:** Slug resolution is not cached separately from the issues cache.
**How to avoid:** Cache the resolved `{ orgSlug, projectSlug }` pair with a longer TTL (10 min) keyed by project root hash. Only re-resolve if the pair is absent or the longer TTL has expired.

### Pitfall 6: Linear Issue IDs from git log Include Noise
**What goes wrong:** `runAllowedGit('log', root)` default output includes merge commits with many issue references, inflating the detected list.
**Why it happens:** No depth limit on `git log` output.
**How to avoid:** Pass `--max-count=20` (or similar) to the git log command to bound the output. The existing `GIT_ALLOWED_CMDS` list includes `'log'` but the flag must be passed through `runAllowedGit`. Check whether the existing `runAllowedGit` implementation supports extra args or requires a new allowed variant.

### Pitfall 7: Cross-Project Linear Cache Leakage
**What goes wrong:** Issue ACME-123 from project A is served to project B's Linear panel.
**Why it happens:** Cache keyed by `issueId` alone.
**How to avoid:** Cache key must be `${projectId}:${issueId}`. This mirrors the `useIntegrations` / `useLocalSkills` cross-project isolation pattern (T-05-05-Cross-Project-Cache).

---

## Runtime State Inventory

This is a greenfield feature phase — no rename/refactor. Skip.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node built-in `fetch` | Sentry/Linear HTTP calls | ✓ | Node 22.22.3 (global) | — |
| Node built-in `AbortController` | 5s timeout | ✓ | Node 22.22.3 (global) | — |
| `sentry.io` API | SENTRY-01/02 | n/a (external) | — | graceful 503 + `unreachable` when offline |
| `api.linear.app` | LINEAR-01 | n/a (external) | — | graceful 503 + `unreachable` when offline |

**Missing dependencies with no fallback:** none — all are opt-in via env var; daemon starts and runs without any of them.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (packages/agent vitest.config.ts) |
| Config file | `packages/agent/vitest.config.ts` |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SENTRY-01 | Returns issues when token set | unit (mock fetch) | `pnpm --filter @agenticapps/dashboard-agent test` | ❌ Wave 0: `src/routes/sentry.test.ts` |
| SENTRY-02 | 60s cache hit skips fetch; stale fallback on failure | unit | same | ❌ Wave 0 |
| SENTRY-03 | 404 when SENTRY_AUTH_TOKEN unset | unit | same | ❌ Wave 0 |
| LINEAR-01 | Returns issue fields when key set | unit (mock fetch) | same | ❌ Wave 0: `src/routes/linear.test.ts` |
| LINEAR-02 | Issue IDs detected from branch + log | unit | same | ❌ Wave 0 |
| LINEAR-03 | 404 when LINEAR_API_KEY unset | unit | same | ❌ Wave 0 |
| INFI-01 | `process.env` var overrides env.json var | unit | same | ❌ Wave 0: `src/lib/envFile.test.ts` |
| INFI-02 | `env set` writes 0600 env.json | unit | same | ❌ Wave 0 |
| INFI-03 | IntegrationsHealth shows scope from .infisical.json | unit (existing `parseInfisicalConfig`) | same | ✅ (covered by `projectMetadataScan.test.ts`) |
| INV-05 | Token never appears in SPA response | unit (assert no token in outbound JSON) | same | ❌ Wave 0: in `sentry.test.ts` |
| D-08-11 | Error categories: abort→unreachable, 401→unauthorized, 429→rate-limited, Linear 400+RATELIMITED→rate-limited | unit | same | ❌ Wave 0: `src/lib/outboundFetch.test.ts` |
| D-08-12 | env.json fill-gap: process.env key present → not overwritten | unit | same | ❌ Wave 0 |
| D-08-09 | Stale fallback served beyond TTL when last-good exists | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/agent/src/routes/sentry.test.ts` — covers SENTRY-01..03, INV-05
- [ ] `packages/agent/src/routes/linear.test.ts` — covers LINEAR-01..03
- [ ] `packages/agent/src/lib/envFile.test.ts` — covers INFI-01, INFI-02, D-08-12
- [ ] `packages/agent/src/lib/outboundFetch.test.ts` — covers D-08-08, D-08-09, D-08-11
- [ ] `packages/shared/src/schemas/sentry.test.ts` — covers INV-04 Sentry schema
- [ ] `packages/shared/src/schemas/linear.test.ts` — covers INV-04 Linear schema

---

## Security Domain

### Applicable ASVS Categories (ASVS Level 1, security_block_on: high)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer token on daemon routes (existing middleware); env.json 0600 |
| V3 Session Management | no | Stateless HTTP; no sessions |
| V4 Access Control | yes | Tokens never sent to SPA (D-08-11/14); allow-list on env set (D-08-13) |
| V5 Input Validation | yes | Zod schema on all new wire shapes; `AllowedEnvKeySchema` for `env set` |
| V6 Cryptography | no | No new crypto — env.json is plaintext at 0600 (same as auth.json) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leakage via SPA error response | Information Disclosure | D-08-11 sanitization — always classify errors to fixed categories; never forward raw body |
| Token leakage via daemon logs | Information Disclosure | Never interpolate token value in `agentError()` calls |
| Path traversal via `projectId` to wrong project's data | Elevation of Privilege | Existing `readRegistry().find(p.id === projectId)` guard already in all project routes |
| SSRF via user-supplied Sentry/Linear URLs | Spoofing | Endpoints are hardcoded (`sentry.io`, `api.linear.app`) — no user-supplied URL accepted |
| env.json symlink swap | Tampering | `assertSecurePermissions` uses `lstatSync` to reject symlinks |
| env.json race window (read-modify-write) | Tampering | `atomicWriteFile` tmp+rename eliminates partial-write exposure |
| Cross-project cache poisoning | Elevation of Privilege | Cache keyed by `projectId + issueId`; mirrors T-05-05-Cross-Project-Cache pattern |
| Storing secrets beyond allowed list | Elevation of Privilege | `env set` allow-list (`AllowedEnvKeySchema`) rejects unknown keys with explicit error |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sentry per-project issues endpoint | Org-level issues endpoint with `?project=` filter | Sentry marked per-project endpoint deprecated | Use org endpoint; need org_slug not just project_slug |
| Linear UUID-only issue lookup | Human-readable identifier (`BLA-123`) directly in `issue(id:)` | Linear always supported it; developer docs confirm | No pre-resolution step needed |

**Deprecated/outdated:**
- `GET /api/0/projects/{org}/{project}/issues/`: deprecated by Sentry, superseded by `GET /api/0/organizations/{org}/issues/?project=<id>`. Use the org endpoint.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /api/0/projects/` (user-scoped list) returns `organization.slug` nested in each project object | Finding 1 | DSN→slug resolution falls back to explicit env vars; user must set `SENTRY_ORG_SLUG`/`SENTRY_PROJECT_SLUG` manually |
| A2 | Sentry API returns `count` as a JSON string not a number | Finding 2 | Minor: schema uses `z.string()` unnecessarily; cast would still work but may fail Zod parse if actually a number — make schema `z.union([z.string(), z.number()]).transform(String)` to be safe |
| A3 | Linear `issue(id: "BLA-123")` with human-readable shorthand works via the public GraphQL API | Finding 3 | Falls back to UUID: requires `issues(filter: { team: { key: { eq: "BLA" } }, number: { eq: 123 } })` query instead — more complex but documented |
| A4 | Linear returns HTTP 400 (not 429) for rate limits | Finding 3 | If 429 is used, `classifyError` misclassifies as `unreachable` instead of `rate-limited` — display difference only |
| A5 | Sentry org-level issues endpoint (`/api/0/organizations/{org}/issues/`) accepts `project=<numeric_id>` to filter by project | Finding 2 | Without this filter, the endpoint returns issues across ALL org projects — a data exposure issue; must verify this filter works |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
The above 5 items are MEDIUM-risk assumptions. A1 and A5 are the highest risk.

---

## Open Questions (RESOLVED)

1. **Does `runAllowedGit('log', root)` accept extra flags like `--max-count`?**
   - What we know: `GIT_ALLOWED_CMDS` includes `'log'`; the Pitfall 6 analysis shows unbounded log output is a risk.
   - What's unclear: Whether `runAllowedGit` passes extra arguments or only the command name.
   - Recommendation: Planner should read `packages/agent/src/lib/git.ts` and either add `--max-count=20` to the allowed log command or add a `log-brief` variant.
   - **Resolution:** Answered by 08-PATTERNS.md — `ARGV_BY_CMD` in `git.ts:14` already runs `['log', '--oneline', '-20']`, so log output is pre-bounded to 20 commits. No flag injection or new variant needed; Plan 08-05's `detectIssueIds` consumes the existing bounded output and dedups/caps to 3.

2. **Does `GET /api/0/projects/` return `organization.slug` in the response body, or must you parse the org from `organization.id`?**
   - What we know: The endpoint is confirmed; each project has `id`, `slug`, `name`. The organization field presence in the response is ASSUMED (A1).
   - What's unclear: Whether `organization` is a nested object or just `organizationId`.
   - Recommendation: Planner should add a task to validate the response shape against a live token OR implement the fallback (match by org slug from DSN hostname `oNNN.ingest.sentry.io` subdomain + `GET /api/0/organizations/{oNNN}/`) to cover both cases.
   - **Resolution:** Handled defensively by Plan 08-03's 3-tier slug resolution (`.sentryclirc` → API list match → explicit `SENTRY_ORG_SLUG`/`SENTRY_PROJECT_SLUG` env-var fallback). The explicit-env fallback makes the daemon correct even if A1 is wrong, so no live-token validation task gates the phase. A1 remains a documented MEDIUM-risk assumption verified by the SENTRY-01 manual-only check in 08-VALIDATION.md.

3. **Does `parseSentryClirc` need a minimal INI parser to extract `org=` and `project=` lines?**
   - What we know: Current `parseSentryClirc` is existence-only (no content parsing per Phase 5 RESEARCH decision).
   - What's unclear: Whether extending it to parse key=value lines is safe within current security constraints.
   - Recommendation: A minimal line-parser that accepts only `[header]` + `key = value` lines (no code execution, no includes) is safe. Limit to extracting `org` and `project` keys only from the `[defaults]` section.
   - **Resolution:** Confirmed approach — Plan 08-03 extends `parseSentryClirc` with a minimal `[defaults]`-section `key = value` line parser limited to `org` and `project` keys (no includes, no code execution), forming tier-1 of the slug resolution. This is the chosen path.

---

## Sources

### Primary (HIGH confidence)
- [docs.sentry.io/api/events/list-an-organizations-issues/](https://docs.sentry.io/api/events/list-an-organizations-issues/) — org-level issues endpoint, query params, response fields
- [docs.sentry.io/api/events/list-a-projects-issues/](https://docs.sentry.io/api/events/list-a-projects-issues/) — per-project issues endpoint (deprecated); confirms field names
- [docs.sentry.io/api/ratelimits/](https://docs.sentry.io/api/ratelimits/) — Sentry rate-limit headers
- [linear.app/developers/graphql](https://linear.app/developers/graphql) — Linear endpoint URL, auth header format, issue(id:) shorthand support
- [linear.app/developers/rate-limiting](https://linear.app/developers/rate-limiting) — Linear rate limits (5000/hr), HTTP 400 RATELIMITED, response headers
- Codebase: `packages/agent/src/lib/auth.ts`, `constants.ts`, `atomicWrite.ts`, `projectMetadataScan.ts`, `routes/integrations.ts`, `cli/start.ts`, `server/boot.ts`
- Codebase: `packages/shared/src/schemas/integrations.ts`, `secrets.ts`, `index.ts`
- Codebase: `packages/spa/src/components/panels/PanelContainer.tsx`, `lib/projectQueries.ts`, `lib/api.ts`

### Secondary (MEDIUM confidence)
- [docs.sentry.io/api/organizations/list-an-organizations-projects/](https://docs.sentry.io/api/organizations/list-an-organizations-projects/) — org-scoped project list; response schema (organization.slug presence is ASSUMED A1)
- [docs.sentry.io/concepts/key-terms/dsn-explainer/](https://docs.sentry.io/concepts/key-terms/dsn-explainer/) — DSN format confirmation
- WebSearch cross-verification: Linear raw key auth format (`Authorization: lin_api_...` without Bearer)

### Tertiary (LOW confidence)
- WebSearch result confirming `GET /api/0/projects/` (user-scoped) list behavior and org internal token limitation

---

## Metadata

**Confidence breakdown:**
- Sentry issues endpoint: HIGH — direct docs.sentry.io fetch
- Linear GraphQL: HIGH — direct linear.app/developers fetch + cross-verified by search
- Node fetch: HIGH — runtime built-in, confirmed Node 22 in project
- Sentry DSN→slug resolution: MEDIUM — endpoint confirmed, response schema for `organization.slug` ASSUMED (A1)
- env.json plumbing: HIGH — direct codebase inspection of auth.ts, constants.ts, start.ts precedent

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (30 days — Sentry/Linear APIs are stable; verify before planning if significantly delayed)
