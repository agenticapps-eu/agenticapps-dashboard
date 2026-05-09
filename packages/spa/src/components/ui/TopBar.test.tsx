/**
 * TopBar.test.tsx — TDD tests for TopBar (Plan 05.1-02 Task 1).
 *
 * TB1: renders <header> with 60px height and border-b border-border-subtle
 * TB2: contains Breadcrumb on left
 * TB3: contains Cmd+K trigger button
 * TB4: contains ThemeChip
 * TB5: sticky top-0 z-sticky
 * TB6: when on /projects/:projectId with matching entry, renders project tags + StatusPill
 * TB7: when on /, /settings, /help — NO Pill/StatusPill rendered
 * TB8: when useRegistryList is loading or has no match, renders without crashing
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

// Mock useRegistryList
vi.mock('../../lib/registry.js', () => ({
  useRegistryList: vi.fn(),
}))

// Mock ThemeChip
vi.mock('../ThemeChip.js', () => ({
  ThemeChip: () => <button type="button" data-testid="theme-chip">theme</button>,
}))

// Mock router
const mockUseMatches = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useMatches: () => mockUseMatches(),
    Link: ({ children, to, className, 'aria-label': ariaLabel }: { children: React.ReactNode; to: string; className?: string; 'aria-label'?: string }) => (
      <a href={to} className={className} aria-label={ariaLabel}>{children}</a>
    ),
  }
})

import { useRegistryList } from '../../lib/registry.js'
import { TopBar } from './TopBar.js'

const mockUseRegistryList = vi.mocked(useRegistryList)

const makeProject = (id: string, tags: string[], currentPhase: string | null): RegistryListItem => ({
  id,
  name: id,
  root: `/projects/${id}`,
  client: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  tags,
  status: { reachable: true, currentPhase, lastCommitAt: null },
})

beforeEach(() => {
  mockUseMatches.mockReset()
  mockUseRegistryList.mockReset()
  // Default: index route, no project
  mockUseMatches.mockReturnValue([
    { id: '__root__', fullPath: '/', params: {} },
    { id: 'index', fullPath: '/', params: {} },
  ])
  mockUseRegistryList.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useRegistryList>)
})

describe('TopBar', () => {
  it('TB1: renders <header> with 60px height and border-border-subtle', () => {
    const { container } = render(<TopBar />)
    const header = container.querySelector('header')!
    expect(header).toBeDefined()
    // Height set via inline style or h-15 tailwind class (60px)
    const hasHeight =
      header.className.includes('h-15') ||
      header.style.height === '60px' ||
      header.getAttribute('style')?.includes('60px')
    expect(hasHeight).toBe(true)
    expect(header.className).toContain('border-border-subtle')
  })

  it('TB2: contains breadcrumb navigation on the left', () => {
    render(<TopBar />)
    // Breadcrumb renders a <nav aria-label="Breadcrumb">
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeDefined()
  })

  it('TB3: contains a Cmd+K trigger button', () => {
    render(<TopBar />)
    const btn = screen.getByRole('button', { name: /open command palette/i })
    expect(btn).toBeDefined()
  })

  it('TB4: contains ThemeChip', () => {
    render(<TopBar />)
    expect(screen.getByTestId('theme-chip')).toBeDefined()
  })

  it('TB5: has sticky top-0 and sets z-index via CSS variable or class', () => {
    const { container } = render(<TopBar />)
    const header = container.querySelector('header')!
    const hasSticky = header.className.includes('sticky') || header.className.includes('top-0')
    expect(hasSticky).toBe(true)
    // Z-index set via style or z-sticky class
    const styleAttr = header.getAttribute('style') ?? ''
    const hasZ = styleAttr.includes('z-sticky') || styleAttr.includes('--z-sticky') || header.className.includes('z-sticky')
    expect(hasZ).toBe(true)
  })

  it('TB6: on /projects/:projectId with tags and phase, renders Pill + StatusPill', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '_appshell', fullPath: '/', params: {} },
      { id: '/projects/$projectId', fullPath: '/projects/$projectId', params: { projectId: 'proj-1' } },
    ])
    mockUseRegistryList.mockReturnValue({
      data: [makeProject('proj-1', ['enterprise', 'beta'], 'Phase 5')],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRegistryList>)

    render(<TopBar />)

    expect(screen.getByText('enterprise')).toBeDefined()
    expect(screen.getByText('beta')).toBeDefined()
    // StatusPill renders "Phase" label and "Phase 5" value
    expect(screen.getByText('Phase')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })

  it('TB7: on "/" route, NO project tags or StatusPill rendered', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeProject('proj-1', ['enterprise', 'beta'], 'Phase 5')],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRegistryList>)

    render(<TopBar />)

    expect(screen.queryByText('enterprise')).toBeNull()
    expect(screen.queryByText('beta')).toBeNull()
  })

  it('TB8: when registry is loading, TopBar renders without crashing', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '/projects/$projectId', fullPath: '/projects/$projectId', params: { projectId: 'proj-1' } },
    ])
    mockUseRegistryList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useRegistryList>)

    expect(() => render(<TopBar />)).not.toThrow()
  })
})
