/**
 * CoverageRow.tsx — Single repo row: 4 CoverageCells + OverrideChip + refresh popover.
 *
 * CODEX HIGH-1: NEVER renders row.absPath (it's daemon-internal only).
 * UI-SPEC §5: refresh action popover with row-specific options.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import type { CoverageRow as CoverageRowData, CoverageFamily } from '@agenticapps/dashboard-shared'
import { CoverageCell } from './CoverageCell.js'
import { OverrideChip } from './OverrideChip.js'

export type CoverageRefreshAction =
  | 'gitnexus-analyze'
  | 'wiki-compile-clipboard'
  | 'workflow-update-clipboard'
  | 'claude-md-help'

export interface CoverageRowContext {
  family: CoverageFamily
  repo: string
}

export interface CoverageRowProps {
  row: CoverageRowData
  onRefresh?: (action: CoverageRefreshAction, context: CoverageRowContext) => void
}

// Derive popover options from the row's column states
function getRefreshOptions(row: CoverageRowData) {
  const opts: Array<{ label: string; action: CoverageRefreshAction }> = []
  if (row.gitNexus.state === 'stale' || row.gitNexus.state === 'missing') {
    opts.push({ label: 'Run gitnexus analyze for this repo', action: 'gitnexus-analyze' })
  }
  if (row.wiki.state === 'stale' || row.wiki.state === 'missing') {
    opts.push({ label: 'Copy /wiki-compile command', action: 'wiki-compile-clipboard' })
  }
  if (
    row.workflowVersion.state === 'stale' &&
    row.workflowVersion.kind === 'workflow' &&
    row.workflowVersion.detail !== 'ahead'
  ) {
    opts.push({ label: 'Copy /update-agenticapps-workflow', action: 'workflow-update-clipboard' })
  }
  if (row.claudeMd.state === 'missing') {
    opts.push({ label: 'How to add CLAUDE.md', action: 'claude-md-help' })
  }
  return opts
}

export function CoverageRow({ row, onRefresh }: CoverageRowProps): React.JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const options = getRefreshOptions(row)

  // Close popover on outside-click
  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  // Close popover on Escape
  useEffect(() => {
    if (!popoverOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [popoverOpen])

  return (
    <tr className="group hover:bg-card-bg-hover">
      {/* Repo identity — NEVER renders absPath (CODEX HIGH-1).
          pl-4 matches the column header's px-4 left padding so body rows align
          with the "Repo" column label above. */}
      <td className="py-2 pl-4 pr-3 text-sm font-medium text-text-primary whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span>{row.repo}</span>
          <OverrideChip
            count={row.overrideCount}
            overrides={row.overrides}
            repoName={row.repo}
          />
        </div>
      </td>

      {/* 4 coverage cells in fixed column order */}
      <td className="px-2 py-2">
        <CoverageCell column="claudeMd" state={row.claudeMd} repoName={row.repo} />
      </td>
      <td className="px-2 py-2">
        <CoverageCell column="gitNexus" state={row.gitNexus} repoName={row.repo} />
      </td>
      <td className="px-2 py-2">
        <CoverageCell column="wiki" state={row.wiki} repoName={row.repo} />
      </td>
      <td className="px-2 py-2">
        <CoverageCell column="workflowVersion" state={row.workflowVersion} repoName={row.repo} />
      </td>

      {/* Refresh action — visible on hover/focus */}
      <td className="py-2 pl-2 w-8">
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            aria-label={`Refresh actions for ${row.repo}`}
            onClick={() => setPopoverOpen((o) => !o)}
            className="text-text-tertiary hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus:opacity-100 p-0.5"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>

          {popoverOpen && options.length > 0 && (
            <div className="absolute right-0 top-6 z-20 min-w-[220px] rounded-md bg-card-bg shadow-card border border-border-subtle p-1">
              {options.map((opt) => (
                <button
                  key={opt.action}
                  type="button"
                  onClick={() => {
                    onRefresh?.(opt.action, { family: row.family, repo: row.repo })
                    setPopoverOpen(false)
                  }}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-text-primary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
