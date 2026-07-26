# Phase 3: Multi-project Home Page - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

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
- `/projects/{id}` three-column view content (DISC + PHASE) — Phase 4. Phase 3 ships only the route placeholder.
- Right column (HEALTH-01..05) — Phase 5.
- `install-launchd` / `install-systemd` (POLISH-02/03) — Phase 6.
- Keyboard shortcuts beyond Cmd/Ctrl+K (R refresh, ? help, / focus search) — Phase 6 (POLISH-01).
- `impeccable:critique` ≥ 90 hard gate — Phase 6 (POLISH-04). Phase 3 inherits Phase 2's anti-slop baseline + adds card-specific rules (D-39).
- `/settings/projects` standalone management sub-route — replaced for v1 by the in-card kebab/right-click context menu. Spec line 396's sub-route is held until Phase 6 polish if a separate management page proves useful.
- Sentry / Linear / Infisical panels — Phase 5 (HEALTH-05) and Phase 7+.
- Pagination / virtualisation — D-41 explicitly defers; revisit at 50+ projects.

</domain>

<decisions>
## Implementation Decisions

### Data flow + freshness lifecycle

- **D-01:** **List + per-card `/overview` fan-out.** SPA's home page issues one `GET /api/registry` query (returns id, name, root, client, tags, addedAt + light status) and N independent `useQuery` calls — one `GET /api/projects/{id}/overview` per registered project. Per-card freshness, per-card schema-drift isolation, partial failures don't stall the grid. Matches spec line 459 ("per-card data shows freshness").
- **D-02:** **Daemon-side 5 s memo per `/overview`.** Implements spec line 157's "computed at request time, cached 5s". A simple in-process `Map<projectId, { value: ProjectOverview, expiresAt: number }>` per route handler. Multiple SPA tabs polling at 5 s coalesce into one filesystem read. SPA's TanStack Query keeps its own `staleTime: 5_000` + `refetchInterval: 5_000`. The two layers are independent — SPA cache controls UI flicker; daemon cache controls filesystem load.
- **D-03:** **Pause polling when tab is hidden.** TanStack Query's `refetchIntervalInBackground: false` (default). On tab-visible, queries refetch immediately so the user sees fresh data within ~ms. Cadence stays at 5 s while visible.
- **D-04:** **Phase status derives from the highest-numbered phase dir + a filesystem heuristic.** `currentPhase` already returns the dirname (e.g. `02-spa-shell-pair-flow`). Status:
  - `Pending`: no `*-PLAN.md` files in the phase dir.
  - `In Progress`: `*-PLAN.md` exists AND (`*-VERIFICATION.md` absent OR present with at least one missing must_have evidence).
  - `Complete`: `*-VERIFICATION.md` present AND every must_have has a corresponding evidence entry.
  - Pure-function over filesystem; no schema invention; no GSD scribbles required.
- **D-05:** **Per-card timestamp + global header timestamp.** Header reads "last refresh Ns ago" using the oldest `dataUpdatedAt` across all card queries (matches spec ASCII line 426). Each card carries its own micro-timestamp ("updated Ns ago") in muted footer text. Both update via TanStack Query's `dataUpdatedAt`.
- **D-06:** **Unreachable cards render inline, dimmed, sorted last** (within their tag bucket). Card body shows the project name + tags + an "unreachable: <root>" badge replacing phase status, plus an inline "Unregister?" link wired through the kebab menu (D-23). Sort treats unreachable as a tie-breaker — they never appear above reachable projects regardless of user-selected sort key.
- **D-07:** **Per-card error surfaces:**
  - **Schema drift** (D-08 from Phase 2) → card body becomes `<SchemaDriftState />` with the drift surface; rest of grid keeps refreshing.
  - **5xx / network failure** → card retains static metadata from `/api/registry` (name, tags, last commit) and renders a muted footer `⚠ overview unavailable · retrying`. Other cards keep refreshing.
  - **401** → still triggers the global `RepairBanner` (D-06 from Phase 2). All cards stop refreshing until re-pair.
- **D-08:** **Field split — `/api/registry` (HOME-01) returns light status; `/api/projects/{id}/overview` (HOME-02) returns rich card data.** No duplicated fields between the two endpoints' rich payloads.
  - Registry list item (existing `RegistryListItemSchema`): `id, name, root, client, addedAt, tags, status: { reachable, currentPhase, lastCommitAt }`.
  - Overview (new `ProjectOverviewSchema`): `phaseStatus: 'Pending'|'In Progress'|'Complete', stage1: { ran, findings: { red, yellow, green } } | null, stage2: { ran, findings: { red, yellow, green } } | null, dbAudit: { findings: { critical, high, medium, low } } | null, tdd: { greenPairs, totalTasks } | null, verification: { evidence, mustHaves } | null, branch: string | null, markers: { gitRepo: boolean, planning: boolean, claudeSkills: boolean }`.
  - `/overview` may have nullable sub-objects when source files are absent; SPA renders compact placeholders accordingly.

### Confused-deputy "option C" (Phase 1 carryover)

