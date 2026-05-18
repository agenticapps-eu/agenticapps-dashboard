/**
 * SkillDriftToolbar — Single-select scope chip + debounced search (Plan 11-05 Task 2 Step B).
 *
 * PD-11-03 single-select scope chip group: [ Per family ] [ Cross family ] —
 * exactly one is active at a time. Default 'family' (URL elides ?scope param).
 *
 * Mirrors Phase 10 CoverageToolbar pattern:
 * - 200ms debounce on search input (setTimeout cleared on each keystroke)
 * - URL sync via TanStack Router useNavigate
 * - Same chip visual treatment as CoverageToolbar (bg-accent for selected)
 *
 * URL contract (PD-11-03):
 *   ?scope=family (or no param) → 'family' scope
 *   ?scope=cross               → 'cross' scope
 *   ?scope=<anything-else>     → defaults to 'family' (defensive)
 *
 * useSkillDriftScopeFromUrl() is the single source of truth — the parent
 * (SkillDriftPage) reads it and passes scope to BOTH the hook and the matrix.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useRef } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useSearch } from '@tanstack/react-router'

import type { SkillDriftScope } from '../../../lib/skillDriftQueries.js'

// ── URL scope helper ─────────────────────────────────────────────────────────

const VALID_SCOPES: ReadonlyArray<SkillDriftScope> = ['family', 'cross']

/**
 * Read `?scope=` from the current router state and validate it.
 * Falls back to 'family' on missing or invalid values (PD-11-03 — invalid scope
 * values never reach the hook's queryKey; T-11-05-07 mitigation).
 */
export function useSkillDriftScopeFromUrl(): SkillDriftScope {
  const search = useSearch({ strict: false }) as { scope?: string }
  const raw = search.scope ?? ''
  return (VALID_SCOPES as ReadonlyArray<string>).includes(raw)
    ? (raw as SkillDriftScope)
    : 'family'
}

// ── Toolbar component ────────────────────────────────────────────────────────

export interface SkillDriftToolbarProps {
  scope: SkillDriftScope
  search: string
  onSearchChange: (next: string) => void
}

const CHIP_SELECTED =
  'bg-accent text-card-bg border border-accent px-3 py-1.5 rounded-md text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

const CHIP_UNSELECTED =
  'bg-card-bg text-text-secondary border border-divider-soft px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

export function SkillDriftToolbar({
  scope,
  search,
  onSearchChange,
}: SkillDriftToolbarProps): React.JSX.Element {
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigate as unknown as (opts: {
    search: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)
    replace?: boolean
  }) => void

  function handleScopeClick(next: SkillDriftScope) {
    if (next === scope) return // already active
    nav({
      search: (prev: Record<string, unknown>) => {
        // family is the default — elide the param when family.
        if (next === 'family') {
          const { scope: _drop, ...rest } = prev
          return rest
        }
        return { ...prev, scope: next }
      },
      replace: true,
    })
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 200)
  }

  const chips: Array<{ key: SkillDriftScope; label: string }> = [
    { key: 'family', label: 'Per family' },
    { key: 'cross', label: 'Cross family' },
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap py-3">
      {/* Single-select scope chip group (PD-11-03) */}
      <div
        role="group"
        aria-label="Filter by scope"
        className="flex items-center gap-2 flex-wrap"
      >
        {chips.map(({ key, label }) => {
          const selected = scope === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => handleScopeClick(key)}
              className={selected ? CHIP_SELECTED : CHIP_UNSELECTED}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Debounced search input — 200ms, mirrors Phase 10 CoverageToolbar */}
      <div className="relative inline-flex items-center ml-auto">
        <Search
          size={14}
          aria-hidden="true"
          className="absolute left-3 text-text-secondary pointer-events-none"
        />
        <input
          type="search"
          role="searchbox"
          aria-label="Search skills"
          placeholder="Search skills…"
          defaultValue={search}
          onChange={handleSearchChange}
          className="w-48 md:w-64 bg-card-bg-hover border border-border-subtle rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </div>
  )
}
