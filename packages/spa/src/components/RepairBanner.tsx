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
      className="flex items-center gap-3 border-b border-border-subtle bg-status-error/8 px-6 py-3"
    >
      <AlertTriangle size={16} aria-hidden="true" className="text-status-error" />
      <span className="text-sm font-semibold text-text-primary">Agent token rejected.</span>
      <span className="flex-1" aria-hidden="true" />
      <button
        type="button"
        onClick={onRepair}
        aria-label="Re-pair (open onboarding)"
        className="rounded-md border border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        Re-pair
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner (will return on next 401)"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-2 text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
