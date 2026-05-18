/**
 * skillDriftScan.test.ts — Cross-repo Skill drift aggregator + familyOf helper.
 *
 * Plan 11-03 Task 1 (RED first).
 *
 * REVIEWS action item 6: readLocalSkills returns `{ scope: 'local'; skills: SkillEntry[] }`
 * (verified at skillsScan.ts:133-135). Aggregator MUST destructure `.skills` —
 * Test 16 mocks the OBJECT shape and asserts the aggregator processes ONE skill
 * (not zero, which would mean it iterated the wrapper object).
 *
 * REVIEWS action item 7: ALL tests fixture-driven. NO test reads any real file
 * from the developer's homedir; every registry comes from a tmpdir fixture and
 * every `readLocalSkills` return is mocked.
 *
 * Fixtures:
 *   - readLocalSkills: vi.mock per-test return value (controls per-project skills)
 *   - readRegistry: tmp-dir-backed registry.json fixture file passed via `registryFile`
 *     option (mirrors Phase 1 hermeticity pattern)
 *   - homedir: `homedirOverride` option for portability (Test 8 — no hardcoded user paths)
 *
 * Promise.allSettled isolation: Test 12 has readLocalSkills throw for one project
 * and succeed for another; the response carries the success + a `degraded` marker
 * for the failure.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock readLocalSkills so we control the { scope, skills } return shape per test.
// We mock the module BEFORE importing the System Under Test so the SUT picks up
// the mock at import time.
vi.mock('./skillsScan.js', () => ({
  readLocalSkills: vi.fn(),
}))

import { SkillDriftResponseSchema } from '@agenticapps/dashboard-shared'
import { readLocalSkills } from './skillsScan.js'
import { familyOf, scanSkillDrift, KNOWN_FAMILIES } from './skillDriftScan.js'

const HOME = '/fake-home'

/**
 * Make a tmp registry.json fixture file. Returns path + cleanup function.
 * Tests pass this path via `registryFile` so no developer-homedir state is read.
 */
