/**
 * ScanPill.tsx — Per-row + per-family Scan affordance primitive.
 *
 * Phase 13 Plan 13-03 (Wave 3): D-13-08 per-row scan, D-13-11b disabled tooltip.
 *
 * Props:
 *   scope: 'repo' | 'family'
 *   target: string            // repoId (family/repo) OR familyId
 *   canScan: boolean          // from health response (gitnexus.canScan)
 *   installed: boolean        // from health response (gitnexus.installed)
 *
 * Four rendered states:
 *   1. enabled (canScan=true, idle): Sparkles icon + "Scan" label, button role
 *   2. scanning (mid-scan): Loader2 spinner + "Scanning…" label, disabled
 *   3. disabled+tooltip (canScan=false, installed=true): button disabled with Tooltip wrapper
 *   4. null (installed=false): renders nothing — parent uses InstallGitNexusButton instead
 *
 * CRITICAL — Rules of Hooks:
 *   ALL hook calls appear UNCONDITIONALLY at the top of the function BEFORE any
 *   early return. The `if (!installed) return null` is placed AFTER every hook.
 *
 * Cache invalidation (D-13-09):
 *   On terminal state ('done' or 'error'), this component invalidates BOTH
 *   ['coverage'] and ['conformance'] query keys via useQueryClient.
 *   This causes the coverage matrix to refetch and cells flip ✗ → ✓.
 *
 * T-13-03-01: Raw error.message from daemon is NEVER shown in toast — only
 *   the error code enum is used via scanErrorCodeToMessage.
 * T-13-03-02: React JSX escaping prevents XSS from target string interpolation.
 * T-13-03-03: Button disabled while scanId !== null + state='running' prevents double-trigger.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import { Sparkles, Loader2, Play } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useGitnexusScan,
  useGitnexusScanProgress,
  scanErrorCodeToMessage,
} from '../../../lib/queries/gitnexusScan.js'
import { useToast } from '../../ui/Toast.js'
import { Tooltip } from '../../ui/Tooltip.js'

export interface ScanPillProps {
  scope: 'repo' | 'family'
  target: string
  canScan: boolean
  installed: boolean
}

export function ScanPill({ scope, target, canScan, installed }: ScanPillProps) {
  // ── ALL hooks unconditionally at the top (Rules of Hooks) ────────────────
  const qc = useQueryClient()
  const toast = useToast()
  const [scanId, setScanId] = useState<string | null>(null)
  const scan = useGitnexusScan()
  const progress = useGitnexusScanProgress(scanId)

  // Terminal state handler: invalidate caches + show toast + reset scanId
  useEffect(() => {
    if (!progress.data) return
    if (progress.data.state === 'running') return
    // Terminal — invalidate coverage + conformance, show toast, reset
    void qc.invalidateQueries({ queryKey: ['coverage'] })
    void qc.invalidateQueries({ queryKey: ['conformance'] })

    if (progress.data.kind === 'repo') {
      if (progress.data.state === 'done') {
        toast.show({ variant: 'success', message: `Indexed ${target}` })
      } else {
        // state === 'error'
        const code = progress.data.error?.code ?? 'INTERNAL_ERROR'
        toast.show({
          variant: 'error',
          message: `Indexing failed: ${scanErrorCodeToMessage(code)}`,
        })
      }
    } else {
      // kind === 'family' — partial-success semantics (D-13-05)
      // FamilyScanShape has completed/failed/total counts
      const familyData = progress.data as {
        kind: 'family'
        state: 'running' | 'done'
        completed: number
        failed: number
        total: number
      }
      const { completed, failed, total } = familyData
      if (failed === 0) {
        toast.show({
          variant: 'success',
          message: `Scanned ${completed} repos in ${target}`,
        })
      } else {
        toast.show({
          variant: 'error',
          message: `${completed}/${total} scanned, ${failed} failed — retry failed?`,
        })
      }
    }
    setScanId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.data?.state])

  // ── Early returns AFTER all hooks ────────────────────────────────────────

  // D-13-07: installed=false → renders nothing; parent uses InstallGitNexusButton
  if (!installed) return null

  // D-13-11b: installed=true but canScan=false (e.g. Tailscale session)
  if (!canScan) {
    return (
      <Tooltip content="Connect from the host device to scan">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="opacity-50 cursor-not-allowed inline-flex items-center gap-1 text-xs"
        >
          <Play size={12} aria-hidden="true" /> Scan
        </button>
      </Tooltip>
    )
  }

  // Scanning state: scanId set + progress shows running (or still fetching first result)
  const isPending =
    scanId !== null && (progress.data?.state === 'running' || progress.isFetching)
  if (isPending) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-text-secondary"
        aria-live="polite"
      >
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Scanning…
      </span>
    )
  }

  // Idle — enabled Scan button
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          // Cast needed: TS can't narrow discriminated union from destructured props
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = await scan.mutateAsync({ scope, target } as any)
          setScanId(r.scanId)
        } catch (err) {
          const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR'
          toast.show({
            variant: 'error',
            message: `Indexing failed: ${scanErrorCodeToMessage(code as never)}`,
          })
        }
      }}
      className="inline-flex items-center gap-1 text-xs rounded-full bg-accent/10 px-2 py-0.5 hover:bg-accent/20 focus:outline focus:outline-2 focus:outline-accent"
    >
      <Sparkles size={12} aria-hidden="true" /> Scan
    </button>
  )
}
