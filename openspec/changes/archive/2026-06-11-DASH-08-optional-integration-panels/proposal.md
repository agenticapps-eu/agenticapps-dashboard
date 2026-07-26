# Phase 8: Optional Integration Panels -

**Archived from GSD phase `DASH-08-optional-integration-panels`. Completed 2026-06-11.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-08-optional-integration-panels/` — that tree, not this file, is the authoritative record.

## Why

Add read-only **Sentry** and **Linear** live-data panels plus the **Infisical-aware env plumbing** to the dashboard. Every integration is env-gated and degrades to a "configure to enable" empty state when its env vars are unset — the dashboard stays 100% functional without any of them.

**This phase delivers (HOW for the locked WHAT in REQUIREMENTS.md):**
- `GET /api/projects/{id}/sentry/recent` — env-gated, cached, returns recent errors (SENTRY-01..03)
- `GET /api/projects/{id}/linear/issue/{issueId}` — env-gated, cached, returns issue title/status/assignee (LINEAR-01..03)
- `agentic-dashboard env set` + `~/.agenticapps/dashboard/env.json` (mode `0600`) for non-Infisical users; `infisical run` awareness with no code change (INFI-01/02)
- Read-only Infisical **status reflection** (scope) folded into the existing IntegrationsHealth surface (INFI-03)
- SPA panels for Sentry + Linear with empty states + cached-data fallback
- Shared Zod schemas for every new wire shape (INV-04)

**This phase does NOT:**
- Rebuild integration *status detection* — `GET /api/projects/{id}/integrations` and the `IntegrationsHealth`/`ObservabilityHealth`/`SecretsHealth` panels already exist (Phase 5, D-5-19).
- Reimplement Sentry/Linear/Infisical — links out when configured; never a replacement.
- Build any secrets-management UI — secrets infra lives in `agenticapps-eu/secrets-platform`; the dashboard

## Capabilities affected

- `openspec/specs/optional-integrations/spec.md`

## What shipped

**08-01**

Three new schema files plus extensions to two existing files establish the interface-first contracts that Wave 2 libs, Wave 3 routes, and Wave 4 SPA panels build against.

**packages/shared/src/schemas/sentry.ts**
- `SentryIssueSchema`: id, title, level enum (fatal/error/warning/info/debug), count (string|number → string via transform), lastSeen, permalink (url), shortId
- `SentryRecentResponseSchema`: issues array capped at max(5), stale boolean (default false), optional staleFrom + staleReason enum

**packages/shared/src/schemas/linear.ts**
- `LinearIssueSchema`: identifier, title, url, stat

**08-02**

**packages/agent/src/lib/outboundFetch.ts**
- `fetchWithTimeout(url, init, timeoutMs=5000)`: Node 22 global `fetch` + `AbortController`; `clearTimeout` runs in `finally` whether fetch resolves or throws (mirrors `atomicWrite.ts` discipline). No retry (D-08-08).
- `classifyError(err, status?, body?)`: collapses every upstream condition to `'unreachable' | 'unauthorized' | 'rate-limited'`. Covers all 9 mapping rows including Linear's non-standard HTTP 400+`RATELIMITED` extensions code (Pitfall 1). Raw body never returned by the helper to SPA responses (INV-05).
- `CacheEntry<T>`: generic interfa

**08-03**

**packages/agent/src/routes/sentry.ts**

`sentryRoute = new Hono<Env>()` — single handler: `GET /:id/sentry/recent`

**Env gate (SENTRY-03):** Returns `404 not_configured` when `SENTRY_AUTH_TOKEN` is unset. Returns `404 project_not_found` when `:id` is not in the registry.

**Slug resolution (D-08-01 / Research Finding 1):**

Tier-1: minimal `.sentryclirc` INI parser — accepts `[header]` + `key = value` lines, extracts `org` and `project` from the `[defaults]` section only. No code execution, no includes. Zero API calls when file is present.

Tier-2: reads `SENTRY_DSN` from `process.env`, pars

**08-04**

**packages/agent/src/cli/envCmd.ts**
- `runEnvSet(key, value, filePath?)`: `AllowedEnvKeySchema.safeParse` rejects unknown keys with named allowed list; reads existing env.json (or seeds empty `{version:1,vars:{}}`); merges key; `writeEnvFile` at 0600; prints restart hint. Full value is NEVER logged (INV-05 / D-08-14).
- `runEnvUnset(key, filePath?)`: same allow-list guard; deletes key from vars; rewrites env.json at 0600.
- `runEnvList(filePath?)`: tabular padEnd output — key (25) | set/unset (6) | source: process.env/env.json/— (12) | masked last-4 (`****xxxx`) or `—`. Full values never prin

**08-05**

### packages/agent/src/routes/linear.ts

`linearRoute = new Hono<Env>()` — single handler: `GET /:id/linear/issues`

**Issue-ID detection (LINEAR-02 / D-08-05):**

`detectIssueIds(root)` reads the current branch name via `runAllowedGit('branch', root)` and recent commit messages via `runAllowedGit('log', root)` (20-commit cap already baked into `ARGV_BY_CMD`). Uses `/[A-Z]{2,}-\d+/g` (note `/g` flag for `matchAll` across multi-line log output — diverges from `integrations.ts`'s non-global regex). Branch IDs collected first, then log IDs. Deduped via a `Set` preserving insertion order. Capped a

**08-06**

### packages/spa/src/lib/projectQueries.ts (modified)

Added `useSentryRecent(id)` and `useLinearIssues(id)` modelled exactly on `useIntegrations`:

- `queryKey: ['sentry-recent', id] as const` / `['linear-issues', id] as const` — per-project keyed for cross-project cache safety (T-05-05-Cross-Project-Cache)
- `queryFn`: calls `apiFetch` against the shared schema; throws `new Error('schema_drift:' + drift.path)` on `!result.ok` (INV-04 at the browser boundary)
- `staleTime` / `refetchInterval` = `SKILLS_TTL_MS` (60_000) — matches the daemon's 60s cache TTL
- `refetchIntervalInBackground: false

## Gates recorded

- verification — `08-VERIFICATION.md`
- code review — `08-REVIEW.md`
- security audit — `08-SECURITY.md`
- design critique — `08-IMPECCABLE.md`
- validation — `08-VALIDATION.md`
