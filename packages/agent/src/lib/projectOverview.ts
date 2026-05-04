/**
 * Project overview reader: composes filesystem heuristics into a ProjectOverview.
 *
 * Key decisions from 03-CONTEXT.md:
 *  D-04 — phaseStatus derived from filesystem heuristics (no schema invention)
 *  D-08 — ProjectOverview shape (stage1/stage2/dbAudit/tdd/verification/branch/markers)
 *  D-30 — detectedMarkers for register-prepare response
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import { ProjectOverviewSchema, type ProjectOverview } from '@agenticapps/dashboard-shared'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

/**
 * D-30: Detect presence of git repo, .planning dir, and .claude/skills dir.
 * Used in register-prepare response to warn about "empty" project directories.
 */
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

/**
 * Find the latest phase directory under <root>/.planning/phases/ by numeric prefix.
 * Returns absolute path of the highest-numbered dir, or null on error/absence.
 */
export function findLatestPhaseDir(root: string): string | null {
  try {
    const phasesDir = join(root, '.planning', 'phases')
    if (!existsSync(phasesDir)) return null
    const dirs = readdirSync(phasesDir)
      .filter((d) => /^\d{2}-/.test(d))
      .sort()
    const latest = dirs.at(-1)
    return latest ? join(phasesDir, latest) : null
  } catch {
    return null
  }
}

/**
 * Parse a *-REVIEW.md or *-REVIEW-FIX.md file for finding counts.
 *
 * Format: YAML frontmatter with critical/warning/info counts.
 * Falls back to counting <finding severity="..."> tags in the body.
 * Returns null for missing files (ENOENT).
 */
export function parseReviewFile(
  filePath: string,
): { ran: true; findings: { red: number; yellow: number; green: number } } | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  // Try YAML frontmatter first (between leading --- and closing ---)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const fm = fmMatch[1] ?? ''
    const criticalMatch = fm.match(/^\s*critical:\s*(\d+)\s*$/m)
    const warningMatch = fm.match(/^\s*warning:\s*(\d+)\s*$/m)
    const infoMatch = fm.match(/^\s*info:\s*(\d+)\s*$/m)
    if (criticalMatch ?? warningMatch ?? infoMatch) {
      return {
        ran: true,
        findings: {
          red: criticalMatch ? parseInt(criticalMatch[1] ?? '0', 10) : 0,
          yellow: warningMatch ? parseInt(warningMatch[1] ?? '0', 10) : 0,
          green: infoMatch ? parseInt(infoMatch[1] ?? '0', 10) : 0,
        },
      }
    }
  }

  // Fallback: count <finding severity="..."> tags (Pitfall 1)
  const red = (content.match(/<finding severity="critical">/g) ?? []).length
  const yellow = (content.match(/<finding severity="warning">/g) ?? []).length
  const green = (content.match(/<finding severity="info">/g) ?? []).length

  return { ran: true, findings: { red, yellow, green } }
}

/**
 * Parse a *-VERIFICATION.md file for evidence and mustHave counts.
 *
 * VERIFICATION.md format:
 *  - Bold-bullet lines (pattern: dash + double-asterisk + text + double-asterisk) are must_haves.
 *  - Occurrences of "**Evidence" in the file are evidence entries.
 * Returns null for missing files.
 */
export function parseVerification(filePath: string): { evidence: number; mustHaves: number } | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const mustHaves = (content.match(/^\s*-\s*\*\*[^*]+\*\*/gm) ?? []).length
  const evidence = (content.match(/\*\*Evidence/g) ?? []).length

  return { mustHaves, evidence }
}

/**
 * Count RED/GREEN pair commits in git log subject lines.
 * totalTasks = lines matching /\bRED\b/ (case-insensitive).
 * greenPairs = lines matching /\bGREEN\b/ (case-insensitive).
 */
export async function parseTddPairs(
  root: string,
): Promise<{ greenPairs: number; totalTasks: number }> {
  try {
    const result = await execa('git', ['log', '--format=%s', '--no-merges'], {
      cwd: root,
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      reject: false,
    })
    if (result.failed || !result.stdout.trim()) {
      return { greenPairs: 0, totalTasks: 0 }
    }
    const totalTasks = (result.stdout.match(/\bRED\b/gi) ?? []).length
    const greenPairs = (result.stdout.match(/\bGREEN\b/gi) ?? []).length
    return { greenPairs, totalTasks }
  } catch {
    return { greenPairs: 0, totalTasks: 0 }
  }
}

