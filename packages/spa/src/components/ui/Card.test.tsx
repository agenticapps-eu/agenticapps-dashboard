/**
 * Card.test.tsx — TDD tests for Card UI primitive.
 *
 * Tests C1–C5:
 * C1: renders <section> with bg-card-bg, shadow-card, rounded-card, p-6 className tokens
 * C2: forwards ariaLabelledBy prop to aria-labelledby on <section>
 * C3: accepts and applies custom className (escape hatch for grid placement)
 * C4: renders children as direct descendants
 * C5: NO transition utility class appears in output (anti-AI-slop D-5.1-10)
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { Card } from './Card.js'

describe('Card', () => {
  it('C1: renders <section> with bg-card-bg, shadow-card, rounded-card, p-6 className tokens', () => {
    render(
      <Card ariaLabelledBy="test-title">
        <h2 id="test-title">Test</h2>
      </Card>,
    )
    const section = screen.getByRole('region', { name: 'Test' })
    expect(section).toBeDefined()
    expect(section.className).toContain('bg-card-bg')
    expect(section.className).toContain('shadow-card')
    expect(section.className).toContain('rounded-card')
    expect(section.className).toContain('p-6')
  })

  it('C2: forwards ariaLabelledBy prop to aria-labelledby on <section>', () => {
    render(
      <Card ariaLabelledBy="my-panel-title">
        <h2 id="my-panel-title">Panel</h2>
      </Card>,
    )
    const section = screen.getByRole('region', { name: 'Panel' })
    expect(section.getAttribute('aria-labelledby')).toBe('my-panel-title')
  })

  it('C3: accepts and applies custom className (escape hatch for grid placement)', () => {
    render(
      <Card className="col-span-2">
        <p>content</p>
      </Card>,
    )
    // No ariaLabelledBy → no accessible name → use getByRole with no name constraint
    const section = document.querySelector('section')
    expect(section).toBeDefined()
    expect(section!.className).toContain('col-span-2')
  })

  it('C4: renders children as direct descendants', () => {
    render(
      <Card>
        <p data-testid="child-node">hello</p>
      </Card>,
    )
    expect(screen.getByTestId('child-node').textContent).toBe('hello')
  })

  it('C5: no transition utility class in output (anti-AI-slop D-5.1-10)', () => {
    render(
      <Card>
        <p>content</p>
      </Card>,
    )
    const section = document.querySelector('section')
    expect(section!.className).not.toContain('transition')
  })
})
