/**
 * CoverageDriftBadge.test.tsx — text-only inline drift badge (Plan 11-04 / D-11-03).
 *
 * Phase 11 chose an inline text indicator (▲Nd / ▼Nd) over a sparkline / SVG
 * primitive to preserve the matrix's calm aesthetic and work on touch.
 *
 * CRITICAL: name MUST NOT collide with the Phase 6 schema-drift panel at
 * packages/spa/src/components/panels/InlineDrift.tsx. The chosen name is
 * CoverageDriftBadge per CONTEXT D-11-03 and the plan's must_haves.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { CoverageDriftBadge } from './CoverageDriftBadge.js'

describe('CoverageDriftBadge', () => {
  it('B1: direction="up", daysSince=3 → renders text "▲3d"', () => {
    render(<CoverageDriftBadge direction="up" daysSince={3} />)
    expect(screen.getByText('▲3d')).toBeTruthy()
  })

  it('B2: direction="down", daysSince=7 → renders text "▼7d"', () => {
    render(<CoverageDriftBadge direction="down" daysSince={7} />)
    expect(screen.getByText('▼7d')).toBeTruthy()
  })

  it('B3: direction="up" applies text-status-success token', () => {
    const { container } = render(<CoverageDriftBadge direction="up" daysSince={3} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-status-success')
  })

  it('B4: direction="down" applies text-status-error token', () => {
    const { container } = render(<CoverageDriftBadge direction="down" daysSince={5} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-status-error')
  })

  it('B5: aria-label for direction="up", daysSince=1 reads "Improved 1 day ago" (singular)', () => {
    render(<CoverageDriftBadge direction="up" daysSince={1} />)
    expect(screen.getByLabelText('Improved 1 day ago')).toBeTruthy()
  })

  it('B6: aria-label for direction="up", daysSince=3 reads "Improved 3 days ago" (plural)', () => {
    render(<CoverageDriftBadge direction="up" daysSince={3} />)
    expect(screen.getByLabelText('Improved 3 days ago')).toBeTruthy()
  })

  it('B7: aria-label for direction="down", daysSince=2 reads "Regressed 2 days ago"', () => {
    render(<CoverageDriftBadge direction="down" daysSince={2} />)
    expect(screen.getByLabelText('Regressed 2 days ago')).toBeTruthy()
  })

  it('B8: badge uses text-xs font-semibold for visual weight', () => {
    const { container } = render(<CoverageDriftBadge direction="up" daysSince={1} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-xs')
    expect(badge?.className).toContain('font-semibold')
  })

  it('B9: component does NOT emit any hex literal (verified via grep at the file level)', async () => {
    // Source-level guard: read the component file and verify no hex literals.
    // Token namespace lock (D-5.1-10) — all colors live in tokens.css.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await fs.readFile(
      path.resolve(
        process.cwd(),
        'src/components/panels/coverage/CoverageDriftBadge.tsx',
      ),
      'utf8',
    )
    const hexMatches = source.match(/#[0-9a-fA-F]{3,8}\b/g)
    expect(hexMatches).toBeNull()
  })
})
