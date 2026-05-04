import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock registry so we can control the returned list
const mockRegistryData = vi.fn<() => { data: unknown }>()
vi.mock('./registry.js', () => ({
  useRegistryList: () => mockRegistryData(),
}))

// Mock theme
const mockSetChoice = vi.fn()
const mockChoice = { current: 'dark' as 'dark' | 'light' | 'system' }
vi.mock('./theme.js', () => ({
  useTheme: () => ({ choice: mockChoice.current, setChoice: mockSetChoice }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

import { filterActions, useCommandPaletteActions, type PaletteAction } from './commandPaletteActions.js'

function buildWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

// ── filterActions pure function tests ─────────────────────────────────────────

const STATIC_ACTIONS: PaletteAction[] = [
  { id: 'register', label: 'Register project', type: 'register', run: vi.fn() },
  { id: 'jump:proj-1', label: 'Jump to acme-app', type: 'jump', run: vi.fn() },
  { id: 'refresh', label: 'Refresh data', type: 'refresh', run: vi.fn() },
  { id: 'toggle-theme', label: 'Toggle theme', type: 'toggle-theme', run: vi.fn() },
]

describe('filterActions', () => {
  it('returns full list when query is empty string', () => {
    expect(filterActions(STATIC_ACTIONS, '')).toEqual(STATIC_ACTIONS)
  })

  it('filters to only jump actions when query is "jump"', () => {
    const result = filterActions(STATIC_ACTIONS, 'jump')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('jump')
  })

  it('is case-insensitive — "THEME" matches "Toggle theme"', () => {
    const result = filterActions(STATIC_ACTIONS, 'THEME')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('toggle-theme')
  })

  it('returns empty array for a query with no matches', () => {
    expect(filterActions(STATIC_ACTIONS, 'xyzzy')).toHaveLength(0)
  })
})

// ── useCommandPaletteActions hook tests ──────────────────────────────────────

describe('useCommandPaletteActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChoice.current = 'dark'
  })

  it('with empty registry returns 3 static actions: Register, Refresh, Toggle theme', () => {
    mockRegistryData.mockReturnValue({ data: [] })
    const close = vi.fn()
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })
    expect(result.current).toHaveLength(3)
    expect(result.current[0].id).toBe('register')
    expect(result.current[1].id).toBe('refresh')
    expect(result.current[2].id).toBe('toggle-theme')
  })

  it('with 2-item registry returns 5 actions in order: Register, Jump A, Jump B, Refresh, Toggle theme', () => {
    mockRegistryData.mockReturnValue({
      data: [
        { id: 'proj-a', name: 'acme-app' },
        { id: 'proj-b', name: 'beta-app' },
      ],
    })
    const close = vi.fn()
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })
    expect(result.current).toHaveLength(5)
    expect(result.current[0].id).toBe('register')
    expect(result.current[1].id).toBe('jump:proj-a')
    expect(result.current[1].label).toBe('Jump to acme-app')
    expect(result.current[2].id).toBe('jump:proj-b')
    expect(result.current[2].label).toBe('Jump to beta-app')
    expect(result.current[3].id).toBe('refresh')
    expect(result.current[4].id).toBe('toggle-theme')
  })

  it('Register action dispatches palette:open-register CustomEvent on window AND calls close', () => {
    mockRegistryData.mockReturnValue({ data: [] })
    const close = vi.fn()
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })

    const dispatchedEvents: Event[] = []
    const listener = (e: Event) => dispatchedEvents.push(e)
    window.addEventListener('palette:open-register', listener)

    const registerAction = result.current.find((a) => a.id === 'register')!
    registerAction.run()

    expect(dispatchedEvents).toHaveLength(1)
    expect(dispatchedEvents[0].type).toBe('palette:open-register')
    expect(close).toHaveBeenCalledOnce()

    window.removeEventListener('palette:open-register', listener)
  })

  it('Jump action calls navigate with projectId AND calls close', () => {
    mockRegistryData.mockReturnValue({
      data: [{ id: 'proj-123', name: 'my-project' }],
    })
    const close = vi.fn()
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })

    const jumpAction = result.current.find((a) => a.type === 'jump')!
    jumpAction.run()

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/projects/$projectId',
      params: { projectId: 'proj-123' },
    })
    expect(close).toHaveBeenCalledOnce()
  })

  it('Refresh action calls invalidateQueries on [registry] AND [overview] AND calls close', () => {
    mockRegistryData.mockReturnValue({ data: [] })
    const close = vi.fn()
    const { wrapper, qc } = buildWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })

    const refreshAction = result.current.find((a) => a.id === 'refresh')!
    refreshAction.run()

    // Should have been called with registry key and overview key
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['registry'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['overview'] })
    expect(close).toHaveBeenCalledOnce()
  })

  it('Toggle theme cycles dark → light', () => {
    mockRegistryData.mockReturnValue({ data: [] })
    mockChoice.current = 'dark'
    const close = vi.fn()
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCommandPaletteActions(close), { wrapper })

    const themeAction = result.current.find((a) => a.id === 'toggle-theme')!
    themeAction.run()

    expect(mockSetChoice).toHaveBeenCalledWith('light')
  })
})
