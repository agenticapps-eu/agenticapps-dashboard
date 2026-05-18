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
 * ARIA: trigger receives aria-describedby={tooltipId}; panel uses role="tooltip" + matching id.
 * Z-index: var(--z-overlay) = 100 (above sticky=10, below modal=1000).
 */
import { useEffect, useId, useRef, useState } from 'react'

export interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps): React.JSX.Element {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
  }, [])

  function scheduleOpen() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => setOpen(true), 100)
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

  const panelClassName = `absolute top-full mt-1 left-0 z-[var(--z-overlay)] bg-card-bg border border-border-subtle rounded-md shadow-card px-3 py-2 text-sm text-text-primary max-w-xs transition-opacity duration-100 ease-out ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  return (
    <span className="relative inline-block">
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className="border-b border-dotted border-text-tertiary cursor-default"
        onMouseEnter={scheduleOpen}
        onMouseLeave={closeNow}
        onFocus={scheduleOpen}
        onBlur={closeNow}
        onKeyDown={handleKeyDown}
      >
        {children}
      </span>
      <span id={tooltipId} role="tooltip" className={panelClassName}>
        {content}
      </span>
    </span>
  )
}
