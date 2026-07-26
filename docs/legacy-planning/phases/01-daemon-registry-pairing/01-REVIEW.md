---
phase: 01-daemon-registry-pairing
reviewed: 2026-05-03T14:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - packages/agent/package.json
  - packages/agent/src/cli.ts
  - packages/agent/src/cli/start.ts
  - packages/agent/src/lib/auth.ts
  - packages/agent/src/lib/registry.ts
  - packages/agent/src/lib/paths.ts
  - packages/agent/src/lib/tailscale.ts
  - packages/agent/src/server/app.ts
  - packages/agent/src/server/boot.ts
  - packages/agent/src/server/middleware/cidr.ts
  - packages/agent/src/server/middleware/errors.ts
  - packages/agent/src/routes/auth.ts
  - packages/agent/src/routes/admin.ts
  - packages/agent/src/routes/read.ts
  - packages/agent/src/routes/git.ts
  - packages/agent/src/routes/registry.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-03T14:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 1 delivers a well-structured Hono daemon with strong security fundamentals: bearer auth covers every route, path allow-list enforcement uses realpath to defeat symlink attacks, CIDR middleware reads from the TCP socket (not headers) to prevent spoofing, and file permissions are enforced at 0600 throughout. The token rotation logic, shutdown handler, and pidfile lifecycle are all sound.

Two critical deviations from spec-verbatim requirements were found. Both stem from the same root cause: the production origin is set to `https://agenticapps-dashboard.pages.dev` (the Cloudflare Pages preview URL) instead of `https://dashboard.agenticapps.eu` (the canonical production domain specified in §Auth and §SPA route structure). This single constant propagates to CORS and the startup banner. The D-01 permissions error message also uses an absolute filesystem path where the spec mandates tilde notation.

Four warnings cover API contract gaps: an empty 404 body on unregister, a D-16 outbound-parse bypass on the register success path, a schema-strength divergence between the local and shared `RegistryListItemSchema`, and a double-invocation risk in the shutdown signal handlers.

---

## Critical Issues

### CR-01: PROD_ORIGIN uses Cloudflare Pages preview URL, not canonical production domain

**File:** `packages/agent/src/constants.ts:4`
**Issue:** `PROD_ORIGIN` is set to `https://agenticapps-dashboard.pages.dev` throughout the codebase. The spec §Auth mandates `https://dashboard.agenticapps.eu` as the production CORS origin (line 171) and the startup banner must render `https://dashboard.agenticapps.eu/pair?…` and `https://dashboard.agenticapps.eu/settings` (spec lines 213, 215). With the current value, the SPA running at the canonical domain will be blocked by CORS, and the printed pair URLs will point to the preview domain, which will not be the deployed production SPA.

This constant is consumed in two critical places:
- `packages/agent/src/server/app.ts:66` — CORS allow-list: only `https://agenticapps-dashboard.pages.dev` and `http://localhost:5174` are allowed; `https://dashboard.agenticapps.eu` is absent.
- `packages/agent/src/lib/banner.ts:33,35` — pair URL and manual-pair hint both embed the wrong origin.

**Fix:**
```ts
// packages/agent/src/constants.ts
export const PROD_ORIGIN = 'https://dashboard.agenticapps.eu'
// Add the pages.dev preview URL as a separate STAGING constant if needed for dev/preview:
export const STAGING_ORIGIN = 'https://agenticapps-dashboard.pages.dev'
```

Then update `app.ts` CORS origin array to include both if preview deploys need to connect:
```ts
origin: [PROD_ORIGIN, DEV_ORIGIN],  // add STAGING_ORIGIN if preview deploy must work
```

---

### CR-02: D-01 InsecurePermissionsError message uses absolute path instead of tilde notation

**File:** `packages/agent/src/lib/auth.ts:69-73`
**Issue:** The spec verbatim D-01 message is:

> `auth.json has insecure permissions (mode 644); fix with \`chmod 600 ~/.agenticapps/dashboard/auth.json\` or run \`agentic-dashboard rotate-token\` to regenerate.`

The code produces:

```
auth.json has insecure permissions (mode 644); fix with `chmod 600 /Users/alice/.agenticapps/dashboard/auth.json` or run `agentic-dashboard rotate-token` to regenerate.
```

The `chmod` path uses `filePath` (the fully-resolved absolute OS path from `os.homedir()`) instead of the spec's `~/.agenticapps/dashboard/auth.json` tilde form. On macOS, `homedir()` returns `/Users/<username>`, so the message will always show an absolute path. This violates the spec-verbatim requirement and makes the CONTEXT.md D-01 grep check (`grep -E "fix with .chmod 600" packages/agent/src/lib/auth.ts`) pass even though the runtime output diverges.

