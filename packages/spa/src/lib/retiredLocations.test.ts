/**
 * retiredLocations.test.ts — the one explicit migration manifest.
 *
 * `Retired Locations Have An Explicit Transition` (project-dashboard, retire-v1-surfaces):
 * five retired locations resolve to the fleet, `/projects/:id` keeps its identifier
 * and resolves to `/repos/:id`, and everything else is unknown. The rule is
 * enumerated deliberately — a wildcard over `/projects/:id/*` would redirect
 * invented paths the product never served instead of returning not-found.
 */
import { describe, it, expect } from 'vitest'

import { resolveRetiredLocation } from './retiredLocations.js'

describe('resolveRetiredLocation', () => {
  it('resolves the bare origin to the fleet', () => {
    expect(resolveRetiredLocation('/')).toBe('/fleet')
  })

  it.each([
    '/coverage',
    '/observability/skill-drift',
    '/observability/conformance',
    '/code-intelligence',
  ])('resolves the retired surface %s to the fleet', (location) => {
    expect(resolveRetiredLocation(location)).toBe('/fleet')
  })

  it('keeps the repo identifier a per-project location already carries', () => {
    expect(resolveRetiredLocation('/projects/agenticapps-dashboard')).toBe(
      '/repos/agenticapps-dashboard',
    )
  })

  it('does not redirect an invented per-project sub-path', () => {
    expect(resolveRetiredLocation('/projects/some-repo/coverage')).toBeNull()
  })

  it('returns null for a location the product never served', () => {
    expect(resolveRetiredLocation('/nonsense')).toBeNull()
  })

  it('does not treat a surviving surface as retired', () => {
    expect(resolveRetiredLocation('/fleet')).toBeNull()
    expect(resolveRetiredLocation('/settings')).toBeNull()
  })
})
