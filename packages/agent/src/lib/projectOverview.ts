/**
 * Pure-function reader that composes a ProjectOverview from a registered project's
 * filesystem artefacts (.planning/phases/, .git, .claude/skills).
 *
 * Read-only invariant: this module never writes to the project filesystem (INV-01).
 * All path construction uses join() over a canonical root that was already vetted
 * by assertRegistrationAllowed at registration time (T-03-01-05).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import { ProjectOverviewSchema, type ProjectOverview } from '@agenticapps/dashboard-shared'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

// ── Marker detection ──────────────────────────────────────────────────────────

/**
 * Detect which workflow markers are present in the project root (D-30).
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

// ── Phase directory discovery ─────────────────────────────────────────────────

/**
 * Find the highest-numbered phase directory under <root>/.planning/phases/.
 * Sorts by leading numeric prefix descending. Returns null on error or if empty.
 */
export function findLatestPhaseDir(root: string): string | null {
  try {
    const phasesDir = join(root, '.planning', 'phases')
    if (!existsSync(phasesDir)) return null
    const entries = readdirSync(phasesDir, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /^\d+/.test(name))
    if (dirs.length === 0) return null
    dirs.sort((a, b) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      return nb - na
    })
    return join(phasesDir, dirs[0]!)
  } catch {
    return null
  }
}

// ── Review file parsing ───────────────────────────────────────────────────────

/**
 * Parse a REVIEW.md file into a stage object.
 *
 * Primary strategy: YAML frontmatter with `findings: { critical, warning, info }`.
 * Fallback (Pitfall 1): count `<finding severity="...">` XML-style tags when no frontmatter.
 */
export function parseReviewFile(
  filePath: string
): { ran: true; findings: { red: number; yellow: number; green: number } } | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  // Try frontmatter extraction
  if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
    const endIndex = content.indexOf('\n---\n', 4)
    if (endIndex !== -1) {
      const frontmatter = content.slice(4, endIndex)
      const criticalMatch = frontmatter.match(/^\s*critical:\s*(\d+)\s*$/m)
      const warningMatch = frontmatter.match(/^\s*warning:\s*(\d+)\s*$/m)
      const infoMatch = frontmatter.match(/^\s*info:\s*(\d+)\s*$/m)
      if (criticalMatch ?? warningMatch ?? infoMatch) {
        return {
          ran: true,
          findings: {
            red: criticalMatch ? parseInt(criticalMatch[1]!, 10) : 0,
            yellow: warningMatch ? parseInt(warningMatch[1]!, 10) : 0,
            green: infoMatch ? parseInt(infoMatch[1]!, 10) : 0,
          },
        }
      }
    }
  }

  // Fallback: count severity tags in full content (Pitfall 1)
  const criticalCount = (content.match(/<finding severity="critical">/g) ?? []).length
  const warningCount = (content.match(/<finding severity="warning">/g) ?? []).length
  const infoCount = (content.match(/<finding severity="info">/g) ?? []).length
  return {
    ran: true,
    findings: {
      red: criticalCount,
      yellow: warningCount,
      green: infoCount,
    },
  }
}

// ── Verification file parsing ─────────────────────────────────────────────────

/**
 * Parse a VERIFICATION.md file for evidence and must-have counts.
 *
 * Format note (from workflow skill SKILL.md): the skill does not prescribe a rigid
 * VERIFICATION.md format — it only requires that human-verified truths be recorded.
 * We use two heuristics that match the Phase 2 VERIFICATION.md in this codebase:
 *   - mustHaves: lines matching the pattern "^\s*-\s*\*\*[^*]+\*\*" (bold-bullet list items)
 *   - evidence: occurrences of "**Evidence" (bold Evidence label in table or prose)
 * These patterns match both table-row format (| **Evidence:** ...) and prose format.
 */
export function parseVerification(
  filePath: string
): { evidence: number; mustHaves: number } | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const lines = content.split('\n')
  const mustHaves = lines.filter((line) => /^\s*-\s*\*\*[^*]+\*\*/.test(line)).length
  const evidenceMatches = content.match(/\*\*Evidence/g) ?? []
  const evidence = evidenceMatches.length

  return { evidence, mustHaves }
}

// ── TDD pair counting ─────────────────────────────────────────────────────────

/**
 * Count RED/GREEN commit pairs in the git log of the project root.
 * Uses execa argv-array form (no shell injection); 5s timeout (T-03-01-06).
 */
export async function parseTddPairs(
  root: string
): Promise<{ greenPairs: number; totalTasks: number }> {
  const result = await execa('git', ['log', '--format=%s', '--no-merges'], {
    cwd: root,
    timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    reject: false,
  })
  if (result.failed || !result.stdout.trim()) {
    return { greenPairs: 0, totalTasks: 0 }
  }
  const stdout = result.stdout
  const totalTasks = (stdout.match(/\bRED\b/gi) ?? []).length
  const greenPairs = (stdout.match(/\bGREEN\b/gi) ?? []).length
  return { greenPairs, totalTasks }
}

// ── Branch detection ──────────────────────────────────────────────────────────

/**
 * Return the current branch name or null on error/detached HEAD.
 * Uses execa argv-array form (T-03-01-06).
 */
