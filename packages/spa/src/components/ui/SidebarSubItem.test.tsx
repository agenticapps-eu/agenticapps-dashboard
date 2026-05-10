/**
 * SidebarSubItem.test.tsx — TDD tests for SidebarSubItem (Plan 05.1-02 Task 1).
 *
 * SSub1: renders with extra left padding (pl-9 or equivalent for indent)
 * SSub2: optional statusDot prop renders a small status circle (green/amber/gray color)
 * SSub3: active state matches SidebarItem (bg-accent-bg-strong + text-white)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mockMatchRoute = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, className, 'aria-current': ariaCurrent }: { children: React.ReactNode; to: string; className?: string; 'aria-current'?: React.AriaAttributes['aria-current'] }) => (
      <a href={to} className={className} aria-current={ariaCurrent}>{children}</a>
    ),
    useMatchRoute: () => mockMatchRoute,
  }
})

import { SidebarSubItem } from './SidebarSubItem.js'

beforeEach(() => {
  mockMatchRoute.mockReset()
  mockMatchRoute.mockReturnValue(false)
})

describe('SidebarSubItem', () => {
  it('SSub1: renders with extra left padding (pl-9 or larger for indent)', () => {
    const { container } = render(
      <SidebarSubItem to="/projects/$projectId" params={{ projectId: 'project-1' }} label="project-1" />,
    )
    const link = container.querySelector('a')!
    // Accepts pl-9 (36px) or pl-8 (32px) or similar; just needs more padding than SidebarItem (pl-3/px-3)
    expect(link.className).toMatch(/pl-[89]|pl-10|pl-12/)
  })

  it('SSub2: statusDot="green" renders a status circle with bg-status-success', () => {
    const { container } = render(
      <SidebarSubItem
        to="/projects/$projectId"
        params={{ projectId: 'project-1' }}
        label="project-1"
        statusDot="green"
      />,
    )
    const dot = container.querySelector('[aria-hidden="true"]')
    expect(dot).toBeDefined()
    expect(dot!.className).toContain('bg-status-success')
  })

  it('SSub2b: statusDot="gray" renders a status circle with bg-text-tertiary or similar gray', () => {
    const { container } = render(
      <SidebarSubItem
        to="/projects/$projectId"
        params={{ projectId: 'project-1' }}
        label="project-1"
        statusDot="gray"
      />,
    )
    const dots = container.querySelectorAll('[aria-hidden="true"]')
    // Should have some gray indicator
    const dotClasses = Array.from(dots).map((d) => d.className).join(' ')
    expect(dotClasses).toMatch(/text-tertiary|bg-text|gray|neutral/)
  })

  it('SSub3: active state applies bg-accent-bg-strong + text-white', () => {
    mockMatchRoute.mockReturnValue({ projectId: 'project-1' })
    const { container } = render(
      <SidebarSubItem to="/projects/$projectId" params={{ projectId: 'project-1' }} label="project-1" />,
    )
    const link = container.querySelector('a')!
    expect(link.className).toContain('bg-accent-bg-strong')
    expect(link.className).toContain('text-white')
  })

  it('SSub3b: renders the label', () => {
    render(
      <SidebarSubItem to="/projects/$projectId" params={{ projectId: 'my-project' }} label="my-project" />,
    )
    expect(screen.getByText('my-project')).toBeDefined()
  })
})

describe('D-6.1-04 ARIA additions', () => {
  it('SidebarSubItem on active route carries aria-current="page"', () => {
    mockMatchRoute.mockReturnValue({ projectId: 'project-1' })
    const { container } = render(
      <SidebarSubItem to="/projects/$projectId" params={{ projectId: 'project-1' }} label="project-1" />,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('SidebarSubItem on inactive route does NOT carry aria-current', () => {
    mockMatchRoute.mockReturnValue(false)
    const { container } = render(
      <SidebarSubItem to="/projects/$projectId" params={{ projectId: 'project-1' }} label="project-1" />,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-current')).toBeNull()
  })
})
