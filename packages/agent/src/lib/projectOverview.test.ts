import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  realpathSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ProjectOverviewSchema } from '@agenticapps/dashboard-shared'

import {
  detectMarkers,
  parseTddPairs,
  detectBranch,
  readOverview,
} from './projectOverview.js'

// Path to the sample-project fixture
const FIXTURE_ROOT = new URL(
  './__fixtures__/sample-project',
  import.meta.url
).pathname

describe('detectMarkers', () => {
  it('correctly detects markers for sample-project fixture', () => {
    const markers = detectMarkers(FIXTURE_ROOT)
    // fixture has .planning but no .git or .claude/skills
    expect(markers.gitRepo).toBe(false)
    expect(markers.planning).toBe(true)
    expect(markers.claudeSkills).toBe(false)
  })
})

describe('the retired GSD phase reader', () => {
  it('no longer exports any phase-artifact parser', async () => {
    const mod = await import('./projectOverview.js')
    const exported = Object.keys(mod)
    expect(exported).not.toContain('findLatestPhaseDir')
    expect(exported).not.toContain('parseReviewFile')
    expect(exported).not.toContain('parseVerification')
  })

  /*
   * The fixture carries a fully-populated `.planning/phases/02-foo/` tree —
   * REVIEW.md, VERIFICATION.md, PLAN.md. Reading it must now yield nothing:
   * the artifacts are on disk and the daemon is indifferent to them.
   */
  it('reports no phase fields even when phase artifacts are present', async () => {
    const overview = await readOverview(FIXTURE_ROOT)
    for (const field of [
      'phaseStatus',
      'stage1',
      'stage2',
      'dbAudit',
      'verification',
    ]) {
      expect(overview).not.toHaveProperty(field)
    }
  })

  it('is unaffected by phase artifacts appearing under a project root', async () => {
    const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'retired-phase-')))
    const phaseDir = join(tmp, '.planning', 'phases', '99-late')
    mkdirSync(phaseDir, { recursive: true })
    writeFileSync(join(phaseDir, '99-PLAN.md'), '# Plan')
    writeFileSync(
      join(phaseDir, '99-VERIFICATION.md'),
      '- **truth1**\n- **truth2**\n**Evidence:** first\n**Evidence:** second',
    )
    writeFileSync(
      join(phaseDir, '99-REVIEW.md'),
      '---\ncritical: 3\nwarning: 1\ninfo: 0\n---\n# Review',
    )

    const before = await readOverview(tmp)
    rmSync(join(tmp, '.planning', 'phases'), { recursive: true, force: true })
    const after = await readOverview(tmp)

    expect(after).toEqual(before)
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe('readOverview', () => {
  it('composes a valid ProjectOverview that passes schema parse', async () => {
    const overview = await readOverview(FIXTURE_ROOT)
    expect(() => ProjectOverviewSchema.parse(overview)).not.toThrow()
  })

  it('reports exactly the git- and marker-derived fields that survive', async () => {
    const overview = await readOverview(FIXTURE_ROOT)
    expect(Object.keys(overview).sort()).toEqual(['branch', 'markers', 'tdd'])
  })
})

describe('parseTddPairs and detectBranch on isolated tmp dir (no git)', () => {
  // Use a temp dir in /tmp which is guaranteed to be outside any git repo
  let isolatedDir: string

  beforeAll(() => {
    isolatedDir = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-nogit-')))
  })

  afterAll(() => {
    rmSync(isolatedDir, { recursive: true, force: true })
  })

  it('parseTddPairs returns zeros when no .git repo reachable', async () => {
    const result = await parseTddPairs(isolatedDir)
    expect(result).toEqual({ greenPairs: 0, totalTasks: 0 })
  })

  it('detectBranch returns null when no .git repo reachable', async () => {
    const result = await detectBranch(isolatedDir)
    expect(result).toBeNull()
  })
})
