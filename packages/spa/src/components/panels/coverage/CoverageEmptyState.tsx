/**
 * CoverageEmptyState.tsx — empty-state renderer for /coverage.
 *
 * UI-SPEC §6: each empty-state kind maps to specific copy + CTA.
 * Wraps the Phase 05.1 EmptyState primitive for structural consistency.
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React from 'react'
import { AlertTriangle, Search, RefreshCw, GitBranch } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState.js'

export type CoverageEmptyKind = 'no-results' | 'scan-failed' | 'no-repos'

export interface CoverageEmptyStateProps {
  kind: CoverageEmptyKind
  onClearFilters?: () => void
  onRetry?: () => void
}

export function CoverageEmptyState({
  kind,
  onClearFilters,
  onRetry,
}: CoverageEmptyStateProps): React.JSX.Element {
  switch (kind) {
    case 'no-results':
      return (
        <EmptyState
          icon={<Search size={24} aria-hidden="true" className="text-text-tertiary" />}
          title="No repos match your filters."
          body="Try adjusting the status chips or clearing the search."
          action={
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent-bg-strong px-3 py-2 text-sm font-semibold text-white hover:bg-accent-bg-strong-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Clear filters
            </button>
          }
        />
      )

    case 'scan-failed':
      return (
        <EmptyState
          icon={<AlertTriangle size={24} aria-hidden="true" className="text-status-error" />}
          title="Coverage scan failed — see daemon logs."
          body="The daemon encountered an error while scanning repos. Check ~/.agenticapps/dashboard/logs/daemon.log."
          action={
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent-bg-strong px-3 py-2 text-sm font-semibold text-white hover:bg-accent-bg-strong-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          }
        />
      )

    case 'no-repos':
      return (
        <EmptyState
          icon={<GitBranch size={24} aria-hidden="true" className="text-text-tertiary" />}
          title="No git repos found."
          body={
            <>
              No repos found under{' '}
              <code className="font-mono text-sm">
                {'~/Sourcecode/{agenticapps,factiv,neuroflash}'}
              </code>
              . Make sure the directories exist and contain initialized repos.
            </>
          }
        />
      )
  }
}
