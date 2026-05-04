import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest'
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  realpathSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { ProjectOverviewSchema } from '@agenticapps/dashboard-shared'

import {
  parseReviewFile,
  parseVerification,
  detectMarkers,
  findLatestPhaseDir,
  parseTddPairs,
  detectBranch,
  readOverview,
} from './projectOverview.js'

// Path to the sample-project fixture
const FIXTURE_ROOT = new URL(
  './__fixtures__/sample-project',
  import.meta.url
).pathname

describe('parseReviewFile', () => {
  it('returns null for a missing file', () => {
    expect(parseReviewFile('/non-existent/path/02-REVIEW.md')).toBeNull()
  })

  it('returns stage1 findings from fixture frontmatter (critical→red, warning→yellow, info→green)', () => {
    const reviewPath = join(FIXTURE_ROOT, '.planning', 'phases', '02-foo', '02-REVIEW.md')
    const result = parseReviewFile(reviewPath)
    expect(result).not.toBeNull()
    expect(result?.ran).toBe(true)
    expect(result?.findings).toEqual({ red: 0, yellow: 2, green: 5 })
  })

  it('falls back to tag counting when no frontmatter', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'review-test-'))
    const filePath = join(tmp, 'REVIEW.md')
    writeFileSync(
      filePath,
      [
        '# Review',
        '<finding severity="critical">issue A</finding>',
        '<finding severity="warning">issue B</finding>',
        '<finding severity="warning">issue C</finding>',
      ].join('\n')
    )
    const result = parseReviewFile(filePath)
    expect(result?.findings).toEqual({ red: 1, yellow: 2, green: 0 })
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe('parseVerification', () => {
  it('returns null for a missing file', () => {
    expect(parseVerification('/non-existent/path/VERIFICATION.md')).toBeNull()
  })

  it('returns evidence and mustHaves from fixture', () => {
    const verPath = join(FIXTURE_ROOT, '.planning', 'phases', '02-foo', '02-VERIFICATION.md')
    const result = parseVerification(verPath)
    expect(result).not.toBeNull()
    expect(result?.mustHaves).toBe(3) // 3 bold-bullet list items
    expect(result?.evidence).toBe(2) // 2 occurrences of **Evidence
  })
})

describe('detectMarkers', () => {
  it('correctly detects markers for sample-project fixture', () => {
    const markers = detectMarkers(FIXTURE_ROOT)
    // fixture has .planning but no .git or .claude/skills
    expect(markers.gitRepo).toBe(false)
    expect(markers.planning).toBe(true)
    expect(markers.claudeSkills).toBe(false)
  })
})

describe('findLatestPhaseDir', () => {
  it('returns the absolute path to the highest-numbered phase dir', () => {
    const result = findLatestPhaseDir(FIXTURE_ROOT)
    expect(result).not.toBeNull()
    expect(result).toMatch(/phases\/02-foo$/)
  })

  it('returns null for a directory with no phases', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'no-phases-'))
    expect(findLatestPhaseDir(tmp)).toBeNull()
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe('phase status heuristic', () => {
  let tmp: string

  beforeAll(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'phase-status-')))
  })

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('returns Pending when no PLAN.md in phase dir', () => {
    const root = join(tmp, 'pending')
    const phaseDir = join(root, '.planning', 'phases', '01-test')
    mkdirSync(phaseDir, { recursive: true })
    // No PLAN.md written
    return readOverview(root).then((overview) => {
      expect(overview.phaseStatus).toBe('Pending')
    })
  })

  it('returns In Progress when PLAN.md exists but evidence < mustHaves', () => {
    const root = join(tmp, 'in-progress')
    const phaseDir = join(root, '.planning', 'phases', '01-test')
    mkdirSync(phaseDir, { recursive: true })
    writeFileSync(join(phaseDir, '01-PLAN.md'), '# Plan')
    writeFileSync(
      join(phaseDir, '01-VERIFICATION.md'),
      '- **truth1**\n- **truth2**\n- **truth3**\n**Evidence:** only one'
    )
    return readOverview(root).then((overview) => {
      expect(overview.phaseStatus).toBe('In Progress')
    })
  })

  it('returns Complete when evidence >= mustHaves', () => {
    const root = join(tmp, 'complete')
    const phaseDir = join(root, '.planning', 'phases', '01-test')
    mkdirSync(phaseDir, { recursive: true })
    writeFileSync(join(phaseDir, '01-PLAN.md'), '# Plan')
    writeFileSync(
      join(phaseDir, '01-VERIFICATION.md'),
      '- **truth1**\n- **truth2**\n**Evidence:** first\n**Evidence:** second'
    )
    return readOverview(root).then((overview) => {
      expect(overview.phaseStatus).toBe('Complete')
    })
  })
})

describe('readOverview', () => {
  it('composes a valid ProjectOverview that passes schema parse', async () => {
    const overview = await readOverview(FIXTURE_ROOT)
    expect(() => ProjectOverviewSchema.parse(overview)).not.toThrow()
  })

  it('returns stage1 findings from fixture REVIEW.md', async () => {
    const overview = await readOverview(FIXTURE_ROOT)
    expect(overview.stage1).not.toBeNull()
    expect(overview.stage1?.findings).toEqual({ red: 0, yellow: 2, green: 5 })
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
