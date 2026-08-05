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
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

describe('design-system → State Is Never Signalled By Colour Alone (navigation-current)', () => {
  /**
   * Render one item active and one inactive under a given appearance and
   * return the background-fill utilities each carries. `hover:`-prefixed
   * classes are excluded deliberately: a fill that appears only under the
   * pointer is not a channel for a reader who is not pointing at it.
   */
  function fillsByState(appearance: 'light' | 'dark'): {
    active: string[]
    inactive: string[]
    activeAppearanceOverrides: string[]
    activeAriaCurrent: string | null
  } {
    document.documentElement.classList.toggle('dark', appearance === 'dark')

    mockMatchRoute.mockReturnValue({ matched: true })
    const { container: activeEl } = render(
      <SidebarItem to="/fleet" icon={<span>icon</span>} label="Fleet" />,
    )
    const activeLink = activeEl.querySelector('a')!

    mockMatchRoute.mockReturnValue(false)
    const { container: inactiveEl } = render(
      <SidebarItem to="/settings" icon={<span>icon</span>} label="Settings" />,
    )
    const inactiveLink = inactiveEl.querySelector('a')!

    const fills = (el: Element): string[] =>
      Array.from(el.classList).filter((c) => c.startsWith('bg-'))

    return {
      active: fills(activeLink),
      inactive: fills(inactiveLink),
      activeAppearanceOverrides: Array.from(activeLink.classList).filter((c) =>
        c.startsWith('dark:bg-'),
      ),
      activeAriaCurrent: activeLink.getAttribute('aria-current'),
    }
  }

  afterEach(() => {
    document.documentElement.classList.remove('dark')
    cleanup()
  })

  it.each(['light', 'dark'] as const)(
    'marks the current item with a fill the inactive item does not carry (%s)',
    (appearance) => {
      // The requirement's scenario is "no state is identified only by its
      // hue". Swapping one text colour for another would satisfy nothing: a
      // reader who does not separate purple from near-black sees two
      // identical rows. A filled pill against no pill survives that, which is
      // why the assertion is about the presence of a fill and not about which
      // colour the fill is.
      //
      // jsdom applies no stylesheet, so what is checkable here is which
      // utilities are *declared*, not what they measure on screen. Hence two
      // assertions rather than one: the fill exists unconditionally, and no
      // `dark:bg-` override exists that could take it away in the appearance
      // this product defaults to. Without the second, a single
      // `dark:bg-transparent` would satisfy a naive "has a bg- class" check
      // while leaving dark readers with a current item marked by hue alone.
      //
      // What this deliberately does NOT claim is that the fill is legible.
      // That is verify-contrast.test.ts's job and it asserts the two palettes
      // separately.
      const { active, inactive, activeAppearanceOverrides, activeAriaCurrent } =
        fillsByState(appearance)

      expect(active.length).toBeGreaterThan(0)
      expect(activeAppearanceOverrides).toEqual([])
      expect(inactive).toEqual([])
      expect(activeAriaCurrent).toBe('page')
    },
  )
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

  it('stays active across a subtree it owns', () => {
    // /repos/:id is only reachable from /fleet and belongs to it, but the
    // sidebar highlighted nothing there — so the detail page represented the
    // reader as being nowhere in the product.
    mockMatchRoute.mockImplementation((opts: { to: string; fuzzy?: boolean }) =>
      opts.to === '/repos' && opts.fuzzy === true,
    )
    render(
      <SidebarItem to="/fleet" alsoActiveFor="/repos" icon={<span />} label="Fleet readiness" />,
    )

    const link = screen.getByRole('link', { name: /Fleet readiness/ })
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.className).toContain('bg-accent-bg-strong')
  })
})
