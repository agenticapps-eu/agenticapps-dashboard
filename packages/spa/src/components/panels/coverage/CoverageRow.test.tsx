/**
 * CoverageRow.test.tsx — Tests for single repo row: 4 cells + override chip + refresh popover.
 *
 * CODEX HIGH-1: absPath NEVER rendered in DOM.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CoverageRow as CoverageRowData } from '@agenticapps/dashboard-shared'
import { CoverageRow } from './CoverageRow.js'

function makeRow(overrides: Partial<CoverageRowData> = {}): CoverageRowData {
  return {
    family: 'agenticapps',
    repo: 'agenticapps-dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    gitNexus: { kind: 'basic', state: 'fresh' },
    wiki: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount: 0,
    overrides: [],
    ...overrides,
  }
}

describe('CoverageRow', () => {
  it('renders 4 cells in the correct order: claudeMd, gitNexus, wiki, workflowVersion', () => {
    render(<CoverageRow row={makeRow()} />)
    // Each cell has an aria-label containing the column name
    expect(screen.getByLabelText(/claudeMd for/i)).toBeTruthy()
    expect(screen.getByLabelText(/gitNexus for/i)).toBeTruthy()
    expect(screen.getByLabelText(/wiki for/i)).toBeTruthy()
    expect(screen.getByLabelText(/workflowVersion for/i)).toBeTruthy()
  })

  it('renders OverrideChip component ONLY when overrideCount > 0 (not rendered when overrideCount === 0)', () => {
    const { rerender } = render(<CoverageRow row={makeRow({ overrideCount: 0 })} />)
    expect(screen.queryByRole('button', { name: /override/i })).toBeNull()

    rerender(
      <CoverageRow
        row={makeRow({
          overrideCount: 2,
          overrides: [
            { phaseSlug: 'phase-10', sinceIso: '2026-04-01T00:00:00Z', source: 'mtime' },
            { phaseSlug: 'phase-09', sinceIso: '2026-03-01T00:00:00Z', source: 'git-log' },
          ],
        })}
      />,
    )
    expect(screen.getByRole('button', { name: /2 phase reviews overridden/i })).toBeTruthy()
  })

  it('refresh button appears and triggers popover on click', () => {
    const onRefresh = vi.fn()
    render(
      <CoverageRow
        row={makeRow({ gitNexus: { kind: 'basic', state: 'stale' } })}
        onRefresh={onRefresh}
      />,
    )
    // Refresh button should be in DOM (visible on hover/focus)
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn).toBeTruthy()
    fireEvent.click(refreshBtn)
    // Popover options for stale gitNexus column
    expect(screen.getByText(/gitnexus analyze/i)).toBeTruthy()
  })

  it('refresh popover dismisses on Escape key press', () => {
    render(
      <CoverageRow row={makeRow({ gitNexus: { kind: 'basic', state: 'stale' } })} />,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    fireEvent.click(refreshBtn)
    expect(screen.getByText(/gitnexus analyze/i)).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(/gitnexus analyze/i)).toBeNull()
  })

  it('absPath NEVER rendered in DOM (CODEX HIGH-1 SPA-side enforcement)', () => {
    const row = makeRow()
    const { container } = render(<CoverageRow row={row} />)
    // absPath is not in CoverageRow's public schema, and must never appear in DOM
    expect(container.innerHTML).not.toContain('absPath')
    expect(container.innerHTML).not.toContain('/Users/')
  })
})
