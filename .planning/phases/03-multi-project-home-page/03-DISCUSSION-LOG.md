# Phase 3: Multi-project Home Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 03-multi-project-home-page
**Areas discussed:** Data flow + freshness lifecycle, Confused-deputy 'option C', Register modal UX & scope, Card layout + filter/search/sort + impeccable defense

---

## Data flow + freshness lifecycle

### Card fan-out strategy

| Option | Description | Selected |
|--------|-------------|----------|
| List + per-card /overview (Recommended) | One /api/registry + N independent /overview queries; per-card freshness, partial failure isolation | ✓ |
| Single /api/registry?include=overview mega-call | Daemon bundles everything in one response; simpler SPA, loses isolation | |
| List preload + per-card lazy /overview | IntersectionObserver defers below-the-fold cards; saves daemon calls past 10–15 cards | |

**User's choice:** List + per-card /overview (Recommended)
**Notes:** Maps to D-01.

### 5 s freshness cache location

| Option | Description | Selected |
|--------|-------------|----------|
| Daemon-side 5 s memo per overview (Recommended) | Map<id, {value, expiresAt}> in process; multi-tab coalescing | ✓ |
| SPA-side only (TanStack Query staleTime: 5_000) | Daemon fresh on every request; defies spec line 157 | |
| Both — daemon 5 s + SPA staleTime: 4 s | Belt-and-braces, more invariants | |

**User's choice:** Daemon-side 5 s memo per overview (Recommended)
**Notes:** Maps to D-02.

### Tab-hidden polling

| Option | Description | Selected |
|--------|-------------|----------|
| Pause, resume on visible (Recommended) | TanStack default refetchIntervalInBackground: false; saves daemon calls | ✓ |
| Continue at 5 s regardless | Always-fresh data; daemon does N×5/min reads forever | |
| Slow to 30 s when hidden | Compromise; extra timer + visibility listener | |

**User's choice:** Pause, resume on visible (Recommended)
**Notes:** Maps to D-03.

### Phase status derivation source

| Option | Description | Selected |
|--------|-------------|----------|
| Highest-numbered phase dir + heuristic (Recommended) | PLAN.md / VERIFICATION.md presence + must_haves; pure-function over filesystem | ✓ |
| Dedicated state.json or front-matter in CONTEXT.md | Single source of truth; no current writer to maintain | |
| ROADMAP.md table parsing | Brittle text-format dependency on workflow rendering | |

**User's choice:** Highest-numbered phase dir + heuristic (Recommended)
**Notes:** Maps to D-04.

### Freshness timestamp placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card timestamp + global header timestamp (Recommended) | Both clocks tick from the same source; matches spec ASCII | ✓ |
| Per-card only — no global header | Cleaner header, breaks spec | |
| Global header only — no per-card | Simpler card layout, loses per-card signal | |

**User's choice:** Per-card timestamp + global header timestamp (Recommended)
**Notes:** Maps to D-05.

### Unreachable card rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Inline, dimmed, sorted last (Recommended) | Reduced opacity, "unreachable: <root>" badge, inline Unregister link | ✓ |
| Hidden by default, surfaced via filter chip | Reduces grid noise; missing project goes silent | |
| Always shown, no special styling | Looks like a slow-loading project; confusing | |

**User's choice:** Inline, dimmed, sorted last (Recommended)
**Notes:** Maps to D-06.

### Per-card error surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Inline drift state for drift; muted error footer for 5xx; banner for 401 (Recommended) | Reuses Phase 2 D-08 SchemaDriftState; static metadata footer for 5xx; global banner for 401 | ✓ |
| All errors collapse to a single 'card unavailable' state | Less code; loses drift signal | |
| Card disappears on error | Loses information; can't tell project gone vs daemon broken | |

**User's choice:** Inline drift state for drift; muted error footer for 5xx; banner for 401 (Recommended)
**Notes:** Maps to D-07.

### Field split between /api/registry and /overview

| Option | Description | Selected |
|--------|-------------|----------|
| Registry: list + light status. Overview: rich card data (Recommended) | Distinct schemas; /registry already shipped Phase 1; /overview is new | ✓ |
| Registry returns everything; /overview is alias | Slows initial paint; wastes /registry's lightweight contract | |
| Overview returns only 'extra' fields | Cleanest no-duplication; partial-type fragility | |

