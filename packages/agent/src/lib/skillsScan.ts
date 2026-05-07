/**
 * skillsScan.ts — SKILL.md frontmatter reader for global + local skill roots.
 *
 * D-5-12: Global root anchored at os.homedir() + '/.claude/skills'.
 * D-5-13: Per-project local root at <projectRoot>/.claude/skills.
 *
 * Dual-layout probe: canonical (<dir>/SKILL.md) first, then bundle
 * (<dir>/skill/SKILL.md). Mirrors Phase 4 phaseDetail.ts:129-137 pattern.
 *
 * Security: realpathSync per entry, reject any entry whose realpath escapes
 * the resolved root (planted-symlink defence — T-05-02-Symlink-Escape).
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string
  description?: string
  version?: string
  /** Passthrough — preserve all unknown fields (D-4-06 philosophy). */
  [k: string]: unknown
}

export interface SkillEntry extends SkillFrontmatter {
  /** Filesystem directory name of the skill (e.g. 'agenticapps-workflow'). */
  dir: string
  /** 'global' for ~/.claude/skills entries, 'local' for <project>/.claude/skills. */
  scope: 'global' | 'local'
}

// ── parseFrontmatter ──────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a SKILL.md file.
 *
 * Returns null when:
 * - File does not exist / cannot be read.
 * - No `---` frontmatter delimiters found.
 * - Frontmatter is malformed (never throws).
 *
 * Handles:
 * - Simple `key: value` lines.
 * - `description: |` YAML literal blocks (subsequent indented lines joined with \n).
 * - Passthrough for unknown fields.
 * - dirname-based name fallback when `name` field absent.
 */
export function parseFrontmatter(skillMdPath: string): SkillFrontmatter | null {
  let raw: string
  try {
    raw = readFileSync(skillMdPath, 'utf8')
  } catch {
    return null
  }

  // Match content between first two --- markers (multiline)
  const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/m
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return null

  const body = m[1]!
  const out: Record<string, unknown> = {}
  const lines = body.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    if (!key) continue
    const val = line.slice(colonIdx + 1).trim()

    if (val === '|') {
      // YAML literal block — read subsequent indented lines
      const blockLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j]!
        // Empty lines are allowed within a literal block
        if (next.length === 0 || next === '\r') {
          blockLines.push('')
          j++
          continue
        }
        // Non-indented line terminates the block
        if (!/^\s/.test(next)) break
        blockLines.push(next.replace(/^\s+/, ''))
        j++
      }
      out[key] = blockLines.join('\n').trimEnd()
      i = j - 1
    } else {
      out[key] = val
    }
  }

  // name fallback: derive from dirname when absent
  if (typeof out.name !== 'string') {
    const parts = skillMdPath.split(sep)
    // For canonical layout:  .../<skillDir>/SKILL.md         → parts[-2] = skillDir
    // For bundle layout:     .../<skillDir>/skill/SKILL.md   → parts[-3] = skillDir
    const maybeSkillDir = parts[parts.length - 2] === 'skill'
      ? (parts[parts.length - 3] ?? 'unknown')
      : (parts[parts.length - 2] ?? 'unknown')
    out.name = maybeSkillDir
  }

  return out as SkillFrontmatter
}

// ── readGlobalSkills ──────────────────────────────────────────────────────────

/**
 * Read all skills from the global skills root (typically ~/.claude/skills).
 *
 * `root` is the full path to the skills directory (NOT ~/.claude).
 * Returns `{ scope: 'global', skills: [] }` when root doesn't exist.
 * Stable sort by dir ascending (deterministic SPA rendering — D-5-12).
 */
export async function readGlobalSkills(root: string): Promise<{ scope: 'global'; skills: SkillEntry[] }> {
  const result = await readSkillsAt(root, 'global')
  return result as { scope: 'global'; skills: SkillEntry[] }
}

// ── readLocalSkills ───────────────────────────────────────────────────────────

/**
 * Read all skills from a project's local skills dir (<projectRoot>/.claude/skills).
 *
 * Returns `{ scope: 'local', skills: [] }` when the dir doesn't exist.
 */
export async function readLocalSkills(projectRoot: string): Promise<{ scope: 'local'; skills: SkillEntry[] }> {
  const result = await readSkillsAt(join(projectRoot, '.claude', 'skills'), 'local')
  return result as { scope: 'local'; skills: SkillEntry[] }
}

// ── shared logic ──────────────────────────────────────────────────────────────

async function readSkillsAt(
  root: string,
  scope: 'global' | 'local',
): Promise<{ scope: 'global' | 'local'; skills: SkillEntry[] }> {
  if (!existsSync(root)) return { scope, skills: [] }

  let realRoot: string
  try {
    realRoot = realpathSync(root)
  } catch {
    return { scope, skills: [] }
  }

  let entries: string[]
  try {
    entries = readdirSync(realRoot)
  } catch {
    return { scope, skills: [] }
  }

  // Sort ascending for deterministic output (D-5-12)
  entries.sort()

  const skills: SkillEntry[] = []
  for (const dir of entries) {
    const entryPath = join(realRoot, dir)

    // Symlink-escape defence (T-05-02-Symlink-Escape): realpath each entry,
    // reject any that escapes the realRoot.
    let realEntry: string
    try {
      realEntry = realpathSync(entryPath)
    } catch {
      continue
    }
    if (realEntry !== entryPath && !realEntry.startsWith(realRoot + sep)) continue

    // Must be a directory
    let stat
    try {
      stat = statSync(realEntry)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    // Dual-layout probe: canonical first, then bundle (D-4-07 + D-4-15 pattern)
    const canonical = join(realEntry, 'SKILL.md')
    const bundle = join(realEntry, 'skill', 'SKILL.md')
    let mdPath: string | null = null
    if (existsSync(canonical)) mdPath = canonical
    else if (existsSync(bundle)) mdPath = bundle
    if (!mdPath) continue

    const fm = parseFrontmatter(mdPath)
    if (!fm) continue

    skills.push({ ...fm, dir, scope } as SkillEntry)
  }

  return { scope, skills }
}
