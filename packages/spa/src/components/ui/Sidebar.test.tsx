/**
 * Sidebar.test.tsx — TDD tests for Sidebar composite.
 *
 * Phase 05.1 Wave 1 original tests (S1–S5) + Phase 10 Plan 07 tests (S6–S9)
 * + Phase 11 Plan 05 tests (S10–S12 — Skill drift peer entry under Observability):
 *
 * S1: renders <aside> with w-60 (240px) and bg-sidebar-bg
 * S2: renders the logo at top ('AgenticApps' text), navigates to '/' on click
 * S3: renders 3 sections — WORKSPACE, Observability, ACCOUNT — via SidebarSection (COV-09)
 * S4: WORKSPACE section contains a "Projects (N)" item; sub-list has one SidebarSubItem per project
 * S5: ACCOUNT section contains Settings + Help SidebarItems
 * S6: Observability section contains a Coverage link to /coverage (COV-09 D-10-08)
 * S7: 3 disabled stubs (Skills, Health, Reviews) are gone from DOM (replaced by Coverage)
 * S8: aria-label "Primary navigation" preserved on outer <aside>
 * S9: section order: WORKSPACE before Observability before ACCOUNT
 * S10 (Phase 11 D-11-08): Observability section contains BOTH Coverage AND Skill drift items
 * S11 (Phase 11 D-11-08): Skill drift is the SECOND peer entry — Coverage first, Skill drift second
 * S12 (Phase 11 D-11-08): Both items use the SidebarItem peer primitive — Sidebar source contains no SidebarSubItem use inside the Observability section
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

// Mock registry hook
vi.mock('../../lib/registry.js', () => ({
  useRegistryList: vi.fn(),
}))

// Mock router
const mockMatchRoute = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
    useMatchRoute: () => mockMatchRoute,
  }
})

import { useRegistryList } from '../../lib/registry.js'
import { Sidebar } from './Sidebar.js'

const mockUseRegistryList = vi.mocked(useRegistryList)

const makeProject = (id: string, name: string): RegistryListItem => ({
  id,
  name,
  root: `/projects/${id}`,
  client: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  tags: [],
  status: { reachable: true, currentPhase: null, lastCommitAt: null },
})

beforeEach(() => {
  mockMatchRoute.mockReset()
  mockMatchRoute.mockReturnValue(false)
  mockUseRegistryList.mockReset()
  mockUseRegistryList.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useRegistryList>)
})

describe('Sidebar', () => {
  it('S1: renders <aside> with w-60 (240px) and bg-sidebar-bg', () => {
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')!
    expect(aside).toBeDefined()
    expect(aside.className).toContain('w-60')
    expect(aside.className).toContain('bg-sidebar-bg')
  })

  it('S2: renders "AgenticApps" logo text with a link to "/"', () => {
    render(<Sidebar />)
    const logoLink = screen.getByText('AgenticApps').closest('a')
    expect(logoLink).toBeDefined()
    expect(logoLink!.getAttribute('href')).toBe('/')
  })

  it('S3: renders 3 sections — WORKSPACE, Observability, ACCOUNT (COV-09)', () => {
    render(<Sidebar />)
    expect(screen.getByText('WORKSPACE')).toBeDefined()
    expect(screen.getByText('Observability')).toBeDefined()
    expect(screen.getByText('ACCOUNT')).toBeDefined()
  })

  it('S4: WORKSPACE section shows "Projects (N)" count and sub-items for each registered project', () => {
    mockUseRegistryList.mockReturnValue({
      data: [
        makeProject('proj-1', 'agenticapps-dashboard'),
        makeProject('proj-2', 'fx-signal-agent'),
        makeProject('proj-3', 'cparx'),
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRegistryList>)

    render(<Sidebar />)

    // Projects count item
    expect(screen.getByText('Projects (3)')).toBeDefined()

    // Sub-items for each project
    expect(screen.getByText('agenticapps-dashboard')).toBeDefined()
    expect(screen.getByText('fx-signal-agent')).toBeDefined()
    expect(screen.getByText('cparx')).toBeDefined()
  })

  it('S5: ACCOUNT section contains Settings and Help navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Help')).toBeDefined()
  })

  it('S6: Observability section has a Coverage link to /coverage (COV-09 D-10-08)', () => {
    render(<Sidebar />)
    const coverageLink = screen.getByRole('link', { name: /Coverage/i })
    expect(coverageLink).toBeDefined()
    expect(coverageLink.getAttribute('href')).toBe('/coverage')
  })

  it('S7: disabled stubs Skills, Health, Reviews are removed from DOM', () => {
    render(<Sidebar />)
    expect(screen.queryByText('Skills')).toBeNull()
    expect(screen.queryByText('Health')).toBeNull()
    expect(screen.queryByText('Reviews')).toBeNull()
  })

  it('S8: aria-label "Primary navigation" preserved on outer <aside>', () => {
    render(<Sidebar />)
    const aside = screen.getByRole('complementary')
    expect(aside.getAttribute('aria-label')).toBe('Primary navigation')
  })

  it('S9: section order — WORKSPACE before Observability before ACCOUNT', () => {
    const { container } = render(<Sidebar />)
    const text = container.textContent ?? ''
    const wsIdx = text.indexOf('WORKSPACE')
    const obsIdx = text.indexOf('Observability')
    const accIdx = text.indexOf('ACCOUNT')
    expect(wsIdx).toBeGreaterThanOrEqual(0)
    expect(obsIdx).toBeGreaterThan(wsIdx)
    expect(accIdx).toBeGreaterThan(obsIdx)
  })

  it('S10: Observability section contains BOTH Coverage AND Skill drift items (Phase 11 D-11-08)', () => {
    render(<Sidebar />)
    const coverageLink = screen.getByRole('link', { name: /^Coverage$/i })
    expect(coverageLink).toBeDefined()
    expect(coverageLink.getAttribute('href')).toBe('/coverage')
    const skillDriftLink = screen.getByRole('link', { name: /^Skill drift$/i })
    expect(skillDriftLink).toBeDefined()
    expect(skillDriftLink.getAttribute('href')).toBe('/observability/skill-drift')
  })

  it('S11: Skill drift is the SECOND peer entry under Observability (Coverage first, Skill drift second)', () => {
    const { container } = render(<Sidebar />)
    const text = container.textContent ?? ''
    const obsIdx = text.indexOf('Observability')
    const covIdx = text.indexOf('Coverage', obsIdx)
    const skdIdx = text.indexOf('Skill drift', obsIdx)
    expect(obsIdx).toBeGreaterThanOrEqual(0)
    expect(covIdx).toBeGreaterThan(obsIdx)
    expect(skdIdx).toBeGreaterThan(covIdx)
  })

  it('S12: Skill drift link uses SidebarItem peer primitive (not SidebarSubItem)', () => {
    // SidebarItem renders as <a> with px-3 py-2 (peer-level padding).
    // SidebarSubItem (used for projects) uses a different shape (with statusDot etc.).
    // Verify by class signature on the Skill drift link.
    render(<Sidebar />)
    const skillDriftLink = screen.getByRole('link', { name: /^Skill drift$/i })
    // SidebarItem signature: includes 'px-3 py-2' and 'text-sm font-medium'.
    expect(skillDriftLink.className).toContain('px-3')
    expect(skillDriftLink.className).toContain('py-2')
    expect(skillDriftLink.className).toContain('text-sm')
  })
})
