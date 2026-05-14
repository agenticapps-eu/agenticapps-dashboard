/**
 * gitNexusScanner.ts — ~/.gitnexus/registry.json parsing and repo freshness rating.
 *
 * RESEARCH verification: gitnexus@1.6.4 registry.json is a TOP-LEVEL ARRAY of RegistryEntry
 * (NOT an object with a repos property). Pitfall 1: use z.array() schema, never object-with-repos.
 *
 * CODEX HIGH-3: all reads of ~/.gitnexus/registry.json route through the `resolve` callback.
 * COV-10: ~/.gitnexus absent → { installed: false, entries: [] } — never throws.
 * COV-11: rateGitNexusRepo returns only 4 enumerated states.
 * Assumption A1: match by trying both repoAbsPath AND realpathSync(repoAbsPath).
 *
 * Note on fs imports: existsSync, readFileSync, realpathSync are used as named imports
 * (standalone functions) — not via member-access form. Zero dot-method hits in this file.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'
import type { PathResolver } from '../coverageResolver.js'

// ── Constants ─────────────────────────────────────────────────────────────────

/** COV-11 threshold: repos indexed > 14 days ago are stale. */
export const GITNEXUS_STALE_DAYS = 14

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * RegistryEntry schema — matches gitnexus@1.6.4 dist/storage/repo-manager.d.ts.
 * Uses .passthrough() for forward compatibility with remoteUrl?, stats?.
 *
 * Pitfall 1: the registry IS a top-level array — z.array(RegistryEntrySchema).
 * NEVER wrap in an object with a repos property.
 */
const RegistryEntrySchema = z
  .object({
    name: z.string(),
    path: z.string(),
    storagePath: z.string(),
    indexedAt: z.string(), // ISO-8601 datetime
    lastCommit: z.string(),
    remoteUrl: z.string().optional(),
    stats: z.object({}).passthrough().optional(),
  })
  .passthrough()

/** TOP-LEVEL ARRAY — not wrapped in an object (Pitfall 1). */
const RegistryArraySchema = z.array(RegistryEntrySchema)

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>

export interface GitNexusGlobalState {
  installed: boolean
  entries: RegistryEntry[]
}

export interface GitNexusRepoState {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  indexedAt?: string // ISO-8601 from registry
  daysSinceIndex?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safe realpathSync — returns the original path if realpath fails.
 * Used for Assumption A1 dual-form path matching.
 */
function realpathSafe(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

// ── scanGitNexusGlobal ────────────────────────────────────────────────────────

/**
 * Read the global ~/.gitnexus/registry.json state.
 *
 * CODEX HIGH-3: the registry.json path is validated through the `resolve` callback
 * before reading. If the resolver throws (path not accessible), returns safe defaults.
 *
 * @param homeOverride  Test-only override for home directory.
 * @param resolve       PathResolver callback (CODEX HIGH-3).
 */
export function scanGitNexusGlobal(
  homeOverride: string | undefined,
  resolve: PathResolver,
): GitNexusGlobalState {
  const home = homeOverride ?? homedir()
  const dir = join(home, '.gitnexus')

  // COV-10: absent ~/.gitnexus → not-applicable for all repos.
  if (!existsSync(dir)) return { installed: false, entries: [] }

  const file = join(dir, 'registry.json')
  if (!existsSync(file)) return { installed: true, entries: [] }

  // CODEX HIGH-3: validate the registry.json path through the resolver.
  let resolvedFile: string
  try {
    resolvedFile = resolve(file, {
      allowedNames: ['registry.json'],
      roots: [dir],
    })
  } catch {
    // Resolver rejected path — treat as no entries.
    return { installed: true, entries: [] }
  }

  let parsed: RegistryEntry[]
  try {
    // Pitfall 1: parse as top-level array (NOT { repos: [] }).
    parsed = RegistryArraySchema.parse(JSON.parse(readFileSync(resolvedFile, 'utf8')))
  } catch {
    // Corrupt or unexpected shape — return installed:true with no entries.
    return { installed: true, entries: [] }
  }

  return { installed: true, entries: parsed }
}

// ── rateGitNexusRepo ──────────────────────────────────────────────────────────

/**
 * Rate a single repo's GitNexus index freshness.
 *
 * States (COV-11 4-state vocabulary):
 *  - 'not-applicable': GitNexus not installed globally.
 *  - 'missing': repo not in the registry (never indexed).
 *  - 'fresh': indexed within GITNEXUS_STALE_DAYS.
 *  - 'stale': indexed more than GITNEXUS_STALE_DAYS ago.
 *
 * Assumption A1: tries both raw repoAbsPath AND realpathSync(repoAbsPath) to
 * handle cases where gitnexus canonicalised paths at write time but the daemon
 * receives a symlink-form path.
 */
export function rateGitNexusRepo(
  global: GitNexusGlobalState,
  repoAbsPath: string,
): GitNexusRepoState {
  if (!global.installed) return { state: 'not-applicable' }

  // Assumption A1: dual-form path match (raw + realpath).
  const realPath = realpathSafe(repoAbsPath)
  const entry = global.entries.find(
    (e) => e.path === repoAbsPath || e.path === realPath,
  )

  if (!entry) return { state: 'missing' }

  const indexed = new Date(entry.indexedAt)
  const days = Math.floor((Date.now() - indexed.getTime()) / (1000 * 60 * 60 * 24))

  return {
    state: days <= GITNEXUS_STALE_DAYS ? 'fresh' : 'stale',
    indexedAt: entry.indexedAt,
    daysSinceIndex: days,
  }
}
