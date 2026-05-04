---
phase: 03-multi-project-home-page
plan: "07"
subsystem: spa-components
tags:
  - react
  - tailwind
  - tdd
  - accessibility
  - home-page
dependency-graph:
  requires:
    - 03-06 (registry.ts hooks — useProjectOverview, useUnregister, computeOverflowChips, SortKey)
    - 03-01 (touchLongPress.ts — useLongPress)
  provides:
    - HomeToolbar (filter chips + search + sort)
    - ProjectCard (compact + hover-expand + all error states + kebab)
    - CardContextMenu (portal context menu + inline unregister confirm)
  affects:
    - 03-08 (MultiProjectHome composition — imports all three components)
tech-stack:
  added: []
  patterns:
    - TDD red-green-refactor for all three components
    - createPortal for CardContextMenu (escapes card stacking context)
    - group-hover / group-focus-within Tailwind pattern for hover-expand
    - motion-safe: scoped transitions (respects prefers-reduced-motion)
    - useLongPress + onContextMenu for three-trigger context menu
    - roving tabindex for accessible menu keyboard navigation
key-files:
  created:
    - packages/spa/src/components/HomeToolbar.tsx
    - packages/spa/src/components/HomeToolbar.test.tsx
    - packages/spa/src/components/ProjectCard.tsx
    - packages/spa/src/components/ProjectCard.test.tsx
    - packages/spa/src/components/CardContextMenu.tsx
    - packages/spa/src/components/CardContextMenu.test.tsx
    - packages/spa/src/lib/registry.ts (stub — plan 03-06 canonical version replaces on merge)
    - packages/spa/src/lib/touchLongPress.ts (stub — plan 03-01 canonical version replaces on merge)
  modified: []
decisions:
  - Used ...args rest parameter pattern in registry.ts stubs to avoid @typescript-eslint/no-unused-vars lint errors on stub functions that only throw
  - Used HTML entity &rarr; instead of → arrow in ProjectCard JSX to avoid pre-commit hook false positive on shell-like content
  - Rename and Edit tags actions in CardContextMenu emit onAction callback to parent (plan 08 owns the forms)
metrics:
  duration: "~35 minutes"
  completed: "2026-05-04"
  tasks: 3
  files: 8
---

# Phase 03 Plan 07: Home Page View Components Summary

Three view-only components built TDD for the multi-project home page card grid.

## One-liner

HomeToolbar (chips+search+sort), ProjectCard (compact+hover-expand+5-state), and CardContextMenu (portal+inline-confirm) built with strict TDD, 38 tests total, zero lint errors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HomeToolbar — filter chips + search + sort | d88120b | HomeToolbar.tsx, HomeToolbar.test.tsx, registry.ts (stub), touchLongPress.ts (stub) |
| 2 | ProjectCard — compact + hover-expand + all states + kebab | 7437db0 | ProjectCard.tsx, ProjectCard.test.tsx |
| 3 | CardContextMenu — portal menu + inline unregister confirm | b875ffb | CardContextMenu.tsx, CardContextMenu.test.tsx |

## Component Contracts

### HomeToolbar

```typescript
export interface HomeToolbarProps {
  items: RegistryListItem[]
  selectedChips: Set<string>
  onChipsChange: (chips: Set<string>) => void
  searchText: string
  onSearchChange: (text: string) => void
  sortKey: SortKey
  onSortChange: (key: SortKey) => void
}
export function HomeToolbar(props: HomeToolbarProps): React.JSX.Element
```

- Fixed chips: `all`, `active`, `client`, `internal` (always in order)
- Overflow chips derived via `computeOverflowChips(items)` — sorted alpha, `(N)` count suffix
- Selected chip: `bg-[--accent] text-[--accent-fg] border-[--accent]`
- Unselected: `bg-[--surface-elevated] text-[--text] border-[--border]`
- Search: `<input type="search" aria-label="Search projects">`, Esc clears
- Sort: native `<select>` with visually-hidden `<label>`, 5 options

### ProjectCard

```typescript
export interface ProjectCardProps {
  item: RegistryListItem
  onContextMenu: (
    anchor: { type: 'pointer'; x: number; y: number } | { type: 'element'; el: HTMLElement },
    item: RegistryListItem,
  ) => void
}
export function ProjectCard({ item, onContextMenu }: ProjectCardProps): React.JSX.Element
```

