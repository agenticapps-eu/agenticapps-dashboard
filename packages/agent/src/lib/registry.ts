/**
 * Registry lib: registry.json CRUD, slug generation, project status.
 *
 * Subprocess discipline: only execa (argv array) for git invocation.
 * The project root is user-controlled; using a shell-based spawn would
 * interpret it as shell tokens. execa uses argv arrays — no shell injection. (T-01-02-10)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  readdirSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'

import { execa } from 'execa'
import {
  RegistryEntrySchema,
  RegistryFileSchema,
  RegistryListItemSchema,
  type RegistryEntry,
  type RegistryFile,
  type RegistryListItem,
} from '@agenticapps/dashboard-shared'

import { CONFIG_DIR, GIT_SUBPROCESS_TIMEOUT_MS, REGISTRY_FILE } from '../constants.js'

import { atomicWriteFile } from './atomicWrite.js'
import { invalidateConformanceCache } from './conformanceCache.js'
import { invalidateCoverageCache } from './coverageCache.js'
import { parseOrCorrupt } from './stateCorruption.js'

export type { RegistryEntry, RegistryFile, RegistryListItem }

/**
 * Normalize a string to a URL-safe slug.
 * Strips diacritics, lowercases, collapses non-alnum to dash.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function ensureConfigDir(dir: string = CONFIG_DIR): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
}

/**
 * Canonicalise a project root once at registration. realpath follows symlinks
 * so that a symlink later repointed to a different directory cannot silently
 * change which files the read endpoint resolves under. Falls back to resolve()
 * if the path doesn't exist on disk yet — registering a missing path stays
 * legal (it will surface as `reachable: false` in /api/registry).
 *
 * Exposed for /register-prepare in Phase 3 (D-09 prepare/confirm flow).
 */
export function canonicaliseRoot(pathArg: string): string {
  const resolved = resolve(pathArg)
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

/**
 * Thrown when a registration target falls inside a known-sensitive system
 * root or a user-secret dotfile dir. Stopgap defense against a confused-deputy
 * scenario where a token holder (compromised SPA, browser extension, leaked
 * pair URL) registers a high-value path and reads its `.planning` / `.claude`
 * subtrees via /api/projects/:id/read. Proper fix (SPA banner-confirmed nonce)
 * is deferred to Phase 2.
 */
export class RegistrationPathBlocked extends Error {
  constructor(public readonly target: string, public readonly reason: string) {
    super(`registration path is blocked: ${target} (${reason})`)
    this.name = 'RegistrationPathBlocked'
  }
}

/**
 * System roots whose subtrees are not legitimate AgenticApps project dirs.
 * Exact match OR child of (i.e. canonicalPath === root or starts with root+sep).
 */
const SYSTEM_ROOT_BLOCKLIST: readonly string[] = [
  '/',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/Library',
  '/proc',
  '/private/etc',
  '/private/var/db',
  '/private/var/root',
  '/sbin',
  '/sys',
  '/System',
  '/usr/bin',
  '/usr/include',
  '/usr/lib',
  '/usr/libexec',
  '/usr/sbin',
  '/usr/share',
  '/usr/local/bin',
  '/usr/local/etc',
  '/usr/local/sbin',
]

/**
 * Names of dotfile dirs in $HOME that hold credentials/secrets and must never
 * be registered. Combined with $HOME at check time so the list is OS-portable.
 */
const HOME_SECRET_DIR_NAMES: readonly string[] = [
  '.aws',
  '.azure',
  '.config',
  '.docker',
  '.gcloud',
  '.gnupg',
  '.kube',
  '.npm',
  '.pgpass',
  '.pki',
  '.ssh',
]

function pathEqualsOrIsUnder(canonical: string, root: string): boolean {
  return canonical === root || canonical.startsWith(root + sep)
}

/**
 * Reject canonicalRoots that point at system or user-secret directories.
 * No-op for normal project paths (anywhere under $HOME that isn't a secret dir,
 * or anywhere under /tmp / /var/folders for tests). Throws RegistrationPathBlocked
 * with a human-readable reason on hit.
 */
export function assertRegistrationAllowed(canonicalRoot: string): void {
  for (const sysRoot of SYSTEM_ROOT_BLOCKLIST) {
    if (pathEqualsOrIsUnder(canonicalRoot, sysRoot)) {
      throw new RegistrationPathBlocked(canonicalRoot, `${sysRoot} is a system path`)
    }
  }
  const home = homedir()
  for (const name of HOME_SECRET_DIR_NAMES) {
    const dir = join(home, name)
    if (pathEqualsOrIsUnder(canonicalRoot, dir)) {
      throw new RegistrationPathBlocked(
        canonicalRoot,
        `${join('~', name)} holds credentials/secrets`,
      )
    }
  }
  // Daemon's own state dir — registering it would expose auth.json / registry.json.
  if (pathEqualsOrIsUnder(canonicalRoot, CONFIG_DIR)) {
    throw new RegistrationPathBlocked(canonicalRoot, "daemon's own state directory")
  }
}

export function ensureRegistryFile(filePath: string = REGISTRY_FILE): void {
  ensureConfigDir(dirname(filePath))
  if (!existsSync(filePath)) {
    const empty: RegistryFile = { version: 1, projects: [] }
    atomicWriteFile(filePath, JSON.stringify(empty, null, 2), 0o600)
  }
}

export function readRegistry(filePath: string = REGISTRY_FILE): RegistryFile {
  ensureRegistryFile(filePath)
  return parseOrCorrupt(
    RegistryFileSchema,
    JSON.parse(readFileSync(filePath, 'utf8')),
    'registry.json',
  )
}

export function writeRegistry(reg: RegistryFile, filePath: string = REGISTRY_FILE): void {
  const validated = RegistryFileSchema.parse(reg)
  ensureConfigDir(dirname(filePath))
  atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)
  // Every registry mutation can change the conformance + coverage view —
  // invalidate the per-process caches HERE so the next GET re-scans. Previously
  // only the fix-path route invalidated, leaving register/unregister/rename/tag
  // (CLI + /api/registry/register-confirm) able to serve stale data for up to
  // 30s. Cache modules are singletons per process; invalidation from the CLI
  // is a no-op (its cache instance is never populated), so this is safe.
  invalidateConformanceCache()
  invalidateCoverageCache()
}

