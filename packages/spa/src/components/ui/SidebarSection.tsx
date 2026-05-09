/**
 * SidebarSection — Section container for the sidebar (Phase 5.1 Wave 1).
 *
 * UI-SPEC §5: uppercase section header (11px, tracking-wider, tertiary text) + child container.
 * The header is NOT clickable (not a button, not a link).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface SidebarSectionProps {
  label: string
  children: React.ReactNode
}

export function SidebarSection({ label, children }: SidebarSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 mt-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      {children}
    </div>
  )
}
