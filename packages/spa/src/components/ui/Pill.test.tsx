/**
 * Pill.test.tsx — TDD tests for Pill UI primitive.
 *
 * Tests P1–P4:
 * P1: the emphasis variants each map to a unique class string, and no variant
 *     names a state (see the second test for why)
 * P2: default variant is 'neutral' when omitted
 * P3: renders with rounded-md class (6px radius per UI-SPEC §4)
 * P4: tabular-nums NOT applied (numbers are handled by MetricNumeric)
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { Pill, VARIANT_CLASSES, type PillVariant } from './Pill.js'

describe('Pill', () => {
  it('P1: the variants each produce a distinct className combination', () => {
    const variants: PillVariant[] = ['neutral', 'accent']
    const classNames = variants.map((v) => {
      const { container } = render(<Pill variant={v}>label</Pill>)
      const span = container.querySelector('span')!
      return span.className
    })
    const unique = new Set(classNames)
    expect(unique.size).toBe(variants.length)
  })

  it('offers no variant that names a state, so no caller can signal one by hue alone', () => {
    // `design-system` → State Is Never Signalled By Colour Alone.
    //
    // Pill carried `success`, `warning` and `error` variants whose only
    // difference from `neutral` was the text hue: identical background, no
    // glyph, no shape, no border. Nothing in the product ever rendered them —
    // `neutral` is the sole caller — so the requirement was never actually
    // violated on screen. What existed was a primitive that made violating it
    // a one-word change, with P1 above locking the arrangement in as "5
    // variants each produce a distinct className".
    //
    // A pill that carries a state needs a glyph, as ChangeCard's badge has and
    // as the six readiness cells have. Until something needs one, the safest
    // version of this component is the one that cannot express a state at all,
    // so the three are removed rather than decorated for callers that do not
    // exist. This test is what stops them coming back unaccompanied.
    expect(Object.keys(VARIANT_CLASSES).sort()).toEqual(['accent', 'neutral'])
  })

  it('P2: default variant is "neutral" when omitted', () => {
    const { container: withDefault } = render(<Pill>neutral</Pill>)
    const { container: withExplicit } = render(<Pill variant="neutral">neutral</Pill>)
    expect(withDefault.querySelector('span')!.className).toBe(
      withExplicit.querySelector('span')!.className,
    )
  })

  it('P3: renders with rounded-md class (pill radius per UI-SPEC §4)', () => {
    render(<Pill>tag</Pill>)
    const span = screen.getByText('tag')
    expect(span.className).toContain('rounded-md')
  })

  it('P4: tabular-nums NOT applied to Pill (that is MetricNumeric territory)', () => {
    render(<Pill>42</Pill>)
    const span = screen.getByText('42')
    expect(span.className).not.toContain('tabular-nums')
  })
})
