import { randomUUID } from 'node:crypto'

/**
 * Write a [agent]-prefixed message to stdout.
 * No JSON, no log levels — simple prefix per CONTEXT.md D-02.
 */
export function agentLog(msg: string): void {
  process.stdout.write(`[agent] ${msg}\n`)
}

/**
 * Write a [agent]-prefixed message to stderr.
 */
export function agentError(msg: string): void {
  process.stderr.write(`[agent] ${msg}\n`)
}

/**
 * Generate a per-request UUID (v4) for correlation of logs and error responses.
 */
export function generateRequestId(): string {
  return randomUUID()
}

/**
 * Redact the value of any `token` query param in a log line (CSO Phase 14
 * audit item 1). Hono's logger logs the full request path INCLUDING the query
 * string, so per-repo viewer tokens (`/knowledge-graph.json?token=<hmac>`)
 * would otherwise land in stdout in cleartext. Replaces the value after
 * `?token=` / `&token=` with `[REDACTED]`, stopping at the next `&` or
 * whitespace so other params and the trailing status/elapsed survive.
 */
export function redactTokens(line: string): string {
  return line.replace(/([?&]token=)[^&\s]+/g, '$1[REDACTED]')
}
