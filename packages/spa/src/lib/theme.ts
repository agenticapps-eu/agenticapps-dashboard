import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemeChoice = 'dark' | 'light' | 'system'
const KEY = 'agentic-dashboard:theme'

/**
 * WR-01: shared external store for theme.
 *
 * Two consumers — <ThemeChip/> in the always-mounted Header and <ThemeToggle/>
 * on /settings — are simultaneously mounted on the /settings route. The
 * previous useState implementation gave each component its own copy of
 * `choice`, so a click in one didn't update the other until remount. Promote
 * `choice` to a module-level subscription bus so all useTheme() consumers
 * share a single source of truth and re-render together via
 * useSyncExternalStore.
 */
const subscribers = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  // Cross-tab sync: if another tab writes the key, broadcast to this tab too.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === KEY) cb()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    subscribers.delete(cb)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

function emit(): void {
  subscribers.forEach((cb) => cb())
}

function readChoice(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'dark'
  const raw = localStorage.getItem(KEY)
  return raw === 'light' || raw === 'system' ? raw : 'dark' // D-02 default
}

/**
 * useSyncExternalStore requires referentially stable snapshots; readChoice()
 * returns a string primitive (referentially compared with ===) so it's fine
 * to call directly. The server snapshot returns the D-02 default so SSR-like
 * environments don't crash on missing localStorage.
 */
function getServerSnapshot(): ThemeChoice {
  return 'dark'
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return
  const wantsDark =
    choice === 'dark' ||
    (choice === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', wantsDark)
}

/** Call BEFORE createRoot() to avoid first-paint flash (D-02). */
export function initTheme(): void {
  applyTheme(readChoice())
}

export function useTheme(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const choice = useSyncExternalStore(subscribe, readChoice, getServerSnapshot)

  const setChoice = useCallback((next: ThemeChoice): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, next)
    }
    applyTheme(next)
    emit()
  }, [])

  // Re-apply on every mount and on every choice change. initTheme() runs before
  // createRoot for first-paint flash avoidance (D-02), but unit tests mount
  // useTheme without calling initTheme — and tests asserted the dark class
  // landed by mount alone. Keep that contract.
  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  // Re-apply when system preference changes and current choice is 'system'.
  useEffect(() => {
    if (choice !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  return { choice, setChoice }
}
