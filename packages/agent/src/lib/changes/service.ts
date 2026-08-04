/**
 * service.ts — fleet assembly for the change board.
 *
 * Everything here composes and degrades. `changeReader.ts` already isolates one
 * repository's malformed entries into notices; this layer adds the outer ring,
 * where a repository that cannot be read at all costs that repository's cards
 * and never the rest of the board. Nothing it does throws: a board with one
 * visibly broken repository is the product working, and a 500 is not.
 *
 * ## One bound, not readiness's two
 *
 * It reuses `readiness/service.ts`'s `withinBound` + `Promise.allSettled`
 * shape: race an unref'd timer, settle every repository independently. It
 * deliberately does **not** copy readiness's *second* sequential bound. That
 * one exists there only because every repository's cache key derives from a
 * fleet signature computed first; this board has no such dependency, so its
 * worst case is one bound rather than two.
 *
 * `withinBound` bounds **the wait, not the work**. A blocked filesystem call
 * keeps running and the endpoint stops waiting for it. That limitation is
 * inherited knowingly from readiness — threading an `AbortSignal` through the
 * shared read primitive is the principled fix and belongs to that primitive.
 *
 * ## The cache, and why five seconds
 *
 * `daemon-runtime` → `Response Caching Cadences` already binds this endpoint:
 * it names "derived fleet aggregates on their own cadence", with explicit
 * invalidation. No spec delta was needed — the change was simply
 * non-compliant with a requirement that already existed.
 *
 * The cadence is 5s because `Polling, Not Push` fixes the client at roughly
 * that interval: a shorter cache would never be hit, and a longer one would
 * make the board visibly lag its own refresh. Worst case, one poll shows a
 * reading up to 5s old.
 *
 * Readiness pairs its 5s memo with a content fingerprint, so an edit made a
 * second ago is visible immediately. That is deliberately not copied — the
 * fingerprint is what forces readiness's second bound. The cost is stated
 * rather than hidden: within one cadence a file edit is not seen, bounded by
 * the polling interval the client already runs at.
 *
 * The key is the registry's own content, so registering, unregistering or
 * repointing a repository produces a different key rather than a stale hit.
 * `invalidateChangesCache` is the explicit lever the caching requirement's
 * scenario calls for.
 */
import {
  cardKey,
  compareChangeCards,
  type ChangeCard,
  type ChangeNotice,
  type ChangeReadFailure,
  type ChangeRepositoryStatus,
  type ChangesFleetResponse,
} from '@agenticapps/dashboard-shared'

import { isReachable, readRegistry } from '../registry.js'

import * as reader from './changeReader.js'
import { classifyChange } from './stage.js'

/**
 * How long a computed board may be replayed, in milliseconds.
 *
 * Named, like the read cap and the per-source bound, so the cadence is a stated
 * value rather than a literal buried in a comparison.
 */
export const CHANGES_MEMO_TTL_MS = 5_000

/**
 * How long the board waits for one repository before reporting it timed out.
 *
 * Larger than every bounded subprocess in the daemon, because a repository that
 * is merely slow — a large archive, a cold page cache — should be reported
 * rather than cut off. A repository that exceeds this is genuinely stuck.
 */
export const CHANGES_SCAN_TIMEOUT_MS = 15_000

export interface ChangesFleetOptions {
  /** Override the registry path (tests). */
  registryFile?: string
  /** Read time, epoch milliseconds. Defaults to now. */
  now?: number
  /**
   * Override the per-repository bound (tests). Never supplied by a request:
   * like every other override here it is an internal seam, so the bound cannot
   * be widened or disabled by a client.
   */
  scanTimeoutMs?: number
}

interface CachedFleet {
  key: string
  /**
   * When the scan **finished**, which is the clock the TTL runs on.
   *
   * Deliberately not `response.generatedAt`, which is when the reading was
   * *taken*. One number served both until CodeRabbit separated them on PR #98:
   * a scan slower than one cadence wrote an entry that was already expired, so
   * every poll paid for a full walk and the memo bounded nothing.
   */
  cachedAt: number
  response: ChangesFleetResponse
}

let cached: CachedFleet | null = null

/**
 * Bumped by every invalidation. A scan carries the generation it started under
 * and declines to cache its result if that generation has moved, so a reading
 * taken before an invalidation cannot be written back after it — which would
 * restore exactly the board the invalidation existed to discard.
 */
let generation = 0

/**
 * Discard the cached board so the next read recomputes it.
 *
 * The explicit invalidation `Response Caching Cadences` requires: an action
 * that changes what the board reads calls this, and the next read reflects the
 * new state without waiting for natural expiry.
 */
export function invalidateChangesCache(): void {
  generation += 1
  cached = null
}

export function _resetChangesCacheForTests(): void {
  generation += 1
  cached = null
}

interface RegistryEntry {
  id: string
  name: string
  root: string
}