**User's choice:** Registry: list + light status. Overview: rich card data (Recommended)
**Notes:** Maps to D-08.

---

## Confused-deputy 'option C'

### SPA register flow shape

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step prepare/confirm with nonce (Recommended) | Daemon canonicalises, returns nonce + path; SPA shows path; user confirms | ✓ |
| Single-step POST with optimistic preview | Preview-only display + single-step POST; security gain is purely UX | |
| Defer entirely — keep Phase 1 stopgap | assertRegistrationAllowed alone; revisit at public-flip | |

**User's choice:** Two-step prepare/confirm with nonce (Recommended)
**Notes:** Maps to D-09.

### Nonce storage and TTL

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory Map, 5 min TTL, single-use (Recommended) | crypto.randomBytes(16); single-use; no persistence across restart | ✓ |
| In-memory Map, 30 s TTL, single-use | Tighter window; annoying when user pauses to read | |
| Persist to ~/.agenticapps/dashboard/nonces.json | Survives restart; another 0600 file; overkill | |

**User's choice:** In-memory Map, 5 min TTL, single-use (Recommended)
**Notes:** Maps to D-10.

### Blocked-path response shape

| Option | Description | Selected |
|--------|-------------|----------|
| 200 with blockedReason in payload, no nonce issued (Recommended) | Modal sees canonical path AND reason; transparency by design | ✓ |
| 422 with error body | Treats blocked as validation error; hides canonical path | |
| 403 with error body | Reuses CIDR-rejection status; mixes concerns | |

**User's choice:** 200 with blockedReason in payload, no nonce issued (Recommended)
**Notes:** Maps to D-11.

### Existing /register route fate

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — CLI keeps using it; SPA uses prepare/confirm (Recommended) | Documents boundary; doesn't break Phase 1 CLI tests | ✓ |
| No — retire /register; CLI also routes through prepare/confirm | Single ingress; overkill for explicit CLI users | |
| Keep /register and skip prepare/confirm in v1 | Contradicts choice 1 | |

**User's choice:** Yes — CLI keeps using it; SPA uses prepare/confirm (Recommended)
**Notes:** Maps to D-12.

### Nonce scope

| Option | Description | Selected |
|--------|-------------|----------|
| Any paired caller can confirm (Recommended) | Bound to bearer token; simple; matches threat model | ✓ |
| Bind to per-prepare ephemeral cookie | Real per-tab isolation; CORS-locked Bearer API drift | |
| Bind to User-Agent + IP | Marginal defense (forgeable, loopback shared) | |

**User's choice:** Any paired caller can confirm (Recommended)
**Notes:** Maps to D-13.

### Rate limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 1/s/token soft cap, 10-burst (Recommended) | Map<token, timestamps[]>; 429 + Retry-After | ✓ |
| No rate limiting in v1 | Loopback-default; abuse risk near zero | |
| Only on Tailscale / 0.0.0.0 binds | Conditional logic; more test paths | |

**User's choice:** Yes — 1/s/token soft cap, 10-burst (Recommended)
**Notes:** Maps to D-14.

### Audit logging of blocked attempts

| Option | Description | Selected |
|--------|-------------|----------|
| Single line on stderr with token-hash + path + reason (Recommended) | Visible breadcrumb in foreground stream; no new file | ✓ |
| Log all prepare attempts (allowed and blocked) | Full audit; noisy in foreground mode | |
| No special logging; rely on access log | Loses 'this was blocked because' signal | |

**User's choice:** Single line on stderr with token-hash + path + reason (Recommended)
**Notes:** Maps to D-15.

### Tailscale / 0.0.0.0 bind behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Same behaviour, no extra friction (Recommended) | CIDR + bearer already gate; iPad register works | ✓ |
| Block /register-prepare entirely on non-loopback | iPad cannot register; breaks 'any device' UX | |
| Require extra confirmation field | Doubles up on the prepare/confirm second factor | |

**User's choice:** Same behaviour, no extra friction (Recommended)
**Notes:** Maps to D-16.

### Already-registered prepare response

| Option | Description | Selected |
|--------|-------------|----------|
| 200 with alreadyRegistered: true, existing entry, no nonce (Recommended) | Idempotent UX; mirrors Phase 1 D-10 'skip with notice' | ✓ |
| 200 with nonce — confirm becomes a no-op | Modal can't distinguish until after confirm | |
| 409 Conflict | Forces non-success path for benign case | |

