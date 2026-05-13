/**
 * repoDiscovery.ts — One-level-deep walk of 3 family roots under ~/Sourcecode.
 *
 * D-10-05: Discover every git repo under ~/Sourcecode/{agenticapps,factiv,neuroflash}.
 * Walk exactly one level deep; skip dotfiles, node_modules, and non-.git-bearing dirs.
 * Accept .git as both a directory (normal repo) AND a file (worktree marker).
 *
 * CODEX HIGH-2: Symlink-escape rejection — for every candidate repo directory,
 * compute realpathSync and reject if it does NOT start with familyRoot + sep.
 * Emits a structured warn log ('safety.symlink-escape') for rejected entries.
 *
 * D-10-05 Family lock: ONLY these three families. personal/, shared/, archive/
 * are NEVER named or walked.
 */
import { readdirSync, realpathSync, existsSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { homedir } from 'node:os'
import { agentError } from './logging.js'

// ── Families ──────────────────────────────────────────────────────────────────

/**
 * D-10-05: Locked family list. personal/shared/archive are NEVER walked.
 */
export const FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
export type CoverageFamily = (typeof FAMILIES)[number]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredRepo {
  family: CoverageFamily
  /** Directory name, e.g. 'agenticapps-dashboard'. */
  name: string
  /** Absolute path, e.g. '/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard'. */
  absPath: string
}

// ── discoverRepos ─────────────────────────────────────────────────────────────

/**
 * Walk each family root one level deep and return repos bearing a `.git` entry.
 *
 * @param rootOverride  Test-only override for ~/Sourcecode (default: homedir()+'/Sourcecode').
 * @returns Sorted array of discovered repos by (family, name).
 */
export function discoverRepos(rootOverride?: string): DiscoveredRepo[] {
  const sourcecodeRoot = rootOverride ?? join(homedir(), 'Sourcecode')
  const repos: DiscoveredRepo[] = []

  for (const family of FAMILIES) {
    const familyRoot = join(sourcecodeRoot, family)

    // Silently skip missing family directories.
    if (!existsSync(familyRoot)) continue

    let entries: string[]
    try {
      entries = readdirSync(familyRoot)
    } catch {
      // Silently skip unreadable family directories.
      continue
    }

    for (const name of entries) {
      // Skip dotfiles (entries starting with '.').
      if (name.startsWith('.')) continue
      // Skip node_modules.
      if (name === 'node_modules') continue

      const repoAbs = join(familyRoot, name)

      // CODEX HIGH-2: Symlink-escape rejection.
      // Compute realpath and reject if it escapes the family root.
      let realRepo: string
      try {
        realRepo = realpathSync(repoAbs)
      } catch {
        // If realpath fails (e.g. broken symlink or ENOENT), skip silently.
        continue
      }

      const realFamily = (() => {
        try {
          return realpathSync(familyRoot)
        } catch {
          return familyRoot
        }
      })()

      if (realRepo !== realFamily && !realRepo.startsWith(realFamily + sep)) {
        // Symlink escapes the family root — reject and warn.
        agentError(
          JSON.stringify({
            event: 'safety.symlink-escape',
            repoAbs,
            realpath: realRepo,
            familyRoot: realFamily,
          }),
        )
        continue
      }

      // Must be a directory.
      let stat
      try {
        stat = statSync(repoAbs)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue

      // Accept .git as either a directory OR a file (worktree marker).
      if (!existsSync(join(repoAbs, '.git'))) continue

      repos.push({ family, name, absPath: repoAbs })
    }
  }

  // Sort deterministically by (family, name).
  repos.sort((a, b) => {
    if (a.family !== b.family) return a.family < b.family ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })

  return repos
}
