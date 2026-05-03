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