**User's choice:** 200 with alreadyRegistered: true, existing entry, no nonce (Recommended)
**Notes:** Maps to D-17.

### Expired nonce on confirm

| Option | Description | Selected |
|--------|-------------|----------|
| 410 Gone; SPA auto re-prepares and re-renders (Recommended) | Brief refreshing… state; no manual retry | ✓ |
| 410; SPA shows 'expired, please retry' button | Manual click; rare edge case for 5-min TTL | |
| Daemon refreshes nonce automatically | Hides expiry; defeats option C if symlink moved | |

**User's choice:** 410 Gone; SPA auto re-prepares and re-renders (Recommended)
**Notes:** Maps to D-18.

### Pending nonce localStorage persistence

| Option | Description | Selected |
|--------|-------------|----------|
| No — nonce dies with the modal (Recommended) | Refresh = reopen + reprepare; ephemeral by design | ✓ |
| Yes — store under agentic-dashboard:pending-register | Survives refresh; localStorage shape to maintain | |
| Yes — sessionStorage only | Halfway compromise | |

**User's choice:** No — nonce dies with the modal (Recommended)
**Notes:** Maps to D-19.

---

## Register modal UX & scope

### Modal anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| Single-field path → preview → optional fields on confirm step (Recommended) | Two visual states share modal; matches prepare/confirm naturally | ✓ |
| All fields visible from the start | Single form; messy when path errors clear | |
| Wizard with explicit Step 1 / Step 2 | Most clicks; overkill for 4 fields | |

**User's choice:** Single-field path → preview → optional fields on confirm step (Recommended)
**Notes:** Maps to D-20.

### Suggested name and tags

| Option | Description | Selected |
|--------|-------------|----------|
| Name = basename(canonicalRoot), no tag suggestions (Recommended) | Daemon returns suggestedName; tags default empty (D-12 alignment) | ✓ |
| Name + auto-detected tags from project markers | Saves clicks; bakes folder conventions D-12 rejected | |
| Name only — user types tags from scratch | No chip helper; smallest UI | |

**User's choice:** Name = basename(canonicalRoot), no tag suggestions (Recommended)
**Notes:** Maps to D-21.

### Tag input

| Option | Description | Selected |
|--------|-------------|----------|
| Free text + chip suggestions of existing tags (Recommended) | Convention emerges from use; vocabulary stays open | ✓ |
| Free text only | Smallest UI; user types every tag every time | |
| Fixed chip set | Predictable filter; kills open vocabulary | |

**User's choice:** Free text + chip suggestions of existing tags (Recommended)
**Notes:** Maps to D-22.

### Manage existing projects scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unregister via inline link; rename/tag deferred (Recommended) | Smaller scope; spec line 396 sub-route in Phase 6 | |
| Full /settings/projects sub-route in this phase | Pulls Phase 6 scope forward | |
| Inline rename/tag/unregister via right-click context menu | Power-user UX; bigger build | ✓ |

**User's choice:** Inline rename/tag/unregister via right-click context menu (deviation from recommendation)
**Notes:** Donald wants the full management UX in Phase 3 via context menu rather than a separate sub-route. Maps to D-23. Pulls in two new HTTP routes (rename/tags) — see D-24.

### Rename / tag HTTP routes

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add POST /api/registry/{id}/rename and /tags (Recommended) | Registry-only writes per spec line 318; no nonce needed | ✓ |
| Add only rename; tag stays CLI-only | Inconsistent menu | |
| Reconsider — defer right-click menu to Phase 6 | Course-correct back to spec line 396 | |

**User's choice:** Yes — add POST /api/registry/{id}/rename and /tags (Recommended)
**Notes:** Maps to D-24.

### Touch / no-mouse triggers for context menu

| Option | Description | Selected |
|--------|-------------|----------|
| Long-press + right-click + ⋮ kebab button (Recommended) | Three triggers, same menu; touch-friendly; keyboard-accessible | ✓ |
| Right-click only | Desktop-only; breaks 'any device' core value | |
| Always-visible inline action chips | Crowds card; fights spec layout | |

