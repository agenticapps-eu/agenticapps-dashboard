/**
 * skillDriftScan.ts — Cross-repo Skill drift aggregator.
 *
 * Plan 11-03 — closes SKD-01..03. Reads `.claude/skills/` across every
 * registered project and folds the result into a per-skill matrix
 * (D-11-04: rows = skills, columns = projects). The daemon-side response
 * shape is locked by `SkillDriftResponseSchema` in `@agenticapps/dashboard-shared`.
 *
 * Key locked invariants:
 *   - REVIEWS action item 6: `readLocalSkills(root)` returns
 *     `{ scope: 'local'; skills: SkillEntry[] }` (verified at skillsScan.ts:133-135).
 *     This aggregator destructures `.skills` — it does NOT treat the return as
 *     an array.
 *   - Family derivation is path-based, NOT registry.client-based (live registry
 *     has `client: null` for every entry). `familyOf` matches against
 *     `<homedir>/Sourcecode/{agenticapps,factiv,neuroflash}/<repo>`, with
 *     'other' fallback for off-family registrations.
 *   - Promise.allSettled isolation (Phase 10 AGREED-2): one project's failure
 *     does NOT poison the whole response. Failed projects appear with a
 *     `degraded` marker.
 *   - Threat T-11-03-06: only `error.message` is exposed on `degraded`, never
 *     the full error object or stack trace.
 */
import { homedir } from 'node:os'
import { join, sep } from 'node:path'

import type {
  SkillDriftCell,
  SkillDriftResponse,
  SkillDriftRow,
} from '@agenticapps/dashboard-shared'

import { readRegistry } from './registry.js'
import { readLocalSkills, type SkillEntry } from './skillsScan.js'

/** The three known client families. Locked at plan time (Plan 11-01 D-11-04). */
export const KNOWN_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
export type KnownFamily = (typeof KNOWN_FAMILIES)[number]
export type Family = KnownFamily | 'other'

/**
 * Derive a family bucket from an absolute project root path.
 *
 * Rules (live registry research confirmed `client: null` everywhere — path-based
 * derivation is authoritative):
 *   - `<home>/Sourcecode/<family>/<repo>` where `<family>` is one of the known
 *     three → that family.
 *   - `<home>/Sourcecode/<unknown-family>/<repo>` → 'other'.
 *   - Outside `<home>/Sourcecode/` → 'other'.
 *   - Exact family dir with no `<repo>` child → 'other' (registry should never
 *     register a family dir itself; we document the behaviour).
 *
 * `homedirOverride` exists for testability and portability — production callers
 * pass nothing and the function uses `os.homedir()`.
 */
export function familyOf(root: string, homedirOverride?: string): Family {
  const home = homedirOverride ?? homedir()
  const sourcecode = join(home, 'Sourcecode') + sep
  if (!root.startsWith(sourcecode)) return 'other'
  const rel = root.slice(sourcecode.length)
  const parts = rel.split(sep)
  const head = parts[0]
  // Need both a family head AND a non-empty repo child to count.
  if (parts.length < 2 || !head || !parts[1]) return 'other'
  return (KNOWN_FAMILIES as readonly string[]).includes(head) ? (head as KnownFamily) : 'other'
}

/**
 * Options for `scanSkillDrift`. Both are test seams — production callers
 * pass nothing.
 */
export interface ScanSkillDriftOptions {
  /** Override the registry file path (test fixture isolation — REVIEWS action item 7). */
  registryFile?: string
  /** Override `os.homedir()` for `familyOf` derivation (test portability). */
  homedirOverride?: string
}

/**
 * Identifier accessor for a SkillEntry. SKILL.md frontmatter `name` is the
 * canonical identifier; `dir` is the deterministic fallback when frontmatter
 * is absent (skillsScan already supplies `dir`-based fallback for `name`, so
 * this is defence-in-depth).
 */
function skillIdOf(s: SkillEntry): string {
  return s.name || s.dir || '<unknown>'
}

/**
 * Walk the registry, read `.claude/skills/` per project (via the existing
 * `readLocalSkills` scanner reused unchanged), and fold the result into a
 * per-skill matrix.
 */
export async function scanSkillDrift(
  opts: ScanSkillDriftOptions = {},
): Promise<SkillDriftResponse> {
  const reg = readRegistry(opts.registryFile)

  // Promise.allSettled isolation (Phase 10 AGREED-2). One bad project does not
  // poison the response.
  const perProject = await Promise.allSettled(
    reg.projects.map(async (p) => {
      // REVIEWS action item 6: readLocalSkills returns `{ scope, skills }`.
      // Destructure `.skills` explicitly — do NOT treat the return as an array.
      const { skills } = await readLocalSkills(p.root)
      return { entry: p, skills }
    }),
  )

  const projects: SkillDriftResponse['projects'] = []
  const skillsByProject = new Map<string, SkillEntry[]>()

  for (let i = 0; i < perProject.length; i += 1) {
    const settled = perProject[i]!
    const entry = reg.projects[i]!
    const family = familyOf(entry.root, opts.homedirOverride)

    if (settled.status === 'fulfilled') {
      projects.push({
        projectId: entry.id,
        projectName: entry.name,
        family,
      })
      skillsByProject.set(entry.id, settled.value.skills)
    } else {
      // Threat T-11-03-06: expose `error.message` only — never the full error
      // object or stack trace.
      const reason =
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason)
      projects.push({
        projectId: entry.id,
        projectName: entry.name,
        family,
        degraded: reason,
      })
    }
  }

  // Build the per-skill row index. Skills are sorted alphabetically for
  // deterministic SPA rendering.
  const allSkillIds = new Set<string>()
  for (const skills of skillsByProject.values()) {
    for (const s of skills) allSkillIds.add(skillIdOf(s))
  }

  const rows: SkillDriftRow[] = []
  for (const skillId of Array.from(allSkillIds).sort()) {
    const byProject: Record<string, SkillDriftCell> = {}
    for (const proj of projects) {
      const skills = skillsByProject.get(proj.projectId)
      const found = skills?.find((s) => skillIdOf(s) === skillId)
      if (found) {
        // SkillEntry carries frontmatter passthrough fields; `version` and
        // `lastModifiedIso` may or may not be present depending on the file.
        const version = typeof found.version === 'string' ? found.version : null
        const lastModifiedRaw = (found as Record<string, unknown>).lastModifiedIso
        const lastModifiedIso = typeof lastModifiedRaw === 'string' ? lastModifiedRaw : null
        byProject[proj.projectId] = {
          present: true,
          version,
          lastModifiedIso,
        }
      } else {
        byProject[proj.projectId] = {
          present: false,
          version: null,
          lastModifiedIso: null,
        }
      }
    }
    rows.push({ skillId, byProject })
  }

  return {
    schemaVersion: 1 as const,
    generatedAtIso: new Date().toISOString(),
    projects,
    rows,
  }
}
