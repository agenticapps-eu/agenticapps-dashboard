/**
 * Registry lib: registry.json CRUD, slug generation, project status.
 *
 * NOTE: RegistryFileSchema, RegistryEntrySchema, RegistryListItemSchema are
 * defined locally here because packages/shared Plan 01-01 runs in parallel.
 * Plan 01-03 (Wave 2) will replace these with:
 *   import { RegistryFileSchema, RegistryEntrySchema, RegistryListItemSchema,
 *            type RegistryEntry, type RegistryFile, type RegistryListItem }
 *     from '@agenticapps/dashboard-shared'
 *
 * Subprocess discipline: only execa (argv array) for git invocation.
 * The project root is user-controlled; using a shell-based spawn would
 * interpret it as shell tokens. execa uses argv arrays — no shell injection. (T-01-02-10)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  statSync,
  readdirSync,
} from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

import { z } from 'zod'
import { execa } from 'execa'

import { CONFIG_DIR, REGISTRY_FILE } from '../constants.js'

// Local schemas — will be replaced by shared imports in Plan 01-03
const RegistryEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
  client: z.string().nullable(),
  addedAt: z.string().datetime(),
  tags: z.array(z.string()),
})

const RegistryFileSchema = z.object({
  version: z.literal(1),
  projects: z.array(RegistryEntrySchema),
})

const RegistryListItemSchema = RegistryEntrySchema.extend({
  status: z.object({
    reachable: z.boolean(),
    currentPhase: z.string().nullable(),
    lastCommitAt: z.string().nullable(),
  }),
})

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>
export type RegistryFile = z.infer<typeof RegistryFileSchema>
export type RegistryListItem = z.infer<typeof RegistryListItemSchema>

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

export function ensureRegistryFile(filePath: string = REGISTRY_FILE): void {
  ensureConfigDir(dirname(filePath))
  if (!existsSync(filePath)) {
    const empty: RegistryFile = { version: 1, projects: [] }
    writeFileSync(filePath, JSON.stringify(empty, null, 2), { mode: 0o600 })
    chmodSync(filePath, 0o600)
  }
}

export function readRegistry(filePath: string = REGISTRY_FILE): RegistryFile {
  ensureRegistryFile(filePath)
  return RegistryFileSchema.parse(JSON.parse(readFileSync(filePath, 'utf8')))
}

export function writeRegistry(reg: RegistryFile, filePath: string = REGISTRY_FILE): void {
  const validated = RegistryFileSchema.parse(reg)
  ensureConfigDir(dirname(filePath))
  writeFileSync(filePath, JSON.stringify(validated, null, 2), { mode: 0o600 })
  chmodSync(filePath, 0o600)
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
  const root = resolve(pathArg)
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
 */
export function removeProject(
  idOrPath: string,
  filePath: string = REGISTRY_FILE,
): boolean {
  const reg = readRegistry(filePath)
  const target = resolve(idOrPath)
  const before = reg.projects.length
  reg.projects = reg.projects.filter((p) => p.id !== idOrPath && p.root !== target)
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
    })
    return stdout.trim() || null
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
