/**
 * Pill.test.tsx — TDD tests for Pill UI primitive.
 *
 * Tests P1–P4:
 * P1: 5 variants each map to a unique class string from VARIANT_CLASSES lookup
 * P2: default variant is 'neutral' when omitted
 * P3: renders with rounded-md class (6px radius per UI-SPEC §4)
 * P4: tabular-nums NOT applied (numbers are handled by MetricNumeric)
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { Pill, type PillVariant } from './Pill.js'

describe('Pill', () => {
  it('P1: 5 variants each produce a distinct className combination', () => {
    const variants: PillVariant[] = ['neutral', 'accent', 'success', 'warning', 'error']
    const classNames = variants.map((v) => {
      const { container } = render(<Pill variant={v}>label</Pill>)
      const span = container.querySelector('span')!
      return span.className
    })
    // All 5 class strings must be unique
    const unique = new Set(classNames)
    expect(unique.size).toBe(5)
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
