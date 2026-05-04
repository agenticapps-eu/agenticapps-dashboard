import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'

import { useLongPress } from './touchLongPress.js'

/** Simple test component that attaches useLongPress to a div. */
function LongPressTarget({
  onLongPress,
  delay,
}: {
  onLongPress: () => void
  delay?: number
}) {
  const handlers = useLongPress(onLongPress, delay)
  return <div data-testid="target" {...handlers} />
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useLongPress', () => {
  it('calls onLongPress after 500ms of uninterrupted pointerdown', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const { getByTestId } = render(<LongPressTarget onLongPress={onLongPress} />)
    const target = getByTestId('target')

    fireEvent.pointerDown(target, { clientX: 10, clientY: 10 })
    expect(onLongPress).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('does NOT call onLongPress when pointerup fires before delay', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const { getByTestId } = render(<LongPressTarget onLongPress={onLongPress} />)
    const target = getByTestId('target')

    fireEvent.pointerDown(target, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(target)
    vi.advanceTimersByTime(600)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('does NOT call onLongPress when pointermove > 8px cancels timer', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const { getByTestId } = render(<LongPressTarget onLongPress={onLongPress} />)
    const target = getByTestId('target')

    fireEvent.pointerDown(target, { clientX: 10, clientY: 10 })
    // Move 20px — exceeds threshold of 8px
    fireEvent.pointerMove(target, { clientX: 30, clientY: 10 })
    vi.advanceTimersByTime(600)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('does NOT call onLongPress when pointercancel fires', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const { getByTestId } = render(<LongPressTarget onLongPress={onLongPress} />)
    const target = getByTestId('target')

    fireEvent.pointerDown(target, { clientX: 10, clientY: 10 })
    fireEvent.pointerCancel(target)
    vi.advanceTimersByTime(600)
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
