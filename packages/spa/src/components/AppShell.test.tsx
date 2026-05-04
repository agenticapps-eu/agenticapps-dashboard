import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RepairProvider, useRepair } from '../lib/repair.js'
import { setAppShellWidth } from '../lib/appShellWidth.js'

import { AppShell } from './AppShell.js'

// Mock all router primitives used transitively by AppShell → Header → Link
// and AppShell → RepairBanner → useNavigate.
// We spread importActual so the mock is transparent except for the pieces we need.
const mockNavigate = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    // Outlet renders nothing (no routes registered in unit-test scope)
    Outlet: () => null,
    // Link renders a plain <a> so Header text is accessible
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => mockNavigate,
  }
})

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
})

afterEach(() => {
  cleanup()
})

/** Renders AppShell inside RepairProvider + QueryClientProvider; returns getter for the RepairBus */
function renderAppShell() {
  let hookResult: ReturnType<typeof useRepair> | undefined

  function Consumer() {
    hookResult = useRepair()
    return null
  }

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={qc}>
      <RepairProvider>
        <Consumer />
        <AppShell />
      </RepairProvider>
    </QueryClientProvider>,
  )

  return () => hookResult!
}

describe('AppShell', () => {
  it("renders Header with verbatim brand label 'AgenticApps Dashboard'", () => {
    renderAppShell()
    expect(screen.getByText('AgenticApps Dashboard')).toBeInTheDocument()
  })

  it("skip-link targets id='main' on <main>", () => {
    renderAppShell()
    const main = document.getElementById('main')
    expect(main).not.toBeNull()
    expect(main?.tagName.toLowerCase()).toBe('main')
  })

  it('RepairBanner is mounted in the banner-mount slot but renders null when needsRepair=false (default)', () => {
    renderAppShell()
    // When needsRepair is false, RepairBanner returns null — no banner text
    expect(screen.queryByText('Agent token rejected.')).toBeNull()
    // The slot div is still present in the DOM even when banner is hidden
    const slot = document.querySelector('[data-slot="banner-mount"]')
    expect(slot).not.toBeNull()
  })

  it('RepairBanner appears when setNeedsRepair(true) is called', () => {
    const getHook = renderAppShell()
    // Banner should be hidden initially
    expect(screen.queryByRole('status')).toBeNull()
    // Trigger repair state
    act(() => {
      getHook().setNeedsRepair(true)
    })
    // Banner should now be visible with verbatim copy
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Agent token rejected.')).toBeInTheDocument()
  })

  it('<main> has max-w-3xl by default (appShellWidth default)', () => {
    // Ensure default width state
    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    renderAppShell()
    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-3xl')
    expect(main?.className).not.toContain('max-w-5xl')
  })

  it('<main> switches to max-w-5xl when setAppShellWidth("max-w-5xl") is called', () => {
    // Ensure default width state
    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    renderAppShell()
    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-3xl')

    act(() => {
      setAppShellWidth('max-w-5xl')
    })
    expect(main?.className).toContain('max-w-5xl')
    expect(main?.className).not.toContain('max-w-3xl')
  })

  it('<main> resets to max-w-3xl after width override is cleared', () => {
    act(() => {
      setAppShellWidth('max-w-5xl')
    })
    renderAppShell()
    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-5xl')

    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    expect(main?.className).toContain('max-w-3xl')
    expect(main?.className).not.toContain('max-w-5xl')
  })
})
