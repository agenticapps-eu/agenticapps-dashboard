import { useEffect, useState } from 'react'

export type ThemeChoice = 'dark' | 'light' | 'system'
const KEY = 'agentic-dashboard:theme'

function readChoice(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'dark'
  const raw = localStorage.getItem(KEY)
  return raw === 'light' || raw === 'system' ? raw : 'dark' // D-02 default
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
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)

  useEffect(() => {
    applyTheme(choice)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, choice)
    }
  }, [choice])

  useEffect(() => {
    if (choice !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  return { choice, setChoice: setChoiceState }
}
