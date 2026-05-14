# Phase 10: Coverage Matrix Page — UI Design Contract

**Generated:** 2026-05-13
**Status:** Locked (input to /gsd-plan-phase 10)
**Phase:** 10 — Coverage Matrix Page
**Route:** `/coverage` (under `_appshell`)
**Authoritative inputs:** `10-CONTEXT.md` (8 user-locked decisions); Phase 05.1 `tokens.css` (warm paper / aubergine / accent purple); Phase 3 `HomeToolbar` (filter chips + search pattern); Phase 5 `panels/` convention.

---

## 1. Domain — What this page shows

A single page that surfaces the **presence + freshness** of four knowledge artifacts across every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}`. Family-grouped layout, sticky family headers, four-state freshness per column, override chip when phase-level review-skip sentinels exist, per-row refresh action.

The page answers: **"Which repos are doing their knowledge-layer homework, and what should I `wiki-compile` / `gitnexus analyze` / author next?"**

## 2. Layout

```
┌─ AppShellV2: TopBar + Breadcrumb (existing) ────────────────────┐
│                                                                  │
├─ Sidebar (existing) ─┬─ Main Content (max-w-7xl, mx-auto) ──────┤
│                      │                                          │
│  Projects            │  PageHeader                              │
│  ──────────          │  ┌─────────────────────────────────────┐ │
│  Observability ◀ NEW │  │ Coverage                            │ │
│  └─ Coverage  ◀ NEW │  │ Per-repo knowledge-layer freshness  │ │
│                      │  │                  [Refresh stale ▶] │ │
│  Help                │  └─────────────────────────────────────┘ │
│                      │                                          │
│                      │  CoverageToolbar (sticky-on-scroll)      │
│                      │  ┌─────────────────────────────────────┐ │
│                      │  │ [all] [✕ miss] [⚠ stale] [✓ fresh] │ │
│                      │  │ [Search repos...........]            │ │
│                      │  └─────────────────────────────────────┘ │
│                      │                                          │
│                      │  CoverageFamilySection × 3               │
│                      │  ┌─────────────────────────────────────┐ │
│                      │  │ ── agenticapps    ✕2 ⚠1 ✓4    [▼] │ │
│                      │  │   Repo               CLAUDE GitNex   │ │
│                      │  │                      Wiki   Workflow │ │
│                      │  │   agenticapps-dash.. ✓ ⚪ ✓ ✓1.7.0  │ │
│                      │  │   claude-workflow   ✓ ⚪ ✓ ✓1.7.0  │ │
│                      │  │   ⚠ 2 overrides     ↑ expandable    │ │
│                      │  │   ...                                │ │
│                      │  └─────────────────────────────────────┘ │
│                      │  (factiv section)                        │
│                      │  (neuroflash section)                    │
└──────────────────────┴──────────────────────────────────────────┘
```

## 3. Component composition

```
<CoverageRoute>                       (createLazyRoute('/coverage'))
  └ <CoveragePage>                    (top-level component)
     ├ <PageHeader title="Coverage"
     │             subtitle="..." 
     │             actions={<RefreshAllStaleButton />} />
     ├ <CoverageToolbar>              (sticky on scroll)
     │   ├ <StatusFilterChips />      (filter chip group; "all" default)
     │   └ <RepoSearchInput />        (free-text, debounced 200ms)
     ├ <CoverageGitNexusBanner />     (conditional: shown when ~/.gitnexus absent)
     ├ <CoverageFamilySection family="agenticapps" rows={...} />
     ├ <CoverageFamilySection family="factiv" rows={...} />
     └ <CoverageFamilySection family="neuroflash" rows={...} />

<CoverageFamilySection>               (sticky family header + per-repo rows)
  ├ <FamilyHeader>                    (sticky on scroll within section)
  │   ├ family name
  │   ├ <FamilyAggregateCounts>       (✕ N · ⚠ N · ✓ N — reflects filter)
  │   └ <CollapseToggle />
  └ <CoverageRow repo={...} />[]      (rendered when section expanded)

<CoverageRow>                         (one row per repo)
  ├ <RepoIdentity>
  │   ├ repo name
  │   └ <OverrideChip count={N} />    (conditional — shows N>0)
  ├ <CoverageCell column="claudeMd" state={...} />
  ├ <CoverageCell column="gitNexus" state={...} />
  ├ <CoverageCell column="wiki"     state={...} />
  ├ <CoverageCell column="workflow" state={...} />
  └ <CoverageRowActions />            (refresh icon — varies by stale columns)

<CoverageCell>                        (one cell — visual representation of state)
  ├ <CoverageStatusIcon state={...} />  (✓ / ⚠ / ✕ / ⚪)
  └ <CoverageStatusLabel>              (e.g. "fresh", "stale 22d", "1.7.0", "Not installed")
