/**
 * registryPathDrift.ts — Phase 12 registry-entry drift detector + suggested-path
 * inference (D-12-18, D-12-21).
 *
 * Compares each `registry.json` entry against the on-disk reality, emitting a
 * `PathDriftEntry[]` for the conformance scan to surface in the SPA's
 * collapsible drift panel.
 *
 * Three drift reasons (PathDriftReasonSchema, Wave 0):
 *   - `missing` — existsSync(storedPath) === false
 *   - `symlink-target-changed` — realpath(storedPath) differs from
 *     canonicaliseRoot(storedPath) (i.e. a symlink was re-pointed since
 *     registration, or the stored value was never a canonical path)
 *   - `git-remote-changed` — the stored path does not live under any of the
 *     three family roots (agenticapps/factiv/neuroflash), so the project
 *     either moved between families or the family root itself drifted
 *
 * Suggested-path inference is best-effort: scan each family root one level
 * deep, read each candidate's `.git/config`, regex-parse the
 * `[remote "origin"]` url, and return the first match's realpath. Inference
 * never throws — failures yield `suggestedPath: null` and the SPA prompts
 * the user to paste the corrected path (D-12-21).
 *
 * THREAT BOUNDARIES (see plan §threat_model):
 *   - T-12-SUPPLY-CHAIN: NO subprocess. `.git/config` is read via fs.readFile
 *     + regex parsing only — matches RESEARCH §Environment availability
 *     fallback. Zero new runtime deps.
 *   - T-12-PATH-TRAVERSAL: family-root scan is one level deep (matches Phase
 *     10 repo discovery cadence) — no recursive readdir.
 *   - Defence-in-depth: every fs call is wrapped in try/catch returning a
 *     defensive default. The detector NEVER throws — registry-read failure
 *     yields [], per-entry probe failure is silently skipped.
 *
 * Implementation note: this file deliberately avoids any unbounded raise
 * pathway. Errors from helpers are caught at the boundary and converted to
 * defensive return values. Validation failures (which would be programmer
 * errors) are not expected here — this is pure read-side observability.
 */
