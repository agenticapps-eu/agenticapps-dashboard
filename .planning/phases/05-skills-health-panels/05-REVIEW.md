---
phase: 05-skills-health-panels
reviewed: 2026-05-07T21:30:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - packages/shared/src/schemas/agentlinter.ts
  - packages/shared/src/schemas/integrations.ts
  - packages/shared/src/schemas/observability.ts
  - packages/shared/src/schemas/secrets.ts
  - packages/shared/src/schemas/skills.ts
  - packages/agent/src/lib/paths.ts
  - packages/agent/src/lib/skillsScan.ts
  - packages/agent/src/lib/agentLinterRunner.ts
  - packages/agent/src/lib/agentLinterCache.ts
  - packages/agent/src/lib/projectMetadataScan.ts
  - packages/agent/src/lib/integrationsState.ts
  - packages/agent/src/routes/skills.ts
  - packages/agent/src/routes/agentlinter.ts
  - packages/agent/src/routes/observability.ts
  - packages/agent/src/routes/secrets.ts
  - packages/agent/src/routes/integrations.ts
  - packages/agent/src/server/app.ts
  - packages/meta-observer/hooks/session-end.mjs
  - packages/meta-observer/lib/projectRoot.ts
  - packages/meta-observer/lib/atomicWrite.ts
  - packages/meta-observer/lib/extractCommitment.ts
  - packages/meta-observer/lib/extractFirings.ts
  - packages/spa/src/components/SingleProjectView.tsx
  - packages/spa/src/components/panels/InstalledSkills.tsx
  - packages/spa/src/components/panels/SkillHealth.tsx
  - packages/spa/src/components/panels/ObservabilityHealth.tsx
  - packages/spa/src/components/panels/SecretsHealth.tsx
  - packages/spa/src/components/panels/IntegrationsHealth.tsx
  - packages/spa/src/components/panels/HookFirings.tsx
  - packages/spa/src/lib/projectQueries.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-07T21:30:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 5 ships the Skills + Health column with notably tight execution: the Zod
schemas are precise discriminated unions, every new route inherits bearer auth +
CORS through `app.route('/api/projects', ...)` mounting, every daemon response
goes through `outbound()` for schema-drift defense, and every panel falls
through `error → schema_drift → InlineDrift / unreachable` correctly. The
real-risk surface called out in the brief checks out:

- **No path-traversal regressions.** All filesystem reads on the daemon side
  go through `resolveAllowed` (.planning/.claude only) or `resolveAllowedNamed`
  (the D-5-13 named-scope extension for top-level `package.json` /
  `.sentryclirc` / `.infisical.json` / `.github/workflows/*.yml`). No raw
  user-controlled string is fed into `fs.readFile` outside those resolvers.
- **No bearer-auth bypass.** Every Phase-5 route is mounted under
  `/api/projects` or `/api` AFTER the `bearerAuth` middleware in
  `createApp()`. The route files themselves register no auth-relevant
  middleware.
