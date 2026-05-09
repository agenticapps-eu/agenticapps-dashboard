/**
 * CommandPalette.tsx — Global Cmd/Ctrl+K command palette.
 *
 * Native <dialog> + listbox + aria-activedescendant. Mounted globally in AppShell.
 * Implements D-32: purpose-built (no external library), WAI-ARIA listbox pattern.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import { useCommandPaletteActions, filterActions } from '../lib/commandPaletteActions.js'

export function CommandPalette(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  function closeAndRestore() {
    setIsOpen(false)
    setTimeout(() => previouslyFocused.current?.focus(), 0)
  }

  const actions = useCommandPaletteActions(closeAndRestore)
  const filtered = useMemo(() => filterActions(actions, query), [actions, query])

  function open() {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setIsOpen(true)
    setQuery('')
    setFocusedIndex(0)
  }

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Show/hide dialog when isOpen changes
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      // Focus input on next tick (after dialog is visible)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      if (dialogRef.current?.hasAttribute('open')) {
        dialogRef.current?.close()
      }
    }
  }, [isOpen])

  // Clamp focusedIndex inline — never call setState inside an effect (react-hooks/set-state-in-effect)
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(focusedIndex, filtered.length - 1)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) =>
        filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const action = filtered[clampedIndex]
      if (action) action.run()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      closeAndRestore()
    }
  }

  const activeId =
    filtered.length > 0 ? `palette-option-${clampedIndex}` : undefined

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        closeAndRestore()
      }}
      onClose={() => setIsOpen(false)}
      className="bg-card-bg border border-border-subtle rounded-lg overflow-hidden p-0 max-w-lg w-full mt-[20vh] mx-auto backdrop:bg-black/60"
    >
      <div className="flex flex-col" onKeyDown={handleKeyDown}>
        {/* Input row */}
        <div className="relative flex items-center border-b border-border-subtle">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-4 text-text-secondary pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            aria-label="Command palette search"
            aria-owns="palette-listbox"
            aria-activedescendant={activeId}
            placeholder="Search or jump to…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setFocusedIndex(0)
            }}
            className="w-full bg-transparent border-0 pl-12 pr-16 py-3 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {/* ⌘K hint chip — visual chrome only */}
          <span
            className="absolute right-4 bg-card-bg-hover border border-border-subtle rounded px-2 leading-none flex items-center font-mono text-xs text-text-secondary"
            aria-hidden="true"
          >
            ⌘K
          </span>
        </div>

        {/* Listbox */}
        <ul
          id="palette-listbox"
          role="listbox"
          aria-label="Actions"
          className="max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-secondary">
              No actions found. Try a shorter search.
            </li>
          ) : (
            filtered.map((a, i) => (
              <li
                key={a.id}
                id={`palette-option-${i}`}
                role="option"
                aria-selected={i === clampedIndex}
                onMouseEnter={() => setFocusedIndex(i)}
                onClick={() => a.run()}
                className={`flex items-center gap-3 px-4 py-3 text-sm text-text-primary cursor-pointer${i === clampedIndex ? ' bg-card-bg-hover' : ''}`}
              >
                {a.label}
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  )
}
