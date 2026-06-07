/**
 * UnderstandCopyPill.test.tsx — Tests for the Understand copy-pill + viewer-link composite.
 *
 * Behavior tests (5 total per plan 14-03 Task 1):
 * 1. state='missing' renders the copy pill and NO viewer link
 * 2. state='stale' renders BOTH the viewer link AND the copy pill (D-14-10)
 * 3. state='fresh' renders the viewer link only (target="_blank" rel="noopener noreferrer"), NO pill
 * 4. click pill calls writeToClipboard with exact buildUnderstandCommand string + success/error toast
 * 5. viewer link href equals the viewerUrl prop verbatim (URL construction is the parent's job)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import React from 'react'
import { ToastProvider } from '../../ui/Toast.js'
import { UnderstandCopyPill } from './UnderstandCopyPill.js'

// Mock clipboard
vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

import { writeToClipboard } from '../../../lib/clipboardCompat.js'

function withToast(ui: React.ReactElement) {
  return <ToastProvider>{ui}</ToastProvider>
}

afterEach(() => {
  cleanup()
})

const VIEWER_URL = 'http://127.0.0.1:5193/understand/agenticapps/claude-workflow/?token=v1.abc.def'

describe('UnderstandCopyPill — Test 1: state=missing', () => {
  it('renders copy pill (button labelled /understand) when state=missing', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" />))
    const pill = screen.getByRole('button', { name: /copy understand command for claude-workflow/i })
    expect(pill).toBeTruthy()
    expect(pill.textContent).toContain('/understand')
  })

  it('does NOT render a viewer link when state=missing (no viewerUrl)', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" />))
    expect(screen.queryByRole('link', { name: /open knowledge graph/i })).toBeNull()
  })

  it('does NOT render a viewer link when state=missing even if viewerUrl is provided', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" viewerUrl={VIEWER_URL} />))
    // state=missing should NOT show a viewer link regardless of viewerUrl
    expect(screen.queryByRole('link', { name: /open knowledge graph/i })).toBeNull()
  })
})

describe('UnderstandCopyPill — Test 2: state=stale', () => {
  it('renders BOTH viewer link AND copy pill when state=stale + viewerUrl set (D-14-10)', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="stale" viewerUrl={VIEWER_URL} />))
    expect(screen.getByRole('link', { name: /open knowledge graph for claude-workflow/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy understand command for claude-workflow/i })).toBeTruthy()
  })

  it('renders copy pill (but NOT viewer link) when state=stale + viewerUrl absent', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="stale" />))
    expect(screen.queryByRole('link', { name: /open knowledge graph/i })).toBeNull()
    expect(screen.getByRole('button', { name: /copy understand command/i })).toBeTruthy()
  })
})

describe('UnderstandCopyPill — Test 3: state=fresh', () => {
  it('renders viewer link when state=fresh + viewerUrl set', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="fresh" viewerUrl={VIEWER_URL} />))
    const link = screen.getByRole('link', { name: /open knowledge graph for claude-workflow/i })
    expect(link).toBeTruthy()
  })

  it('viewer link has target=_blank and rel=noopener noreferrer (D-14-07)', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="fresh" viewerUrl={VIEWER_URL} />))
    const link = screen.getByRole('link', { name: /open knowledge graph/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does NOT render copy pill when state=fresh', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="fresh" viewerUrl={VIEWER_URL} />))
    expect(screen.queryByRole('button', { name: /copy understand command/i })).toBeNull()
  })

  it('does NOT render viewer link when state=fresh but no viewerUrl', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="fresh" />))
    expect(screen.queryByRole('link', { name: /open knowledge graph/i })).toBeNull()
  })
})

describe('UnderstandCopyPill — Test 4: clipboard + toast', () => {
  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('click pill calls writeToClipboard with the exact buildUnderstandCommand string', async () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" />))
    const pill = screen.getByRole('button', { name: /copy understand command for claude-workflow/i })
    fireEvent.click(pill)
    await waitFor(() => {
      expect(vi.mocked(writeToClipboard)).toHaveBeenCalledWith(
        'cd ~/Sourcecode/agenticapps/claude-workflow && claude "/understand"',
      )
    })
  })

  it('shows success toast when clipboard succeeds', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" />))
    fireEvent.click(screen.getByRole('button', { name: /copy understand command/i }))
    await waitFor(() => {
      const statusEls = screen.getAllByRole('status')
      const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
      expect(toastEl).toBeDefined()
    })
  })

  it('shows error toast when clipboard fails', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(false)
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="missing" />))
    fireEvent.click(screen.getByRole('button', { name: /copy understand command/i }))
    await waitFor(() => {
      const alertEl = screen.getByRole('alert')
      expect(alertEl.textContent).toContain('Copy failed')
    })
  })
})

describe('UnderstandCopyPill — Test 5: viewer link href', () => {
  it('viewer link href equals the viewerUrl prop verbatim', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="fresh" viewerUrl={VIEWER_URL} />))
    const link = screen.getByRole('link', { name: /open knowledge graph/i })
    expect(link.getAttribute('href')).toBe(VIEWER_URL)
  })

  it('viewer link href equals viewerUrl on stale state too', () => {
    render(withToast(<UnderstandCopyPill family="agenticapps" repo="claude-workflow" state="stale" viewerUrl={VIEWER_URL} />))
    const link = screen.getByRole('link', { name: /open knowledge graph/i })
    expect(link.getAttribute('href')).toBe(VIEWER_URL)
  })
})

describe('UnderstandCopyPill — D-5.1-10 constraint: NO cn/clsx/CVA/hex literals', () => {
  // These are statically verified by the acceptance criterion grep in the plan.
  // This test acts as a runtime smoke test that the component renders at all.
  it('renders without throwing for all 3 states', () => {
    const states = ['fresh', 'stale', 'missing'] as const
    for (const state of states) {
      const { unmount } = render(
        withToast(<UnderstandCopyPill family="agenticapps" repo="my-repo" state={state} viewerUrl={VIEWER_URL} />),
      )
      // Should not throw
      unmount()
    }
  })
})
