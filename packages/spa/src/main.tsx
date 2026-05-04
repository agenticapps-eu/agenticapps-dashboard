import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import { router } from './router.js'
import { initTheme } from './lib/theme.js'
import { RepairProvider, useRepair } from './lib/repair.js'
import { createQueryClient } from './lib/queryClient.js'
import './styles/global.css'

// Apply theme BEFORE first paint to avoid the dark/light flash (D-02).
initTheme()

/**
 * Bridges the RepairContext into TanStack Query's QueryCache.onError handler.
 * Must live INSIDE <RepairProvider> so useRepair works.
 *
 * useMemo ensures createQueryClient runs once per mount (StrictMode-safe).
 */
function QueryBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const repair = useRepair()
  // Pattern 6: bind the repair bus to QueryCache.onError once at mount.
  // The closure captures the LIVE setNeedsRepair via the context — no stale ref.
  const queryClient = useMemo(
    () => createQueryClient({ setNeedsRepair: repair.setNeedsRepair }),
    // setNeedsRepair, dismiss, clear are all wrapped in useCallback([]) in RepairProvider —
    // stable across re-renders. Without that wrap, each parent re-render would create
    // a new queryClient (clearing the cache) and risk a StrictMode infinite loop.
    // See Plan 03 Task 2 step 1 (`useCallback`) and Plan 03 Task 2 step 2 (identity-stability test).
    [repair.setNeedsRepair],
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <RepairProvider>
      <QueryBridge>
        <RouterProvider router={router} />
      </QueryBridge>
    </RepairProvider>
  </StrictMode>,
)
