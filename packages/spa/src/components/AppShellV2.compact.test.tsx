/**
 * AppShellV2.compact.test.tsx — the shell below the declared `xs` boundary.
 *
 * The defect this covers was measured in a real browser at a 485px client
 * width: `/fleet` scrolled horizontally to 752px and `/changes` to 642px, both
 * because the shell reserved a fixed 240px sidebar track and the top bar had a
 * minimum width of its own. Every v2 route failed "no page-level horizontal
 * scrolling", so this is a shell fix rather than a board fix.
 *
 * jsdom cannot measure overflow, so these assert the *structure* that removes
 * it — one grid column, no reserved sidebar track, a shrinkable top bar — and
 * the width itself is verified in the browser.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/commandPaletteActions.js', () => ({
  useCommandPaletteActions: () => [],
  filterActions: () => [],
}))
vi.mock('../lib/registry.js', () => ({
  useRegistryList: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('../lib/firstRunHint.js', () => ({
  useFirstRunHint: () => ({ shouldShow: false, dismiss: vi.fn() }),
}))
// The same router surface AppShellV2.test.tsx stubs — the shell's descendants
// call useMatchRoute / useRouterState for active-link state, and an unmocked
// one throws outside a RouterProvider.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet" />,
    Link: ({
      children,
      to,
      className,
      'aria-label': ariaLabel,
    }: {
      children: React.ReactNode
      to: string
      className?: string
      'aria-label'?: string
    }) => (
      <a href={to} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn().mockResolvedValue(undefined),
    useMatchRoute: () => () => false,
    useMatches: () => [{ id: '__root__', fullPath: '/', params: {} }],
    useRouterState: () => ({ location: { pathname: '/' } }),
  }
})

vi.mock('./ThemeChip.js', () => ({
  ThemeChip: () => <button type="button" data-testid="theme-chip">theme</button>,
}))

const layout = vi.hoisted(() => ({ compact: false }))
vi.mock('./ui/shellLayout.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ui/shellLayout.js')>()),
  useCompactShell: () => layout.compact,
}))

import { RepairProvider } from '../lib/repair.js'
import { AppShellV2 } from './AppShellV2.js'

afterEach(cleanup)
beforeEach(() => {
  layout.compact = false
})

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RepairProvider>
        <AppShellV2 />
      </RepairProvider>
    </QueryClientProvider>,
  )
}

describe('the wide shell', () => {
  it('reserves a fixed sidebar track beside the content', () => {
    renderShell()
    const shell = screen.getByTestId('app-shell-v2')
    expect(shell.style.gridTemplateColumns).toBe('240px 1fr')
  })

  it('shows the navigation without asking', () => {
    renderShell()
    expect(screen.getByLabelText('Primary navigation')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /open navigation/iu })).toBeNull()
  })

  it('labels the command palette trigger in words', () => {
    renderShell()
    // The full control, with its visible text, at widths that have room for it.
    expect(screen.getByText('Search…')).toBeTruthy()
  })
})

describe('the compact shell', () => {
  beforeEach(() => {
    layout.compact = true
  })

  it('reserves no sidebar track, so the content column is the whole width', () => {
    renderShell()
    // The 240px track is what pushed every v2 route past the viewport.
    expect(screen.getByTestId('app-shell-v2').style.gridTemplateColumns).toBe('1fr')
  })

  it('does not render the sidebar inline', () => {
    renderShell()
    expect(screen.queryByLabelText('Primary navigation')).toBeNull()
  })

  it('keeps navigation reachable behind a control', () => {
    renderShell()
    // Hiding navigation outright would trade one requirement for a worse
    // failure, so the button is the point of the whole change.
    const open = screen.getByRole('button', { name: /open navigation/iu })
    fireEvent.click(open)
    expect(screen.getByLabelText('Primary navigation')).toBeTruthy()
  })

  it('closes the navigation again', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /open navigation/iu }))
    fireEvent.click(screen.getByRole('button', { name: /close navigation/iu }))
    expect(screen.queryByLabelText('Primary navigation')).toBeNull()
  })

  it('closes the navigation when a destination is chosen', () => {
    // Otherwise the panel covers the page the reader just asked for.
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /open navigation/iu }))
    fireEvent.click(screen.getByRole('link', { name: /Workflow/u }))
    expect(screen.queryByLabelText('Primary navigation')).toBeNull()
  })

  it('shrinks the command palette trigger to its icon', () => {
    renderShell()
    // The trigger's text and shortcut hint are what gave the top bar a minimum
    // width wider than the viewport. The accessible name survives.
    expect(screen.queryByText('Search…')).toBeNull()
    expect(screen.getByRole('button', { name: /open command palette/iu })).toBeTruthy()
  })

  it('still renders the main content region', () => {
    renderShell()
    expect(screen.getByTestId('outlet')).toBeTruthy()
  })
})
