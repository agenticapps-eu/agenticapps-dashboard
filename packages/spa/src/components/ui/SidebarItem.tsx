/**
 * SidebarItem — Top-level navigation link (Phase 5.1 Wave 1).
 * SidebarItemDisabled — Disabled navigation button for Phase 6+ routes.
 *
 * UI-SPEC §5: active state = bg-accent-bg-strong + text-white (filled purple pill).
 * Inactive state = text-text-primary + hover:bg-accent-bg.
 * Active state derived from useMatchRoute() (RESEARCH Code Example 2).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'

export interface SidebarItemProps {
  to: string
  params?: Record<string, string>
  icon: React.ReactNode
  label: string
}

export function SidebarItem({ to, params, icon, label }: SidebarItemProps): React.JSX.Element {
  const matchRoute = useMatchRoute()
  const isActive = !!matchRoute({ to, params: params ?? {}, fuzzy: false } as Parameters<typeof matchRoute>[0])

  const stateClasses = isActive
    ? 'bg-accent-bg-strong text-white'
    : 'text-text-primary hover:bg-accent-bg'

  return (
    <Link
      to={to}
      params={params}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${stateClasses} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

export interface SidebarItemDisabledProps {
  icon: React.ReactNode
  label: string
}

export function SidebarItemDisabled({ icon, label }: SidebarItemDisabledProps): React.JSX.Element {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Available in Phase 6"
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-tertiary cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
