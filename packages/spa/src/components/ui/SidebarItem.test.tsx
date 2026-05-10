/**
 * SidebarItem.test.tsx — TDD tests for SidebarItem + SidebarItemDisabled (Plan 05.1-02 Task 1).
 *
 * SI1: renders a Link with the `to` prop forwarded
 * SI2: when useMatchRoute matches `to`, applies active classes (bg-accent-bg-strong + text-white)
 * SI3: when not matching, applies inactive classes (text-text-primary + hover:bg-accent-bg)
 * SI4: NO transition utility classes (D-5.1-10)
 * SI5: focus-visible ring uses ring-accent
 * SI6: SidebarItemDisabled renders a <button> with disabled + aria-disabled="true" + cursor-not-allowed; no Link/a rendered
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock TanStack Router
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

import { SidebarItem, SidebarItemDisabled } from './SidebarItem.js'

beforeEach(() => {
  mockMatchRoute.mockReset()
})

describe('SidebarItem', () => {
  it('SI1: renders a Link with the `to` prop forwarded', () => {
    mockMatchRoute.mockReturnValue(false)
    render(<SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />)
    const link = screen.getByRole('link')
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/settings')
  })

  it('SI2: active state applies bg-accent-bg-strong + text-white when route matches', () => {
    mockMatchRoute.mockReturnValue({ projectId: undefined })
    const { container } = render(
      <SidebarItem to="/" icon={<span>icon</span>} label="Projects" />,
    )
    const link = container.querySelector('a')!
    expect(link.className).toContain('bg-accent-bg-strong')
    expect(link.className).toContain('text-white')
  })

  it('SI3: inactive state applies text-text-primary + hover:bg-accent-bg when not matching', () => {
    mockMatchRoute.mockReturnValue(false)
    const { container } = render(
      <SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />,
    )
    const link = container.querySelector('a')!
    expect(link.className).toContain('text-text-primary')
    expect(link.className).toContain('hover:bg-accent-bg')
  })

  it('SI4: NO transition utility classes (D-5.1-10)', () => {
    mockMatchRoute.mockReturnValue(false)
    const { container } = render(
      <SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />,
    )
    const link = container.querySelector('a')!
    expect(link.className).not.toContain('transition')
  })

  it('SI5: focus-visible ring uses ring-accent', () => {
    mockMatchRoute.mockReturnValue(false)
    const { container } = render(
      <SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />,
    )
    const link = container.querySelector('a')!
    expect(link.className).toContain('ring-accent')
  })
})

describe('SidebarItemDisabled', () => {
  it('SI6: renders a disabled <button> with aria-disabled="true" + cursor-not-allowed; no <a>', () => {
    render(<SidebarItemDisabled icon={<span>icon</span>} label="Skills" />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDefined()
    expect(btn.getAttribute('disabled')).toBeDefined()
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.className).toContain('cursor-not-allowed')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('SI6b: SidebarItemDisabled renders the label text', () => {
    render(<SidebarItemDisabled icon={<span>icon</span>} label="Reviews" />)
    expect(screen.getByText('Reviews')).toBeDefined()
  })
})

describe('D-6.1-04 ARIA additions', () => {
  it('SidebarItem on active route carries aria-current="page"', () => {
    mockMatchRoute.mockReturnValue({ matched: true })
    const { container } = render(
      <SidebarItem to="/" icon={<span>icon</span>} label="Projects" />,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('SidebarItem on inactive route does NOT carry aria-current', () => {
    mockMatchRoute.mockReturnValue(false)
    const { container } = render(
      <SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-current')).toBeNull()
  })

  it('SidebarItemDisabled carries aria-label suffixed with "section, available in Phase 6"', () => {
    render(<SidebarItemDisabled icon={<span />} label="Skills" />)
    expect(
      screen.getByRole('button', { name: /Skills section, available in Phase 6/i }),
    ).toBeInTheDocument()
  })
})
