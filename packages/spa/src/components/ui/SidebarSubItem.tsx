/**
 * SidebarSubItem — Indented sub-navigation item for the projects sub-list (Phase 5.1 Wave 1).
 *
 * UI-SPEC §5: 16px additional indent vs SidebarItem; optional status dot.
 * Active state: bg-accent-bg-strong + text-white (same as SidebarItem).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'

const DOT_CLASSES: Record<'green' | 'amber' | 'gray', string> = {
  green: 'bg-status-success',
  amber: 'bg-status-warning',
  gray: 'bg-text-tertiary',
}

export interface SidebarSubItemProps {
  to: string
  params?: Record<string, string>
  label: string
  statusDot?: 'green' | 'amber' | 'gray'
}

export function SidebarSubItem({ to, params, label, statusDot }: SidebarSubItemProps): React.JSX.Element {
  const matchRoute = useMatchRoute()
  const isActive = !!matchRoute({ to, params: params ?? {}, fuzzy: false } as Parameters<typeof matchRoute>[0])

  const stateClasses = isActive
    ? 'bg-accent-bg-strong text-white'
    : 'text-text-primary hover:bg-accent-bg'

  return (
    <Link
      to={to}
      params={params}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-md pl-9 pr-3 py-2 text-sm font-medium ${stateClasses} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <span className="truncate flex-1">{label}</span>
      {statusDot && (
        <span
          aria-hidden="true"
          className={`ml-auto w-2 h-2 rounded-full shrink-0 ${DOT_CLASSES[statusDot]}`}
        />
      )}
    </Link>
  )
}
