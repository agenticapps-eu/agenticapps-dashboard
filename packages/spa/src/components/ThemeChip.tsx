import { Moon, Sun, Monitor } from 'lucide-react'

import { useTheme, type ThemeChoice } from '../lib/theme.js'

const CYCLE: Record<ThemeChoice, ThemeChoice> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

export function ThemeChip() {
  const { choice, setChoice } = useTheme()
  const next = CYCLE[choice]
  const Icon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Switch theme (current: ${choice}; next: ${next})`}
      title={`Switch theme (current: ${choice}; next: ${next})`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md p-2 text-[--text-muted] hover:bg-[--surface-elevated] hover:text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}
