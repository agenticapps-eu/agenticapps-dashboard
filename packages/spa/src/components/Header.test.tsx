import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock router primitives so <Link> and <Header> render without a full router.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, className, 'aria-label': ariaLabel }: {
      children?: React.ReactNode
      to: string
      className?: string
      'aria-label'?: string
    }) => React.createElement('a', { href: to, className, 'aria-label': ariaLabel }, children),
  }
})

import { Header } from './Header.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('Header', () => {
  let qc: QueryClient

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    qc.clear()
    cleanup()
  })

  // -----------------------------------------------------------------------
  // Brand label (existing behavior unchanged)
  // -----------------------------------------------------------------------
  it("renders verbatim brand label 'AgenticApps Dashboard'", () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    expect(screen.getByText('AgenticApps Dashboard')).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // ThemeChip still renders (existing behavior unchanged)
  // -----------------------------------------------------------------------
  it('renders ThemeChip (theme toggle button)', () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    // ThemeChip renders a button with data-testid or aria — check for any button in the header
    // that's not the Settings link. ThemeChip renders a button with a role.
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  // -----------------------------------------------------------------------
  // Settings link still renders (existing behavior unchanged)
  // -----------------------------------------------------------------------
  it('renders settings link with aria-label="Settings"', () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // New: status span with aria-hidden="true"
  // -----------------------------------------------------------------------
  it('status span has aria-hidden="true"', () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    // The status span contains "projects · " — find by its text content
    const header = document.querySelector('header')
    const statusSpan = header?.querySelector('[aria-hidden="true"]')
    expect(statusSpan).not.toBeNull()
  })

  // -----------------------------------------------------------------------
  // New: "— projects · refreshing…" when no queries have completed
  // -----------------------------------------------------------------------
  it('shows "— projects · refreshing…" when no queries have completed', () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    // The status text should include "— projects · refreshing…"
    expect(screen.getByText(/— projects · refreshing…/)).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // New: shows project count when registry data is seeded
  // -----------------------------------------------------------------------
  it('shows project count when registry has 3 entries', async () => {
    const now = Date.now()
    qc.setQueryData(['registry'], [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    // Set dataUpdatedAt so refreshLabel shows a time rather than "refreshing…"
    const registryQuery = qc.getQueryCache().find({ queryKey: ['registry'] })
    if (registryQuery) {
      registryQuery.state.dataUpdatedAt = now - 5_000
    }

    render(React.createElement(Header), { wrapper: makeWrapper(qc) })

    expect(screen.getByText(/3 projects · last refresh/)).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // New: the status span renders between brand link and spacer
  // -----------------------------------------------------------------------
  it('status span contains "projects ·" text', () => {
    render(React.createElement(Header), { wrapper: makeWrapper(qc) })
    const header = document.querySelector('header')
    expect(header?.textContent).toContain('projects ·')
  })
})
