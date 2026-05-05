/**
 * Blocked-registration stderr logger (D-15).
 *
 * Format: [agent] BLOCKED register: <root> (<reason>) tokenHash=<8chars> requestId=<uuid>
 * Single line per D-15; no JSON, no log levels (consistent with Phase 1 D-02).
 * Sanitizes \n → \\n in reason and root to prevent log injection (T-03-01-02).
 */
export function logBlocked(
  reason: string,
  root: string,
  tokenHash: string,
  requestId: string
): void {
  const safeRoot = root.replace(/\n/g, '\\n')
  const safeReason = reason.replace(/\n/g, '\\n')
  console.error(
    `[agent] BLOCKED register: ${safeRoot} (${safeReason}) tokenHash=${tokenHash} requestId=${requestId}`
  )
}
