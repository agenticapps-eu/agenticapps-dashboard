/**
 * readOverview: pure-function reader for GET /api/projects/:id/overview.
 *
 * Reads the project's filesystem to produce a ProjectOverview:
 * - Phase status: derived from latest phase dir (D-04)
 * - Stage 1/2 finding counts: from *-REVIEW.md / *-REVIEW-FIX.md YAML frontmatter
 * - DB audit findings: from *-SECURITY.md YAML frontmatter
 * - TDD pairs: from git log commit subjects (RED/GREEN pattern)
 * - Branch: from git symbolic-ref --short HEAD
 * - Markers: existsSync for .git, .planning, .claude/skills
 *
 * Never throws — returns graceful 'Pending' empty overview on any filesystem error.
 * Subprocess discipline: execa argv-array only (no shell injection). (T-01-02-10)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import type { ProjectOverview, FindingCounts, DbAuditFindings } from '@agenticapps/dashboard-shared'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

// ---------------------------------------------------------------------------
// Marker detection (D-30, Pattern 8)
// ---------------------------------------------------------------------------

export function detectMarkers(root: string): {
  gitRepo: boolean
  planning: boolean
  claudeSkills: boolean
} {
  return {
    gitRepo: existsSync(join(root, '.git')),
    planning: existsSync(join(root, '.planning')),
    claudeSkills: existsSync(join(root, '.claude', 'skills')),
  }
}

// ---------------------------------------------------------------------------
// Latest phase directory detection (D-04)
// ---------------------------------------------------------------------------

function detectLatestPhaseDir(root: string): string | null {
  const phasesDir = join(root, '.planning', 'phases')
  if (!existsSync(phasesDir)) return null
  try {
    const entries = readdirSync(phasesDir, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort() // alphabetical == numeric order for NN-name format
    if (dirs.length === 0) return null
    const lastDir = dirs[dirs.length - 1]
    if (!lastDir) return null
    return join(phasesDir, lastDir)
  } catch {
    return null
  }
}

function hasPlanFile(phaseDir: string): boolean {
  try {
    return readdirSync(phaseDir).some((f) => f.endsWith('-PLAN.md'))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// REVIEW.md / REVIEW-FIX.md / SECURITY.md parsing (Pattern 4)
// ---------------------------------------------------------------------------

/**
 * Parse a REVIEW.md-style file with YAML frontmatter containing:
 *   findings:
 *     critical: N
 *     warning: N
 *     info: N
 *
 * Returns FindingCounts { red, yellow, green } mapped from critical/warning/info.
 * Returns null if file is absent or cannot be parsed.
 */
export function parseReviewFile(filePath: string): FindingCounts | null {
  if (!existsSync(filePath)) return null
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  // Extract YAML frontmatter between first two --- delimiters
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const fm = fmMatch[1] ?? ''
    // Extract findings block (indented under findings:)
    const findingsBlock = fm.match(/^findings:\s*\n((?:[ \t]+\S+.*\n?)*)/m)
    if (findingsBlock) {
      const block = findingsBlock[1] ?? ''
      const getInt = (key: string): number => {
        const m = block.match(new RegExp(`[ \\t]+${key}:\\s*(\\d+)`))
        return m?.[1] ? parseInt(m[1], 10) : 0
      }
      return {
        red: getInt('critical'),
        yellow: getInt('warning'),
        green: getInt('info'),
      }
    }
  }

  // Fallback: count <finding severity="..."> XML tags
  const severityPattern = /<finding\s+severity="([^"]+)"/g
  let red = 0
  let yellow = 0
  let green = 0
  let match: RegExpExecArray | null
  while ((match = severityPattern.exec(content)) !== null) {
    const sev = (match[1] ?? '').toLowerCase()
    if (sev === 'critical' || sev === 'error') red++
    else if (sev === 'warning') yellow++
    else if (sev === 'info' || sev === 'suggestion') green++
  }
  if (red + yellow + green > 0) return { red, yellow, green }
  return null
}

/**
 * Parse DB audit findings from a *-SECURITY.md file with YAML frontmatter:
 *   findings:
 *     critical: N
 *     high: N
 *     medium: N
 *     low: N
 *
 * Returns null if file absent or unparseable.
 */
export function parseSecurityFile(filePath: string): DbAuditFindings | null {
  if (!existsSync(filePath)) return null
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  const fm = fmMatch[1] ?? ''
  const findingsBlock = fm.match(/^findings:\s*\n((?:[ \t]+\S+.*\n?)*)/m)
  if (!findingsBlock) return null
  const block = findingsBlock[1] ?? ''
  const getInt = (key: string): number => {
    const m = block.match(new RegExp(`[ \\t]+${key}:\\s*(\\d+)`))
    return m?.[1] ? parseInt(m[1], 10) : 0
  }
  return {
    critical: getInt('critical'),
    high: getInt('high'),
    medium: getInt('medium'),
    low: getInt('low'),
  }
}

// ---------------------------------------------------------------------------
// VERIFICATION.md parsing (Pattern 5, D-04)
// ---------------------------------------------------------------------------

/**
 * Parse a VERIFICATION.md file to count must_haves and evidence entries.
 *
 * Expected format (GSD artifact):
 *   Lines with "- **" indicate must_have items (bold bullet).
 *   Lines with "**Evidence" indicate evidence provided for a must_have.
 *
 * Returns { evidence, mustHaves } or null if file absent.
 */
