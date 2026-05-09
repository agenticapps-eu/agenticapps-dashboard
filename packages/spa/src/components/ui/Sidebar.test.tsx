/**
 * Sidebar.test.tsx — TDD tests for Sidebar composite (Plan 05.1-02 Task 1).
 *
 * S1: renders <aside> with w-60 (240px) and bg-sidebar-bg
 * S2: renders the logo at top ('AgenticApps' text), navigates to '/' on click
 * S3: renders 3 sections — WORKSPACE, OBSERVE, ACCOUNT — via SidebarSection
 * S4: WORKSPACE section contains a "Projects (N)" item; sub-list has one SidebarSubItem per project
 * S5: ACCOUNT section contains Settings + Help SidebarItems
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

  it('S3: renders 3 sections — WORKSPACE, OBSERVE, ACCOUNT', () => {
    render(<Sidebar />)
    expect(screen.getByText('WORKSPACE')).toBeDefined()
    expect(screen.getByText('OBSERVE')).toBeDefined()
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
})
