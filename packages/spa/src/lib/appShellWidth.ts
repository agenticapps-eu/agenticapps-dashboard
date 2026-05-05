import { useSyncExternalStore } from 'react'

/**
 * Module-scope external store for the AppShell <main> max-width class.
 *
 * Uses the same useSyncExternalStore pattern as theme.ts (WR-01).
 * HomeLayout sets 'max-w-5xl' on mount and resets to 'max-w-3xl' on unmount.
 * All other routes keep the default 'max-w-3xl' by not rendering HomeLayout.
 *
 * Process-private state — only callable from same-bundle code.
 * No security boundary crossed (T-03-02-01).
 */
let current = 'max-w-3xl'
const subs = new Set<() => void>()

export function setAppShellWidth(value: string): void {
  current = value
  subs.forEach((cb) => cb())
}

export function subscribeAppShellWidth(cb: () => void): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export function getSnapshot(): string {
  return current
}

function getServerSnapshot(): string {
  return 'max-w-3xl'
}

export function useAppShellWidth(): string {
  return useSyncExternalStore(subscribeAppShellWidth, getSnapshot, getServerSnapshot)
}
