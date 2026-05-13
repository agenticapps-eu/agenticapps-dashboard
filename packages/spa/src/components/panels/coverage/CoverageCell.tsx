/**
 * CoverageCell.tsx — Single matrix cell: icon + color tokens + optional label.
 *
 * UI-SPEC §4: state → bg/text token mapping (Phase 05.1 tokens — non-negotiable).
 * CODEX HIGH-4: workflow column has 5 sub-states rendered as descriptive text.
 * CODEX HIGH-1: never references absPath.
 *
 * Token mapping (locked per UI-SPEC §4):
 *   fresh          → bg-status-success/10  text-status-success
 *   stale          → bg-status-warning/10  text-status-warning
 *   missing        → bg-status-error/10    text-status-error
 *   not-applicable → bg-text-tertiary/10   text-text-tertiary
 *   unknown        → bg-status-warning/10  text-status-warning  (treat as stale)
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — Phase 05.1 token names only
 * - NO shadcn aliases (no bg-background, text-foreground, etc.)
 */
import React from 'react'
import { Check, AlertTriangle, X, Circle } from 'lucide-react'
import type { CoverageColumnState } from '@agenticapps/dashboard-shared'

// Workflow column shape — narrowed from discriminated union when kind === 'workflow'
type CoverageWorkflowColumn = Extract<CoverageColumnState, { kind: 'workflow' }>

export interface CoverageCellProps {
  column: 'claudeMd' | 'gitNexus' | 'wiki' | 'workflowVersion'
  state: CoverageColumnState
  repoName: string // for ARIA labels
}

// State → {bg, text} token mapping (UI-SPEC §4 — non-negotiable)
const STATE_TOKEN_MAP = {
  fresh: {
    bg: 'bg-status-success/10',
    text: 'text-status-success',
  },
  stale: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  missing: {
    bg: 'bg-status-error/10',
    text: 'text-status-error',
  },
  'not-applicable': {
    bg: 'bg-text-tertiary/10',
    text: 'text-text-tertiary',
  },
  // unknown treated as stale per UI-SPEC §4
  unknown: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
} as const

function StateIcon({
  state,
  className,
}: {
  state: CoverageColumnState['state']
  className?: string
}): React.JSX.Element {
  const iconProps = { size: 14, 'aria-hidden': true as const, className }
  switch (state) {
    case 'fresh':
      return <Check {...iconProps} />
    case 'stale':
      return <AlertTriangle {...iconProps} />
    case 'missing':
      return <X {...iconProps} />
    case 'not-applicable':
    default:
      return <Circle {...iconProps} />
  }
}

// CODEX HIGH-4: render workflow column sub-state as descriptive text
function workflowSubtext(c: CoverageWorkflowColumn): string {
  switch (c.detail) {
    case 'equal':
      return c.installedVersion ?? '—'
    case 'behind':
      return `Installed ${c.installedVersion} → head ${c.headVersion}`
    case 'ahead':
      return `Installed ${c.installedVersion} (ahead of head ${c.headVersion})`
    case 'version-unknown':
      return 'Installed version unknown'
    case 'skill-missing':
      return 'No skill installed'
    default:
      return ''
  }
}

export function CoverageCell({ column, state, repoName }: CoverageCellProps): React.JSX.Element {
  const tokens = STATE_TOKEN_MAP[state.state] ?? STATE_TOKEN_MAP['stale']

  // CODEX HIGH-4: workflow column gets sub-state text; basic column uses .label
  const subtext =
    state.kind === 'workflow'
      ? workflowSubtext(state)
      : (state.label ?? '')

  const ariaLabel = `${column} for ${repoName}: ${state.state}${subtext ? ` — ${subtext}` : ''}`

  return (
    <figure
      role="figure"
      aria-label={ariaLabel}
      className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1 ${tokens.bg} ${tokens.text}`}
    >
      <StateIcon state={state.state} />
      {subtext && (
        <span className="text-xs text-text-tertiary whitespace-nowrap">{subtext}</span>
      )}
    </figure>
  )
}