**User's choice:** Long-press + right-click + ⋮ kebab button (Recommended)
**Notes:** Maps to D-23 (combined trigger contract).

### Optimistic add on register-confirm

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic — add immediately, reconcile via refetch (Recommended) | ~16 ms card appearance; beats acceptance criterion 4 by 100× | ✓ |
| Wait for /api/registry refetch | One round-trip later (100–500 ms) | |
| Refetch every 5 s naturally | Up-to-5 s; meets criterion technically; sluggish | |

**User's choice:** Optimistic — add card immediately, reconcile via /api/registry refetch (Recommended)
**Notes:** Maps to D-25.

### Modal close semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Esc + backdrop + X close; unsaved warns (Recommended) | Three triggers + inline 'Discard?' on dirty state | ✓ |
| Esc + X only — backdrop ignored | Avoids accidental dismiss; good for stateful forms | |
| All triggers close, no warn | Easier code; user can lose 30s of typing | |

**User's choice:** Esc closes; backdrop click closes; X button closes; unsaved input warns (Recommended)
**Notes:** Maps to D-26.

### Blocked-path modal UI

| Option | Description | Selected |
|--------|-------------|----------|
| Step-2 with disabled Confirm + red 'Blocked: <reason>' banner (Recommended) | User sees canonical path the daemon resolved; mirrors option C contract | ✓ |
| Stay on step 1 with inline error | Loses canonical-path transparency value | |
| Toast + close modal | User has no chance to read or retry | |

**User's choice:** Step-2 with disabled Confirm + red 'Blocked: <reason>' banner (Recommended)
**Notes:** Maps to D-27.

### Prepare network/drift error in modal

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error in modal step 1, Retry button, no auto-retry (Recommended) | User input preserved; SchemaDriftState for drift; RepairBanner for 401 | ✓ |
| Close modal, surface error in global toast | Loses typed path; bad UX for transient hiccup | |
| Auto-retry once, then inline error | Conflicts with Phase 2 D-07 'no auto-retry' principle | |

**User's choice:** Inline error in modal step 1, Retry button, no auto-retry (Recommended)
**Notes:** Maps to D-28.

### Focus return after register-confirm

| Option | Description | Selected |
|--------|-------------|----------|
| On the newly-added card (Recommended) | Donald can hit Enter to drill in immediately; keyboard-friendly | ✓ |
| On the '+ Register project' card | Standard accessibility default | |
| On the home grid container | Focus on wrapper; loses both affordances | |

**User's choice:** On the newly-added card (Recommended)
**Notes:** Maps to D-29.

### Soft hint for marker-less paths

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — step 2 muted info note 'No project markers detected' (Recommended) | Helps avoid registering ~/Downloads by accident | ✓ |
| No — register without prejudice | Spec line 164 already handles unreachable; this is redundant | |
| Yes — hard-block registration | Too rigid; spec allows free-form register | |

**User's choice:** Yes — step 2 shows a soft 'No project markers detected. Register anyway?' hint (Recommended)
**Notes:** Maps to D-30.

### Step 1 Enter-key

| Option | Description | Selected |
|--------|-------------|----------|
| Enter advances to /prepare (Recommended) | Equivalent to Preview click; doesn't accidentally double-Enter register | ✓ |
| Enter does nothing on step 1 | Forces Preview click | |
| Enter submits the entire register flow | Defeats option C | |

**User's choice:** Enter advances to /prepare (Recommended)
**Notes:** Maps to D-31 (step 1 row).

### Step 2 Enter-key

| Option | Description | Selected |
|--------|-------------|----------|
| Enter on name field → confirm; Enter on tag input → add chip; elsewhere → no-op (Recommended) | Predictable; matches Phase 2 WR-04 pattern | ✓ |
| Enter anywhere submits Confirm | Conflicts with 'Enter adds a tag' | |
| Enter never submits | Mouse-only; worse keyboard UX | |

**User's choice:** Enter on name field submits register-confirm; Enter elsewhere does not (Recommended)
**Notes:** Maps to D-31 (step 2 row).

### Modal hotkey

| Option | Description | Selected |
|--------|-------------|----------|
| No — defer to Phase 6 POLISH-01 (Recommended) | Phase 6 owns full keyboard surface; '+ Register project' card is Tab-accessible | |
| Yes — 'n' opens the modal | Mnemonic; conflicts with Phase 6 future shortcuts | |
| Yes — Cmd/Ctrl+K opens command-palette-style | Bigger UI surface; one action | ✓ |

