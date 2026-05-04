/**
 * commandPaletteActions.ts — Declarative action registry for the CommandPalette.
 *
 * Provides useCommandPaletteActions() hook + filterActions() pure function.
 * Implements D-32 v1 actions: Register project, Jump to {name}, Refresh data, Toggle theme.
 */
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { useRegistryList } from './registry.js'
import { useTheme, type ThemeChoice } from './theme.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaletteAction {
  id: string
  label: string
  type: 'register' | 'refresh' | 'toggle-theme' | 'jump'
  run: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  return current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark'
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useCommandPaletteActions — returns the full ordered action list for the palette.
 *
 * Order: Register project → Jump to {name} (one per project) → Refresh data → Toggle theme.
 * @param close — callback to close the palette; called after each action fires.
 */
export function useCommandPaletteActions(close: () => void): PaletteAction[] {
  const list = useRegistryList()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { choice, setChoice } = useTheme()

  const actions: PaletteAction[] = [
    {
      id: 'register',
      label: 'Register project',
      type: 'register',
      run: () => {
        window.dispatchEvent(new CustomEvent('palette:open-register'))
        close()
      },
    },
  ]

  // Dynamic jump actions — one per registered project
  for (const item of list.data ?? []) {
    const projectId = item.id
    const name = item.name
    actions.push({
      id: `jump:${projectId}`,
      label: `Jump to ${name}`,
      type: 'jump',
      run: () => {
        void navigate({ to: '/projects/$projectId', params: { projectId } })
        close()
      },
    })
  }

  actions.push({
    id: 'refresh',
    label: 'Refresh data',
    type: 'refresh',
    run: () => {
      void qc.invalidateQueries({ queryKey: ['registry'] })
      // Invalidate all ['overview', *] queries (partial key match)
      void qc.invalidateQueries({ queryKey: ['overview'] })
      close()
    },
  })

  actions.push({
    id: 'toggle-theme',
    label: 'Toggle theme',
    type: 'toggle-theme',
    run: () => {
      setChoice(nextThemeChoice(choice))
      close()
    },
  })

  return actions
}

// ── Pure filter function ──────────────────────────────────────────────────────

/**
 * filterActions — returns a filtered subset by lower-cased substring match on label.
 * Empty query returns the full list.
 */
export function filterActions(actions: PaletteAction[], query: string): PaletteAction[] {
  if (!query) return actions
  const needle = query.toLowerCase()
  return actions.filter((a) => a.label.toLowerCase().includes(needle))
}
