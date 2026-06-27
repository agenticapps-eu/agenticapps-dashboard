---
phase: DASH-08-optional-integration-panels
fixed_at: 2026-06-11T12:25:00Z
review_path: .planning/phases/DASH-08-optional-integration-panels/08-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-06-11T12:25:00Z
**Source review:** `.planning/phases/DASH-08-optional-integration-panels/08-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, WR-01, WR-02, WR-03, WR-04, WR-05 + IN-04 verification)
- Fixed: 6
- Skipped: 0

---

## Fixed Issues

### CR-01: `javascript:`/`data:` URLs rendered as live `href`

**Files modified:**
`packages/shared/src/schemas/sentry.ts`,
`packages/shared/src/schemas/linear.ts`,
`packages/spa/src/components/panels/SentryPanel.tsx`,
`packages/spa/src/components/panels/LinearPanel.tsx`,
`packages/shared/src/schemas/sentry.test.ts`,
`packages/shared/src/schemas/linear.test.ts`,
`packages/spa/src/components/panels/SentryPanel.test.tsx`,
`packages/spa/src/components/panels/LinearPanel.test.tsx`

**Commit:** `549774a`

**Applied fix:**
- Added `HttpUrl = z.string().url().refine((u: string) => /^https?:\/\//i.test(u))` in both shared schemas; `SentryIssueSchema.permalink` and `LinearIssueSchema.url` now reject `javascript:` and `data:` schemes at parse time — hostile schemes surface as schema-drift instead of live links.
- Added defense-in-depth render guards in both panels: if `!/^https?:/i.test(url)`, the identifier/shortId renders as a plain `<span>` rather than an `<a href>`.
- Added schema tests (CR-01 `javascript:` and `data:` rejection, https acceptance) in both shared test files.
- Added panel render-guard tests (CR-01 bypassed-schema scenario renders no live link) in both panel test files.

---

### WR-01: One out-of-enum Sentry `level` collapses entire panel to "unreachable"

**Files modified:**
`packages/agent/src/routes/sentry.ts`,
`packages/agent/src/routes/sentry.test.ts`

**Commit:** `45151da`

**Applied fix:**
Changed `raw.slice(0,5).map(...)` to `raw.slice(0,5).flatMap(...)` with pre-parse normalization: unknown `level` values are coerced to `'error'` (row kept); rows whose `permalink` fails the `https?://` check are dropped via `return []`. This prevents a single malformed issue from throwing through Zod into `classifyError`, which had been mislabeling data-shape failures as network outages.

Added WR-01a (unknown level coerced, row kept), WR-01b (non-http permalink row dropped, others returned), WR-01c (all bad permalinks → 200 empty issues, not 503) tests.

---

### WR-02: Stale Linear panel reports `staleReason: undefined`

**Files modified:**
`packages/agent/src/routes/linear.ts`,
`packages/agent/src/routes/linear.test.ts`

**Commit:** `e433f38`

**Applied fix:**
Introduced `resolvedStaleReason` computed as `overallStaleReason ?? issues.find(i => i.staleReason)?.staleReason` before assembling the response. When all issues fell back to `lastGood`, `overallStaleReason` was never assigned (only the no-last-good branch set it); the fix derives it from the stale issues' own `staleReason`.

Added WR-02 test: first request succeeds (populates lastGood), cache evicted, second request fails (network error), asserts top-level `staleReason` is defined and valid.

---

### WR-03: Stale slug cache persists false "unreachable" for up to 10 min on 404

**Files modified:**
`packages/agent/src/routes/sentry.ts`,
`packages/agent/src/routes/sentry.test.ts`

**Commit:** `7397ac0`

**Applied fix:**
Added `if (res.status === 404) slugCache.delete(projectId)` immediately before the throw in the non-2xx branch of the issues fetch. A 404 from the issues endpoint signals a stale/wrong slug; evicting the cache entry forces re-resolution on the next poll via the 3-tier mechanism. No schema changes required.

Added WR-03 test: first request triggers 404 on issues (slug cache evicted), second request re-calls `/api/0/projects/` for fresh slug resolution and returns 200 with valid issues.

---

### WR-04: `env list` masking reveals full value for secrets of length ≤ 8

**Files modified:**
`packages/agent/src/cli/envCmd.ts`,
`packages/agent/src/cli/envCmd.test.ts`

**Commit:** `049f520`

**Applied fix:**
Changed masking to `const tail = value.length > 8 ? value.slice(-4) : ''` for both `process.env` and `env.json` value paths. Values of 8 or fewer characters now show only `****`; longer values still show `****` + last 4 chars.

Added WR-04a test (8-char value shows `****` with no tail) and WR-04b boundary test (9-char value shows last 4 as expected).

---

### WR-05: Cache eviction functions never wired to unregister path

**Files modified:**
`packages/agent/src/cli/register.ts`,
`packages/agent/src/cli/cliLockTimeout.test.ts`

**Commit:** `5bfed97`

**WR-05 decision — ids ARE reusable:** Project ids are generated as `slugify(basename(root))` with a numeric suffix for uniqueness within the current registry. After `unregister`, the slug is freed; re-registering the same path regenerates the identical id. Stale Sentry/Linear/integrations cache entries from the previous registration would be served under the new registration. Cache eviction was wired (not just commented).

**Applied fix:**
In `runUnregister`, read the registry before `removeProject()` to resolve the project id (the caller may pass a path, not an id). After successful removal, call `evictSentryCacheProject`, `evictLinearCacheProject`, and `evictIntegrationsCacheProject` with the resolved id, guarded by `if (resolvedId)`.

Added WR-05a test (all three eviction functions called with resolved id on success) and WR-05b test (eviction not called when `removeProject` returns false).

---

## IN-04 Verification

**Finding:** Both panels' "Learn more" links point to `href="/help"` — verified against `packages/spa/src/router.tsx`.

**Outcome:** `/help` exists. `helpLayoutRoute` is registered at `path: '/help'` with `HelpLayout` as its component; child routes are built via `buildHelpRoutes`. The links are valid. No change needed.

---

_Fixed: 2026-06-11T12:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
