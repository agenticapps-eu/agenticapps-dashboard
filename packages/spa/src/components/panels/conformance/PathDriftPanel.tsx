/**
 * PathDriftPanel — collapsible panel listing drifted registry entries (Plan 12-03 / D-12-20, D-12-21).
 *
 * For each drifted entry:
 *   - project id + storedPath + (suggestedPath OR a manual-paste input)
 *   - Fix path button → POST /api/admin/registry/fix-path via useRegistryFixPath
 *   - success toast (green) or error toast (red, mapped via errorCodeToMessage)
 *
 * Concurrent-click safety: per-row in-flight state is tracked in a ReadonlySet
 * (`inFlightRefreshes`) — Phase 11.2 pattern (CoveragePage.tsx). Two
 * simultaneous Fix-path clicks on different rows produce two independent
 * spinners; clicking the same row twice is a no-op while in flight.
 *
 * T-12-XSS: storedPath + suggestedPath rendered via JSX expression
 * interpolation (React escaping is the defence). NO dangerous inner-html prop.
 *
 * T-12-INPUT-OVERFLOW: paste input has maxLength={4096} (defence-in-depth on
 * top of daemon-side Zod .min(1) + rate limiter).
 *
 * T-12-TOAST-LEAK: errorCodeToMessage maps daemon error codes to user-friendly
 * strings — NEVER includes the raw error.message which could leak FS paths or
 * stack traces.
 */
import { useState, type ReactElement } from 'react'
import type { PathDriftEntry } from '@agenticapps/dashboard-shared'

import { useRegistryFixPath } from '../../../lib/conformanceQueries.js'
import { ApiError } from '../../../lib/api.js'
import { useToast } from '../../ui/Toast.js'

export interface PathDriftPanelProps {
  drifted: PathDriftEntry[]
}

/**
 * Map daemon error codes to user-friendly strings. The default-case message
 * (`Fix failed`) is intentionally generic so that unknown / future error codes
 * do not leak server internals into the toast (T-12-TOAST-LEAK).
 */
function errorCodeToMessage(code: string | undefined): string {
  switch (code) {
    case 'newPath_outside_family_roots':
      return 'Path is outside the family roots'
    case 'newPath_blocked':
      return 'Path is blocked (system or secret dir)'
    case 'newPath_unresolvable':
      return 'Path does not exist on disk'
    case 'project_not_found':
      return 'Project no longer in registry'
    case 'rate_limited':
      return 'Too many requests — try again in a few seconds'
    case 'invalid_request':
      return 'Invalid request — please reload and retry'
    default:
      return 'Fix failed'
  }
}

/**
 * Extract a daemon error code from the thrown ApiError.
 *
 * ApiError carries the daemon-supplied `code` (from ErrorResponseSchema.error
 * — e.g. `newPath_blocked`, `newPath_outside_family_roots`) since the apiFetch
 * fix that reads the response body. Falls back to HTTP-status inference for
 * 429/404 when the body is absent or unparseable.
 */
function extractErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) {
    if (err.code) return err.code
    if (err.status === 429) return 'rate_limited'
    if (err.status === 404) return 'project_not_found'
    return undefined
  }
  // Non-ApiError (e.g. mutation threw a different Error) — fall back to legacy
  // message-regex inference for backward-compat with existing tests.
  if (err instanceof Error) {
    const m = err.message.match(/HTTP (\d+)/)
    if (m && m[1] === '429') return 'rate_limited'
    if (m && m[1] === '404') return 'project_not_found'
  }
  return undefined
}

export function PathDriftPanel({ drifted }: PathDriftPanelProps): ReactElement | null {
  const [expanded, setExpanded] = useState<boolean>(true)
  const [manualPaths, setManualPaths] = useState<Record<string, string>>({})
  const [inFlightRefreshes, setInFlightRefreshes] = useState<ReadonlySet<string>>(() => new Set())
  const mutation = useRegistryFixPath()
  const toast = useToast()

  if (drifted.length === 0) return null

  const n = drifted.length

  const onFixPath = (entry: PathDriftEntry): void => {
    const newPath = entry.suggestedPath ?? manualPaths[entry.id] ?? ''
    if (!newPath) return
    if (inFlightRefreshes.has(entry.id)) return
    setInFlightRefreshes((prev) => {
      const next = new Set(prev)
      next.add(entry.id)
      return next
    })
    // mutateAsync + try/finally lets two concurrent row clicks each await their
    // OWN promise — Phase 11.2 CoveragePage pattern. The per-row Set is the
    // source of truth for disabled state; the shared mutation's isPending is
    // ignored to avoid the multi-concurrent-call race.
    void (async () => {
      try {
        await mutation.mutateAsync({ id: entry.id, newPath })
        toast.show({ message: `Fixed registry path for ${entry.id}`, variant: 'success' })
      } catch (err) {
        const code = extractErrorCode(err)
        toast.show({
          message: `Failed to fix path: ${errorCodeToMessage(code)}`,
          variant: 'error',
        })
      } finally {
        setInFlightRefreshes((prev) => {
          const next = new Set(prev)
          next.delete(entry.id)
          return next
        })
      }
    })()
  }

  return (
    <section className="rounded-lg border border-border-subtle bg-card-bg p-3">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          {n} drifted registr{n === 1 ? 'y' : 'ies'}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Toggle drifted registries"
          aria-expanded={expanded}
          className="text-text-tertiary hover:text-text-primary text-sm"
        >
          {expanded ? '▾' : '▸'}
        </button>
      </header>
      {expanded && (
        <ul className="mt-2 flex flex-col">
          {drifted.map((entry) => {
            const isInFlight = inFlightRefreshes.has(entry.id)
            const manual = manualPaths[entry.id] ?? ''
            const canFix = entry.suggestedPath != null || manual.length > 0
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2 py-2 border-b border-border-subtle last:border-b-0"
              >
                <span className="text-sm font-medium text-text-primary shrink-0">{entry.id}</span>
                <span
                  className="font-mono text-xs text-text-secondary truncate min-w-0"
                  title={entry.storedPath}
                >
                  {entry.storedPath}
                </span>
                <span className="text-text-tertiary text-xs shrink-0" aria-hidden="true">→</span>
                {entry.suggestedPath != null ? (
                  <span
                    className="font-mono text-xs text-text-primary truncate min-w-0"
                    title={entry.suggestedPath}
                  >
                    {entry.suggestedPath}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={manual}
                    onChange={(e) =>
                      setManualPaths((prev) => ({ ...prev, [entry.id]: e.target.value }))
                    }
                    maxLength={4096}
                    placeholder="Paste corrected path"
                    aria-label={`Manual path for ${entry.id}`}
                    className="font-mono text-xs border border-border-subtle rounded px-2 py-1 min-w-0 flex-1 bg-app-bg text-text-primary"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onFixPath(entry)}
                  disabled={isInFlight || !canFix}
                  aria-busy={isInFlight}
                  className="shrink-0 ml-auto px-3 py-1 rounded border border-border-subtle text-sm text-text-primary hover:bg-card-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInFlight ? '…' : 'Fix path'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
