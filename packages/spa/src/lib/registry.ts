/**
 * registry.ts — SPA query hooks for the daemon registry API.
 *
 * NOTE: This is a stub created by plan 03-07 for Wave 3 parallel execution.
 * Plan 03-06 owns the canonical implementation. The orchestrator will replace
 * this stub with 03-06's version on post-wave merge.
 *
 * Exports the public API surface that plans 03-07 and 03-08 depend on.
 */
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

// Placeholder type — plan 06 defines the full ProjectOverview shape
export type ProjectOverview = {
  phaseStatus: 'Pending' | 'In Progress' | 'Complete'
  stage1: { ran: boolean; findings: { red: number; yellow: number; green: number } } | null
  stage2: { ran: boolean; findings: { red: number; yellow: number; green: number } } | null
  dbAudit: { findings: { critical: number; high: number; medium: number; low: number } } | null
  tdd: { greenPairs: number; totalTasks: number } | null
  verification: { evidence: number; mustHaves: number } | null
  branch: string | null
  markers: { gitRepo: boolean; planning: boolean; claudeSkills: boolean }
}

export type SortKey = 'recommended' | 'lastCommit' | 'name' | 'phase' | 'client'

/**
 * Returns a query result for the project overview.
 * When id is null (unreachable project), returns a disabled query.
 */
export function useProjectOverview(
  ...args: [string | null]
): UseQueryResult<ProjectOverview> {
  void args
  throw new Error('useProjectOverview: stub — plan 03-06 implementation required')
}

/**
 * Returns a mutation for unregistering a project.
 */
export function useUnregister(
  ...args: [string]
): UseMutationResult<void, Error, void> {
  void args
  throw new Error('useUnregister: stub — plan 03-06 implementation required')
}

/**
 * Returns a mutation for renaming a project.
 */
export function useRename(
  ...args: [string]
): UseMutationResult<void, Error, { name: string }> {
  void args
  throw new Error('useRename: stub — plan 03-06 implementation required')
}

/**
 * Returns a mutation for setting project tags.
 */
export function useSetTags(
  ...args: [string]
): UseMutationResult<void, Error, { tags: string[] }> {
  void args
  throw new Error('useSetTags: stub — plan 03-06 implementation required')
}

/**
 * Derives overflow chips from the registry item list.
 * Overflow chips = any tag not in the fixed set {all, active, client, internal}.
 * Sorted alphabetically, with occurrence count.
 */
export function computeOverflowChips(
  items: RegistryListItem[]
): Array<{ tag: string; count: number }> {
  const fixed = new Set(['all', 'active', 'client', 'internal'])
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) {
      if (!fixed.has(tag)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, count]) => ({ tag, count }))
}

/**
 * Registry list query hook stub.
 */
export function useRegistryList(): UseQueryResult<RegistryListItem[]> {
  throw new Error('useRegistryList: stub — plan 03-06 implementation required')
}
