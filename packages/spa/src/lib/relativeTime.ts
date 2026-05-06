/**
 * relativeTime.ts — pure utility for human-readable relative timestamps.
 *
 * Used by HookFirings panel to display hook event timestamps.
 * No external dependencies — pure arithmetic on Date objects.
 *
 * Design choices:
 * - Caps at days (no weeks/months) — imprecise for a polling dashboard (UI-SPEC).
 * - Future timestamps clamp to 'just now' — clock skew defense (RT6).
 * - Invalid input returns 'unknown' — defensive; daemon mustn't crash the panel (RT7).
 */

export interface FormatOptions {
  now?: Date
}

/**
 * Format an ISO 8601 timestamp as a compact relative-time label.
 * Examples: '30s ago', '5m ago', '2h ago', '3d ago'.
 * Future timestamps clamp to 'just now' (clock skew defense).
 * Invalid input returns 'unknown' (defensive — the daemon mustn't crash the panel).
 */
export function formatRelativeTime(iso: string, opts: FormatOptions = {}): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'unknown'
  const now = opts.now ?? new Date()
  const deltaMs = now.getTime() - t
  if (deltaMs < 1_000) return 'just now'
  const seconds = Math.floor(deltaMs / 1_000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
