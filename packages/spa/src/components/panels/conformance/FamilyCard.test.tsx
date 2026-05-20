/**
 * FamilyCard.test.tsx — per-family conformance card (Plan 12-03 / D-12-04).
 *
 * Renders: family name + score (0-100 integer) + 14d delta with up/down glyph
 * + tier pill colored via tierOf() → status tokens (Phase 5.1).
 *
 * Tests cover:
 * - family name rendering
 * - score display
 * - tier pill class per tier boundary (≥90 green, 70-89 amber, <70 red)
 * - delta14d glyph: up-arrow (text-status-success), down-arrow (text-status-error),
 *   em-dash for 0 (no glyph)
 * - SECURITY: no hex literals; no dangerous-inner-html prop (T-12-XSS)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { FamilyCard } from './FamilyCard.js'

// Assembled to avoid scanner hits on the test file itself.
const DANGEROUS_INNER_HTML = `dangerously${'Set'}InnerHTML`

describe('FamilyCard', () => {
  it('F1: renders family name', () => {
    render(<FamilyCard family="agenticapps" score={92} delta14d={3} />)
    expect(screen.getByText(/agenticapps/i)).toBeTruthy()
  })

  it('F2: renders score as a number (0-100 integer)', () => {
    render(<FamilyCard family="factiv" score={87} delta14d={2} />)
    expect(screen.getByText(/87/)).toBeTruthy()
  })

  it('F3: tier pill applies status-success class when score >= 90 (green)', () => {
    const { container } = render(<FamilyCard family="agenticapps" score={90} delta14d={0} />)
    const html = container.innerHTML
    expect(html).toMatch(/status-success/)
  })

  it('F4: tier pill applies status-warning class when 70 <= score < 90 (amber)', () => {
    const { container } = render(<FamilyCard family="factiv" score={85} delta14d={0} />)
    const html = container.innerHTML
    expect(html).toMatch(/status-warning/)
  })

  it('F5: tier pill applies status-error class when score < 70 (red)', () => {
    const { container } = render(<FamilyCard family="neuroflash" score={45} delta14d={-5} />)
    const html = container.innerHTML
    expect(html).toMatch(/status-error/)
  })

  it('F6: renders up-arrow + N for positive delta14d (text-status-success)', () => {
    const { container } = render(<FamilyCard family="agenticapps" score={88} delta14d={4} />)
    expect(screen.getByText(/▲/)).toBeTruthy()
    expect(screen.getByText(/4/)).toBeTruthy()
    // delta wrapper carries text-status-success
    const html = container.innerHTML
    expect(html).toMatch(/text-status-success/)
  })

  it('F7: renders down-arrow + N for negative delta14d (text-status-error)', () => {
    const { container } = render(<FamilyCard family="agenticapps" score={88} delta14d={-3} />)
    expect(screen.getByText(/▼/)).toBeTruthy()
    // Displays absolute value 3 (not -3)
    expect(screen.getByText(/3/)).toBeTruthy()
    expect(container.innerHTML).toMatch(/text-status-error/)
  })

  it('F8: renders em-dash for delta14d 0 (no arrow glyph)', () => {
    render(<FamilyCard family="agenticapps" score={92} delta14d={0} />)
    expect(screen.getByText(/—/)).toBeTruthy()
    expect(screen.queryByText(/▲/)).toBeNull()
    expect(screen.queryByText(/▼/)).toBeNull()
  })

  it('F9: SECURITY — file emits no hex literal (Phase 11.1 token-namespace lock)', async () => {
    const source = await loadSource('src/components/panels/conformance/FamilyCard.tsx')
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })

  it('F10: SECURITY — file does NOT contain the dangerous inner-html prop (T-12-XSS)', async () => {
    const source = await loadSource('src/components/panels/conformance/FamilyCard.tsx')
    expect(source.includes(DANGEROUS_INNER_HTML)).toBe(false)
  })
})

async function loadSource(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.resolve(process.cwd(), 'packages/spa', rel),
  ]
  for (const c of candidates) {
    try {
      return await fs.readFile(c, 'utf8')
    } catch {
      // try next candidate
    }
  }
  throw new Error(`loadSource: cannot locate ${rel} (cwd=${process.cwd()})`)
}