- **D-09:** **Two-step prepare/confirm with nonce.** SPA register modal MUST go through `POST /api/registry/register-prepare` → user reads canonical path + suggested name → `POST /api/registry/register-confirm`. Defends against a confused-deputy paste-the-bad-path attack: the user cannot register a path they didn't see resolved. Supersedes the Phase 1 B2 stopgap (`assertRegistrationAllowed`); the stopgap stays in `addProject` as a defense-in-depth check on confirm.
- **D-10:** **Nonce storage:** in-memory `Map<nonceHex, { canonicalRoot, suggestedName, suggestedSlug, detectedMarkers, expiresAt }>`. **TTL 5 min, single-use** (confirm consumes the entry). Nonce = `crypto.randomBytes(16).toString('hex')` (32 chars). No persistence across daemon restart (acceptable: a restart invalidates in-flight registers; user re-prepares).
- **D-11:** **`assertRegistrationAllowed` block surfaces as 200 with `blocked: true`, no nonce issued.** Daemon: `POST /register-prepare {path}` always returns 200 (or schema-drift 500); body shape:
  - allowed: `{ canonicalRoot, suggestedName, suggestedSlug, alreadyRegistered: false, blocked: false, detectedMarkers, nonce, expiresAt }`.
  - blocked: `{ canonicalRoot, blocked: true, blockedReason: '~/.ssh holds credentials/secrets' }` (verbatim from `RegistrationPathBlocked.reason`). No nonce → confirm impossible for this path.
  - already registered: `{ canonicalRoot, alreadyRegistered: true, existingEntry: RegistryEntry }` — see D-17.
- **D-12:** **`POST /api/registry/register` stays.** CLI (`agentic-dashboard register`) keeps using it (the user already typed the path explicitly). SPA fetch wrapper rejects calls to `/register` from the SPA bundle (lint rule + runtime assert in `apiFetch`). Documents the boundary; doesn't break Phase 1 CLI tests.
- **D-13:** **Nonce is bound to the bearer token (any paired caller can confirm).** No per-tab/per-session isolation. The bearer token is already shared across tabs and devices; binding nonces per-tab adds no real defense, only complexity. Threat model: a malicious in-page script that has the token already wins; per-tab nonces don't change that.
- **D-14:** **Rate-limit `/register-prepare`: soft cap 1 prepare/sec/token, 10-burst window.** Returns 429 with `Retry-After: 1` on cap. Uses `Map<tokenHash, timestamps[]>` in-memory (cleaned on a 60 s sweep). Not for abuse; for hammered loops. Same handler reused on confirm if an analogous risk surfaces — but confirm is naturally rate-limited by the nonce/TTL constraint.
- **D-15:** **Blocked attempts log to stderr.** Format: `[agent] BLOCKED register: <canonicalRoot> (<blockedReason>) tokenHash=<first8(sha256(token))> requestId=<uuid>`. Single-line, no JSON, no levels (consistent with Phase 1 D-02). Surfaces in the foreground stdout/stderr stream Donald already watches; no new file. Successful registers are NOT logged separately (D-33).
- **D-16:** **No extra friction on `--bind tailscale` / `--bind 0.0.0.0`.** Bearer token + CIDR enforcement (D-18 from Phase 1) already gate access. A trusted tailnet device can register projects via the same prepare/confirm flow. The modal still shows the canonical resolved path — security boundary is unchanged.
- **D-17:** **Already-registered prepare returns 200 with `alreadyRegistered: true` and the existing entry, no nonce.** Modal renders "Already registered as id `acme-app` since 2026-05-02. [Open project] [Close]" and routes [Open project] to `/projects/{existingEntry.id}`. Idempotent UX; mirrors Phase 1 D-10's "skip with notice" CLI behaviour.
- **D-18:** **Expired-nonce-on-confirm returns 410 Gone; SPA auto re-prepares.** Daemon: `POST /register-confirm {nonce, name?, client?, tags?}` with expired or unknown nonce → 410 with `{ ok: false, error: 'nonce_expired', requestId }`. SPA modal catches 410, silently calls `/register-prepare` again with the same input path, replaces the modal's nonce + canonical path with the new values (canonical may have changed if symlinks moved between prepare and confirm — desirable), shows a 200 ms "refreshing…" state, no manual retry. With 5-min TTL the user effectively never sees this.
- **D-19:** **Nonce does not persist in localStorage.** Modal close = nonce abandoned (expires server-side at 5 min). Page refresh = user re-opens the modal and prepares again. Keeps storage surface tiny; nonces are ephemeral by design.

### Register modal UX & scope

- **D-20:** **Single-field path → preview → optional fields on confirm step.** Modal anatomy:
  - Step 1: path input + Preview button. Enter on path field = Preview. `/register-prepare` runs.
  - Step 2 (in-place transition, same modal): canonical path display + suggested name (editable) + client field (optional) + tags (optional, free text + chips of existing tags) + [Confirm] [Back] [Cancel]. Markers note (D-30) renders here when applicable.
  - Two visual states share the same modal container; no wizard chrome.
