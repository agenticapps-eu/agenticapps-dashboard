// Measures the rendered height of its target element and publishes it as --ph-h on documentElement.
import { useEffect } from 'react'

const PH_DEFAULT = '56px'

export function usePageHeaderHeight(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const h = Math.round(entry.contentRect.height)
      document.documentElement.style.setProperty('--ph-h', `${h}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.setProperty('--ph-h', PH_DEFAULT)
    }
  }, [ref])
}
