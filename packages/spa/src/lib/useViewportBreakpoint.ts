/**
 * useViewportBreakpoint.ts — React 18 hook publishing the current Tailwind
 * breakpoint via matchMedia + useSyncExternalStore.
 *
 * Phase 12 Plan 12-00 Task 3 (D-12-22 with §A6 deviation). Powers Plan 12-05's
 * CoverageFamilySection responsive collapse below 768px (iPad-portrait via
 * Tailscale use case).
 *
 * RATIONALE — matchMedia over ResizeObserver:
 *   CONTEXT D-12-22 originally proposed ResizeObserver on
 *   document.documentElement. RESEARCH §A6 + §Pitfall 10 ratified the
 *   matchMedia variant: matchMedia.addEventListener('change') fires ONLY on
 *   threshold crossings (~5 events / resize drag) where ResizeObserver fires
 *   on every pixel of width change (~5000 events / drag). Same regression
 *   class Phase 11.1 `usePageHeaderHeight` had to engineer around. The hook
 *   stays pure state — the `--vp-bp` CSS-var publish defence-in-depth that
 *   CONTEXT D-12-22 proposed is deferred to Plan 12-05's consumer if needed.
 *
 * useSyncExternalStore is the React 18 idiomatic external-store primitive
 * with concurrent-rendering safety (server snapshot returned as 'lg' as a
 * defensive SSR fallback — SPA-only but cheap insurance).
 */
import { useSyncExternalStore } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * Tailwind 4 default breakpoints — order is LARGEST-FIRST so the first
 * matching query wins (an `xl` viewport also matches `lg`/`md`/`sm`). `xs`
 * is the fallback when no min-width query matches; it does not register a
 * matchMedia listener.
 */
const BREAKPOINTS: Array<[Exclude<Breakpoint, 'xs'>, string]> = [
  ['xl', '(min-width: 1280px)'],
  ['lg', '(min-width: 1024px)'],
  ['md', '(min-width: 768px)'],
  ['sm', '(min-width: 640px)'],
]

function current(): Breakpoint {
  if (typeof window === 'undefined') return 'lg'
  for (const [bp, query] of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return bp
  }
  return 'xs'
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const queries = BREAKPOINTS.map(([, q]) => window.matchMedia(q))
  for (const mq of queries) mq.addEventListener('change', callback)
  return () => {
    for (const mq of queries) mq.removeEventListener('change', callback)
  }
}

/**
 * Returns the current Tailwind breakpoint. Re-renders only on threshold
 * crossings; safe to call from any component without resize-storm risk.
 */
export function useViewportBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, current, () => 'lg')
}
