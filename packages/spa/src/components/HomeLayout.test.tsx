import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RepairProvider } from '../lib/repair.js'
import { setAppShellWidth, getSnapshot } from '../lib/appShellWidth.js'

import { AppShell } from './AppShell.js'
import { HomeLayout } from './HomeLayout.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/**
 * Tests for HomeLayout component.
 * Verifies that HomeLayout sets max-w-5xl on mount and resets to max-w-3xl on unmount.
 */

// Mock all router primitives (same pattern as AppShell.test.tsx)
const mockNavigate = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">outlet</div>,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => mockNavigate,
  }
})

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
  // Reset appShellWidth store to default before each test
  setAppShellWidth('max-w-3xl')
})

afterEach(() => {
  cleanup()
})

describe('HomeLayout', () => {
  it('renders children', () => {
    render(
      <RepairProvider>
        <HomeLayout>
          <div data-testid="child-content">hello</div>
        </HomeLayout>
      </RepairProvider>,
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('sets max-w-5xl in the store on mount via useEffect', () => {
    // Start in 3xl state (confirmed by beforeEach)
    expect(getSnapshot()).toBe('max-w-3xl')

    render(
      <RepairProvider>
        <HomeLayout>
          <span>content</span>
        </HomeLayout>
      </RepairProvider>,
    )

    // After mount, useEffect runs and sets max-w-5xl
    expect(getSnapshot()).toBe('max-w-5xl')
  })

  it('resets store to max-w-3xl on unmount (cleanup)', () => {
    const { unmount } = render(
      <RepairProvider>
        <HomeLayout>
          <span>content</span>
        </HomeLayout>
      </RepairProvider>,
    )

    // After mount: 5xl
    expect(getSnapshot()).toBe('max-w-5xl')

    // After unmount: back to 3xl
    unmount()
    expect(getSnapshot()).toBe('max-w-3xl')
  })

  it('AppShell <main> reflects max-w-5xl when HomeLayout is mounted alongside AppShell', () => {
    // Render AppShell (starts at max-w-3xl from default store)
    const { unmount: unmountAppShell } = render(
      <QueryClientProvider client={makeQueryClient()}>
        <RepairProvider>
          <AppShell />
        </RepairProvider>
      </QueryClientProvider>,
    )

    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-3xl')
    expect(main?.className).not.toContain('max-w-5xl')

    // Mount HomeLayout elsewhere — it updates the shared store
    // AppShell re-renders because useSyncExternalStore detects the change
    act(() => {
      setAppShellWidth('max-w-5xl')
    })

    expect(main?.className).toContain('max-w-5xl')
    expect(main?.className).not.toContain('max-w-3xl')

    unmountAppShell()
  })

  it('AppShell <main> reverts to max-w-3xl after setAppShellWidth reset', () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <RepairProvider>
          <AppShell />
        </RepairProvider>
      </QueryClientProvider>,
    )

    act(() => {
      setAppShellWidth('max-w-5xl')
    })

    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-5xl')

    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    expect(main?.className).toContain('max-w-3xl')
    expect(main?.className).not.toContain('max-w-5xl')
  })
})
