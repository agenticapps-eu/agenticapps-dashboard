/**
 * useGlobalShortcuts.ts — Global keyboard shortcut hook (Plan 06-03 Task 1).
 *
 * POLISH-01 D-6-01..03:
 *   R / r — refresh (route-aware: ['registry'] on /, project keys on /projects/:id)
 *   ?     — navigate to /help
 *   /     — focus [aria-label="Search projects"] input (HomeToolbar.tsx)
 *
 * Mount exactly once in AppShellV2 (single keydown listener, no duplicates).
 *
 * Focus-guard (D-6-01): bails when an editable surface has focus, preventing
 * "r" in the search box from accidentally refreshing. (RESEARCH Pitfall 2).
 *
 * Modifier-bail: bails when metaKey/ctrlKey/altKey is held so that Cmd-R
 * (browser reload), Cmd+K (palette), Alt-combos are never intercepted.
 * Shift is intentionally NOT in the bail — US-layout users need Shift+/
 * to type `?`, and Shift+R producing `e.key === "R"` is handled by the
 * R/r handler. Cmd-Shift-R browser hard-reload still bails on metaKey.
 */
import { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

function isEditableSurface(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

const PROJECT_QUERY_KEYS = [
  'commitment',
  'observations',
  'discipline',
  'phase-progress',
  'security',
  'skills',
  'agentlinter',
  'observability',
  'secrets',
  'integrations',
] as const

export function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const routerState = useRouterState()
  const path = routerState.location.pathname

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Modifier-bail: preserve Cmd-R browser reload, Cmd+K palette, etc.
      // Shift is allowed through: US-layout users need Shift+/ to type `?`,
      // and the R/r handler accepts both casings naturally.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Focus-guard: don't trigger when user is typing in an editable surface.
      if (isEditableSurface(document.activeElement)) return

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (path.startsWith('/projects/')) {
          for (const key of PROJECT_QUERY_KEYS) {
            void queryClient.invalidateQueries({ queryKey: [key] })
          }
        } else if (path === '/') {
          void queryClient.invalidateQueries({ queryKey: ['registry'] })
        }
      } else if (e.key === '?') {
        e.preventDefault()
        void navigate({ to: '/help' })
      } else if (e.key === '/') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('[aria-label="Search projects"]')
        input?.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, queryClient, path])
}
