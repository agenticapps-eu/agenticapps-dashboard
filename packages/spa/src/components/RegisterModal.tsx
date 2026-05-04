import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useRegisterPrepare, useRegisterConfirm } from '../lib/registry.js'
import { ApiError } from '../lib/api.js'

import { SchemaDriftState } from './SchemaDriftState.js'

// ─── Local types for prepare response union ─────────────────────────────────
// These mirror RegisterPrepareResponseSchema from @agenticapps/dashboard-shared
// (plan 03-06 creates the canonical schema; we match the runtime shape here).

interface AllowedResponse {
  alreadyRegistered: false
  blocked: false
  canonicalRoot: string
  suggestedName: string
  suggestedSlug: string
  nonce: string
  expiresAt: string
  detectedMarkers: { gitRepo: boolean; planning: boolean; claudeSkills: boolean }
}

interface BlockedResponse {
  blocked: true
  alreadyRegistered: false
  canonicalRoot: string
  blockedReason: string
}

interface AlreadyRegisteredResponse {
  alreadyRegistered: true
  blocked: false
  canonicalRoot: string
  existingEntry: {
    id: string
    name: string
    root: string
    client: string | null
    addedAt: string
    tags: string[]
  }
}

type PrepareResponse = AllowedResponse | BlockedResponse | AlreadyRegisteredResponse

type ModalMode =
  | 'step1'
  | 'step2-allowed'
  | 'step2-blocked'
  | 'step2-already'
  | 'drift'

