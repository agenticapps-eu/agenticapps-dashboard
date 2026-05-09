/**
 * CardHeader.test.tsx — TDD tests for CardHeader UI primitive.
 *
 * Tests CH1–CH5:
 * CH1: renders icon (ReactNode) and label as <h2>
 * CH2: applies titleId prop as id on the <h2>
 * CH3: when helper present and action absent → renders helper text right-aligned
 * CH4: when action present → renders action right-aligned, helper hidden
 * CH5: <h2> has text-lg + font-semibold + text-text-primary classes
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { CardHeader } from './CardHeader.js'

describe('CardHeader', () => {
  it('CH1: renders icon (ReactNode) and label as <h2>', () => {
    render(
      <CardHeader
        icon={<span data-testid="icon">★</span>}
        label="My Panel"
      />,
    )
    expect(screen.getByTestId('icon')).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'My Panel' })).toBeDefined()
  })

  it('CH2: applies titleId prop as id on the <h2>', () => {
    render(<CardHeader label="Skills" titleId="skills-title" />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Skills' })
    expect(heading.id).toBe('skills-title')
  })

  it('CH3: when helper present and action absent → renders helper text right-aligned', () => {
    render(<CardHeader label="Health" helper="updated 3s ago" />)
    expect(screen.getByText('updated 3s ago')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('CH4: when action present → renders action right-aligned, helper not rendered', () => {
    render(
      <CardHeader
        label="Reviews"
        helper="should not show"
        action={<button type="button">Retry</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
    // helper is hidden when action is present
    expect(screen.queryByText('should not show')).toBeNull()
  })

  it('CH5: <h2> has text-lg + font-semibold + text-text-primary classes', () => {
    render(<CardHeader label="Timeline" />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Timeline' })
    expect(heading.className).toContain('text-lg')
    expect(heading.className).toContain('font-semibold')
    expect(heading.className).toContain('text-text-primary')
  })
})
