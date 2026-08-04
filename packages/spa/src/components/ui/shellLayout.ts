/**
 * shellLayout.ts — when the shell stops having room for a fixed sidebar.
 *
 * `AppShellV2` laid out `240px 1fr` at every width. At the design system's own
 * representative `xs` viewport (390×844) that leaves ~150 CSS pixels of content
 * column, and the top bar's own minimum width then forces the page to scroll
 * horizontally — which `Dense Rows And Aligned Figures` forbids on every
 * surface, so every v2 route failed it, not one.
 *
 * Measured before changing anything, at a 485px client width: `/fleet` scrolled
 * to 752px and `/changes` to 642px. Neither number came from the page's own
 * content — both were the shell.
 *
 * The threshold is the design system's declared `xs` boundary rather than a new
 * number, because that is the width the spec already names as the smallest
 * supported one. `matchMedia` rather than a resize observer, for the reason
 * `useViewportBreakpoint` records: threshold crossings, not every pixel.
 */
import { useSyncExternalStore } from 'react'

/**
 * Below this the sidebar leaves the grid and becomes a dismissible panel.
 *
 * The design system names `xs` as "below 640 CSS pixels" with 390×844 as its
 * representative viewport; this is that boundary, not a second opinion about it.
 */
export const SHELL_COMPACT_MAX_PX = 640

const QUERY = `(max-width: ${SHELL_COMPACT_MAX_PX - 1}px)`

function compact(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/**
 * Whether the shell is too narrow to hold a fixed sidebar beside the content.
 *
 * `true` does not mean navigation is unavailable — it means navigation is
 * behind a control instead of always on screen. Hiding it outright would trade
 * one requirement for a worse failure.
 */
export function useCompactShell(): boolean {
  return useSyncExternalStore(subscribe, compact, () => false)
}