export function parseVerification(filePath: string): { evidence: number; mustHaves: number } | null {
  if (!existsSync(filePath)) return null
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const lines = content.split('\n')
  let mustHaves = 0
  let evidence = 0
  for (const line of lines) {
    if (/^- \*\*/.test(line.trim())) mustHaves++
    if (/\*\*Evidence/i.test(line)) evidence++
  }
  return { mustHaves, evidence }
}

// ---------------------------------------------------------------------------
// Phase status derivation (D-04)
// ---------------------------------------------------------------------------

function derivePhaseStatus(
  phaseDir: string | null,
  verification: { evidence: number; mustHaves: number } | null,
): 'Pending' | 'In Progress' | 'Complete' {
  if (!phaseDir) return 'Pending'
  if (!hasPlanFile(phaseDir)) return 'Pending'
  if (!verification) return 'In Progress'
  if (verification.mustHaves > 0 && verification.evidence >= verification.mustHaves) return 'Complete'
  return 'In Progress'
}

// ---------------------------------------------------------------------------
// TDD pair detection (Pattern 6)
// ---------------------------------------------------------------------------

export async function parseTddPairs(root: string): Promise<{ greenPairs: number; totalTasks: number }> {
  try {
    const { stdout } = await execa('git', ['log', '--format=%s', '--no-merges'], {
      cwd: root,
      reject: false,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    })
    const subjects = stdout.split('\n').filter(Boolean)
    const totalTasks = subjects.filter((s) => /\bRED\b/i.test(s)).length
    const greenPairs = subjects.filter((s) => /\bGREEN\b/i.test(s)).length
    return { greenPairs, totalTasks }
  } catch {
    return { greenPairs: 0, totalTasks: 0 }
  }
}

// ---------------------------------------------------------------------------
// Branch detection (Pattern 7)
// ---------------------------------------------------------------------------

export async function detectBranch(root: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: root,
      reject: false,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    })
    const trimmed = stdout.trim()
    return trimmed || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main: readOverview (D-04, HOME-02)
// ---------------------------------------------------------------------------

/**
 * Read and compute the full ProjectOverview for a registered project root.
 *
 * Never throws. On any filesystem/subprocess error, returns a graceful
 * overview with phaseStatus='Pending', all sub-objects null, markers reflecting reality.
 */
export async function readOverview(root: string): Promise<ProjectOverview> {
  const markers = detectMarkers(root)

  // If planning dir doesn't exist, return minimal Pending overview immediately.
  const phaseDir = detectLatestPhaseDir(root)

  // Parse verification from latest phase dir
  let verificationData: { evidence: number; mustHaves: number } | null = null
  if (phaseDir) {
    try {
      const files = readdirSync(phaseDir)
      const verFile = files.find((f) => f.endsWith('-VERIFICATION.md'))
      if (verFile) {
        verificationData = parseVerification(join(phaseDir, verFile))
      }
    } catch {
      // ignore
    }
  }

  const phaseStatus = derivePhaseStatus(phaseDir, verificationData)

  // Parse review files (Stage 1: *-REVIEW.md, Stage 2: *-REVIEW-FIX.md)
  let stage1: { ran: boolean; findings: FindingCounts } | null = null
  let stage2: { ran: boolean; findings: FindingCounts } | null = null
  let dbAudit: { findings: DbAuditFindings } | null = null

  if (phaseDir) {
    try {
      const files = readdirSync(phaseDir)

      const reviewFile = files.find((f) => f.endsWith('-REVIEW.md'))
      if (reviewFile) {
        const findings = parseReviewFile(join(phaseDir, reviewFile))
        stage1 = {
          ran: true,
          findings: findings ?? { red: 0, yellow: 0, green: 0 },
        }
      }

      const reviewFixFile = files.find((f) => f.endsWith('-REVIEW-FIX.md'))
      if (reviewFixFile) {
        const findings = parseReviewFile(join(phaseDir, reviewFixFile))
        stage2 = {
          ran: true,
          findings: findings ?? { red: 0, yellow: 0, green: 0 },
        }
      }

      const securityFile = files.find((f) => f.endsWith('-SECURITY.md'))
      if (securityFile) {
        const findings = parseSecurityFile(join(phaseDir, securityFile))
        if (findings) {
          dbAudit = { findings }
        }
      }
    } catch {
      // ignore filesystem error on phase dir reads
    }
  }

  // TDD pairs and branch from git subprocess (may return zeros/null on error)
  const [tddPairs, branch] = await Promise.all([
    markers.gitRepo ? parseTddPairs(root) : Promise.resolve({ greenPairs: 0, totalTasks: 0 }),
    markers.gitRepo ? detectBranch(root) : Promise.resolve(null),
  ])

  const tdd =
    tddPairs.greenPairs > 0 || tddPairs.totalTasks > 0
      ? { greenPairs: tddPairs.greenPairs, totalTasks: tddPairs.totalTasks }
      : null

  const verification = verificationData

  return {
    phaseStatus,
    stage1,
    stage2,
    dbAudit,
    tdd,
    verification,
    branch,
    markers,
  }
}
