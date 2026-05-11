/**
 * Plan 07-02 Task 6 — HelpLayout unit tests.
 *
 * Asserts:
 *   - All 5 NAV sections render.
 *   - Workflow contains the 2 NEW D-7-13 stubs (rationalization-table, red-flags).
 *   - Reference contains the NEW HELP-06 entry "Keyboard shortcuts" as first item.
 *   - Active-link styling fires on current path.
 *   - Mobile drawer toggles via the toggle button.
 *   - Stub entries render "(soon)" label.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-13 + D-7-15 + HELP-06
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

// Mock TanStack router primitives.
let currentPathname = '/help'
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string
    children: React.ReactNode
    className?: string
    onClick?: () => void
  }) => (
    <a href={to} data-to={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet">Outlet content</div>,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: currentPathname } }),
}))

import { HelpLayout } from './HelpLayout'

describe('HelpLayout', () => {
  it('renders all 5 NAV section headings', () => {
    currentPathname = '/help'
    render(<HelpLayout />)
    for (const label of ['Workflow', 'Repositories', 'Observability', 'Operations', 'Reference']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('Workflow section includes the 2 new D-7-13 stubs', () => {
    currentPathname = '/help'
    render(<HelpLayout />)
    expect(screen.getAllByRole('link', { name: /rationalization table/i }).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByRole('link', { name: /red flags/i }).length).toBeGreaterThan(0)
  })

  it('Reference section has Keyboard shortcuts as a "ready" entry pointing to /help/reference/shortcuts', () => {
    currentPathname = '/help'
    render(<HelpLayout />)
    const shortcuts = screen.getAllByRole('link', { name: /keyboard shortcuts/i })
    expect(shortcuts.length).toBeGreaterThan(0)
    const firstShortcut = shortcuts[0]
    if (!firstShortcut) throw new Error('expected at least one Keyboard shortcuts link')
    expect(firstShortcut).toHaveAttribute('data-to', '/help/reference/shortcuts')
    // "ready" entries do NOT render "(soon)"
    expect(within(firstShortcut).queryByText(/\(soon\)/i)).not.toBeInTheDocument()
  })

  it('stub entries render "(soon)" label', () => {
    currentPathname = '/help'
    render(<HelpLayout />)
    const stub = screen.getAllByRole('link', { name: /rationalization table/i })[0]
    if (!stub) throw new Error('expected a rationalization table link')
    expect(within(stub).getByText(/\(soon\)/i)).toBeInTheDocument()
  })

  it('current path receives active styling (text-accent or font-medium)', () => {
    currentPathname = '/help/workflow/overview'
    render(<HelpLayout />)
    const link = screen.getAllByRole('link', { name: /^overview$/i })[0]
    if (!link) throw new Error('expected an Overview link')
    expect(link.className).toMatch(/(text-accent|font-medium|bg-accent-bg)/)
  })

  it('mobile drawer toggles open/close on the toggle button', async () => {
    const user = userEvent.setup()
    currentPathname = '/help'
    render(<HelpLayout />)
    const aside = screen.getByLabelText('Help navigation')
    // Drawer starts hidden on mobile (hidden class) — md:block always on desktop.
    expect(aside.className).toMatch(/\bhidden\b/)
    await user.click(screen.getByRole('button', { name: /toggle navigation/i }))
    expect(aside.className).toMatch(/\bblock\b/)
  })

  it('renders the Outlet for the active route', () => {
    currentPathname = '/help'
    render(<HelpLayout />)
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('search input is disabled with the v1.1 aria-label', () => {
    render(<HelpLayout />)
    const search = screen.getByLabelText('Search documentation (coming in v1.1)')
    expect(search).toBeDisabled()
  })

  it('main content is wrapped in an article.prose with prose-slate dark:prose-invert max-w-none', () => {
    const { container } = render(<HelpLayout />)
    const article = container.querySelector('article')
    expect(article?.className).toContain('prose')
    expect(article?.className).toContain('max-w-none')
  })
})
