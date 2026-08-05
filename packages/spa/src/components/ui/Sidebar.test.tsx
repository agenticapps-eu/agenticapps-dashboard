/**
 * Sidebar.test.tsx — the two-section information architecture.
 *
 * `App Shell And Sidebar Information Architecture` (design-system, MODIFIED by
 * retire-v1-surfaces): exactly two labelled sections, product content and
 * utilities; help and settings in utilities; one navigation primitive and one
 * indentation per section; and no enumeration of registered projects, because
 * the fleet surface is that list.
 *
 * This file replaces S1–S22, which asserted the four-section IA the requirement
 * withdraws: a WORKSPACE section listing every registered project, an
 * Observability section of three entries, and a Code Intelligence section — all
 * pointing at locations that no longer render anything. Those cases were not
 * wrong when written; they described a product that has been withdrawn. The two
 * structural cases that outlive the IA (the aside's own shape and its
 * accessible name) are kept and renamed.
 *
 * The retired-destination case is deliberately blunt: it reads every href in
 * the nav and fails on any of the six withdrawn locations. An entry naming one
 * of them still "works" — the router redirects — so nothing else in the suite
 * would notice the sidebar pointing at an address the product no longer serves.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/registry.js', () => ({
  useRegistryList: vi.fn(),
}))

const mockMatchRoute = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children: React.ReactNode
      to: string
      className?: string
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={to} className={className} {...rest}>{children}</a>
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
  status: {
    reachable: true,
    condition: 'no-workflow' as const,
    openChanges: [],
    capabilityCount: 0,
    lastCommitAt: null,
  },
})

function registered(...projects: RegistryListItem[]): void {
  mockUseRegistryList.mockReturnValue({
    data: projects,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useRegistryList>)
}

/** Every navigable href inside the nav, in document order. */
function navHrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('nav a')].map((a) => a.getAttribute('href') ?? '')
}

/** Section labels, in document order. SidebarSection renders one per section. */
function sectionLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('nav > div > div:first-child')].map(
    (el) => el.textContent ?? '',
  )
}

beforeEach(() => {
  mockMatchRoute.mockReset()
  mockMatchRoute.mockReturnValue(false)
  mockUseRegistryList.mockReset()
  registered()
})

describe('Sidebar — structure that outlives the IA', () => {
  it('renders a 240px aside on the sidebar surface', () => {
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')!

    expect(aside.className).toContain('w-60')
    expect(aside.className).toContain('bg-sidebar-bg')
  })

  it('keeps its accessible name', () => {
    // On the <aside>, which is `complementary` — not on the inner <nav>.
    render(<Sidebar />)

    expect(screen.getByRole('complementary', { name: 'Primary navigation' })).toBeDefined()
  })
})

describe('Sidebar — two labelled sections, and no third', () => {
  it('labels exactly two sections', () => {
    const { container } = render(<Sidebar />)

    expect(sectionLabels(container)).toEqual(['WORKSPACE', 'UTILITIES'])
  })

  it('puts every product-content surface in the first section, in its existing peer order', () => {
    // Workflow → Fleet readiness → Changes is the order these three already had
    // as WORKSPACE peers. Withdrawing the Projects entry above them is a
    // removal, and a removal does not license a reorder — the requirement's
    // last scenario holds peer order fixed absent an IA change that says
    // otherwise.
    render(<Sidebar />)
    const content = screen.getByRole('link', { name: /^Workflow$/ })
    const fleet = screen.getByRole('link', { name: /^Fleet readiness$/ })
    const changes = screen.getByRole('link', { name: /^Changes$/ })

    expect([content, fleet, changes].map((a) => a.getAttribute('href'))).toEqual([
      '/workflow',
      '/fleet',
      '/changes',
    ])
    expect(content.compareDocumentPosition(fleet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(fleet.compareDocumentPosition(changes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts help and settings in utilities, below every content surface', () => {
    // Help belongs to utilities rather than to product content, and naming the
    // section for the account would misfile it the other way.
    render(<Sidebar />)
    const changes = screen.getByRole('link', { name: /^Changes$/ })
    const settings = screen.getByRole('link', { name: /^Settings$/ })
    const help = screen.getByRole('link', { name: /^Help$/ })

    expect(settings.getAttribute('href')).toBe('/settings')
    expect(help.getAttribute('href')).toBe('/help')
    expect(changes.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('Sidebar — the sidebar is not the project list', () => {
  it('does not grow when projects are registered', () => {
    // The requirement's own measure: the sidebar's height is unchanged by the
    // number of registered projects.
    const empty = render(<Sidebar />).container
    const withNone = navHrefs(empty)

    registered(
      makeProject('a', 'agenticapps-dashboard'),
      makeProject('b', 'claude-workflow'),
      makeProject('c', 'codex-workflow'),
      makeProject('d', 'open-design'),
    )
    const full = render(<Sidebar />).container

    expect(navHrefs(full)).toEqual(withNone)
  })

  it('names no registered project', () => {
    registered(makeProject('a', 'agenticapps-dashboard'))
    render(<Sidebar />)

    expect(screen.queryByText('agenticapps-dashboard')).toBeNull()
  })
})

describe('Sidebar — nothing points at a withdrawn location', () => {
  const RETIRED = [
    '/',
    '/coverage',
    '/observability/skill-drift',
    '/observability/conformance',
    '/code-intelligence',
  ]

  it('links to no retired location from the nav', () => {
    registered(makeProject('a', 'agenticapps-dashboard'))
    const { container } = render(<Sidebar />)
    const hrefs = navHrefs(container)

    for (const retired of RETIRED) expect(hrefs).not.toContain(retired)
    expect(hrefs.some((h) => h.startsWith('/projects'))).toBe(false)
  })

  it('sends the logo to the fleet rather than through a redirect', () => {
    // `/` answers — it redirects — so this would not fail anywhere else. The
    // product should not route its own chrome through a location it withdrew.
    render(<Sidebar />)

    expect(screen.getByText('AgenticApps').closest('a')?.getAttribute('href')).toBe('/fleet')
  })
})

describe('Sidebar — one primitive, one indentation', () => {
  it('gives every entry the same padding, so no entry reads as subordinate', () => {
    registered(makeProject('a', 'agenticapps-dashboard'))
    const { container } = render(<Sidebar />)
    const links = [...container.querySelectorAll('nav a')]

    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.className).toContain('px-3')
      // `pl-9` is the sub-item indentation the project list used.
      expect(link.className).not.toContain('pl-9')
    }
  })

  it('marks the current surface without relying on colour', () => {
    mockMatchRoute.mockImplementation(({ to }: { to: string }) => to === '/fleet')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /^Fleet readiness$/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /^Settings$/ })).not.toHaveAttribute('aria-current')
  })
})
