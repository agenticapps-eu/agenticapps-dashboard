/**
 * Plan 07-03 Task 1 — WidgetStub primitive unit tests.
 *
 * Source: ~/Documents/.../widgets/_stub-pattern.tsx lines 26-44 (WidgetStub component only).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { WidgetStub } from './_stub-pattern'

describe('WidgetStub primitive', () => {
  it('renders the title and description', () => {
    render(<WidgetStub title="Test widget" description="A widget for testing." />)
    expect(screen.getByRole('heading', { name: /Test widget/ })).toBeInTheDocument()
    expect(screen.getByText('A widget for testing.')).toBeInTheDocument()
  })

  it('renders the emoji with role="img" and aria-label="placeholder"', () => {
    render(<WidgetStub title="X" description="Y" emoji="🔬" />)
    const emoji = screen.getByRole('img', { name: 'placeholder' })
    expect(emoji).toHaveTextContent('🔬')
  })

  it('uses default emoji ✨ when none is provided', () => {
    render(<WidgetStub title="X" description="Y" />)
    expect(screen.getByRole('img', { name: 'placeholder' })).toHaveTextContent('✨')
  })

  it('shows the "Coming v1.2" badge', () => {
    render(<WidgetStub title="X" description="Y" />)
    expect(screen.getByText(/coming v1\.2/i)).toBeInTheDocument()
  })

  it('uses not-prose to escape MDX prose styles', () => {
    const { container } = render(<WidgetStub title="X" description="Y" />)
    expect(container.querySelector('.not-prose')).toBeInTheDocument()
  })
})