**Fix:**
```ts
// packages/agent/src/lib/auth.ts
import { homedir } from 'node:os'

export function assertSecurePermissions(filePath: string = AUTH_FILE): void {
  const mode = statSync(filePath).mode & 0o777
  if (mode !== 0o600) {
    const octal = mode.toString(8).padStart(3, '0')
    const name = basename(filePath)
    // Replace absolute home path with ~ for the spec-verbatim message
    const displayPath = filePath.replace(homedir(), '~')
    throw new InsecurePermissionsError(
      `${name} has insecure permissions (mode ${octal}); ` +
        `fix with \`chmod 600 ${displayPath}\` or run \`agentic-dashboard rotate-token\` to regenerate.`,
    )
  }
}
```

---

## Warnings

### WR-01: POST /api/registry/unregister returns empty 404 — violates ErrorResponseSchema

**File:** `packages/agent/src/routes/registry.ts:67`
**Issue:** When the project id is not found, the handler returns `c.body(null, 404)` — an empty body with no JSON. Every other error path in the application returns `{ ok: false, error, requestId }` conforming to `ErrorResponseSchema`. The SPA will receive a 404 with no parsable body and cannot display a meaningful error message.

**Fix:**
```ts
// packages/agent/src/routes/registry.ts
registryRoute.post(
  '/unregister',
  zValidator('json', UnregisterBodySchema, (result, c) => {
    if (!result.success) return validationError(c)
  }),
  (c) => {
    const body = c.req.valid('json')
    const registryFile = c.get('registryFile') as string | undefined
    const removed = removeProject(body.id, registryFile)
    if (!removed) {
      return c.json(
        { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
        404,
      )
    }
    return c.body(null, 204)
  },
)
```

---

### WR-02: POST /api/registry/register success response bypasses D-16 outbound-parse

**File:** `packages/agent/src/routes/registry.ts:51-55`
**Issue:** The register success path calls `RegistryEntrySchema.parse(result.entry)` directly and returns `c.json({ ...entry, alreadyRegistered })` without going through `outbound()`. This bypasses the D-16 schema-drift defense: if the response shape drifts (e.g., `alreadyRegistered` type changes or a field is renamed), the daemon will silently send the wrong shape rather than returning a 500 `schema_drift` error. The `outbound()` helper exists precisely to catch this at runtime.

There is also no shared schema for the register response shape (`RegistryEntry + alreadyRegistered`), making the contract implicit.

**Fix:** Define a response schema in shared and use `outbound()`:
```ts
// packages/shared/src/schemas/registry.ts — add:
export const RegisterResponseSchema = RegistryEntrySchema.extend({
  alreadyRegistered: z.boolean(),
})
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>

// packages/agent/src/routes/registry.ts
import { RegistryEntrySchema, RegisterResponseSchema, ... } from '@agenticapps/dashboard-shared'

// in the handler:
return outbound(
  c,
  RegisterResponseSchema.parse.bind(RegisterResponseSchema),
  { ...result.entry, alreadyRegistered: result.alreadyRegistered },
) // status 201/200 — note: outbound currently always returns 200; pass status separately or extend helper
```

Until the schema is added to shared, at minimum wrap the return in `outbound()` using a local inline schema.

---

### WR-03: Local RegistryListItemSchema has weaker lastCommitAt constraint than shared schema

**File:** `packages/agent/src/lib/registry.ts:49-51`
**Issue:** The local `RegistryListItemSchema` defines `lastCommitAt: z.string().nullable()`, while the shared source-of-truth `packages/shared/src/schemas/registry.ts:23` defines `lastCommitAt: z.string().datetime().nullable()`. The `listProjectsWithStatus` function uses the local (weaker) schema for intermediate validation, then the result is parsed against the shared (stricter) schema in `routes/registry.ts:34`. If `git log --format=%cI` ever returns a non-ISO string (e.g., an error message leaking through), the local parse succeeds but the outbound parse in `outbound()` would fail with a 500 `schema_drift` error that is hard to diagnose.

**Fix:** Either use `z.string().datetime().nullable()` in the local schema to match shared, or (better, per the Wave 2 plan) replace the local schema with the shared import immediately since `packages/shared` is already a workspace dependency:
```ts
// packages/agent/src/lib/registry.ts
import {
  RegistryEntrySchema, RegistryFileSchema, RegistryListItemSchema,
  type RegistryEntry, type RegistryFile, type RegistryListItem,
} from '@agenticapps/dashboard-shared'
// Remove local schema definitions
```

---

### WR-04: SIGTERM + SIGINT both call gracefulShutdown — double-invocation not guarded

**File:** `packages/agent/src/server/boot.ts:57-61`
**Issue:** Both signal handlers call `gracefulShutdown(server)` without a guard. If both SIGTERM and SIGINT arrive in rapid succession (e.g., Ctrl-C while a SIGTERM is in-flight), `gracefulShutdown` is called twice on the same `server` object. The second `server.close()` call on an already-closing server will not invoke the callback, meaning `clearTimeout(killer)` is never reached. The 5-second hard-kill timer from the first invocation may never be cleared, causing a redundant `process.exit(0)` after 5 seconds even if shutdown completed cleanly.

**Fix:** Add a one-shot guard:
```ts
// packages/agent/src/server/boot.ts
let shuttingDown = false
const shutdown = (): void => {
  if (shuttingDown) return
  shuttingDown = true
  gracefulShutdown(server)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

---

## Info

### IN-01: diff-stat git command fails on repos with 0 or 1 commit

**File:** `packages/agent/src/lib/git.ts:16`
**Issue:** The `diff-stat` command maps to `git diff --stat HEAD~1..HEAD`. On a repository with zero or one commit, `HEAD~1` does not exist and git exits non-zero with an error message in stderr. This is handled gracefully (`reject: false` propagates the non-zero exit code), but callers consuming the `exitCode` and `stderr` fields should expect this condition. Consider documenting it or mapping to a more defensive variant (e.g., `--diff-filter=A HEAD`).

**Fix:** No code change required for correctness (the error propagation is sound). Add a comment:
```ts
// git diff --stat HEAD~1..HEAD intentionally — on repos with <2 commits,
// exits non-zero with stderr describing the missing ref. Callers handle exitCode != 0.
'diff-stat': ['diff', '--stat', 'HEAD~1..HEAD'],
```

---

### IN-02: Register success response lacks ok: true — inconsistent with other success responses

**File:** `packages/agent/src/routes/registry.ts:54`
**Issue:** The register endpoint returns `{ ...entry, alreadyRegistered }` which omits an `ok: true` field. All other success payloads in this codebase (`/health`, `/api/registry GET`) include `ok: true`. This inconsistency makes SPA-side type-narrowing harder — the client cannot uniformly check `response.ok === true` to distinguish success from error.

This will be resolved when WR-02 is addressed (a `RegisterResponseSchema` with an explicit `ok` field, or consistently relying on HTTP status codes for success/failure discrimination).

**Fix:** Add `ok: true` to the response until a full schema is defined:
```ts
return c.json({ ok: true as const, ...entry, alreadyRegistered: result.alreadyRegistered }, status)
```

---

## Hard Constraint Verification

| Constraint | Status | Notes |
|---|---|---|
| Read-only on project filesystems | PASS | No route writes to project files. `read.ts` is GET-only via `readFile`. |
| Path allow-list `.planning`/`.claude` only | PASS | `resolveAllowed` in `paths.ts` enforces allow-list with realpath symlink resolution. |
| Daemon writes confined to `~/.agenticapps/dashboard/` | PASS | All writes use `AUTH_FILE`, `REGISTRY_FILE`, `PIDFILE`, `SERVER_FILE` constants from `CONFIG_DIR`. |
| File permissions mode 0600 | PASS | Both `writeFileSync({ mode: 0o600 })` and `chmodSync(…, 0o600)` are called on every write. |
| Bearer-token auth on every route | PASS | `app.use(bearerAuth(…))` is mounted globally before all routes in `app.ts:75`. |
| CORS locked to production + dev origins | **FAIL** | `PROD_ORIGIN` is `pages.dev` not `dashboard.agenticapps.eu` — see CR-01. |
| No native dependencies | PASS | `package.json` has no `keytar`, no FFI. All deps are pure JS/TS. |
| D-01 InsecurePermissionsError message verbatim | **FAIL** | Uses absolute path instead of `~` notation — see CR-02. |
| D-02 banner format verbatim | **FAIL** | Banner URLs embed wrong production domain (consequence of CR-01). |
| D-13 token format (8×8 hex, 71 chars) | PASS | `randomBytes(32).hex().match(/.{1,8}/g).join('-')` = 8 groups × 8 chars + 7 dashes = 71 chars. |
| D-17 Tailscale degraded message verbatim | PASS | `tailscale.ts:9-12` matches spec exactly: `Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.` |

---

_Reviewed: 2026-05-03T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