**User's choice:** Yes — Cmd/Ctrl+K opens command-palette-style (deviation from recommendation)
**Notes:** Donald wants a Cmd+K binding. See follow-up below.

### Cmd/Ctrl+K scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single-action: opens register modal directly (Recommended for v1) | One handler, one shortcut; Phase 6 polish can grow it | |
| Full command palette with actions list | Linear/Raycast-style fuzzy palette; multiple actions; ~1 day extra | ✓ |
| Defer Cmd/Ctrl+K to Phase 6 | Tab-to-card stays the only register affordance | |

**User's choice:** Full command palette with actions list (deviation from recommendation)
**Notes:** Maps to D-32. Scope-significant; planner may split into its own plan or recommend deferring to Phase 6 if Phase 3 grows past three sessions.

### Register success logging

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — single line on stdout, same format as blocked log (Recommended) | Symmetry with BLOCKED line; explicit signal | |
| Yes — also log unregister/rename/tag mutations | Full audit trail; more log noise | |
| No additional logging | Standard request log covers it | ✓ |

**User's choice:** No additional logging
**Notes:** Maps to D-33. Donald considers the standard request log line sufficient — only blocked attempts get the explicit BLOCKED breadcrumb (D-15).

---

## Card layout + filter / search / sort + impeccable defense

### Card fidelity to spec ASCII

| Option | Description | Selected |
|--------|-------------|----------|
| Match spec layout, render with restraint (Recommended) | ~10 lines per card always; Unicode glyphs; design tokens | |
| Compact — name + phase + last commit only | Loses at-a-glance finding signal | |
| Rich + collapsible — compact default, hover/click expands | More state to test; progressive disclosure | ✓ |

**User's choice:** Rich + collapsible — default compact, hover/click-to-expand reveals more (deviation from recommendation)
**Notes:** Maps to D-34. Donald prefers progressive disclosure: compact default for scanning, hover/focus reveals deep data.

### Card expand interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Hover → inline expand (no animation jump); click stays as 'open project' (Recommended for impeccable) | Opacity + max-height transition (~120 ms); long-press on touch | ✓ |
| Click → expand; click again → collapse; second click → navigate | Two-step click; mixed-use confusion | |
| Always expanded; ⋮ menu hides 'compact mode' user setting | Closer to spec ASCII; new settings surface | |

**User's choice:** Hover → inline expand (no animation jump); click stays as 'open project' (Recommended for impeccable)
**Notes:** Maps to D-34 (interaction model row).

### Card line-count budget

| Option | Description | Selected |
|--------|-------------|----------|
| Compact ~5 lines, expanded adds ~5 more (Recommended) | Six cards visible compact on 1080p; matches spec at expanded | ✓ |
| Compact 3 lines, expanded spec verbatim | Tight default; sparse | |
| No expand state — always show everything | Drops the progressive disclosure choice | |

**User's choice:** Compact ~5 lines, expanded adds ~5 more (Recommended)
**Notes:** Maps to D-35.

### Finding count rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Coloured Unicode glyphs per spec ASCII (🔴 🟡 🟢) (Recommended) | Three monospaced groups; aria-labels for a11y | ✓ |
| Coloured Tailwind dots + numeric labels | More designer-controlled colour | |
| Inline mini-bar (red/yellow/green stacked) | New visual language; impeccable risk | |

**User's choice:** Coloured glyphs per spec ASCII (🔴 0 🟡 2 🟢 5) (Recommended)
**Notes:** Maps to D-36.

### Filter chip set

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed-known + derived overflow (Recommended) | all/active/client/internal + dynamic chips for other tags | ✓ |
| Fixed only — ignore tags outside the four | Loses 'archived' as a dim signal | |
| Fully derived | Unpredictable layout | |

**User's choice:** Fixed-known + derived overflow (Recommended)
**Notes:** Maps to D-38.

### Search box scope

| Option | Description | Selected |
|--------|-------------|----------|
| Name, client, tags, current phase dirname (Recommended) | Lower-cased substring; pure client-side | ✓ |
| Name only | Smallest scope; loses 'all client projects' affordance | |
| Name + tags only | Mid-scope; misses client and phase | |

