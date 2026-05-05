---
phase: 03-multi-project-home-page
plan: 10
subsystem: spa/command-palette
tags: [command-palette, keyboard-nav, aria, dialog, wave-4]
dependency_graph:
  requires:
    - "03-02 (Wave 0: shared schemas)"
    - "03-06 (Wave 3: SPA data layer — useRegistryList)"
    - "03-08 (Wave 3: RegisterModal — palette:open-register listener)"
  provides:
    - "Global Cmd/Ctrl+K command palette mounted in AppShell"
    - "useCommandPaletteActions hook + filterActions pure function"
    - "CommandPalette component: native <dialog> + listbox + keyboard nav"
  affects:
    - "packages/spa/src/components/AppShell.tsx — CommandPalette globally mounted"
    - "All routes — palette available everywhere via AppShell"
tech_stack:
  added: []
  patterns:
    - "Native <dialog> + .showModal() for palette chrome (no external lib)"
    - "WAI-ARIA listbox pattern: role=listbox + role=option + aria-activedescendant (RESEARCH Pattern 15)"
    - "Declarative action registry: PaletteAction[] returned by useCommandPaletteActions(close)"
    - "Inline clampedIndex derivation (no setState in useEffect) for focusedIndex clamping"
    - "window CustomEvent 'palette:open-register' for cross-tree register modal open (D-32)"
    - "TDD: RED test, GREEN implementation, lint/typecheck fix cycle"
key_files:
  created:
    - packages/spa/src/lib/commandPaletteActions.ts
    - packages/spa/src/lib/commandPaletteActions.test.ts
    - packages/spa/src/components/CommandPalette.tsx
    - packages/spa/src/components/CommandPalette.test.tsx
  modified:
    - packages/spa/src/components/AppShell.tsx
    - packages/spa/src/components/AppShell.test.tsx
decisions:
  - "Cross-tree open-register via CustomEvent on window (not lifted state) — avoids cross-tree state; MultiProjectHome listens and sets registerOpen=true"
  - "clampedIndex derived inline (not via useEffect setState) — avoids react-hooks/set-state-in-effect lint error; correct at render time"
  - "Single (metaKey || ctrlKey) && key === 'k' condition — works on all platforms; Ctrl+K fires on Mac too (no platform detection needed in v1)"
  - "No external command-palette library — purpose-built per D-32 (CONTEXT.md)"
  - "⌘K hint chip aria-hidden=true — visual chrome only; all platforms use same chip"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-04T18:05:25Z"
  tasks: 2
  files: 6
---

# Phase 3 Plan 10: Command Palette Summary

**One-liner:** Global Cmd/Ctrl+K command palette with native `<dialog>` + WAI-ARIA listbox, mounted in AppShell, with v1 actions: Register project, Jump to {name}, Refresh data, Toggle theme.

## What Was Built

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
- `jump:{id}` — one per project in `useRegistryList().data`; calls `navigate({ to: '/projects/$projectId', params: { projectId } })`, then `close()`
- `refresh` — `qc.invalidateQueries(['registry'])` + `qc.invalidateQueries(['overview'])` (partial key — invalidates all `['overview', *]`), then `close()`
- `toggle-theme` — `setChoice(nextThemeChoice(choice))` cycling `dark → light → system → dark`, then `close()`

**`filterActions(actions, query)`** — pure function: empty query returns full list; otherwise case-insensitive substring match on `label`.

10 tests: 4 pure function tests (empty, jump filter, case-insensitive, no-match) + 6 hook tests (empty registry, 2-item registry, CustomEvent dispatch, navigate call, invalidateQueries, theme cycle).

### Task 2: CommandPalette component + AppShell mount (TDD)

New `packages/spa/src/components/CommandPalette.tsx`:

- Native `<dialog ref={dialogRef}>` opened via `.showModal()` — no external library
- Global `window.addEventListener('keydown', ...)` matching `(e.metaKey || e.ctrlKey) && e.key === 'k'`
- Focus management: capture `document.activeElement` on open; restore via `setTimeout(() => prev?.focus(), 0)` on close
- Input: `type="search"`, `aria-label="Command palette search"`, `aria-owns="palette-listbox"`, `aria-activedescendant={activeId}`
- Listbox: `<ul id="palette-listbox" role="listbox" aria-label="Actions">` + `<li role="option" id="palette-option-{i}" aria-selected={i === clampedIndex}>`
- `clampedIndex` derived inline (`Math.min(focusedIndex, filtered.length - 1)`) — avoids setState in useEffect
- Keyboard: ArrowDown/Up navigate with wrap; Enter activates; Tab closes; Esc via `onCancel` preventDefault + close
- Zero-results: single non-interactive `<li>` "No actions found. Try a shorter search."
- ⌘K hint chip: `aria-hidden="true"`, purely decorative

Modified `packages/spa/src/components/AppShell.tsx`:
- Added `import { CommandPalette } from './CommandPalette.js'`
- Mounted `<CommandPalette />` as a sibling of `<main>` inside the root flex column

