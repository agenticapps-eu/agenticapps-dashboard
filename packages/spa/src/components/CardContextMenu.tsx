import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Tag, Trash2 } from 'lucide-react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

import { useUnregister } from '../lib/registry.js'

export type ContextMenuAnchor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'element'; el: HTMLElement }

export interface CardContextMenuProps {
  anchor: ContextMenuAnchor
  item: RegistryListItem
  /** When card's "Unregister?" link opens it directly in confirm mode */
  initialMode?: 'menu' | 'unregister-confirm'
  onAction: (action: 'rename' | 'tags') => void
  onClose: () => void
}

const MENU_MIN_WIDTH = 180
const MENU_MIN_HEIGHT = 140

/**
 * Compute fixed position from anchor. Clamps to viewport.
 */
function computePosition(anchor: ContextMenuAnchor): { top: number; left: number } {
  if (anchor.type === 'pointer') {
    return {
      top: Math.min(anchor.y, window.innerHeight - MENU_MIN_HEIGHT),
      left: Math.min(anchor.x, window.innerWidth - MENU_MIN_WIDTH),
    }
  }
  const rect = anchor.el.getBoundingClientRect()
  return {
    top: Math.min(rect.bottom + 4, window.innerHeight - MENU_MIN_HEIGHT),
    left: Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH),
  }
}

const ITEM_CLASS =
  'flex items-center gap-2 px-4 py-2 text-sm text-[--text] w-full text-left hover:bg-[--surface-elevated] focus-visible:bg-[--surface-elevated] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--ring]'

const ITEM_DANGER_CLASS =
  'flex items-center gap-2 px-4 py-2 text-sm text-[--danger] w-full text-left hover:bg-[--danger-surface] focus-visible:bg-[--danger-surface] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--ring]'

export function CardContextMenu({
  anchor,
  item,
  initialMode = 'menu',
  onAction,
  onClose,
}: CardContextMenuProps): React.JSX.Element {
  const [mode, setMode] = useState<'menu' | 'unregister-confirm'>(initialMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const unregister = useUnregister(item.id)

  const { top, left } = computePosition(anchor)

  // Focus the first menuitem on mount
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
    el?.focus()
  }, [mode])

  // Click-outside closes the menu
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      )
      const idx = items.indexOf(document.activeElement as HTMLElement)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          items[(idx + 1) % items.length]?.focus()
          break
        case 'ArrowUp':
          e.preventDefault()
          items[(idx - 1 + items.length) % items.length]?.focus()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          onClose()
          break
      }
    },
    [onClose],
  )

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top,
    left,
    zIndex: 50,
  }

  const menu = (
    <div
      ref={containerRef}
      role="menu"
      style={containerStyle}
      className="bg-[--surface] border border-[--border-strong] rounded-md shadow-md py-1 min-w-[160px]"
      onKeyDown={handleKeyDown}
    >
      {mode === 'menu' ? (
        <>
          <button
            role="menuitem"
            tabIndex={0}
            className={ITEM_CLASS}
            onClick={() => {
              onAction('rename')
              onClose()
            }}
          >
            <Tag size={14} aria-hidden="true" />
            Rename
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            className={ITEM_CLASS}
            onClick={() => {
              onAction('tags')
              onClose()
            }}
          >
            <Tag size={14} aria-hidden="true" />
            Edit tags
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            className={ITEM_DANGER_CLASS}
            onClick={() => setMode('unregister-confirm')}
          >
            <Trash2 size={14} aria-hidden="true" />
            Unregister
          </button>
        </>
      ) : (
        <>
          <div className="px-4 py-2 text-sm font-semibold text-[--text]">
            Unregister {item.name}?
          </div>
          <div className="px-4 pb-2 text-sm text-[--text-muted]">
            This only removes it from the dashboard. No files are deleted.
          </div>
          <div className="px-4 py-2 flex gap-2">
            <button
              type="button"
              className="bg-[--surface-elevated] border border-[--border] text-sm px-3 py-2 rounded-md text-[--text] hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              onClick={() => setMode('menu')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-[--danger] text-white text-sm px-3 py-2 rounded-md hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              onClick={() => {
                unregister.mutate()
                onClose()
              }}
            >
              Unregister
            </button>
          </div>
        </>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}