- **D-21:** **Suggested name = `basename(canonicalRoot)`; no auto-tagging.** Daemon's `/register-prepare` response includes `suggestedName` and `suggestedSlug` (slugified via Phase 1's `slugify`). Tags default to empty (consistent with Phase 1 D-12). User picks tags consciously.
- **D-22:** **Tag input = free text + chip suggestions of existing tags.** SPA reads union-of-tags from the cached `/api/registry` response. Renders existing tags as toggle chips; free-text input adds new ones. New tags become suggestion chips on the next register. Convention emerges from use; vocabulary stays open.
- **D-23:** **Right-click + long-press + ⋮ kebab button → context menu for rename / re-tag / unregister.** Three triggers, same accessible menu component:
  - **Mouse:** right-click anywhere on the card.
  - **Touch:** long-press (~500 ms).
  - **Always-on:** `⋮` button in the top-right of every card (visible at all times, focusable).
  - Menu items: `Rename`, `Edit tags`, `Unregister`. Full keyboard navigation (Tab to kebab, Enter, arrow keys). Register modal handles the *add* case only.
- **D-24:** **Add `POST /api/registry/{id}/rename` and `POST /api/registry/{id}/tags`.** Both gated by bearer; no nonce required (these mutate identifiers/labels, not paths). Spec line 318 explicitly allows registry-only writes. Endpoints return the updated `RegistryEntry`. `POST /api/registry/unregister` already exists from Phase 1 (`{ id }` body, 204 response) and stays.
- **D-25:** **Optimistic add on register-confirm.** On 201 from `/register-confirm`, SPA invalidates `/api/registry` query AND optimistically pushes the new entry into the cached list (so the card appears within ~16 ms). Background refetch arrives in <500 ms and reconciles. Acceptance criterion 4 ("<5 s without page reload") is beaten by ~100×. Same optimistic pattern applies to rename / tag / unregister mutations from the kebab menu.
- **D-26:** **Modal close — Esc, backdrop click, X button all close.** Unsaved input (path typed or non-default field values) shows a minimal inline "Discard?" confirm within the modal — not a second dialog. Focus traps inside modal while open; restores to caller (the `+ Register project` card or kebab menu) on close.
- **D-27:** **Blocked-path UI.** When `/register-prepare` returns `blocked: true`, modal advances to step 2 anyway so the user sees the canonical path the daemon resolved. Confirm button is disabled. A red inline banner reads `Blocked: <blockedReason>` (verbatim from daemon). User clicks [Back] to try a different path or [Cancel].
- **D-28:** **Prepare network/drift error → inline error in modal step 1 with Retry button; no auto-retry.** 5xx or network failure → "Couldn't reach the daemon. [Retry]" inline; user input preserved. Schema drift on the prepare response → `<SchemaDriftState />` rendered inside the modal panel. 401 → global `RepairBanner` (D-06 Phase 2) takes over. No automatic retry — consistent with Phase 2 D-07 ("token mismatch is deterministic; retrying just adds latency").
- **D-29:** **Focus lands on the newly-added card after register-confirm closes the modal.** `tabIndex={-1}` on the optimistically-added card; ref-based `scrollIntoView({ block: 'nearest' })`; `element.focus()` after a 0-tick to let layout settle. Donald can press Enter to drill into the new project (matches D-37's "click anywhere on card = navigate" rule).
- **D-30:** **Soft hint when no project markers detected.** Daemon's prepare response includes `detectedMarkers: { gitRepo, planning, claudeSkills }`. If all three are false, modal step 2 shows a muted info note: "No git repo or .planning/.claude found here. Cards may show empty data." Not blocking — just informing. Helps avoid registering `~/Downloads` by accident.
- **D-31:** **Enter-key contract:**
  - Step 1: Enter on path field → `/register-prepare`.
  - Step 2: Enter on name field → confirm. Enter on tag input → add chip from current text. Enter on Confirm button → confirm. Enter elsewhere → no-op.
  - Mirrors Phase 2 WR-04 (ManualPairForm Enter-key resubmit blocking).
- **D-32:** **Cmd/Ctrl+K opens a full command palette.** ⚠️ **Scope-significant addition** — surfaces register, jump-to-project, refresh, theme toggle as a Linear/Raycast-style action list with fuzzy filter and keyboard-accessible listbox semantics. The palette is mounted globally (in `AppShell`), opens above the home page, and:
  - **Actions in v1:** `Register project` (opens register modal), `Jump to <project name>` (one row per registered project, navigates to `/projects/{id}`), `Refresh data` (forces /api/registry refetch + invalidates all overview queries), `Toggle theme`.
  - **Component:** purpose-built (no command-palette dep). Uses `<dialog>` + manual focus trap + `role="listbox"` + `aria-activedescendant`. Fuzzy filter via simple lower-cased substring match on action label + project name.
  - **Sizes Phase 3 past one session.** The planner should split this into its own plan within Phase 3 (likely Wave 2 alongside the home grid) and evaluate whether to defer to Phase 6 if total scope grows past three sessions.
- **D-33:** **Successful registers are NOT logged separately.** The standard request log line covers `POST /api/registry/register-confirm`. Only blocked attempts get an explicit `BLOCKED` line (D-15) — that's the actionable signal Donald cares about.

### Card layout + filter / search / sort + impeccable defense

- **D-34:** **Rich + collapsible cards — compact default; hover/focus expands.** Compact card body shows essentials: name + client/tag subtitle, phase + status, finding counts (Stage 2 row), last commit. Hover (mouse) or focus (keyboard) reveals an inline-expanded section adding: Stage 1 findings (if ran), DB-AUDIT findings, TDD pairs (greenPairs/totalTasks), Verification (evidence/mustHaves), branch. Touch users see compact only by default; long-press reveals (same affordance as the kebab menu, D-23). No persistent expanded state — the expansion is purely a peek.
- **D-35:** **Card height: compact ~5 lines, expanded adds ~5 more.** Inline insertion via opacity + `max-height` transition (~120 ms, no bounce, no rotate, no scale). Six cards visible at compact on a 1080p / 1440p screen. Click anywhere on the card = navigate to `/projects/{id}` (D-37) — even when expanded.
- **D-36:** **Finding counts render as coloured Unicode glyphs.** `🔴 0  🟡 2  🟢 5` per spec ASCII (lines 438–446). Three monospaced groups, fixed-width to align across cards. Glyphs as Unicode emojis (`U+1F534`, `U+1F7E1`, `U+1F7E2`) styled with reduced size and `aria-label`s ("0 critical, 2 medium, 5 low") for screen readers. Stage 1 row (when expanded) uses the same glyph set. DB-AUDIT row uses textual labels (`0 critical · 1 high · 0 medium · 0 low`) since severity buckets differ.
- **D-37:** **Click target: whole card navigates to `/projects/{id}`.** Card is a `<button>` (or `<a>` if we keep semantics simple) with `role="link"` semantics. Right-click / long-press / `⋮` button intercept and stop propagation — those open the context menu (D-23) instead of navigating. Phase 3 ships a placeholder `/projects/{id}` route that displays "Phase 4 work — three-column view lands soon" so the click target resolves cleanly.
- **D-38:** **Filter chips: fixed-known + derived overflow.**
  - **Always present:** `all` (default selected), `active`, `client`, `internal` (per spec line 429).
  - **Overflow:** any tag in the registry that isn't one of those four appears after the fixed set, with a `(N)` count suffix. Donald's `archived`, `wip`, `vite`, `supabase` tags become first-class filter chips on use.
  - Chips toggle inclusion. Multiple chips selected = OR (a project matches any selected tag). Spec doesn't address multi-select; OR is the natural semantic.
- **D-39:** **Search box matches name + client + tags + currentPhase dirname.** Pure client-side filter on the cached `/api/registry` list (no server params). Lower-cased substring match (no fuzzy library). Search interacts with filter chips as AND (chip filter narrows the set; search narrows further). `Esc` clears the search.
- **D-40:** **Sort: spec-mandated default; user UI control overrides for the session only.**
  - **Default sort** (always on first load, after refresh, after explicit "Reset"): tag-priority `active > client > internal > <other tags alphabetical>`, then `lastCommitAt` desc; **unreachable always sorted last** within their bucket regardless of selection (D-06).
  - **UI control:** single dropdown next to the search box, options: `Recommended` (default — labelled "Recommended" so Donald sees the canonical view), `Last commit ↓`, `Name ↑`, `Phase ↓`, `Client ↑`. Selection is session-only; no localStorage persistence (Phase 6 polish concern).
  - **Spec extension note:** spec line 455 fixes the sort. User-selectable sort is a Phase-3-extension Donald requested; the default still honours spec. Planner should call this out in PLAN.md so it survives review.
- **D-41:** **No virtualisation, no pagination in v1.** CSS grid handles 50 cards without performance issues at Donald's scale (~5–10 client projects). Skip `react-window`; skip pagination. Track `/api/registry` length; revisit if it crosses 50.

### Anti-AI-slop discipline (additive to Phase 2 D-01)

- **D-42:** **No skeleton-shimmer loading states.** Cards show static `—` placeholders in muted text while overview is loading. Skeleton-shimmer is an AI-slop tell flagged by `impeccable:critique`.
- **D-43:** **Hover-expand animations use only `opacity` + `max-height` (no rotate, no scale, no glow).** Coloured finding glyphs are the only colour signal beyond the accent. Phase 2's design tokens (no gradients, no hero illustrations, no animated terminal) inherit verbatim.
- **D-44:** **Empty-phase card matches spec line 435 verbatim.** When `currentPhase` is null: render `no .planning/` as the phase line + a small `install workflow skill →` link in muted text. Tag chips still render. Finding-count rows are absent (no source data). Click-through still navigates to `/projects/{id}` (the placeholder will note "no .planning/ detected — install workflow skill to enable phase tracking").

### Claude's Discretion

- **Empty grid behaviour.** Spec acceptance criterion 13 says zero registered projects → redirect `/` to `/onboarding`. Phase 2's index route already does this when the user is unpaired; extend to "paired but registry empty" by checking `/api/registry`'s response length on the index route's `beforeLoad` (or by rendering a zero-state inside the home page that links to onboarding's install copy + opens the register modal). Planner picks the cleanest approach.
- **`ProjectOverviewSchema` exact field naming** — the shape sketched in D-08 is the contract; planner can rename fields for consistency with existing schemas (e.g. `mustHaves` vs `must_haves`) as long as both ends agree.
- **Optimistic-update rollback paths.** D-25 says reconcile via refetch — planner decides whether to additionally implement explicit rollback on rename/tag mutations 5xx (the path-of-no-rollback is acceptable since the daemon either succeeds atomically or surfaces a clear error).
- **Touch-device long-press timing.** ~500 ms is a starting point; planner can adjust to match platform conventions.
- **Cmd/Ctrl+K palette internal layout.** Listbox vs grouped sections, action-icon placement, ⌘+K hint chip, etc. — visual polish open to the planner so long as no animations violate D-43.
- **TanStack Query cache key shape.** Suggested: `['registry']`, `['overview', projectId]`, `['prepare', path]`. Planner finalises.
- **Daemon-side cache eviction strategy.** Suggested: lazy expiry on read (check `expiresAt`, recompute if stale); no background sweeper (acceptable as the cache is bounded by registry size). Planner can add a sweeper if latency suffers.
- **Test layout.** Vitest unit + component tests for SPA; in-process Hono tests for daemon routes; a single end-to-end subprocess test covering register-prepare → confirm → card-appears for the optimistic-add invariant.

