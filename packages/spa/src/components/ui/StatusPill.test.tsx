/**
 * StatusPill.test.tsx — TDD tests for StatusPill UI primitive.
 *
 * Tests SP1–SP2:
 * SP1: renders {label} separator {value}; both segments visible
 * SP2: optional accent variant applies bg-accent-bg + text-accent classes
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { StatusPill } from './StatusPill.js'

describe('StatusPill', () => {
  it('SP1: renders label and value text segments', () => {
    render(<StatusPill label="Phase" value="5 · 87%" />)
    // The component renders label and value in the DOM (separator may be aria-hidden)
    expect(screen.getByText(/Phase/)).toBeDefined()
    expect(screen.getByText(/87%/)).toBeDefined()
  })

  it('SP2: accent variant applies bg-accent-bg and text-accent classes', () => {
    const { container } = render(<StatusPill label="Status" value="Active" accent />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('bg-accent-bg')
    expect(root.className).toContain('text-accent')
  })
})
