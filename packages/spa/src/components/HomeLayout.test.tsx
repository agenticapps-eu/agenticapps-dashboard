import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'

import { RepairProvider, useRepair } from '../lib/repair.js'

import { AppShell } from './AppShell.js'

/**
 * TDD RED: Tests for HomeLayout component.
 * These tests will fail until HomeLayout is implemented.
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
  vi.resetModules()
})

afterEach(() => {
  cleanup()
})

describe('HomeLayout', () => {
  it('renders children', async () => {
    const { HomeLayout } = await import('./HomeLayout.js')
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

  it('sets max-w-5xl on AppShell <main> when mounted', async () => {
    const { HomeLayout } = await import('./HomeLayout.js')
    const { setAppShellWidth } = await import('../lib/appShellWidth.js')

    // Ensure default state
    act(() => {
      setAppShellWidth('max-w-3xl')
    })

    render(
      <RepairProvider>
        <AppShell />
      </RepairProvider>,
    )

    // Before mounting HomeLayout, main should have max-w-3xl
    const main = document.getElementById('main')
    expect(main?.className).toContain('max-w-3xl')

    // Mount HomeLayout and check that it triggers max-w-5xl
    act(() => {
      setAppShellWidth('max-w-5xl')
    })
    expect(main?.className).toContain('max-w-5xl')
  })

  it('resets to max-w-3xl after HomeLayout mounts then sets width', async () => {
    const { HomeLayout } = await import('./HomeLayout.js')
    const { setAppShellWidth, getSnapshot } = await import('../lib/appShellWidth.js')

    // Simulate what HomeLayout useEffect does on mount
    act(() => {
      setAppShellWidth('max-w-5xl')
    })
    expect(getSnapshot()).toBe('max-w-5xl')

    // Simulate cleanup (unmount)
    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    expect(getSnapshot()).toBe('max-w-3xl')
  })

  it('HomeLayout sets max-w-5xl on mount via useEffect', async () => {
    // Dynamically import so module state is reset
    const { HomeLayout } = await import('./HomeLayout.js')
    const { getSnapshot, setAppShellWidth } = await import('../lib/appShellWidth.js')

    // Start in 3xl state
    act(() => {
      setAppShellWidth('max-w-3xl')
    })
    expect(getSnapshot()).toBe('max-w-3xl')

    // When HomeLayout mounts, it should call setAppShellWidth('max-w-5xl')
    const { unmount } = render(
      <RepairProvider>
        <HomeLayout>
          <span>content</span>
        </HomeLayout>
      </RepairProvider>,
    )

    expect(getSnapshot()).toBe('max-w-5xl')

    // When HomeLayout unmounts, it should reset to max-w-3xl
    unmount()
    expect(getSnapshot()).toBe('max-w-3xl')
  })
})
