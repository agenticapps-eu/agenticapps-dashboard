import { Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { useLastRefresh } from '../lib/lastRefresh.js'

import { ThemeChip } from './ThemeChip.js'

export function Header() {
  const { count, refreshLabel } = useLastRefresh()
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border-subtle bg-card-bg px-6">
      <Link
        to="/"
        className="text-sm font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        AgenticApps Dashboard
      </Link>
      <span aria-hidden="true" className="text-sm text-text-secondary">
        {count !== null ? `${count} ${count === 1 ? 'project' : 'projects'} · ` : '— projects · '}{refreshLabel}
      </span>
      <span className="flex-1" aria-hidden="true" />
      <ThemeChip />
      <Link
        to="/settings"
        aria-label="Settings"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-2 text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <Settings size={16} aria-hidden="true" />
      </Link>
    </header>
  )
}
