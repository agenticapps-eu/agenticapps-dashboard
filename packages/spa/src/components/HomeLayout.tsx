import { useEffect } from 'react'

import { setAppShellWidth } from '../lib/appShellWidth.js'

/**
 * HomeLayout — route-level wrapper for the home route.
 *
 * Sets the AppShell <main> to max-w-5xl on mount (via the external store in
 * appShellWidth.ts) and resets to max-w-3xl on unmount. All other routes keep
 * the default max-w-3xl by not rendering this component.
 *
 * Pattern: useSyncExternalStore bus (same as theme.ts WR-01 fix).
 * Approach B from RESEARCH Pattern 18 — HomeLayout wrapper inside the Outlet.
 */
export function HomeLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    setAppShellWidth('max-w-5xl')
    return () => {
      setAppShellWidth('max-w-3xl')
    }
  }, [])

  return <>{children}</>
}
