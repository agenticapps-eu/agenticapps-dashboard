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
import { Cog, Keyboard, Search } from 'lucide-react'

import { useFirstRunHint } from '../../lib/firstRunHint.js'
import { useRegistryList } from '../../lib/registry.js'
import { HelpOverlay } from '../HelpOverlay.js'
import { ThemeChip } from '../ThemeChip.js'

import { Breadcrumb } from './Breadcrumb.js'
import { KbdHint } from './KbdHint.js'
import { Pill } from './Pill.js'
import { StatusPill } from './StatusPill.js'

export function TopBar(): React.JSX.Element {
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
  // currentPhase may be "Phase 5" — StatusPill shows label="Phase" value="5"
  const currentPhase = project?.status.currentPhase ?? null
  const phaseNumber = currentPhase ? currentPhase.replace(/^Phase\s*/i, '') : null

  return (
    <header
      className="sticky top-0 flex items-center gap-3 border-b border-border-subtle bg-app-bg px-6"
      style={{ height: '60px', zIndex: 'var(--z-sticky)' }}
    >
      <Breadcrumb />

      {isProjectRoute && tags.length > 0 && (
        <div className="flex items-center gap-2" aria-label="Project tags">
          {tags.map((t) => (
            <Pill key={t} variant="neutral">{t}</Pill>
          ))}
        </div>
      )}

      {isProjectRoute && phaseNumber && (
        <StatusPill label="Phase" value={phaseNumber} />
      )}

      <span className="flex-1" aria-hidden="true" />

      <button
        type="button"
        onClick={openPalette}
        aria-label="Open command palette"
        className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg px-3 py-1.5 text-sm text-text-secondary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Search size={14} aria-hidden="true" />
        <span>Search…</span>
        <KbdHint />
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          onClick={() => setManualOpen((o) => !o)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Cog size={16} aria-hidden="true" />
      </Link>
    </header>
  )
}
