import { useEffect } from 'react'

import { setAppShellWidth } from '../lib/appShellWidth.js'

/**
 * ProjectLayout — route-level wrapper for /projects/{id}.
 *
 * D-4-09: detail page uses max-w-7xl (1280px on Tailwind 4) — wider than
 * HomeLayout's max-w-5xl to accommodate the 2-column data-dense layout.
 *
 * Mirrors HomeLayout's pattern: useSyncExternalStore-backed setAppShellWidth
 * via useEffect, reset to max-w-3xl on unmount.
 */
export function ProjectLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    setAppShellWidth('max-w-7xl')
    return () => {
      setAppShellWidth('max-w-3xl')
    }
  }, [])

  return <>{children}</>
}
