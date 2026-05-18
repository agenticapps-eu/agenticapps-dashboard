/**
 * Tests for skillDrift.ts — Zod schemas for /api/skills/drift (Phase 11).
 *
 * Wire-contract invariants:
 * - D-11-04: per-skill matrix is the primary view (rows = skills, columns = projects).
 * - D-11-06 + PD-11-03: daemon response does NOT change shape based on SPA's scope
 *   chip; SPA groups/filters client-side from the same payload. Tests cover the
 *   single payload shape only.
 * - Research finding: live registry has client: null for every entry, so family
 *   MUST be derived from path-prefix match against
 *   ~/Sourcecode/{agenticapps,factiv,neuroflash}/ with 'other' fallback for
 *   off-family registrations. Family enum is locked here.
 * - INV-04: schema validation at trust boundary; tests exercise Zod directly.
 *
 * Barrel re-export verification (REVIEWS.md item 10 spirit): downstream packages
 * import from '@agenticapps/dashboard-shared' (the barrel), not deep-import from
 * './schemas/...js'. Tests 17-19 verify the new schemas are barrel-resolved.
 */

import { describe, expect, it } from 'vitest'
import {
  SkillDriftCellSchema,
  SkillDriftRowSchema,
  SkillDriftResponseSchema,
} from './skillDrift.js'
// Barrel imports — verify the new schemas are wired through index.ts
import {
  CoverageHistoryResponseSchema as BarrelCoverageHistoryResponseSchema,
  CoverageCellDriftSchema as BarrelCoverageCellDriftSchema,
  SkillDriftResponseSchema as BarrelSkillDriftResponseSchema,
} from '../index.js'

describe('SkillDriftCellSchema', () => {
  it('parses { present: true, version: "1.2.3", lastModifiedIso: <iso> }', () => {
    expect(() =>
      SkillDriftCellSchema.parse({
        present: true,
        version: '1.2.3',
        lastModifiedIso: '2026-05-16T10:00:00.000Z',
      })
    ).not.toThrow()
  })

  it('parses absent skill { present: false, version: null, lastModifiedIso: null }', () => {
    expect(() =>
      SkillDriftCellSchema.parse({
        present: false,
        version: null,
        lastModifiedIso: null,
      })
    ).not.toThrow()
  })

  it('parses present-but-no-version { present: true, version: null, lastModifiedIso: null }', () => {
    expect(() =>
      SkillDriftCellSchema.parse({
        present: true,
        version: null,
        lastModifiedIso: null,
      })
    ).not.toThrow()
  })

  it('rejects non-ISO lastModifiedIso', () => {
    expect(
      SkillDriftCellSchema.safeParse({
        present: true,
        version: '1.0',
        lastModifiedIso: 'not-a-date',
      }).success
    ).toBe(false)
  })
})

describe('SkillDriftRowSchema', () => {
  it('parses a row with one project entry', () => {
    expect(() =>
      SkillDriftRowSchema.parse({
        skillId: 'agenticapps-workflow',
        byProject: {
          p1: {
            present: true,
            version: '1.0',
            lastModifiedIso: '2026-05-16T10:00:00.000Z',
          },
        },
      })
    ).not.toThrow()
  })

  it('parses empty byProject {}', () => {
    expect(() =>
      SkillDriftRowSchema.parse({
        skillId: 'agenticapps-workflow',
        byProject: {},
      })
    ).not.toThrow()
  })
})

describe('SkillDriftResponseSchema', () => {
  const baseResponse = {
    schemaVersion: 1 as const,
    generatedAtIso: '2026-05-16T13:00:00.000Z',
    projects: [
      {
        projectId: 'p1',
        projectName: 'agenticapps-dashboard',
        family: 'agenticapps' as const,
      },
    ],
    rows: [
      {
        skillId: 'agenticapps-workflow',
        byProject: {
          p1: {
            present: true,
            version: '1.0',
            lastModifiedIso: '2026-05-16T10:00:00.000Z',
          },
        },
      },
    ],
  }

  it('parses a valid response with 1 project + 1 row', () => {
    expect(() => SkillDriftResponseSchema.parse(baseResponse)).not.toThrow()
  })

  it("accepts family: 'agenticapps'", () => {
    const r = {
      ...baseResponse,
      projects: [{ ...baseResponse.projects[0], family: 'agenticapps' as const }],
    }
    expect(() => SkillDriftResponseSchema.parse(r)).not.toThrow()
  })

  it("accepts family: 'factiv'", () => {
    const r = {
      ...baseResponse,
      projects: [{ ...baseResponse.projects[0], family: 'factiv' as const }],
    }
    expect(() => SkillDriftResponseSchema.parse(r)).not.toThrow()
  })

  it("accepts family: 'neuroflash'", () => {
    const r = {
      ...baseResponse,
      projects: [{ ...baseResponse.projects[0], family: 'neuroflash' as const }],
    }
    expect(() => SkillDriftResponseSchema.parse(r)).not.toThrow()
  })

  it("accepts family: 'other' (fallback for off-family registrations)", () => {
    const r = {
      ...baseResponse,
      projects: [{ ...baseResponse.projects[0], family: 'other' as const }],
    }
    expect(() => SkillDriftResponseSchema.parse(r)).not.toThrow()
  })

  it("rejects family: 'unknown' (off-enum)", () => {
    const r = {
      ...baseResponse,
      projects: [
        { ...baseResponse.projects[0], family: 'unknown' as unknown as 'other' },
      ],
    }
    expect(SkillDriftResponseSchema.safeParse(r).success).toBe(false)
  })

  it('degraded is optional on project entries', () => {
    // Same as base — verifies no degraded field still parses
    expect(() => SkillDriftResponseSchema.parse(baseResponse)).not.toThrow()
  })

  it("parses degraded: 'ENOENT scanning .claude/skills/' (string error message)", () => {
    const r = {
      ...baseResponse,
      projects: [
        {
          ...baseResponse.projects[0],
          degraded: 'ENOENT scanning .claude/skills/',
        },
      ],
    }
    expect(() => SkillDriftResponseSchema.parse(r)).not.toThrow()
  })

  it('rejects schemaVersion: 2 (literal-1 contract)', () => {
    const bad = { ...baseResponse, schemaVersion: 2 as unknown as 1 }
    expect(SkillDriftResponseSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects generatedAtIso: 'not-iso'", () => {
    const bad = { ...baseResponse, generatedAtIso: 'not-iso' }
    expect(SkillDriftResponseSchema.safeParse(bad).success).toBe(false)
  })
})

describe('barrel re-exports (@agenticapps/dashboard-shared)', () => {
  it('exports CoverageHistoryResponseSchema via barrel', () => {
    expect(BarrelCoverageHistoryResponseSchema).toBeDefined()
    expect(typeof BarrelCoverageHistoryResponseSchema.parse).toBe('function')
  })

  it('exports SkillDriftResponseSchema via barrel', () => {
    expect(BarrelSkillDriftResponseSchema).toBeDefined()
    expect(typeof BarrelSkillDriftResponseSchema.parse).toBe('function')
  })

  it('exports CoverageCellDriftSchema via barrel (for downstream prop typing)', () => {
    expect(BarrelCoverageCellDriftSchema).toBeDefined()
    expect(typeof BarrelCoverageCellDriftSchema.parse).toBe('function')
  })
})
