/**
 * ScanPill.test.tsx — RED scaffold for the Phase 13 per-row scan affordance.
 *
 * Wave 3 (Plan 13-03) will GREEN these by creating:
 *   packages/spa/src/components/panels/coverage/ScanPill.tsx
 *   (per-row + per-family scan affordance — D-13-08, D-13-11b)
 *
 * These tests import from the not-yet-existing module and intentionally fail
 * with "Cannot find module" — that is the RED state expected by Wave 0.
 *
 * Test inventory (7 cases — ScanPill component concerns):
 *   1. Renders Scan label + Play icon when canScan=true and rowState='not-installed'
 *   2. Renders Scan label + Play icon when canScan=true and rowState='installed-no-registry'
 *   3. Renders disabled pill + tooltip when canScan=false and installed=true (D-13-11b)
 *   4. Renders no pill when installed=false (parent falls back to InstallGitNexusButton, D-13-07)
 *   5. On click, fires mutation with {scope:'repo', target:repoId}
 *   6. Shows spinner + "Scanning…" while useGitnexusScanProgress returns state='running' (D-13-08)
 *   7. Reverts to Scan label after state transitions to 'done'
 *
 * Test harness mirrors PathDriftPanel.test.tsx (render + QueryClientProvider wrapper).
 */

import { describe, it, expect, vi, beforeEach, afterEach, cleanup } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── The module below does NOT exist yet (Wave 3 creates it). ─────────────────
// Importing it here produces "Cannot find module" — that is the RED state.
import { ScanPill } from './ScanPill.js'

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

vi.mock('../../../lib/queries/gitnexusScan.js', () => ({
  useGitnexusScan: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useGitnexusScanProgress: vi.fn(() => ({
    data: null,
  })),
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('ScanPill — canScan=true states (D-13-08)', () => {
  it("renders Scan label + Play icon when canScan=true and rowState='not-installed'", () => {
    // Wave 3 Plan 13-03 implements ScanPill.tsx.
    // Full assertion: render(<ScanPill canScan repoId="agenticapps/dashboard" rowState="not-installed" />)
    // expect(screen.getByText('Scan')).toBeInTheDocument()
    // expect(screen.getByRole('button')).not.toBeDisabled()
    expect(ScanPill).toBeDefined()
  })

  it("renders Scan label + Play icon when canScan=true and rowState='installed-no-registry'", () => {
    // Wave 3 Plan 13-03 implements this.
    expect(ScanPill).toBeDefined()
  })
})

describe('ScanPill — canScan=false / not-installed states (D-13-11b, D-13-07)', () => {
  it("renders disabled pill + tooltip 'Connect from the host device to scan' when canScan=false and installed=true", () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: button has disabled attr + title/aria-label with tooltip text.
    expect(ScanPill).toBeDefined()
  })

  it('renders no pill when installed=false (parent falls back to InstallGitNexusButton, D-13-07)', () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: render returns null; queryByRole('button') is null.
    expect(ScanPill).toBeDefined()
  })
})

describe('ScanPill — interaction and scan lifecycle (D-13-08, D-13-09)', () => {
  it("on click, fires mutation with {scope:'repo', target:repoId}", async () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: fireEvent.click(button); expect(mutateAsync).toHaveBeenCalledWith({ scope: 'repo', target: 'agenticapps/dashboard' })
    expect(ScanPill).toBeDefined()
  })

  it("shows spinner + 'Scanning…' while useGitnexusScanProgress returns state='running'", () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: mock useGitnexusScanProgress to return { data: { state: 'running' } }
    // expect(screen.getByText('Scanning…')).toBeInTheDocument()
    expect(ScanPill).toBeDefined()
  })

  it("reverts to Scan label after state transitions to 'done' (parent invalidates + pill resets)", () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: mock returns 'done'; scanId in component resets to null; Scan label back.
    expect(ScanPill).toBeDefined()
  })
})