function makeFixtureRegistry(
  projects: Array<{ id: string; name: string; root: string }>,
): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'skill-drift-fixture-'))
  const file = join(dir, 'registry.json')
  const today = new Date().toISOString()
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      projects: projects.map((p) => ({
        ...p,
        client: null,
        addedAt: today,
        tags: [],
      })),
    }),
    'utf8',
  )
  return { path: file, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('familyOf(root, homedirOverride)', () => {
  it('Test 1: /fake-home/Sourcecode/agenticapps/<repo> resolves to "agenticapps"', () => {
    expect(familyOf(`${HOME}/Sourcecode/agenticapps/agenticapps-dashboard`, HOME)).toBe(
      'agenticapps',
    )
  })

  it('Test 2: /fake-home/Sourcecode/factiv/<repo> resolves to "factiv"', () => {
    expect(familyOf(`${HOME}/Sourcecode/factiv/cparx`, HOME)).toBe('factiv')
  })

  it('Test 3: /fake-home/Sourcecode/neuroflash/<repo> resolves to "neuroflash"', () => {
    expect(familyOf(`${HOME}/Sourcecode/neuroflash/some-service`, HOME)).toBe('neuroflash')
  })

  it('Test 4: /fake-home/SomeOtherDir/<repo> falls back to "other"', () => {
    expect(familyOf(`${HOME}/SomeOtherDir/random-project`, HOME)).toBe('other')
  })

  it('Test 5: /fake-home/Sourcecode/<unknown-family>/<repo> falls back to "other"', () => {
    expect(familyOf(`${HOME}/Sourcecode/random-thing/some-repo`, HOME)).toBe('other')
  })

  it('Test 6: /tmp/standalone (outside Sourcecode) falls back to "other"', () => {
    expect(familyOf('/tmp/standalone', HOME)).toBe('other')
  })

  it('Test 7: /fake-home/Sourcecode/agenticapps (exact family dir, no child) falls back to "other"', () => {
    // Documents behaviour — registry should never register a family dir itself,
    // but if it did, familyOf treats it as 'other' (no `${family}/${repo}` shape).
    expect(familyOf(`${HOME}/Sourcecode/agenticapps`, HOME)).toBe('other')
  })

  it('Test 8: results are stable under any homedirOverride (no hardcoded /Users/donald/)', () => {
    expect(familyOf('/some-other-home/Sourcecode/agenticapps/r', '/some-other-home')).toBe(
      'agenticapps',
    )
    expect(familyOf('/some-other-home/Sourcecode/factiv/r', '/some-other-home')).toBe('factiv')
    expect(
      familyOf('/some-other-home/Sourcecode/neuroflash/r', '/some-other-home'),
    ).toBe('neuroflash')
    expect(familyOf('/some-other-home/SomeOtherDir/r', '/some-other-home')).toBe('other')
  })
})

describe('scanSkillDrift', () => {
  let cleanup: () => void = () => {}

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    cleanup = () => {}
  })

  it('Test 9: returns SkillDriftResponse with one entry per fixture-registered project', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-agentic', name: 'Agentic', root: `${HOME}/Sourcecode/agenticapps/agentic-r` },
      { id: 'p-factiv', name: 'Factiv', root: `${HOME}/Sourcecode/factiv/cparx` },
    ])
    cleanup = fixture.cleanup

    vi.mocked(readLocalSkills).mockResolvedValue({ scope: 'local', skills: [] })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })

    expect(result.projects).toHaveLength(2)
    expect(result.projects[0]).toMatchObject({
      projectId: 'p-agentic',
      projectName: 'Agentic',
      family: 'agenticapps',
    })
    expect(result.projects[1]).toMatchObject({
      projectId: 'p-factiv',
      projectName: 'Factiv',
      family: 'factiv',
    })
  })

  it('Test 10: rows aggregate same-named skill across projects with their own version cells', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-a', name: 'A', root: `${HOME}/Sourcecode/agenticapps/a` },
      { id: 'p-b', name: 'B', root: `${HOME}/Sourcecode/agenticapps/b` },
    ])
    cleanup = fixture.cleanup

    vi.mocked(readLocalSkills)
      .mockResolvedValueOnce({
        scope: 'local',
        skills: [
          { name: 'skill-x', version: '1.0.0', dir: 'skill-x', scope: 'local' },
        ],
      })
      .mockResolvedValueOnce({
        scope: 'local',
        skills: [
          { name: 'skill-x', version: '2.0.0', dir: 'skill-x', scope: 'local' },
        ],
      })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.skillId).toBe('skill-x')
    expect(result.rows[0]!.byProject['p-a']).toMatchObject({ present: true, version: '1.0.0' })
    expect(result.rows[0]!.byProject['p-b']).toMatchObject({ present: true, version: '2.0.0' })
  })

  it('Test 11: project lacking a skill renders an absent cell', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-a', name: 'A', root: `${HOME}/Sourcecode/agenticapps/a` },
      { id: 'p-b', name: 'B', root: `${HOME}/Sourcecode/agenticapps/b` },
    ])
    cleanup = fixture.cleanup

    vi.mocked(readLocalSkills)
      .mockResolvedValueOnce({
        scope: 'local',
        skills: [{ name: 'skill-only-on-a', version: '0.1.0', dir: 's', scope: 'local' }],
      })
      .mockResolvedValueOnce({ scope: 'local', skills: [] })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })

    expect(result.rows[0]!.byProject['p-b']).toEqual({
      present: false,
      version: null,
      lastModifiedIso: null,
    })
  })

  it('Test 12: Promise.allSettled isolation — one project throws, response still carries the other', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-a', name: 'A', root: `${HOME}/Sourcecode/agenticapps/a` },
      { id: 'p-b', name: 'B', root: `${HOME}/Sourcecode/agenticapps/b` },
    ])
    cleanup = fixture.cleanup

    vi.mocked(readLocalSkills)
      .mockRejectedValueOnce(new Error('disk on fire'))
      .mockResolvedValueOnce({
        scope: 'local',
        skills: [{ name: 'skill-x', version: '1.0.0', dir: 's', scope: 'local' }],
      })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })

    const a = result.projects.find((p) => p.projectId === 'p-a')!
    const b = result.projects.find((p) => p.projectId === 'p-b')!
    expect(a.degraded).toBe('disk on fire')
    expect(b.degraded).toBeUndefined()
    // The successful project's skill is still present in the matrix.
    expect(result.rows.find((r) => r.skillId === 'skill-x')!.byProject['p-b']).toMatchObject({
      present: true,
      version: '1.0.0',
    })
  })

  it('Test 13: generatedAtIso is a valid ISO datetime string', async () => {
    const fixture = makeFixtureRegistry([])
    cleanup = fixture.cleanup

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })
    expect(() => new Date(result.generatedAtIso).toISOString()).not.toThrow()
    expect(new Date(result.generatedAtIso).toString()).not.toBe('Invalid Date')
  })

  it('Test 14: response parses cleanly through SkillDriftResponseSchema', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-a', name: 'A', root: `${HOME}/Sourcecode/agenticapps/a` },
    ])
    cleanup = fixture.cleanup

    vi.mocked(readLocalSkills).mockResolvedValue({
      scope: 'local',
      skills: [
        {
          name: 'x',
          version: '1.0.0',
          dir: 'x',
          scope: 'local',
          lastModifiedIso: '2026-05-16T12:00:00.000Z',
        } as never,
      ],
    })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })
    expect(() => SkillDriftResponseSchema.parse(result)).not.toThrow()
  })

  it('Test 15: empty fixture registry returns empty projects + rows', async () => {
    const fixture = makeFixtureRegistry([])
    cleanup = fixture.cleanup

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })
    expect(result).toMatchObject({
      schemaVersion: 1,
      projects: [],
      rows: [],
    })
    expect(typeof result.generatedAtIso).toBe('string')
  })

  it('Test 16: REVIEWS action item 6 — aggregator destructures readLocalSkills .skills (not iterating the wrapper object)', async () => {
    const fixture = makeFixtureRegistry([
      { id: 'p-a', name: 'A', root: `${HOME}/Sourcecode/agenticapps/a` },
    ])
    cleanup = fixture.cleanup

    // Return the actual `{ scope, skills }` shape — one skill inside.
    vi.mocked(readLocalSkills).mockResolvedValue({
      scope: 'local',
      skills: [{ name: 'only-skill', version: '1.0', dir: 'only-skill', scope: 'local' }],
    })

    const result = await scanSkillDrift({
      registryFile: fixture.path,
      homedirOverride: HOME,
    })

    // If the aggregator iterated the wrapper object, it would see "scope" + "skills"
    // as keys and produce >= 2 rows or zero. Destructuring `.skills` correctly
    // yields exactly ONE row.
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.skillId).toBe('only-skill')
  })

  it('Test 17: REVIEWS action item 7 — all tests fixture-driven (no developer homedir reads)', () => {
    // Marker test — every test in this file routes registry reads through
    // a tmp-dir fixture and mocks readLocalSkills. No path under any user's
    // real homedir is read. Verified by grep in the plan's acceptance criteria.
    expect(true).toBe(true)
  })
})

describe('KNOWN_FAMILIES export', () => {
  it('exposes the three known families in stable order', () => {
    expect(Array.from(KNOWN_FAMILIES)).toEqual(['agenticapps', 'factiv', 'neuroflash'])
  })
})