```

## 4. Visual tokens (from locked `tokens.css`, Phase 05.1)

**State → token mapping** (mandatory; planner translates these to Tailwind classes):

| State | Icon | Background | Foreground | Border (when needed) |
|---|---|---|---|---|
| `fresh` | ✓ | `bg-status-success/10` | `text-status-success` | `border-status-success/30` |
| `stale` | ⚠ | `bg-status-warning/10` | `text-status-warning` | `border-status-warning/30` |
| `missing` | ✕ | `bg-status-error/10` | `text-status-error` | `border-status-error/30` |
| `not-applicable` | ⚪ | `bg-text-tertiary/10` | `text-text-tertiary` | `border-text-tertiary/30` |
| `unknown` | ? | `bg-status-warning/10` | `text-status-warning` | `border-status-warning/30` (treat as stale) |

**Override chip**: `bg-status-warning/10 text-status-warning` with `rounded-md px-2 py-0.5 text-xs`. Icon: `⚠` (lucide-react `AlertTriangle`, 12px). Always rendered when count > 0; never rendered when count == 0.

**Page chrome**: standard `tokens.css` — `bg-app-bg` page, `bg-card-bg` for each `CoverageFamilySection`, `text-text-primary` for repo names, `text-text-secondary` for descriptions, `text-text-tertiary` for cell labels.

**Refresh action button**: `bg-accent hover:bg-accent-hover text-card-bg` (matches existing primary action button pattern).

**Filter chips**: Reuse `<StatusPill>` from Phase 05.1 primitives with `variant="filter"` (planner adds variant if missing). Selected state: `bg-accent text-card-bg`; unselected: `bg-card-bg text-text-secondary border border-divider-soft`.

**No hex literals. No shadcn-style alias names (`bg-background`, `text-foreground`, etc.). Phase 05.1 contract is non-negotiable.**

## 5. Interaction states

### Status filter chips
- Default state: `[all]` selected, all others deselected.
- Multi-select: `[✕ missing]` + `[⚠ stale]` both selected at once → matrix shows union (missing OR stale).
- Toggling any non-"all" chip deselects "all" automatically.
- Toggling "all" deselects all other chips.
- If all four chips end up deselected, auto-select "all" (don't allow empty filter state).

### Search input
- 200ms debounced.
- Matches case-insensitive substring against repo name (not family name).
- Empty search = no filter applied.
- Filter chips and search compose with AND semantics.

### Family section collapse
- Default state: all expanded.
- Collapse state persisted in `localStorage` under key `coverage:section-collapsed:<family>` (boolean).
- Sticky family header remains visible when scrolling within an expanded section.

### Override chip expansion
- Click chip to expand inline: shows `<phase-slug> — sentinel since <ISO-date>` rows.
- Re-click to collapse.
- Keyboard: `Enter` / `Space` toggle when chip has focus.
- ARIA: `<button aria-expanded={...} aria-controls="overrides-list-<repo>">`.

### Per-row refresh action
- Hover/focus on row reveals the refresh icon button (right-aligned, `text-text-tertiary` default → `text-accent` on hover).
- Click opens a popover offering the available remediations based on the row's stale columns:
  - Wiki stale → "Run `wiki-compile` for this family" button (spawns daemon action; shows progress; toast on success)
  - GitNexus stale → "Run `gitnexus analyze` for this repo" button (spawns daemon action)
  - CLAUDE.md missing → "How to add CLAUDE.md" link to `/help/operations/install#claude-md-bootstrap` (Phase 7 docs)
  - Workflow version mismatch → "Copy `/update-agenticapps-workflow`" button (clipboard + toast)
- Popover dismisses on outside-click, Esc, or after action completes.

### "Refresh all stale" page-header action
- Disabled when 0 stale rows.
- Click opens a confirm dialog: "Refresh N stale entries across M repos. wiki-compile + gitnexus analyze will be spawned sequentially. Continue?"
- Confirm → daemon serializes the spawns (one at a time), shows per-step toast.
- Clipboard-only actions (workflow-version mismatch) are listed at the end with a "Copy commands for terminal" affordance instead of being auto-spawned.

## 6. Empty states

