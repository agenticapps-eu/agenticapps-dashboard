/**
 * wikiScanner.ts — .wiki-compiler.json source-reference + .compile-state.json freshness.
 *
 * Three-step logic:
 *  1. Does <familyAbsPath>/.wiki-compiler.json exist? No → 'missing', hint='wiki not linked'.
 *  2. Does the config reference this repo in sources[].path? No → 'missing', hint='repo not in sources'.
 *  3. Does <familyAbsPath>/.knowledge/wiki/.compile-state.json exist and have a valid
 *     last_compiled date? Absent → 'stale', hint='never compiled'. Invalid → 'stale'.
 *
 * AGREED-1 predicate (exact-match-or-prefix-with-slash):
 *   s.path === repoName || s.path.startsWith(repoName + '/')
 *   This prevents false-positive matches like 'app' matching 'app-worker'.
 *   The old buggy form s.path.startsWith(repoName) is NEVER used.
 *
 * CODEX HIGH-3: all reads go through the `resolve` callback (PathResolver).
 *
 * Note on fs imports: existsSync, readFileSync are used as named imports
 * (standalone functions) — not via member-access form. Zero dot-method hits in this file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { PathResolver } from '../coverageResolver.js'

// ── Constants ─────────────────────────────────────────────────────────────────

/** COV-11 threshold: wikis compiled > 7 days ago are stale. */
export const WIKI_STALE_DAYS = 7

// ── Schemas ───────────────────────────────────────────────────────────────────

const WikiSourceSchema = z.object({ path: z.string() }).passthrough()

const WikiConfigSchema = z
  .object({
    sources: z.array(WikiSourceSchema).optional(),
  })
  .passthrough()

const CompileStateSchema = z
  .object({
    last_compiled: z.string().optional(),
    wiki_version: z.number().optional(),
    topics: z.array(z.string()).optional(),
  })
  .passthrough()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WikiScanResult {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  lastCompiledDate?: string // YYYY-MM-DD
  daysSinceCompile?: number
  hint?: string // human-readable detail
}

// ── scanWikiForFamily ─────────────────────────────────────────────────────────

/**
 * Scan a family's wiki state for a specific repo.
 *
 * CODEX HIGH-3: all file reads go through the `resolve` callback.
 *
 * @param familyAbsPath  Absolute path to the family root (e.g. ~/Sourcecode/agenticapps).
 * @param repoName       Repository directory name (e.g. 'agenticapps-dashboard').
 * @param resolve        PathResolver callback (CODEX HIGH-3).
 */
export function scanWikiForFamily(
  familyAbsPath: string,
  repoName: string,
  resolve: PathResolver,
): WikiScanResult {
  // ── Step 1: does .wiki-compiler.json exist? ───────────────────────────────
  const configPath = join(familyAbsPath, '.wiki-compiler.json')

  let resolvedConfig: string
  try {
    resolvedConfig = resolve(configPath, {
      allowedNames: ['.wiki-compiler.json'],
      roots: [familyAbsPath],
    })
  } catch {
    // Not accessible — treat as absent.
    return { state: 'missing', hint: 'wiki not linked' }
  }

  if (!existsSync(resolvedConfig)) {
    return { state: 'missing', hint: 'wiki not linked' }
  }

  // ── Step 2: does the config reference this repo? ──────────────────────────
  let cfg: z.infer<typeof WikiConfigSchema>
  try {
    cfg = WikiConfigSchema.parse(JSON.parse(readFileSync(resolvedConfig, 'utf8')))
  } catch {
    return { state: 'missing', hint: 'wiki config invalid' }
  }

  const sources = Array.isArray(cfg.sources) ? cfg.sources : []

  // AGREED-1: exact-match-or-prefix-with-slash predicate.
  // NEVER use s.path.startsWith(repoName) alone (false-positive bug for 'app' vs 'app-worker').
  const referenced = sources.some(
    (s) =>
      typeof s.path === 'string' &&
      (s.path === repoName || s.path.startsWith(repoName + '/')),
  )

  if (!referenced) {
    return { state: 'missing', hint: 'repo not in .wiki-compiler.json sources' }
  }

  // ── Step 3: read compile state ────────────────────────────────────────────
  const statePath = join(familyAbsPath, '.knowledge', 'wiki', '.compile-state.json')

  let resolvedState: string
  try {
    resolvedState = resolve(statePath, {
      allowedNames: ['.compile-state.json'],
      roots: [familyAbsPath],
    })
  } catch {
    // Not accessible — treat as never compiled (configured but uncompiled = amber).
    return { state: 'stale', hint: 'never compiled' }
  }

  if (!existsSync(resolvedState)) {
    // Pitfall 2: configured but never compiled → 'stale' (amber), NOT 'missing' (red).
    return { state: 'stale', hint: 'never compiled' }
  }

  let compileState: z.infer<typeof CompileStateSchema>
  try {
    compileState = CompileStateSchema.parse(JSON.parse(readFileSync(resolvedState, 'utf8')))
  } catch {
    return { state: 'stale', hint: 'compile-state.json invalid' }
  }

  if (!compileState.last_compiled) {
    return { state: 'stale', hint: 'last_compiled missing' }
  }

  // Parse YYYY-MM-DD as a UTC date.
  const compiled = new Date(compileState.last_compiled + 'T00:00:00Z')
  if (isNaN(compiled.getTime())) {
    return { state: 'stale', hint: 'compile-state.json invalid' }
  }

  const days = Math.floor((Date.now() - compiled.getTime()) / (1000 * 60 * 60 * 24))

  return {
    state: days <= WIKI_STALE_DAYS ? 'fresh' : 'stale',
    lastCompiledDate: compileState.last_compiled,
    daysSinceCompile: days,
  }
}