**User's choice:** Name, client, tags, current phase dirname (Recommended)
**Notes:** Maps to D-39.

### Sort behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Spec lock with unreachable last (Recommended) | Hard-coded sort; no UI control | |
| Spec lock + 'sort by name' toggle | Default per spec; one alternate | |
| Fully user-selectable sort (last commit / name / phase / client) | Drop-down with multiple options | ✓ |

**User's choice:** Fully user-selectable sort (last commit / name / phase / client) (deviation from recommendation)
**Notes:** Donald wants the override. See follow-up below for default semantics.

### Sort default vs override semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Spec default sticks; UI control overrides for the session only (Recommended) | Honors spec on every load; override is purely additive | ✓ |
| Spec default sticks; UI choice persists in localStorage | Adds localStorage key; Phase 6 polish can persist | |
| User's last choice becomes the new default | Decouples from spec line 455 | |

**User's choice:** Spec default sticks; UI control overrides for the session only (Recommended)
**Notes:** Maps to D-40. Spec extension flag for the planner to surface in PLAN.md.

### Sort UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Single dropdown next to search (Recommended) | Compact toolbar slot; 'Recommended' label = spec default | ✓ |
| Click column-header style | Cards aren't tabular; fights layout | |
| Toolbar of sort buttons | Crowds horizontal space | |

**User's choice:** Single dropdown next to search (Recommended)
**Notes:** Maps to D-40 (UI row).

### Anti-AI-slop additions

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 baseline + no skeleton-shimmer + no rotate/scale on hover (Recommended) | Static — placeholders; opacity+max-height only | ✓ |
| Phase 2 baseline only | Trust Phase 6 critique gate | |
| Stricter — monochrome cards | Drops coloured finding glyphs; spec uses them | |

**User's choice:** Inherit Phase 2 baseline + extra rule for cards: no skeleton-shimmer, no hover-rotate/scale (Recommended)
**Notes:** Maps to D-42 / D-43.

### Empty-phase card body

| Option | Description | Selected |
|--------|-------------|----------|
| 'no .planning/' + 'install workflow skill →' link (Recommended) | Spec line 435/437 verbatim | ✓ |
| 'Phase —' (em dash) | Minimal; less helpful | |
| Card hidden until project initialised | Loses 'project needs setup' visibility | |

**User's choice:** 'no .planning/' line + 'install workflow skill →' link (Recommended)
**Notes:** Maps to D-44.

### Pagination / virtualisation

| Option | Description | Selected |
|--------|-------------|----------|
| No virtualisation in v1; native CSS grid; revisit at 50+ projects (Recommended) | Donald has ~5–10 today; CSS grid scales | ✓ |
| Virtualise from start with react-window | Adds dependency + fixed-height constraint | |
| Pagination at 24 per page | Loses 'see everything at once' ethos | |

**User's choice:** No virtualisation in v1; ship native CSS grid; revisit if Donald hits 50+ projects (Recommended)
**Notes:** Maps to D-41.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` Claude's Discretion subsection. Highlights:
- Empty-grid (zero registered projects + paired) routing — extend Phase 2 index `beforeLoad` or render zero-state in MultiProjectHome.
- ProjectOverviewSchema exact field naming — D-08 sketches the contract; planner names fields.
- Optimistic-update rollback paths beyond refetch reconciliation.
- Touch long-press timing tuning.
- Cmd/Ctrl+K palette internal layout.
- TanStack Query cache key shape.
- Daemon-side cache eviction strategy.
- Test layout across vitest + in-process Hono + subprocess.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Highlights:
- `/settings/projects` standalone management sub-route (Phase 6 polish).
- Sort persistence across sessions (Phase 6).
- Pagination / virtualisation (revisit at 50+ projects).
- localStorage for pending nonce / register continuity.
- `/projects/{id}` three-column content (Phase 4 + 5).
- AgentLinter / Skill health (Phase 5).
- Sentry / Linear / Infisical (Phase 5 status, Phase 7+ integration).
- Keyboard shortcuts beyond Cmd/Ctrl+K (Phase 6).
- `impeccable:critique` ≥ 90 hard gate (Phase 6).
- Custom domain flip (Phase 6).
- Command palette action expansion beyond v1's four actions.
- Audit trail of registry mutations (D-33 declined for v1).
