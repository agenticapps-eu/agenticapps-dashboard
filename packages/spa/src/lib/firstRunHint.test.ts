/**
 * firstRunHint.test.ts — TDD tests for useFirstRunHint hook (Plan 06-03 Task 1).
 *
 * FRH1: localStorage empty -> shouldShow === true
 * FRH2: after dismiss(), shouldShow === false
 * FRH3: localStorage = 'true' on mount -> shouldShow === false
 * FRH4: localStorage = 'false' on mount -> shouldShow === true
 * FRH5: dismiss() writes 'true' to localStorage key 'shortcuts_hint_shown'
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useFirstRunHint } from './firstRunHint.js'

beforeEach(() => {
  localStorage.clear()
})

describe('useFirstRunHint', () => {
  it('FRH1: returns shouldShow=true when localStorage is empty', () => {
    const { result } = renderHook(() => useFirstRunHint())
    expect(result.current.shouldShow).toBe(true)
  })

  it('FRH2: shouldShow becomes false after dismiss() is called', () => {
    const { result } = renderHook(() => useFirstRunHint())
    expect(result.current.shouldShow).toBe(true)
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.shouldShow).toBe(false)
  })

  it('FRH3: returns shouldShow=false when localStorage key is "true"', () => {
    localStorage.setItem('shortcuts_hint_shown', 'true')
    const { result } = renderHook(() => useFirstRunHint())
    expect(result.current.shouldShow).toBe(false)
  })

  it('FRH4: returns shouldShow=true when localStorage key is "false"', () => {
    localStorage.setItem('shortcuts_hint_shown', 'false')
    const { result } = renderHook(() => useFirstRunHint())
    expect(result.current.shouldShow).toBe(true)
  })

  it('FRH5: dismiss() writes "true" to localStorage key "shortcuts_hint_shown"', () => {
    const { result } = renderHook(() => useFirstRunHint())
    act(() => {
      result.current.dismiss()
    })
    expect(localStorage.getItem('shortcuts_hint_shown')).toBe('true')
  })
})