function registryEntries(options: ChangesFleetOptions): RegistryEntry[] {
  try {
    return readRegistry(options.registryFile).projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
    }))
  } catch {
    // An unreadable registry is an empty fleet, not a 500. The registry route
    // is where a corrupt registry is reported.
    return []
  }
}

/**
 * The cache key: every registered repository's id and root, in order.
 *
 * NUL-separated because neither an id nor a path can contain one, so no two
 * distinct registries collide onto one key.
 */
function cacheKey(entries: readonly RegistryEntry[]): string {
  return entries.map((entry) => `${entry.id}\u0000${entry.root}`).join('\u0000\u0000')
}

const TIMED_OUT = Symbol('changes-scan-timeout')

function withinBound<T>(
  work: Promise<T>,
  options: ChangesFleetOptions,
): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(
      () => resolve(TIMED_OUT),
      options.scanTimeoutMs ?? CHANGES_SCAN_TIMEOUT_MS,
    )
    timer.unref?.()
  })
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

interface RepositoryReading {
  status: ChangeRepositoryStatus
  cards: ChangeCard[]
  notices: ChangeNotice[]
}

function failed(entry: RegistryEntry, reason: ChangeReadFailure): RepositoryReading {
  return {
    status: { id: entry.id, name: entry.name, read: 'failed', reason },
    cards: [],
    notices: [],
  }
}

async function readRepository(
  entry: RegistryEntry,
  options: ChangesFleetOptions,
): Promise<RepositoryReading> {
  // Checked before the walk, so an unmounted volume is reported as unreachable
  // rather than spending the whole bound failing one call at a time.
  if (!isReachable(entry.root)) return failed(entry, 'unreachable')

  let settled: Awaited<ReturnType<typeof reader.readRepositoryChanges>> | typeof TIMED_OUT
  try {
    settled = await withinBound(reader.readRepositoryChanges(entry.root), options)
  } catch (error) {
    // The one repository-state condition the reader refuses rather than
    // degrades: its `openspec` anchor resolves outside the registered root, so
    // there is nothing here this daemon is entitled to read. Caught by name so
    // the generic `allSettled` fallback below keeps meaning what it says.
    if (error instanceof reader.ContainmentAnchorEscaped) return failed(entry, 'unreadable')
    throw error
  }
  if (settled === TIMED_OUT) return failed(entry, 'timeout')

  const cards = settled.records.map((record): ChangeCard => {
    const { stage, ready } = classifyChange(record)
    return {
      id: cardKey(entry.id, record.source, record.sourceInstance),
      repositoryId: entry.id,
      repositoryName: entry.name,
      source: record.source,
      sourceInstance: record.sourceInstance,
      changeName: record.changeName,
      title: record.title,
      stage,
      ready,
      artifacts: record.artifacts,
      reviewerVendors: record.reviewerVendors,
      hasRequestChanges: record.hasRequestChanges,
      reviewRecord: record.reviewRecord,
      checklist: record.checklist,
      completedChecklist: record.checklist.filter((row) => row.completed).length,
      totalChecklist: record.checklist.length,
      archiveDate: record.archiveDate,
      updatedAt: Math.round(record.updatedAt),
      evidenceLimited: record.evidenceLimited,
    }
  })

  return {
    status: { id: entry.id, name: entry.name, read: 'ok', reason: null },
    cards,
    notices: settled.notices.map((notice) => ({
      ...notice,
      repositoryId: entry.id,
      repositoryName: entry.name,
    })),
  }
}

/**
 * The whole board: one card per admitted record across every registered
 * repository, plus what each repository lost.
 *
 * Never rejects. A repository that cannot be read becomes a `failed` status
 * with a symbolic reason, so the surface can tell a fleet nobody could read
 * from a fleet with no work in flight.
 */
export async function readChangesFleet(
  options: ChangesFleetOptions = {},
): Promise<ChangesFleetResponse> {
  const now = options.now ?? Date.now()
  const entries = registryEntries(options)
  const key = cacheKey(entries)

  if (cached && cached.key === key && now - cached.cachedAt < CHANGES_MEMO_TTL_MS) {
    return cached.response
  }

  const scanGeneration = generation
  const settled = await Promise.allSettled(
    entries.map((entry) => readRepository(entry, options)),
  )
  const readings = settled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      // The per-repository read guards itself, so reaching here means the
      // repository came apart in a way it could not describe.
      : failed(entries[index]!, 'unreadable'),
  )

  const response: ChangesFleetResponse = {
    // Stamped when computed and replayed with the reading, so a cached board
    // reports the time it was taken rather than the time it was served.
    generatedAt: now,
    cards: readings.flatMap((reading) => reading.cards).sort(compareChangeCards),
    repositories: readings.map((reading) => reading.status),
    notices: readings.flatMap((reading) => reading.notices),
  }

  // An invalidation while this scan was in flight makes its reading stale by
  // definition — it was taken before whatever prompted the invalidation.
  // Returning it to *this* caller is correct; writing it back for the next one
  // is not.
  if (scanGeneration === generation) {
    cached = { key, cachedAt: options.now ?? Date.now(), response }
  }
  return response
}
