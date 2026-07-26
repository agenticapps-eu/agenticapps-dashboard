---
phase: DASH-08-optional-integration-panels
reviewed: 2026-06-11T12:01:38Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/shared/src/schemas/sentry.ts
  - packages/shared/src/schemas/linear.ts
  - packages/shared/src/schemas/env.ts
  - packages/shared/src/schemas/integrations.ts
  - packages/shared/src/daemon.ts
  - packages/shared/src/index.ts
  - packages/agent/src/lib/outboundFetch.ts
  - packages/agent/src/lib/envFile.ts
  - packages/agent/src/lib/auth.ts
  - packages/agent/src/constants.ts
  - packages/agent/src/routes/sentry.ts
  - packages/agent/src/routes/linear.ts
  - packages/agent/src/routes/integrations.ts
  - packages/agent/src/cli/envCmd.ts
  - packages/agent/src/cli/start.ts
  - packages/agent/src/cli.ts
  - packages/agent/src/server/app.ts
  - packages/spa/src/lib/projectQueries.ts
  - packages/spa/src/components/panels/SentryPanel.tsx
  - packages/spa/src/components/panels/LinearPanel.tsx
  - packages/spa/src/components/SingleProjectView.tsx
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: fixed
fixed_at: 2026-06-11T12:25:00Z
fix_report: .planning/phases/DASH-08-optional-integration-panels/08-REVIEW-FIX.md
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-11T12:01:38Z
**Depth:** standard
**Files Reviewed:** 18 source files
**Status:** issues-found

## Summary

Phase 08 introduces the dashboard's first outbound HTTP (Sentry + Linear panels) and its
first on-disk secrets store (`env.json`). I reviewed every changed source file against the
project's hard constraints and the phase's stated security invariants (INV-05 token safety,
allow-list, 0600 confinement, no native deps, SSRF surface, bearer-auth inheritance).

**Constraint compliance — verified GOOD:**

- **Bearer-auth inheritance** — `sentryRoute` and `linearRoute` are mounted at `app.ts:194-195`,
  *after* the `bearerAuth` middleware at `app.ts:163`. Both inherit auth. CORS precedes auth correctly.
- **No native deps** — `outboundFetch.ts` uses global `fetch` + `AbortController` only; no imports.
- **SSRF** — Sentry host hardcoded `https://sentry.io/api/0` (`sentry.ts:65`), Linear host hardcoded
  `https://api.linear.app/graphql` (`linear.ts:52`). No user-controlled hosts. DSN is parsed only for a
  numeric project id, never used as a fetch target.
- **0600 confinement** — `envFile.ts` mirrors `auth.ts`: `assertSecurePermissions` (lstat symlink
  reject + 0600 check) before every read, `atomicWriteFile(..., 0o600)` (O_EXCL|O_NOFOLLOW) on write,
  `ensureConfigDir` at 0700. Tests cover symlink rejection and mode 0644 rejection.
- **Allow-list** — `ALLOWED_ENV_KEYS` enforced via `AllowedEnvKeySchema` at both schema parse
  (`envFile.ts`) and CLI entry (`envCmd.ts:39,81`). `EnvFileSchema` is correctly NOT re-exported from
  `index.ts` (kept daemon-only via `daemon.ts` subpath) — no browser surface for the secrets shape.
- **process.env wins** — `loadEnvFile` only sets a key when `!(key in process.env)` (`envFile.ts:51`).
- **Token never serialized** — no route puts `SENTRY_AUTH_TOKEN` / `LINEAR_API_KEY` in any response
  body; error logs print `status` + `category` only, never token or raw upstream body.
- **Optional integrations** — both routes return `404 not_configured` when the env var is unset and
  do not crash; panels render static "configure to enable" copy from JSX literals.

The defects below are correctness/robustness issues plus one DOM-injection vector in the panels.

## Critical Issues

### CR-01: `javascript:` / `data:` URLs from upstream are rendered as live `href` (stored-XSS-class)

**File:** `packages/spa/src/components/panels/SentryPanel.tsx:122` and
`packages/spa/src/components/panels/LinearPanel.tsx:116`
(root cause in `packages/shared/src/schemas/sentry.ts:15` and `packages/shared/src/schemas/linear.ts:11`)

**Issue:** Both panels render `<a href={issue.permalink}>` / `<a href={issue.url}>` directly from
upstream-supplied data. The shared schemas validate these with `z.string().url()`, which I confirmed
accepts `javascript:alert(1)` and `data:text/html,...` schemes (zod's `.url()` delegates to the `URL`
constructor, which permits any valid scheme). React does **not** sanitize `href` — a `javascript:` URL
on an anchor executes on click. The data originates from the Sentry/Linear API responses (Sentry's
`permalink`, Linear's `url`), which the daemon copies through verbatim (`sentry.ts:385`,
`linear.ts:197`) without scheme validation. A compromised or spoofed upstream response (or a
GraphQL/issues field an attacker can influence) becomes a clickable script-execution vector in the
operator's browser. This is exactly the class INV-05 / T-08-25 ("React auto-escapes") was meant to
cover — but auto-escaping protects text nodes, not `href` attribute schemes.

