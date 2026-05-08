/**
 * agentLinterRunner.ts — Spawns the bundled `@agenticapps/agentlinter` binary
 * and classifies the outcome into 5 discriminated `kind` values.
 *
 * SUPPLY CHAIN INVARIANT (D-5-21 / 2026-05-08 security review):
 * The spawn target is the LOCAL bin from `@agenticapps/agentlinter`, resolved
 * via createRequire at call time. This package is the team-controlled fork of
 * upstream agentlinter (owner: simonkim). Pinning via pnpm-lock means every
 * version on disk has been reviewed; no bare `npx` against the open registry.
 * Test #1 asserts the spawn cmd is `node` and arg[0] is a path under
 * `@agenticapps/agentlinter`.
 *
 * PRIVACY INVARIANT (T-05-02-AgentLinter-Local):
 * The `--local` flag MUST be present in every spawn. Without it, the binary
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
 *   - not-installed — package not resolvable / spawn failure
 *   - timeout       — proc.timedOut
 *   - error         — non-zero exit, parseable or unparseable stderr
 *   - unparseable   — exit 0, stdout not valid JSON
 */
import { createRequire } from 'node:module'
import { dirname, resolve as resolvePath } from 'node:path'

import { execa } from 'execa'

import type { AgentLinterReport } from '@agenticapps/dashboard-shared'

export type { AgentLinterReport }

/** D-5-15 timeout threshold. */
const TIMEOUT_MS = 30_000

/** D-5-21 spawn target package — team-controlled fork. */
const AGENTLINTER_PACKAGE = '@agenticapps/agentlinter'

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
 * Resolve the absolute path to the bundled agentlinter binary at call time.
 * Lazy so unit tests that mock execa never touch the filesystem, and a missing
 * package degrades to `kind: 'not-installed'` instead of crashing module load.
 */
function resolveBinPath(): string | null {
  try {
    const require = createRequire(import.meta.url)
    const pkgJsonPath = require.resolve(`${AGENTLINTER_PACKAGE}/package.json`)
    const pkg = require(`${AGENTLINTER_PACKAGE}/package.json`) as {
      bin?: string | Record<string, string>
    }
    const binEntry =
      typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.agentlinter ?? null)
    if (!binEntry) return null
    return resolvePath(dirname(pkgJsonPath), binEntry)
  } catch {
    return null
  }
}

/**
 * Run the bundled agentlinter binary and classify the outcome.
 * NEVER throws — all failure modes are surfaced as discriminated kinds.
 *
 * Privacy invariant: `--local` is ALWAYS in the argv array.
 * Supply chain invariant: spawn target is `node <resolved-bin-from-fork>`,
 * never bare `npx <name>` against the open registry.
 *
 * `opts.binPath` is a test seam — production callers omit it and the bin path
 * resolves via createRequire from the bundled `@agenticapps/agentlinter` dep.
 * Tests pass a synthetic path so they exercise the spawn shape without
 * requiring the package to be installed in node_modules.
 */
export async function runAgentLinter(
  projectRoot: string,
  opts?: { binPath?: string },
): Promise<AgentLinterResult> {
  const binPath = opts?.binPath ?? resolveBinPath()
  if (binPath === null) return { kind: 'not-installed' }

  let proc
  try {
    proc = await execa(
      'node',
      [binPath, '--local', '--json', projectRoot],
      {
        timeout: TIMEOUT_MS,
        reject: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch (e: unknown) {
    const err = e as { timedOut?: boolean }
    if (err?.timedOut) return { kind: 'timeout' }
    return { kind: 'not-installed' }
  }

  if ((proc as unknown as { timedOut?: boolean }).timedOut) return { kind: 'timeout' }

  const exitCode = proc.exitCode ?? -1
  const stderr = proc.stderr ?? ''
  const stdout = proc.stdout ?? ''

  if (exitCode !== 0) {
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
