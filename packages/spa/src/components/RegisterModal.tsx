import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  RegisterPrepareResponse,
  RegisterPrepareAllowed,
  RegisterPrepareBlocked,
  RegisterPrepareAlreadyRegistered,
} from '@agenticapps/dashboard-shared'

import { useRegisterPrepare, useRegisterConfirm } from '../lib/registry.js'
import { ApiError } from '../lib/api.js'

import { SchemaDriftState } from './SchemaDriftState.js'

// F-008: type predicates over the shared RegisterPrepareResponseSchema union.
// The schema is a 3-way z.union; each variant has different fields, so we
// narrow with `in` + literal discriminator checks rather than `as unknown as`
// casts that would defeat parseOrDrift's validation guarantee.
function isBlocked(d: RegisterPrepareResponse): d is RegisterPrepareBlocked {
  return 'blocked' in d && d.blocked === true
}
function isAlreadyRegistered(d: RegisterPrepareResponse): d is RegisterPrepareAlreadyRegistered {
  return 'alreadyRegistered' in d && d.alreadyRegistered === true
}
function isAllowed(d: RegisterPrepareResponse): d is RegisterPrepareAllowed {
  return !isBlocked(d) && !isAlreadyRegistered(d)
}

type ModalMode =
  | 'step1'
  | 'step2-allowed'
  | 'step2-blocked'
  | 'step2-already'
  | 'drift'

function decodePrepareResponse(data: RegisterPrepareResponse): ModalMode {
  if (isBlocked(data)) return 'step2-blocked'
  if (isAlreadyRegistered(data)) return 'step2-already'
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
  const [prepareData, setPrepareData] = useState<RegisterPrepareResponse | null>(null)
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
      // The cascading renders the rule warns about are intended: each open
      // resets internal form state in one batch (D-13 dirty-discard semantics).
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (mode === 'step2-allowed' && prepareData && isAllowed(prepareData)) {
      return (
        name !== prepareData.suggestedName ||
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
          setPrepareData(data)
          const nextMode = decodePrepareResponse(data)
          setMode(nextMode)
          if (isAllowed(data)) {
            setName(data.suggestedName)
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
    if (mode !== 'step2-allowed' || !prepareData || !isAllowed(prepareData)) return
    try {
      const result = await confirm.mutateAsync({
        nonce: prepareData.nonce,
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
          setPrepareData(fresh)
          if (isAllowed(fresh)) {
            // Retry confirm directly with fresh nonce (avoid stale closure issue)
            const retryResult = await confirm.mutateAsync({
              nonce: fresh.nonce,
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
    if (mode !== 'step2-allowed' || !prepareData || !isAllowed(prepareData)) return false
    return (
      prepareData.detectedMarkers.gitRepo === false &&
      prepareData.detectedMarkers.planning === false &&
      prepareData.detectedMarkers.claudeSkills === false
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <dialog
      ref={dialogRef}
      className="bg-card-bg border border-border-subtle rounded-lg p-0 max-w-md w-full mx-4 dark:shadow-none shadow-card backdrop:bg-text-primary/50"
      onCancel={handleEscape}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold leading-snug text-text-primary">
            {mode === 'step1' ? 'Register a project' : 'Confirm registration'}
          </h2>
          <button
            type="button"
            aria-label="Close registration dialog"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>
        </div>

        {/* Step 1 */}
        {mode === 'step1' && (
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
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
              className="w-full bg-card-bg-hover border border-border-subtle rounded-md px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="/Users/you/Sourcecode/my-project"
            />
            <p className="mt-1 text-sm text-text-secondary">
              Full path to the project root.
            </p>

            {networkError && (
              <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                <span>Couldn&apos;t reach the daemon.</span>
                <button
                  type="button"
                  onClick={() => {
                    setNetworkError(false)
                    handlePreview()
                  }}
                  className="underline text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                className="bg-card-bg-hover border border-border-subtle text-text-primary px-4 py-2 text-sm font-semibold rounded-md hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
        {mode === 'step2-allowed' && prepareData && isAllowed(prepareData) && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-text-primary bg-card-bg-hover px-3 py-2 rounded-md">
                {prepareData.canonicalRoot}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConfirm()
                }}
                className="w-full bg-card-bg-hover border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {/* Client */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Client (optional)
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full bg-card-bg-hover border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="bg-accent text-white border border-accent text-sm px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                className="w-full bg-card-bg-hover border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {/* No-markers hint */}
            {showNoMarkersHint() && (
              <div className="mb-4 text-sm text-text-secondary flex items-start gap-2">
                <span aria-hidden="true">ⓘ</span>
                <span>No git repo or .planning/.claude found here. Cards may show empty data.</span>
              </div>
            )}

            {/* Refreshing indicator for 410 auto-re-prepare */}
            {refreshing && (
              <div className="mb-4 text-sm text-text-secondary">refreshing…</div>
            )}

            {/* Network error in step 2 */}
            {networkError && (
              <div className="mb-4 text-sm text-text-secondary">
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
                className="bg-card-bg-hover border border-border-subtle text-text-primary px-4 py-2 text-sm font-semibold rounded-md hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={confirm.isPending || refreshing}
                className="bg-accent text-white px-4 py-2 text-sm font-semibold rounded-md hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirm.isPending || refreshing ? 'Registering…' : 'Confirm registration'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — blocked */}
        {mode === 'step2-blocked' && prepareData && isBlocked(prepareData) && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-text-primary bg-card-bg-hover px-3 py-2 rounded-md">
                {prepareData.canonicalRoot}
              </div>
            </div>

            {/* Blocked banner */}
            <div className="mb-4 bg-status-error/8 border border-status-error/40 px-4 py-3 rounded-md text-sm text-text-primary">
              Blocked: {prepareData.blockedReason}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('step1')
                  setPrepareData(null)
                }}
                className="bg-card-bg-hover border border-border-subtle text-text-primary px-4 py-2 text-sm font-semibold rounded-md hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Back
              </button>
              <button
                type="button"
                disabled
                className="bg-accent text-white px-4 py-2 text-sm font-semibold rounded-md opacity-50 cursor-not-allowed"
              >
                Confirm registration
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — already registered */}
        {mode === 'step2-already' && prepareData && isAlreadyRegistered(prepareData) && (
          <div>
            {/* Resolved path */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Resolved path
              </label>
              <div className="font-mono text-sm text-text-primary bg-card-bg-hover px-3 py-2 rounded-md">
                {prepareData.canonicalRoot}
              </div>
            </div>

            {/* Already-registered banner */}
            <div className="mb-4 bg-card-bg-hover border border-border-subtle px-4 py-3 rounded-md">
              <p className="text-sm text-text-primary mb-3">
                Already registered as {prepareData.existingEntry.id} since{' '}
                {new Date(prepareData.existingEntry.addedAt).toLocaleDateString()}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigate({
                      to: '/projects/$projectId',
                      params: {
                        projectId: prepareData.existingEntry.id,
                      },
                    })
                    onClose()
                  }}
                  className="bg-accent text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Open project
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-card-bg-hover border border-border-subtle text-text-primary px-3 py-2 text-sm rounded-md hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        <div className="border-t border-border-subtle bg-card-bg-hover px-6 py-3 flex items-center justify-between gap-2">
          <span className="text-sm text-text-secondary">Discard changes?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirtyDiscardOpen(false)}
              className="bg-card-bg border border-border-subtle text-sm px-3 py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setDirtyDiscardOpen(false)
                onClose()
              }}
              className="bg-status-error text-white text-sm px-3 py-2 rounded-md hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