export async function detectBranch(root: string): Promise<string | null> {
  const result = await execa('git', ['symbolic-ref', '--short', 'HEAD'], {
    cwd: root,
    timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    reject: false,
  })
  const trimmed = result.stdout.trim()
  return trimmed || null
}

// ── Phase status heuristic ────────────────────────────────────────────────────

/**
 * Determine phase status from the latest phase directory (D-04):
 * - Pending: no PLAN.md in the phase dir.
 * - In Progress: PLAN.md exists AND (no VERIFICATION.md OR evidence < mustHaves OR mustHaves === 0).
 * - Complete: VERIFICATION.md exists AND evidence >= mustHaves AND mustHaves > 0.
 */
function computePhaseStatus(
  phaseDir: string,
  verification: { evidence: number; mustHaves: number } | null
): 'Pending' | 'In Progress' | 'Complete' {
  // Check for any PLAN.md in the phase dir
  let hasPlan = false
  try {
    const files = readdirSync(phaseDir)
    hasPlan = files.some((f) => f.endsWith('-PLAN.md'))
  } catch {
    return 'Pending'
  }
  if (!hasPlan) return 'Pending'
  if (!verification || verification.mustHaves === 0) return 'In Progress'
  if (verification.evidence >= verification.mustHaves) return 'Complete'
  return 'In Progress'
}

// ── Top-level reader ──────────────────────────────────────────────────────────

/**
 * Compose a ProjectOverview for the given registered project root.
 * Validates output against ProjectOverviewSchema (defense-in-depth: route returns
 * schema_drift via outbound() if this throws — D-07).
 */
export async function readOverview(root: string): Promise<ProjectOverview> {
  const markers = detectMarkers(root)
  const latestPhaseDir = findLatestPhaseDir(root)

  // Parallel async reads
  const [tdd, branch] = await Promise.all([parseTddPairs(root), detectBranch(root)])

  let phaseStatus: 'Pending' | 'In Progress' | 'Complete' = 'Pending'
  let stage1: ProjectOverview['stage1'] = null
  let stage2: ProjectOverview['stage2'] = null
  let dbAudit: ProjectOverview['dbAudit'] = null
  let verification: ProjectOverview['verification'] = null

  if (latestPhaseDir) {
    // Find VERIFICATION.md
    let verificationData: { evidence: number; mustHaves: number } | null = null
    try {
      const files = readdirSync(latestPhaseDir)
      const verificationFile = files.find((f) => f.endsWith('-VERIFICATION.md'))
      if (verificationFile) {
        verificationData = parseVerification(join(latestPhaseDir, verificationFile))
      }
    } catch {
      // ignore
    }
    if (verificationData) {
      verification = verificationData
    }

    phaseStatus = computePhaseStatus(latestPhaseDir, verificationData)

    // Parse REVIEW.md (Stage 1) and REVIEW-FIX.md (Stage 2)
    try {
      const files = readdirSync(latestPhaseDir)
      const reviewFile = files.find(
        (f) => f.endsWith('-REVIEW.md') && !f.endsWith('-REVIEW-FIX.md')
      )
      const reviewFixFile = files.find((f) => f.endsWith('-REVIEW-FIX.md'))
      if (reviewFile) {
        const parsed = parseReviewFile(join(latestPhaseDir, reviewFile))
        if (parsed) stage1 = parsed
      }
      if (reviewFixFile) {
        const parsed = parseReviewFile(join(latestPhaseDir, reviewFixFile))
        if (parsed) stage2 = parsed
      }
    } catch {
      // ignore
    }

    // dbAudit: look for SECURITY.md with frontmatter (A2 in RESEARCH — null in v1 if absent)
    try {
      const files = readdirSync(latestPhaseDir)
      const securityFile = files.find((f) => f.endsWith('-SECURITY.md'))
      if (securityFile) {
        const secContent = readFileSync(join(latestPhaseDir, securityFile), 'utf8')
        const endIdx = secContent.indexOf('\n---\n', 4)
        if (secContent.startsWith('---\n') && endIdx !== -1) {
          const fm = secContent.slice(4, endIdx)
          const critM = fm.match(/^\s*critical:\s*(\d+)\s*$/m)
          const highM = fm.match(/^\s*high:\s*(\d+)\s*$/m)
          const medM = fm.match(/^\s*medium:\s*(\d+)\s*$/m)
          const lowM = fm.match(/^\s*low:\s*(\d+)\s*$/m)
          if (critM ?? highM ?? medM ?? lowM) {
            dbAudit = {
              findings: {
                critical: critM ? parseInt(critM[1]!, 10) : 0,
                high: highM ? parseInt(highM[1]!, 10) : 0,
                medium: medM ? parseInt(medM[1]!, 10) : 0,
                low: lowM ? parseInt(lowM[1]!, 10) : 0,
              },
            }
          }
        }
      }
    } catch {
      // null is acceptable per A2 in RESEARCH
    }
  }

  const overview: ProjectOverview = {
    phaseStatus,
    stage1,
    stage2,
    dbAudit,
    tdd,
    verification,
    branch,
    markers,
  }

  // Defense-in-depth: validate before returning so route can surface schema_drift (D-07)
  return ProjectOverviewSchema.parse(overview)
}
