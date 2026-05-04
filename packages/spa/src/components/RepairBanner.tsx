import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { useRepair } from '../lib/repair.js'

export function RepairBanner(): React.JSX.Element | null {
  const { needsRepair, dismissed, dismiss, clear } = useRepair()
  const navigate = useNavigate()

  useEffect(() => {
    if (!needsRepair || dismissed) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [needsRepair, dismissed, dismiss])

  if (!needsRepair || dismissed) return null

  const onRepair = (): void => {
    clear()
    void navigate({ to: '/onboarding' })
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-[--border] border-l-2 border-l-[--danger] bg-[--danger-surface] px-6 py-3 motion-safe:animate-[slideInDown_150ms_ease-out]"
    >
      <AlertTriangle size={16} aria-hidden="true" className="text-[--danger]" />
      <span className="text-sm font-semibold text-[--text]">Agent token rejected.</span>
      <span className="flex-1" aria-hidden="true" />
      <button
        type="button"
        onClick={onRepair}
        aria-label="Re-pair (open onboarding)"
        className="rounded-md border border-[--accent] px-3 py-1 text-sm font-semibold text-[--accent] hover:bg-[--accent] hover:text-[--accent-fg] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        Re-pair
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner (will return on next 401)"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-2 text-[--text-muted] hover:bg-[--surface-elevated] hover:text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
