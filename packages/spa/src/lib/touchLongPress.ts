import { useRef, useCallback } from 'react'

/**
 * useLongPress — fires onLongPress after `delay` ms of uninterrupted pointer down.
 *
 * Cancellation:
 * - pointerup / pointercancel: clear timer.
 * - pointermove with delta > 8px from start: clear timer (D-23 touch cancel).
 *
 * No visual feedback during press (D-43).
 * Uses Pointer Events API for unified mouse + touch handling.
 *
 * NOTE: This is a stub that will be replaced by plan 01's canonical version on merge.
 */
export function useLongPress(
  onLongPress: () => void,
  delay: number = 500
): {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerCancel: () => void
} {
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        onLongPress()
      }, delay)
    },
    [onLongPress, delay]
  )

  const onPointerUp = useCallback(() => {
    cancel()
  }, [cancel])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (startRef.current === null) return
      const distance = Math.hypot(
        e.clientX - startRef.current.x,
        e.clientY - startRef.current.y
      )
      if (distance > 8) {
        cancel()
      }
    },
    [cancel]
  )

  const onPointerCancel = useCallback(() => {
    cancel()
  }, [cancel])

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel }
}
