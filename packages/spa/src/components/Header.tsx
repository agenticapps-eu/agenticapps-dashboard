import { Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { useLastRefresh } from '../lib/lastRefresh.js'

import { ThemeChip } from './ThemeChip.js'

export function Header() {
  const { count, refreshLabel } = useLastRefresh()
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[--border] bg-[--surface] px-6">
      <Link
        to="/"
        className="text-sm font-semibold text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        AgenticApps Dashboard
      </Link>
      <span aria-hidden="true" className="text-sm text-[--text-muted]">
        {count !== null ? `${count} projects · ` : '— projects · '}{refreshLabel}
      </span>
      <span className="flex-1" aria-hidden="true" />
      <ThemeChip />
      <Link
        to="/settings"
        aria-label="Settings"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-2 text-[--text-muted] hover:bg-[--surface-elevated] hover:text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        <Settings size={16} aria-hidden="true" />
      </Link>
    </header>
  )
}