- **No schema drift between route output and `outbound()` schema.** Every
  payload-construction site builds the exact discriminator the schema requires
  (e.g. AgentLinterResponse `kind: 'ok'` adds `cachedAt`, other kinds don't).
- **Error handler does not leak paths or stack traces** in production
  (`NODE_ENV !== 'development'` branches in `errors.ts`).
- **No XSS surface in the new panels.** `IntegrationsHealth` static-copy guard
  holds (paragraphs are JSX literals, no daemon interpolation). All
  user/daemon strings — skill names, descriptions, evidence strings, stderr —
  are rendered as React text children, auto-escaped. No raw-HTML injection
  sinks were used in any of the five Phase-5 panels.
- **In-memory caches are bounded by both per-project key and TTL.** AgentLinter
  has the additional max-mtime invalidation; skills/observability/secrets/
  integrations have 5–60s TTL. No unbounded memoization.
- **Meta-observer hook is hook-crash-loop safe** (`process.exit(0)` on every
  failure path, `main().catch(...)` swallows unhandled rejections). Atomic
  rename + sandbox realpath check is the right approach.

The single Warning below is a wiring miss between Phase 5 cache eviction
helpers and the registry unregister flow — not a security issue but a
correctness footgun for re-registered projects. The four Info items are minor
classification/UX consistency improvements.

## Warnings

### WR-01: Phase-5 cache evict helpers are exported but not wired into `/api/registry/unregister`

**File:** `packages/agent/src/routes/registry.ts:103-107`
**Issue:**
The unregister handler evicts only the Phase-3 overview cache and the
Phase-4 phase-detail cache:

```
if (removed) {
  evictOverviewCache(body.id) // T-03-03-05 cache hygiene
  evictPhaseCacheProject(body.id) // T-04-03-07 Phase 4 cache hygiene
  return c.body(null, 204)
}
```

But Phase 5 ships five new in-memory caches keyed on `projectId`:

- `evictAgentLinterCacheProject` (`lib/agentLinterCache.ts:130`)
- `evictSkillsCacheProject` (`routes/skills.ts:95`)
- `evictObservabilityCacheProject` (`routes/observability.ts:85`)
- `evictSecretsCacheProject` (`routes/secrets.ts:53`)
- `evictIntegrationsCacheProject` (`routes/integrations.ts:104`)

Grep confirms none of them are called from `src/` outside their own definition
file (and tests). Result: if a user `unregister`s project `proj-1` and then
re-registers a different project that gets the same id (or re-registers the
same root after editing files on disk), the caches still hold the previous
results until the 1-hour AgentLinter TTL / 60-second skills TTL / 5-second
metadata TTL elapses. Same threat profile as T-03-03-05 / T-04-03-07 — those
were explicitly addressed when those phases shipped.

The 5s TTL caches (observability/secrets/integrations) self-heal quickly, so
the practical exposure is mostly the AgentLinter cache (1h) and the skills
cache (60s). Still a stale-after-rebind hazard worth closing.

**Fix:**
```ts
// packages/agent/src/routes/registry.ts
import {
  evictAgentLinterCacheProject,
} from '../lib/agentLinterCache.js'
import { evictSkillsCacheProject } from './skills.js'
import { evictObservabilityCacheProject } from './observability.js'
import { evictSecretsCacheProject } from './secrets.js'
import { evictIntegrationsCacheProject } from './integrations.js'

// ...inside the unregister handler:
if (removed) {
  evictOverviewCache(body.id)
  evictPhaseCacheProject(body.id)
  evictAgentLinterCacheProject(body.id)
  evictSkillsCacheProject(body.id)
  evictObservabilityCacheProject(body.id)
  evictSecretsCacheProject(body.id)
  evictIntegrationsCacheProject(body.id)
  return c.body(null, 204)
}
```

A regression test along the lines of the existing T-03-03-05 / T-04-03-07
cases would lock this in (register → fill cache → unregister → assert cache
miss).

## Info

### IN-01: `IntegrationsHealth` Linear example uses lowercase but the daemon regex requires uppercase

**File:** `packages/spa/src/components/panels/IntegrationsHealth.tsx:71` and `packages/agent/src/routes/integrations.ts:45`
**Issue:**
The Linear "not-detected" paragraph instructs the user to "use a branch name
like `donald/abc-123-fix-foo`". However, `LINEAR_BRANCH_RE = /[A-Z]{2,}-\d+/`
requires two-or-more uppercase letters before the dash, so `abc-123` does not
match — the daemon will keep returning `not-detected` even after the user
follows the hint exactly, never transitioning to `present-but-not-configured`.

This is a documentation/behavior mismatch, not a security or correctness bug
per se, but it makes the inline guide unhelpful for the most likely follower.

**Fix:**
Either capitalize the example to match the regex (`donald/ABC-123-fix-foo`,
which is also the actual Linear default), or relax the regex to match the
documented case-insensitively (`/[A-Za-z]{2,}-\d+/i`). Linear ticket prefixes
are uppercase in practice, so updating the SPA copy is the lower-risk fix:

```tsx
// IntegrationsHealth.tsx Linear paragraph
... use a branch name like{' '}
<code className="font-mono">donald/ABC-123-fix-foo</code> — issue title and ...
```

### IN-02: `runAgentLinter` collapses every non-timeout spawn error to `not-installed`

**File:** `packages/agent/src/lib/agentLinterRunner.ts:63-69`
**Issue:**
```
} catch (e: unknown) {
  const err = e as { timedOut?: boolean }
  if (err?.timedOut) return { kind: 'timeout' }
  return { kind: 'not-installed' }
}
```

Any execa throw that isn't `timedOut` (e.g. `ENOSPC` writing to npm cache,
`EAGAIN`, signal-killed, OOM, missing `node`/`npx` binary) maps to
`kind: 'not-installed'`. The SPA then renders the install CodeBlock — which is
misleading when the actual cause is something else. The 5-class discriminated
union per D-5-15 already has `kind: 'error' { exitCode, stderr }` for this
shape; routing transient spawn failures through it (with a synthetic exit code
or message) would be more honest.

**Fix:**
Distinguish the two cases. Heuristic: if the error message contains `ENOENT`
referencing `npx`/`node`, surface `not-installed`; otherwise surface `error`:

```ts
} catch (e: unknown) {
  const err = e as { timedOut?: boolean; code?: string; message?: string }
  if (err?.timedOut) return { kind: 'timeout' }
  if (err?.code === 'ENOENT') return { kind: 'not-installed' }
  return { kind: 'error', exitCode: -1, stderr: String(err?.message ?? err) }
}
```

This keeps the user-visible install hint reserved for the cases it actually
applies to, and pipes infrastructure failures through the existing `error`
panel.

### IN-03: `agentlinter` argv lacks a `--` end-of-options separator before `projectRoot`

**File:** `packages/agent/src/lib/agentLinterRunner.ts:54-62`
**Issue:**
```
['--yes', 'agentlinter', '--local', '--json', projectRoot]
```

`projectRoot` comes from the registry, which already validates roots — so this
is not exploitable today. But if a hypothetical project root started with `-`
(e.g. someone registers a path under `/tmp/-malformed/`), agentlinter could
parse it as a flag rather than a target. Adding `--` makes the boundary
explicit and matches the convention used by `runAllowedGit`'s argv builder.

**Fix:**
```ts
['--yes', 'agentlinter', '--local', '--json', '--', projectRoot]
```

### IN-04: Five `c.get('registryFile')` casts could be a single typed accessor

**File:** `packages/agent/src/routes/skills.ts:70`, `routes/agentlinter.ts:37`, `routes/observability.ts:43`, `routes/secrets.ts:34`, `routes/integrations.ts:50`
**Issue:**
Each route does `c.get('registryFile') as string | undefined` even though
`packages/agent/src/server/app.ts:33-39` already declares
`Variables.registryFile?: string`. With the typed `Hono<Env>` instance, the
`as string | undefined` cast should be a no-op — and is, but the duplication
makes future refactors fragile (e.g. renaming the variable would slip past
TypeScript thanks to the cast). Style only; no behavior change.

**Fix:**
A small helper:

```ts
// in app.ts or a shared helpers module
export function getRegistryFile(c: Context<Env>): string | undefined {
  return c.get('registryFile')
}
```

Then route handlers call `readRegistry(getRegistryFile(c))`. Optional cleanup
for Phase 6 polish; not blocking.

---

_Reviewed: 2026-05-07T21:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
