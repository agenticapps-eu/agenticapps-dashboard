/**
 * workflowVersionScanner.test.ts — per-repo workflow version detection.
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * CODEX MED-12: directory presence alone is insufficient — SKILL.md frontmatter
 *   name === 'agentic-apps-workflow' must be verified.
 * Pitfall 3: version field absent in SKILL.md frontmatter → stale with detail='version-unknown'.
 * Pitfall 4: probe all 4 CANDIDATE_PATHS (dual dirname × dual layout).
 * Pitfall 6: scanner uses only 4 explicit paths — never recurses into .claude/worktrees/.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import {
  readWorkflowHeadVersion,
  scanWorkflowVersionForRepo,
  compareSemver,
} from './workflowVersionScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workflow-scanner-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

/** A permissive resolver that allows everything under given roots. */
function makePermissiveResolver(...roots: string[]): PathResolver {
  return (candidatePath, _opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    const realRoots = roots.map((r) => {
      try {
        return realpathSync(r)
      } catch {
        return r
      }
    })
    const inRoot = realRoots.some((root) => real === root || real.startsWith(root + sep))
    if (!inRoot) throw new PathViolation(`outside allowed roots: ${real}`)
    return real
  }
}

/** Write a SKILL.md with frontmatter at the given path. */
function writeSkillMd(path: string, fields: Record<string, string>): void {
  mkdirSync(join(path, '..'), { recursive: true })
  const frontmatter = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  writeFileSync(path, `---\n${frontmatter}\n---\n\n# Skill content\n`)
}

/** Write a migration file with the given to_version in frontmatter. */
function writeMigration(dir: string, filename: string, toVersion: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, filename), `---\nto_version: ${toVersion}\n---\n\n# Migration\n`)
}

// ── readWorkflowHeadVersion ───────────────────────────────────────────────────

describe('readWorkflowHeadVersion', () => {
  it('returns null when migrations directory is absent', () => {
    const result = readWorkflowHeadVersion(join(tmpDir, 'nonexistent'))
    expect(result).toBeNull()
  })

  it('returns null when no migration file matches the \\d{4}-.+.md pattern', () => {
    const migrDir = join(tmpDir, 'migrations')
    mkdirSync(migrDir)
    writeFileSync(join(migrDir, 'README.md'), '# not a migration')
    writeFileSync(join(migrDir, 'migration.md'), 'no numeric prefix')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBeNull()
  })

  it('returns to_version from the single migration file', () => {
    const migrDir = join(tmpDir, 'migrations')
    writeMigration(migrDir, '0007-gitnexus.md', '1.7.0')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBe('1.7.0')
  })

  it('returns to_version from the highest-numbered migration (lex-descending sort)', () => {
    const migrDir = join(tmpDir, 'migrations')
    writeMigration(migrDir, '0007-gitnexus.md', '1.7.0')
    writeMigration(migrDir, '0008-coverage.md', '1.8.0')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBe('1.8.0')
  })

  it('returns null when no migration file has a to_version field', () => {
    const migrDir = join(tmpDir, 'migrations')
    mkdirSync(migrDir)
    writeFileSync(join(migrDir, '0007-no-version.md'), '---\nfrom_version: 1.6.0\n---\n\ncontent\n')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBeNull()
  })

  it('falls through to next migration when highest has no to_version', () => {
    const migrDir = join(tmpDir, 'migrations')
    writeMigration(migrDir, '0007-old.md', '1.7.0')
    // 0008 has no to_version — should fall through to 0007.
    mkdirSync(migrDir, { recursive: true })
    writeFileSync(join(migrDir, '0008-no-ver.md'), '---\nfrom_version: 1.7.0\n---\n\ncontent\n')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBe('1.7.0')
  })

  it('lex-descending sort: 0010 > 0009 > 0008 > 0007 (numeric sort)', () => {
    const migrDir = join(tmpDir, 'migrations')
    writeMigration(migrDir, '0007-baseline.md', '1.7.0')
    writeMigration(migrDir, '0008-coverage.md', '1.8.0')
    writeMigration(migrDir, '0009-extra.md', '1.9.0')
    writeMigration(migrDir, '0010-latest.md', '2.0.0')
    const result = readWorkflowHeadVersion(migrDir)
    expect(result).toBe('2.0.0')
  })
})

// ── compareSemver ─────────────────────────────────────────────────────────────

describe('compareSemver', () => {
  it('returns -1 when a < b', () => {
    expect(compareSemver('1.7.0', '1.8.0')).toBe(-1)
  })
  it('returns 0 when a === b', () => {
    expect(compareSemver('1.8.0', '1.8.0')).toBe(0)
  })
  it('returns 1 when a > b', () => {
    expect(compareSemver('2.0.0', '1.8.0')).toBe(1)
  })
})

// ── scanWorkflowVersionForRepo ────────────────────────────────────────────────

