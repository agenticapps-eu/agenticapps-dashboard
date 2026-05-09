import { useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

import { computeOverflowChips } from '../lib/registry.js'
import type { SortKey } from '../lib/registry.js'

export interface HomeToolbarProps {
  items: RegistryListItem[]
  selectedChips: Set<string>
  onChipsChange: (chips: Set<string>) => void
  searchText: string
  onSearchChange: (text: string) => void
  sortKey: SortKey
  onSortChange: (key: SortKey) => void
}

const FIXED_CHIPS = ['all', 'active', 'client', 'internal'] as const

const CHIP_SELECTED =
  'bg-accent text-white border border-accent px-3 py-2 rounded-md text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

const CHIP_UNSELECTED =
  'bg-card-bg text-text-primary border border-border-subtle px-3 py-2 rounded-md text-sm font-semibold hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

export function HomeToolbar({
  items,
  selectedChips,
  onChipsChange,
  searchText,
  onSearchChange,
  sortKey,
  onSortChange,
}: HomeToolbarProps): React.JSX.Element {
  const overflowChips = useMemo(() => computeOverflowChips(items), [items])

  function handleChipClick(chip: string) {
    if (chip === 'all') {
      // 'all' becomes the sole selection; if already all, deselect (defaults to show-all)
      if (selectedChips.has('all') && selectedChips.size === 1) {
        onChipsChange(new Set(['all']))
      } else {
        onChipsChange(new Set(['all']))
      }
    } else {
      const next = new Set(selectedChips)
      next.delete('all')
      if (next.has(chip)) {
        next.delete(chip)
      } else {
        next.add(chip)
      }
      onChipsChange(next)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div role="group" aria-label="Filter by" className="flex items-center gap-2 flex-wrap">
        {FIXED_CHIPS.map((chip) => {
          const selected = selectedChips.has(chip)
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={selected}
              className={selected ? CHIP_SELECTED : CHIP_UNSELECTED}
              onClick={() => handleChipClick(chip)}
            >
              {chip}
            </button>
          )
        })}
        {overflowChips.map(({ tag, count }) => {
          const selected = selectedChips.has(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              className={selected ? CHIP_SELECTED : CHIP_UNSELECTED}
              onClick={() => handleChipClick(tag)}
            >
              {tag}{' '}
              <span className="text-text-tertiary">({count})</span>
            </button>
          )
        })}
      </div>

      <div className="relative inline-flex items-center ml-auto">
        <Search
          size={14}
          aria-hidden="true"
          className="absolute left-3 text-text-secondary pointer-events-none"
        />
        <input
          type="search"
          aria-label="Search projects"
          placeholder="Search projects…"
          className="w-48 md:w-64 bg-card-bg-hover border border-border-subtle rounded-md pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onSearchChange('')
          }}
        />
      </div>

      <div className="relative inline-flex items-center gap-1">
        <label htmlFor="sort-select" className="sr-only">
          Sort by
        </label>
        <select
          id="sort-select"
          className="bg-card-bg-hover border border-border-subtle rounded-md pl-3 pr-8 py-2 text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          <option value="recommended">Recommended</option>
          <option value="lastCommit">Last commit ↓</option>
          <option value="name">Name ↑</option>
          <option value="phase">Phase ↓</option>
          <option value="client">Client ↑</option>
        </select>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className="absolute right-3 text-text-secondary pointer-events-none"
        />
      </div>
    </div>
  )
}
