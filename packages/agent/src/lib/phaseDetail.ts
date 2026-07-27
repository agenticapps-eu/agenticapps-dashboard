/**
 * Readers for a project's workflow-discipline artifacts.
 *
 * Everything here reads `<root>/.planning/skill-observations/` — the commitment
 * block, hook firings, and rationalization-table rows that feed the left column.
 * The phase-artifact parsers that used to share this module were retired with
 * the GSD phase reader; `.planning/phases/` is no longer read from here. The
 * filename kept its Phase-4 name for continuity with the routes that import it.
 *
 * Read-only invariant (INV-01): this module never writes to any project filesystem.
 * All path construction uses join() over a canonical root stored at registration
 * time. Internal parser paths use hardcoded string literals — no user-supplied
 * path segments flow into these parsers. The path-allow-list checker is NOT
 * invoked here (Pitfall 7: it is reserved for user-supplied /api/projects/:id/read?path=...).
 */

import { existsSync, readFileSync, readdirSync, statSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

// ── Local type definitions ────────────────────────────────────────────────────

export type CommitmentBlockResponse = {
  markdown: string | null
  sourceFile: string | null
}

export type HookFiring = {
  ts: string
  skill: string
  hook: string
  [key: string]: unknown
}

// ── parseCommitmentBlock ──────────────────────────────────────────────────────

/**
 * D-4-05: Latest Workflow commitment block from the highest-mtime
 * .md file in <root>/.planning/skill-observations/.
 */
export function parseCommitmentBlock(root: string): CommitmentBlockResponse {
  const dir = join(root, '.planning', 'skill-observations')
  if (!existsSync(dir)) return { markdown: null, sourceFile: null }
  let entries: { name: string; mtimeMs: number }[]
  try {
    const direntries = readdirSync(dir, { withFileTypes: true })
    entries = direntries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => ({
        name: e.name,
        mtimeMs: statSync(join(dir, e.name)).mtimeMs,
      }))
  } catch {
    return { markdown: null, sourceFile: null }
  }
  if (entries.length === 0) return { markdown: null, sourceFile: null }
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const latest = entries[0]!
  let content: string
  try {
    content = readFileSync(join(dir, latest.name), 'utf8')
  } catch {
    return { markdown: null, sourceFile: null }
  }
  const headingRe = /^## Workflow commitment\s*$/gm
  let lastIdx = -1
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(content)) !== null) {
    lastIdx = match.index + match[0].length
  }
  if (lastIdx === -1) return { markdown: null, sourceFile: null }
  const tail = content.slice(lastIdx)
  const nextH2 = tail.match(/\n## /m)
  const block = nextH2 ? tail.slice(0, nextH2.index) : tail
  const trimmed = block.trim()
  return {
    markdown: trimmed.length > 0 ? trimmed : null,
    sourceFile: latest.name,
  }
}

// ── Skill layout probing ──────────────────────────────────────────────────────

/**
 * D-4-07 + D-4-15 (amended 2026-05-06): probe both canonical single-file layout
 * (`<dir>/SKILL.md`) and bundle layout (`<dir>/skill/SKILL.md`) for a skill that
 * may be installed via `claude skill install` (canonical) or `git clone` (bundle).
 *
 * `dirNames` is searched in priority order. Returns the first existing path,
 * or null if none exist. All segments are hardcoded string literals (T-04-02-01
 * mitigation preserved).
 */
function findSkillPath(root: string, dirNames: readonly string[]): string | null {
  for (const dir of dirNames) {
    const canonical = join(root, '.claude', 'skills', dir, 'SKILL.md')
    if (existsSync(canonical)) return canonical
    const bundle = join(root, '.claude', 'skills', dir, 'skill', 'SKILL.md')
    if (existsSync(bundle)) return bundle
  }
  return null
}

const META_OBSERVER_DIRS = ['meta-observer'] as const
// Canonical name (matches `discover.ts:18`) takes precedence over the legacy
// `agenticapps-workflow` (no hyphen) used by older github-clone bundles.
const WORKFLOW_DIRS = ['agentic-apps-workflow', 'agenticapps-workflow'] as const

// ── readSkillObservations ─────────────────────────────────────────────────────