**Fix:** Constrain the schema to http(s) only, so a hostile scheme surfaces as schema-drift instead of
a live link. In `sentry.ts` / `linear.ts` schemas:

```ts
const HttpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: 'must be http(s)' })
// permalink: HttpUrl   (sentry)
// url: HttpUrl         (linear)
```

Optionally also guard at render time (`if (!/^https?:/i.test(issue.url)) render as plain text`) for
defense-in-depth. Add a test feeding a `javascript:` permalink/url and assert drift (or a non-link).

## Warnings

### WR-01: One out-of-enum Sentry `level` (or empty `permalink`) collapses the entire panel to "unreachable"

**File:** `packages/agent/src/routes/sentry.ts:377-402`

**Issue:** The issue mapper casts `level: (i['level'] as SentryIssue['level']) ?? 'error'` (line 382)
without validating against the enum, and sets `permalink: String(i['permalink'] ?? '')` (line 385),
which yields `''` when absent. The `SentryRecentResponseSchema.parse(...)` call inside `outbound()`
(line 398) is still **inside the try block** (try spans 353-403). If Sentry returns any `level` value
outside `fatal|error|warning|info|debug` (e.g. `sample`), or a missing/empty permalink, the Zod parse
throws → caught by the `catch` at line 403 → `classifyError(zodError)` returns `'unreachable'`. A
single malformed issue therefore presents the whole panel as a Sentry outage rather than rendering the
other valid issues. This is a correctness/robustness defect: a data-shape problem is mislabeled as a
network problem, and the user loses all visibility.

**Fix:** Validate/normalize each issue defensively before assembling the array, and drop (or coerce)
issues that don't match instead of throwing:

```ts
const VALID_LEVELS = new Set(['fatal','error','warning','info','debug'])
const issues = raw.slice(0, 5).flatMap((item) => {
  const i = item as Record<string, unknown>
  const level = VALID_LEVELS.has(String(i['level'])) ? String(i['level']) : 'error'
  const permalink = String(i['permalink'] ?? '')
  if (!/^https?:\/\//i.test(permalink)) return []   // skip unrenderable rows
  return [{ id: String(i['id'] ?? ''), title: String(i['title'] ?? ''),
            level, count: String(i['count'] ?? '0'),
            lastSeen: String(i['lastSeen'] ?? ''), permalink,
            shortId: String(i['shortId'] ?? '') }]
})
```

### WR-02: Stale Linear panel reports `staleReason: undefined` when every issue falls back to last-good

**File:** `packages/agent/src/routes/linear.ts:290-322`

**Issue:** `overallStaleReason` is only assigned in the `else` branch at line 303 (the no-last-good
path). When a fetch fails but a `lastGood` value exists (line 292), the code pushes a `staleIssue`
(carrying its own `staleReason`) but never sets `overallStaleReason`. If *all* detected issues fail
and each has last-good, then at line 317 `allStale === true` while `overallStaleReason === undefined`,
so the assembled response (line 322) sets `staleReason: undefined` despite the whole panel being stale.
The SPA's stale banner ("Linear API unreachable — using cached data…") still shows (it keys on
`data.stale` + `data.staleFrom`), but the machine-readable reason is lost, and the top-level
`staleReason` contract is silently violated.

**Fix:** Derive the overall reason from the stale issues rather than only from the no-last-good branch:

```ts
const staleReason = allStale
  ? (issues.find((i) => i.staleReason)?.staleReason ?? overallStaleReason)
  : undefined
```

Or assign `overallStaleReason = category` in the last-good branch too (line 292-300).

### WR-03: `classifyError` maps 404 and 5xx to `unreachable`, so a real auth failure behind a 5xx is mislabeled — but a deeper issue is non-2xx bodies are never surfaced for partial outages

**File:** `packages/agent/src/lib/outboundFetch.ts:101-116`; consumed at `sentry.ts:358-370`

**Issue:** `classifyError` only checks `401/403` → unauthorized and `429`/Linear-400-RATELIMITED →
rate-limited; **everything else** (404, 400 non-RATELIMITED, 500, 502, 503) → `unreachable`. A 404 from
Sentry's issues endpoint (e.g. wrong org/project slug resolved from a stale `.sentryclirc`) is reported
to the operator as "Sentry API unreachable", which is misleading and will send them debugging the wrong
thing (network vs. misconfiguration). Since slugs are cached 10 min (`SLUG_TTL_MS`), a stale/wrong slug
produces a persistent false "unreachable" for up to 10 minutes with no eviction on 404.

