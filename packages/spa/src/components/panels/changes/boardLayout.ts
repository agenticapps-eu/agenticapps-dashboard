/**
 * boardLayout.ts — when four columns stop fitting.
 *
 * **The minimum column width is the constraint; the viewport threshold is
 * derived from it.** The requirement is stated that way deliberately: a change
 * to the shell's sidebar or the main region's padding recomputes the threshold
 * rather than invalidating the requirement, so the number below is arithmetic
 * with its inputs named rather than a breakpoint someone picked.
 *
 * The hook uses `matchMedia` rather than a `ResizeObserver`, for the reason
 * `useViewportBreakpoint` already documents: a media query fires only on
 * threshold crossings (a handful per resize drag) where a resize observer fires
 * on every pixel (thousands). Nothing here needs the intermediate widths — it
 * needs one boolean.
 */
import { useSyncExternalStore } from 'react'

/** Below this, a card's name and counts stop being readable side by side. */
export const BOARD_MIN_COLUMN_PX = 180

/** `gap-4` between columns, in pixels. */
export const BOARD_COLUMN_GAP_PX = 16

/** `AppShellV2`'s fixed sidebar track. */
export const SHELL_SIDEBAR_PX = 240

/** `<main class="p-6">`, both sides. */
export const SHELL_MAIN_PADDING_PX = 48

/** The four stage columns. */
const STAGE_COUNT = 4

/**
 * The narrowest viewport at which four columns each hold their minimum width.
 *
 * 4 x 180 + 3 x 16 + 240 + 48 = 1056.
 */
export const BOARD_FOUR_COLUMN_MIN_VIEWPORT_PX =
  STAGE_COUNT * BOARD_MIN_COLUMN_PX
  + (STAGE_COUNT - 1) * BOARD_COLUMN_GAP_PX
  + SHELL_SIDEBAR_PX
  + SHELL_MAIN_PADDING_PX

const QUERY = `(min-width: ${BOARD_FOUR_COLUMN_MIN_VIEWPORT_PX}px)`

function fits(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(QUERY).matches
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/**
 * Whether all four columns can be shown at once.
 *
 * `false` means the board pages one stage at a time behind a stage rail — not
 * that any stage becomes unreachable, which is the property the requirement
 * actually protects.
 */
export function useFourColumnLayout(): boolean {
  return useSyncExternalStore(subscribe, fits, () => true)
}
