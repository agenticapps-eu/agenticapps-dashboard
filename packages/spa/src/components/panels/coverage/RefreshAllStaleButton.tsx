/**
 * RefreshAllStaleButton.tsx — Batch-refresh button with AGREED-4 sequential dispatch.
 *
 * AGREED-4: sequential for-of await loop — NEVER Promise.all over spawn actions.
 * Batch-progress state: { status: 'idle'|'running', current, total }.
 * Renders "Refreshing N of M…" while loop executes.
 *
 * Only gitNexus-analyze is spawnable (daemon action).
 * Clipboard-only actions (wiki/workflow/CLAUDE.md) are out of scope for this button.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { CoverageRow, CoverageRefreshRequest, CoverageRefreshResponse } from '@agenticapps/dashboard-shared'

export interface RefreshAllStaleButtonProps {
  rows: CoverageRow[]
  onRefresh: (req: CoverageRefreshRequest) => Promise<CoverageRefreshResponse>
}

interface BatchState {
  status: 'idle' | 'running'
  current: number
  total: number
}

export function RefreshAllStaleButton({ rows, onRefresh }: RefreshAllStaleButtonProps): React.JSX.Element {
  const [batch, setBatch] = useState<BatchState>({ status: 'idle', current: 0, total: 0 })

  // Only gitnexus-analyze is spawnable; clipboard actions are handled separately
  const spawnable = rows.filter(
    (r) => r.gitNexus.state === 'stale' || r.gitNexus.state === 'missing',
  )

  const disabled = spawnable.length === 0 || batch.status === 'running'

  async function handleClick() {
    if (
      !confirm(
        `Refresh ${spawnable.length} stale entries across ${spawnable.length} repos. Sequential dispatch. Continue?`,
      )
    )
      return

    setBatch({ status: 'running', current: 0, total: spawnable.length })

    // AGREED-4: sequential for-of await — NEVER Promise.all over spawnable actions.
    // One gitnexus-analyze at a time; daemon serialises scans, concurrent invocations cause overload.
    for (const row of spawnable) {
      setBatch((b) => ({ ...b, current: b.current + 1 }))
      try {
        await onRefresh({ family: row.family, repo: row.repo, action: 'gitnexus-analyze' })
      } catch {
        // Continue batch on per-repo failure — one failure must not kill the rest
      }
    }

    setBatch({ status: 'idle', current: 0, total: 0 })
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={batch.status === 'running'}
      onClick={() => void handleClick()}
      className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-card-bg hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw size={14} aria-hidden="true" />
      {batch.status === 'running'
        ? `Refreshing ${batch.current} of ${batch.total}…`
        : `Refresh ${spawnable.length} stale`}
    </button>
  )
}
