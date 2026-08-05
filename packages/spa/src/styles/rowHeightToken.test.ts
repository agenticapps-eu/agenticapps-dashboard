// @vitest-environment node
/**
 * rowHeightToken.test.ts — the static half of `design-system` → **Dense Rows
 * And Aligned Figures**, as modified by `retire-v1-surfaces`.
 *
 * The requirement's density clause has three parts, and an earlier draft failed
 * on the first two: it asked for "a maximum height per row in CSS pixels" and
 * then declared no number anywhere, leaving a scenario that asserts a row is
 * "at or below the declared maximum" with nothing to compare against. The
 * modified text fixes both — the maximum SHALL be `3.5rem`, SHALL be declared
 * as a design token, and SHALL be expressed in `rem` rather than CSS pixels.
 *
 * Each of those three is a separate case here, because they fail separately:
 * a hard-coded `h-14` satisfies the number while declaring no token, and a
 * `--row-height-max: 56px` satisfies the token while breaking the unit.
 *
 * **The unit is the substantive half.** A cap fixed in pixels is a requirement
 * to clip text when a user enlarges it, which collides with the reflow
 * guarantee the product owes. In `rem` the row grows with the user's font size,
 * so the cap scales with the text it contains — which is what makes the
 * "enlarged text is not a conformance failure" scenario satisfiable at all.
 *
 * What this file deliberately does NOT do is measure. Height is a rendered
 * property and jsdom applies no stylesheet, so the measurement the requirement
 * calls for — one row, at the 1440x900 reference viewport — belongs in a real
 * browser and is recorded in the change's tasks. This file holds the half that
 * a static check can hold honestly: that the token exists, carries the right
 * value in the right unit, and that the fleet's row is actually bound to it
 * rather than to a coincidentally-equal Tailwind default.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const TOKENS_FILE = resolve(STYLES_DIR, 'tokens.css')
const FLEET_PAGE = resolve(
  STYLES_DIR,
  '..',
  'components',
  'panels',
  'readiness',
  'FleetPage.tsx',
)

/**
 * The declared row-height maximum, read out of the token file rather than
 * restated here — same contract typographyTokens.test.ts holds for the type
 * scale, so the token file stays the single source of truth and the two cannot
 * drift into disagreeing.
 */
function declaredRowMax(): string | null {
  const css = readFileSync(TOKENS_FILE, 'utf8')
  return /--spacing-row-max:\s*([^;]+);/.exec(css)?.[1].trim() ?? null
}

describe('design-system → Dense Rows And Aligned Figures (the declared maximum)', () => {
  it('declares a row-height maximum as a design token', () => {
    // Without this the requirement's own scenario is unverifiable: "at or below
    // the declared maximum" needs something to have declared one.
    expect(declaredRowMax()).not.toBeNull()
  })

  it('expresses the maximum in rem rather than CSS pixels', () => {
    // The substantive half. `56px` would satisfy every other case in this file
    // and still be wrong, because it caps the row below the text it contains
    // as soon as the reader enlarges that text.
    expect(declaredRowMax()).toMatch(/^\d+(\.\d+)?rem$/)
  })

  it('sets the maximum to 3.5rem', () => {
    // The height the fleet table already ships. The constraint records the
    // density that exists rather than imposing a restyling this change does
    // not otherwise call for.
    expect(declaredRowMax()).toBe('3.5rem')
  })
})

describe('design-system → Dense Rows And Aligned Figures (the row is bound to it)', () => {
  it('sizes the fleet row from the token, not from an equal-by-coincidence default', () => {
    // `h-14` measures 3.5rem too, so a browser measurement passes either way.
    // What it cannot tell you is whether the row is *bound* to the declared
    // maximum or merely happens to match it today — and an unbound row drifts
    // the moment someone edits one of the two numbers.
    const source = readFileSync(FLEET_PAGE, 'utf8')

    expect(source).toContain('h-row-max')
    expect(source).not.toContain('h-14')
  })
})
