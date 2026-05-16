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
import { Check, AlertTriangle, X, Circle, HelpCircle } from 'lucide-react'
import type {
  CoverageColumnState,
  CoverageCellDrift,
} from '@agenticapps/dashboard-shared'

import { CoverageDriftBadge } from './CoverageDriftBadge.js'

// Workflow column shape — narrowed from discriminated union when kind === 'workflow'
type CoverageWorkflowColumn = Extract<CoverageColumnState, { kind: 'workflow' }>

export interface CoverageCellProps {
  column: 'claudeMd' | 'gitNexus' | 'wiki' | 'workflowVersion'
  state: CoverageColumnState
  repoName: string // for ARIA labels
  /**
   * Optional inline drift indicator (Phase 11 TRD-05).
   *
   * Null/undefined when no transition occurred in the last 14 days OR when
   * drift data is still loading.
   *
   * Owned by parent `CoverageRow` (PD-11-02 / REVIEWS action item 1 Option C
   * — bulk-per-repo endpoint, single ownership in CoverageRow).
   * CoverageCell does NOT call any hook to fetch this itself.
   */
  drift?: CoverageCellDrift | null
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

export function CoverageCell({
  column,
  state,
  repoName,
  drift,
}: CoverageCellProps): React.JSX.Element {
  // AGREED-2: scanner failures surface as a degraded cell — distinct from a confirmed-absent
  // file. Render a "?" with the scanner's error in the tooltip so the user can tell them apart.
  if (state.degraded) {
    const reason = state.degradedReason ?? 'Scanner failed'
    const ariaLabel = `${column} for ${repoName}: scanner failed — ${reason}`
    return (
      <figure
        role="figure"
        aria-label={ariaLabel}
        title={reason}
        className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 bg-text-tertiary/10 text-text-tertiary"
      >
        <HelpCircle size={14} aria-hidden="true" />
        <span className="text-xs text-text-tertiary whitespace-nowrap">scan failed</span>
      </figure>
    )
  }

  const tokens = STATE_TOKEN_MAP[state.state] ?? STATE_TOKEN_MAP['stale']

  // CODEX HIGH-4: workflow column gets sub-state text; basic column uses .label
  const subtext =
    state.kind === 'workflow'
      ? workflowSubtext(state)
      : (state.label ?? '')

  const ariaLabel = `${column} for ${repoName}: ${state.state}${subtext ? ` — ${subtext}` : ''}`

  // Phase 11-04 (D-11-03 / PD-11-02): inline drift badge — only when the
  // parent (CoverageRow) provided a non-null direction + daysSince. Cross-field
  // nulls (loaded but no transition) render WITHOUT a badge.
  const showDrift =
    drift != null && drift.direction !== null && drift.daysSince !== null

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
      {showDrift && (
        <CoverageDriftBadge
          direction={drift.direction as 'up' | 'down'}
          daysSince={drift.daysSince as number}
        />
      )}
    </figure>
  )
}
