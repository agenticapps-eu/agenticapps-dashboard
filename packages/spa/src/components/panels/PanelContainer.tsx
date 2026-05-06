/**
 * PanelContainer — shared <section> wrapper used by all 8 Phase 4 panels.
 *
 * UI-SPEC §"Panel container": rounded-md border, bg-[--surface], p-6, flex flex-col gap-4.
 * Always-expanded (D-4-13): no max-height, no disclosure widget, no animation.
 *
 * Props:
 *   panelId    — used for aria-labelledby={panelId}-title. Must be a valid DOM ID.
 *   title      — displayed in the <h2> heading.
 *   stale      — shows a 'Stale' pill in the header right side (UI-SPEC §Stale data / freshness).
 *   unreachable — shows an inline 'Agent unreachable — retrying...' row below the title.
 *   children   — panel body content.
 *
 * Note: --warning-surface token is defined in global.css (both light and dark themes).
 */
import { AlertTriangle } from 'lucide-react'
import React from 'react'

export interface PanelContainerProps {
  panelId: string
  title: string
  /** Render-right pill 'Stale' when the data is older than the threshold (UI-SPEC 15s). */
  stale?: boolean
  /** Inline 'Agent unreachable — retrying...' below the title (UI-SPEC §Daemon unreachable per panel). */
  unreachable?: boolean
  children: React.ReactNode
}

export function PanelContainer({
  panelId,
  title,
  stale = false,
  unreachable = false,
  children,
}: PanelContainerProps): React.JSX.Element {
  return (
    <section
      aria-labelledby={`${panelId}-title`}
      className="flex flex-col gap-4 rounded-md border border-[--border] bg-[--surface] p-6"
    >
      <header className="flex items-center justify-between">
        <h2
          id={`${panelId}-title`}
          className="text-xl font-semibold leading-snug text-[--text]"
        >
          {title}
        </h2>
        {stale && (
          <span className="rounded bg-[--warning-surface] px-2 py-0.5 text-xs font-semibold text-[--warning]">
            Stale
          </span>
        )}
      </header>
      {unreachable && (
        <div className="flex items-center gap-2 text-sm text-[--warning]">
          <AlertTriangle size={14} aria-hidden="true" />
          Agent unreachable — retrying...
        </div>
      )}
      {children}
    </section>
  )
}
