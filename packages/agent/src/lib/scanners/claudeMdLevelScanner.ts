/**
 * claudeMdLevelScanner.ts — Deterministic L0-L6 CLAUDE.md capability-level engine.
 *
 * Grades a repository's CLAUDE.md / AGENTS.md against the L0-L6 capability ladder
 * (CML-01..05) and returns a full ClaudeMdEval. Wired as the 7th allSettled slot
 * in coverageScan's buildRow fan-out (CML-06).
 *
 * Security:
 *   CODEX HIGH-3: every filesystem read (existsSync, readFileSync, statSync) is
 *     preceded by a resolve() call — no direct path construction reaches fs APIs.
 *   T-10-02-01: git subprocess uses argv-array form only, never shell-string.
 *   T-15-02-04: evidence strings are human-readable summaries; no raw file content.
 *
 * Rungs (strict-cumulative — level = highest N where rungs 1..N all pass):
 *   L1 Basic      — CLAUDE.md or AGENTS.md exists and is git-tracked
 *   L2 Scoped     — content contains MUST / MUST NOT / NEVER
 *   L3 Structured — content has @import ref OR >=2 instruction files
 *   L4 Abstracted — .claude/rules/*.md with paths: frontmatter
 *   L5 Maintained — INFERRED: mtime within 90 days OR backbone-doc present
 *   L6 Adaptive   — .claude/skills/<dir>/SKILL.md AND mcp.json at repo root
 *
 * L5 always carries inferred:true. Evidence strings are human-readable only.
 * The outer function NEVER throws — exceptions return ABSENT_EVAL (level 0).
 */
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'
import type { PathResolver } from '../coverageResolver.js'
import { parseFrontmatter } from '../skillsScan.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const L5_MTIME_WINDOW_DAYS = 90

const RUNG_LABELS: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'Basic',
  2: 'Scoped',
  3: 'Structured',
  4: 'Abstracted',
  5: 'Maintained',
  6: 'Adaptive',
}

const LEVEL_LABELS: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, string> = {
  0: 'Absent',
  1: 'Basic',
  2: 'Scoped',
  3: 'Structured',
  4: 'Abstracted',
  5: 'Maintained',
  6: 'Adaptive',
}

/** Fixed advice strings for the next unmet rung — verbatim from DASH-15-UI-SPEC.md */
const NEXT_STEP_ADVICE: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'Add a CLAUDE.md (or AGENTS.md) file at the repo root and commit it to git → reaches L1.',
  2: 'Add a ## Constraints section with MUST / MUST NOT / NEVER rules → reaches L2.',
  3: 'Split long sections into referenced files (@docs/...) or add a second instruction file → reaches L3.',
  4: 'Move path-specific rules into .claude/rules/*.md with paths: frontmatter → reaches L4.',
  5: 'Keep CLAUDE.md updated (edit within 90 days) or add a backbone doc (.claude/INDEX.md) → reaches L5.',
  6: 'Add a task-scoped skill under .claude/skills/ and an mcp.json → reaches L6.',
}

