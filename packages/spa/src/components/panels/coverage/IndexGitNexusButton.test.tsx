/**
 * IndexGitNexusButton.test.tsx — Toast wiring tests (IMP-03 / PD-11.1-02 / PD-11.1-05).
 *
 * PD-11.1-02: wording is "...index your repos with GitNexus" (NOT "index 45 repos").
 * PD-11.1-05: timing-bound assertion via vi.useFakeTimers().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { ToastProvider } from '../../ui/Toast.js'
import { IndexGitNexusButton } from './IndexGitNexusButton.js'

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

import { writeToClipboard } from '../../../lib/clipboardCompat.js'

function renderWithProvider() {
  return render(
    <ToastProvider>
      <IndexGitNexusButton />
    </ToastProvider>,
  )
}

describe('IndexGitNexusButton toast (IMP-03 / PD-11.1-02)', () => {
  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('fires success toast with contextual wording after clipboard write succeeds', async () => {
    renderWithProvider()
    await userEvent.click(screen.getByRole('button'))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) =>
      el.textContent?.includes('Copied'),
    )
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('index your repos with GitNexus')
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

describe('IndexGitNexusButton toast timing (IMP-03 / PD-11.1-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toast appears after click resolution, persists at 199ms, dismissed by 2650ms', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)

    render(
      <ToastProvider>
        <IndexGitNexusButton />
      </ToastProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
    expect(toastEl).toBeDefined()

    await act(async () => {
      vi.advanceTimersByTime(199)
    })
    const stillVisible = screen.getAllByRole('status').find((el) =>
      el.textContent?.includes('Copied'),
    )
    expect(stillVisible).toBeDefined()

    await act(async () => {
      vi.advanceTimersByTime(2400 + 250)
    })
    const gone = screen.queryAllByRole('status').find((el) =>
      el.textContent?.includes('Copied'),
    )
    expect(gone).toBeUndefined()
  })
})
