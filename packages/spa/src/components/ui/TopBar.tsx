/**
 * TopBar — 60px sticky top bar with breadcrumb + Cmd+K trigger + ThemeChip + settings link (Phase 5.1 Wave 1).
 *
 * UI-SPEC §6: sticky top-0 z-sticky (--z-sticky=10), hairline border-b.
 * Project-route conditional: tags (as Pill) + phase (as StatusPill) shown ONLY on /projects/:projectId.
 * Data source: useRegistryList() — same hook as Sidebar; TanStack Query cache, no extra poll.
 *
 * POLISH-01 D-6-03: Keyboard icon button always-available for manual HelpOverlay re-show.
 * First-run auto-show gated on useFirstRunHint (localStorage 'shortcuts_hint_shown').
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import { useState } from 'react'
import type React from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import { Cog, Keyboard, Menu, Search } from 'lucide-react'

import { useFirstRunHint } from '../../lib/firstRunHint.js'
import { useRegistryList } from '../../lib/registry.js'
import { HelpOverlay } from '../HelpOverlay.js'
import { ThemeChip } from '../ThemeChip.js'

import { Breadcrumb } from './Breadcrumb.js'
import { KbdHint } from './KbdHint.js'
import { Pill } from './Pill.js'
import { StatusPill } from './StatusPill.js'

export function TopBar({
  compact = false,
  navOpen = false,
  onOpenNav,
}: {
  /** Below the shell's compact boundary: controls shrink to their icons. */
  compact?: boolean
  /** Supplied only when the sidebar has left the grid. */
  onOpenNav?: (() => void) | undefined
  /** Whether the navigation panel is currently open, for the toggle's state. */
  navOpen?: boolean
} = {}): React.JSX.Element {
  // Cmd+K trigger: dispatches a synthetic keydown so the global CommandPalette listener opens.
  function openPalette(): void {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    window.dispatchEvent(event)
  }

  // Keyboard shortcuts overlay state (manual toggle — independent of first-run flag).
  const [manualOpen, setManualOpen] = useState(false)
  const { shouldShow, dismiss } = useFirstRunHint()
  const showOverlay = manualOpen || shouldShow

  // Project-route detection: the deepest match's params include projectId when on /projects/:projectId.
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const projectId = (last?.params as { projectId?: string } | undefined)?.projectId ?? null
  const isProjectRoute = !!projectId

  // Registry data — same hook Sidebar consumes; cached, no extra network cost.
  const registry = useRegistryList()
  const project = isProjectRoute ? registry.data?.find((p) => p.id === projectId) : undefined
  const tags = project?.tags ?? []
  // Open-change count replaces the synthesised phase number. A migrated project
  // with no change in flight shows nothing rather than "0" — the pill is a
  // signal that work is open, not a counter that is usually zero.
  const openChangeCount =
    project?.status.condition === 'migrated' ? project.status.openChanges.length : 0

  return (
    <header
      // `min-w-0` so the bar can shrink below its content's natural width
      // rather than forcing the page to scroll; `px-6` becomes `px-3` when
      // compact, because 48px of horizontal padding is a tenth of a 390px
      // viewport.
      className={
        compact
          ? 'sticky top-0 flex min-w-0 items-center gap-2 border-b border-border-subtle bg-app-bg px-3'
          : 'sticky top-0 flex min-w-0 items-center gap-3 border-b border-border-subtle bg-app-bg px-6'
      }
      style={{ height: '60px', zIndex: 'var(--z-sticky)' }}
    >
      {onOpenNav !== undefined && (
        // The label and `aria-expanded` both track state: a toggle that always
        // says "Open navigation" tells a screen-reader user nothing about what
        // pressing it just did.
        <button
          type="button"
          aria-label={navOpen ? 'Navigation, open' : 'Open navigation'}
          aria-expanded={navOpen ?? false}
          aria-controls="shell-navigation-panel"
          onClick={onOpenNav}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Menu size={16} aria-hidden="true" />
        </button>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <Breadcrumb />
      </div>

      <div role="status" aria-live="polite" className="flex items-center gap-2">
        {isProjectRoute && tags.length > 0 && (
          <div className="flex items-center gap-2" aria-label="Project tags">
            {tags.map((t) => (
              <Pill key={t} variant="neutral">{t}</Pill>
            ))}
          </div>
        )}
        {isProjectRoute && openChangeCount > 0 && (
          <StatusPill label="Changes" value={String(openChangeCount)} />
        )}
      </div>

      {/*
        The label and the shortcut hint are what gave this bar a minimum width
        wider than a 390px viewport. Compact drops both and keeps the accessible
        name, which is the part a reader who cannot see the icon depends on —
        and the keyboard hint is not useful on the widths that lose it.
      */}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Open command palette"
        className={
          compact
            ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-card-bg text-text-secondary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            : 'inline-flex shrink-0 items-center gap-2 rounded-md border border-border-subtle bg-card-bg px-3 py-1.5 text-sm text-text-secondary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
        }
      >
        <Search size={14} aria-hidden="true" />
        {!compact && (
          <>
            <span>Search…</span>
            <KbdHint />
          </>
        )}
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          onClick={() => setManualOpen((o) => !o)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Keyboard size={16} aria-hidden="true" />
        </button>
        {showOverlay && (
          <HelpOverlay
            onDismiss={() => {
              setManualOpen(false)
              dismiss()
            }}
          />
        )}
      </div>

      <ThemeChip />

      <Link
        to="/settings"
        aria-label="Settings"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Cog size={16} aria-hidden="true" />
      </Link>
    </header>
  )
}
