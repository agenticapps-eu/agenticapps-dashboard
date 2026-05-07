/**
 * agentLinterRunner.ts — Spawns `npx agentlinter --local --json <projectRoot>`
 * and classifies the outcome into 5 discriminated `kind` values.
 *
 * PRIVACY INVARIANT (T-05-02-AgentLinter-Local):
 * The `--local` flag MUST be present in every spawn. Without it, the daemon
 * would upload CLAUDE.md content to the AgentLinter cloud, breaking
 * "no cloud-side data storage". This is codified in the test.
 *
 * SUBPROCESS SECURITY (T-05-02-Subprocess-Inj):
 * execa is called with an argv array (never a shell string). No template
 * literals, no shell expansion. The project root arrives as a plain argument.
 *
 * TIMEOUT (T-05-02-Timeout-DoS):
 * 30-second timeout enforced. Hung subprocess surfaces as `kind: 'timeout'`.
 *
 * D-5-15: 5 failure classes:
 *   - ok            — exit 0 + valid JSON
 *   - not-installed — npx E404 / spawn failure
 *   - timeout       — proc.timedOut
 *   - error         — non-zero exit, parseable or unparseable stderr
 *   - unparseable   — exit 0, stdout not valid JSON
 */
import { execa } from 'execa'

import type { AgentLinterReport } from '@agenticapps/dashboard-shared'

export type { AgentLinterReport }

/** D-5-15 timeout threshold. */
const TIMEOUT_MS = 30_000

/**
 * Discriminated union of all possible AgentLinter invocation outcomes.
 * The SPA panels render a distinct state for each kind.
 */
export type AgentLinterResult =
  | { kind: 'ok'; report: AgentLinterReport }
  | { kind: 'not-installed' }
  | { kind: 'timeout' }
  | { kind: 'error'; exitCode: number; stderr: string }
  | { kind: 'unparseable'; exitCode: number; rawStdout: string }

/**
 * Run `npx --yes agentlinter --local --json <projectRoot>` and classify the
 * outcome. NEVER throws — all failure modes are surfaced as discriminated kinds.
 *
 * Privacy invariant: `--local` is ALWAYS in the argv array. This prevents
 * AgentLinter from uploading CLAUDE.md content to the cloud (T-05-02-AgentLinter-Local).
 */
export async function runAgentLinter(projectRoot: string): Promise<AgentLinterResult> {
  let proc
  try {
    proc = await execa(
      'npx',
      ['--yes', 'agentlinter', '--local', '--json', projectRoot],
      {
        timeout: TIMEOUT_MS,
        reject: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch (e: unknown) {
    // execa throws when timedOut (when reject:true or when timeout fires as rejection)
    const err = e as { timedOut?: boolean }
    if (err?.timedOut) return { kind: 'timeout' }
    // Any other throw means npx couldn't spawn at all
    return { kind: 'not-installed' }
  }

  // When reject:false, timedOut is a property on the result
  if ((proc as unknown as { timedOut?: boolean }).timedOut) return { kind: 'timeout' }

  const exitCode = proc.exitCode ?? -1
  const stderr = proc.stderr ?? ''
  const stdout = proc.stdout ?? ''

  if (exitCode !== 0) {
    // "npm error 404 Not Found" or "not found" → agentlinter not installed
    if (/E404|not found/i.test(stderr)) return { kind: 'not-installed' }
    // Some agentlinter versions emit valid JSON even on non-zero exit
    try {
      const parsed = JSON.parse(stdout) as AgentLinterReport
      return { kind: 'ok', report: parsed }
    } catch {
      /* fall through to error */
    }
    return { kind: 'error', exitCode, stderr }
  }

  // Exit 0 — try to parse JSON
  try {
    return { kind: 'ok', report: JSON.parse(stdout) as AgentLinterReport }
  } catch {
    return { kind: 'unparseable', exitCode, rawStdout: stdout }
  }
}
