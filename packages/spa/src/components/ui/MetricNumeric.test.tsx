/**
 * MetricNumeric.test.tsx — TDD tests for MetricNumeric UI primitive.
 *
 * Tests MN1–MN3:
 * MN1: renders value + optional suffix + optional label
 * MN2: applies tabular-nums + text-3xl + font-semibold to the value span
 * MN3: when label provided, label is text-text-tertiary text-sm
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { MetricNumeric } from './MetricNumeric.js'

describe('MetricNumeric', () => {
  it('MN1: renders value + optional suffix + optional label', () => {
    render(<MetricNumeric value={92} suffix="%" label="Skill Health" />)
    expect(screen.getByText('92')).toBeDefined()
    expect(screen.getByText('%')).toBeDefined()
    expect(screen.getByText('Skill Health')).toBeDefined()
  })

  it('MN2: value span has tabular-nums + text-3xl + font-semibold classes', () => {
    render(<MetricNumeric value={42} />)
    const valueSpan = screen.getByText('42')
    expect(valueSpan.className).toContain('tabular-nums')
    expect(valueSpan.className).toContain('text-3xl')
    expect(valueSpan.className).toContain('font-semibold')
  })

  it('MN3: label has text-text-tertiary + text-sm classes', () => {
    render(<MetricNumeric value={7} label="tests run" />)
    const label = screen.getByText('tests run')
    expect(label.className).toContain('text-text-tertiary')
    expect(label.className).toContain('text-sm')
  })
})
