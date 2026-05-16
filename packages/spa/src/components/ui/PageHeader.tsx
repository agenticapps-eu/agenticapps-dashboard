/**
 * PageHeader — Per-route page header with title, helper, actions slot (Phase 5.1 Wave 1).
 *
 * UI-SPEC §7: title (text-2xl semibold) + helper (text-sm tertiary) + actions slot (right-aligned).
 * 24px bottom margin (mb-6). Optional children render below the title row.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 *
 * Phase 11 PLI-01 / D-11-09 — optional sticky?: boolean prop (default false).
 * When true, the outer div gains `sticky top-0 z-10 bg-app-bg` so the header
 * pins to the top of the AppShellV2 <main> scroll container. Opt-in per route
 * so non-Coverage routes don't regress.
 *
 * Tokens (from packages/spa/src/styles/tokens.css):
 * - `bg-app-bg` → --color-app-bg (warm paper) — opaque backstop so
 *   scrolled content doesn't bleed through.
 * - `z-10` → matches --z-sticky (10) — stays below --z-overlay (100) and
 *   --z-modal (1000), so modals and overlays still float above the header.
 * - 24px bottom margin (`mb-6`) preserved in BOTH sticky and non-sticky modes
 *   per CONTEXT §Specifics.
 */
import React from 'react'

export interface PageHeaderProps {
  title: string
  helper?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  /**
   * Phase 11 PLI-01 / D-11-09 — when true, the header sticks to the top of
   * the AppShellV2 <main> scroll container (sticky top-0 z-10 bg-app-bg).
   * Defaults to false to preserve current behaviour on every route that has
   * not opted in.
   */
  sticky?: boolean
}

export function PageHeader({
  title,
  helper,
  actions,
  children,
  sticky = false,
}: PageHeaderProps): React.JSX.Element {
  const stickyClasses = sticky ? ' sticky top-0 z-10 bg-app-bg' : ''
  return (
    <div className={`mb-6 flex flex-col gap-1${stickyClasses}`}>
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
