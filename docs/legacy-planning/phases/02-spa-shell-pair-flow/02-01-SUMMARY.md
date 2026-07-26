---
phase: 02-spa-shell-pair-flow
plan: 01
subsystem: spa-foundation
tags: [catalog, schemas, csp, tailwind, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - "@tanstack/react-router catalog entry (Plans 02-02, 02-03, 02-04 consume)"
    - "PairingSchema + AgentUrlSchema + AGENT_URL_REGEX (Plans 02-02, 02-03 consume)"
    - "Cloudflare Pages _redirects + _headers (Plan 02-06 smoke-tests CSP)"
    - "global.css UI-SPEC tokens (Plans 02-02..02-06 reference design tokens)"
    - "5 RED stub test files (Plans 02-02, 02-03, 02-06 turn them GREEN)"
  affects:
    - packages/shared (new schema exports)
    - packages/spa (new public/ assets, new test stubs, expanded global.css)
    - pnpm-workspace.yaml (catalog expansion)
tech_stack:
  added:
    - "@tanstack/react-router ^1.169.1 (catalog + spa dependency)"
    - "@tanstack/zod-adapter ^1.166.9 (catalog + spa devDependency; latest release — zod v4 compat pending upstream)"
    - "@testing-library/user-event ^14.5.2 (catalog + spa devDependency)"
  patterns:
    - "Tailwind v4 @custom-variant dark (class-based dark mode, D-02)"
    - "CSS custom properties in :root + .dark for dual-theme tokens"
    - "Zod schema single source of truth: SPA imports TokenSchema from shared/auth"
    - "Wave-0 Nyquist contract: describe.todo + MISSING marker in RED stubs"
key_files:
  created:
    - packages/shared/src/schemas/pairing.ts
    - packages/shared/src/schemas/pairing.test.ts
    - packages/spa/public/_redirects
    - packages/spa/public/_headers
    - packages/spa/src/lib/pairing.test.ts
    - packages/spa/src/lib/theme.test.ts
    - packages/spa/src/lib/api.test.ts
    - packages/spa/src/__tests__/dev-perf-smoke.test.ts
  modified:
    - pnpm-workspace.yaml
    - packages/spa/package.json
    - packages/shared/src/index.ts
    - packages/spa/src/styles/global.css
    - pnpm-lock.yaml
decisions:
  - "Used @tanstack/zod-adapter ^1.166.9 instead of ^1.169.1 (latest available; zod v4 peer warning noted, actual usage deferred to Plan 02-02)"
  - "describe.todo stubs chosen over it.fails() per 02-RESEARCH.md §Validation (intentional Wave-0 contract)"
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 8
  files_modified: 5
  commits: 4
---

# Phase 02 Plan 01: SPA Wave-0 Foundation Summary

**One-liner:** Catalog expanded with TanStack Router + zod-adapter + user-event; PairingSchema + AgentUrlSchema shipped as single source of truth; strict CSP _headers + SPA fallback _redirects deployed; global.css loaded with full UI-SPEC token set; 4 RED stub test files planted with MISSING markers for Nyquist gate.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add SPA Phase 2 deps to catalog + PairingSchema (RED→GREEN) | af9b647, e89d2e6 | pnpm-workspace.yaml, packages/spa/package.json, packages/shared/src/schemas/pairing.ts, pairing.test.ts, index.ts |
| 2 | Cloudflare Pages SPA fallback + strict CSP headers | 66a6bd9 | packages/spa/public/_redirects, packages/spa/public/_headers |
| 3 | Expand global.css + drop 4 RED stub test files | b45a74b | packages/spa/src/styles/global.css, 4 stub test files |

## Catalog Diff

Three new entries added to `pnpm-workspace.yaml` under the SPA stack block:

```yaml
'@tanstack/react-router': ^1.169.1
'@tanstack/zod-adapter': ^1.166.9
'@testing-library/user-event': ^14.5.2
```

`packages/spa/package.json` references all three via `"catalog:"` protocol:
- `dependencies`: `@tanstack/react-router`
- `devDependencies`: `@tanstack/zod-adapter`, `@testing-library/user-event`

## New Exports from @agenticapps/dashboard-shared

Added to `packages/shared/src/index.ts`:

```typescript
export { PairingSchema, AgentUrlSchema, AGENT_URL_REGEX } from './schemas/pairing.js'
export type { Pairing } from './schemas/pairing.js'
```

**`AGENT_URL_REGEX`** — anchored regex accepting:
- `http://localhost(:port)?`
- `http://127.0.0.1(:port)?`
- `https?://<label>.<...>.ts.net(:port)?` (Tailscale MagicDNS)

Rejects: LAN IPs, public domains, `ts.net` lookalikes (anchored), `ftp://`, `https://` on loopback.

**`PairingSchema`** — `{ agentUrl: AgentUrlSchema, token: TokenSchema, pairedAt: z.string().datetime() }`. Imports `TokenSchema` from `auth.ts` (D-13 single source of truth per Pitfall 6).

## _headers CSP Value

The verbatim CSP shipped in `packages/spa/public/_headers` (for Plan 06 smoke test grepping):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://localhost:5193 http://127.0.0.1:5193 https://*.ts.net http://*.ts.net; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Key properties:
- `unsafe-eval` **absent** — XSS exfil hardening (T-02-01)
- `connect-src` locks to loopback:5193 + `*.ts.net` only
- `frame-ancestors 'none'` + `X-Frame-Options: DENY` — clickjacking (T-02-04)
- `Referrer-Policy: no-referrer` — referrer leak (T-02-05)
- Full `Permissions-Policy` disabling camera/mic/geolocation/payment/usb

## RED Stub Files (Wave-0 Nyquist Gate)

All 4 stubs contain the literal string `MISSING — Wave 0 must create` and use `describe.todo` entries. They are counted as skipped (not failing) by vitest.

| File | describe.todo count | Turned GREEN by |
|------|--------------------:|-----------------|
| `packages/spa/src/lib/pairing.test.ts` | 4 | Plan 02-02 |
| `packages/spa/src/lib/theme.test.ts` | 5 | Plan 02-02 |
| `packages/spa/src/lib/api.test.ts` | 7 | Plan 02-03 |
| `packages/spa/src/__tests__/dev-perf-smoke.test.ts` | 2 | Plan 02-06 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @tanstack/zod-adapter version constraint adjusted**
- **Found during:** Task 1 step 3 (`pnpm install`)
- **Issue:** Plan specified `^1.169.1` for `@tanstack/zod-adapter` but the latest published version is `1.166.9`. The install failed with `ERR_PNPM_NO_MATCHING_VERSION`.
- **Fix:** Changed catalog entry to `^1.166.9`. Both packages are from the TanStack Router ecosystem and are API-compatible across minor versions. Actual `@tanstack/zod-adapter` usage is deferred to Plan 02-02; if zod v4 incompatibility surfaces at that point, it becomes a Rule 4 decision.
- **Files modified:** `pnpm-workspace.yaml`
- **Commit:** af9b647

**2. [Rule 1 - Bug] TypeScript strict mode: `.issues[0]` possibly undefined**
- **Found during:** Task 1 `pnpm -r typecheck`
- **Issue:** `pairing.test.ts` accessed `result.error.issues[0].path` without optional chaining; TypeScript strict mode flagged `Object is possibly 'undefined'`.
- **Fix:** Changed to `const firstIssue = result.error.issues[0]; expect(firstIssue?.path)...`
- **Files modified:** `packages/shared/src/schemas/pairing.test.ts`
- **Commit:** e89d2e6

## Known Stubs

All stubs are intentional Wave-0 placeholders per the Nyquist gate contract. No unintentional stubs introduced.

## Threat Flags

None. All files created are static assets, test files, or schema definitions. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

All 12 files created/modified confirmed present. All 4 commits confirmed in git log. Workspace tests: 206 passed, 4 skipped (todos). Typecheck: clean across all 3 packages.
