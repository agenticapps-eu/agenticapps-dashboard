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

  /**
   * The router matches paths case-insensitively and tolerates trailing
   * slashes, and hands `beforeLoad` the pathname the visitor typed rather than
   * the one it matched. A manifest keyed exactly would disown spellings the
   * router had already accepted, and the retired route they landed on has no
   * component — so the answer was a blank shell.
   */
  describe('the spellings the router accepts', () => {
    it.each(['/coverage/', '/COVERAGE', '/Coverage/', '/coverage//'])(
      'resolves %s to the fleet',
      (location) => {
        expect(resolveRetiredLocation(location)).toBe('/fleet')
      },
    )

    it('resolves the origin with its slash stripped back to the origin, not to nothing', () => {
      expect(resolveRetiredLocation('//')).toBe('/fleet')
    })

    it.each(['/projects/dashboard/', '/PROJECTS/dashboard'])(
      'resolves %s to the repo detail surface',
      (location) => {
        expect(resolveRetiredLocation(location)).toBe('/repos/dashboard')
      },
    )

    it('folds the case of the location, never of the identifier it carries', () => {
      // The identifier is data. Folding it would send a bookmark for `MyRepo`
      // to a repo that may not exist and turn a working deep link into the
      // detail surface's not-found state.
      expect(resolveRetiredLocation('/Projects/MyRepo')).toBe('/repos/MyRepo')
    })

    it('still refuses a sub-path the product never served, in any spelling', () => {
      expect(resolveRetiredLocation('/projects/some-repo/coverage')).toBeNull()
      expect(resolveRetiredLocation('/PROJECTS/some-repo/coverage/')).toBeNull()
    })
  })
})
