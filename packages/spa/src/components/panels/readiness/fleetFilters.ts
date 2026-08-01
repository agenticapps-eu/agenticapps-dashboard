/**
 * fleetFilters.ts — what the fleet toolbar selects, and what it means.
 *
 * Three dimensions that AND together, with the selections inside one dimension
 * reading as alternatives. Family is one of them rather than a grouping level:
 * grouping spends vertical space separating exactly the repos someone wants to
 * compare side by side (design.md §5).
 *
 * The state lives in the URL so a filtered view can be shared, which is the
 * same round-trip /coverage established. Values that are not in the vocabulary
 * are dropped rather than reported — a hand-edited URL should narrow to
 * something sensible, not blank the page.
 */
import {
  CHECK_STATUSES,
  RepoFamilySchema,
  type CheckStatus,
  type RepoFamily,
  type RepoSummary,
} from '@agenticapps/dashboard-shared'

/** The search params the route carries. Comma-joined, like /coverage's. */
export interface FleetSearch {
  family?: string
  status?: string
  q?: string
}

export interface FleetFilters {
  families: readonly RepoFamily[]
  statuses: readonly CheckStatus[]
  query: string
}

export const EMPTY_FILTERS: FleetFilters = { families: [], statuses: [], query: '' }

export const FAMILY_OPTIONS: readonly RepoFamily[] = RepoFamilySchema.options

/**
 * The four states worth filtering to. `ok` and `na` are omitted because a list
 * of repos that have at least one passing check, or one check that does not
 * apply, is every repo — the filter would narrow nothing while implying it did.
 */
export const STATUS_OPTIONS: readonly CheckStatus[] = CHECK_STATUSES.filter(
  (status): status is CheckStatus => status !== 'ok' && status !== 'na',
)

function selected<T extends string>(raw: string | undefined, vocabulary: readonly T[]): T[] {
  if (raw === undefined) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is T => (vocabulary as readonly string[]).includes(value))
}

export function parseFleetFilters(search: FleetSearch): FleetFilters {
  return {
    families: selected(search.family, FAMILY_OPTIONS),
    statuses: selected(search.status, STATUS_OPTIONS),
    query: search.q ?? '',
  }
}

/** Empty dimensions are left out entirely, so an unfiltered view has a bare URL. */
export function serialiseFleetFilters(filters: FleetFilters): FleetSearch {
  const search: FleetSearch = {}
  if (filters.families.length > 0) search.family = filters.families.join(',')
  if (filters.statuses.length > 0) search.status = filters.statuses.join(',')
  if (filters.query.trim() !== '') search.q = filters.query
  return search
}

export function hasActiveFilters(filters: FleetFilters): boolean {
  return (
    filters.families.length > 0 ||
    filters.statuses.length > 0 ||
    filters.query.trim() !== ''
  )
}

/** Adds or removes one selection within a dimension, leaving the others alone. */
export function toggled<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value]
}

export function matchesFleetFilters(repo: RepoSummary, filters: FleetFilters): boolean {
  if (filters.families.length > 0 && !filters.families.includes(repo.family)) {
    return false
  }
  if (
    filters.statuses.length > 0 &&
    !repo.checks.some((check) => filters.statuses.includes(check.status))
  ) {
    return false
  }
  const query = filters.query.trim().toLowerCase()
  return query === '' || repo.name.toLowerCase().includes(query)
}