16 CommandPalette tests + 1 new AppShell palette-presence test.

## Action Registry Contract

| Action ID | Label | Type | Effect |
|-----------|-------|------|--------|
| `register` | Register project | `register` | Dispatches `palette:open-register` CustomEvent; closes palette |
| `jump:{id}` | Jump to {name} | `jump` | Navigates to `/projects/$projectId`; closes palette |
| `refresh` | Refresh data | `refresh` | Invalidates `['registry']` + `['overview']` query keys; closes palette |
| `toggle-theme` | Toggle theme | `toggle-theme` | Cycles `dark → light → system → dark` via `useTheme().setChoice`; closes palette |

## Cross-Tree Open-Register Communication

**Design:** `palette:open-register` CustomEvent on `window` (no payload).

**Alternatives considered:**
- **Lifted state in router context** — rejected as too invasive; would require threading `setRegisterOpen` through `RouterContext` or a new React context, touching multiple components outside plan scope.
- **Zustand/Jotai atom** — rejected; no state management lib in the stack (CLAUDE.md: no new deps for Phase 3).
- **Sibling ref forwarding** — rejected; `CommandPalette` is mounted in `AppShell`, `RegisterModal` is mounted in `MultiProjectHome` — different subtrees, ref cannot cross.

`MultiProjectHome` already listens: `window.addEventListener('palette:open-register', () => setRegisterOpen(true))`.

## Cross-Platform Cmd/Ctrl Handling

Single condition: `(e.metaKey || e.ctrlKey) && e.key === 'k'`.

- Mac: `metaKey` (Cmd+K) fires; `ctrlKey` (Ctrl+K) also fires (acceptable — same shortcut)
- Windows/Linux: `ctrlKey` fires
- No `navigator.platform` detection needed in v1 — both branches work everywhere
- Manual UAT (D-32) verifies cross-platform behavior

The ⌘K hint chip is Mac-specific unicode. Phase 6 polish (POLISH-01) can add platform detection to show `Ctrl+K` on non-Mac.

## Future Palette Extension Hook

The `useCommandPaletteActions` hook is the single extension point for Phase 4/5/6 palette additions:

```typescript
// Phase 4: add actions for Discipline/Phase navigation
// Phase 5: add Skill health actions
// Phase 6: add ?, R, / shortcut actions (POLISH-01)
actions.push({ id: 'help', label: 'Help', type: 'static', run: () => navigate({ to: '/help' }) })
```

Pattern: add to the `actions` array in `useCommandPaletteActions`, between the jump rows and the Refresh action. No changes to `CommandPalette.tsx` needed for new v1-style actions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict errors in both test files**
- **Found during:** `pnpm -r typecheck`
- **Issue:** Array index access `arr[N]` produces `T | undefined` under strict mode; TS2532 errors on `result.current[0]`, `items[0]`, `dispatchedEvents[0]`
- **Fix:** Replaced `arr[i]` with `arr.at(i)` (returns `T | undefined`, compatible with optional chaining) throughout both test files
- **Files modified:** `commandPaletteActions.test.ts`, `CommandPalette.test.tsx`
- **Commit:** d78a963

**2. [Rule 1 - Bug] react-hooks/set-state-in-effect in CommandPalette.tsx**
- **Found during:** `pnpm lint`
- **Issue:** `useEffect(() => { if (...) setFocusedIndex(...) }, [filtered.length, focusedIndex])` calls setState directly in effect body
- **Fix:** Removed the effect entirely; compute `clampedIndex = Math.min(focusedIndex, filtered.length - 1)` inline during render. Updated all `focusedIndex` render references to `clampedIndex`
- **Files modified:** `CommandPalette.tsx`
- **Commit:** d78a963

**3. [Rule 2 - Missing] ESLint suppression for unused mock params**
- **Found during:** `pnpm lint`
- **Issue:** Mock lambda parameters `_close`, `_args` flagged by `@typescript-eslint/no-unused-vars` even with underscore prefix
- **Fix:** Added targeted `// eslint-disable-next-line` comments on the mock factory lines in test files
- **Files modified:** `AppShell.test.tsx`, `CommandPalette.test.tsx`
- **Commit:** d78a963

## Known Stubs

None. All four v1 palette actions are fully wired:
- Register: dispatches CustomEvent that `MultiProjectHome` already listens for (Plan 03-08)
- Jump: uses `useNavigate` from TanStack Router
- Refresh: uses `useQueryClient().invalidateQueries`
- Toggle theme: uses `useTheme().setChoice`

## Threat Surface Scan

No new network endpoints introduced. The palette is a pure client-side UI surface.

- T-03-10-03 (XSS via project name in Jump-to row): mitigated — action labels rendered as React text nodes, not raw HTML injection. No innerHTML usage anywhere in CommandPalette.tsx.
- T-03-10-05 (global keydown DoS): mitigated — single listener, minimal work per keystroke.
- T-03-10-01, T-03-10-02, T-03-10-04: accepted per plan threat model.

## Self-Check: PASSED
