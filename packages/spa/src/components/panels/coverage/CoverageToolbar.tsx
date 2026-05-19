/**
 * CoverageToolbar.tsx — Filter chips (4-state multi-select) + debounced search input.
 *
 * UI-SPEC §5: 4-chip multi-select with 'all' as default.
 * Multi-select logic:
 *   - All chips deselected → auto-select 'all'
 *   - 'all' selected + clicking another → 'all' deselects, other selects
 *   - 'all' clicked → all others deselect
 * Search: 200ms debounce (setTimeout cleared on each keystroke).
 * URL round-trip (TanStack Router useNavigate + useSearch) is wired in CoveragePage
 *   which owns the router context; CoverageToolbar is a controlled component.
 * CODEX MED-15: integration test in CoverageToolbar.test.tsx uses real TanStack Router.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

export interface CoverageStatusFilter {
  all: boolean
  missing: boolean
  stale: boolean
  fresh: boolean
}

export interface CoverageToolbarProps {
  filter: CoverageStatusFilter
  search: string
  onFilterChange: (next: CoverageStatusFilter) => void
  onSearchChange: (next: string) => void  // already debounced upstream (or debounced here)
}

type ChipKey = keyof CoverageStatusFilter

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'missing', label: '✕ Missing' },
  { key: 'stale', label: '⚠ Stale' },
  { key: 'fresh', label: '✓ Fresh' },
]

const CHIP_SELECTED =
  'bg-accent text-card-bg border border-accent px-3 py-1.5 rounded-md text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

const CHIP_UNSELECTED =
  'bg-card-bg text-text-secondary border border-divider-soft px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

export function CoverageToolbar({
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: CoverageToolbarProps): React.JSX.Element {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // D-11.2-13: hybrid controlled input — mirror state synced from prop.
  // The 200ms debounce stays inside this component (Phase 10 isolation
  // preserved). The useEffect([search]) re-seeds inputValue when the URL
  // back-button OR an external reset (Clear filters / route change) updates
  // the search prop. When the prop changes we also cancel any in-flight
  // debounce so a pending keystroke can't fire afterwards and resurrect the
  // stale value (Phase 11.2 stage-1 /review cross-model finding).
  const [inputValue, setInputValue] = useState(search)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setInputValue(search)
  }, [search])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  function handleChipClick(key: ChipKey) {
    if (key === 'all') {
      // 'all' clicked → deselect everything else, select 'all'
      onFilterChange({ all: true, missing: false, stale: false, fresh: false })
      return
    }

    // Non-'all' chip clicked
    const next: CoverageStatusFilter = {
      ...filter,
      all: false,
      [key]: !filter[key],
    }

    // Auto-revert: if all 4 chips would be false, flip 'all' back to true
    if (!next.missing && !next.stale && !next.fresh) {
      onFilterChange({ all: true, missing: false, stale: false, fresh: false })
    } else {
      onFilterChange(next)
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setInputValue(value)               // update mirror state synchronously
    // 200ms debounce (UI-SPEC §5)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 200)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap py-3">
      {/* 4-chip filter group (UI-SPEC §7 ARIA) */}
      <div role="group" aria-label="Filter by status" className="flex items-center gap-2 flex-wrap">
        {CHIPS.map(({ key, label }) => {
          const selected = filter[key]
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => handleChipClick(key)}
              className={selected ? CHIP_SELECTED : CHIP_UNSELECTED}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Debounced search input */}
      <div className="relative inline-flex items-center ml-auto">
        <Search
          size={14}
          aria-hidden="true"
          className="absolute left-3 text-text-secondary pointer-events-none"
        />
        <input
          type="search"
          role="searchbox"
          aria-label="Search repos"
          placeholder="Search repos…"
          value={inputValue}
          onChange={handleSearchChange}
          className="w-48 md:w-64 bg-card-bg-hover border border-border-subtle rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </div>
  )
}
