import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CoverageEmptyState } from './CoverageEmptyState.js'

describe('CoverageEmptyState', () => {
  it('offers to clear filters for no results', () => {
    const onClearFilters = vi.fn()
    render(<CoverageEmptyState kind="no-results" onClearFilters={onClearFilters} />)
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })

  it('offers retry after a scan failure', () => {
    const onRetry = vi.fn()
    render(<CoverageEmptyState kind="scan-failed" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows the source roots when no repos are found', () => {
    render(<CoverageEmptyState kind="no-repos" />)
    expect(screen.getByText(/No git repos found/i)).toBeTruthy()
  })
})
