/**
 * CoverageEmptyState.test.tsx — Tests for 4-branch empty state renderer.
 *
 * UI-SPEC §6: each condition maps to specific copy + CTA.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CoverageEmptyState } from './CoverageEmptyState.js'

describe('CoverageEmptyState', () => {
  it("renders no-repos empty state when kind='no-repos'", () => {
    render(<CoverageEmptyState kind="no-repos" />)
    // Both h3 title and body contain "No git repos found" — getAllByText handles multiple matches
    const matches = screen.getAllByText(/No.*repos found/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Sourcecode/i)).toBeTruthy()
  })

  it("renders no-gitnexus empty state when kind='no-gitnexus' with copy install command button", () => {
    render(<CoverageEmptyState kind="no-gitnexus" />)
    expect(screen.getByText(/GitNexus is not installed/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy install command/i })).toBeTruthy()
  })

  it("renders scan-failed empty state when kind='scan-failed' with retry CTA", () => {
    const onRetry = vi.fn()
    render(<CoverageEmptyState kind="scan-failed" onRetry={onRetry} />)
    expect(screen.getByText(/Coverage scan failed/i)).toBeTruthy()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("renders no-results empty state when kind='no-results' with clear-filter CTA", () => {
    const onClearFilters = vi.fn()
    render(<CoverageEmptyState kind="no-results" onClearFilters={onClearFilters} />)
    expect(screen.getByText(/No repos match your filters/i)).toBeTruthy()
    const clearBtn = screen.getByRole('button', { name: /clear filters/i })
    fireEvent.click(clearBtn)
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
