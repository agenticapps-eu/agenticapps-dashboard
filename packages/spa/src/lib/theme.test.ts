import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme, applyTheme } from './theme.js'

function makeMatchMedia(matches: boolean) {
  return vi.fn(() => ({
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
  vi.stubGlobal('matchMedia', makeMatchMedia(false))
})

describe('Plan 02: useTheme — default is dark when localStorage empty (D-02)', () => {
  it('default is dark when localStorage empty (D-02)', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.choice).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('Plan 02: useTheme — persists choice to agentic-dashboard:theme key (D-03)', () => {
  it('persists choice to agentic-dashboard:theme key (D-03)', () => {
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setChoice('light')
    })
    expect(localStorage.getItem('agentic-dashboard:theme')).toBe('light')
  })
})

describe('Plan 02: useTheme — system honors prefers-color-scheme via matchMedia', () => {
  it('system honors prefers-color-scheme via matchMedia (matches=false removes dark class)', () => {
    vi.stubGlobal('matchMedia', makeMatchMedia(false))
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setChoice('system')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('Plan 02: useTheme — toggles <html> class.dark on apply', () => {
  it('toggles <html> class.dark: light removes dark, dark adds dark', () => {
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setChoice('light')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    act(() => {
      result.current.setChoice('dark')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('Plan 02: useTheme — cleans up matchMedia listener on choice change', () => {
  it('cleans up matchMedia listener when switching away from system', () => {
    const removeEventListener = vi.fn()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setChoice('system')
    })
    act(() => {
      result.current.setChoice('dark')
    })
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

describe('applyTheme', () => {
  it('applyTheme(dark) adds dark class', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applyTheme(light) removes dark class', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
