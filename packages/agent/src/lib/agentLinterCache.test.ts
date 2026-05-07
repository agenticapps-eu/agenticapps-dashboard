/**
 * Tests for agentLinterCache.ts — per-projectId cache with 1h TTL + mtime invalidation.
 *
 * D-5-14: Cache key = (projectId, max-mtime across all SKILL.md), 1h hard ceiling.
 *
 * 8 test cases:
 *   1. computeMaxMtime returns 0 when neither root has any SKILL.md
 *   2. computeMaxMtime finds max mtime across <projectRoot>/.claude/skills
 *   3. computeMaxMtime includes global root files via globalRoot param
 *   4. Cache hit: same projectId + same maxMtime + within 1h → returns entry
 *   5. Cache miss: projectId differs → returns null
 *   6. Cache miss: maxMtime differs → returns null
 *   7. Cache miss: now - cachedAt > 1h → returns null
 *   8. evictAgentLinterCacheProject removes the entry
 */

import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
  utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  computeMaxMtime,
  getAgentLinterCached,
  setAgentLinterCached,
  evictAgentLinterCacheProject,
  __resetCache,
} from './agentLinterCache.js'

function makeSkillsDir(root: string, dir: string, canonical = true): string {
  const skillRoot = join(root, dir)
  let skillMdPath: string
  if (canonical) {
    mkdirSync(skillRoot, { recursive: true })
    skillMdPath = join(skillRoot, 'SKILL.md')
  } else {
    mkdirSync(join(skillRoot, 'skill'), { recursive: true })
    skillMdPath = join(skillRoot, 'skill', 'SKILL.md')
  }
  writeFileSync(skillMdPath, `---\nname: ${dir}\n---\n`)
  return skillMdPath
}

function setFileMtime(filePath: string, isoDate: string): void {
  const d = new Date(isoDate)
  utimesSync(filePath, d, d)
}

const DUMMY_RESULT = { kind: 'not-installed' as const }

describe('computeMaxMtime', () => {
  let tmpRoot: string
  let cleanup: () => void

  beforeEach(() => {
    tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-cache-test-')))
    cleanup = () => rmSync(tmpRoot, { recursive: true, force: true })
  })

  afterEach(() => cleanup())

  it('1. returns 0 when neither root has any SKILL.md', async () => {
    const result = await computeMaxMtime('/nonexistent/project', '/nonexistent/global')
    expect(result).toBe(0)
  })

  it('2. finds max mtime across <projectRoot>/.claude/skills', async () => {
    const skillsRoot = join(tmpRoot, '.claude', 'skills')
    const p1 = makeSkillsDir(skillsRoot, 'skill-a')
    const p2 = makeSkillsDir(skillsRoot, 'skill-b')

    const d1 = new Date('2026-01-01T10:00:00Z')
    const d2 = new Date('2026-01-02T10:00:00Z') // later
    setFileMtime(p1, d1.toISOString())
    setFileMtime(p2, d2.toISOString())

    const result = await computeMaxMtime(tmpRoot, '/nonexistent/global')
    expect(result).toBe(d2.getTime())
  })

  it('3. includes global root files when globalRoot param is provided', async () => {
    // Project has one skill
    const skillsRoot = join(tmpRoot, '.claude', 'skills')
    const p1 = makeSkillsDir(skillsRoot, 'local-skill')
    const localDate = new Date('2026-01-01T10:00:00Z')
    setFileMtime(p1, localDate.toISOString())

    // Global root has a newer skill
    const globalHome = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-global-')))
    try {
      const globalSkillsRoot = join(globalHome, '.claude', 'skills')
      const p2 = makeSkillsDir(globalSkillsRoot, 'global-skill')
      const globalDate = new Date('2026-02-01T10:00:00Z') // newer than local
      setFileMtime(p2, globalDate.toISOString())

      const result = await computeMaxMtime(tmpRoot, globalSkillsRoot)
      expect(result).toBe(globalDate.getTime())
    } finally {
      rmSync(globalHome, { recursive: true, force: true })
    }
  })
})

describe('getAgentLinterCached + setAgentLinterCached', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetCache()
  })

  it('4. cache hit: same projectId + same maxMtime + within 1h', () => {
    const entry = {
      result: DUMMY_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1234567890,
    }
    setAgentLinterCached('proj-1', entry)

    const hit = getAgentLinterCached('proj-1', 1234567890)
    expect(hit).not.toBeNull()
    expect(hit!.result.kind).toBe('not-installed')
    expect(hit!.maxMtime).toBe(1234567890)
  })

  it('5. cache miss: projectId differs', () => {
    const entry = {
      result: DUMMY_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1234567890,
    }
    setAgentLinterCached('proj-1', entry)

    const hit = getAgentLinterCached('proj-2', 1234567890)
    expect(hit).toBeNull()
  })

  it('6. cache miss: maxMtime differs (mtime invalidation)', () => {
    const entry = {
      result: DUMMY_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1000000,
    }
    setAgentLinterCached('proj-1', entry)

    // Different maxMtime (e.g. a SKILL.md was touched)
    const hit = getAgentLinterCached('proj-1', 9999999)
    expect(hit).toBeNull()
  })

  it('7. cache miss: now - cachedAt > 1h (TTL expired)', () => {
    const entry = {
      result: DUMMY_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1234567890,
    }
    setAgentLinterCached('proj-1', entry)

    // Advance fake clock by just over 1h
    vi.advanceTimersByTime(3_600_001)

    const hit = getAgentLinterCached('proj-1', 1234567890)
    expect(hit).toBeNull()
  })

  it('8. evictAgentLinterCacheProject removes the entry', () => {
    const entry = {
      result: DUMMY_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1234567890,
    }
    setAgentLinterCached('proj-1', entry)

    // Verify it's there first
    expect(getAgentLinterCached('proj-1', 1234567890)).not.toBeNull()

    evictAgentLinterCacheProject('proj-1')

    expect(getAgentLinterCached('proj-1', 1234567890)).toBeNull()
  })
})
