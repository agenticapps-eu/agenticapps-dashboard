import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'

import { RepairProvider, useRepair } from './repair.js'

function wrapper({ children }: { children: ReactNode }) {
  return <RepairProvider>{children}</RepairProvider>
}

describe('useRepair', () => {
  it('throws outside provider', () => {
    expect(() => renderHook(() => useRepair())).toThrow(/RepairProvider/)
  })

  it('default state is needsRepair=false, dismissed=false', () => {
    const { result } = renderHook(() => useRepair(), { wrapper })
    expect(result.current.needsRepair).toBe(false)
    expect(result.current.dismissed).toBe(false)
  })

  it('setNeedsRepair(true) flips needsRepair true and resets dismissed (D-06 re-show on new 401)', () => {
    const { result } = renderHook(() => useRepair(), { wrapper })
    // First dismiss to set dismissed=true
    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(true)
    // Now a new 401 arrives — setNeedsRepair(true) must reset dismissed
    act(() => result.current.setNeedsRepair(true))
    expect(result.current.needsRepair).toBe(true)
    expect(result.current.dismissed).toBe(false)
  })

  it('dismiss() sets dismissed=true but keeps needsRepair=true', () => {
    const { result } = renderHook(() => useRepair(), { wrapper })
    act(() => result.current.setNeedsRepair(true))
    act(() => result.current.dismiss())
    expect(result.current.needsRepair).toBe(true)
    expect(result.current.dismissed).toBe(true)
  })

  it('clear() resets both to false (called on /health 200)', () => {
    const { result } = renderHook(() => useRepair(), { wrapper })
    act(() => result.current.setNeedsRepair(true))
    act(() => result.current.dismiss())
    act(() => result.current.clear())
    expect(result.current.needsRepair).toBe(false)
    expect(result.current.dismissed).toBe(false)
  })

  it('setNeedsRepair identity stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useRepair(), { wrapper })
    const firstRef = result.current.setNeedsRepair
    const firstDismiss = result.current.dismiss
    const firstClear = result.current.clear
    rerender()
    rerender()
    expect(result.current.setNeedsRepair).toBe(firstRef)
    expect(result.current.dismiss).toBe(firstDismiss)
    expect(result.current.clear).toBe(firstClear)
  })

  it('setNeedsRepair identity unchanged after state mutation', () => {
    const { result } = renderHook(() => useRepair(), { wrapper })
    const originalFn = result.current.setNeedsRepair
    act(() => result.current.setNeedsRepair(true))
    act(() => result.current.setNeedsRepair(false))
    expect(result.current.setNeedsRepair).toBe(originalFn)
  })
})
