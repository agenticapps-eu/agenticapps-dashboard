/**
 * AppShellV2.test.tsx — TDD tests for AppShellV2 (Plan 05.1-02 Task 2).
 *
 * AV1: renders Sidebar (aria-label="Primary navigation")
 * AV2: renders TopBar (60px header)
 * AV3: renders skip-to-main-content link (<a href="#main">)
 * AV4: RepairBanner mounted between TopBar and main; renders null when needsRepair=false
 * AV5: RepairBanner appears below TopBar when setNeedsRepair(true)
 * AV6: CommandPalette listbox mounted (aria-label="Actions" present)
 * AV7: NO transition classes on shell composition
 * AV8: ToastProvider wraps AppShellV2 (IMP-03 / PD-11.1-04)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { RepairProvider, useRepair } from '../lib/repair.js'
import { useToast } from './ui/Toast.js'

// Mock commandPaletteActions (same pattern as AppShell.test.tsx)
vi.mock('../lib/commandPaletteActions.js', () => ({
  useCommandPaletteActions: () => [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  filterActions: (..._args: any[]) => [],
}))

// Mock registry so Sidebar doesn't need a QueryClient for useRegistryList
vi.mock('../lib/registry.js', () => ({
  useRegistryList: () => ({ data: [], isLoading: false, isError: false }),
}))

// Mock useFirstRunHint — hint already shown so HelpOverlay does not auto-appear
// (prevents false-positive role="status" hits in AV5 which checks RepairBanner)
vi.mock('../lib/firstRunHint.js', () => ({
  useFirstRunHint: () => ({ shouldShow: false, dismiss: vi.fn() }),
}))

// HTMLDialogElement polyfill for jsdom
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

const mockNavigate = vi.fn().mockResolvedValue(undefined)

const MockOutlet = vi.fn(() => null as React.ReactNode)

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Outlet: (...args: Parameters<typeof MockOutlet>) => MockOutlet(...args),
    Link: ({ children, to, className, 'aria-label': ariaLabel }: { children: React.ReactNode; to: string; className?: string; 'aria-label'?: string }) => (
      <a href={to} className={className} aria-label={ariaLabel}>{children}</a>
    ),
    useNavigate: () => mockNavigate,
    useMatchRoute: () => () => false,
    useMatches: () => [{ id: '__root__', fullPath: '/', params: {} }],
    useRouterState: () => ({ location: { pathname: '/' } }),
  }
})

// Mock ThemeChip
vi.mock('./ThemeChip.js', () => ({
  ThemeChip: () => <button type="button" data-testid="theme-chip">theme</button>,
}))

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
})

afterEach(() => {
  cleanup()
})

function renderAppShellV2() {
  let hookResult: ReturnType<typeof useRepair> | undefined

  function Consumer() {
    hookResult = useRepair()
    return null
  }

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const { container } = render(
    <QueryClientProvider client={qc}>
      <RepairProvider>
        <Consumer />
        <AppShellV2 />
      </RepairProvider>
    </QueryClientProvider>,
  )

  return { container, getHook: () => hookResult! }
}

import { AppShellV2 } from './AppShellV2.js'

describe('AppShellV2', () => {
  it('AV1: renders Sidebar <aside> with aria-label="Primary navigation"', () => {
    const { container } = renderAppShellV2()
    // <aside> has implicit ARIA role "complementary", not "navigation".
    // The internal <nav> is the navigation landmark.
    const aside = container.querySelector('aside[aria-label="Primary navigation"]')
    expect(aside).not.toBeNull()
  })

  it('AV2: renders TopBar (60px header element)', () => {
    const { container } = renderAppShellV2()
    const header = container.querySelector('header')!
    expect(header).toBeDefined()
    const hasHeight =
      header.style.height === '60px' ||
      header.getAttribute('style')?.includes('60px') ||
      header.className.includes('h-15')
    expect(hasHeight).toBe(true)
  })

  it('AV3: renders skip-to-main-content link targeting #main', () => {
    renderAppShellV2()
    const skipLink = document.querySelector('a[href="#main"]')
    expect(skipLink).not.toBeNull()
  })

  it('AV4: RepairBanner renders null when needsRepair=false (default)', () => {
    renderAppShellV2()
    expect(screen.queryByText('Agent token rejected.')).toBeNull()
    const slot = document.querySelector('[data-slot="banner-mount"]')
    expect(slot).not.toBeNull()
  })

  it('AV5: RepairBanner appears below TopBar when setNeedsRepair(true)', () => {
    const { getHook } = renderAppShellV2()
    // TopBar has an always-present role="status" aria-live region (D-6.1-04);
    // assert RepairBanner specifically by its content rather than role-only.
    expect(screen.queryByText('Agent token rejected.')).toBeNull()
    act(() => {
      getHook().setNeedsRepair(true)
    })
    expect(screen.getByText('Agent token rejected.')).toBeDefined()
  })

  it('AV6: CommandPalette listbox is globally mounted (aria-label="Actions" present)', () => {
    renderAppShellV2()
    const listbox = document.querySelector('[role="listbox"][aria-label="Actions"]')
    expect(listbox).not.toBeNull()
  })

  it('AV7: NO transition classes on the shell wrapper', () => {
    const { container } = renderAppShellV2()
    const shell = container.querySelector('[data-testid="app-shell-v2"]')
    expect(shell).not.toBeNull()
    expect(shell!.className).not.toContain('transition')
  })
})

function Probe(): React.JSX.Element {
  const t = useToast()
  return <button onClick={() => t.show({ message: 'probe' })}>fire</button>
}

describe('ToastProvider wraps AppShellV2 (IMP-03 / PD-11.1-04)', () => {
  beforeEach(() => {
    MockOutlet.mockImplementation(() => <Probe />)
  })

  afterEach(() => {
    MockOutlet.mockImplementation(() => null)
  })

  it("useToast() works for any descendant rendered through AppShellV2's Outlet", () => {
    renderAppShellV2()
    fireEvent.click(screen.getByText('fire'))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('probe'))
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('probe')
  })
})
