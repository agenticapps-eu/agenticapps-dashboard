/**
 * Phase 4 parser functions.
 *
 * Read-only invariant (INV-01): this module never writes to any project filesystem.
 * All path construction uses join() over a canonical root stored at registration
 * time. Internal parser paths use hardcoded string literals — no user-supplied
 * path segments flow into these parsers. resolveAllowed() is NOT called here
 * (Pitfall 7: it is reserved for user-supplied /api/projects/:id/read?path=... queries).
 *
 * Types are defined locally (structural equivalents of the @agenticapps/dashboard-shared
 * schemas from Plan 04-01 which lands in a parallel wave).
 */

import { existsSync, readFileSync, readdirSync, statSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

import { execa } from 'execa'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

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

export type PhaseFileStatus = {
  name: string
  present: boolean
  mtimeIso: string | null
}

export type ExecutionTimelineEntry = {
  taskId: string
  redCommit: { sha: string; subject: string; isoDate: string } | null
  greenCommit: { sha: string; subject: string; isoDate: string } | null
}

export type ReviewFindingCounts = {
  critical: number
  high: number
  medium: number
  low: number
}

export type VerificationStatusPayload = {
  mustHavesTotal: number
  mustHavesEvidenced: number
  items: { text: string; evidenced: boolean }[]
}

export type CsoSummary = {
  fileName: string
  content: string
}

export type DbSentinelSummary = {
  fileName: string
  content: string
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

// ── readSkillObservations ─────────────────────────────────────────────────────

/**
 * D-4-08 + D-4-15: Top-N hook firings across .planning/skill-observations/*.jsonl
 * sorted by ts desc, plus skillInstalled flag (presence of meta-observer SKILL.md).
 */
export async function readSkillObservations(
  root: string,
  limit: number,
): Promise<{ entries: HookFiring[]; skillInstalled: boolean }> {
  const skillInstalled = existsSync(
    join(root, '.claude', 'skills', 'meta-observer', 'SKILL.md'),
  )
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
  all.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0))
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
  const skillPath = join(
    root,
    '.claude',
    'skills',
    'agenticapps-workflow',
    'skill',
    'SKILL.md',
  )
  if (!existsSync(skillPath)) return { rows: [], skillInstalled: false }
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
  const rows = labels.map((label) => {
    let fires = 0
    for (const e of entries) {
      const blob = JSON.stringify(e)
      if (blob.includes(label)) fires++
    }
    return { label, fires }
  })
  return { rows, skillInstalled: true }
}

// ── parsePhaseChecklist ───────────────────────────────────────────────────────

/**
 * UI-SPEC PhaseProgress canonical order:
 *  CONTEXT, RESEARCH, UI-SPEC, DISCUSSION-LOG,
 *  per-plan PLAN/SUMMARY pairs (NN-NN ordered),
 *  REVIEW, REVIEW-FIX, SECURITY, IMPECCABLE, VERIFICATION, HUMAN-UAT.
 *
 * Reports basename WITHOUT phase prefix (e.g. CONTEXT.md not 04-CONTEXT.md).
 */
const FIXED_PRE_PLAN = [
  'CONTEXT.md',
  'RESEARCH.md',
  'UI-SPEC.md',
  'DISCUSSION-LOG.md',
] as const
const FIXED_POST_PLAN = [
  'REVIEW.md',
  'REVIEW-FIX.md',
  'SECURITY.md',
  'IMPECCABLE.md',
  'VERIFICATION.md',
  'HUMAN-UAT.md',
] as const

export function parsePhaseChecklist(phaseDir: string): PhaseFileStatus[] {
  if (!existsSync(phaseDir)) return []
  let dirEntries: string[]
  try {
    dirEntries = readdirSync(phaseDir)
  } catch {
    return []
  }
  const planRe = /^\d{2}-\d{2}-PLAN\.md$/
  const summaryRe = /^\d{2}-\d{2}-SUMMARY\.md$/
  const plans = dirEntries.filter((f) => planRe.test(f)).sort()
  const summaries = dirEntries.filter((f) => summaryRe.test(f)).sort()
  const planPairOrder: string[] = []
  for (const plan of plans) {
    planPairOrder.push(plan)
    const matchingSummary = plan.replace('-PLAN.md', '-SUMMARY.md')
    if (summaries.includes(matchingSummary)) planPairOrder.push(matchingSummary)
  }
  const statRow = (displayName: string): PhaseFileStatus => {
    const found = dirEntries.find(
      (f) => f === displayName || f.endsWith(`-${displayName}`),
    )
    if (!found) return { name: displayName, present: false, mtimeIso: null }
    try {
      const st = statSync(join(phaseDir, found))
      return { name: displayName, present: true, mtimeIso: new Date(st.mtimeMs).toISOString() }
    } catch {
      return { name: displayName, present: false, mtimeIso: null }
    }
  }
  const planRow = (filename: string): PhaseFileStatus => {
    try {
      const st = statSync(join(phaseDir, filename))
      return { name: filename, present: true, mtimeIso: new Date(st.mtimeMs).toISOString() }
    } catch {
      return { name: filename, present: false, mtimeIso: null }
    }
  }
  const result: PhaseFileStatus[] = []
  for (const n of FIXED_PRE_PLAN) result.push(statRow(n))
  for (const f of planPairOrder) result.push(planRow(f))
  for (const n of FIXED_POST_PLAN) result.push(statRow(n))
  return result
}

// ── parseExecutionTimeline ────────────────────────────────────────────────────

