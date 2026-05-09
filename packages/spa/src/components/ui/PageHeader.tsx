/**
 * PageHeader — Per-route page header with title, helper, actions slot (Phase 5.1 Wave 1).
 *
 * UI-SPEC §7: title (text-2xl semibold) + helper (text-sm tertiary) + actions slot (right-aligned).
 * 24px bottom margin (mb-6). Optional children render below the title row.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface PageHeaderProps {
  title: string
  helper?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({ title, helper, actions, children }: PageHeaderProps): React.JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary leading-tight">{title}</h1>
          {helper && (
            <p className="mt-1 text-sm text-text-tertiary">{helper}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  )
}
