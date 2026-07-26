# Phase 3: Multi-project Home Page - Research

**Researched:** 2026-05-04
**Domain:** Multi-project dashboard home: TanStack Query polling, Hono filesystem parsing, nonce/rate-limit security, accessible SPA modal/palette/context-menu, Tailwind v4 hover-expand transitions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** List + per-card `/overview` fan-out — N independent `useQuery` calls, one per project ID. Per-card freshness and schema-drift isolation.
**D-02** Daemon-side 5 s in-process memo cache per `/overview`. `Map<projectId, { value, expiresAt }>` with lazy expiry.
**D-03** `refetchIntervalInBackground: false`. On tab-visible, queries refetch immediately.
**D-04** Phase status derives from filesystem heuristic: Pending (no PLAN.md), In Progress (PLAN.md + missing must_have evidence), Complete (all must_haves have evidence).
**D-05** Per-card timestamp + global header "last refresh Ns ago" via oldest `dataUpdatedAt` across all card queries.
**D-06** Unreachable cards render inline, dimmed (`opacity-60`), sorted last within their tag bucket.
**D-07** Per-card error surface: drift → `<SchemaDriftState />`; 5xx/network → static metadata + muted footer; 401 → global `RepairBanner`.
**D-08** Field split: `/api/registry` returns light status; `/api/projects/{id}/overview` returns rich card data (no duplication).
**D-09** Two-step prepare/confirm with nonce for SPA registration (confused-deputy defense).
**D-10** Nonce: in-memory `Map<nonceHex, { canonicalRoot, suggestedName, suggestedSlug, detectedMarkers, expiresAt }>`. TTL 5 min, single-use. No persistence across restart.
**D-11** Blocked prepare returns 200 with `blocked: true, blockedReason`. No nonce issued.
**D-12** `POST /api/registry/register` stays for CLI; SPA forbidden from calling it (lint rule + runtime assert in `apiFetch`).
**D-13** Nonce bound to bearer token (any paired caller can confirm), no per-tab isolation.
**D-14** Rate-limit `/register-prepare`: 1/s soft cap, 10-burst. Returns 429 `Retry-After: 1`.
**D-15** Blocked attempts log to stderr: `[agent] BLOCKED register: <root> (<reason>) tokenHash=<8chars> requestId=<uuid>`.
**D-16** No extra friction on `--bind tailscale` / `--bind 0.0.0.0`.
**D-17** Already-registered prepare returns 200 `alreadyRegistered: true` + existing entry, no nonce.
**D-18** Expired nonce on confirm → 410. SPA auto re-prepares silently with 200 ms "refreshing…" state.
**D-19** Nonce not persisted to localStorage.
**D-20** Single-field path → preview → optional fields on confirm step (Step 1 / Step 2 in same container).
**D-21** Suggested name = `basename(canonicalRoot)`; no auto-tagging.
**D-22** Tag input = free text + chip suggestions from existing registry tags.
**D-23** Right-click + long-press + `⋮` kebab button → shared `<CardContextMenu>`. Menu items: Rename, Edit tags, Unregister.
**D-24** Add `POST /api/registry/{id}/rename` and `POST /api/registry/{id}/tags`. Both bearer-gated, no nonce.
**D-25** Optimistic add on register-confirm: invalidate + push entry into cache immediately on 201. Same for rename/tag/unregister.
**D-26** Modal close: Esc, backdrop click, X button. Dirty state shows inline "Discard?" banner, not a second dialog.
**D-27** Blocked path: step 2 still renders canonical path; Confirm disabled; red inline banner with verbatim `blockedReason`.
**D-28** Prepare error: inline error + Retry button; no auto-retry. Schema drift renders `<SchemaDriftState />` inside modal.
**D-29** Focus moves to newly-added card after confirm closes modal.
**D-30** Soft hint when no project markers detected (informational only, not blocking).
**D-31** Enter-key contract: Step 1 Enter = Preview; Step 2 Enter on name = confirm; on tag input = add chip.
**D-32** Cmd/Ctrl+K command palette (scope-significant). Purpose-built; no library. `<dialog>` + `role="listbox"` + `aria-activedescendant`. v1 actions: Register, Jump-to-project, Refresh, Toggle theme.
**D-33** Successful registers NOT logged separately; standard request log line covers confirm.
**D-34** Rich + collapsible cards: compact default; hover/focus expands.
**D-35** Card height: compact ~5 lines, expanded +5 more. `opacity` + `max-height` 120 ms transition.
**D-36** Finding counts: `🔴 0  🟡 2  🟢 5` Unicode glyphs. DB-AUDIT uses text labels. Aria-label on containing span.
**D-37** Click anywhere on card = navigate to `/projects/{id}`. Phase 3 ships placeholder route.
**D-38** Filter chips: fixed `all / active / client / internal` + derived overflow tags with `(N)` count. Multi-select = OR semantics.
**D-39** Search: lower-cased substring on name + client + tags + currentPhase dirname. AND with chip filter. Esc clears.
**D-40** Sort: Recommended default (tag priority → lastCommitAt desc); user-selectable session-only override (Last commit, Name, Phase, Client).
**D-41** No virtualisation or pagination in v1. Revisit at 50+ projects.
**D-42** No skeleton-shimmer loading states. Static `—` placeholder in muted text.
**D-43** Hover-expand: `opacity` + `max-height` only. No rotate, scale, glow, bounce.
**D-44** Empty-phase card: render `no .planning/` + `install workflow skill →` link. No finding rows. Click-through still works.

### Claude's Discretion

- Empty grid behaviour: redirect vs zero-state (UI-SPEC says render zero-state inline with `+ Register project` card, not redirect).
- `ProjectOverviewSchema` exact field naming (planner can rename for consistency; both ends must agree).
- Optimistic-update rollback paths on rename/tag 5xx (path-of-no-rollback acceptable).
- Touch long-press timing (~500 ms starting point).
- Command palette internal layout (icons, grouping — no animations violating D-43).
- TanStack Query cache key shape (suggested: `['registry']`, `['overview', projectId]`).
- Daemon-side cache eviction: lazy expiry on read; no background sweeper.
- Test layout: vitest unit + component for SPA; in-process Hono for daemon routes; one subprocess test for register-prepare → confirm → card-appears.

### Deferred Ideas (OUT OF SCOPE)

- `/settings/projects` standalone management sub-route.
- Sort persistence across sessions.
- Pagination / virtualisation.
- localStorage for pending nonce / register continuity.
- `/projects/{id}` three-column content (Phase 4).
- AgentLinter / Skill health panels (Phase 5).
- Sentry / Linear / Infisical panels (Phase 7+).
- Keyboard shortcuts beyond Cmd/Ctrl+K (Phase 6).
- `impeccable:critique` >= 90 hard gate (Phase 6).
- Command palette action expansion beyond v1 four actions.
- Explicit rollback on rename/tag 5xx beyond refetch reconciliation.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | `GET /api/registry` returns all projects with per-project status (`reachable`, `currentPhase`, `lastCommitAt`) | Already shipped Phase 1. No new work. Existing `RegistryListResponseSchema` is the contract. |
| HOME-02 | `GET /api/projects/{id}/overview` returns summary card data: phase, Stage 1/2 status, finding counts, must_haves vs evidence, last commit, branch | New endpoint. `ProjectOverviewSchema` (new). Parsing logic in `projectOverview.ts` + `overviewCache.ts`. |
| HOME-03 | Home page renders one card per registered project; cards refresh every 5s; per-card freshness visible | `useQuery({ refetchInterval: 5_000, refetchIntervalInBackground: false })` per card. `dataUpdatedAt` for freshness. |
| HOME-04 | Filter chips and search box filter the card grid | Client-side `useMemo` derived state over cached `/api/registry` list. No server params. |
| HOME-05 | Sort: tag priority (active > client > internal), then by last commit time desc | Pure sort function in the `useMemo` derived state; user-selectable override for session (D-40). |
| HOME-06 | "+ Register project" card opens modal that POSTs to `/api/registry/register` | New two-step prepare/confirm flow. `POST /register-prepare` + `POST /register-confirm`. CLI route unchanged. |
</phase_requirements>

