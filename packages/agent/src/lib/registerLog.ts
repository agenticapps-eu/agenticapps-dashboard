/**
 * D-15: Blocked-registration audit log.
 * Writes a single stderr line per blocked attempt.
 * Format: [agent] BLOCKED register: <root> (<reason>) tokenHash=<8chars> requestId=<uuid>
 */

/**
 * Log a blocked registration attempt to stderr.
 * Sanitizes `reason` and `root` to prevent newline injection (\n → \\n).
 */
export function logBlocked(
  reason: string,
  root: string,
  tokenHash: string,
  requestId: string,
): void {
  const safeRoot = root.replace(/\n/g, '\\n')
  const safeReason = reason.replace(/\n/g, '\\n')
  console.error(
    `[agent] BLOCKED register: ${safeRoot} (${safeReason}) tokenHash=${tokenHash} requestId=${requestId}`,
  )
}
