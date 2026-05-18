/**
 * InstallGitNexusButton.test.tsx — Toast wiring tests (IMP-03).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { ToastProvider } from '../../ui/Toast.js'
import { InstallGitNexusButton } from './InstallGitNexusButton.js'

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

import { writeToClipboard } from '../../../lib/clipboardCompat.js'

function renderWithProvider() {
  return render(
    <ToastProvider>
      <InstallGitNexusButton />
    </ToastProvider>,
  )
}

describe('InstallGitNexusButton toast (IMP-03)', () => {
  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('fires success toast with install wording after clipboard write succeeds', async () => {
    renderWithProvider()
    await userEvent.click(screen.getByRole('button'))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) =>
      el.textContent?.includes('Copied'),
    )
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('install GitNexus')
  })

  it('fires error toast when clipboard write fails', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(false)
    renderWithProvider()
    await userEvent.click(screen.getByRole('button'))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) =>
      el.textContent?.includes('Copy failed'),
    )
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('open the help guide for the command')
  })
})
