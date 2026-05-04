/**
 * HomeToolbar stub — plan 03-08 wave 3.
 *
 * The canonical implementation lives in plan 03-07's worktree.
 * This stub satisfies the import so MultiProjectHome can compile.
 * The orchestrator will reconcile during post-wave merge.
 */
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HomeToolbar({ searchText, onSearchChange, ..._ }: HomeToolbarProps): React.JSX.Element {
  return (
    <div data-testid="home-toolbar">
      <input
        type="search"
        aria-label="Search projects"
        placeholder="Search projects…"
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  )
}