---

## Summary

Phase 3 is a substantial frontend + backend build. The daemon gains five new endpoints (overview, register-prepare, register-confirm, rename, tags) plus five new pure-function libraries (`projectOverview`, `overviewCache`, `registerNonces`, `rateLimiter`, `registerLog`). The SPA gains twelve new files (MultiProjectHome, HomeToolbar, ProjectCard, CardContextMenu, RegisterModal, RegisterButtonCard, CommandPalette, commandPaletteActions, registry hooks, touchLongPress, projects.$projectId placeholder, updated index route and Header). The shared schemas package gains `overview.ts` and extended registry schemas.

All downstream layers are well-understood from Phase 1 and Phase 2 foundations. The parsing patterns for REVIEW.md and VERIFICATION.md are the highest-risk new implementation areas; both have clear strategies documented below. The command palette (D-32) is the largest scope-additive surface and the CONTEXT.md explicitly flags it as a potential Wave-2 or Phase-6 deferral candidate.

The architectural invariants are unchanged: read-only on project FS, bearer-token on every route, CORS locked, no native deps, 0600 file modes.

**Primary recommendation:** Build in this order: (Wave 0) schemas + tests; (Wave 1) daemon libs + routes + tests; (Wave 2) SPA home grid + toolbar + cards + filter/search/sort + context menu + register modal; (Wave 3) command palette + header extension + final wiring. Keep the command palette as a self-contained plan so it can slide to Phase 6 without disrupting the grid.

---

## Standard Stack

### Core (no new deps — all already in catalog)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.100.8` | `useQuery`, `useMutation`, `QueryClient`, `setQueryData`, `invalidateQueries` | Already dep Phase 2; v5 API confirmed |
| `@tanstack/react-router` | `^1.169.1` | Routing, lazy routes | Already dep Phase 2 |
| `zod` | `^3.25.0` | Schema validation both ends | Project-wide standard |
| `lucide-react` | `^1.14.0` | Icons: MoreVertical, Plus, Search, ChevronDown, FolderOpen, Tag, Trash2, AlertTriangle | Already dep Phase 2 |
| `hono` + `@hono/zod-validator` | existing catalog | Daemon route handlers | Phase 1 |
| `execa` | existing | git subprocess: branch detection, TDD log parsing | Phase 1; argv-array subprocess discipline |
| `node:crypto` | Node 20 built-in | `randomBytes(16)` for nonce; `createHash('sha256')` for tokenHash | No new dep; already in atomicWrite.ts |

[VERIFIED: pnpm catalog in root package.json; packages installed in spa/node_modules; `useQueries` confirmed exported in @tanstack/react-query build]

**No new deps introduced in Phase 3.** [VERIFIED: 03-CONTEXT.md code_context section]

### Installation

No install step — all deps already in pnpm catalog. Phase 3 adds new files only.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
packages/shared/src/schemas/
├── overview.ts                   # ProjectOverviewSchema (NEW)
└── registry.ts                   # EXTEND: RegisterPrepareRequest/Response, RegisterConfirmRequest/Response, RenameRequest, TagsRequest

packages/agent/src/lib/
├── projectOverview.ts            # readOverview(root) pure-function (NEW)
├── overviewCache.ts              # Map<id, {value, expiresAt}> lazy cache (NEW)
├── registerNonces.ts             # issueNonce/consumeNonce/cleanupExpired (NEW)
├── rateLimiter.ts                # Map<tokenHash, timestamps[]> sliding-window (NEW)
└── registerLog.ts                # logBlocked() stderr helper (NEW)

packages/agent/src/routes/
├── registry.ts                   # EXTEND: register-prepare, register-confirm, /:id/rename, /:id/tags
└── overview.ts                   # GET /api/projects/:id/overview (NEW)

packages/spa/src/
├── routes/
│   ├── index.lazy.tsx            # REPLACE body: mount <MultiProjectHome />
│   └── projects.$projectId.lazy.tsx   # NEW placeholder route
├── components/
│   ├── MultiProjectHome.tsx      # NEW top-level home component
│   ├── HomeToolbar.tsx           # NEW filter chips + search + sort
│   ├── ProjectCard.tsx           # NEW single card, compact + hover-expand
│   ├── CardContextMenu.tsx       # NEW accessible context menu portal
│   ├── RegisterModal.tsx         # NEW two-step modal using native <dialog>
│   ├── RegisterButtonCard.tsx    # NEW dashed-accent register affordance
│   └── CommandPalette.tsx        # NEW global Cmd/Ctrl+K palette
└── lib/
    ├── registry.ts               # NEW TanStack Query hooks
    ├── touchLongPress.ts         # NEW Pointer Events long-press helper
    └── commandPaletteActions.ts  # NEW declarative action registry