| Condition | Empty state |
|---|---|
| All filters return zero rows | EmptyState component: "No repos match your filters. [Clear filters]" |
| `~/.gitnexus/` absent | Banner at top of page (not blocking): "GitNexus is not installed. Install with `npm install -g gitnexus` to enable the GitNexus column. [Copy install command]" |
| No sentinels exist anywhere | Override chip never renders (no global "0 overrides found" UI — that's noise) |
| Daemon `/api/coverage` returns 500 | InlineDrift (Phase 4 pattern) under the toolbar: "Coverage scan failed — see daemon logs. [Retry]" |
| Daemon returns valid but empty matrix (no repos in any family) | EmptyState: "No git repos found under ~/Sourcecode/{agenticapps,factiv,neuroflash}. Make sure the directories exist and contain initialized repos." |

## 7. Accessibility

- **Keyboard navigation**: Tab order is page-header → toolbar (chips → search) → first family section header → expand toggle → first row of cells → override chip (if present) → next row. Skip-to-content link at top.
- **ARIA**:
  - Family section header: `<button aria-expanded={collapsed} aria-controls="family-<name>-body">`
  - Filter chips: `role="group" aria-label="Filter by status"`, each chip is a `<button aria-pressed={selected}>`
  - Cells: `aria-label="<column> for <repo>: <state> — <detail>"` (screen-reader-friendly)
  - Override chip: `aria-label="N phase reviews overridden in <repo>"`
- **Focus rings**: Use `tokens.css` focus ring (`focus:ring-2 focus:ring-accent`) on every interactive element.
- **Status icons**: never relied on color alone — every state has an icon shape (✓ ⚠ ✕ ⚪) plus a text label. Color-blind users see the icon shape; everyone sees both.
- **Reduced motion**: Section collapse/expand uses `transition: max-height 200ms ease-out` but respects `prefers-reduced-motion: reduce` (no transition, snap).

## 8. Responsive behaviour

Desktop-first per Phase 5/7 stance (the dashboard is desktop-first). At narrow widths:
- `< 768px`: family sections stack; toolbar wraps (chips on one line, search on next); rows transition to a card-style layout (4 cells stack vertically per row).
- `>= 768px`: standard 4-column matrix.

Planner explicitly sizes this if QA flags narrow-screen issues. Not a v1 blocker.

## 9. Loading + skeleton states

- **First load (no cache)**: render skeleton family sections with three placeholder rows each, animated shimmer. Replace with real data on response.
- **Refetch (poll or refresh)**: do not show a full skeleton; show a small spinner in the page-header next to "Refresh stale" plus a "last refreshed N seconds ago" timestamp.
- **Refresh-action in flight**: spinner inside the affected row's refresh icon; row's cells get a subtle opacity dim (0.7) while in-flight.

## 10. Telemetry / observability

None on the SPA side (project non-negotiable: no analytics, no telemetry). Daemon logs scan duration + cache hit/miss to `~/.agenticapps/dashboard/logs/daemon.log` (existing log pattern from Phase 1). Logged fields: `coverage_scan_duration_ms`, `coverage_repos_scanned`, `coverage_cache_hit` (boolean).

## 11. Test coverage contract

Each panel/component has a co-located `.test.tsx` (Phase 5 D-5-02 convention):

- `CoveragePage.test.tsx` — renders page-header, toolbar, three family sections; renders banner when GitNexus absent
- `CoverageToolbar.test.tsx` — filter chip multi-select behaviour, search debouncing, URL param sync
- `CoverageFamilySection.test.tsx` — sticky header, aggregate counts (reflecting filtered view), collapse state persistence
- `CoverageRow.test.tsx` — renders 4 cells per row, conditional override chip, refresh action popover
- `CoverageCell.test.tsx` — renders correct icon + label + color tokens for each of the 5 states
- `OverrideChip.test.tsx` — expand/collapse, ARIA, count rendering
- `CoverageEmptyState.test.tsx` — each empty-state branch (no-results / no-gitnexus / scan-failed / no-repos)

Plus Playwright e2e covering: cold-load matrix render, status filter, search filter, override chip expansion, refresh-action popover dismissal, keyboard navigation through the page.

## 12. Out-of-scope visual elements (explicitly deferred)

- Cross-family aggregate "health score %" hero number at top of page — deferred to v1.2 follow-up.
- Per-repo drill-down detail page — no nav from /coverage to /coverage/$repo in v1.
- Animated transitions on filter change (entry/exit animations for rows) — instant filter is fine for v1.
- Family-color theming (each family gets a tint) — single neutral palette across families; "Sourcecode CLAUDE.md" boundary is conceptual, not chromatic.
- Dark mode adjustments beyond what tokens.css already provides — Phase 7 closed `dark:prose-invert` for docs; Phase 10 inherits the same light-only stance for v1.

---

*Linked decisions:* D-10-01 (data acquisition), D-10-02 (refresh action), D-10-03 (cross-family display), D-10-04 (override surfacing), D-10-05 (repo discovery), D-10-06 (workflow version), D-10-07 (sort + filter), D-10-08 (sidebar slot).
*Token contract:* Phase 05.1 `tokens.css` — non-negotiable.
*Layout primitive reuse:* `PageHeader`, `Card`, `Pill`, `StatusPill`, `MetricNumeric`, `EmptyState`, `KbdHint` (all Phase 05.1).
*Pattern reuse:* `HomeToolbar` (Phase 3 — chips + search), `PanelContainer` (Phase 5 — section header + body), `InlineDrift` (Phase 4 — schema-drift surface).
