/**
 * Test fixture helper for Phase 4 parsers.
 *
 * Wraps `makeTmpProject` to provide Phase 4-specific helpers:
 * - writeObservation: writes a .md file to .planning/skill-observations/
 * - writeJsonl: writes a .jsonl file with HookFiring lines
 * - writeWorkflowSkill: writes the agenticapps-workflow skill SKILL.md
 * - writeMetaObserverSkill: writes the meta-observer skill SKILL.md
 * - writeLatestPhaseDir: creates files under .planning/phases/<name>/
 * - setMtime: controls file mtime for deterministic sort tests
 */

import {
  mkdirSync,
  writeFileSync,
  utimesSync,
  realpathSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface Phase4Fixture {
  root: string
  cleanup: () => void
  /** Write <name> into <root>/.planning/skill-observations/<name>, returns abs path */
  writeObservation: (name: string, content: string) => string
  /** Write JSON lines to <root>/.planning/skill-observations/<name>.jsonl, returns abs path */
  writeJsonl: (name: string, lines: Record<string, unknown>[]) => string
  /** Write <root>/.claude/skills/agenticapps-workflow/skill/SKILL.md */
  writeWorkflowSkill: (content: string) => string
  /** Write <root>/.claude/skills/meta-observer/SKILL.md (default: minimal content) */
  writeMetaObserverSkill: (content?: string) => string
  /** Create files under <root>/.planning/phases/<name>/ */
  writeLatestPhaseDir: (name: string, files: Record<string, string>) => string
  /** Set atime+mtime of absPath to a Date (or ISO string) for deterministic ordering */
  setMtime: (absPath: string, isoDate: string) => void
}

/**
 * Scaffold a temporary project root with .planning, .claude, .git dirs.
 * Returns helpers for Phase 4 fixture writes.
 */
export function makePhase4Fixture(): Phase4Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-p4-')))

  // Scaffold standard tree
  mkdirSync(join(root, '.planning', 'phases'), { recursive: true })
  mkdirSync(join(root, '.planning', 'skill-observations'), { recursive: true })
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true })
  mkdirSync(join(root, '.git'), { recursive: true })
  writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main')
  writeFileSync(join(root, '.planning', 'PROJECT.md'), '# test project\n')

  const cleanup = (): void => {
    rmSync(root, { recursive: true, force: true })
  }

  const writeObservation = (name: string, content: string): string => {
    const dir = join(root, '.planning', 'skill-observations')
    mkdirSync(dir, { recursive: true })
    const absPath = join(dir, name)
    writeFileSync(absPath, content)
    return absPath
  }

  const writeJsonl = (name: string, lines: Record<string, unknown>[]): string => {
    const dir = join(root, '.planning', 'skill-observations')
    mkdirSync(dir, { recursive: true })
    const absPath = join(dir, name)
    writeFileSync(absPath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
    return absPath
  }

  const writeWorkflowSkill = (content: string): string => {
    const dir = join(root, '.claude', 'skills', 'agenticapps-workflow', 'skill')
    mkdirSync(dir, { recursive: true })
    const absPath = join(dir, 'SKILL.md')
    writeFileSync(absPath, content)
    return absPath
  }

  const writeMetaObserverSkill = (content = '# meta-observer\n'): string => {
    const dir = join(root, '.claude', 'skills', 'meta-observer')
    mkdirSync(dir, { recursive: true })
    const absPath = join(dir, 'SKILL.md')
    writeFileSync(absPath, content)
    return absPath
  }

  const writeLatestPhaseDir = (name: string, files: Record<string, string>): string => {
    const dir = join(root, '.planning', 'phases', name)
    mkdirSync(dir, { recursive: true })
    for (const [filename, content] of Object.entries(files)) {
      writeFileSync(join(dir, filename), content)
    }
    return dir
  }

  const setMtime = (absPath: string, isoDate: string): void => {
    const d = new Date(isoDate)
    utimesSync(absPath, d, d)
  }

  return {
    root,
    cleanup,
    writeObservation,
    writeJsonl,
    writeWorkflowSkill,
    writeMetaObserverSkill,
    writeLatestPhaseDir,
    setMtime,
  }
}
