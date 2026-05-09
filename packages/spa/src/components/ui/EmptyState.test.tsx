/**
 * EmptyState.test.tsx — TDD tests for EmptyState UI primitive.
 *
 * Tests ES1–ES3:
 * ES1: renders icon, title, body, optional action
 * ES2: title has text-lg semibold, body has text-base text-text-secondary
 * ES3: omitting action renders no <button>
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { EmptyState } from './EmptyState.js'

describe('EmptyState', () => {
  it('ES1: renders icon, title, body, and optional action', () => {
    render(
      <EmptyState
        icon={<span data-testid="es-icon">⊙</span>}
        title="No skills found"
        body="Register a project to see skills."
        action={<button type="button">Register Project</button>}
      />,
    )
    expect(screen.getByTestId('es-icon')).toBeDefined()
    expect(screen.getByText('No skills found')).toBeDefined()
    expect(screen.getByText('Register a project to see skills.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Register Project' })).toBeDefined()
  })

  it('ES2: title has text-lg + font-semibold; body has text-base + text-text-secondary', () => {
    render(
      <EmptyState
        title="Empty title"
        body="Empty body"
      />,
    )
    const title = screen.getByText('Empty title')
    const body = screen.getByText('Empty body')
    expect(title.className).toContain('text-lg')
    expect(title.className).toContain('font-semibold')
    expect(body.className).toContain('text-base')
    expect(body.className).toContain('text-text-secondary')
  })

  it('ES3: omitting action renders no <button>', () => {
    render(<EmptyState title="Nothing here" body="All clear." />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