const TASK_ID_RE = /^(?:test|feat|refactor|docs)\((\d{2}-\d{2})\):/

/**
 * PHASE-02: TDD commit pairs grouped per task ID.
 * Uses execa argv-array (no shell injection, T-04-02-07) with GIT_SUBPROCESS_TIMEOUT_MS.
 */
export async function parseExecutionTimeline(
  root: string,
  phasePrefix: string,
): Promise<ExecutionTimelineEntry[]> {
  const result = await execa('git', ['log', '--format=%H\t%s\t%aI', '--no-merges'], {
    cwd: root,
    timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    reject: false,
  })
  if (result.failed || !result.stdout.trim()) return []
  // git log returns newest-first; reverse to oldest-first so that
  // "first RED/GREEN match wins" means the earliest committed one (natural TDD order).
  const lines = result.stdout.split('\n').filter(Boolean).reverse()
  type Entry = {
    taskId: string
    red: ExecutionTimelineEntry['redCommit']
    green: ExecutionTimelineEntry['greenCommit']
    firstDate: string
  }
  const groups = new Map<string, Entry>()
  for (const line of lines) {
    const [sha, subject, isoDate] = line.split('\t', 3)
    if (!sha || !subject || !isoDate) continue
    const taskMatch = subject.match(TASK_ID_RE)
    if (!taskMatch) continue
    const taskId = taskMatch[1]!
    if (!taskId.startsWith(`${phasePrefix}-`)) continue
    const isRed = /\bRED\b/i.test(subject)
    const isGreen = /\bGREEN\b/i.test(subject)
    let entry = groups.get(taskId)
    if (!entry) {
      entry = { taskId, red: null, green: null, firstDate: isoDate }
      groups.set(taskId, entry)
    } else if (isoDate < entry.firstDate) {
      entry.firstDate = isoDate
    }
    const commitRef = { sha, subject, isoDate }
    if (isRed && entry.red === null) entry.red = commitRef
    if (isGreen && entry.green === null) entry.green = commitRef
  }
  return [...groups.values()]
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate))
    .map((e) => ({ taskId: e.taskId, redCommit: e.red, greenCommit: e.green }))
}

// ── parseSecurityReports ──────────────────────────────────────────────────────

const SECURITY_CONTENT_CAP = 4_096

/**
 * PHASE-04: Read security report files from the phase directory.
 * Content capped at 4096 bytes (T-04-02-05 resource-exhaustion mitigation).
 */
export function parseSecurityReports(phaseDir: string): {
  cso: CsoSummary | null
  dbSentinel: DbSentinelSummary | null
} {
  if (!existsSync(phaseDir)) return { cso: null, dbSentinel: null }
  let entries: string[]
  try {
    entries = readdirSync(phaseDir)
  } catch {
    return { cso: null, dbSentinel: null }
  }
  const dbSentinelFile = entries.find((f) => /-DB-SENTINEL[-.]/.test(f) && f.endsWith('.md'))
  const csoFile = entries.find(
    (f) => f.endsWith('-SECURITY.md') && !/-DB-SENTINEL[-.]/.test(f),
  )
  const readCapped = (filename: string): string | null => {
    try {
      const raw = readFileSync(join(phaseDir, filename), 'utf8')
      return raw.slice(0, SECURITY_CONTENT_CAP)
    } catch {
      return null
    }
  }
  const cso =
    csoFile !== undefined
      ? (() => {
          const content = readCapped(csoFile)
          return content !== null ? { fileName: csoFile, content } : null
        })()
      : null
  const dbSentinel =
    dbSentinelFile !== undefined
      ? (() => {
          const content = readCapped(dbSentinelFile)
          return content !== null ? { fileName: dbSentinelFile, content } : null
        })()
      : null
  return { cso, dbSentinel }
}

// ── parseReviewFindings4 ──────────────────────────────────────────────────────

/**
 * Phase 4 four-bucket severity counts. Distinct from Phase 3 parseReviewFile.
 * Counts <finding severity="critical|high|medium|low"> tags.
 */
export function parseReviewFindings4(filePath: string): ReviewFindingCounts | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  const count = (sev: string): number =>
    (content.match(new RegExp(`<finding severity="${sev}">`, 'g')) ?? []).length
  return {
    critical: count('critical'),
    high: count('high'),
    medium: count('medium'),
    low: count('low'),
  }
}

// ── parseVerificationDetail ───────────────────────────────────────────────────

/**
 * Extends Phase 3 parseVerification with per-item rows for the UI checklist.
 * A must-have is a top-level `- **Text**: ...` bullet. An item is evidenced
 * if `**Evidence` appears within its block.
 */
export function parseVerificationDetail(filePath: string): VerificationStatusPayload | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  const lines = content.split('\n')
  const bulletRe = /^\s*-\s*\*\*([^*]+)\*\*/
  const items: { text: string; evidenced: boolean }[] = []
  let currentText: string | null = null
  let currentBuf: string[] = []
  const flush = (): void => {
    if (currentText !== null) {
      const blockText = currentBuf.join('\n')
      const evidenced = /\*\*Evidence/.test(blockText)
      items.push({ text: currentText, evidenced })
    }
  }
  for (const line of lines) {
    const m = line.match(bulletRe)
    if (m) {
      flush()
      currentText = m[1]!.trim()
      currentBuf = [line]
    } else if (currentText !== null) {
      currentBuf.push(line)
    }
  }
  flush()
  return {
    mustHavesTotal: items.length,
    mustHavesEvidenced: items.filter((i) => i.evidenced).length,
    items,
  }
}
