/**
 * Tests for coverageHistory.ts — Zod schemas for /api/coverage/history (Phase 11).
 *
 * Wire-contract invariants:
 * - PD-11-02: bulk-per-repo shape — ONE response carries drift for ALL FOUR cells
 *   of one repo (claudeMd / gitNexus / wiki / workflowVersion). No per-(repo, cell)
 *   discriminator anywhere.
 * - D-11-01: 14-day rolling retention window — `windowDays: z.literal(14)` forces
 *   a deliberate schema bump (schemaVersion: 2) before the window can change.
 * - D-11-12: new sibling schema file (does NOT widen coverage.ts).
 * - INV-04: schema validation is the single point of contract verification across
 *   the trust boundary; tests exercise the Zod schemas directly with no mocks.
 *
 * Component-name-collision guard (D-11-03): the inline drift surface in the SPA
 * is named `CoverageDriftBadge` (NOT `InlineDrift`, which is Phase 6's schema-drift
 * panel). The schema itself doesn't name the component — only direction + daysSince.
 */

import { describe, expect, it } from 'vitest'
import {
  CoverageDriftDirectionSchema,
  CoverageCellDriftSchema,
  CoverageHistoryResponseSchema,
} from './coverageHistory.js'

describe('CoverageDriftDirectionSchema', () => {
  it('accepts "up"', () => {
    expect(CoverageDriftDirectionSchema.parse('up')).toBe('up')
  })

  it('accepts "down"', () => {
    expect(CoverageDriftDirectionSchema.parse('down')).toBe('down')
  })

  it('rejects unknown direction', () => {
    expect(CoverageDriftDirectionSchema.safeParse('sideways').success).toBe(false)
  })
})

describe('CoverageCellDriftSchema', () => {
  it('parses { direction: "up", daysSince: 3 }', () => {
    expect(() =>
      CoverageCellDriftSchema.parse({ direction: 'up', daysSince: 3 })
    ).not.toThrow()
  })

  it('parses { direction: "down", daysSince: 0 } (transition today)', () => {
    expect(() =>
      CoverageCellDriftSchema.parse({ direction: 'down', daysSince: 0 })
    ).not.toThrow()
  })

  it('parses { direction: null, daysSince: null } (no transition)', () => {
    expect(() =>
      CoverageCellDriftSchema.parse({ direction: null, daysSince: null })
    ).not.toThrow()
  })

  it('parses direction=up with daysSince=null (schema permits — reader enforces runtime contract)', () => {
    expect(() =>
      CoverageCellDriftSchema.parse({ direction: 'up', daysSince: null })
    ).not.toThrow()
  })

  it('parses direction=null with daysSince=3 (schema permits)', () => {
    expect(() =>
      CoverageCellDriftSchema.parse({ direction: null, daysSince: 3 })
    ).not.toThrow()
  })

  it('rejects negative daysSince', () => {
    expect(
      CoverageCellDriftSchema.safeParse({ direction: 'up', daysSince: -1 }).success
    ).toBe(false)
  })

  it('rejects non-integer daysSince', () => {
    expect(
      CoverageCellDriftSchema.safeParse({ direction: 'up', daysSince: 3.5 }).success
    ).toBe(false)
  })
})

describe('CoverageHistoryResponseSchema (bulk-per-repo, PD-11-02)', () => {
  const validResponse = {
    schemaVersion: 1 as const,
    repoId: 'agenticapps/agenticapps-dashboard',
    windowDays: 14 as const,
    cells: {
      claudeMd: { direction: 'up' as const, daysSince: 3 },
      gitNexus: { direction: null, daysSince: null },
      wiki: { direction: 'down' as const, daysSince: 1 },
      workflowVersion: { direction: null, daysSince: null },
    },
  }

  it('parses a valid bulk response with all four cells', () => {
    expect(() => CoverageHistoryResponseSchema.parse(validResponse)).not.toThrow()
  })

  it('rejects response missing one of the four cells', () => {
    const { gitNexus: _gitNexus, ...rest } = validResponse.cells
    const bad = { ...validResponse, cells: rest }
    expect(CoverageHistoryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects response with extra cell key', () => {
    const bad = {
      ...validResponse,
      cells: {
        ...validResponse.cells,
        foo: { direction: null, daysSince: null },
      },
    }
    expect(CoverageHistoryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects schemaVersion: 2 (literal-1 contract)', () => {
    const bad = { ...validResponse, schemaVersion: 2 as unknown as 1 }
    expect(CoverageHistoryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects windowDays: 30 (D-11-01 locks 14d)', () => {
    const bad = { ...validResponse, windowDays: 30 as unknown as 14 }
    expect(CoverageHistoryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing repoId', () => {
    const { repoId: _repoId, ...rest } = validResponse
    expect(CoverageHistoryResponseSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty repoId', () => {
    const bad = { ...validResponse, repoId: '' }
    expect(CoverageHistoryResponseSchema.safeParse(bad).success).toBe(false)
  })
})
