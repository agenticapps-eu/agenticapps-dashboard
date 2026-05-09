/**
 * KbdHint.test.tsx — TDD tests for KbdHint UI primitive.
 *
 * Tests K1–K3:
 * K1: renders ⌘K (or default keys) text
 * K2: uses font-mono text-xs + border styling classes
 * K3: aria-hidden="true" (purely decorative)
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { KbdHint } from './KbdHint.js'

describe('KbdHint', () => {
  it('K1: renders default ⌘K hint text', () => {
    render(<KbdHint />)
    expect(screen.getByText('⌘K')).toBeDefined()
  })

  it('K2: uses font-mono + text-xs + border styling classes', () => {
    const { container } = render(<KbdHint />)
    const span = container.querySelector('span')!
    expect(span.className).toContain('font-mono')
    expect(span.className).toContain('text-xs')
    expect(span.className).toContain('border')
  })

  it('K3: aria-hidden="true" (decorative — keyboard shortcut is implied by context)', () => {
    const { container } = render(<KbdHint />)
    const span = container.querySelector('span')!
    expect(span.getAttribute('aria-hidden')).toBe('true')
  })
})
