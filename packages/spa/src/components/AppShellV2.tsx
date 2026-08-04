/**
 * AppShellV2 — sidebar-driven shell (Phase 5.1 Wave 1).
 *
 * Composition (UI-SPEC §1 global shell grid):
 *   grid-cols: [240px Sidebar] [1fr column: TopBar + RepairBanner + main]
 *
 * OQ-1 resolution: CommandPalette and RepairBanner both mount here (paired-only).
 * OQ-3 resolution: RepairBanner is below TopBar, full-width, above <main>.
 *
 * ## Below the declared `xs` boundary, that grid becomes one column
 *
 * The 240px track was unconditional, so at 390×844 — the design system's own
 * representative `xs` viewport — it left roughly 150 CSS pixels of content and
 * the top bar's minimum width pushed the page into horizontal scrolling. That
 * failed `Dense Rows And Aligned Figures`' "no page-level horizontal scrolling"
 * on **every** v2 route, not on one surface: measured at a 485px client width,
 * `/fleet` scrolled to 752px and `/changes` to 642px, neither from page content.
 *
 * Below the boundary the sidebar leaves the grid and becomes a dismissible
 * panel opened from the top bar. It is not simply hidden — navigation that
 * cannot be reached is a worse failure than the one being fixed — and it closes
 * on selection, so the panel never covers the page it was used to reach.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities on shell composition
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'
import { Outlet } from '@tanstack/react-router'
import { X } from 'lucide-react'

import { useGlobalShortcuts } from '../lib/useGlobalShortcuts.js'

import { CommandPalette } from './CommandPalette.js'
import { RepairBanner } from './RepairBanner.js'
import { Sidebar } from './ui/Sidebar.js'
import { TopBar } from './ui/TopBar.js'
import { ToastProvider } from './ui/Toast.js'
import { useCompactShell } from './ui/shellLayout.js'

export function AppShellV2(): React.JSX.Element {
  // POLISH-01 D-6-01..03 — single keydown listener with focus-guard
  useGlobalShortcuts()
  const compact = useCompactShell()
  const [navOpen, setNavOpen] = React.useState(false)

  // A width change must not leave the panel latched open for the next time the
  // shell narrows. React's documented adjust-state-during-render pattern rather
  // than an effect: an effect here sets state synchronously after paint, which
  // is a cascading render and is what the lint rule is about.
  const [wasCompact, setWasCompact] = React.useState(compact)
  if (wasCompact !== compact) {
    setWasCompact(compact)
    if (!compact) setNavOpen(false)
  }

  return (
    <ToastProvider>
      <div
        data-testid="app-shell-v2"
        className="grid h-screen bg-app-bg text-text-primary"
        style={{ gridTemplateColumns: compact ? '1fr' : '240px 1fr' }}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-accent-bg-strong focus:px-3 focus:py-2 focus:text-white"
          style={{ zIndex: 'var(--z-overlay)' }}
        >
          Skip to main content
        </a>
        {!compact && <Sidebar />}
        <div className="flex min-w-0 min-h-0 flex-col">
          <TopBar
            compact={compact}
            onOpenNav={compact ? () => setNavOpen(true) : undefined}
          />
          <div data-slot="banner-mount">
            <RepairBanner />
          </div>
          <main id="main" className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
        {compact && navOpen && (
          <div className="fixed inset-0 flex" style={{ zIndex: 'var(--z-overlay)' }}>
            {/* Dismiss by tapping away, which is the gesture a panel like this
                teaches. Presentational: the labelled close button below is the
                accessible control. */}
            <div
              className="absolute inset-0 bg-app-bg opacity-80"
              onClick={() => setNavOpen(false)}
              aria-hidden="true"
            />
            {/* Closes on selection: a panel that stayed open would cover the
                page the reader just navigated to. */}
            <div className="relative flex" onClick={() => setNavOpen(false)}>
              <Sidebar />
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
              className="relative m-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-card-bg text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
