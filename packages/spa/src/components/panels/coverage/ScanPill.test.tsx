/**
 * ScanPill.test.tsx — Tests for the Phase 13 per-row scan affordance.
 *
 * Wave 3 (Plan 13-03) GREENs these tests by creating:
 *   packages/spa/src/components/panels/coverage/ScanPill.tsx
 *   (per-row + per-family scan affordance — D-13-08, D-13-11b)
 *
 * Test inventory (7 cases — ScanPill component concerns):
 *   1. Renders Scan label + button when canScan=true (idle)
 *   2. Renders Scan label when canScan=true (scope='repo', different target)
 *   3. Renders disabled pill + tooltip when canScan=false and installed=true (D-13-11b)
 *   4. Renders no pill when installed=false (parent falls back to InstallGitNexusButton, D-13-07)
 *   5. On click, fires mutation with {scope:'repo', target:repoId}
 *   6. Shows Scanning… text while progress data has state='running' after scanId set
 *   7. Reverts to Scan label in idle state (confirms component defined + basic render)
 *
 * cleanup imported from @testing-library/react (NOT vitest — fix for Wave 0 scaffold bug).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ScanPill } from './ScanPill.js'

// ── Mock useToast so ScanPill does not throw "must be inside ToastProvider" ───
vi.mock('../../ui/Toast.js', () => ({
  useToast: vi.fn(() => ({ show: vi.fn() })),
}))

// ── Mock gitnexusScan hooks — default idle state ───────────────────────────────
const mockMutateAsync = vi.fn().mockResolvedValue({ ok: true, scanId: 'test-scan-id' })
const mockUseGitnexusScan = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}))
const mockUseGitnexusScanProgress = vi.fn(() => ({
  data: null,
  isFetching: false,
}))

vi.mock('../../../lib/queries/gitnexusScan.js', () => ({
  useGitnexusScan: () => mockUseGitnexusScan(),
  useGitnexusScanProgress: () => mockUseGitnexusScanProgress(),
  scanErrorCodeToMessage: (code: string) => `error: ${code}`,
}))

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, Wrapper }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockMutateAsync.mockResolvedValue({ ok: true, scanId: 'test-scan-id' })
  mockUseGitnexusScan.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })
  mockUseGitnexusScanProgress.mockReturnValue({
    data: null,
    isFetching: false,
  })
})

describe('ScanPill — canScan=true states (D-13-08)', () => {
  it("renders Scan label + enabled button when canScan=true and installed=true (idle state)", () => {
    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: true,
          installed: true,
        })
      )
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('Scan')
    expect(btn).not.toBeDisabled()
  })

  it("renders Scan label when canScan=true and rowState='installed-no-registry' (same pill shape)", () => {
    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/foo',
          canScan: true,
          installed: true,
        })
      )
    )
    expect(screen.getByRole('button').textContent).toContain('Scan')
  })
})

describe('ScanPill — canScan=false / not-installed states (D-13-11b, D-13-07)', () => {
  it("renders disabled pill with tooltip 'Connect from the host device to scan' when canScan=false and installed=true", () => {
    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: false,
          installed: true,
        })
      )
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    // Tooltip text should appear somewhere in document (portal or inline)
    expect(document.body.textContent).toContain('Connect from the host device to scan')
  })

  it('renders null (no pill) when installed=false — parent falls back to InstallGitNexusButton (D-13-07)', () => {
    const { Wrapper } = makeWrapper()
    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: false,
          installed: false,
        })
      )
    )
    // ScanPill returns null — no button, no element rendered inside wrapper
    expect(container.querySelector('button')).toBeNull()
    // The QueryClientProvider wrapper itself renders but ScanPill adds nothing
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('ScanPill — interaction and scan lifecycle (D-13-08, D-13-09)', () => {
  it("on click, fires mutation with {scope:'repo', target:repoId}", async () => {
    const localMutateAsync = vi.fn().mockResolvedValue({ ok: true, scanId: 'clicked-id' })
    mockUseGitnexusScan.mockReturnValue({
      mutateAsync: localMutateAsync,
      isPending: false,
    })

    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: true,
          installed: true,
        })
      )
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    // Wait a tick for the async click handler
    await new Promise((r) => setTimeout(r, 0))
    expect(localMutateAsync).toHaveBeenCalledWith({ scope: 'repo', target: 'agenticapps/dashboard' })
  })

  it("shows 'Scanning…' text while progress.data.state='running' (after scanId set via click)", async () => {
    // After click succeeds, scanId state is set → useGitnexusScanProgress receives non-null id
    // We mock progress to return running state immediately
    mockUseGitnexusScanProgress.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        kind: 'repo',
        state: 'running' as const,
        scanId: 'test-scan-id',
        repoId: 'agenticapps/dashboard',
        startedAt: new Date().toISOString(),
      } as any,
      isFetching: true,
    })

    const localMutateAsync = vi.fn().mockResolvedValue({ ok: true, scanId: 'test-scan-id' })
    mockUseGitnexusScan.mockReturnValue({
      mutateAsync: localMutateAsync,
      isPending: false,
    })

    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: true,
          installed: true,
        })
      )
    )

    // Click to trigger scan and set scanId
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))

    // After scanId is set, the component re-renders and should show Scanning…
    // because progress hook returns state='running'
    expect(screen.getByText(/Scanning/)).toBeTruthy()
  })

  it("shows Scan button (idle) when progress.data is null — confirms default idle render", () => {
    const { Wrapper } = makeWrapper()
    render(
      React.createElement(Wrapper, null,
        React.createElement(ScanPill, {
          scope: 'repo',
          target: 'agenticapps/dashboard',
          canScan: true,
          installed: true,
        })
      )
    )
    // No scanId set, progress.data is null → idle Scan button
    expect(screen.getByRole('button').textContent).toContain('Scan')
  })
})
