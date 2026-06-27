/**
 * repoRoot.ts — Canonical repoId → absolute root resolver (Plan 14-02, D-14-09).
 *
 * Single source of truth for the two core resolution functions previously
 * inlined in gitnexusScan.ts. Wave-3 plans (14-05, 14-06, 14-07) all import
 * from this module — do NOT duplicate the logic elsewhere.
 *
 * Security model:
 * ── D-13-EXT-08 — Deterministic forward resolver `family/repo` → absolute path.
 * ── D-13-EXT-09 corollary — Realpath-guarded symlink escape defence.
 * ── D-13-EXT-11 — Defence-in-depth dot-segment rejection (mirrors wire layer).
 * ── D-14-09 — Registry-first resolution before FS fallback.
 */
import { sep } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, realpathSync, statSync } from 'node:fs'

/**
 * D-13-EXT-08 — Deterministic forward resolver for `family/repo` → absolute path.
 * Inverse of `derivedRepoId`: given a `family/repo` repoId from the SPA, compute
 * the canonical absolute path under ~/Sourcecode/ and return it ONLY if the
 * directory exists on disk. Returns null otherwise.
 *
 * D-13-EXT-09 corollary (Codex CRITICAL #2) — Realpath-guarded.
 *   After existence + directory checks, realpath the candidate and refuse
 *   unless the resolved path equals the candidate OR lives under the family
 *   prefix. A symlink at ~/Sourcecode/agenticapps/evil → /etc would otherwise
 *   pass the directory check and let the daemon spawn gitnexus analyze with
 *   cwd=/etc. Mirrors assertSnapshotDirInDaemonHome (server/boot.ts:98-116).
 *
 * D-13-EXT-11 (Codex CRITICAL #1) — Defence-in-depth dot-segment rejection.
 *   The wire schema already rejects `.`, `..`, and `..` substrings, but the
 *   helper may be called from non-route paths in future. Re-check here so the
 *   safety invariant survives refactoring of the wire layer.
 *
 * Family allow-list is enforced (matches derivedRepoId).
 */
export function deterministicRepoRoot(repoId: string): string | null {
  const slash = repoId.indexOf('/')
  if (slash < 1 || slash === repoId.length - 1) return null
  const family = repoId.slice(0, slash)
  const repo = repoId.slice(slash + 1)
  const knownFamilies = ['agenticapps', 'factiv', 'neuroflash'] as const
  if (!(knownFamilies as readonly string[]).includes(family)) return null
  if (repo.includes('/') || repo.includes(sep)) return null
  // D-13-EXT-11 defence-in-depth
  if (repo === '.' || repo === '..' || repo.includes('..')) return null

  const familyPrefix = `${homedir()}${sep}Sourcecode${sep}${family}${sep}`
  const root = `${familyPrefix}${repo}`
  if (!existsSync(root)) return null
  try {
    if (!statSync(root).isDirectory()) return null
  } catch {
    return null
  }

  // D-13-EXT-09 corollary — symlink-escape defence (Codex CRITICAL #2).
  // Compare in canonical (realpath) form on both sides — macOS aliases
  // /var ↔ /private/var would otherwise produce false negatives when HOME
  // lives under /var/folders/ (mkdtemp default) but realpath returns /private.
  let realCandidate: string
  let realFamilyPrefix: string
  try {
    realCandidate = realpathSync.native(root)
    // realpath does not preserve trailing separator; add one back so the
    // startsWith check correctly enforces the prefix boundary (otherwise
    // /Sourcecode/agenticapps would match /Sourcecode/agenticapps-evil).
    realFamilyPrefix = realpathSync.native(familyPrefix.slice(0, -1)) + sep
  } catch {
    return null
  }
  // Only check startsWith — `realCandidate` is always {familyPrefix}{repo} so
  // it cannot equal the bare family root post-realpath. (Previously this had a
  // defence-in-depth `||` against equality with the family root; removed since
  // the candidate construction never produces that shape.)
  if (!realCandidate.startsWith(realFamilyPrefix)) return null
  return root
}

/**
 * Derive a canonical `family/repo` repoId from an absolute registry root path.
 * Mirrors the Phase 11 familyOf logic — family roots are ~/Sourcecode/{family}/{repo}.
 *
 * Returns null if the path doesn't match the expected ~/Sourcecode/{family}/{repo} shape.
 */
export function derivedRepoId(root: string): string | null {
  const home = homedir()
  const sourcecode = `${home}${sep}Sourcecode${sep}`
  if (!root.startsWith(sourcecode)) return null
  const rel = root.slice(sourcecode.length)
  const parts = rel.split(sep)
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  const family = parts[0]
  const repo = parts[1]
  const knownFamilies = ['agenticapps', 'factiv', 'neuroflash'] as const
  if (!(knownFamilies as readonly string[]).includes(family)) return null
  return `${family}/${repo}`
}

/**
 * Resolve repoId to an absolute root path.
 *
 * Resolution order (D-14-09 registry-first):
 *   1. Find the first registry project whose derivedRepoId(root) === repoId and
 *      return its root path directly. No FS check — the registry is authoritative.
 *   2. If no registry entry matches, fall back to deterministicRepoRoot(repoId).
 *   3. Return null if both miss.
 *
 * The registry-first ordering is intentional: a project registered with a
 * non-standard path (e.g. a symlink or a relocated clone) will resolve to the
 * recorded root rather than the deterministic ~/Sourcecode/family/repo path.
 *
 * @param repoId   canonical `family/repo` slug
 * @param projects registry entries (only `root` is used for derivation)
 */
export function resolveRepoRoot(
  repoId: string,
  projects: ReadonlyArray<{ root: string }>,
): string | null {
  // Registry-first lookup (D-14-09)
  const entry = projects.find((p) => derivedRepoId(p.root) === repoId)
  if (entry) return entry.root

  // FS fallback
  return deterministicRepoRoot(repoId)
}