/**
 * D-4-08 + D-4-15: Top-N hook firings across .planning/skill-observations/*.jsonl
 * sorted by ts desc, plus skillInstalled flag (presence of meta-observer SKILL.md
 * at either canonical or bundle layout).
 */
export async function readSkillObservations(
  root: string,
  limit: number,
): Promise<{ entries: HookFiring[]; skillInstalled: boolean }> {
  const skillInstalled = findSkillPath(root, META_OBSERVER_DIRS) !== null
  // WR-03 fix (D-4-15): when the meta-observer skill is absent, return an
  // empty entries array. The detection contract specifies the daemon should
  // surface { entries: [], skillInstalled: false } so consumers do not see
  // stale JSONL when the producing skill is uninstalled.
  if (!skillInstalled) return { entries: [], skillInstalled }
  const dir = join(root, '.planning', 'skill-observations')
  if (!existsSync(dir)) return { entries: [], skillInstalled }
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl') || f.endsWith('.ndjson'))
  } catch {
    return { entries: [], skillInstalled }
  }
  if (files.length === 0) return { entries: [], skillInstalled }

  const all: HookFiring[] = []
  for (const file of files) {
    const stream = createReadStream(join(dir, file), { encoding: 'utf8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        if (
          typeof parsed.ts === 'string' &&
          typeof parsed.skill === 'string' &&
          typeof parsed.hook === 'string'
        ) {
          all.push(parsed as unknown as HookFiring)
        }
      } catch {
        // Skip malformed lines silently (T-04-02-04).
      }
    }
  }
  // IN-01 fix: use Date-object comparison so mixed ISO 8601 offset formats
  // (e.g. `Z` vs `+00:00`) sort by actual instant rather than ASCII codepoint.
  all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  return { entries: all.slice(0, limit), skillInstalled }
}

// ── parseRationalizationRows ──────────────────────────────────────────────────

/**
 * D-4-07: Parse the rationalization table from the workflow skill SKILL.md.
 */
const RATIONALIZATION_HEADING = '## Rationalization Table — Check Before Skipping Anything'

export function parseRationalizationRows(
  root: string,
  entries: HookFiring[],
): { rows: { label: string; fires: number }[]; skillInstalled: boolean } {
  const skillPath = findSkillPath(root, WORKFLOW_DIRS)
  if (skillPath === null) return { rows: [], skillInstalled: false }
  let content: string
  try {
    content = readFileSync(skillPath, 'utf8')
  } catch {
    return { rows: [], skillInstalled: false }
  }
  const headingIdx = content.indexOf(RATIONALIZATION_HEADING)
  if (headingIdx === -1) return { rows: [], skillInstalled: true }
  const tail = content.slice(headingIdx + RATIONALIZATION_HEADING.length)
  const lines = tail.split('\n')
  const labels: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('## ')) break
    if (!line.startsWith('|')) continue
    if (/^\|\s*-+/.test(line)) continue
    if (/^\|\s*If you think/i.test(line)) continue
    const cells = line.split('|')
    if (cells.length < 2) continue
    let cell = cells[1]!.trim()
    cell = cell.replace(/^"|"$/g, '')
    if (cell.length > 0) labels.push(cell)
  }
  // WR-02 fix: count an event as a fire only when its `payload` field matches
  // the row label. D-4-07 says the counter aggregates events whose `payload.row`
  // (or equivalent field per D-4-06 passthrough shape) matches a label. The
  // previous implementation serialized the entire entry to JSON and checked for
  // any substring match, which produced false positives when an unrelated field
  // (skill, hook, etc.) happened to contain the label as a substring.
  const rows = labels.map((label) => {
    let fires = 0
    for (const e of entries) {
      const payload: unknown = (e as Record<string, unknown>).payload
      let matches = false
      if (typeof payload === 'string') {
        matches = payload.includes(label)
      } else if (payload !== null && typeof payload === 'object') {
        for (const v of Object.values(payload as Record<string, unknown>)) {
          if (typeof v === 'string' && v.includes(label)) {
            matches = true
            break
          }
        }
      }
      if (matches) fires++
    }
    return { label, fires }
  })
  return { rows, skillInstalled: true }
}
