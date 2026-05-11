/**
 * HelpHook — contextual deep-link from a dashboard feature page into /help.
 *
 * Source: ~/Documents/.../HelpHook.tsx (translated from react-router-dom
 * useNavigate → @tanstack/react-router useNavigate, with all shadcn tokens
 * translated to tokens.css names per Plan 07-02 token translation table).
 *
 * v1.0 — component ships but NOT yet wired into dashboard pages (HELP-05).
 * panel={true} mode falls through to navigation; real side-panel is v1.1+.
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HelpCircle } from 'lucide-react'

import { topicToUrl } from '../topicToUrl.js'

export interface HelpHookProps {
  /** Dot-separated topic path, e.g. "workflow.gates" or "observability.scan#high". */
  topic: string
  /** Optional label override; defaults to "Learn more". */
  label?: string
  /** If true, opens in a side panel instead of navigating. v1.1+; falls through to navigate today. */
  panel?: boolean
}

export function HelpHook({
  topic,
  label = 'Learn more',
  panel = false,
}: HelpHookProps): React.JSX.Element {
  const [showTooltip, setShowTooltip] = useState(false)
  const navigate = useNavigate()
  const url = topicToUrl(topic)

  function handleClick(): void {
    if (panel) {
      console.warn('HelpHook panel mode not yet implemented; navigating instead.')
    }
    void navigate({ to: url })
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-text-secondary hover:text-text-primary hover:bg-card-bg-hover focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <HelpCircle size={14} />
      </button>
      {showTooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-text-primary text-app-bg text-xs px-2 py-1 shadow-md"
        >
          {label}
        </span>
      )}
    </span>
  )
}
