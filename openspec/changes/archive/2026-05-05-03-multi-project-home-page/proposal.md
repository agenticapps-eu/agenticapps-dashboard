# Phase 3: Multi-project Home Page -

**Archived from GSD phase `03-multi-project-home-page`. Completed 2026-05-05.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/03-multi-project-home-page/` — that tree, not this file, is the authoritative record.

## Why

A multi-project home page at `/` that renders one card per registered project (current phase + status, finding counts, last-commit time, branch, must_haves vs evidence) with filter chips, fuzzy search, sort control, 5 s polling with per-card freshness, an in-UI register modal, and inline rename/tag/unregister via a right-click / long-press / kebab context menu.

Backed daemon-side by:
- `GET /api/registry` — list + light status (reachable, currentPhase, lastCommitAt). Already shipped Phase 1.
- `GET /api/projects/{id}/overview` — rich card data (NEW).
- `POST /api/registry/register-prepare` (NEW) — issues nonce + canonical path + suggestedName + blockedReason.
- `POST /api/registry/register-confirm` (NEW) — consumes nonce, commits via Phase 1's `addProject`.
- `POST /api/registry/register` — stays for CLI; SPA must use prepare/confirm (D-12).
- `POST /api/registry/{id}/rename` (NEW).
- `POST /api/registry/{id}/tags` (NEW).
- `POST /api/registry/unregister` — already shipped Phase 1.

Plus a placeholder `/projects/{id}` route in the SPA so card click-through resolves before Phase 4 ships the real view.

**In scope (Phase 3):** HOME-01..06, the Phase 1 deferred confused-deputy "option C", a rename/tag/unregister context menu on cards (pulled forward from `/settings/projects`), and a Cmd/Ctrl+K command palette.

**Out of scope (later phases):**
- `/projects/{id}` three-column view

## Capabilities affected

- `openspec/specs/project-dashboard/spec.md`
- `openspec/specs/project-registry/spec.md`

## What shipped

**03-01**

### Task 1 — Shared schemas (commit 8939d54)

**New file: `packages/shared/src/schemas/overview.ts`**

Exports:
- `FindingCountsSchema` — `{ red, yellow, green }` nonnegative integers
- `DbAuditFindingsSchema` — `{ critical, high, medium, low }` nonnegative integers
- `MarkersSchema` — `{ gitRepo, planning, claudeSkills }` booleans
- `ProjectOverviewSchema` — top-level schema with `phaseStatus: enum['Pending', 'In Progress', 'Complete']` + 6 nullable sub-objects
- Inferred `ProjectOverview` type

**Extended: `packages/shared/src/schemas/registry.ts`**

Added (below existing Phase 1 exports — n

**03-02**

### `packages/spa/src/lib/appShellWidth.ts` (NEW)

Module-scope external store with four exports:

- `setAppShellWidth(value)` — updates the current width string and notifies all subscribers
- `subscribeAppShellWidth(cb)` — registers a subscriber, returns unsubscribe function
- `getSnapshot()` — returns current width (default `'max-w-3xl'`)
- `useAppShellWidth()` — React hook via `useSyncExternalStore`; re-renders consumers when width changes

Pattern is identical to `packages/spa/src/lib/theme.ts` (WR-01 fix from Phase 2), providing a process-private, bundle-scoped subscription bus.

### `pac

**03-03**

`GET /api/projects/:id/overview` — the daemon-side endpoint that Wave 2 SPA's `useProjectOverview(id)` hook consumes per project card (HOME-02).

### Route shape

```
GET /api/projects/:id/overview
Authorization: Bearer <token>

200: ProjectOverview (D-08 schema)
404: { ok: false, error: 'project_not_found', requestId }
500: { ok: false, error: 'schema_drift', requestId }  ← on schema parse failure
```

### Hono path mounting decision

Registered as `app.route('/api/projects', overviewRoute)` in `app.ts` — same pattern as `readRoute` and `gitRoute`. The `:id` prefix is part of the route handle

**03-04**

### Task 1: register-prepare route + Wave 0 daemon libs

`POST /api/registry/register-prepare` — the SPA calls this with `{ path }` before registering any project. The handler:

1. **Rate-limits** via `rateLimiter.ts`: 10 calls per 10-second window per bearer token hash; 11th call → 429 with `Retry-After: 1`.
2. **Canonicalises** the path via the now-exported `canonicaliseRoot` (realpath + resolve fallback).
3. **Already-registered check**: returns `{ alreadyRegistered: true, existingEntry }` — no nonce issued.
4. **Blocked check** via `assertRegistrationAllowed`: returns `{ blocked: true, blo

**03-05**

### Task 1: /:id/rename + /:id/tags routes + evict() in /unregister (TDD)

**RED phase:** 6 failing tests added to `packages/agent/src/server/__tests__/registry.test.ts`:
- `POST /api/registry/:id/rename` happy path → 200 + updated entry
- `POST /api/registry/:id/rename` unknown id → 404 `project_not_found`
- `POST /api/registry/:id/rename` empty name → 422 `invalid_request`
- `POST /api/registry/:id/tags` happy path → 200 + updated entry with tags
- `POST /api/registry/:id/tags` non-array tags → 422 `invalid_request`
- `POST /api/registry/unregister` evicts overview cache entry → `getCached(i

**03-06**

### Task 1: api.ts D-12 guard (TDD)

Added a one-line guard at the top of `apiFetch()` that throws before any network call when `path === '/api/registry/register'`:

```typescript
if (path === '/api/registry/register') {
  throw new Error(
    'SPA must use /api/registry/register-prepare and /api/registry/register-confirm. ' +
      '/api/registry/register is CLI-only (D-12).',
  )
}
```

Error message explicitly names both allowed paths and the D-12 decision. 3 new tests added:
- Guard throws with `/CLI-only/` and fetch never called
- `/register-prepare` allowed (not blocked)
- `/register-con

**03-07**

Three view-only components built TDD for the multi-project home page card grid.

**03-08**

The full Phase 3 home page composition: native `<dialog>` two-step register modal, the dashed-accent `+ Register project` CTA card, inline rename/edit-tags dialogs triggered by the context menu, and the top-level `MultiProjectHome` that wires everything together. The Phase 2 stub at `routes/index.lazy.tsx` is replaced.

**03-09**

### `useLastRefresh` hook (`packages/spa/src/lib/lastRefresh.ts`)

Contract:
```typescript
export function useLastRefresh(): { count: number | null; refreshLabel: string | null }
export function relativeSeconds(deltaMs: number): string  // pure, exported for tests
```

- `count`: length of `['registry']` query data array, or `null` while loading.
- `refreshLabel`: `"last refresh Ns ago"` using `Math.min(...dataUpdatedAt)` across all `['registry']` and `['overview', *]` cache entries with `dataUpdatedAt > 0`; `"refreshing…"` when no entry has completed yet.
- Updates every 1s via `setInterval`;

**03-10**

### Task 1: commandPaletteActions.ts — declarative action registry (TDD)

New `packages/spa/src/lib/commandPaletteActions.ts` exporting:

**`PaletteAction` interface:**
```typescript
interface PaletteAction {
  id: string
  label: string
  type: 'register' | 'refresh' | 'toggle-theme' | 'jump'
  run: () => void
}
```

**`useCommandPaletteActions(close)`** — hook returning the full ordered action list:
- `register` — dispatches `palette:open-register` CustomEvent on `window`, then calls `close()`
- `jump:{id}` — one per project in `useRegistryList().data`; calls `navigate({ to: '/projects/$proj

**03-11**

### Task 1: Subprocess test — daemon spawn + prepare + confirm + optimistic-add timing

`packages/spa/src/__tests__/register-optimistic.test.ts` — a vitest subprocess test (runs under `vitest.subprocess.config.ts`, node environment, forks pool) that:

1. **Builds** the agent binary in `beforeAll` via `spawnSync('pnpm', ['build'])` — idempotent.
2. **Isolates** all daemon state to a `mkdtempSync` HOME (T-03-11-02). No writes reach `~/.agenticapps/dashboard/`.
3. **Spawns** the daemon with `node packages/agent/dist/cli.js start --port <PORT> --bind 127.0.0.1`, overriding `HOME` to the temp dir.

## Gates recorded

- verification — `03-VERIFICATION.md`
- code review — `03-REVIEW.md`
- security audit — `03-SECURITY.md`
- design critique — `03-IMPECCABLE.md`
- human UAT — `03-HUMAN-UAT.md`
- validation — `03-VALIDATION.md`
