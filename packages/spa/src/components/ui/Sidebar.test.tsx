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
 *
 * Phase 12 Plan 12-04 (D-12-01 / REQ-12-NAV-01) — graduates the Observability
 * section from 2 → 3 peer entries:
 *
 * S13: Observability section contains 3 entries (Coverage, Skill drift, Conformance)
 * S14: Conformance entry routes to /observability/conformance
 * S15: Observability order is Coverage → Skill drift → Conformance (additive — Phase 11
 *      D-11-08 order preserved; documented deviation from RESEARCH OQ3)
 * S16: Conformance entry uses the SidebarItem peer primitive (NOT SidebarSubItem) —
 *      matches D-12-01 + D-11-08
 * S17: Sidebar source imports TrendingUp from lucide-react (icon used for Conformance,
 *      visually distinct from Activity / Layers)
 *
 * Phase 14 Plan 04 (D-14-06 / user sidebar-architecture preference: new section with growth room):
 *
 * S18: Sidebar renders a "Code Intelligence" section between Observability and ACCOUNT
 * S19: Code Intelligence section contains a "Knowledge graphs" item linking to /code-intelligence
 * S20: Code Intelligence section order — appears after Observability and before ACCOUNT
 * S21: Sidebar source imports Network from lucide-react (icon for Knowledge graphs entry)
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

  it('S13: Observability section contains 3 entries (Coverage, Skill drift, Conformance) — Phase 12 D-12-01', () => {
    render(<Sidebar />)
    const coverageLink = screen.getByRole('link', { name: /^Coverage$/i })
    const skillDriftLink = screen.getByRole('link', { name: /^Skill drift$/i })
    const conformanceLink = screen.getByRole('link', { name: /^Conformance$/i })
    expect(coverageLink).toBeDefined()
    expect(skillDriftLink).toBeDefined()
    expect(conformanceLink).toBeDefined()
  })

  it('S14: Conformance entry routes to /observability/conformance (Phase 12 REQ-12-NAV-01)', () => {
    render(<Sidebar />)
    const conformanceLink = screen.getByRole('link', { name: /^Conformance$/i })
    expect(conformanceLink.getAttribute('href')).toBe('/observability/conformance')
  })

  it('S15: Observability order is Coverage → Skill drift → Conformance (Phase 11 IA preserved)', () => {
    const { container } = render(<Sidebar />)
    const text = container.textContent ?? ''
    const obsIdx = text.indexOf('Observability')
    const covIdx = text.indexOf('Coverage', obsIdx)
    const skdIdx = text.indexOf('Skill drift', obsIdx)
    const conIdx = text.indexOf('Conformance', obsIdx)
    expect(obsIdx).toBeGreaterThanOrEqual(0)
    expect(covIdx).toBeGreaterThan(obsIdx)
    expect(skdIdx).toBeGreaterThan(covIdx)
    // Conformance is the THIRD entry — must appear AFTER Skill drift.
    expect(conIdx).toBeGreaterThan(skdIdx)
  })

  it('S16: Conformance link uses SidebarItem peer primitive (not SidebarSubItem) — D-12-01 + D-11-08', () => {
    render(<Sidebar />)
    const conformanceLink = screen.getByRole('link', { name: /^Conformance$/i })
    expect(conformanceLink.className).toContain('px-3')
    expect(conformanceLink.className).toContain('py-2')
    expect(conformanceLink.className).toContain('text-sm')
  })

  it('S17: Sidebar source imports TrendingUp from lucide-react (Conformance icon)', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const candidates = [
      path.resolve(process.cwd(), 'src/components/ui/Sidebar.tsx'),
      path.resolve(process.cwd(), 'packages/spa/src/components/ui/Sidebar.tsx'),
    ]
    let source: string | null = null
    for (const c of candidates) {
      try {
        source = await fs.readFile(c, 'utf8')
        break
      } catch {
        // continue
      }
    }
    if (source === null) throw new Error('Sidebar.tsx not found')
    // TrendingUp appears in the lucide-react import line AND in the JSX usage.
    const matches = source.match(/TrendingUp/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Import statement contains TrendingUp.
    expect(source).toMatch(/from ['"]lucide-react['"][\s\S]*?TrendingUp|TrendingUp[\s\S]*?from ['"]lucide-react['"]/)
  })

  it('S18: renders a "Code Intelligence" section between Observability and ACCOUNT (Phase 14 D-14-06)', () => {
    render(<Sidebar />)
    expect(screen.getByText('Code Intelligence')).toBeDefined()
  })

  it('S19: Code Intelligence section contains a "Knowledge graphs" item linking to /code-intelligence', () => {
    render(<Sidebar />)
    const knowledgeGraphsLink = screen.getByRole('link', { name: /^Knowledge graphs$/i })
    expect(knowledgeGraphsLink).toBeDefined()
    expect(knowledgeGraphsLink.getAttribute('href')).toBe('/code-intelligence')
  })

  it('S20: Code Intelligence appears after Observability and before ACCOUNT in sidebar order', () => {
    const { container } = render(<Sidebar />)
    const text = container.textContent ?? ''
    const obsIdx = text.indexOf('Observability')
    const ciIdx = text.indexOf('Code Intelligence')
    const accIdx = text.indexOf('ACCOUNT')
    expect(obsIdx).toBeGreaterThanOrEqual(0)
    expect(ciIdx).toBeGreaterThan(obsIdx)
    expect(accIdx).toBeGreaterThan(ciIdx)
  })

  it('S21: Sidebar source imports Network from lucide-react (Code Intelligence icon)', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const candidates = [
      path.resolve(process.cwd(), 'src/components/ui/Sidebar.tsx'),
      path.resolve(process.cwd(), 'packages/spa/src/components/ui/Sidebar.tsx'),
    ]
    let source: string | null = null
    for (const c of candidates) {
      try {
        source = await fs.readFile(c, 'utf8')
        break
      } catch {
        // continue
      }
    }
    if (source === null) throw new Error('Sidebar.tsx not found')
    // Network appears in the lucide-react import line AND in JSX usage.
    const matches = source.match(/\bNetwork\b/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Import statement contains Network.
    expect(source).toMatch(/Network[\s\S]*?from ['"]lucide-react['"]/)
  })
})