**Fix:** Add a distinct category (e.g. `'not-found'` or `'misconfigured'`) for 404, or at minimum evict
the `slugCache` entry on a 404 from the issues endpoint so the next poll re-resolves slugs:

```ts
if (status === 404) slugCache.delete(projectId)
```

(This also requires widening the `staleReason` enum in the shared schemas if you surface it; otherwise
the slug-cache eviction alone is a safe, schema-compatible improvement.)

### WR-04: `env list` masking reveals the full value for secrets of length ≤ 4

**File:** `packages/agent/src/cli/envCmd.ts:133-138`

**Issue:** Masking is `'****' + value.slice(-4)`. For any stored value of length ≤ 4 (e.g. a
mistakenly-set short token, or a placeholder), `slice(-4)` returns the entire value, so `env list`
prints the full secret. While allow-listed keys normally hold long tokens, the redaction guarantee
("full token values are NEVER printed") is violated for the short-value edge case — and the CLI is the
one surface explicitly documented to never print full values (D-08-14).

**Fix:** Only reveal a tail when the value is long enough to keep most of it hidden:

```ts
const tail = value.length > 8 ? value.slice(-4) : ''
masked = '****' + tail
```

### WR-05: `evictSentryCacheProject` / `evictLinearCacheProject` / `evictIntegrationsCacheProject` are exported but never wired to unregister — caches leak across re-registration

**File:** `packages/agent/src/routes/sentry.ts:443-446`, `packages/agent/src/routes/linear.ts:340-346`,
`packages/agent/src/routes/integrations.ts:112-114`

**Issue:** All three eviction functions carry comments "call on project unregister — wired in a
follow-up plan", but I found no caller in the unregister path (`cli/register.js` `runUnregister`). The
module-level `Map` caches are keyed by `projectId`. Project ids are generated per registration; if an
id is ever reused (or in long-lived daemons across register/unregister churn) a stale cached
Sentry/Linear payload — including a `lastGood` value that could belong to a previously-registered
project at the same root — can be served. Combined with the 10-min slug cache, this is a cross-project
data-staleness vector, not just a memory concern (memory growth is out of v1 scope, but serving one
project's cached issues under a different registration is a correctness/isolation concern the eviction
functions were written to prevent).

**Fix:** Wire all three (plus any future panel caches) into `runUnregister` so they fire when a project
is removed, or confirm the follow-up plan id and track it. If ids are guaranteed never to be reused,
document that guarantee at the cache declaration and downgrade; otherwise this should be wired before
shipping the panels.

## Info

### IN-01: `fetchWithTimeout` documents "do not pass signal in init" but silently overwrites it

**File:** `packages/agent/src/lib/outboundFetch.ts:51-63`

**Issue:** `fetch(url, { ...init, signal: ac.signal })` spreads `init` first then overrides `signal`, so
a caller-supplied `signal` is silently dropped. The JSDoc says not to pass one, but nothing enforces it.
Low risk (both internal callers comply), but a future caller expecting their own abort signal to compose
will be surprised.

**Fix:** Either `Omit<RequestInit, 'signal'>` on the `init` parameter type, or combine signals.

### IN-02: `parseDsnProjectId` uses `parseInt` which accepts trailing garbage

**File:** `packages/agent/src/routes/sentry.ts:130-139`

**Issue:** `parseInt('123abc', 10)` returns `123`. A malformed DSN path segment like `123-foo` parses to
`123`. Harmless here (the numeric id is only used to string-match against `/projects/` results, and a
wrong id simply fails to match → null), but it's a latent surprise.

**Fix:** Use a strict check: `/^\d+$/.test(segment) ? Number(segment) : null`.

### IN-03: `count` transform can yield the string `"NaN"`, rendered as `"NaN events"`

**File:** `packages/shared/src/schemas/sentry.ts:13` → `packages/spa/src/components/panels/SentryPanel.tsx:119`

**Issue:** `count: z.union([z.string(), z.number()]).transform(String)` accepts any string. The panel
renders `Number(issue.count).toLocaleString()`; if `count` is a non-numeric string the result is
`"NaN"`. The route coerces with `String(i['count'] ?? '0')` so the common case is fine, but a
non-numeric upstream `count` would surface as `NaN events`.

**Fix:** In the panel, guard: `const n = Number(issue.count); {Number.isFinite(n) ? n.toLocaleString() : '—'}`.

### IN-04: Both panels' "Learn more" links point to a likely-nonexistent `/help` route

**File:** `packages/spa/src/components/panels/SentryPanel.tsx:93`,
`packages/spa/src/components/panels/LinearPanel.tsx:92`

**Issue:** The not-configured empty state links to `href="/help"`. I did not find a `/help` route in the
SPA router. If absent, this is a dead link in the primary onboarding copy.

**Fix:** Confirm `/help` exists or point to the real docs URL / remove the link.

---

_Reviewed: 2026-06-11T12:01:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