```

### Pattern 1: Daemon-side 5s In-Process Memo Cache (D-02)

**What:** `Map<projectId, { value: ProjectOverview, expiresAt: number }>` with lazy expiry on read. Coalesces multiple SPA tabs polling at 5s intervals into one filesystem read per 5s window.
**When to use:** Every call to `GET /api/projects/:id/overview` checks the cache first.

Implementation contract for `overviewCache.ts`:
- `getCached(id: string): ProjectOverview | null` — checks `entry.expiresAt > Date.now()`; returns null and deletes entry if stale.
- `setCached(id: string, value: ProjectOverview): void` — stores with `expiresAt = Date.now() + 5_000`.
- `evict(id: string): void` — called on unregister to prevent stale data for a re-registered path with same ID.
- No background sweeper: cache is bounded by registry size (~5-50 entries). [ASSUMED]

[CITED: 03-CONTEXT.md D-02]

### Pattern 2: Nonce Map with TTL + Single-Use Semantics (D-10)

**What:** In-memory nonce store for the prepare/confirm two-step. Nonces expire after 5 min; `consumeNonce` removes on first use to prevent replay.

Implementation contract for `registerNonces.ts`:
- `issueNonce(entry)` — generates `randomBytes(16).toString('hex')` (32-char hex per D-10), stores with `expiresAt = Date.now() + 300_000`.
- `consumeNonce(nonce): NonceEntry | null` — deletes the entry on first call regardless of expiry; returns null if expired OR unknown. This means: unknown nonce → null; expired nonce → delete + null. Caller returns 410 Gone in both cases (D-18).
- `cleanupExpired()` — sweeps the Map; call on a 60s `setInterval` at module initialization to prevent memory accumulation.
- `NonceEntry` shape: `{ canonicalRoot, suggestedName, suggestedSlug, detectedMarkers: { gitRepo, planning, claudeSkills }, expiresAt }` [CITED: 03-CONTEXT.md D-10]

**Race window:** Two simultaneous confirm calls with the same nonce — the first deletes the entry; the second finds nothing and returns 410. Correct behavior: only one confirm wins. [ASSUMED — Map operations are synchronous in Node.js single-threaded event loop]

### Pattern 3: Sliding-Window Rate Limiter (D-14)

**What:** `Map<tokenHash, timestamps[]>` in memory. Soft cap 1/s, 10-burst window (10 requests per 10-second window). [CITED: 03-CONTEXT.md D-14]

Implementation contract for `rateLimiter.ts`:
- `tokenHashOf(token: string): string` — `createHash('sha256').update(token).digest('hex').slice(0, 8)`. Same 8-char prefix used in D-15 log format.
- `consume(hash: string): { allowed: boolean; retryAfter?: number }` — filters timestamps older than 10s; if count >= 10, returns `{ allowed: false, retryAfter: 1 }`; else pushes current timestamp and returns `{ allowed: true }`.
- `sweepOldTimestamps()` — removes entries with all timestamps older than 10s; call on a 60s interval shared with `cleanupExpired()`.

**Design note:** D-14 says "1 prepare/sec/token, 10-burst window." This means the window is 10 seconds wide with a cap of 10 requests — giving an effective sustained rate of 1/s. [ASSUMED interpretation]

### Pattern 4: REVIEW.md Finding Counts Parsing

**What:** Parse finding counts from a REVIEW.md file. Two formats observed:
1. YAML frontmatter `findings: { critical: N, warning: N, info: N }` — used in this repo's Phase 2 REVIEW.md [VERIFIED: read .planning/phases/02-spa-shell-pair-flow/02-REVIEW.md lines 59-64].
2. `<finding severity="...">` XML tags — the spec's `FindingSchema` format; may appear in narrative sections.

**Critical finding:** The actual REVIEW.md files in this codebase use **YAML frontmatter** for finding counts, NOT XML `<finding>` tags. The `<finding>` XML format appears to be the GSD workflow skill's embedded-finding format for inline code annotations, not the top-level REVIEW.md aggregate format. [VERIFIED: 02-REVIEW.md frontmatter + narrative sections]

**Implementation approach for `parseReviewFile(filePath)`:**
1. Try to read the file; return `null` if file absent.
2. Extract YAML frontmatter between `---` delimiters using a regex.
3. From frontmatter, extract `critical`, `warning`, `info` as integer scalars using simple key-value regexes (no yaml library needed; only 3 scalar fields).
4. Map: `critical` → `red`, `warning` → `yellow`, `info` → `green`.
5. Fallback: if no frontmatter found, scan full content for `<finding severity="...">` XML opening tags.

**Stage 1 vs Stage 2 identification:**
- Stage 1 artifact: `*-REVIEW.md` [VERIFIED: 02-REVIEW.md exists]
- Stage 2 artifact: `*-REVIEW-FIX.md` [VERIFIED: 02-REVIEW-FIX.md exists in same dir]
- `stage1.ran = true` if `*-REVIEW.md` exists in the latest phase dir.
- `stage2.ran = true` if `*-REVIEW-FIX.md` exists in the latest phase dir.
- Both files parsed independently with the same frontmatter logic.

**DB-AUDIT source:** The CONTEXT.md notes `dbAudit` findings come from `/cso` → `SECURITY.md`. The exact file name `*-SECURITY.md` is [ASSUMED]. If no security file is found in the phase dir, `dbAudit` returns null. Executor must verify the actual artifact name by reading the agenticapps-workflow skill before implementing.

[CITED: 03-CONTEXT.md D-08; VERIFIED: 02-REVIEW.md format]

### Pattern 5: VERIFICATION.md Must-Haves vs Evidence Parsing (D-04)

**What:** Count must_haves and evidence entries in the latest phase's VERIFICATION.md to determine phase status (Pending / In Progress / Complete).

**Format assumption:** VERIFICATION.md is a standard GSD artifact. Its exact format is [ASSUMED] because no VERIFICATION.md exists in this repo yet (Phase 1 and 2 did not create one — they used HUMAN-UAT.md instead). The format is defined by the GSD workflow skill.

**Before implementing `parseVerification()`, executor MUST:**
1. Read `.claude/skills/agenticapps-workflow/skill/SKILL.md` for VERIFICATION.md format.
2. Check `.claude/skills/agenticapps-workflow/skill/rules/*.md` for verification rules.
3. If no format is documented, look at template files in the skill directory.

**Provisional approach (to be confirmed by executor):**
- Must-haves: lines containing `- **` in a must_haves section (bold bullet items).
- Evidence: lines containing `**Evidence` (bold "Evidence:" heading following each must_have).
- Phase Complete if `evidence >= mustHaves > 0`.
- Phase In Progress if `mustHaves > 0 && evidence < mustHaves` OR VERIFICATION.md is absent.
- Phase Pending if no `*-PLAN.md` exists in the phase directory.

[CITED: 03-CONTEXT.md D-04; ASSUMED for exact format]

### Pattern 6: TDD Red/Green Pair Detection from git log

**What:** Count completed TDD red/green pairs from commit subjects. Uses `execa` in argv-array form (existing subprocess discipline from registry.ts).

**Implementation contract for `parseTddPairs(root: string)`:**
- Run: `git log --format=%s --no-merges` in the project root via execa.
- Count subjects matching `/\bRED\b/i` → `totalTasks`.
- Count subjects matching `/\bGREEN\b/i` → `greenPairs`.
- Return `{ greenPairs, totalTasks }` or `{ greenPairs: 0, totalTasks: 0 }` on error.
- Use `GIT_SUBPROCESS_TIMEOUT_MS` from constants.ts (currently 5000ms) [VERIFIED: constants.ts].
- Use `stdio: ['ignore', 'pipe', 'ignore'], reject: false` same as `detectLastCommitAt()` in registry.ts [VERIFIED].

**Scope note:** This counts all commits in the project's git history, not per-phase. For the home-page overview card, this is a reasonable approximation. Phase 4's `ExecutionTimeline` panel will implement phase-scoped parsing. [ASSUMED for scope]

### Pattern 7: Branch Detection

**What:** Detect current git branch. Same pattern as `detectLastCommitAt()` in registry.ts.

Run: `git symbolic-ref --short HEAD` via execa. Return stdout trimmed, or null on error/empty output.

[CITED: 03-CONTEXT.md D-04; VERIFIED: execa pattern in packages/agent/src/lib/registry.ts]

### Pattern 8: Marker Detection (D-30)

**What:** Detect whether a path has gitRepo, .planning/, or .claudeSkills markers.

Uses only `existsSync` (no subprocess):
- `gitRepo`: `existsSync(join(root, '.git'))`
- `planning`: `existsSync(join(root, '.planning'))`
- `claudeSkills`: `existsSync(join(root, '.claude', 'skills'))`

Matches Phase 1 D-08's marker definition for `register --auto`. [CITED: 01-CONTEXT.md D-08]

### Pattern 9: TanStack Query — N Independent useQuery Calls (D-01)

**What:** Home page issues one `useQuery` for the registry list and N `useQuery` calls (one per project ID) for overviews. D-01 mandates independent calls (not `useQueries()`) for per-card freshness/error isolation.

**Note:** `useQueries()` IS available in TanStack Query v5 [VERIFIED: exported from installed @tanstack/react-query@5.100.9], but D-01 explicitly chose N independent `useQuery` calls. Do not use `useQueries()` for the overview fan-out.

Hook contracts:

```
useRegistryList() → useQuery({
  queryKey: ['registry'],
  queryFn: () => apiFetch('/api/registry', RegistryListResponseSchema),
  staleTime: 5_000,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,  // D-03
})

useProjectOverview(id: string) → useQuery({
  queryKey: ['overview', id],
  queryFn: () => apiFetch(`/api/projects/${id}/overview`, ProjectOverviewSchema),
  staleTime: 5_000,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,  // D-03
})
```

**`dataUpdatedAt` for timestamps (D-05):** Each query result has `.dataUpdatedAt: number` (ms since epoch). Global header uses `Math.min(...cardQueryResults.map(q => q.dataUpdatedAt))`. Per-card footer uses that card query's `dataUpdatedAt`. [VERIFIED: TanStack Query v5 exposes `dataUpdatedAt` on UseQueryResult]

**401 cascade:** The existing QueryCache `onError` interceptor in queryClient.ts fires on ALL queries globally [VERIFIED: queryClient.ts line 9-15]. Per-card overview queries that throw `ApiError(401)` will trigger `RepairBanner` via the same interceptor. No per-query setup needed.

[CITED: 03-CONTEXT.md D-01, D-03, D-05; VERIFIED: queryClient.ts]

### Pattern 10: Optimistic Update on Register-Confirm (D-25)

**What:** On 201 from `/register-confirm`, immediately push the new entry into the `['registry']` query cache AND invalidate to trigger background refetch.

Mutation `onSuccess` contract:
- `queryClient.setQueryData(['registry'], (old) => [...(old ?? []), newEntryWithDefaultStatus])` — card appears within ~16ms.
- `queryClient.invalidateQueries({ queryKey: ['registry'] })` — background reconcile within ~500ms corrects status fields.

Same optimistic pattern applies to rename/tag/unregister: update the cached list immediately, then invalidate for server reconciliation. Rollback on 5xx: planner discretion; refetch reconciliation is acceptable (D-25 note).

[CITED: 03-CONTEXT.md D-25]

### Pattern 11: Native `<dialog>` for Modal + Palette (D-26, D-32)

**What:** Both `<RegisterModal>` and `<CommandPalette>` use the native `<dialog>` element opened via `.showModal()`. Required for `::backdrop` pseudo-element and built-in accessibility semantics.

Key behaviors:
- `.showModal()` traps focus to the dialog's descendants automatically in most browsers. Manual focus trap supplements for custom Tab cycling.
- `::backdrop` styled via CSS: `rgba(0,0,0,0.6)` [CITED: 03-UI-SPEC.md RegisterModal chrome].
- Backdrop click detected via `onClick` on `<dialog>` where `event.target === dialogRef.current`.
- Esc fires `cancel` event → must `preventDefault()` to intercept for dirty-state check (D-26).
- `onCancel={(e) => { e.preventDefault(); handleDirtyClose() }}` on the dialog element.
- `onClose` fires after `.close()` is called — use for focus restoration.

**Focus trap (manual supplement):**
- On open: call `dialogRef.current.showModal()` then focus the first interactive child.
- On Tab: if focus is on last focusable descendant, wrap to first. On Shift+Tab from first, wrap to last.
- Enumerate focusable children with: `querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')`.
- No external focus-trap library per D-32.

**Focus restoration on close:**
- Capture `document.activeElement` before calling `.showModal()`.
- After modal closes, call `previouslyFocused?.focus()`.

[CITED: 03-UI-SPEC.md RegisterModal chrome; WAI-ARIA dialog pattern ASSUMED]

### Pattern 12: Accessible Context Menu (D-23)

**What:** `role="menu"` portal, roving tabindex, first item focused on open, Esc returns focus to trigger.

Implementation contract for `<CardContextMenu>`:
- Mount via `createPortal(menu, document.body)` to escape card stacking context [CITED: 03-UI-SPEC.md CardContextMenu chrome].
- Position at pointer coords (right-click) or kebab button `getBoundingClientRect()` bottom-left (keyboard/touch).
- Apply viewport bounds-check so menu never overflows right or bottom.
- ARIA: `role="menu"` on container; `role="menuitem"` on each button; `aria-haspopup="menu"` on kebab trigger.
- Roving tabindex: `tabIndex={0}` on focused item, `tabIndex={-1}` on others.
- ArrowDown/Up moves focus; wraps at ends.
- Enter/Space activates focused item.
- Esc closes and returns focus to trigger.
- Tab closes (focus leaves menu).
- Dismiss on click-outside: `mousedown` event on `window`, check if target is outside menu.

**Right-click interception:**
- `onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openContextMenu(e.clientX, e.clientY) }}` on the card's `<button>`.

**Long-press interception:**
- `pointerdown` starts a 500ms timer; `pointerup` / `pointermove` (> 8px threshold) / `pointercancel` cancels.
- On timer fire: open context menu. Stop propagation to prevent card navigate.

**Kebab button:**
- `onClick={(e) => { e.stopPropagation(); openContextMenuAtElement(kebabRef.current) }}`.
- Z-index: `z-10` on button, `z-50` on context menu portal.

[CITED: 03-UI-SPEC.md CardContextMenu; WAI-ARIA menu pattern ASSUMED]

### Pattern 13: Hover-Expand Cards with Tailwind v4 group (D-34, D-35, D-43)

**What:** Expanded section transitions on `group-hover` and `group-focus-within`. 120ms ease-out expand; 100ms ease-in collapse.

Card container: `<button type="button" className="group relative flex flex-col gap-2 ...">`.

Expanded section wrapper:
```
className="overflow-hidden max-h-0 opacity-0
  motion-safe:transition-[max-height,opacity]
  motion-safe:duration-120 ease-out
  group-hover:max-h-[160px] group-hover:opacity-100
  group-focus-within:max-h-[160px] group-focus-within:opacity-100"
```

`prefers-reduced-motion: reduce` is handled by `motion-safe:` prefix: transition snaps instantly. [CITED: 03-UI-SPEC.md Motion table]

**Grid layout to avoid layout shift:**
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- Cards do NOT have `overflow: hidden` at the grid-cell level [CITED: 03-UI-SPEC.md Card grid note].
- No masonry; natural `grid-rows: auto` lets row height adapt to the tallest expanded card.
- This means expanding one card grows the entire grid row — acceptable, as expansion is temporary (hover only).

### Pattern 14: Pointer Events Long-Press Helper (D-23)

Implementation contract for `touchLongPress.ts`:

`useLongPress(onLongPress: () => void, delay = 500)` returns event handlers `{ onPointerDown, onPointerUp, onPointerMove, onPointerCancel }`.

- `onPointerDown`: record start position; start `setTimeout(onLongPress, delay)`.
- `onPointerMove`: if moved > 8px from start, clear timer.
- `onPointerUp` / `onPointerCancel`: clear timer.
- No visual feedback during press accumulation (D-43 no-animation rule).
- Accessible fallback: kebab button provides the same actions via keyboard/click. [CITED: 03-UI-SPEC.md Accessibility — long-press]

### Pattern 15: Command Palette WAI-ARIA Listbox (D-32)

**What:** `<dialog>` wrapping a search input + `role="listbox"` action list. `aria-activedescendant` on the input tracks keyboard-focused row.

Key ARIA contract:
- Input: `type="search"`, `aria-owns="palette-listbox"`, `aria-activedescendant="palette-option-{focusedIndex}"` (or undefined when no row focused).
- List: `<ul id="palette-listbox" role="listbox" aria-label="Actions">`.
- Each row: `<li role="option" id="palette-option-{i}" aria-selected={i === focusedIndex}>`.

Keyboard navigation:
- ArrowDown/Up: update `focusedIndex` state; wraps at ends.
- Enter: execute action at `focusedIndex`.
- Esc: close palette; restore focus to pre-open element.
- Tab: close palette.
- On open: focus moves to the search input (not to a row); focusedIndex starts at 0 (first row pre-highlighted).

**Global key handler for Cmd/Ctrl+K:**
- Mounted once in `AppShell` via `useEffect(() => { window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [])`.
- Handler: `if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openPalette() }`.
- Capture `document.activeElement` before `.showModal()` for restoration on close.

**Fuzzy filter:** Lower-cased substring match on action label + project name. No library. Empty filter shows all actions. Zero results shows single non-interactive row "No actions found. Try a shorter search." [CITED: 03-UI-SPEC.md CommandPalette; WAI-ARIA listbox ASSUMED]

### Pattern 16: Client-Side Filter + Sort (D-38, D-39, D-40)

**What:** `useMemo` derived state over the cached registry list. No server params.

Filter chain:
1. If selected chips not empty and not just 'all': keep items where `tags` intersects selected chips (OR across chips).
2. If searchText not empty: keep items where `name || client || tags.join(' ') || currentPhase` includes lowercased searchText (AND with chip result).
3. Sort result using sort key.

Tag priority sort (D-40 Recommended default):
- Priority map: `active: 0, client: 1, internal: 2, <other>: 3`.
- Item's effective priority = minimum priority across its tags.
- Primary key: tag priority ascending.
- Secondary key: `lastCommitAt` descending (null sorts last).
- Unreachable always last within any bucket regardless of other sort keys [CITED: 03-CONTEXT.md D-06, D-40].

Overflow chips (D-38): `allTags = union of all tags in registryItems`. Remove `['all', 'active', 'client', 'internal']`. Each remaining tag becomes a chip with `(N)` count where N = projects with that tag.

[CITED: 03-CONTEXT.md D-38, D-39, D-40]

### Pattern 17: apiFetch D-12 Enforcement

Add runtime guard to `packages/spa/src/lib/api.ts` `apiFetch()`:

```
if (path === '/api/registry/register') {
  throw new Error(
    'SPA must use /api/registry/register-prepare and /api/registry/register-confirm. ' +
    'Direct /api/registry/register is CLI-only (D-12).'
  )
}
```

Also add ESLint rule or comment-based lint annotation in `api.ts` to surface this at lint time. [CITED: 03-CONTEXT.md D-12]

### Pattern 18: AppShell max-w Override for Home Route (Pitfall 8)

The `<AppShell>` `<main>` has `max-w-3xl` hardcoded [VERIFIED: AppShell.tsx line 19]. The home page needs `max-w-5xl` for a three-column card grid.

Recommended approach: Pass a `mainClassName` prop to `AppShell`, defaulting to `max-w-3xl`. The home route's layout component passes `max-w-5xl`. Alternatively, render a `HomeLayout` wrapper inside the `<Outlet>` that overrides the constraint with a negative margin or full-width container. The planner picks the approach that requires the fewest changes to `AppShell`.

[CITED: 03-UI-SPEC.md MultiProjectHome layout note]

### Pattern 19: ProjectOverviewSchema (shared/src/schemas/overview.ts)

```
ProjectOverviewSchema shape (D-08):
{
  phaseStatus: 'Pending' | 'In Progress' | 'Complete',
  stage1: { ran: boolean, findings: { red, yellow, green } } | null,
  stage2: { ran: boolean, findings: { red, yellow, green } } | null,
  dbAudit: { findings: { critical, high, medium, low } } | null,
  tdd: { greenPairs, totalTasks } | null,
  verification: { evidence, mustHaves } | null,
  branch: string | null,
  markers: { gitRepo: boolean, planning: boolean, claudeSkills: boolean },
}
```

All counts are `z.number().int().nonnegative()`. The `null` values on sub-objects signal "source file absent" — SPA renders compact placeholders. [CITED: 03-CONTEXT.md D-08]

### Pattern 20: RegisterPrepareResponseSchema Union

Three-way union covering allowed / blocked / alreadyRegistered shapes (D-11, D-17):
- Use `z.union([allowedSchema, blockedSchema, alreadyRegisteredSchema])` rather than `z.discriminatedUnion` because no single field discriminates all three shapes.
- `allowedSchema`: has `blocked: false`, `alreadyRegistered: false`, `nonce: z.string().length(32)`, `expiresAt: z.number()`.
- `blockedSchema`: has `blocked: true`, `blockedReason: z.string()`.
- `alreadyRegisteredSchema`: has `alreadyRegistered: true`, `existingEntry: RegistryEntrySchema`.

[CITED: 03-CONTEXT.md D-11, D-17]

### Anti-Patterns to Avoid

- **Skeleton shimmer loading:** Use static `—` em-dash in `text-[--text-muted]`. No shimmer. (D-42)
- **`rotate`, `scale`, `glow` animations:** Only `opacity` + `max-height` transitions. (D-43)
- **`useQueries()` for overview fan-out:** D-01 mandates N independent `useQuery` calls.
- **Auto-retry on 401:** `retry: false` is locked in queryClient. Do not override per-query.
- **`<dialog open>` attribute:** Must use `.showModal()` imperative API for `::backdrop` + modal role.
- **Calling `outbound()` inside `errorHandler`:** Infinite recursion on Zod failure (documented in errors.ts comments).
- **`py-1.5` or `px-2.5`:** No `*.5` Tailwind utilities; minimum touch targets require `py-2` / `px-3`. (03-UI-SPEC.md)
- **`text-xs` (12px):** No 5th font size; minimum is Label (14px / `text-sm`). (03-UI-SPEC.md Typography)
- **`fixed` position for context menu:** Use `createPortal(menu, document.body)` to escape card stacking contexts.
- **SPA calling `/api/registry/register` directly:** Blocked by D-12. SPA uses prepare/confirm only.
- **Gradients, glow, hero illustrations:** Anti-AI-slop rules inherited from Phase 2 D-01.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nonce entropy | Custom generator | `crypto.randomBytes(16).toString('hex')` | Node built-in CSPRNG; already used in atomicWrite.ts |
| Nonce TTL sweep | Custom timer framework | `setInterval(cleanupExpired, 60_000)` in module init | No new primitives; same lazy pattern as overviewCache |
| Rate limiter | External library | Hand-rolled `Map<hash, timestamps[]>` | Library would add native dep; logic is ~25 lines; D-14 specifies exact parameters |
| YAML frontmatter parsing | `js-yaml` / `gray-matter` | Inline key-value regex (3 scalar fields only) | No new dep; no library needed for `critical:`, `warning:`, `info:` |
| Focus trap | `focus-trap` / `@radix-ui/react-focus-scope` | Manual `querySelectorAll` + Tab key handler | No library per D-32; pattern is ~30 lines |
| Command palette | `cmdk` library | Purpose-built `<CommandPalette>` | D-32 explicitly prohibits external command-palette dep |
| Fuzzy search | `fuse.js` / `minisearch` | Lower-cased substring match | No new SPA deps; <100 actions is not a performance problem |
| Shared schemas | Separate Zod definitions in daemon and SPA | `packages/shared/src/schemas/` | Phase 0 D-06 invariant |

---

## Runtime State Inventory

> Phase 3 adds new daemon-side in-process state but no filesystem renames, registry schema changes, or stored-data migrations.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.agenticapps/dashboard/registry.json` — existing entries unchanged; no new fields added to storage schema | None — Phase 3 only changes the API response layer, not the registry.json storage format |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | None — no package renames | None |

**Nothing found requiring data migration.** Phase 3 adds new API endpoints and in-process state (nonce map, rate limiter map, overview cache) that live in daemon heap memory and reset on restart. [VERIFIED: 03-CONTEXT.md code_context section]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20 | All daemon code | Yes | v24.15.0 [VERIFIED] | — |
| pnpm | Workspace | Yes | 10.33.2 [VERIFIED] | — |
| git CLI | projectOverview.ts branch + TDD detection | [ASSUMED available] | — | Returns `null` for branch/TDD fields; card shows `—` |
| `node:crypto` | Nonce + tokenHash generation | Yes | Node 20 built-in [VERIFIED: atomicWrite.ts] | — |
| `@tanstack/react-query` v5 | SPA polling hooks | Yes | 5.100.9 [VERIFIED] | — |
| `lucide-react` | Card icons | Yes | ^1.14.0 [VERIFIED] | — |
| `<dialog>` native element | RegisterModal, CommandPalette | [ASSUMED: all modern target browsers] | — | — |
| Pointer Events API | Long-press detection | [ASSUMED: all modern browsers] | — | Kebab button is accessible fallback (D-23) |

**Missing dependencies with no fallback:** None.

---

## Common Pitfalls

### Pitfall 1: REVIEW.md Format Assumption

**What goes wrong:** Code expects `<finding severity="...">` XML tags but actual REVIEW.md files in this repo use YAML frontmatter `findings:` block.
**Why it happens:** Spec's `FindingSchema` describes XML format; real review artifacts use YAML frontmatter.
**How to avoid:** Parse YAML frontmatter first; fall back to `<finding>` regex. Executor MUST read a current REVIEW.md before writing `parseReviewFile()`. [VERIFIED: 02-REVIEW.md lines 59-64]
**Warning signs:** `stage1.findings` always returns `{ red: 0, yellow: 0, green: 0 }` even for phases that ran review.

### Pitfall 2: Right-Click Opens Context Menu AND Navigates Card

**What goes wrong:** `contextmenu` event fires; context menu opens; then `click` event fires; card navigates to `/projects/{id}`.
**Why it happens:** `onContextMenu` prevents default (suppresses native menu) but doesn't stop the `click` event on some browser/OS combos.
**How to avoid:** In `onContextMenu`: call `e.preventDefault()` AND `e.stopPropagation()`. In long-press handler: after timer fires, set a flag so the next `pointerup` / `click` on the card is a no-op for 50ms.
**Warning signs:** Navigating to `/projects/{id}` when right-clicking a card.

### Pitfall 3: Nonce Map Memory Leak

**What goes wrong:** Abandoned nonces (modal closed, user never confirmed) accumulate in the Map until daemon restarts.
**Why it happens:** 5-min TTL × many prepare calls.
**How to avoid:** `setInterval(cleanupExpired, 60_000)` at `registerNonces.ts` module initialization. Also sweep if map size > 100 entries in `issueNonce()`.
**Warning signs:** Daemon RSS grows proportionally with prepare calls over days.

### Pitfall 4: 401 Interceptor Not Firing for Overview Queries

**What goes wrong:** Per-card overview queries fail with 401 but `RepairBanner` never appears.
**Why it happens:** If the overview query's `queryFn` catches the `ApiError(401)` internally rather than re-throwing, the QueryCache `onError` handler never sees it.
**How to avoid:** Ensure `useProjectOverview(id)` wraps `apiFetch` and does NOT catch errors — let them bubble to the QueryCache. The existing `apiFetch` already throws `ApiError(401)` correctly [VERIFIED: api.ts line 84]. Don't add a try/catch around `apiFetch` in the query functions.
**Warning signs:** 401 visible in DevTools but RepairBanner absent.

### Pitfall 5: max-height Clips Expanded Content

**What goes wrong:** Expanded section has rows that exceed `max-h-[160px]` and are clipped.
**Why it happens:** 5 extra rows at Label size with gaps can exceed 160px on some font scales or when branch names are long.
**How to avoid:** Use `max-h-[200px]` as the generous upper bound. The overflow is clipped by `overflow-hidden` on the wrapper. Test with actual data.
**Warning signs:** Branch row or DB-AUDIT row is cut off in expanded state.

### Pitfall 6: Esc Closes `<dialog>` Before Dirty-State Check (D-26)

**What goes wrong:** User presses Esc; browser fires `cancel` event → dialog closes immediately, bypassing "Discard changes?" banner.
**Why it happens:** Native `<dialog>` behavior: `cancel` event fires on Esc → dialog closes unless prevented.
**How to avoid:** Attach `onCancel={(e) => { e.preventDefault(); checkDirtyStateAndMaybeClose() }}` to the `<dialog>` element. Call `dialogRef.current.close()` programmatically only after dirty-state resolution.
**Warning signs:** Modal closes on Esc without showing "Discard changes?" when fields have been modified.

### Pitfall 7: `outbound()` Recursion in Error Handler

**What goes wrong:** Calling `outbound()` from inside `errorHandler` causes infinite recursion when Zod error occurs in the error path.
**Why it happens:** `outbound()` calls `Schema.parse()` which can throw ZodError, triggering `errorHandler`, which calls `outbound()`...
**How to avoid:** The existing `errorHandler` in `errors.ts` already avoids this [VERIFIED: errors.ts inline comment]. All new routes must use `outbound()` only from success paths. Error paths use direct `c.json(...)`.
**Warning signs:** Stack overflow or unhandled exception on schema drift in daemon routes.

### Pitfall 8: AppShell max-w-3xl Constrains Card Grid

**What goes wrong:** Card grid renders too narrow (max 768px) to show three columns on 1280px viewport.
**Why it happens:** `<AppShell>`'s `<main>` has `max-w-3xl` hardcoded [VERIFIED: AppShell.tsx line 19].
**How to avoid:** Implement the max-width override for the home route (Pattern 18). Do this in Wave 2 before implementing `<MultiProjectHome>`.
**Warning signs:** Card grid shows at most 2 columns at 1280px viewport.

### Pitfall 9: Theme Desync (WR-01 from Phase 2 Review)

**What goes wrong:** CommandPalette "Toggle theme" action fires but `<ThemeChip>` in Header doesn't update.
**Why it happens:** Phase 2 left `useTheme()` as per-component `useState` — WR-01 was non-blocking but unfixed [VERIFIED: 02-REVIEW.md WR-01].
**How to avoid:** Fix WR-01 in Wave 0: migrate `useTheme()` to `useSyncExternalStore` over a custom event bus. Phase 2 REVIEW already provided the fix code [CITED: 02-REVIEW.md lines 100-113]. This must be done before implementing the CommandPalette theme action.
**Warning signs:** Toggling theme in CommandPalette or `/settings` doesn't update `<ThemeChip>` in the header.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `useQuery` for all projects at once | N independent `useQuery` calls per project (D-01) | Phase 3 design | Per-card freshness, per-card error isolation |
| `<dialog open>` attribute | `.showModal()` imperative API | HTML standard evolution | Required for `::backdrop` + proper modal role |
| External focus-trap libraries | Manual `querySelectorAll` + keyboard handler | Phase 3 design (no new deps) | Fewer deps, more control |
| Per-component `useState` for theme | `useSyncExternalStore` (WR-01 fix) | Phase 3 Wave 0 | All theme consumers stay in sync |
| Stale-while-revalidate only | `refetchInterval: 5_000` polling | Phase 3 spec | Dashboard requires live data |
| Direct `POST /register` from SPA | `POST /register-prepare` + `POST /register-confirm` nonce flow | Phase 3 D-09 | Confused-deputy defense |

**Deprecated/outdated in this project context:**
- `POST /api/registry/register` from SPA (D-12): SPA must use prepare/confirm. CLI keeps the direct route.
- Phase 2's index route stub: fully replaced by `<MultiProjectHome />`.

---

## Assumptions Log

> Claims tagged `[ASSUMED]` throughout this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VERIFICATION.md uses `- **` for must-haves and `**Evidence` for evidence | Pattern 5 | Parsing returns wrong counts; phase status wrong. Executor must read the workflow skill format before implementing. |
| A2 | DB-AUDIT source file is `*-SECURITY.md` in the latest phase dir | Pattern 4 | `dbAudit` always null if file name differs. Low impact: card shows absence state. |
| A3 | TDD RED/GREEN detection scans all git history (not per-phase) | Pattern 6 | Home card shows lifetime TDD count, not current-phase count. Acceptable for v1. |
| A4 | `<dialog>.showModal()` is supported in target user browsers (modern Chromium/Safari/FF) | Pattern 11 | `showModal()` throws on very old Safari (<15.4). Risk: low (developer tooling). |
| A5 | Stage 2 review artifact is `*-REVIEW-FIX.md` in the phase dir | Pattern 4 | Stage 2 detection fails for projects using different naming. Low impact: stage2.ran = false. |
| A6 | git CLI is available on the daemon host machine | Pattern 7 | Branch and TDD fields return null; card shows `—`. Acceptable fallback. |
| A7 | WR-01 theme desync bug is unfixed at Phase 3 start | Pitfall 9 | If already fixed, Wave 0 WR-01 fix task is a no-op. No harm. |
| A8 | Rate limiter window = 10 seconds with cap of 10 requests (giving ~1/s sustained rate) | Pattern 3 | If wrong interpretation of "1/s soft cap, 10-burst", rate limit behavior differs. CONTEXT.md D-14 is the authority. |
| A9 | `overviewCache` does not need a background sweeper for the v1 scale (~5-50 projects) | Pattern 1 | Memory growth is bounded by registry size; stale entries are replaced on miss. Planner can add sweeper if needed. |

---

## Open Questions

1. **VERIFICATION.md exact format**
   - What we know: D-04 describes heuristic abstractly. No VERIFICATION.md exists in this repo yet.
   - What's unclear: Exact bullet/heading format for must_haves and evidence entries.
   - Recommendation: Executor reads `.claude/skills/agenticapps-workflow/skill/` for VERIFICATION.md template before implementing `parseVerification()`. Wave 0 pre-implementation check.

2. **DB-AUDIT source artifact name**
   - What we know: `dbAudit` is in the schema (D-08). CONTEXT.md says `/cso` produces `SECURITY.md`.
   - What's unclear: Whether db-sentinel has its own artifact, or if DB-AUDIT findings are embedded in SECURITY.md.
   - Recommendation: Executor searches the workflow skill for the database-sentinel output format. If unclear, ship `dbAudit: null` for all projects in v1 and make it a Phase 4 enhancement.

3. **Command palette scope decision**
   - What we know: D-32 flags ~1 day UI work. CONTEXT.md says planner should consider splitting to own plan.
   - What's unclear: Whether palette ships in Phase 3 or slides to Phase 6.
   - Recommendation: Plan as standalone Plan 03-N (last wave). If phase estimate > 3 sessions total, move to Phase 6 POLISH-01 scope.

4. **WR-01 fix ownership**
   - What we know: Phase 2 REVIEW flagged theme desync (WR-01). Phase 3 adds CommandPalette as a third theme consumer.
   - What's unclear: Whether WR-01 was addressed between Phase 2 merge and Phase 3 start.
   - Recommendation: Planner includes WR-01 fix as Phase 3 Wave 0 task. Phase 2 REVIEW already provided the `useSyncExternalStore` fix code.

---

## Validation Architecture

> `workflow.nyquist_validation = true` [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.5 [VERIFIED: pnpm catalog] |
| Config files | `packages/agent/vitest.config.ts` (daemon); `packages/spa/vitest.config.ts` (SPA); `packages/spa/vitest.subprocess.config.ts` (subprocess) |
| Quick run (daemon) | `pnpm --filter @agenticapps/dashboard-agent test` |
| Quick run (SPA) | `pnpm --filter @agenticapps/dashboard-spa test` |
| Full suite | `pnpm -r test && pnpm lint && pnpm -r typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-01 | `GET /api/registry` returns correct RegistryListResponse shape | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-02 | `GET /api/projects/{id}/overview` returns ProjectOverview shape | in-process Hono | agent test — `routes/overview.test.ts` | ❌ Wave 0 |
| HOME-02 | `readOverview()` parses REVIEW.md frontmatter findings | unit | agent test — `lib/projectOverview.test.ts` | ❌ Wave 0 |
| HOME-02 | `readOverview()` computes phase status: Pending / In Progress / Complete | unit | agent test — `lib/projectOverview.test.ts` | ❌ Wave 0 |
| HOME-02 | `overviewCache` hit / miss / stale-TTL behavior | unit | agent test — `lib/overviewCache.test.ts` | ❌ Wave 0 |
| HOME-02 | `registerNonces` TTL expiry + single-use + second-confirm → null | unit | agent test — `lib/registerNonces.test.ts` | ❌ Wave 0 |
| HOME-02 | `rateLimiter` 10-burst cap → 429 response | unit | agent test — `lib/rateLimiter.test.ts` | ❌ Wave 0 |
| HOME-03 | `<ProjectCard>` shows static `—` while overview in-flight (`aria-busy`) | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| HOME-03 | `<ProjectCard>` shows `⚠ overview unavailable · retrying` on 5xx | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| HOME-03 | `<ProjectCard>` replaces body with `<SchemaDriftState>` on drift | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| HOME-03 | `<ProjectCard>` unreachable: `opacity-60` + danger badge + sorted last | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| HOME-03 | `<Header>` shows "N projects · last refresh Ns ago" | component | SPA test — `Header.test.tsx` (extend) | ❌ Wave 0 (extend) |
| HOME-04 | Filter chips OR: selecting `active` hides `internal`-only projects | unit | SPA test — `lib/registry.test.ts` | ❌ Wave 0 |
| HOME-04 | Search AND chips: "acme" + `client` chip active filters correctly | unit | SPA test — `lib/registry.test.ts` | ❌ Wave 0 |
| HOME-04 | `<HomeToolbar>` multi-chip select + `all` chip deselects others | component | SPA test — `HomeToolbar.test.tsx` | ❌ Wave 0 |
| HOME-05 | Sort Recommended: `active` < `client` < `internal` priority ordering | unit | SPA test — `lib/registry.test.ts` | ❌ Wave 0 |
| HOME-05 | Unreachable projects sort last regardless of key | unit | SPA test — `lib/registry.test.ts` | ❌ Wave 0 |
| HOME-06 | `POST /register-prepare` allowed → 200 with nonce (32-char hex) | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-prepare` blocked → 200 `blocked: true`, no nonce | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-prepare` already-registered → 200 `alreadyRegistered: true` | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-prepare` 10+1 calls → 429 `Retry-After: 1` | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-confirm` valid nonce → 201 + project in registry | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-confirm` expired nonce → 410 Gone | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `POST /register-confirm` second confirm with same nonce → 410 (single-use) | in-process Hono | agent test — `routes/registry.test.ts` | ❌ Wave 0 (extend) |
| HOME-06 | `<RegisterModal>` Step 1 → Step 2 transition on successful prepare | component | SPA test — `RegisterModal.test.tsx` | ❌ Wave 0 |
| HOME-06 | `<RegisterModal>` blocked: Confirm disabled + red banner | component | SPA test — `RegisterModal.test.tsx` | ❌ Wave 0 |
| HOME-06 | `<RegisterModal>` Esc with dirty state shows inline "Discard changes?" | component | SPA test — `RegisterModal.test.tsx` | ❌ Wave 0 |
| HOME-06 | `<RegisterModal>` 410 response triggers auto re-prepare | component | SPA test — `RegisterModal.test.tsx` | ❌ Wave 0 |
| HOME-06 | Optimistic add: new card in grid within same render tick after 201 | subprocess | `pnpm --filter @agenticapps/dashboard-spa test:subprocess` | ❌ Wave 0 |
| INV-04 | Schema drift in overview surfaces as card-level `<SchemaDriftState>` | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| D-12 | `apiFetch('/api/registry/register', ...)` throws runtime error | unit | SPA test — `lib/api.test.ts` (extend) | ❌ Wave 0 (extend) |
| D-23 | `<CardContextMenu>` Esc closes + focus returns to kebab trigger | component | SPA test — `CardContextMenu.test.tsx` | ❌ Wave 0 |
| D-23 | `<CardContextMenu>` Unregister shows inline confirm inside menu | component | SPA test — `CardContextMenu.test.tsx` | ❌ Wave 0 |
| D-25 | Rename mutation: card name updates before server refetch | component | SPA test — `MultiProjectHome.test.tsx` | ❌ Wave 0 |
| D-32 | `<CommandPalette>` opens on Cmd/Ctrl+K; Esc closes | component | SPA test — `CommandPalette.test.tsx` | ❌ Wave 0 |
| D-32 | `<CommandPalette>` substring filter narrows action rows | component | SPA test — `CommandPalette.test.tsx` | ❌ Wave 0 |
| D-34 | Finding glyph `<span>` has `aria-hidden="true"`; containing span has `aria-label` | component | SPA test — `ProjectCard.test.tsx` | ❌ Wave 0 |
| D-38 | Overflow chips include user tags with `(N)` count suffix | unit | SPA test — `lib/registry.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test` OR `pnpm --filter @agenticapps/dashboard-spa test` (whichever package the task touches).
- **Per wave merge:** `pnpm -r test && pnpm lint && pnpm -r typecheck`.
- **Phase gate:** `pnpm -r test && pnpm lint && pnpm -r typecheck && pnpm -r build` — all green before `/gsd-verify-work`.

### Wave 0 Gaps (test files to create before implementation)

**Daemon (packages/agent/src/):**
- [ ] `lib/projectOverview.test.ts` — HOME-02 filesystem parsing, D-04 phase status heuristic
- [ ] `lib/overviewCache.test.ts` — D-02 cache TTL, hit/miss/stale
- [ ] `lib/registerNonces.test.ts` — D-10 nonce TTL, single-use, cleanup
- [ ] `lib/rateLimiter.test.ts` — D-14 burst cap, 429 response
- [ ] `routes/registry.test.ts` (extend existing) — HOME-06 prepare/confirm/rename/tags
- [ ] `routes/overview.test.ts` (new) — HOME-02 route + cache integration

**SPA (packages/spa/src/):**
- [ ] `components/ProjectCard.test.tsx` — HOME-03 loading/error/unreachable, D-34 accessibility
- [ ] `components/HomeToolbar.test.tsx` — HOME-04 chips + search
- [ ] `components/MultiProjectHome.test.tsx` — HOME-03 grid rendering, D-25 optimistic update
- [ ] `components/RegisterModal.test.tsx` — HOME-06 two-step flow, D-26 dirty state, D-27 blocked
- [ ] `components/RegisterButtonCard.test.tsx` — HOME-06 modal trigger
- [ ] `components/CardContextMenu.test.tsx` — D-23 keyboard nav, unregister confirm
- [ ] `components/CommandPalette.test.tsx` — D-32 keyboard trigger, filter, actions
- [ ] `lib/registry.test.ts` (new) — HOME-04/05 filter/sort logic, D-38 overflow chips
- [ ] `lib/api.test.ts` (extend) — D-12 runtime assert for `/register`
- [ ] `components/Header.test.tsx` (extend) — D-05 project count + refresh timestamp

**Subprocess:**
- [ ] `src/__tests__/register-optimistic.test.ts` — register-prepare → confirm → card appears within one render tick (acceptance criterion 4, D-25)

*(Framework install not needed — vitest and @testing-library/react already configured)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Bearer token middleware on every new route (existing Phase 1 middleware — no bypass) |
| V3 Session Management | Partial | Nonce TTL + single-use (D-10); bearer token already managed Phase 1 |
| V4 Access Control | Yes | `assertRegistrationAllowed()` blocklist on confirm (defense-in-depth); path allow-list on read routes unchanged |
| V5 Input Validation | Yes | `@hono/zod-validator` on all new request bodies: RegisterPrepare, RegisterConfirm, Rename, Tags |
| V6 Cryptography | Yes | `crypto.randomBytes(16)` for nonce (CSPRNG); `createHash('sha256')` for tokenHash (not for secrets, just for log anonymization) |

### Known Threat Patterns for Phase 3 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Confused-deputy path injection | Tampering | D-09 prepare/confirm nonce; `assertRegistrationAllowed()` runs on both prepare and confirm (defense-in-depth); SPA cannot call `/register` directly (D-12) |
| Nonce replay | Repudiation | Single-use: `consumeNonce()` deletes entry on first successful use (D-10) |
| Nonce expiry bypass | Elevation of privilege | `consumeNonce()` checks `expiresAt` server-side; SPA cannot extend TTL |
| Rate-limit hammering | Denial of Service | Sliding-window limiter on `/register-prepare` (D-14); 429 with Retry-After |
| Path traversal via register | Tampering | `fs.realpath()` + `assertRegistrationAllowed()` blocklist in both prepare and confirm; symlink defense from Phase 1 D-23 |
| Client-side filter bypass | Tampering | Filter is UX-only; access control enforced per-route by bearer auth; SPA cannot register arbitrary paths without prepare |
| blockedReason information leakage | Information Disclosure | blockedReason is intentionally user-visible (D-27); contains path info the user already supplied; non-issue at ASVS L1 |
| Optimistic cache poisoning | Tampering | Optimistic update uses server response body (201 data), not user-supplied data; refetch reconciles within <500ms |

### CSO Gate Requirements for Phase 3

Per global CLAUDE.md and 03-CONTEXT.md workflow contract, `/cso` is **mandatory** post-phase (new HTTP write routes). The CSO review must verify:

1. SPA cannot call `/api/registry/register` directly (D-12 lint rule + `apiFetch` runtime assert tested).
2. Nonce TTL enforced server-side; `consumeNonce()` checks `expiresAt` (no client-side trust).
3. `blockedReason` in SPA banner is verbatim from daemon — no client-side string construction.
4. Rate limiter returns 429 on cap; verified by `rateLimiter.test.ts` burst-cap test.
5. `assertRegistrationAllowed()` runs on `register-confirm` (defense-in-depth), not just on prepare.
6. All new routes pass through the existing bearer-token middleware (no bypass).
7. `renameProject` and `setTags` do not write to registered project filesystems (INV-01 compliance).

---

## Sources

### Primary (HIGH confidence — verified in this session)

- `.planning/phases/03-multi-project-home-page/03-CONTEXT.md` — All 44 D-XX decisions (authoritative input).
- `.planning/phases/03-multi-project-home-page/03-UI-SPEC.md` — Visual and interaction contract.
- `packages/agent/src/lib/registry.ts` — `slugify`, `canonicaliseRoot`, `assertRegistrationAllowed`, `addProject`, `execa` subprocess pattern, `GIT_SUBPROCESS_TIMEOUT_MS`.
- `packages/agent/src/lib/atomicWrite.ts` — `crypto.randomBytes` already imported; `O_NOFOLLOW` pattern.
- `packages/agent/src/server/middleware/errors.ts` — `outbound()` wrapper, recursion pitfall documented inline, `RegistrationPathBlocked` handling.
- `packages/spa/src/lib/api.ts` — `apiFetch`, `parseOrDrift`, `ApiError(401)` throw path.
- `packages/spa/src/lib/queryClient.ts` — `retry: false`, `staleTime: 5_000`, `QueryCache.onError` 401 interceptor.
- `packages/spa/src/components/AppShell.tsx` — `max-w-3xl` on `<main>` (Pitfall 8).
- `packages/spa/src/lib/repair.tsx` — `RepairBus`, `RepairProvider`, `useRepair`.
- `packages/shared/src/schemas/registry.ts` — `RegistryListItemSchema` exact shape; no `status` duplication needed.
- `packages/agent/src/constants.ts` — `GIT_SUBPROCESS_TIMEOUT_MS`, `CONFIG_DIR`, all constants.
- `pnpm-workspace.yaml` + root `package.json` catalog — all package versions.
- `packages/spa/node_modules/@tanstack/react-query` — `useQueries` confirmed exported.
- `.planning/phases/02-spa-shell-pair-flow/02-REVIEW.md` — REVIEW.md format (YAML frontmatter); WR-01 theme desync bug with fix code.
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`.
- `node --version` → v24.15.0; `pnpm --version` → 10.33.2.
- `packages/spa/src/routes/index.lazy.tsx` — confirmed current stub body to replace.
- `packages/spa/src/components/Header.tsx` — confirmed current Header structure to extend.

### Secondary (MEDIUM confidence)

- `docs/spec/dashboard-prompt.md` lines 422–461 — Home page layout mock and card composition.
- `docs/spec/dashboard-prompt.md` lines 290–352 — API surface contract.
- `docs/spec/dashboard-prompt.md` lines 548–554 — Visual style / anti-slop rules.
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — D-22 (no chokidar), D-23 (realpath allow-list), D-08 (marker definition).
- `.planning/phases/02-spa-shell-pair-flow/02-CONTEXT.md` — D-06/D-07 (401 handling), D-08/D-09 (schema drift).
- `.planning/REQUIREMENTS.md` — HOME-01..06 requirement text.
- WAI-ARIA dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ [CITED in 03-CONTEXT.md canonical refs]
- WAI-ARIA listbox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ [CITED in 03-CONTEXT.md canonical refs]

### Tertiary (LOW confidence / ASSUMED)

- VERIFICATION.md parsing patterns — no VERIFICATION.md exists in this repo yet.
- DB-AUDIT source artifact name — `*-SECURITY.md` assumed; executor must verify.
- TDD RED/GREEN git log scope (all history vs per-phase).
- `<dialog>.showModal()` browser support in user's environment.
- Rate limiter window interpretation (10s window, 10-burst cap).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from installed catalog and node_modules.
- Architecture patterns (existing): HIGH — derived from verified code.
- Architecture patterns (new parsing): MEDIUM — frontmatter format verified in one REVIEW.md; VERIFICATION.md format assumed.
- Pitfalls: HIGH — derived from actual Phase 2 code review findings + verified code analysis.
- Security: HIGH — derived from existing Phase 1 threat model + Phase 3 CONTEXT.md CSO requirements.

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable stack; main unknown is VERIFICATION.md format resolved in Wave 0)
