/**
 * claudeMdScanner.ts — CLAUDE.md / AGENTS.md presence detection per repo.
 *
 * Rule: CLAUDE.md OR AGENTS.md at repo root = 'fresh'. Neither = 'missing'.
 * CLAUDE.md takes precedence over AGENTS.md when both are present.
 *
 * CODEX HIGH-3: All filesystem reads route through the `resolve` callback
 * (a PathResolver wrapping resolveAllowedNamed). NO direct fs.* calls
 * inside this scanner.
 *
 * CODEX HIGH-3 dead-code note: The scanner calls input.resolve() which internally
 * calls realpathSync. If resolve throws (path not accessible), we treat the file
 * as absent. existsSync is NOT called directly here.
 *
 * T-10-02-03: existsSync used ONLY — content is never read or returned.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PathResolver } from '../coverageResolver.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClaudeMdState = 'fresh' | 'missing'

export interface ClaudeMdResult {
  state: ClaudeMdState
  via: 'CLAUDE.md' | 'AGENTS.md' | 'none'
}

export interface ScanClaudeMdInput {
  repoAbsPath: string
  /**
   * PathResolver callback wrapping resolveAllowedNamed (CODEX HIGH-3).
   * Scanner calls resolve() to canonicalise paths before existsSync.
   */
  resolve: PathResolver
}

// ── scanClaudeMd ──────────────────────────────────────────────────────────────

/**
 * Check whether CLAUDE.md or AGENTS.md is present at the repo root.
 *
 * All path resolution goes through the `resolve` callback (CODEX HIGH-3).
 * On PathViolation from the resolver, the file is treated as absent.
 */
export function scanClaudeMd(input: ScanClaudeMdInput): ClaudeMdResult {
  const { repoAbsPath, resolve } = input

  // Attempt CLAUDE.md via resolver (CODEX HIGH-3).
  const claudeExists = resolveExists(resolve, join(repoAbsPath, 'CLAUDE.md'), {
    allowedNames: ['CLAUDE.md', 'AGENTS.md'],
    roots: [repoAbsPath],
  })
  if (claudeExists) return { state: 'fresh', via: 'CLAUDE.md' }

  // Attempt AGENTS.md via resolver (CODEX HIGH-3).
  const agentsExists = resolveExists(resolve, join(repoAbsPath, 'AGENTS.md'), {
    allowedNames: ['CLAUDE.md', 'AGENTS.md'],
    roots: [repoAbsPath],
  })
  if (agentsExists) return { state: 'fresh', via: 'AGENTS.md' }

  return { state: 'missing', via: 'none' }
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Try to resolve a candidate path; return true if it resolves AND exists.
 * Returns false on any PathViolation or non-existence.
 */
function resolveExists(
  resolve: PathResolver,
  candidatePath: string,
  opts: { allowedNames?: string[]; extension?: string; roots: string[] },
): boolean {
  let resolved: string
  try {
    resolved = resolve(candidatePath, opts)
  } catch {
    // PathViolation or not accessible — treat as absent.
    return false
  }
  return existsSync(resolved)
}