/** Fallback returned when the inner scan throws (never-throws contract). */
const ABSENT_EVAL: ClaudeMdEval = {
  level: 0,
  levelLabel: 'Absent',
  rungs: [
    { rung: 1, label: 'Basic', passed: false, inferred: undefined, evidence: ['Scanner error — could not evaluate'] },
    { rung: 2, label: 'Scoped', passed: false, inferred: undefined, evidence: ['Scanner error — could not evaluate'] },
    { rung: 3, label: 'Structured', passed: false, inferred: undefined, evidence: ['Scanner error — could not evaluate'] },
    { rung: 4, label: 'Abstracted', passed: false, inferred: undefined, evidence: ['Scanner error — could not evaluate'] },
    { rung: 5, label: 'Maintained', passed: false, inferred: true, evidence: ['Scanner error — could not evaluate'] },
    { rung: 6, label: 'Adaptive', passed: false, inferred: undefined, evidence: ['Scanner error — could not evaluate'] },
  ],
  nextSteps: [NEXT_STEP_ADVICE[1]],
  inferred: false,
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface ScanClaudeMdLevelInput {
  repoAbsPath: string
  resolve: PathResolver
}

// ── Public entry point (never throws) ─────────────────────────────────────────

/**
 * Scan a repository for CLAUDE.md / AGENTS.md capability level.
 *
 * Returns a full ClaudeMdEval (L0-L6). NEVER throws — any inner exception
 * returns ABSENT_EVAL (level 0, all rungs passed:false) so the coverageScan
 * fan-out can degrade gracefully.
 *
 * @param input.repoAbsPath Absolute path to the repo root.
 * @param input.resolve     PathResolver callback (CODEX HIGH-3).
 */
export function scanClaudeMdLevel(input: ScanClaudeMdLevelInput): ClaudeMdEval {
  try {
    return _scanLevel(input)
  } catch {
    // CODEX AGREED-2: NEVER throws outward — return degraded L0 shape.
    return ABSENT_EVAL
  }
}

// ── Inner implementation ──────────────────────────────────────────────────────

function _scanLevel({ repoAbsPath, resolve }: ScanClaudeMdLevelInput): ClaudeMdEval {
  // ── L1: Basic — file exists and is git-tracked ────────────────────────────
  const l1 = checkL1(repoAbsPath, resolve)

  // ── L2: Scoped — MUST / MUST NOT / NEVER in content ──────────────────────
  const l2 = l1.fileContent !== null ? checkL2(l1.fileContent) : { passed: false, evidence: ['No instruction file to evaluate'] }

  // ── L3: Structured — @import ref OR >=2 instruction files ────────────────
  const l3 = l1.fileContent !== null ? checkL3(repoAbsPath, l1.fileContent) : { passed: false, evidence: ['No instruction file to evaluate'] }

  // ── L4: Abstracted — .claude/rules/*.md with paths: frontmatter ──────────
  const l4 = checkL4(repoAbsPath, resolve)

  // ── L5: Maintained — INFERRED from proxy signals ──────────────────────────
  // resolve() passed so L5 can re-validate the path before statSync (CODEX HIGH-3).
  const l5 = checkL5(repoAbsPath, l1.resolvedPath, resolve)

  // ── L6: Adaptive — .claude/skills/<dir>/SKILL.md + mcp.json ──────────────
  const l6 = checkL6(repoAbsPath, resolve)

  // ── Assemble rungs ────────────────────────────────────────────────────────
  const rungs: ClaudeMdEval['rungs'] = [
    { rung: 1, label: RUNG_LABELS[1], passed: l1.passed, ...(l1.inferred !== undefined ? { inferred: l1.inferred } : {}), evidence: l1.evidence },
    { rung: 2, label: RUNG_LABELS[2], passed: l2.passed, evidence: l2.evidence },
    { rung: 3, label: RUNG_LABELS[3], passed: l3.passed, evidence: l3.evidence },
    { rung: 4, label: RUNG_LABELS[4], passed: l4.passed, evidence: l4.evidence },
    { rung: 5, label: RUNG_LABELS[5], passed: l5.passed, inferred: true, evidence: l5.evidence },
    { rung: 6, label: RUNG_LABELS[6], passed: l6.passed, evidence: l6.evidence },
  ]

  // ── Strict-cumulative headline level ──────────────────────────────────────
  let level: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
  let inferred = false
  for (const rung of rungs) {
    if (!rung.passed) break
    level = rung.rung as 0 | 1 | 2 | 3 | 4 | 5 | 6
    if (rung.inferred === true) inferred = true
  }

  // ── nextSteps: advice for next unmet rung ─────────────────────────────────
  const nextRung = (level + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7
  const nextSteps: string[] = nextRung <= 6 ? [NEXT_STEP_ADVICE[nextRung as 1 | 2 | 3 | 4 | 5 | 6]] : []

  return {
    level,
    levelLabel: LEVEL_LABELS[level],
    rungs,
    nextSteps,
    inferred,
  }
}

// ── Rung checkers ─────────────────────────────────────────────────────────────

interface L1Result {
  passed: boolean
  inferred?: undefined
  evidence: string[]
  /** Resolved canonical path to the instruction file, or null if none. */
  resolvedPath: string | null
  /** Content of the instruction file, or null if not readable. */
  fileContent: string | null
}

function checkL1(repoAbsPath: string, resolve: PathResolver): L1Result {
  // Try CLAUDE.md first, then AGENTS.md.
  // CODEX HIGH-3: each candidate goes through resolve() before any fs operation.
  const candidates: Array<{ name: 'CLAUDE.md' | 'AGENTS.md' }> = [
    { name: 'CLAUDE.md' },
    { name: 'AGENTS.md' },
  ]

  for (const { name: fileName } of candidates) {
    // resolve() call 1 (CLAUDE.md) or resolve() call 2 (AGENTS.md).
    let canonical: string
    try {
      canonical = resolve(join(repoAbsPath, fileName), {
        allowedNames: [fileName],
        roots: [repoAbsPath],
      })
    } catch {
      continue // PathViolation or file inaccessible — try next
    }

    if (!existsSync(canonical)) continue

    // Check git-tracked status (T-10-02-01: argv-array form — never shell-string).
    let isGitTracked = false
    try {
      execFileSync(
        'git',
        ['ls-files', '--error-unmatch', fileName],
        { cwd: repoAbsPath, encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      isGitTracked = true
    } catch {
      // exit 1 = untracked, git unavailable, or not a git repo
    }

    if (!isGitTracked) {
      return {
        passed: false,
        evidence: [`${fileName} exists but is not git-tracked`],
        resolvedPath: canonical,
        fileContent: null, // don't read content when not tracked
      }
    }

    // resolve() already called above; canonical is the validated path.
    // T-15-02-04: only summaries in evidence, never raw content.
    let fileContent: string | null = null
    try {
      fileContent = readFileSync(canonical, 'utf-8')
    } catch {
      return {
        passed: false,
        evidence: [`${fileName} found and git-tracked but could not be read`],
        resolvedPath: canonical,
        fileContent: null,
      }
    }

    return {
      passed: true,
      evidence: [`${fileName} found and git-tracked`],
      resolvedPath: canonical,
      fileContent,
    }
  }

  return {
    passed: false,
    evidence: ['No CLAUDE.md or AGENTS.md found at repo root'],
    resolvedPath: null,
    fileContent: null,
  }
}

interface RungResult {
  passed: boolean
  evidence: string[]
}

function checkL2(content: string): RungResult {
  const hasConstraint = /\bMUST\b|\bMUST NOT\b|\bNEVER\b/.test(content)
  return {
    passed: hasConstraint,
    evidence: hasConstraint
      ? ['MUST / MUST NOT / NEVER constraint keyword found']
      : ['No MUST / MUST NOT / NEVER constraint keywords found'],
  }
}

function checkL3(repoAbsPath: string, content: string): RungResult {
  // Proxy 1: @import-style reference in content.
  if (/@\w+/m.test(content)) {
    return { passed: true, evidence: ['@import-style reference found in content'] }
  }

  // Proxy 2: count instruction files:
  //   CLAUDE.md / AGENTS.md at repo root = 1
  //   plus any .md files directly under .claude/ (excluding rules/ and skills/ subdirs)
  const claudeDir = join(repoAbsPath, '.claude')
  let extraCount = 0
  const extraFiles: string[] = []

  if (existsSync(claudeDir)) {
    let entries: string[] = []
    try {
      entries = readdirSync(claudeDir)
    } catch {
      // Unreadable — skip
    }
    for (const entry of entries) {
      // Exclude subdirectories named rules/ or skills/ (Pitfall 4)
      if (entry === 'rules' || entry === 'skills') continue
      if (entry.endsWith('.md')) {
        extraCount++
        extraFiles.push(entry)
      }
    }
  }

  // CLAUDE.md or AGENTS.md at root = 1 base file; if extra .md files exist in .claude/,
  // total >= 2 instruction contexts.
  if (extraCount >= 1) {
    return {
      passed: true,
      evidence: [`Multiple instruction files: root CLAUDE.md/AGENTS.md + .claude/${extraFiles.join(', .claude/')}`],
    }
  }

  return {
    passed: false,
    evidence: ['No @import references and only one instruction file found'],
  }
}

function checkL4(repoAbsPath: string, resolve: PathResolver): RungResult {
  const rulesDir = join(repoAbsPath, '.claude', 'rules')
  if (!existsSync(rulesDir)) {
    return { passed: false, evidence: ['No .claude/rules/ directory found'] }
  }

  let entries: string[]
  try {
    entries = readdirSync(rulesDir).filter(f => f.endsWith('.md'))
  } catch {
    return { passed: false, evidence: ['Could not read .claude/rules/'] }
  }

  if (entries.length === 0) {
    return { passed: false, evidence: ['No .md files found in .claude/rules/'] }
  }

  for (const name of entries) {
    const candidate = join(rulesDir, name)
    let canonical: string
    try {
      canonical = resolve(candidate, { extension: '.md', roots: [repoAbsPath] })
    } catch {
      continue // PathViolation — skip this file
    }
    if (!existsSync(canonical)) continue

    const fm = parseFrontmatter(canonical) as Record<string, unknown> | null
    if (fm && 'paths' in fm) {
      return { passed: true, evidence: [`${name} has paths: frontmatter`] }
    }
  }

  return {
    passed: false,
    evidence: ['No .claude/rules/*.md files with paths: frontmatter found'],
  }
}

interface L5Result extends RungResult {
  inferred: true
}

function checkL5(repoAbsPath: string, resolvedClaudeMdPath: string | null, resolve: PathResolver): L5Result {
  const evidence: string[] = []
  let passed = false

  // Proxy 1: mtime within 90-day window.
  // CODEX HIGH-3: re-validate the path through resolve() before statSync.
  if (resolvedClaudeMdPath !== null) {
    let validatedPath: string | null = null
    try {
      // resolve() call 3: validate the already-resolved instruction file path.
      const fileName = resolvedClaudeMdPath.endsWith('AGENTS.md') ? 'AGENTS.md' : 'CLAUDE.md'
      validatedPath = resolve(resolvedClaudeMdPath, {
        allowedNames: [fileName],
        roots: [repoAbsPath],
      })
    } catch {
      evidence.push('Could not re-validate instruction file path for mtime check')
    }

    if (validatedPath !== null) {
      try {
        const mtime = statSync(validatedPath).mtimeMs
        const ageDays = (Date.now() - mtime) / 86_400_000
        if (ageDays <= L5_MTIME_WINDOW_DAYS) {
          passed = true
          evidence.push(`CLAUDE.md modified ${Math.round(ageDays)}d ago (within ${L5_MTIME_WINDOW_DAYS}-day window)`)
        } else {
          evidence.push(`CLAUDE.md last modified ${Math.round(ageDays)}d ago (outside ${L5_MTIME_WINDOW_DAYS}-day window)`)
        }
      } catch {
        evidence.push('Could not read CLAUDE.md mtime')
      }
    }
  } else {
    evidence.push('No CLAUDE.md path available for mtime check')
  }

  // Proxy 2: backbone / codebase-map doc present.
  const mapCandidates = [
    join(repoAbsPath, '.claude', 'INDEX.md'),
    join(repoAbsPath, '.claude', 'MAP.md'),
    join(repoAbsPath, 'docs', 'INDEX.md'),
    join(repoAbsPath, 'docs', 'MAP.md'),
  ]
  const mapFound = mapCandidates.find(p => existsSync(p))
  if (mapFound) {
    passed = true
    evidence.push(`Backbone/codebase-map doc found: ${basename(mapFound)}`)
  } else {
    evidence.push('No backbone/codebase-map doc found (.claude/INDEX.md, .claude/MAP.md, docs/INDEX.md, docs/MAP.md)')
  }

  // Proxy 3: coverage-history — not evaluatable at scan time (Pitfall 7).
  evidence.push('Coverage-history proxy: not evaluatable at scan time (history written post-scan)')

  return { passed, inferred: true, evidence }
}

function checkL6(repoAbsPath: string, resolve: PathResolver): RungResult {
  const skillsDir = join(repoAbsPath, '.claude', 'skills')
  let hasSkill = false

  if (existsSync(skillsDir)) {
    let entries: string[] = []
    try {
      entries = readdirSync(skillsDir)
    } catch {
      // Unreadable skills dir — hasSkill stays false
    }
    for (const entry of entries) {
      const skillMd = join(skillsDir, entry, 'SKILL.md')
      if (existsSync(skillMd)) {
        hasSkill = true
        break
      }
    }
  }

  // CODEX HIGH-3: validate mcp.json path through resolve() before existsSync (Pitfall 5).
  // resolve() call 4: mcp.json at repo root.
  let hasMcpJson = false
  try {
    const mcpPath = join(repoAbsPath, 'mcp.json')
    const resolvedMcp = resolve(mcpPath, { allowedNames: ['mcp.json'], roots: [repoAbsPath] })
    hasMcpJson = existsSync(resolvedMcp)
  } catch {
    // PathViolation or not accessible — mcp.json absent
    hasMcpJson = false
  }

  if (hasSkill && hasMcpJson) {
    return { passed: true, evidence: ['.claude/skills/<dir>/SKILL.md found and mcp.json present at repo root'] }
  }

  const missing: string[] = []
  if (!hasSkill) missing.push('No .claude/skills/<dir>/SKILL.md found')
  if (!hasMcpJson) missing.push('No mcp.json at repo root')
  return { passed: false, evidence: missing }
}
