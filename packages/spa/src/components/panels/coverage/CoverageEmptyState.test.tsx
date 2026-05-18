/**
 * CoverageEmptyState.test.tsx — Tests for 4-branch empty state renderer.
 *
 * UI-SPEC §6: each condition maps to specific copy + CTA.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { CoverageEmptyState } from './CoverageEmptyState.js'
import { ToastProvider } from '../../ui/Toast.js'

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

import { writeToClipboard } from '../../../lib/clipboardCompat.js'

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

describe('CoverageEmptyState no-gitnexus toast (IMP-03)', () => {
  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('fires success toast when copy install command button is clicked and clipboard succeeds', async () => {
    render(
      <ToastProvider>
        <CoverageEmptyState kind="no-gitnexus" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('install GitNexus')
  })

  it('fires error toast when clipboard write fails', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(false)
    render(
      <ToastProvider>
        <CoverageEmptyState kind="no-gitnexus" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('Copy failed'))
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('open the help guide for the command')
  })
})
