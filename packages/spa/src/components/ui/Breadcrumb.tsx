/**
 * Breadcrumb — Auto-derived breadcrumb from TanStack Router useMatches (Phase 5.1 Wave 1).
 *
 * UI-SPEC §6: auto-derives from the deepest route match's fullPath.
 * Routes:
 *   "/" → "All Projects"
 *   "/projects/:projectId" → "All Projects · {projectId}"
 *   "/settings" → "Settings"
 *   "/help" → "Help"
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

interface Crumb {
  label: string
  to: string
}

export function Breadcrumb(): React.JSX.Element {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const path = last?.fullPath ?? '/'
  const params = last?.params as Record<string, string> | undefined

  const crumbs: Crumb[] = [{ label: 'All Projects', to: '/' }]

  if (typeof path === 'string' && path.includes('/projects/')) {
    const projectId = params?.projectId
    if (projectId) {
      crumbs.push({ label: projectId, to: `/projects/${projectId}` })
    }
  } else if (path === '/settings') {
    crumbs[0] = { label: 'Settings', to: '/settings' }
  } else if (path === '/help') {
    crumbs[0] = { label: 'Help', to: '/help' }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-text-secondary">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <ChevronRight size={14} aria-hidden="true" className="text-text-tertiary" />
          )}
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-text-primary">{c.label}</span>
          ) : (
            <Link
              to={c.to as '/'}
              className="hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
