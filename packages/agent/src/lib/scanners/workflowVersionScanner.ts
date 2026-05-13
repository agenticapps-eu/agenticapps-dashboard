/**
 * workflowVersionScanner.ts — Workflow head detection + per-repo SKILL.md version comparison.
 *
 * readWorkflowHeadVersion: reads highest-numbered migration's to_version frontmatter.
 *   - D-10-06: head from ~/Sourcecode/agenticapps/claude-workflow/migrations/<highest>.md
 *   - Uses parseFrontmatter from skillsScan.ts (no YAML hand-roll — RESEARCH "Don't Hand-Roll").
 *
 * scanWorkflowVersionForRepo: probes 4 CANDIDATE_PATHS for SKILL.md.
 *   - CODEX HIGH-4: returns rich shape with installedVersion, headVersion, detail.
 *   - CODEX MED-12: verifies frontmatter name === 'agentic-apps-workflow' (identity check).
 *   - Pitfall 3: version field absent → state='stale', detail='version-unknown' (NOT 'missing').
 *   - Pitfall 4: probe both dirname conventions AND both layouts (4 candidates).
 *   - Pitfall 6: only 4 explicit paths checked — never recurses into .claude/worktrees/.
 *   - CODEX HIGH-3: all reads go through the `resolve` callback (PathResolver).
 *
 * 5 detail cases (D-10-06):
 *   'equal'           → installedVersion === headVersion → state='fresh'
 *   'behind'          → installedVersion < headVersion  → state='stale'
 *   'ahead'           → installedVersion > headVersion  → state='fresh'
 *   'version-unknown' → skill present but no version field → state='stale'
 *   'skill-missing'   → no SKILL.md at any of 4 paths → state='missing'
 *
 * Note on fs imports: existsSync, readdirSync are used as named imports (standalone
 * functions) — not via member-access form. Zero dot-method hits in this file.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../skillsScan.js'
import type { PathResolver } from '../coverageResolver.js'

// ── Default migrations directory ──────────────────────────────────────────────

const MIGRATIONS_DIR_DEFAULT = join(
  homedir(),
  'Sourcecode',
  'agenticapps',
  'claude-workflow',
  'migrations',
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowRepoState {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  installedVersion?: string | null
  headVersion?: string | null
  detail?: 'version-unknown' | 'behind' | 'ahead' | 'equal' | 'skill-missing'
}

// ── readWorkflowHeadVersion ───────────────────────────────────────────────────

/**
 * Read the workflow head version from the highest-numbered migration file.
 *
 * D-10-06: filters files matching /^\d{4}-.+\.md$/, sorts lex-descending,
 * reads the first one with a to_version frontmatter field.
 *
 * @param migrationsDirOverride Test-only override for the migrations directory.
 * @returns The head version string (e.g. '1.8.0'), or null if not found.
 */
export function readWorkflowHeadVersion(migrationsDirOverride?: string): string | null {
  const dir = migrationsDirOverride ?? MIGRATIONS_DIR_DEFAULT
  if (!existsSync(dir)) return null

  let entries: string[]
  try {
    entries = readdirSync(dir)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .sort()
      .reverse() // lex-descending → highest numbered first
  } catch {
    return null
  }

  for (const name of entries) {
    const fm = parseFrontmatter(join(dir, name))
    if (!fm) continue
    const toVersion = (fm as Record<string, unknown>).to_version as string | undefined
    if (typeof toVersion === 'string' && toVersion.trim()) return toVersion.trim()
  }

  return null
}

// ── CANDIDATE_PATHS ───────────────────────────────────────────────────────────

/**
 * 4 candidate SKILL.md paths — Pitfall 4 dual dirname × dual layout.
 *
 * Two dirname conventions exist in the wild:
 *  - 'agentic-apps-workflow' (canonical, migration-installed)
 *  - 'agenticapps-workflow' (dashboard's own pre-migration convention)
 *
 * Two layout conventions:
 *  - canonical: <dir>/SKILL.md
 *  - bundle:    <dir>/skill/SKILL.md
 *
 * Note: paths are EXPLICIT — scanner never recurses into .claude/worktrees/ (Pitfall 6).
 */
