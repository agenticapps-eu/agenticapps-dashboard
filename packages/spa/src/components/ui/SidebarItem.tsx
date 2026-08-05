/**
 * SidebarItem — Top-level navigation link (Phase 5.1 Wave 1). The sidebar's one
 * navigation primitive, which `App Shell And Sidebar Information Architecture`
 * requires every entry in every section to use.
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
  /**
   * A subtree this item also owns, matched fuzzily. `/fleet` passes `/repos`
   * because a repo detail is reachable only from the fleet and belongs to it —
   * without this the sidebar highlighted nothing there, and the page
   * represented the reader as being nowhere in the product.
   */
  alsoActiveFor?: string
}

export function SidebarItem({
  to,
  params,
  icon,
  label,
  alsoActiveFor,
}: SidebarItemProps): React.JSX.Element {
  const matchRoute = useMatchRoute()
  const isActive =
    !!matchRoute({ to, params: params ?? {}, fuzzy: false } as Parameters<typeof matchRoute>[0]) ||
    (alsoActiveFor !== undefined &&
      !!matchRoute({ to: alsoActiveFor, fuzzy: true } as Parameters<typeof matchRoute>[0]))

  const stateClasses = isActive
    ? 'bg-accent-bg-strong text-white'
    : 'text-text-primary hover:bg-accent-bg'

  return (
    <Link
      to={to}
      params={params}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${stateClasses} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}
