/**
 * ProjectHeader — D-4-10 single-line breadcrumb above the 2-col grid.
 *
 * Format (UI-SPEC):
 *   left-arrow All Projects dot {name}{(client?)} dot {branch ?? '(no branch)'} dot phase {paddedPhase} dash {status}
 *
 * Reads name + client from useRegistryList (single 5s poll feeds both list and detail).
 * Reads branch + phaseStatus from useProjectOverview.
 * Falls back gracefully when either query is loading/errored — never blanks
 * the header (the back link is always reachable).
 *
 * T-04-04-05: XSS mitigated by React text interpolation only (no raw HTML sinks).
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 * In V2 mode this component is vestigial (replaced by Breadcrumb in TopBar + PageHeader).
 * It is NOT deleted here — Wave 5 (Plan 05.1-06) decides after the flag flip.
 */
import { ChevronLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { useRegistryList, useProjectOverview } from '../lib/registry.js'

export type ProjectHeaderProps = { projectId: string }

function Sep(): React.JSX.Element {
  return (
    <span aria-hidden="true" className="px-1 text-text-secondary">
      ·
    </span>
  )
}

export function ProjectHeader({ projectId }: ProjectHeaderProps): React.JSX.Element {
  const registry = useRegistryList()
  const overview = useProjectOverview(projectId)

  const entry = registry.data?.find((p) => p.id === projectId)
  const name = entry?.name ?? projectId
  const client = entry?.client ?? null
  const branch = overview.data?.branch ?? null
  const phaseStatus = overview.data?.phaseStatus ?? null
  const currentPhase = entry?.status?.currentPhase ?? null

  // Derive "04" from "04-single-project-view" — first two chars if they match \d{2}
  const paddedPhase =
    currentPhase && /^\d{2}/.test(currentPhase) ? currentPhase.slice(0, 2) : null

  return (
    <nav
      aria-label="Project breadcrumb"
      className="mb-6 flex flex-wrap items-center gap-x-1 text-sm leading-snug"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded text-text-primary hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        All Projects
      </Link>
      <Sep />
      <span className="font-semibold text-text-primary">{name}</span>
      {client !== null && (
        <span className="ml-1 text-text-secondary">({client})</span>
      )}
      <Sep />
      <span className="font-mono text-text-secondary">{branch ?? '(no branch)'}</span>
      {paddedPhase !== null && (
        <>
          <Sep />
          <span className="text-text-secondary">phase {paddedPhase}</span>
        </>
      )}
      {phaseStatus !== null && (
        <>
          <span aria-hidden="true" className="px-1 text-text-secondary">
            —
          </span>
          <span className="font-semibold text-text-primary">{phaseStatus}</span>
        </>
      )}
    </nav>
  )
}
