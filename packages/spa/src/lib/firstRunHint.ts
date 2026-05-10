/**
 * firstRunHint.ts — One-shot first-run hint hook (Plan 06-03 Task 1).
 *
 * POLISH-01 D-6-03: show shortcut hints once, on first session.
 * localStorage key: 'shortcuts_hint_shown'
 * SSR-safe: returns shouldShow=false if typeof window === 'undefined'.
 */
import { useState } from 'react'

const STORAGE_KEY = 'shortcuts_hint_shown'

export function useFirstRunHint(): { shouldShow: boolean; dismiss: () => void } {
  const [shown, setShown] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  })

  function dismiss(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage may be unavailable in some environments; silently ignore.
    }
    setShown(true)
  }

  return { shouldShow: !shown, dismiss }
}
