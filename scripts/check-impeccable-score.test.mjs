import { describe, it, expect } from 'vitest'
import { checkImpeccableScore } from './check-impeccable-score.mjs'

describe('checkImpeccableScore', () => {
  const allPassing = {
    routes: [
      { route: '/', breakpoint: '1440x900', score: 92, subScores: { color: 95, typography: 90 } },
      { route: '/projects/:id', breakpoint: '1440x900', score: 91, subScores: { color: 90, layout: 92 } },
    ],
  }
  const oneFailing = {
    routes: [
      { route: '/', breakpoint: '1440x900', score: 92, subScores: { color: 95 } },
      { route: '/projects/:id', breakpoint: '1440x900', score: 84, subScores: { color: 78, layout: 90 } },
    ],
  }
  const malformedNoRoutes = { foo: 'bar' }
  const malformedNoScore = { routes: [{ route: '/', breakpoint: '1440x900', subScores: {} }] }

  it('exitCode 0 when all routes pass threshold', () => {
    const r = checkImpeccableScore(allPassing)
    expect(r.exitCode).toBe(0)
    expect(r.pass).toBe(true)
  })
  it('exitCode 1 when any route fails threshold', () => {
    const r = checkImpeccableScore(oneFailing)
    expect(r.exitCode).toBe(1)
    expect(r.pass).toBe(false)
    expect(r.failingRoutes).toHaveLength(1)
    expect(r.failingRoutes[0].route).toBe('/projects/:id')
  })
  it('exitCode 2 when routes array is missing', () => {
    const r = checkImpeccableScore(malformedNoRoutes)
    expect(r.exitCode).toBe(2)
  })
  it('exitCode 2 when a route entry is missing score field', () => {
    const r = checkImpeccableScore(malformedNoScore)
    expect(r.exitCode).toBe(2)
  })
  it('summary contains markdown table for PR comment use', () => {
    const r = checkImpeccableScore(allPassing)
    expect(r.summary).toContain('| Route |')
    expect(r.summary).toContain('Threshold:')
  })
  it('summary lists failing sub-scores below 90 when route fails', () => {
    const r = checkImpeccableScore(oneFailing)
    expect(r.summary).toContain('Color: 78')
  })
  it('respects custom threshold parameter', () => {
    const r = checkImpeccableScore(oneFailing, 80)
    expect(r.exitCode).toBe(0) // 84 >= 80
  })

  // F-009: defensive gate hardening — without this, a workflow runner crash
  // that produces an empty routes[] array would silently pass the gate.
  describe('expectedRoutes vacuous-pass guard (F-009)', () => {
    it('exitCode 2 when expectedRoutes is set but routes is empty', () => {
      const r = checkImpeccableScore({ routes: [] }, 87, { expectedRoutes: 6 })
      expect(r.exitCode).toBe(2)
      expect(r.summary).toContain('MALFORMED REPORT')
      expect(r.summary).toMatch(/expected 6.*got 0|got 0.*expected 6/i)
    })
    it('exitCode 2 when expectedRoutes mismatches actual count', () => {
      const r = checkImpeccableScore(allPassing, 87, { expectedRoutes: 6 })
      // allPassing has 2 routes; expecting 6
      expect(r.exitCode).toBe(2)
      expect(r.summary).toContain('MALFORMED REPORT')
    })
    it('exitCode 0 when expectedRoutes matches and all routes pass', () => {
      const r = checkImpeccableScore(allPassing, 87, { expectedRoutes: 2 })
      expect(r.exitCode).toBe(0)
    })
    it('exitCode 1 (not 2) when count matches but score fails', () => {
      const r = checkImpeccableScore(oneFailing, 87, { expectedRoutes: 2 })
      expect(r.exitCode).toBe(1) // count is fine; one route's score is low
    })
    it('omitting expectedRoutes preserves legacy behavior (no count gate)', () => {
      const r = checkImpeccableScore(allPassing) // no opts
      expect(r.exitCode).toBe(0)
    })
  })
})
