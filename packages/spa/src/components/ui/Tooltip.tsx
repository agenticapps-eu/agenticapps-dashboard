/**
 * Tooltip — Hand-rolled tooltip primitive (Phase 11.2 P1 #1).
 *
 * Closes the Phase 10 → 11 → 11.1 → 11.2 column-header explanation debt.
 * Used by CoverageFamilySection to wrap the CLAUDE.md / GitNexus / Wiki / Workflow
 * <th> text with explanatory hover/focus reveals.
 *
 * Constraints (D-5.1-10):
 * - NO cn / clsx / CVA utility
 * - NO hex literals (tokens-only colors)
 * - NO @radix-ui imports, NO shadcn aliases
 *
 * Behavior (D-11.2-02..04):
 * - Open on mouseenter or focus after 100ms delay
 * - Close on mouseleave, blur, or Escape — instant (0ms)
 * - Opacity-only animation (transition-opacity duration-100 ease-out)
 * - Panel stays mounted when closed (opacity-0 + pointer-events-none) to avoid remount reflow
 *
 * Phase 11.2 follow-up: panel renders via createPortal(document.body) using
 * position: fixed + viewport coords from trigger.getBoundingClientRect(). This
 * escapes table-fixed containing-block width constraints so the max-w-xs (320px)
 * cap survives inside narrow <th> cells (CLAUDE.md / GitNexus / Workflow columns).
 * Re-measures on scroll (capture phase) and resize so the panel tracks the trigger.
 *
 * ARIA: trigger receives aria-describedby={tooltipId}; panel uses role="tooltip" + matching id.
 * Z-index: var(--z-overlay) = 100 (above sticky=10, below modal=1000).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  content: string
  children: React.ReactNode
}

interface Coords {
  top: number
  left: number
}

export function Tooltip({ content, children }: TooltipProps): React.JSX.Element {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
  }, [])

  function measure() {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({ top: rect.bottom + 4, left: rect.left })
  }

  function scheduleOpen() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => {
      measure()
      setOpen(true)
    }, 100)
  }

  function closeNow() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Escape') closeNow()
  }

  useEffect(() => {
    if (!open) return
    function onScrollOrResize() {
      measure()
    }
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  const panelClassName = `fixed z-[var(--z-overlay)] bg-card-bg border border-border-subtle rounded-md shadow-card px-3 py-2 text-sm text-text-primary max-w-xs transition-opacity duration-100 ease-out ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  const panel = (
    <span
      id={tooltipId}
      role="tooltip"
      className={panelClassName}
      style={coords ? { top: coords.top, left: coords.left } : undefined}
    >
      {content}
    </span>
  )

  // ARIA: only advertise aria-describedby while the tooltip is open. The panel
  // stays mounted under document.body for animation continuity, but pointing the
  // trigger at a permanently-present description would cause assistive tech
  // (NVDA, VoiceOver) to announce the description on every focus regardless of
  // the visual 100ms open delay (Phase 11.2 stage-1 /review cross-model finding).
  return (
    <span className="relative inline-block">
      <span
        ref={triggerRef}
        tabIndex={0}
        {...(open ? { 'aria-describedby': tooltipId } : {})}
        className="border-b border-dotted border-text-tertiary cursor-default"
        onMouseEnter={scheduleOpen}
        onMouseLeave={closeNow}
        onFocus={scheduleOpen}
        onBlur={closeNow}
        onKeyDown={handleKeyDown}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </span>
  )
}
