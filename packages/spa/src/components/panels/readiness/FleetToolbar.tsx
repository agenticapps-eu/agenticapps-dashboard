/**
 * FleetToolbar.tsx — the filter chips and the name search.
 *
 * Chips are toggle buttons carrying `aria-pressed`, so the selected set is
 * readable without colour and announced without a legend.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import type { ReactElement } from 'react'
import type { CheckStatus, RepoFamily } from '@agenticapps/dashboard-shared'

import { STATUS_PRESENTATION } from './ReadinessIndicator.js'
import {
  FAMILY_OPTIONS,
  STATUS_OPTIONS,
  toggled,
  type FleetFilters,
} from './fleetFilters.js'

const CHIP_BASE =
  'rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'
const CHIP_ON = 'border-accent bg-accent-bg text-accent'
const CHIP_OFF = 'border-border-subtle bg-card-bg text-text-secondary'

/** The status word the cells already use, so the toolbar adds no vocabulary. */
function statusLabel(status: CheckStatus): string {
  const { word } = STATUS_PRESENTATION[status]
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

function Chip({
  label,
  pressed,
  onToggle,
}: {
  label: string
  pressed: boolean
  onToggle: () => void
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`${CHIP_BASE} ${pressed ? CHIP_ON : CHIP_OFF}`}
    >
      {label}
    </button>
  )
}

export function FleetToolbar({
  filters,
  onChange,
}: {
  filters: FleetFilters
  onChange: (next: FleetFilters) => void
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter by family</legend>
        {FAMILY_OPTIONS.map((family: RepoFamily) => (
          <Chip
            key={family}
            label={family}
            pressed={filters.families.includes(family)}
            onToggle={() =>
              onChange({ ...filters, families: toggled(filters.families, family) })
            }
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter by check state</legend>
        {STATUS_OPTIONS.map((status: CheckStatus) => (
          <Chip
            key={status}
            label={statusLabel(status)}
            pressed={filters.statuses.includes(status)}
            onToggle={() =>
              onChange({ ...filters, statuses: toggled(filters.statuses, status) })
            }
          />
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <span>Search</span>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Repository name"
          className="rounded-md border border-border-subtle bg-card-bg px-2 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </div>
  )
}
