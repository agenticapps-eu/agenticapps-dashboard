/**
 * PanelContainer — shared <section> wrapper used by all 8 Phase 4 panels.
 *
 * UI-SPEC §8 Card Anatomy: rounded-card (12px), bg-card-bg (white), shadow-card, p-6.
 * No border — shadow + radius do the visual work (UI-SPEC §8 "no border").
 * Always-expanded by default (D-4-13): no max-height, no animation.
 *
 * Props:
 *   panelId          — used for aria-labelledby={panelId}-title. Must be a valid DOM ID.
 *   title            — displayed in the <h2> heading.
 *   stale            — shows a 'Stale' pill in the header right side (UI-SPEC §Stale data / freshness).
 *   unreachable      — shows an inline 'Agent unreachable — retrying...' row below the title.
 *   defaultCollapsed — D-6.1-02: when true, header becomes click-to-toggle button; body collapsed initially.
 *                      Per-page-load only — NO localStorage. Defaults to false (back-compat).
 *   children         — panel body content.
 *
 * D-6.1-02 progressive disclosure (Phase 06.1):
 *   When `defaultCollapsed` is true, the header becomes a click-to-toggle <button>
 *   with aria-expanded + aria-controls, body wrapped in a region with the controlled id.
 *   When `defaultCollapsed` is undefined/false, renders identically to the always-expanded
 *   pre-06.1 behavior (no button, body always visible — back-compat default).
 *
 * Anti-AI-slop (D-43, D-5.1-10): chevron toggle is INSTANT — no transition, no rotation animation.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import React, { useState } from 'react'

export interface PanelContainerProps {
  panelId: string
  title: string
  /** Render-right pill 'Stale' when the data is older than the threshold (UI-SPEC 15s). */
  stale?: boolean
  /** Inline 'Agent unreachable — retrying...' below the title (UI-SPEC §Daemon unreachable per panel). */
  unreachable?: boolean
  /** D-6.1-02: when true, collapses body until header click. Defaults to false (back-compat). */
  defaultCollapsed?: boolean
  /**
   * Subtle, right-aligned state hint shown in the header ONLY while collapsed
   * (e.g. "not configured"). Lets a collapsed panel signal its state at a glance
   * without forcing the user to expand it. Hidden once expanded (the body content
   * becomes the source of truth). No effect unless `defaultCollapsed` is set.
   */
  collapsedHint?: string
  children: React.ReactNode
}

export function PanelContainer({
  panelId,
  title,
  stale = false,
  unreachable = false,
  defaultCollapsed = false,
  collapsedHint,
  children,
}: PanelContainerProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const bodyId = `${panelId}-body`

  // Disclosure path: header is a button toggling collapsed state.
  if (defaultCollapsed) {
    return (
      <section
        aria-labelledby={`${panelId}-title`}
        className="flex flex-col gap-4 rounded-card bg-card-bg p-6 shadow-card"
      >
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="flex items-center gap-2 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {collapsed ? (
              <ChevronRight size={16} aria-hidden="true" className="text-text-secondary" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" className="text-text-secondary" />
            )}
            <h2
              id={`${panelId}-title`}
              className="text-lg font-semibold leading-snug text-text-primary"
            >
              {title}
            </h2>
          </button>
          <div className="flex items-center gap-2">
            {collapsed && collapsedHint && (
              <span className="text-xs text-text-tertiary">{collapsedHint}</span>
            )}
            {stale && (
              <span className="rounded-md bg-card-bg-hover px-2 py-0.5 text-xs font-semibold text-status-warning">
                Stale
              </span>
            )}
          </div>
        </header>
        {unreachable && (
          <div className="flex items-center gap-2 text-sm text-status-warning">
            <AlertTriangle size={14} aria-hidden="true" />
            Agent unreachable — retrying...
          </div>
        )}
        {!collapsed && (
          <div id={bodyId} role="region" aria-labelledby={`${panelId}-title`}>
            {children}
          </div>
        )}
      </section>
    )
  }

  // Always-expanded path (pre-06.1 default — unchanged behavior).
  return (
    <section
      aria-labelledby={`${panelId}-title`}
      className="flex flex-col gap-4 rounded-card bg-card-bg p-6 shadow-card"
    >
      <header className="flex items-center justify-between">
        <h2
          id={`${panelId}-title`}
          className="text-lg font-semibold leading-snug text-text-primary"
        >
          {title}
        </h2>
        {stale && (
          <span className="rounded-md bg-card-bg-hover px-2 py-0.5 text-xs font-semibold text-status-warning">
            Stale
          </span>
        )}
      </header>
      {unreachable && (
        <div className="flex items-center gap-2 text-sm text-status-warning">
          <AlertTriangle size={14} aria-hidden="true" />
          Agent unreachable — retrying...
        </div>
      )}
      {children}
    </section>
  )
}