function decodePrepareResponse(data: PrepareResponse): ModalMode {
  if ('blocked' in data && data.blocked) return 'step2-blocked'
  if ('alreadyRegistered' in data && data.alreadyRegistered) return 'step2-already'
  return 'step2-allowed'
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmed: (newProjectId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RegisterModal({
  isOpen,
  onClose,
  onConfirmed,
}: RegisterModalProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()

  // Step 1 state
  const [path, setPath] = useState('')
  const [networkError, setNetworkError] = useState(false)

  // Step 2 state
  const [prepareData, setPrepareData] = useState<PrepareResponse | null>(null)
  const [mode, setMode] = useState<ModalMode>('step1')
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // UX state
  const [dirtyDiscardOpen, setDirtyDiscardOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const prepare = useRegisterPrepare()
  const confirm = useRegisterConfirm()

  // ── Open/close the native dialog via the isOpen prop ────────────────────
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null
      if (!dialog.open) dialog.showModal()
      // Reset state on open — the dialog must start fresh each time it opens.
      setPath('')
      setNetworkError(false)
      setPrepareData(null)
      setMode('step1')
      setName('')
      setClient('')
      setTags([])
      setTagInput('')
      setDirtyDiscardOpen(false)
      setRefreshing(false)
    } else {
      if (dialog.open) dialog.close()
      previouslyFocused.current?.focus()
    }
  }, [isOpen])

  // ── Dirty-state detection ────────────────────────────────────────────────
  function isDirty(): boolean {
    if (mode === 'step1') return path !== ''
    if (mode === 'step2-allowed' && prepareData && !prepareData.blocked && !prepareData.alreadyRegistered) {
      const allowed = prepareData as AllowedResponse
      return (
        name !== allowed.suggestedName ||
        client !== '' ||
        tags.length > 0
      )
    }
    return false
  }

  function handleClose() {
    if (isDirty()) {
      setDirtyDiscardOpen(true)
    } else {
      onClose()
    }
  }

  // ── Esc / onCancel ───────────────────────────────────────────────────────
  function handleEscape(e: React.SyntheticEvent) {
    e.preventDefault()
    handleClose()
  }

  // ── Backdrop click ───────────────────────────────────────────────────────
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  // ── Preview (step 1 → step 2) ────────────────────────────────────────────
  function handlePreview() {
    if (!path.trim()) return
    setNetworkError(false)
    prepare.mutate(
      { path },
      {
        onSuccess: (data) => {
          const typed = data as unknown as PrepareResponse
          setPrepareData(typed)
          const nextMode = decodePrepareResponse(typed)
          setMode(nextMode)
          if (nextMode === 'step2-allowed') {
            const allowed = typed as AllowedResponse
            setName(allowed.suggestedName)
          }
        },
        onError: (err) => {
          if (err.message.startsWith('schema_drift:')) {
            setMode('drift')
          } else {
            setNetworkError(true)
          }
        },
      },
    )
  }

  // ── Confirm ──────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (mode !== 'step2-allowed' || !prepareData || !('nonce' in prepareData)) return
    const allowed = prepareData as AllowedResponse
    try {
      const result = await confirm.mutateAsync({
        nonce: allowed.nonce,
        ...(name ? { name } : {}),
        client: client || null,
        tags,
      })
      onConfirmed(result.id)
      onClose()
    } catch (err) {
      // Check for 410 via instanceof (production) or duck-type (test mocks)
      const is410 = err instanceof ApiError
        ? err.status === 410
        : (err as { status?: number })?.status === 410
      if (is410) {
        // D-18: silently re-prepare with same input path, then retry confirm with fresh nonce
        setRefreshing(true)
        try {
          const fresh = await prepare.mutateAsync({ path })
          const freshTyped = fresh as unknown as PrepareResponse
          setPrepareData(freshTyped)
          if (
            'nonce' in freshTyped &&
            !freshTyped.blocked &&
            !freshTyped.alreadyRegistered
          ) {
            const freshAllowed = freshTyped as AllowedResponse
            // Retry confirm directly with fresh nonce (avoid stale closure issue)
            const retryResult = await confirm.mutateAsync({
              nonce: freshAllowed.nonce,
              ...(name ? { name } : {}),
              client: client || null,
              tags,
            })
            setRefreshing(false)
            onConfirmed(retryResult.id)
            onClose()
          } else {
            setRefreshing(false)
          }
        } catch {
          setRefreshing(false)
          setNetworkError(true)
        }
      } else {
        setNetworkError(true)
      }
    }
  }

  // ── Tag management ───────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function addTagFromInput() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t])
    }
    setTagInput('')
  }

  // ── No-markers detection ─────────────────────────────────────────────────
  function showNoMarkersHint(): boolean {
    if (mode !== 'step2-allowed' || !prepareData || prepareData.blocked || prepareData.alreadyRegistered) return false
    const allowed = prepareData as AllowedResponse
    return (
      allowed.detectedMarkers.gitRepo === false &&
      allowed.detectedMarkers.planning === false &&
      allowed.detectedMarkers.claudeSkills === false
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <dialog
      ref={dialogRef}
      className="bg-[--surface] border border-[--border-strong] rounded-lg p-0 max-w-md w-full mx-4 dark:shadow-none shadow-lg backdrop:bg-black/60"
      onCancel={handleEscape}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold leading-snug text-[--text]">
            {mode === 'step1' ? 'Register a project' : 'Confirm registration'}
          </h2>
          <button
            type="button"
            aria-label="Close registration dialog"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-elevated] hover:text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            ×
          </button>
        </div>

        {/* Step 1 */}
        {mode === 'step1' && (
          <div>
            <label className="block text-sm font-semibold text-[--text] mb-1">
              Project path
            </label>
            <input
              type="text"
              autoComplete="off"
              autoFocus
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePreview()
              }}
              className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 font-mono text-sm text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              placeholder="/Users/you/Sourcecode/my-project"
            />
            <p className="mt-1 text-sm text-[--text-muted]">
              Full path to the project root.
            </p>

            {networkError && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[--text-muted]">
                <span>Couldn&apos;t reach the daemon.</span>
                <button
                  type="button"
                  onClick={() => {
                    setNetworkError(false)
                    handlePreview()
                  }}
                  className="underline text-[--accent] hover:text-[--accent-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                >
                  Retry preview
                </button>
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={handlePreview}
                disabled={prepare.isPending}
                className="bg-[--surface-elevated] border border-[--border-strong] text-[--text] px-4 py-2 text-sm font-semibold rounded-md hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {prepare.isPending ? 'Previewing…' : 'Preview path'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — schema drift */}
        {mode === 'drift' && (
          <SchemaDriftState
            data-testid="schema-drift-state"
            firstIssue={{ path: '(root)', expected: 'RegisterPrepareResponse', got: 'unknown' }}
            fullIssues={[]}
            onRetry={() => {
              setMode('step1')
              setNetworkError(false)
            }}
          />
        )}

        {/* Step 2 — allowed */}
        {mode === 'step2-allowed' && prepareData && !prepareData.blocked && !prepareData.alreadyRegistered && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-[--text] bg-[--surface-elevated] px-3 py-2 rounded-md">
                {(prepareData as AllowedResponse).canonicalRoot}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConfirm()
                }}
                className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 text-sm text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              />
            </div>

            {/* Client */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Client (optional)
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 text-sm text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              />
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="bg-[--accent] text-[--accent-fg] border border-[--accent] text-sm px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagFromInput()
                  }
                }}
                placeholder="Add tag…"
                className="w-full bg-[--surface-elevated] border border-[--border-strong] rounded-md px-3 py-2 text-sm text-[--text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              />
            </div>

            {/* No-markers hint */}
            {showNoMarkersHint() && (
              <div className="mb-4 text-sm text-[--text-muted] flex items-start gap-2">
                <span aria-hidden="true">ⓘ</span>
                <span>No git repo or .planning/.claude found here. Cards may show empty data.</span>
              </div>
            )}

            {/* Refreshing indicator for 410 auto-re-prepare */}
            {refreshing && (
              <div className="mb-4 text-sm text-[--text-muted]">refreshing…</div>
            )}

            {/* Network error in step 2 */}
            {networkError && (
              <div className="mb-4 text-sm text-[--text-muted]">
                Couldn&apos;t reach the daemon.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('step1')
                  setPrepareData(null)
                }}
                className="bg-[--surface-elevated] border border-[--border-strong] text-[--text] px-4 py-2 text-sm font-semibold rounded-md hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={confirm.isPending || refreshing}
                className="bg-[--accent] text-[--accent-fg] px-4 py-2 text-sm font-semibold rounded-md hover:bg-[--accent-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirm.isPending || refreshing ? 'Registering…' : 'Confirm registration'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — blocked */}
        {mode === 'step2-blocked' && prepareData && prepareData.blocked && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-[--text] bg-[--surface-elevated] px-3 py-2 rounded-md">
                {(prepareData as BlockedResponse).canonicalRoot}
              </div>
            </div>

            {/* Blocked banner */}
            <div className="mb-4 bg-[--danger-surface] border-l-2 border-l-[--danger] px-4 py-3 rounded-md text-sm text-[--text]">
              Blocked: {(prepareData as BlockedResponse).blockedReason}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('step1')
                  setPrepareData(null)
                }}
                className="bg-[--surface-elevated] border border-[--border-strong] text-[--text] px-4 py-2 text-sm font-semibold rounded-md hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              >
                Back
              </button>
              <button
                type="button"
                disabled
                className="bg-[--accent] text-[--accent-fg] px-4 py-2 text-sm font-semibold rounded-md opacity-50 cursor-not-allowed"
              >
                Confirm registration
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — already registered */}
        {mode === 'step2-already' && prepareData && prepareData.alreadyRegistered && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[--text] mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-[--text] bg-[--surface-elevated] px-3 py-2 rounded-md">
                {(prepareData as AlreadyRegisteredResponse).canonicalRoot}
              </div>
            </div>

            {/* Already-registered banner */}
            <div className="mb-4 bg-[--surface-elevated] border border-[--border] px-4 py-3 rounded-md">
              <p className="text-sm text-[--text] mb-3">
                Already registered as {(prepareData as AlreadyRegisteredResponse).existingEntry.id} since{' '}
                {new Date((prepareData as AlreadyRegisteredResponse).existingEntry.addedAt).toLocaleDateString()}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigate({
                      to: '/projects/$projectId',
                      params: {
                        projectId: (prepareData as AlreadyRegisteredResponse).existingEntry.id,
                      },
                    })
                    onClose()
                  }}
                  className="bg-[--accent] text-[--accent-fg] px-3 py-2 text-sm font-semibold rounded-md hover:bg-[--accent-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                >
                  Open project
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-[--surface-elevated] border border-[--border] text-[--text] px-3 py-2 text-sm rounded-md hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dirty-state discard banner */}
      {dirtyDiscardOpen && (
        <div className="border-t border-[--border] bg-[--surface-elevated] px-6 py-3 flex items-center justify-between gap-2">
          <span className="text-sm text-[--text-muted]">Discard changes?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirtyDiscardOpen(false)}
              className="bg-[--surface] border border-[--border] text-sm px-3 py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setDirtyDiscardOpen(false)
                onClose()
              }}
              className="bg-[--danger] text-white text-sm px-3 py-2 rounded-md hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