function getCandidatePaths(repoAbs: string): string[] {
  return [
    // Canonical name + canonical layout (cparx, fx-signal-agent — migration-installed)
    join(repoAbs, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
    // Canonical name + bundle layout (defensive — Phase 4 D-4-15 dual-probe pattern)
    join(repoAbs, '.claude', 'skills', 'agentic-apps-workflow', 'skill', 'SKILL.md'),
    // Dashboard's divergent name + bundle layout (pre-migration convention)
    join(repoAbs, '.claude', 'skills', 'agenticapps-workflow', 'skill', 'SKILL.md'),
    // Defensive: dashboard's name + canonical layout
    join(repoAbs, '.claude', 'skills', 'agenticapps-workflow', 'SKILL.md'),
  ]
}

// ── compareSemver ─────────────────────────────────────────────────────────────

/**
 * Compare two semver strings.
 * @returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

// ── scanWorkflowVersionForRepo ────────────────────────────────────────────────

/**
 * Scan a repo's SKILL.md to determine workflow version state.
 *
 * CODEX HIGH-3: all reads go through the `resolve` callback.
 * CODEX HIGH-4: returns rich shape with installedVersion, headVersion, detail.
 * CODEX MED-12: verifies frontmatter name === 'agentic-apps-workflow'.
 *
 * @param repoAbsPath Absolute path to the repo root.
 * @param head        Workflow head version from readWorkflowHeadVersion() (or null).
 * @param resolve     PathResolver callback (CODEX HIGH-3).
 */
export function scanWorkflowVersionForRepo(
  repoAbsPath: string,
  head: string | null,
  resolve: PathResolver,
): WorkflowRepoState {
  const skillRoot = join(repoAbsPath, '.claude', 'skills')

  for (const candidatePath of getCandidatePaths(repoAbsPath)) {
    // CODEX HIGH-3: validate candidate path through resolver.
    let canonical: string
    try {
      canonical = resolve(candidatePath, {
        allowedNames: ['SKILL.md'],
        roots: [skillRoot, repoAbsPath],
      })
    } catch {
      // PathViolation or not accessible — try next candidate.
      continue
    }

    if (!existsSync(canonical)) continue

    const fm = parseFrontmatter(canonical)
    if (!fm) continue

    // CODEX MED-12: identity check — frontmatter name MUST equal 'agentic-apps-workflow'.
    // Directory presence alone is insufficient.
    const skillName = (fm as Record<string, unknown>).name as string | undefined
    if (typeof skillName !== 'string' || skillName.trim() !== 'agentic-apps-workflow') {
      // Wrong skill name — treat this candidate as if absent, try next.
      continue
    }

    const ver = (fm as Record<string, unknown>).version as string | undefined

    // Pitfall 3: version field absent (dashboard's own SKILL.md case) → 'stale', not 'missing'.
    if (typeof ver !== 'string' || !ver.trim()) {
      return {
        state: 'stale',
        installedVersion: null,
        headVersion: head,
        detail: 'version-unknown',
      }
    }

    const installedVersion = ver.trim()

    // Head unknown — can't compare; treat as 'fresh' with 'ahead' detail.
    if (!head) {
      return {
        state: 'fresh',
        installedVersion,
        headVersion: null,
        detail: 'ahead',
      }
    }

    const cmp = compareSemver(installedVersion, head)
    if (cmp === 0) {
      return {
        state: 'fresh',
        installedVersion,
        headVersion: head,
        detail: 'equal',
      }
    }
    if (cmp < 0) {
      return {
        state: 'stale',
        installedVersion,
        headVersion: head,
        detail: 'behind',
      }
    }
    // cmp > 0 → ahead
    return {
      state: 'fresh',
      installedVersion,
      headVersion: head,
      detail: 'ahead',
    }
  }

  // No SKILL.md found at any candidate path → skill missing.
  return {
    state: 'missing',
    installedVersion: null,
    headVersion: head,
    detail: 'skill-missing',
  }
}