describe('scanWorkflowVersionForRepo', () => {
  it('CASE-1 EQUAL: returns state=fresh + detail=equal when installed === head', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.8.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('fresh')
    expect(result.detail).toBe('equal')
    expect(result.installedVersion).toBe('1.8.0')
    expect(result.headVersion).toBe('1.8.0')
  })

  it('CASE-2 BEHIND: returns state=stale + detail=behind when installed < head', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.7.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('stale')
    expect(result.detail).toBe('behind')
    expect(result.installedVersion).toBe('1.7.0')
    expect(result.headVersion).toBe('1.8.0')
  })

  it('CASE-3 AHEAD: returns state=fresh + detail=ahead when installed > head', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.9.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('fresh')
    expect(result.detail).toBe('ahead')
    expect(result.installedVersion).toBe('1.9.0')
    expect(result.headVersion).toBe('1.8.0')
  })

  it('CASE-4 VERSION-UNKNOWN (Pitfall 3): skill present + no version field → state=stale, detail=version-unknown', () => {
    // Dashboard own case: agenticapps-workflow/skill/SKILL.md with name but no version.
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agenticapps-workflow', 'skill', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow' }) // no version field
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('stale')
    expect(result.detail).toBe('version-unknown')
    // Must NOT be 'missing' — skill IS present.
  })

  it('CASE-5 SKILL-MISSING: returns state=missing + detail=skill-missing when no SKILL.md found at any candidate', () => {
    const repoDir = join(tmpDir, 'repo')
    mkdirSync(repoDir, { recursive: true })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('missing')
    expect(result.detail).toBe('skill-missing')
  })

  it('DUAL-LAYOUT: probes all 4 CANDIDATE_PATHS — bundle layout (agenticapps-workflow/skill/SKILL.md) is found', () => {
    const repoDir = join(tmpDir, 'repo')
    // Only place the SKILL.md at the bundle-layout divergent-dirname path.
    const skillPath = join(repoDir, '.claude', 'skills', 'agenticapps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.7.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    // Must find it (not return skill-missing).
    expect(result.state).not.toBe('missing')
    expect(result.detail).not.toBe('skill-missing')
    expect(result.installedVersion).toBe('1.7.0')
  })

  it('head=null: when migration head unknown, installed version → state=fresh, detail=ahead', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.7.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, null, resolve)
    expect(result.state).toBe('fresh')
    expect(result.detail).toBe('ahead')
    expect(result.installedVersion).toBe('1.7.0')
    expect(result.headVersion).toBeNull()
  })

  it('CODEX MED-12 NEGATIVE: SKILL.md with wrong name is skipped (directory presence alone insufficient)', () => {
    const repoDir = join(tmpDir, 'repo')
    // Place SKILL.md at canonical path but with wrong name.
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'some-other-skill', version: '1.8.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    // Wrong name → skipped → no other candidate → skill-missing.
    expect(result.state).toBe('missing')
    expect(result.detail).toBe('skill-missing')
  })

  it('CODEX MED-12 POSITIVE: SKILL.md with name=agentic-apps-workflow is accepted', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.7.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    expect(result.state).toBe('stale')
    expect(result.detail).toBe('behind')
    expect(result.installedVersion).toBe('1.7.0')
  })

  it('CODEX HIGH-3: resolve callback is called for SKILL.md reads', () => {
    const repoDir = join(tmpDir, 'repo')
    mkdirSync(repoDir, { recursive: true })
    let resolveCallCount = 0
    const trackingResolver: PathResolver = (candidatePath, opts) => {
      resolveCallCount++
      return makePermissiveResolver(repoDir)(candidatePath, opts)
    }
    scanWorkflowVersionForRepo(repoDir, '1.8.0', trackingResolver)
    expect(resolveCallCount).toBeGreaterThan(0)
  })

  it('CODEX HIGH-4 metadata round-trip: behind case carries all 3 metadata fields for SPA rendering', () => {
    const repoDir = join(tmpDir, 'repo')
    const skillPath = join(repoDir, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')
    writeSkillMd(skillPath, { name: 'agentic-apps-workflow', version: '1.7.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    // All 3 fields populated for SPA to render "Installed 1.7.0 → head 1.8.0".
    expect(result.installedVersion).toBe('1.7.0')
    expect(result.headVersion).toBe('1.8.0')
    expect(result.detail).toBe('behind')
    expect(result.state).toBe('stale')
  })

  it('Pitfall 6: scanner does NOT walk .claude/worktrees/ — only the 4 explicit CANDIDATE_PATHS', () => {
    const repoDir = join(tmpDir, 'repo')
    // Place a SKILL.md inside a worktree — scanner must NOT find it.
    const worktreePath = join(
      repoDir,
      '.claude',
      'worktrees',
      'agent-01',
      'skills',
      'agentic-apps-workflow',
      'SKILL.md',
    )
    writeSkillMd(worktreePath, { name: 'agentic-apps-workflow', version: '1.8.0' })
    const resolve = makePermissiveResolver(repoDir)
    const result = scanWorkflowVersionForRepo(repoDir, '1.8.0', resolve)
    // Worktree SKILL.md must not be found — result should be skill-missing.
    expect(result.state).toBe('missing')
    expect(result.detail).toBe('skill-missing')
  })
})
