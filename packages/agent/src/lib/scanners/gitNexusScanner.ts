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
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
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

/**
 * Three-state GitNexus install classification (10.6 follow-up).
 *
 *  - 'not-installed'           — no binary detected AND no parseable registry.
 *                                 CTA: "Install GitNexus" (npm install -g gitnexus).
 *  - 'installed-no-registry'   — binary detected, but ~/.gitnexus/registry.json
 *                                 absent or unparseable. The user has installed
 *                                 the tool but never run `gitnexus analyze`.
 *                                 CTA: "Index with GitNexus".
 *  - 'installed-with-registry' — registry.json parses (may have 0 entries).
 *                                 Normal stale/fresh matrix applies.
 *
 * Pre-10.6 the scanner only emitted a 2-state `installed: boolean`, which
 * conflated "not installed" with "installed but never indexed" and routed
 * both into the wrong CTA. See .planning/phases/DASH-10-.../10-IMPECCABLE.md
 * "Additional follow-up" section for the original bug report.
 */
export type GitNexusInstallState =
  | 'not-installed'
  | 'installed-no-registry'
  | 'installed-with-registry'

export interface GitNexusGlobalState {
  installState: GitNexusInstallState
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

// ── detectGitNexusBinary (10.6) ───────────────────────────────────────────────

/**
 * Default absolute system prefixes probed in production. Tests inject `[]`.
 * Each prefix is the dir whose `bin/gitnexus` is checked.
 */
const DEFAULT_SYSTEM_PREFIXES = ['/usr/local', '/opt/homebrew']

export interface DetectGitNexusBinaryOptions {
  /** Test-only home override (matches scanGitNexusGlobal's pattern). */
  homeOverride?: string
  /**
   * Test-only override of the absolute system prefixes probed.
   * Production default is /usr/local + /opt/homebrew. Tests pass `[]`
   * to scope detection to the home override.
   */
  systemPrefixesOverride?: string[]
}

/**
 * Probe well-known install prefixes for a `gitnexus` executable.
 *
 * Stat-based only — NO shell-out, NO PATH inspection — so this works the
 * same whether the daemon was started from a fnm-activated shell or by
 * launchd with a minimal PATH (Phase 6 service install).
 *
 * Probed locations (in order, first hit wins):
 *  - <home>/.local/bin/gitnexus                                    (XDG user bin)
 *  - <home>/.local/share/fnm/node-versions/<v>/installation/bin/gitnexus
 *  - <home>/.nvm/versions/node/<v>/bin/gitnexus
 *  - <home>/.npm-global/bin/gitnexus                               (npm prefix override)
 *  - <home>/.volta/bin/gitnexus                                    (volta shim)
 *  - <home>/.bun/install/global/node_modules/gitnexus/dist/cli/index.js (bun global)
 *  - <prefix>/bin/gitnexus  for each prefix in systemPrefixesOverride (or defaults)
 *
 * Returns true on first hit. Does NOT validate the binary actually runs —
 * presence is the signal. A broken binary still means "user has installed
 * something called gitnexus and should be guided to `analyze`, not `install`".
 */
export function detectGitNexusBinary(
  opts: DetectGitNexusBinaryOptions = {},
): boolean {
  const home = opts.homeOverride ?? homedir()
  const systemPrefixes = opts.systemPrefixesOverride ?? DEFAULT_SYSTEM_PREFIXES

  // 1. Direct home-relative paths (cheap stats).
  const directCandidates = [
    join(home, '.local', 'bin', 'gitnexus'),
    join(home, '.npm-global', 'bin', 'gitnexus'),
    join(home, '.volta', 'bin', 'gitnexus'),
    join(home, '.bun', 'install', 'global', 'node_modules', 'gitnexus', 'dist', 'cli', 'index.js'),
  ]
  for (const p of directCandidates) {
    if (existsSync(p)) return true
  }

  // 2. fnm node-versions glob: <home>/.local/share/fnm/node-versions/<v>/installation/bin/gitnexus
  if (probeNodeVersionsDir(join(home, '.local', 'share', 'fnm', 'node-versions'), ['installation', 'bin', 'gitnexus'])) {
    return true
  }

  // 3. nvm node-versions glob: <home>/.nvm/versions/node/<v>/bin/gitnexus
  if (probeNodeVersionsDir(join(home, '.nvm', 'versions', 'node'), ['bin', 'gitnexus'])) {
    return true
  }

  // 4. System prefixes (homebrew, /usr/local).
  for (const prefix of systemPrefixes) {
    if (existsSync(join(prefix, 'bin', 'gitnexus'))) return true
  }

  return false
}

/**
 * Probe a "node-versions"-style directory: list its immediate subdirs
 * and check whether any subdir contains <suffixSegments>/gitnexus.
 * Returns false (silently) on any I/O error — detection is best-effort.
 */
function probeNodeVersionsDir(versionsDir: string, suffixSegments: string[]): boolean {
  try {
    if (!existsSync(versionsDir)) return false
    const entries = readdirSync(versionsDir)
    for (const entry of entries) {
      const candidate = join(versionsDir, entry, ...suffixSegments)
      if (existsSync(candidate)) {
        // Sanity: skip non-files (broken symlinks fail existsSync; stat just defends against dirs).
        try {
          const st = statSync(candidate)
          if (st.isFile() || st.isSymbolicLink()) return true
        } catch {
          // ignore — keep probing
        }
      }
    }
  } catch {
    // versionsDir not readable — treat as no install.
  }
  return false
}

// ── scanGitNexusGlobal ────────────────────────────────────────────────────────

/**
 * Read the global GitNexus install state (10.6 three-state model).
 *
 * Decision tree:
 *   parseable registry.json  → 'installed-with-registry' (entries populated)
 *   binary detected, no reg  → 'installed-no-registry'
 *   else                     → 'not-installed'
 *
 * CODEX HIGH-3: the registry.json path is validated through the `resolve` callback
 * before reading. If the resolver throws (path not accessible), the registry is
 * treated as absent — classification falls through to binary detection.
 *
 * @param homeOverride               Test-only override for home directory.
 * @param resolve                    PathResolver callback (CODEX HIGH-3).
 * @param systemPrefixesOverride     Test-only override for absolute system prefixes
 *                                   probed by binary detection. Tests pass `[]` to
 *                                   keep results deterministic; production uses
 *                                   defaults (/usr/local + /opt/homebrew).
 */
export function scanGitNexusGlobal(
  homeOverride: string | undefined,
  resolve: PathResolver,
  systemPrefixesOverride?: string[],
): GitNexusGlobalState {
  const home = homeOverride ?? homedir()
  const dir = join(home, '.gitnexus')

  const binaryOpts: DetectGitNexusBinaryOptions = {}
  if (homeOverride !== undefined) binaryOpts.homeOverride = homeOverride
  if (systemPrefixesOverride !== undefined) binaryOpts.systemPrefixesOverride = systemPrefixesOverride
  const binaryFound = detectGitNexusBinary(binaryOpts)

  // Try to parse the registry first — its presence is the strongest signal.
  const file = join(dir, 'registry.json')
  if (existsSync(dir) && existsSync(file)) {
    let resolvedFile: string | null = null
    try {
      resolvedFile = resolve(file, {
        allowedNames: ['registry.json'],
        roots: [dir],
      })
    } catch {
      // Resolver rejected — treat as if registry didn't parse.
    }

    if (resolvedFile !== null) {
      try {
        // Pitfall 1: parse as top-level array (NOT { repos: [] }).
        const parsed = RegistryArraySchema.parse(JSON.parse(readFileSync(resolvedFile, 'utf8')))
        return { installState: 'installed-with-registry', entries: parsed }
      } catch {
        // Corrupt or unexpected shape — fall through to binary-based classification.
      }
    }
  }

  // No parseable registry. Classify by binary presence.
  if (binaryFound) {
    return { installState: 'installed-no-registry', entries: [] }
  }
  return { installState: 'not-installed', entries: [] }
}

// ── rateGitNexusRepo ──────────────────────────────────────────────────────────

/**
 * Rate a single repo's GitNexus index freshness.
 *
 * States (COV-11 4-state vocabulary):
 *  - 'not-applicable': GitNexus binary not installed (user must install first).
 *  - 'missing': either (a) binary installed but registry absent — repo
 *               CAN be indexed; or (b) registry present but repo not yet in it.
 *  - 'fresh': indexed within GITNEXUS_STALE_DAYS.
 *  - 'stale': indexed more than GITNEXUS_STALE_DAYS ago.
 *
 * 10.6 semantic shift: under the prior 2-state model, "no registry" mapped to
 * 'not-applicable' for every repo. Now, when the binary is installed but the
 * registry hasn't been created yet ('installed-no-registry'), per-repo state
 * becomes 'missing' — surfacing the actionable state ("you can index this") in
 * the matrix instead of dimming the whole column.
 *
 * Assumption A1: tries both raw repoAbsPath AND realpathSync(repoAbsPath) to
 * handle cases where gitnexus canonicalised paths at write time but the daemon
 * receives a symlink-form path.
 */
export function rateGitNexusRepo(
  global: GitNexusGlobalState,
  repoAbsPath: string,
): GitNexusRepoState {
  if (global.installState === 'not-installed') return { state: 'not-applicable' }
  if (global.installState === 'installed-no-registry') return { state: 'missing' }

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