### Folded Todos

None — no pending todos surfaced in cross-reference (`gsd-tools todo match-phase 3` returned 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)

- `docs/spec/dashboard-prompt.md` §"Registry" lines 127–164 — `RegistryEntry` shape, ID generation rules, per-project status fields, unreachable-root behaviour. D-04, D-06, D-08 derive from this.
- `docs/spec/dashboard-prompt.md` §"API surface (Hono routes)" lines 290–352 — registry routes (`POST /register`, `POST /unregister`, `GET /registry`, `GET /api/projects/{id}/overview`) and project-scoped reads. D-08, D-09, D-12, D-24 build on this contract.
- `docs/spec/dashboard-prompt.md` §"Page layout — multi-project home" lines 422–461 — the canonical card mock, sort rule, click-target, polling cadence, register modal contract. D-34, D-36, D-38, D-40, D-44 implement the spec mock.
- `docs/spec/dashboard-prompt.md` §"SPA route structure" lines 388–401 — `/`, `/projects/{id}`, `/onboarding` redirects. D-37 places the placeholder `/projects/{id}` route.
- `docs/spec/dashboard-prompt.md` §"Acceptance criteria" items 1, 2, 3, 13 (lines 580, 581, 582, 592) — Phase-3-binding gates. Especially item 3: "Adding/removing projects via SPA immediately reflects in the home page" — drives D-25 optimistic update.
- `docs/spec/dashboard-prompt.md` §"Implementation phasing" Phase 3 bullet (lines 625–629) — the four sub-deliverables.
- `docs/spec/dashboard-prompt.md` §"Visual style" lines 548–554 — anti-AI-slop self-test, dark default, restrained palette, distinctive typography. D-42, D-43 inherit.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" + §"Anti-features" (lines 686–712) — read-only on project FS, registry/auth/env writes confined to `~/.agenticapps/dashboard/`, bearer-token on every route, CORS lock, no native deps. INV-01..05 carry into Phase 3 unchanged.

