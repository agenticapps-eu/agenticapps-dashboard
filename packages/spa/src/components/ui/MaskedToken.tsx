/**
 * MaskedToken — bearer-token display primitive (Phase 06.1, D-6.1-03).
 *
 * Renders a sensitive string masked by default. Click "Reveal" to show
 * the actual value for 5 seconds, after which it auto-re-masks. Click
 * "Copy" at any time to copy the actual value to the clipboard (works
 * while masked — copy without reveal is the safer pattern).
 *
 * Constraints (D-43 / D-5.1-10): INSTANT state changes only — no motion CSS,
 * no fade, no motion classes anywhere in the rendered DOM.
 *
 * Constraints (D-5.1-10): NO cn()/clsx/CVA, no motion utility classes.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'

export interface MaskedTokenProps {
  value: string
  /** Used in aria-label as `${label}, masked` / `${label}, revealed`. */
  label?: string
}

const MASK_GLYPH = '•'
const MASK_DISPLAY_WIDTH = 16
const AUTO_HIDE_MS = 5000

export function MaskedToken({ value, label = 'Token' }: MaskedTokenProps): React.JSX.Element {
  const [masked, setMasked] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always clear pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const cancelTimer = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const onReveal = (): void => {
    setMasked(false)
    cancelTimer()
    timerRef.current = setTimeout(() => {
      setMasked(true)
      timerRef.current = null
    }, AUTO_HIDE_MS)
  }

  const onHide = (): void => {
    cancelTimer()
    setMasked(true)
  }

  const onCopy = (): void => {
    // Copy the ACTUAL value, not the masked display, regardless of state.
    void navigator.clipboard.writeText(value)
  }

  const maskString = MASK_GLYPH.repeat(Math.min(value.length, MASK_DISPLAY_WIDTH))

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg px-3 py-2">
      {masked ? (
        <span
          aria-label={`${label}, masked`}
          className="font-mono text-sm text-text-primary"
        >
          {maskString}
        </span>
      ) : (
        <span
          aria-label={`${label}, revealed`}
          className="font-mono text-sm text-text-primary"
        >
          {value}
        </span>
      )}
      <button
        type="button"
        onClick={masked ? onReveal : onHide}
        aria-label={masked ? `Reveal ${label}` : `Hide ${label}`}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {masked ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
        {masked ? 'Reveal' : 'Hide'}
      </button>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Copy size={12} aria-hidden="true" />
        Copy
      </button>
    </div>
  )
}