/**
 * Detect the current git branch via symbolic-ref.
 * Returns null if not a git repo or on a detached HEAD.
 */
export async function detectBranch(root: string): Promise<string | null> {
  try {
    const result = await execa('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: root,
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      reject: false,
    })
    const trimmed = result.stdout.trim()
    return trimmed || null
  } catch {
    return null
  }
}

/**
 * Compose a ProjectOverview from filesystem reads for the given project root.
 * Validates against ProjectOverviewSchema before returning — throws on drift.
 */
export async function readOverview(root: string): Promise<ProjectOverview> {
  const markers = detectMarkers(root)

  const latestPhaseDir = findLatestPhaseDir(root)

  // Default: no phase dirs found → Pending
  if (!latestPhaseDir) {
    const result: ProjectOverview = ProjectOverviewSchema.parse({
      phaseStatus: 'Pending',
      stage1: null,
      stage2: null,
      dbAudit: null,
      tdd: null,
      verification: null,
      branch: await detectBranch(root),
      markers,
    })
    return result
  }

  // Check if any *-PLAN.md exists in the latest phase dir
  let planFiles: string[] = []
  try {
    planFiles = readdirSync(latestPhaseDir).filter((f) => f.endsWith('-PLAN.md'))
  } catch {
    planFiles = []
  }

  if (planFiles.length === 0) {
    return ProjectOverviewSchema.parse({
      phaseStatus: 'Pending',
      stage1: null,
      stage2: null,
      dbAudit: null,
      tdd: null,
      verification: null,
      branch: await detectBranch(root),
      markers,
    })
  }

  // Find *-VERIFICATION.md, *-REVIEW.md, *-REVIEW-FIX.md
  let verificationFile: string | null = null
  let reviewFile: string | null = null
  let reviewFixFile: string | null = null
  let securityFile: string | null = null
  try {
    const files = readdirSync(latestPhaseDir)
    const verif = files.find((f) => f.endsWith('-VERIFICATION.md'))
    const review = files.find((f) => f.endsWith('-REVIEW.md'))
    const reviewFix = files.find((f) => f.endsWith('-REVIEW-FIX.md'))
    const security = files.find((f) => f.endsWith('-SECURITY.md'))
    if (verif) verificationFile = join(latestPhaseDir, verif)
    if (review) reviewFile = join(latestPhaseDir, review)
    if (reviewFix) reviewFixFile = join(latestPhaseDir, reviewFix)
    if (security) securityFile = join(latestPhaseDir, security)
  } catch {
    // ignore
  }

  const verification = verificationFile ? parseVerification(verificationFile) : null

  // D-04: phaseStatus heuristic
  let phaseStatus: 'Pending' | 'In Progress' | 'Complete'
  if (
    verification &&
    verification.mustHaves > 0 &&
    verification.evidence >= verification.mustHaves
  ) {
    phaseStatus = 'Complete'
  } else {
    phaseStatus = 'In Progress'
  }

  const stage1 = reviewFile ? parseReviewFile(reviewFile) : null
  const stage2 = reviewFixFile ? parseReviewFile(reviewFixFile) : null

  // D-08: dbAudit — parse *-SECURITY.md frontmatter for critical/high/medium/low
  let dbAudit: { findings: { critical: number; high: number; medium: number; low: number } } | null =
    null
  if (securityFile) {
    try {
      const sec = readFileSync(securityFile, 'utf8')
      const fmMatch = sec.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        const fm = fmMatch[1] ?? ''
        const critical = parseInt(fm.match(/^\s*critical:\s*(\d+)\s*$/m)?.[1] ?? '0', 10)
        const high = parseInt(fm.match(/^\s*high:\s*(\d+)\s*$/m)?.[1] ?? '0', 10)
        const medium = parseInt(fm.match(/^\s*medium:\s*(\d+)\s*$/m)?.[1] ?? '0', 10)
        const low = parseInt(fm.match(/^\s*low:\s*(\d+)\s*$/m)?.[1] ?? '0', 10)
        dbAudit = { findings: { critical, high, medium, low } }
      }
    } catch {
      dbAudit = null
    }
  }

  const [tdd, branch] = await Promise.all([parseTddPairs(root), detectBranch(root)])

  return ProjectOverviewSchema.parse({
    phaseStatus,
    stage1,
    stage2,
    dbAudit,
    tdd,
    verification,
    branch,
    markers,
  })
}