### Project-level planning artifacts

- `.planning/PROJECT.md` — vision, hard tech-stack lock (Vite + React 18 + TS + Tailwind + TanStack Query + Zod + lucide-react on the SPA; Node 20 + Hono + Zod + execa on the daemon), key decisions table.
- `.planning/REQUIREMENTS.md` — REQ-IDs in scope: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06 active. INV-01..05 carry forward unchanged.
- `.planning/ROADMAP.md` Phase 3 entry — success criteria 1–4, depends-on Phase 2.
- `.planning/phases/00-bootstrap/00-CONTEXT.md` — Phase 0 decisions still in force: D-04 (pnpm catalog versions), D-06 (HealthResponseSchema cross-package proof), D-15 (workflow commitment ritual mandatory), D-16 (no native deps).
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — Phase 1 decisions Phase 3 must honour: D-10 (idempotent path collision), D-13 (token format), D-15 (mid-rotation race window), D-16 (daemon-side `Schema.parse()` outbound), D-21 (CORS allow-list + production SPA origin), D-22 (no chokidar; per-request reads), D-23 (`fs.realpath` allow-list defence).
- `.planning/phases/02-spa-shell-pair-flow/02-CONTEXT.md` — Phase 2 decisions Phase 3 builds on: D-01 (anti-slop tone), D-02/D-03 (dark default + 3-way theme), D-04 (TanStack Router), D-05 (lazy routes), D-06/D-07 (401 → `RepairBanner`, no auto-retry), D-08/D-09 (schema drift → inline panel state), localStorage prefix `agentic-dashboard:*`.
- `CLAUDE.md` — repo state, hard architectural constraints (every "must survive every refactor" bullet), pre-PR checklist (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, **`pnpm lint`**, `gsd-tools verify schema-drift NN`).
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (per-plan TDD, post-phase `/review`+`/cso`+`/qa`, pre-phase brainstorming on UI plans).

### Workflow contract

- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format, gate-to-skill map (Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review` are not collapsible), rationalization table, 13 red flags.
- Pre-phase hook (per global CLAUDE.md): UI plans MUST run `superpowers:brainstorming` for UI/UX alternatives before coding. The card layout (D-34, D-35), kebab menu (D-23), and command palette (D-32) are the candidate plans for that hook.
- Post-phase hooks: `/review` (Stage 1) → `superpowers:requesting-code-review` (Stage 2) → `/cso` (this phase touches new HTTP write routes — register-prepare/confirm, rename, tags — so /cso is mandatory) → `/qa` (dev server reachable on `localhost:5174`).

### External docs (relevant to the new surfaces)

- TanStack Query v5 polling + visibility: https://tanstack.com/query/latest/docs/react/guides/important-defaults — `refetchIntervalInBackground` default, `dataUpdatedAt`, optimistic updates, `setQueryData` rollback patterns. D-01..D-03, D-05, D-25 lean on this.
- TanStack Router optimistic invalidation: https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading — `queryClient.invalidateQueries` after mutation. D-25.
- Hono Zod validator + JSON body: https://hono.dev/docs/guides/validation — already used for `/api/registry/register` in Phase 1; same pattern for prepare/confirm/rename/tags routes.
- Hono context get/set: https://hono.dev/docs/api/context — for the per-request `requestId` and per-token `Map` lookup used by D-14 rate limiter.
- Node `crypto.randomBytes`: https://nodejs.org/api/crypto.html#cryptorandombytessize-callback — nonce entropy source (D-10).
- WAI-ARIA listbox pattern (for command palette): https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ — `role="listbox"` + `aria-activedescendant` for D-32.
- WAI-ARIA dialog pattern (for modal + palette): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — focus trap, restoration, Esc handling for D-26 and D-32.
- Native `<dialog>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog — modal & palette use this when supported (Phase 2 didn't have a modal yet; this is new in Phase 3).
- Touch long-press detection (Pointer Events): https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events — for D-23 long-press on touch.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/shared/src/schemas/registry.ts` — `RegistryEntrySchema`, `RegistryFileSchema`, `RegistryListItemSchema`, `RegistryListResponseSchema`, `RegisterResponseSchema`, `StatusResponseSchema` already shipped Phase 1. `RegistryListItemSchema` exactly matches D-08's "registry list item" shape — no changes needed for `/api/registry`.
- `packages/agent/src/lib/registry.ts` — `addProject` (Phase 1, idempotent + slug collision), `removeProject`, `renameProject`, `setTags`, `listProjectsWithStatus`, `assertRegistrationAllowed`, `RegistrationPathBlocked`, `slugify`, `canonicaliseRoot`. `addProject` is reused inside `/register-confirm`. `assertRegistrationAllowed` is reused inside `/register-prepare` to compute `blocked` + `blockedReason`. **All four are already fully tested** — D-09..D-15 build on top, no rework.
- `packages/agent/src/routes/registry.ts` — existing Hono router with `GET /`, `POST /register`, `POST /unregister`. Phase 3 adds `POST /register-prepare`, `POST /register-confirm`, `POST /:id/rename`, `POST /:id/tags` to the same router file. `outbound()` wrapper from `server/middleware/errors.js` handles D-16 daemon-side schema drift defence automatically.
- `packages/agent/src/server/middleware/errors.ts` — `outbound(c, parser, value, status?)` pattern for daemon-side schema-drift defence. Reused for every new route.
- `packages/agent/src/lib/atomicWrite.ts` + `stateCorruption.ts` — used by `addProject` and friends; rename/tags routes reuse via the existing helpers.
- `packages/spa/src/lib/api.ts` — `apiFetch(path, schema)` pattern with `parseOrDrift()` + `ApiError`. Every new SPA→daemon call (registry list, overview, prepare, confirm, rename, tags, unregister, command-palette refresh) routes through this. **Add a runtime assert** that rejects `path === '/api/registry/register'` (the legacy CLI route — see D-12).
- `packages/spa/src/lib/queryClient.ts` — TanStack Query client with 401 interceptor (Phase 2 D-06/D-07). Reused for all home-page queries.
- `packages/spa/src/lib/repair.tsx` (`useRepair`, `RepairProvider`) — Phase 2 D-06 banner state. Triggered by 401 across all card queries.
- `packages/spa/src/components/SchemaDriftState.tsx` — Phase 2 D-08/D-09 inline drift surface. Used for per-card drift (D-07) and modal-prepare drift (D-28).
- `packages/spa/src/components/AppShell.tsx` — root shell mounted at every route. The Cmd/Ctrl+K palette (D-32) mounts here as a global element.
- `packages/spa/src/components/Header.tsx` — already renders product name + theme chip + ⚙ settings icon. Phase 3 adds the global "last refresh Ns ago" timestamp (D-05) and the project count ("3 projects").
- `packages/spa/src/router.tsx` — TanStack Router root with `/`, `/onboarding`, `/pair`, `/settings`, `/help`. Phase 3 adds `/projects/$projectId` lazy route (placeholder body for D-37).
- `packages/spa/src/routes/index.lazy.tsx` — current index route is a stub. Phase 3 replaces the body with `<MultiProjectHome />`.
- `packages/spa/src/styles/global.css` — design tokens (`--bg`, `--surface`, `--text`, `--accent`, etc.) locked in Phase 2. Cards consume the same vars.
- `packages/spa/package.json` — TanStack Query, TanStack Router, lucide-react, React 18, Tailwind v4, Vite, vitest already present. **No new SPA deps for Phase 3** — command palette (D-32) is purpose-built, not a library.
- `packages/agent/package.json` — Hono, zod, execa, picocolors already present. **No new agent deps for Phase 3** — `crypto` is built-in for nonce generation.

### Established Patterns

- **Catalog-versioned deps** (Phase 0 D-04): no new deps means no catalog edits.
- **Shared schemas single source of truth** (Phase 0 D-06, Phase 1 D-16): every new wire shape lands in `packages/shared/src/schemas/<name>.ts`. Phase 3 adds `overview.ts` (`ProjectOverviewSchema`), and adds `RegisterPrepareRequestSchema` / `RegisterPrepareResponseSchema` / `RegisterConfirmRequestSchema` / `RenameRequestSchema` / `TagsRequestSchema` to (or alongside) `registry.ts`.
- **TS strict mode** + **ESM-only** carry from Phase 0–2.
- **TDD mandatory** per global CLAUDE.md and repo CLAUDE.md — every panel, route, schema, and the command palette gets a failing test first.
- **Two-stage review** before merge — Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review`. Stages do NOT collapse.
- **`pnpm lint` is now mandatory** in pre-PR check (CLAUDE.md memory feedback) — Phase 2 PR caught 4 errors + 45 warnings only after CI ran. Plans must include a lint pass before opening the PR.

### Integration Points

- **Daemon-side new files:**
  - `packages/agent/src/lib/registerNonces.ts` (NEW) — `Map<nonceHex, NonceEntry>` + `issueNonce`, `consumeNonce` (returns null if expired or unknown), `cleanupExpired`. Vitest unit tests for TTL, single-use, expired-on-confirm.
  - `packages/agent/src/lib/registerLog.ts` (NEW) — `logBlocked(reason, root, tokenHash, requestId)`; thin helper around `console.error` for D-15. Same pattern fits a future `logRegister` if Donald reverses on D-33.
  - `packages/agent/src/lib/rateLimiter.ts` (NEW) — `Map<tokenHash, timestamps[]>` + `tokenHashOf(token)`; `consume(tokenHash) -> { allowed: boolean, retryAfter?: number }`. Vitest tests for cap + burst + cleanup.
  - `packages/agent/src/lib/projectOverview.ts` (NEW) — pure-function reader. `readOverview(root: string): Promise<ProjectOverview>`. Reads `.planning/phases/<latest>/`, parses CONTEXT/PLAN/VERIFICATION presence + must_haves count, parses `<finding severity="...">` blocks from REVIEW.md (Stage 1 + Stage 2), parses TDD pairs from `git log` (uses Phase 1's existing execa allow-list pattern), reads branch via `git symbolic-ref --short HEAD`. Wrapped by D-02's 5 s memo cache.
  - `packages/agent/src/lib/overviewCache.ts` (NEW) — `Map<projectId, { value, expiresAt }>` with lazy expiry. Tests: hit/miss/stale, multiple-tab coalescing simulation.
  - `packages/agent/src/routes/overview.ts` (NEW) — `GET /api/projects/:id/overview` Hono route. Wires through D-02 cache + `outbound()` schema-drift defence.
  - `packages/agent/src/routes/registry.ts` (EXTEND) — adds `POST /register-prepare`, `POST /register-confirm`, `POST /:id/rename`, `POST /:id/tags`.
- **Daemon-side new schemas:**
  - `packages/shared/src/schemas/overview.ts` (NEW) — `ProjectOverviewSchema` per D-08. `FindingCountsSchema` and `DbAuditFindingsSchema` subschemas.
  - `packages/shared/src/schemas/registry.ts` (EXTEND) — `RegisterPrepareRequestSchema`, `RegisterPrepareResponseSchema` (allowed | blocked | alreadyRegistered union), `RegisterConfirmRequestSchema`, `RegisterConfirmResponseSchema`, `RenameRequestSchema`, `TagsRequestSchema`.
- **SPA-side new files:**
  - `packages/spa/src/routes/index.lazy.tsx` (REPLACE body) — mounts `<MultiProjectHome />`.
  - `packages/spa/src/routes/projects.$projectId.lazy.tsx` (NEW) — placeholder for D-37; renders "Phase 4 work — three-column view lands soon" + a "← back to all projects" link.
  - `packages/spa/src/components/MultiProjectHome.tsx` (NEW) — top-level home component. Renders `<Toolbar />` + `<CardGrid />` + `<RegisterButtonCard />` + `<RegisterModal />`.
  - `packages/spa/src/components/HomeToolbar.tsx` (NEW) — filter chips + search box + sort dropdown (D-38, D-39, D-40).
  - `packages/spa/src/components/ProjectCard.tsx` (NEW) — single card; compact + hover-expand (D-34, D-35, D-36, D-37, D-44). Includes the kebab button (D-23) and the "Unregister?" inline link for unreachable cards (D-06, D-23).
  - `packages/spa/src/components/CardContextMenu.tsx` (NEW) — accessible context menu shared by right-click / long-press / kebab (D-23). Right-click handler attached at the card root; long-press from Pointer Events; kebab is a regular button.
  - `packages/spa/src/components/RegisterModal.tsx` (NEW) — two-step modal (D-20, D-26, D-27, D-28, D-29, D-30, D-31).
  - `packages/spa/src/components/RegisterModal.steps.tsx` or split files — Step 1 (path + Preview) and Step 2 (canonical path + name + client + tags + Confirm). Inline rather than wizard.
  - `packages/spa/src/components/CommandPalette.tsx` (NEW) — D-32. Mounted in `AppShell`. Listbox + dialog + Cmd/Ctrl+K global handler.
  - `packages/spa/src/lib/registerActions.ts` or `commandPaletteActions.ts` (NEW) — declarative action registry consumed by `<CommandPalette />`. v1 actions: register, jump-to-project, refresh, theme toggle.
  - `packages/spa/src/lib/registry.ts` (NEW) — TanStack Query hooks: `useRegistryList`, `useProjectOverview(id)`, `useRegisterPrepare`, `useRegisterConfirm`, `useRename(id)`, `useSetTags(id)`, `useUnregister(id)`. Each wraps `apiFetch` + the right schema. Mutations include optimistic update + invalidation per D-25.
  - `packages/spa/src/lib/touchLongPress.ts` (NEW) — small helper for D-23 long-press detection on Pointer Events.
- **CI:** `.github/workflows/ci.yml` already runs lint + typecheck + test + build. Phase 3 tests get picked up automatically.

</code_context>

<specifics>
## Specific Ideas

- The card's "rich + collapsible" treatment (D-34) is a deliberate departure from spec's always-rich ASCII. The spec's purpose is to convey *what data* the card surfaces; the *progressive disclosure* of that data is a reasonable UX refinement. Compact-by-default keeps the grid scannable; hover reveals the detail. The impeccable critique gate in Phase 6 will tell us whether the choice survives.
- The Cmd/Ctrl+K command palette (D-32) is the largest scope-additive surface in this phase. It's listed as Claude's discretion to split into a separate plan because it brings ~1 day of UI work that's effectively orthogonal to the rest of the home page. If wave-budget is tight, Phase 3 ships the home grid + register modal + context menu; the palette becomes Plan 03-N or moves to Phase 6 polish.
- The user-selectable sort (D-40) extends spec line 455. The default still honours spec; the override is purely additive and session-only. Mark this in PLAN.md so the Stage 1 `/review` agent doesn't flag it as spec drift.
- The "option C" prepare/confirm split (D-09) is also a CSO-relevant security strengthening. The security-auditor pass (post-phase `/cso`) should specifically verify: (a) the SPA cannot call `/register` directly (D-12 enforcement), (b) the nonce TTL is enforced server-side (no SPA-side trust), (c) the blocked reason is verbatim from the daemon (no client-side string concat), (d) the rate limiter actually returns 429 on cap.
- The optimistic add (D-25) is the path to the spec's "<5 s without page reload" criterion. Don't backslide into a server-of-truth-only approach during execution — the test that proves criterion 4 must measure the user-visible time-to-card.
- The hover-expand interaction (D-34) must NOT introduce layout shift in the surrounding grid. The expanded card should reflow within its grid cell, OR the entire grid should be a `grid-template-rows: masonry` (with fallback). Planner picks the cheapest non-shifting approach — likely a fixed-height grid cell with `overflow-y: auto` only when expanded.

</specifics>

<deferred>
## Deferred Ideas

### Phase-3-adjacent items intentionally not covered here

- **`/settings/projects` standalone management sub-route** (spec line 396) — replaced for v1 by the in-card kebab/right-click context menu (D-23). The dedicated route can ship in Phase 6 polish if it proves useful (e.g. for bulk operations).
- **Sort persistence across sessions** — D-40 ships session-only override. localStorage persistence is a Phase 6 polish concern.
- **Pagination / virtualisation** — D-41 explicitly defers. Revisit at 50+ projects.
- **localStorage for pending nonce / register continuity** — D-19 explicitly declines. Modal close = nonce abandoned.
- **`/projects/{id}` three-column content** — Phase 3 ships only a placeholder. Phase 4 (Discipline + Phase columns), Phase 5 (Health column).
- **AgentLinter integration / Skill health panels** — Phase 5.
- **Sentry / Linear / Infisical panels** — Phase 5 (HEALTH-05) configured-or-not status; Phase 7+ for actual integration.
- **Keyboard shortcuts beyond Cmd/Ctrl+K** (R = refresh, ? = help, / = focus search) — Phase 6 (POLISH-01).
- **`impeccable:critique` ≥ 90 hard gate** — Phase 6 (POLISH-04). Phase 3 inherits Phase 2's design baseline + adds D-42/D-43/D-44 anti-slop rules; the critique gate measures these in Phase 6.
- **Custom domain `dashboard.agenticapps.eu` flip** — Phase 6 daemon-constants change.
- **Command palette action expansion** (run skill, navigate to settings/help, full action search across skills) — D-32 v1 ships only register/jump/refresh/theme. Future palette actions are additive.
- **Rename/tag mutation rollback paths beyond refetch reconciliation** — D-25 + planner discretion. Explicit `setQueryData` rollback on 5xx is a polish concern.
- **Audit trail of registry mutations** — D-33 declines the explicit log. Standard request log lines suffice.

### From spec / earlier-phase open questions still pending

- **Q5 Meta-observer skill packaging** (Phase 1 deferred) — Phase 4 owns the JSONL consumer.
- **Q1/Q2 Repo visibility flip + LICENSE** (Phase 1 deferred) — Phase 8.
- **Q3 CF Access policy on production domain** (Phase 1 deferred) — Phase 6.
- **Q6 AgentLinter integration** (Phase 1 deferred) — Phase 5.
- **Phase 1 HUMAN-UAT pending items** (Tailscale live bind + 0.0.0.0 yellow banner) — tracked in `.planning/phases/01-daemon-registry-pairing/01-HUMAN-UAT.md`. Phase 6 polish or out-of-band.

### Reviewed Todos (not folded)

None — no pending todos surfaced in cross-reference.

</deferred>

---

*Phase: 03-multi-project-home-page*
*Context gathered: 2026-05-04*