import { existsSync, readdirSync } from 'node:fs'
import { readFile, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'

import type { PathDriftEntry } from '@agenticapps/dashboard-shared'

import { readRegistry, canonicaliseRoot } from './registry.js'
import { COVERAGE_ROOTS } from './paths.js'

/** Family roots scanned by inferSuggestedPath. Order is irrelevant (first URL match wins). */
const SCANNED_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
type ScannedFamily = (typeof SCANNED_FAMILIES)[number]

/**
 * Regex: capture the `url = …` value of the `[remote "origin"]` section.
 * `[\s\S]*?` is a non-greedy run that may span newlines (Git config files
 * are line-based but the section may contain other keys before `url`).
 * Anchored to whitespace + `=` + whitespace to tolerate tab/space formatting.
 */
const REMOTE_ORIGIN_URL_RE = /\[remote "origin"\][\s\S]*?url\s*=\s*([^\s]+)/

/** Best-effort parse — returns the trimmed URL or null on no match. */
function parseOriginUrl(configText: string): string | null {
  const match = REMOTE_ORIGIN_URL_RE.exec(configText)
  if (!match || !match[1]) return null
  return match[1].trim()
}

/**
 * Read `<rootPath>/.git/config` and extract the `[remote "origin"]` URL.
 * Returns null on ANY failure (file missing, unreadable, malformed) — caller
 * treats null as "no remote known", which is the safest default.
 */
async function readGitOrigin(rootPath: string): Promise<string | null> {
  try {
    const text = await readFile(join(rootPath, '.git', 'config'), 'utf8')
    return parseOriginUrl(text)
  } catch {
    return null
  }
}

/**
 * Resolve a family root to its realpath, tolerating absent dirs (returns null
 * so the caller can `.filter(Boolean)` the result list).
 */
async function realFamilyRoot(family: ScannedFamily): Promise<string | null> {
  try {
    return await realpath(COVERAGE_ROOTS[family]())
  } catch {
    return null
  }
}

/**
 * Best-effort: find a directory inside any family root whose `.git/config`
 * carries the given origin URL. Returns the matched candidate's realpath, or
 * null if nothing matches.
 *
 * Algorithm:
 *   1. For each family: realpath the family root (skip on failure).
 *   2. readdirSync(familyRoot) one level deep (skip on failure).
 *   3. For each candidate: readGitOrigin; on match, return realpath(candidate).
 *
 * Anti-pattern guards:
 *   - NO recursive descent — one level deep only.
 *   - NO subprocess — uses fs.readFile + regex (T-12-SUPPLY-CHAIN).
 *   - NEVER raises — all fs operations are try/catch-bounded.
 */
export async function inferSuggestedPath(originUrl: string): Promise<string | null> {
  for (const family of SCANNED_FAMILIES) {
    const familyRoot = await realFamilyRoot(family)
    if (!familyRoot) continue

    let entries: string[]
    try {
      entries = readdirSync(familyRoot)
    } catch {
      continue
    }

    for (const entry of entries) {
      const candidate = join(familyRoot, entry)
      const candidateOrigin = await readGitOrigin(candidate)
      if (candidateOrigin === originUrl) {
        try {
          return await realpath(candidate)
        } catch {
          // Fallback: candidate exists per readdir but realpath failed
          // (e.g. dangling symlink between calls) — return the join'd path.
          return candidate
        }
      }
    }
  }
  return null
}

/**
 * Internal probe result — either a drift reason + the origin URL (for
 * inference) or null when the entry is healthy.
 */
type ProbeResult =
  | { reason: PathDriftEntry['reason']; originUrl: string | null }
  | null

/**
 * Probe one registry entry, returning a drift reason or null if the entry is
 * healthy. ALL filesystem operations are try/catch-bounded so a partial
 * failure surfaces as "no drift" (defensive default) rather than a raise.
 */
async function probeEntry(storedPath: string): Promise<ProbeResult> {
  // 1. missing — existsSync returned false
  if (!existsSync(storedPath)) {
    return { reason: 'missing', originUrl: null }
  }

  // 2. symlink-target-changed — realpath(storedPath) differs from the
  //    stored path string itself. Registration canonicalises before storing
  //    (registry.ts:addProject → canonicaliseRoot → realpathSync), so the
  //    stored value SHOULD already equal its own realpath. Divergence here
  //    means the symlink was re-pointed since registration OR the registry
  //    was tampered with to store a non-canonical path.
  let real: string | null = null
  try {
    real = await realpath(storedPath)
  } catch {
    // realpath failed despite existsSync passing — most likely a symlink
    // loop or a permissions problem. Treat as missing to surface in the
    // drift panel (caller will see reason='missing').
    return { reason: 'missing', originUrl: null }
  }

  if (real !== storedPath) {
    const originUrl = await readGitOrigin(real)
    return { reason: 'symlink-target-changed', originUrl }
  }

  // canonicaliseRoot is defensive (try/catch internally) — falls back to
  // plain resolve() when realpath fails. With existsSync passing + realpath
  // already resolved, this is a sanity reference for the containment check.
  let canonical: string
  try {
    canonical = canonicaliseRoot(storedPath)
  } catch {
    return null
  }

  // 3. git-remote-changed — stored path is NOT under any family root
  const familyRoots = (await Promise.all(SCANNED_FAMILIES.map(realFamilyRoot))).filter(
    (r): r is string => r !== null,
  )

  const insideAnyFamily = familyRoots.some(
    (root) => canonical === root || canonical.startsWith(root + sep),
  )

  if (!insideAnyFamily) {
    const originUrl = await readGitOrigin(canonical)
    return { reason: 'git-remote-changed', originUrl }
  }

  // Healthy — no drift.
  return null
}

export interface DetectPathDriftOptions {
  /** Override registry.json path for testability. Defaults to REGISTRY_FILE. */
  registryFile?: string
}

/**
 * Detect drift across all registry entries. NEVER raises.
 *
 * @returns Array of `PathDriftEntry` (shape matches PathDriftEntrySchema).
 *   Empty array on registry-read failure or no projects.
 */
export async function detectPathDrift(
  opts: DetectPathDriftOptions = {},
): Promise<PathDriftEntry[]> {
  let projects: ReturnType<typeof readRegistry>['projects']
  try {
    projects = readRegistry(opts.registryFile).projects
  } catch {
    return []
  }

  const result: PathDriftEntry[] = []
  for (const project of projects) {
    let probe: ProbeResult
    try {
      probe = await probeEntry(project.root)
    } catch {
      // Defence-in-depth — probeEntry is itself try/catch-bounded but a
      // future refactor could leak. Silently skip rather than fail the scan.
      continue
    }
    if (!probe) continue

    let suggestedPath: string | null = null
    if (probe.originUrl) {
      try {
        suggestedPath = await inferSuggestedPath(probe.originUrl)
      } catch {
        suggestedPath = null
      }
    }

    result.push({
      id: project.id,
      storedPath: project.root,
      suggestedPath,
      reason: probe.reason,
    })
  }
  return result
}
