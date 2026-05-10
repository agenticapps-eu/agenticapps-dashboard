/**
 * HelpOverlay.tsx — First-run shortcut hint tooltip (Plan 06-03 Task 2).
 *
 * POLISH-01 D-6-03: one-shot tooltip shown by TopBar on first session.
 * Also re-shown when user explicitly clicks the Keyboard icon in TopBar.
 *
 * Dismissal: "Got it" button or Escape key.
 * No animations (anti-AI-slop — D-5.1-10, D-43).
 * Positioned absolutely below the TopBar's action area; parent must be relative.
 */
import { useEffect } from 'react'
import type React from 'react'

import { KbdHint } from './ui/KbdHint.js'

export interface HelpOverlayProps {
  onDismiss: () => void
}

export function HelpOverlay({ onDismiss }: HelpOverlayProps): React.JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute right-4 top-14 z-10 rounded-md border border-border-subtle bg-card-bg p-4 shadow-card"
    >
      <p className="text-sm text-text-primary">
        Press <KbdHint keys="R" /> to refresh, <KbdHint keys="?" /> for help, <KbdHint keys="/" /> to search.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-xs text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Got it
      </button>
    </div>
  )
}
