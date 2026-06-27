/**
 * RefreshAllStaleButton.test.tsx — Tests for AGREED-4 batch-progress component.
 *
 * AGREED-4: sequential for-of await loop, NEVER Promise.all.
 * Batch-progress state: { status: 'idle'|'running', current, total }.
 * Renders "Refreshing N of M…" while loop executes.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import type { CoverageRow, CoverageRefreshRequest, CoverageRefreshResponse } from '@agenticapps/dashboard-shared'
import { RefreshAllStaleButton } from './RefreshAllStaleButton.js'

function makeRow(repo: string, gitNexusState: 'fresh' | 'stale' | 'missing' = 'fresh'): CoverageRow {
  return {
    family: 'agenticapps',
    repo,
    claudeMd: { kind: 'basic', state: 'fresh' },
    gitNexus: { kind: 'basic', state: gitNexusState },
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
    inRegistry: true, // D-13-EXT-07: refresh-all fixture default — tests not exercising the gate
  }
}

const OK_RESPONSE: CoverageRefreshResponse = {
  ok: true,
  kind: 'ok',
  updatedRow: makeRow('any-repo'),
}

describe('RefreshAllStaleButton', () => {
  it('is disabled when 0 spawnable rows exist (no stale/missing gitNexus columns)', () => {
    const rows = [makeRow('repo-a', 'fresh'), makeRow('repo-b', 'fresh')]
    render(<RefreshAllStaleButton rows={rows} onRefresh={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('is enabled when at least one row has stale gitNexus', () => {
    const rows = [makeRow('repo-a', 'stale')]
    render(<RefreshAllStaleButton rows={rows} onRefresh={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveProperty('disabled', false)
  })

  it('renders "Refreshing N of M…" text while sequential loop runs (AGREED-4)', async () => {
    const rows = [
      makeRow('repo-a', 'stale'),
      makeRow('repo-b', 'stale'),
      makeRow('repo-c', 'stale'),
    ]

    // Controlled promises — resolve one at a time
    let resolveFirst!: () => void
    let resolveSecond!: () => void
    let resolveThird!: () => void
    const first = new Promise<CoverageRefreshResponse>((res) => { resolveFirst = () => res(OK_RESPONSE) })
    const second = new Promise<CoverageRefreshResponse>((res) => { resolveSecond = () => res(OK_RESPONSE) })
    const third = new Promise<CoverageRefreshResponse>((res) => { resolveThird = () => res(OK_RESPONSE) })

    const calls: CoverageRefreshRequest[] = []
    const onRefresh = vi.fn().mockImplementationOnce((req: CoverageRefreshRequest) => {
      calls.push(req)
      return first
    }).mockImplementationOnce((req: CoverageRefreshRequest) => {
      calls.push(req)
      return second
    }).mockImplementationOnce((req: CoverageRefreshRequest) => {
      calls.push(req)
      return third
    })

    // Mock window.confirm to auto-accept
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RefreshAllStaleButton rows={rows} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button'))

    // After first call dispatched (current=1 of 3)
    await waitFor(() => expect(screen.getByText(/Refreshing 1 of 3/)).toBeTruthy())

    // Resolve first, second call should start (current=2 of 3)
    act(() => { resolveFirst() })
    await waitFor(() => expect(screen.getByText(/Refreshing 2 of 3/)).toBeTruthy())

    // Resolve second, third call starts (current=3 of 3)
    act(() => { resolveSecond() })
    await waitFor(() => expect(screen.getByText(/Refreshing 3 of 3/)).toBeTruthy())

    // Resolve third — loop finishes, back to idle
    act(() => { resolveThird() })
    await waitFor(() => expect(screen.queryByText(/Refreshing/)).toBeNull())

    vi.restoreAllMocks()
  })

  it('sequential serialisation: second call not fired while first is pending (AGREED-4)', async () => {
    const rows = [makeRow('repo-a', 'stale'), makeRow('repo-b', 'stale')]

    let resolveFirst!: () => void
    const first = new Promise<CoverageRefreshResponse>((res) => { resolveFirst = () => res(OK_RESPONSE) })
    const second = Promise.resolve(OK_RESPONSE)

    const callOrder: string[] = []
    const onRefresh = vi.fn()
      .mockImplementationOnce(() => { callOrder.push('first-called'); return first })
      .mockImplementationOnce(() => { callOrder.push('second-called'); return second })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RefreshAllStaleButton rows={rows} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button'))

    // First call dispatched, second NOT yet
    await waitFor(() => expect(callOrder).toContain('first-called'))
    expect(callOrder).not.toContain('second-called')

    // Resolve first → second fires
    act(() => { resolveFirst() })
    await waitFor(() => expect(callOrder).toContain('second-called'))

    vi.restoreAllMocks()
  })

  it('has aria-busy attribute reflecting running state', async () => {
    const rows = [makeRow('repo-a', 'stale')]

    let resolveIt!: () => void
    const pending = new Promise<CoverageRefreshResponse>((res) => { resolveIt = () => res(OK_RESPONSE) })
    const onRefresh = vi.fn().mockReturnValue(pending)

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RefreshAllStaleButton rows={rows} onRefresh={onRefresh} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-busy')).toBe('false')

    fireEvent.click(btn)
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'))

    act(() => { resolveIt() })
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('false'))

    vi.restoreAllMocks()
  })
})