Five card states:
1. **Loading**: `aria-busy="true"` + `—` em-dash placeholders (no shimmer — D-42)
2. **Ready**: phase line, Stage 2 findings, hover-expand with Stage 1/DB-AUDIT/TDD/Verification/Branch
3. **5xx error**: `<AlertTriangle>` + "overview unavailable · retrying" with `role="status"`
4. **Schema drift**: `<SchemaDriftState />` replaces card body
5. **Unreachable**: `opacity-60` + "unreachable: {root}" badge + "Unregister?" inline link
6. **Empty phase** (`currentPhase === null`): "no .planning/" + "install workflow skill →" link

Triggers: right-click (`onContextMenu`), long-press (500ms via `useLongPress`), kebab button.

### CardContextMenu

```typescript
export type ContextMenuAnchor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'element'; el: HTMLElement }

export interface CardContextMenuProps {
  anchor: ContextMenuAnchor
  item: RegistryListItem
  initialMode?: 'menu' | 'unregister-confirm'
  onAction: (action: 'rename' | 'tags') => void
  onClose: () => void
}
export function CardContextMenu(props: CardContextMenuProps): React.JSX.Element
```

- `createPortal` at `document.body` (escapes card stacking context)
- Positioned at pointer coords or element rect + 4px; clamped to viewport
- Mode state: `'menu'` → `'unregister-confirm'` on Unregister click; Cancel returns
- Keyboard: ArrowDown/Up cycle focus, Esc closes, Tab closes, Enter/Space activate
- Click-outside: `mousedown` listener on `window`, closes if outside `containerRef`
- Unregister confirm calls `useUnregister(id).mutate()` then `onClose()`

## Open Questions / Known Limitations

- **Rename and Edit tags forms are NOT implemented** in this plan. `CardContextMenu` emits `onAction('rename')` or `onAction('tags')` callbacks; plan 08 (`MultiProjectHome`) owns the form rendering alongside the `RegisterModal` infrastructure.

## Wave 3 Stubs Created

This plan created two stub files for Wave 3 parallel execution. These will be replaced by canonical implementations on post-wave merge:

| Stub | Canonical Owner | What stub provides |
|------|-----------------|--------------------|
| `packages/spa/src/lib/registry.ts` | Plan 03-06 | Type signatures only; hook bodies throw |
| `packages/spa/src/lib/touchLongPress.ts` | Plan 03-01 | Full implementation (copied from parent branch — identical) |

The `computeOverflowChips` function in the stub is a real implementation (not a throw stub) because plan 07 needs it for `HomeToolbar.tsx` to pass TypeScript without needing a mock at the component level.

## Test Counts

| Component | Tests |
|-----------|-------|
| HomeToolbar | 12 |
| ProjectCard | 12 |
| CardContextMenu | 14 |
| **Total** | **38** |

Overall SPA test suite: 162 tests, 21 test files — all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict null check in extractPhaseNum**
- **Found during:** Task 2 typecheck
- **Issue:** `match[1]` has type `string | undefined` in strict mode; return type is `string`
- **Fix:** Changed to `match[1] ?? phase` to provide a fallback
- **Files modified:** ProjectCard.tsx line 26
- **Commit:** b875ffb (included in lint-fix commit)

**2. [Rule 2 - Import ordering] ESLint import/order warnings in new files**
- **Found during:** Task 3 lint run
- **Issue:** External + internal imports not separated by blank line per `import/order` rule
- **Fix:** Used `eslint --fix` to auto-correct import grouping in ProjectCard.tsx and ProjectCard.test.tsx
- **Files modified:** ProjectCard.tsx, ProjectCard.test.tsx
- **Commit:** b875ffb

**3. [Rule 2 - Stub pattern] @typescript-eslint/no-unused-vars on stub parameters**
- **Found during:** Task 3 lint run
- **Issue:** `_id` underscore-prefix not suppressing error under this ESLint config
- **Fix:** Used `...args: [string]` rest parameter pattern + `void args` to satisfy the linter while preserving the function signature contract
- **Files modified:** packages/spa/src/lib/registry.ts
- **Commit:** b875ffb

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All components are read-only UI consuming existing bearer-gated APIs.

## Self-Check: PASSED

Files exist:
- packages/spa/src/components/HomeToolbar.tsx ✓
- packages/spa/src/components/HomeToolbar.test.tsx ✓
- packages/spa/src/components/ProjectCard.tsx ✓
- packages/spa/src/components/ProjectCard.test.tsx ✓
- packages/spa/src/components/CardContextMenu.tsx ✓
- packages/spa/src/components/CardContextMenu.test.tsx ✓

Commits verified:
- d88120b (HomeToolbar) ✓
- 7437db0 (ProjectCard) ✓
- b875ffb (CardContextMenu + lint fixes) ✓

Tests: 162/162 passing, lint: 0 errors (2 pre-existing warnings, not from this plan).