export interface AddResult {
  entry: RegistryEntry
  alreadyRegistered: boolean
}

/**
 * Add a project to the registry. Idempotent on path collision (D-10).
 * Slug collisions get -2, -3 suffixes.
 */
export function addProject(
  pathArg: string,
  opts: { name?: string; client?: string | null; tags?: string[] } = {},
  filePath: string = REGISTRY_FILE,
): AddResult {
  const root = canonicaliseRoot(pathArg)
  assertRegistrationAllowed(root)
  const reg = readRegistry(filePath)
  const existing = reg.projects.find((p) => p.root === root)
  if (existing) return { entry: existing, alreadyRegistered: true }

  const baseSlug = slugify(opts.name ?? basename(root))
  let id = baseSlug
  let n = 2
  while (reg.projects.some((p) => p.id === id)) {
    id = `${baseSlug}-${n}`
    n += 1
  }
  const entry: RegistryEntry = RegistryEntrySchema.parse({
    id,
    name: opts.name ?? basename(root),
    root,
    client: opts.client ?? null,
    addedAt: new Date().toISOString(),
    tags: opts.tags ?? [],
  })
  reg.projects.push(entry)
  writeRegistry(reg, filePath)
  return { entry, alreadyRegistered: false }
}

/**
 * Remove a project by id or absolute path. Returns true if removed.
 *
 * Limit: when the registered root no longer exists on disk, canonicaliseRoot
 * falls back to plain resolve() and may not match the realpath we stored at
 * registration time (e.g. /tmp/X stored as /private/tmp/X on macOS). The
 * supported recovery path in that case is removal by id — `unregister <id>`
 * always works even when the filesystem path is gone. Walk-up canonicalisation
 * is a possible future improvement; not blocking the v1 ship.
 */
export function removeProject(
  idOrPath: string,
  filePath: string = REGISTRY_FILE,
): boolean {
  const reg = readRegistry(filePath)
  // Try both the canonical (realpath-resolved when reachable) AND the plain
  // resolve() form, so the user can remove with the same path string they used
  // at registration even if it later became unreachable.
  const targetCanonical = canonicaliseRoot(idOrPath)
  const targetResolved = resolve(idOrPath)
  const before = reg.projects.length
  reg.projects = reg.projects.filter(
    (p) => p.id !== idOrPath && p.root !== targetCanonical && p.root !== targetResolved,
  )
  if (reg.projects.length === before) return false
  writeRegistry(reg, filePath)
  return true
}

export function renameProject(
  id: string,
  newName: string,
  filePath: string = REGISTRY_FILE,
): boolean {
  const reg = readRegistry(filePath)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) return false
  entry.name = newName
  writeRegistry(reg, filePath)
  return true
}

export function setTags(
  id: string,
  tags: string[],
  filePath: string = REGISTRY_FILE,
): boolean {
  const reg = readRegistry(filePath)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) return false
  entry.tags = tags
  writeRegistry(reg, filePath)
  return true
}

/**
 * Check if a project root is currently reachable on the filesystem.
 */
export function isReachable(root: string): boolean {
  try {
    return statSync(root).isDirectory()
  } catch {
    return false
  }
}

function detectCurrentPhase(root: string): string | null {
  try {
    const phasesDir = resolve(root, '.planning', 'phases')
    if (!existsSync(phasesDir)) return null
    const dirs = readdirSync(phasesDir)
      .filter((d) => /^\d{2}-/.test(d))
      .sort()
    return dirs.at(-1) ?? null
  } catch {
    return null
  }
}

/**
 * Invoke git using execa with an argv array (safe from shell injection).
 * The cwd is the project root, which is user-controlled — passing it as
 * a cwd option rather than a shell argument keeps it safe. (T-01-02-10)
 */
async function detectLastCommitAt(root: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['log', '-1', '--format=%cI'], {
      cwd: root,
      reject: false,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    })
    const trimmed = stdout.trim()
    if (!trimmed) return null
    // git's %cI emits ISO-8601 with offset (e.g. 2026-05-04T11:44:11+02:00).
    // Zod's z.string().datetime() requires UTC `Z` form, so normalise here.
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  } catch {
    return null
  }
}

/**
 * Return all registry entries enriched with live reachability + phase + git status.
 * Never throws on unreachable roots — marks reachable: false instead.
 */
export async function listProjectsWithStatus(
  filePath: string = REGISTRY_FILE,
): Promise<RegistryListItem[]> {
  const reg = readRegistry(filePath)
  return Promise.all(
    reg.projects.map(async (p) => {
      const reachable = isReachable(p.root)
      return RegistryListItemSchema.parse({
        ...p,
        status: {
          reachable,
          currentPhase: reachable ? detectCurrentPhase(p.root) : null,
          lastCommitAt: reachable ? await detectLastCommitAt(p.root) : null,
        },
      })
    }),
  )
}
