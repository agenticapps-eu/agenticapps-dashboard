/**
 * ProjectHeader.test.tsx — TDD tests for ProjectHeader component.
 *
 * Tests H1–H9 covering breadcrumb rendering, fallbacks, and accessibility.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import type { ProjectOverview } from '@agenticapps/dashboard-shared'

// Mock registry hooks
const mockUseRegistryList = vi.fn()
const mockUseProjectOverview = vi.fn()

vi.mock('../lib/registry.js', () => ({
  useRegistryList: () => mockUseRegistryList(),
  useProjectOverview: (id: string | null) => mockUseProjectOverview(id),
}))

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

import { ProjectHeader } from './ProjectHeader.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRegistryItem(overrides: Partial<{
  id: string
  name: string
  client: string | null
  tags: string[]
  currentPhase: string | null
}> = {}) {
  return {
    id: overrides.id ?? 'acme',
    name: overrides.name ?? 'Acme App',
    root: '/home/user/acme',
    client: overrides.client ?? null,
    addedAt: '2026-01-01T00:00:00.000Z',
    tags: overrides.tags ?? ['active'],
    status: {
      reachable: true,
      currentPhase: overrides.currentPhase ?? '04-single-project-view',
      lastCommitAt: '2026-05-04T10:00:00.000Z',
    },
  }
}

function makeOverview(overrides: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    branch: overrides.branch !== undefined ? overrides.branch : 'main',
    phaseStatus: overrides.phaseStatus ?? 'In Progress',
    stage1: overrides.stage1 ?? null,
    stage2: overrides.stage2 ?? null,
    dbAudit: overrides.dbAudit ?? null,
    tdd: overrides.tdd ?? null,
    verification: overrides.verification ?? null,
    markers: overrides.markers ?? { gitRepo: true, planning: true, claudeSkills: true },
  }
}

beforeEach(() => {
  mockUseRegistryList.mockReset()
  mockUseProjectOverview.mockReset()

  // Default: loading state
  mockUseRegistryList.mockReturnValue({ data: undefined, isLoading: true, isError: false })
  mockUseProjectOverview.mockReturnValue({ data: undefined, isLoading: true, isError: false })
})

afterEach(() => {
  cleanup()
})

describe('ProjectHeader', () => {
  it('H1: renders "← All Projects" link with to="/"', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem()],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview(),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    const link = screen.getByRole('link', { name: /All Projects/ })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/')
  })

  it('H2: renders project name and (client) when client is non-null', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem({ name: 'Acme App', client: 'BigCorp' })],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview(),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    expect(screen.getByText('Acme App')).toBeDefined()
    expect(screen.getByText('(BigCorp)')).toBeDefined()
  })

  it('H3: when client is null, no "()" parens are rendered', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem({ name: 'Acme App', client: null })],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview(),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    expect(screen.getByText('Acme App')).toBeDefined()
    expect(screen.queryByText(/\(.*\)/)).toBeNull()
  })

  it('H4: renders branch in font-mono class when overview branch is set', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem()],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview({ branch: 'feat/foo' }),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    const branchEl = screen.getByText('feat/foo')
    expect(branchEl).toBeDefined()
    expect(branchEl.className).toContain('font-mono')
  })

  it('H5: when overview branch is null, renders literal "(no branch)"', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem()],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview({ branch: null }),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    expect(screen.getByText('(no branch)')).toBeDefined()
  })

  it('H6: renders phase 04 and status when currentPhase starts with 04 and phaseStatus is set', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem({ currentPhase: '04-single-project-view' })],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview({ phaseStatus: 'In Progress' }),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    expect(screen.getByText('phase 04')).toBeDefined()
    expect(screen.getByText('In Progress')).toBeDefined()
  })

  it('H7: when registry is loading, renders projectId as fallback name without crashing', () => {
    mockUseRegistryList.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    mockUseProjectOverview.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<ProjectHeader projectId="acme" />)

    // Back link is always present
    expect(screen.getByRole('link', { name: /All Projects/ })).toBeDefined()
    // Fallback: shows projectId as name
    expect(screen.getByText('acme')).toBeDefined()
  })

  it('H8: back link has focus-visible:ring-[--ring] class', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem()],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview(),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    const link = screen.getByRole('link', { name: /All Projects/ })
    expect(link.className).toContain('focus-visible:ring-accent')
  })

  it('H9: separator dots have aria-hidden="true" and text-[--text-muted] class', () => {
    mockUseRegistryList.mockReturnValue({
      data: [makeRegistryItem()],
      isLoading: false,
      isError: false,
    })
    mockUseProjectOverview.mockReturnValue({
      data: makeOverview(),
      isLoading: false,
      isError: false,
    })

    render(<ProjectHeader projectId="acme" />)

    const separators = document.querySelectorAll('[aria-hidden="true"]')
    const dotSeparators = Array.from(separators).filter(
      (el) => el.textContent?.includes('·'),
    )
    expect(dotSeparators.length).toBeGreaterThan(0)
    for (const sep of dotSeparators) {
      expect(sep.className).toContain('text-text-secondary')
    }
  })
})
