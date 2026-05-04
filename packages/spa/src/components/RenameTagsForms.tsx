import { useEffect, useRef, useState } from 'react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

import { useRename, useSetTags } from '../lib/registry.js'

// ─── RenameDialog ─────────────────────────────────────────────────────────────

export interface RenameDialogProps {
  isOpen: boolean
  item: RegistryListItem | null
  onClose: () => void
}

export function RenameDialog({ isOpen, item, onClose }: RenameDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const rename = useRename(item?.id ?? '')

  useEffect(() => {
    if (isOpen && item) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(item.name)
      /* eslint-enable react-hooks/set-state-in-effect */
      if (!dialogRef.current?.open) {
        dialogRef.current?.showModal()
      }
    } else {
      if (dialogRef.current?.open) {
        dialogRef.current?.close()
      }
    }
  }, [isOpen, item])

  if (!item) return null

  async function handleSave() {
    if (!name.trim()) {
      onClose()
      return
    }
    if (name.trim() === item!.name) {
      onClose()
      return
    }
    try {
      await rename.mutateAsync({ name: name.trim() })
      onClose()
    } catch {
      // Leave dialog open so user can retry
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="bg-[--surface] border border-[--border-strong] rounded-lg p-6 max-w-md w-full mx-4 backdrop:bg-black/60"
    >
      <h2 className="text-xl font-semibold leading-snug text-[--text]">Rename project</h2>
      <label className="block text-sm font-semibold text-[--text] mt-4">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void handleSave()
          }
        }}
        className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 text-sm text-[--text] mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-[--surface-elevated] border border-[--border] text-sm px-3 py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={rename.isPending}
          className="bg-[--accent] text-[--accent-fg] text-sm px-3 py-2 rounded-md hover:bg-[--accent-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rename.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </dialog>
  )
}

// ─── EditTagsDialog ───────────────────────────────────────────────────────────

export interface EditTagsDialogProps {
  isOpen: boolean
  item: RegistryListItem | null
  existingTags: string[]
  onClose: () => void
}

export function EditTagsDialog({
  isOpen,
  item,
  existingTags,
  onClose,
}: EditTagsDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState('')
  const setTagsMutation = useSetTags(item?.id ?? '')

  useEffect(() => {
    if (isOpen && item) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTags(item.tags)
      setInput('')
      /* eslint-enable react-hooks/set-state-in-effect */
      if (!dialogRef.current?.open) {
        dialogRef.current?.showModal()
      }
    } else {
      if (dialogRef.current?.open) {
        dialogRef.current?.close()
      }
    }
  }, [isOpen, item])

  if (!item) return null

  function toggle(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function addInputTag() {
    const t = input.trim()
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t])
    }
    setInput('')
  }

  async function handleSave() {
    try {
      await setTagsMutation.mutateAsync({ tags })
      onClose()
    } catch {
      // Leave dialog open so user can retry
    }
  }

  // All chips: union of existingTags (from registry) and current item tags
  const allChips = Array.from(new Set([...existingTags, ...item.tags, ...tags]))

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="bg-[--surface] border border-[--border-strong] rounded-lg p-6 max-w-md w-full mx-4 backdrop:bg-black/60"
    >
      <h2 className="text-xl font-semibold leading-snug text-[--text]">Edit tags</h2>
      <div className="flex flex-wrap gap-2 mt-4">
        {allChips.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={tags.includes(t)}
            className={
              tags.includes(t)
                ? 'bg-[--accent] text-[--accent-fg] border border-[--accent] text-sm px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]'
                : 'bg-[--surface-elevated] border border-[--border] text-[--text] text-sm px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]'
            }
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addInputTag()
          }
        }}
        placeholder="Add tag…"
        aria-label="Add tag"
        className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 text-sm text-[--text] mt-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-[--surface-elevated] border border-[--border] text-sm px-3 py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={setTagsMutation.isPending}
          className="bg-[--accent] text-[--accent-fg] text-sm px-3 py-2 rounded-md hover:bg-[--accent-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {setTagsMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </dialog>
  )
}
