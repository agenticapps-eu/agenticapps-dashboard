import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type RepairBus = {
  needsRepair: boolean
  dismissed: boolean
  setNeedsRepair: (v: boolean) => void
  dismiss: () => void
  clear: () => void
}

const RepairContext = createContext<RepairBus | null>(null)

export function RepairProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [needsRepair, setNeedsRepairState] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // D-06: a NEW 401 re-shows the banner (resets per-session dismissed flag).
  // useCallback([]) gives stable identity across re-renders so Plan 06 Task 1's
  // `useMemo(..., [repair.setNeedsRepair])` runs ONCE — not on every parent render.
  // React's setState dispatchers are stable, so empty deps are correct.
  const setNeedsRepair = useCallback((v: boolean): void => {
    setNeedsRepairState(v)
    if (v) setDismissed(false)
  }, [])

  const dismiss = useCallback((): void => setDismissed(true), [])

  const clear = useCallback((): void => {
    setNeedsRepairState(false)
    setDismissed(false)
  }, [])

  return (
    <RepairContext.Provider value={{ needsRepair, dismissed, setNeedsRepair, dismiss, clear }}>
      {children}
    </RepairContext.Provider>
  )
}

export function useRepair(): RepairBus {
  const ctx = useContext(RepairContext)
  if (!ctx) throw new Error('useRepair must be used inside <RepairProvider>')
  return ctx
}
