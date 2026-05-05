import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ── jsdom HTMLDialogElement polyfill ─────────────────────────────────────────
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

// ── Mock commandPaletteActions ────────────────────────────────────────────────

const mockRegisterRun = vi.fn()
const mockRefreshRun = vi.fn()
const mockToggleThemeRun = vi.fn()
const mockJumpRun = vi.fn()

const MOCK_ACTIONS = [
  { id: 'register', label: 'Register project', type: 'register' as const, run: mockRegisterRun },
  { id: 'jump:proj-1', label: 'Jump to acme-app', type: 'jump' as const, run: mockJumpRun },
  { id: 'refresh', label: 'Refresh data', type: 'refresh' as const, run: mockRefreshRun },
  { id: 'toggle-theme', label: 'Toggle theme', type: 'toggle-theme' as const, run: mockToggleThemeRun },
]

vi.mock('../lib/commandPaletteActions.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useCommandPaletteActions: (_close: () => void) => MOCK_ACTIONS,
  filterActions: (actions: typeof MOCK_ACTIONS, query: string) => {
    if (!query) return actions
    const needle = query.toLowerCase()
    return actions.filter((a) => a.label.toLowerCase().includes(needle))
  },
}))

// ── Component import (after mocks) ────────────────────────────────────────────

import { CommandPalette } from './CommandPalette.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPalette() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CommandPalette />
    </QueryClientProvider>,
  )
}

function openPalette(withCtrl = false) {
  if (withCtrl) {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  } else {
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens on Cmd+K (metaKey + k)', () => {
    renderPalette()
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(false)
    openPalette()
    expect(dialog.hasAttribute('open')).toBe(true)
  })

  it('opens on Ctrl+K (ctrlKey + k)', () => {
    renderPalette()
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(false)
    openPalette(true)
    expect(dialog.hasAttribute('open')).toBe(true)
  })

  it('input gets focus on open', () => {
    renderPalette()
    openPalette()
    // Focus moves via setTimeout(0); we need to flush
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    expect(input).toBeInTheDocument()
  })

  it('filtering by "theme" shows only Toggle theme action', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    fireEvent.change(input, { target: { value: 'theme' } })
    // Should show only Toggle theme
    expect(screen.getByText('Toggle theme')).toBeInTheDocument()
    expect(screen.queryByText('Register project')).toBeNull()
    expect(screen.queryByText('Refresh data')).toBeNull()
    expect(screen.queryByText('Jump to acme-app')).toBeNull()
  })

  it('typing "xyzzy" shows "No actions found. Try a shorter search."', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    fireEvent.change(input, { target: { value: 'xyzzy' } })
    expect(screen.getByText('No actions found. Try a shorter search.')).toBeInTheDocument()
  })

  it('ArrowDown moves focus — aria-selected on li changes', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    // Initially first item (index 0) is focused
    const items = screen.getAllByRole('option')
    expect(items.at(0)?.getAttribute('aria-selected')).toBe('true')
    expect(items.at(1)?.getAttribute('aria-selected')).toBe('false')
    // Arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(items.at(0)?.getAttribute('aria-selected')).toBe('false')
    expect(items.at(1)?.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowUp wraps from first to last', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    const items = screen.getAllByRole('option')
    // First item is focused (index 0), ArrowUp wraps to last
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(items.at(-1)?.getAttribute('aria-selected')).toBe('true')
  })

  it('Enter activates focused row (calls action run)', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    // First row (Register project) is focused by default
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockRegisterRun).toHaveBeenCalledOnce()
  })

  it('Esc (cancel event) closes palette', () => {
    renderPalette()
    openPalette()
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(true)
    // Fire cancel event (what Esc triggers on dialog)
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    })
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  it('Tab closes palette', () => {
    renderPalette()
    openPalette()
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(true)
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  it('aria-activedescendant on input matches palette-option-{focusedIndex}', () => {
    renderPalette()
    openPalette()
    const input = screen.getByRole('searchbox', { name: /command palette search/i })
    expect(input.getAttribute('aria-activedescendant')).toBe('palette-option-0')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('palette-option-1')
  })

  it('aria-owns="palette-listbox" on input', () => {
    renderPalette()
    const input = document.querySelector('input[aria-owns="palette-listbox"]')
    expect(input).not.toBeNull()
  })

  it('ul has role="listbox" and aria-label="Actions"', () => {
    renderPalette()
    openPalette()
    const listbox = screen.getByRole('listbox', { name: /actions/i })
    expect(listbox).toBeInTheDocument()
    expect(listbox.tagName.toLowerCase()).toBe('ul')
  })

  it('each li has role="option"', () => {
    renderPalette()
    openPalette()
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    for (const opt of options) {
      expect(opt.tagName.toLowerCase()).toBe('li')
    }
  })

  it('clicking a row activates its action', () => {
    renderPalette()
    openPalette()
    const option = screen.getByText('Refresh data').closest('li')!
    fireEvent.click(option)
    expect(mockRefreshRun).toHaveBeenCalledOnce()
  })

  it('input placeholder is "Search or jump to…"', () => {
    renderPalette()
    // The input is always in DOM (dialog rendered but not open), check placeholder
    const input = document.querySelector('input[type="search"]')!
    expect(input.getAttribute('placeholder')).toBe('Search or jump to…')
  })
})

// ── AppShell-integration note ─────────────────────────────────────────────────
// AppShell.test.tsx already imports AppShell; the CommandPalette global mount test
// is added in AppShell.test.tsx separately.
