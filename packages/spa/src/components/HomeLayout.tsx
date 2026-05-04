/**
 * HomeLayout stub — plan 03-08 wave 3.
 *
 * The canonical implementation lives in plan 03-01's worktree.
 * This stub satisfies the import so MultiProjectHome can compile.
 * The orchestrator will reconcile during post-wave merge.
 */
import { useEffect } from 'react'

import { setAppShellWidth } from '../lib/appShellWidth.js'

export function HomeLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    setAppShellWidth('max-w-5xl')
    return () => {
      setAppShellWidth('max-w-3xl')
    }
  }, [])

  return <>{children}</>
}
