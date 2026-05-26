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

  // D-13-EXT-14 (Codex WARNING #4) — Terminal cleanup on poll ERROR.
  //
  // If the daemon disappears mid-poll (5xx, SCAN_NOT_FOUND after TTL eviction,
  // network drop), useGitnexusScanProgress lands in isError state with
  // data: undefined. The success-path effect below doesn't fire because
  // progress.data is falsy; without this branch the pill stays on
  // 'Scanning…' until the row remounts.
  useEffect(() => {
    if (!progress.isError) return
    const code = (progress.error as { code?: string } | undefined)?.code ?? 'SCAN_NOT_FOUND'
    let cancelled = false
    ;(async () => {
      // Best-effort: refetch coverage so any partial work surfaces. Swallow
      // any refetch error — we still need to clear scanId regardless.
      try { await qc.refetchQueries({ queryKey: ['coverage'] }) } catch { /* ignore */ }
      if (cancelled) return
      toast.show({
        variant: 'error',
        message: `Indexing failed: ${scanErrorCodeToMessage(code as never)}`,
      })
      setScanId(null)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.isError])

  // Terminal state handler: AWAIT coverage refetch so the row's gitNexus state
  // updates BEFORE we clear scanId (D-13-EXT-08 UAT follow-up, 2026-05-25). If we
  // cleared scanId before the refetch landed, isPending would flip false and
  // ScanPill would briefly revert to the idle "Scan" button on a row that's
  // still rendering the OLD pre-scan state — confusing UX (user reported during
  // re-verification: "still shows scan ... takes a while than it shows when it
  // was scanned"). Awaiting the refetch keeps "Scanning…" visible until the
  // row data reflects reality.
  useEffect(() => {
    if (!progress.data) return
    if (progress.data.state === 'running') return

    // Snapshot the terminal data — progress.data may change as we await
    const terminalData = progress.data
    let cancelled = false

    ;(async () => {
      // Await coverage refetch so row.gitNexus state flips fresh before idle.
      // refetchQueries() resolves after the network round-trip completes.
      await qc.refetchQueries({ queryKey: ['coverage'] })
      if (cancelled) return
      // conformance is best-effort — fire-and-forget is fine here.
      void qc.invalidateQueries({ queryKey: ['conformance'] })

      if (terminalData.kind === 'repo') {
        if (terminalData.state === 'done') {
          toast.show({ variant: 'success', message: `Indexed ${target}` })
        } else {
          const code = terminalData.error?.code ?? 'INTERNAL_ERROR'
          toast.show({
            variant: 'error',
            message: `Indexing failed: ${scanErrorCodeToMessage(code)}`,
          })
        }
      } else {
        const familyData = terminalData as {
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
    })()

    return () => {
      cancelled = true
    }
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

  // Scanning state: while scanId is set, show "Scanning…". scanId is cleared by
  // the terminal effect AFTER coverage refetch completes (D-13-EXT-08 UAT
  // follow-up), so this single condition covers the whole running-→-row-refresh
  // window. Without this, the pill briefly reverted to idle while the coverage
  // refetch was in flight, displaying "Scan" on a row that had already been
  // scanned but whose data hadn't refreshed yet.
  const isPending = scanId !== null
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
