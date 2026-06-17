/**
 * ClaudeMdLevelDrawer.tsx — Native-<dialog> per-rung capability level drawer.
 *
 * CML-09: renders all six L1–L6 rungs with pass/fail indicator, evidence strings,
 * the inferred-L5 sigil+callout, and next-steps / fully-adaptive branches.
 *
 * Pattern: exact clone of RegisterModal.tsx focus management (native <dialog>
 * showModal/close, previouslyFocused restoration, backdrop-click, onCancel Esc).
 *
 * Constraints (D-5.1-10 — non-negotiable):
 * - NO cn()/clsx/CVA — inline className strings with LEVEL_TOKEN_MAP lookup
 * - NO hex literals — Phase 05.1 token names only
 * - NO shadcn aliases (bg-background, text-foreground, etc.)
 */
import React, { useEffect, useRef } from 'react'
import { Check, Circle } from 'lucide-react'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'

export interface ClaudeMdLevelDrawerProps {
  isOpen: boolean
  onClose: () => void
  repoName: string
  /** always defined when drawer is open (badge click disabled when evalData undefined) */
  evalData: ClaudeMdEval
}

// Level → {bg, text} token mapping (UI-SPEC §L-level Badge Color Mapping — locked)
// Defined locally so this component is fully self-contained (no cross-package leak)
const LEVEL_TOKEN_MAP: Record<number, { bg: string; text: string }> = Object.freeze({
  0: { bg: 'bg-text-tertiary/10', text: 'text-text-tertiary' }, // Absent — muted
  1: { bg: 'bg-status-warning/10', text: 'text-status-warning' }, // Basic — amber
  2: { bg: 'bg-status-warning/10', text: 'text-status-warning' }, // Scoped — amber
  3: { bg: 'bg-status-info/10', text: 'text-status-info' }, // Structured — blue
  4: { bg: 'bg-status-info/10', text: 'text-status-info' }, // Abstracted — blue
  5: { bg: 'bg-status-success/10', text: 'text-status-success' }, // Maintained — green
  6: { bg: 'bg-status-success/10', text: 'text-status-success' }, // Adaptive — green
})

export function ClaudeMdLevelDrawer({
  isOpen,
  onClose,
  repoName,
  evalData,
}: ClaudeMdLevelDrawerProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Open/close the native dialog — exact RegisterModal focus-management pattern
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
      previouslyFocused.current?.focus()
    }
  }, [isOpen])

  // Backdrop click closes — click on the dialog element itself (not inner content)
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  const FALLBACK_TOKENS = { bg: 'bg-text-tertiary/10', text: 'text-text-tertiary' }
  const levelTokens = LEVEL_TOKEN_MAP[evalData.level] ?? FALLBACK_TOKENS

  return (
    <dialog
      ref={dialogRef}
      className="bg-card-bg border border-border-subtle rounded-lg p-0 max-w-lg w-full mx-4 dark:shadow-none shadow-card backdrop:bg-text-primary/50"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        {/* Section A — Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold leading-snug text-text-primary">
              {repoName}
            </h2>
            <p className="text-sm text-text-secondary mt-1">CLAUDE.md capability level</p>
          </div>

          {/* Headline level badge — decorative, not a button */}
          <span
            className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-semibold ${levelTokens.bg} ${levelTokens.text}`}
          >
            L{evalData.level} — {evalData.levelLabel}
            {evalData.inferred && (
              <span className="ml-1 text-[10px] font-semibold bg-accent-bg text-accent rounded px-1">
                ~
              </span>
            )}
          </span>

          {/* Dismiss button */}
          <button
            type="button"
            aria-label="Close capability level drawer"
            onClick={onClose}
            className="ml-2 h-8 w-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>
        </div>

        {/* Section B — Rung list (L1–L6, in order) */}
        <ul role="list" className="space-y-3 mb-6">
          {evalData.rungs.map((rung) => (
            <li key={rung.rung} className="flex flex-col gap-1">
              {/* Row: icon + rung name + optional inferred sigil */}
              <div className="flex items-center gap-2">
                {rung.passed ? (
                  <Check
                    size={14}
                    className="text-status-success flex-shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={14}
                    className="text-text-tertiary flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm font-semibold text-text-primary">
                  L{rung.rung} — {rung.label}
                </span>
                {rung.inferred && (
                  // Always-visible inferred sigil on rung row (never hover-only)
                  <span
                    className="ml-1 text-[10px] font-semibold bg-accent-bg text-accent rounded px-1"
                    aria-label="inferred"
                  >
                    ~
                  </span>
                )}
              </div>

              {/* Evidence strings (indented under icon+name) */}
              <ul className="pl-6 space-y-1">
                {rung.evidence.map((ev, i) => (
                  <li key={i} className="text-xs text-text-secondary">
                    {ev}
                  </li>
                ))}
              </ul>

              {/* Inferred-L5 callout — always visible when rung is L5 and inferred */}
              {rung.rung === 5 && rung.inferred && (
                <p className="mt-1 text-xs text-text-secondary pl-6">
                  Inferred — not hard-verified. Based on CLAUDE.md freshness and backbone-doc
                  presence.
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* Section C — Next steps (when nextSteps.length > 0) */}
        {evalData.nextSteps.length > 0 && (
          <div className="border-t border-border-subtle pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Next steps</h3>
            <ul role="list" className="space-y-1">
              {evalData.nextSteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-secondary">
                  <span aria-hidden="true" className="text-text-tertiary flex-shrink-0">
                    →
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section D — Fully adaptive success copy (when nextSteps.length === 0) */}
        {evalData.nextSteps.length === 0 && (
          <div className="border-t border-border-subtle pt-4">
            <p className="text-sm text-status-success font-semibold">
              Fully adaptive — all six rungs complete.
            </p>
          </div>
        )}
      </div>
    </dialog>
  )
}
