/**
 * coverageSpawn.ts — gitnexus analyze subprocess spawn.
 *
 * D-5-21 CSO contract: NEVER invoke `npx gitnexus`. Binary resolved through
 * PATH lookup only. Absent binary → graceful { kind: 'not-installed' }.
 * T-10-03-02: execa called with argv-array form — no shell string, no template literals.
 * CODEX MED-13: clipboard builders live in @agenticapps/dashboard-shared (shared/clipboard.ts).
 *   Re-exported here so Plan 04 (route) and Plan 06 (SPA) can import from either location.
 *   NO local function bodies for clipboard builders — re-export only.
 * D-10-09: wiki-compile is CLIPBOARD-ONLY. This module exports NO wiki spawn function.
 *   Only buildWikiCompileClipboardString is exported (string builder for SPA paste).
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { execa } from 'execa'
import { buildGitnexusIndexClipboardString } from '@agenticapps/dashboard-shared'

/** D-5-21: 5-minute timeout for gitnexus analyze. */
const SPAWN_TIMEOUT_MS = 5 * 60 * 1000

const execFileP = promisify(execFile)

/**
 * Resolve the gitnexus binary path via PATH lookup (POSIX `which`).
 * Returns null if the binary is not on PATH — NEVER falls back to `npx`.
 *
 * D-5-21: absolute ban on `npx gitnexus`. Only a locally-installed binary is accepted.
 */
async function resolveGitNexusBin(): Promise<string | null> {
  try {
    // argv-array form — no shell, no string interpolation (T-10-03-02)
    const { stdout } = await execFileP('which', ['gitnexus'])
    const trimmed = stdout.trim().split('\n')[0]
    return trimmed || null
  } catch {
    // `which` failed — binary not on PATH
    return null
  }
}

/**
 * Discriminated union of all possible gitnexus analyze outcomes.
 */
export type SpawnResult =
  | { kind: 'ok'; stdout: string }
  | { kind: 'not-installed' }
  | { kind: 'timeout' }
  | { kind: 'error'; exitCode: number; stderr: string }

/**
 * Spawn `gitnexus analyze` in the given repo directory.
 *
 * Security invariants (T-10-03-02 / T-10-03-03 / D-5-21):
 *  1. Binary resolved via PATH lookup — NEVER `npx gitnexus`.
 *  2. execa called with argv-array form (no shell string, no template literals,
 *     no execa.command()). Argv is sourced from the shared D-13-10 helper.
 *  3. cwd is a parameter — repo name never interpolated into argv.
 *
 * @param repoAbsPath  Absolute path to the repo to analyze (used as cwd).
 */
export async function spawnGitNexusAnalyze(
  repoAbsPath: string,
  /**
   * D-13-EXT-13 (Codex WARNING #5) — optional callback invoked synchronously
   * with the execa subprocess handle immediately after spawning. Callers may
   * register the handle with a shutdown disposer for kill-on-SIGTERM behaviour.
   * The callback runs before the spawn settles; it must not throw.
   */
  onSubprocess?: (sp: ReturnType<typeof execa>) => void,
): Promise<SpawnResult> {
  // D-5-21: PATH lookup only — never `npx gitnexus`
  const cmd = await resolveGitNexusBin()
  if (!cmd) return { kind: 'not-installed' }

  // T-10-03-02: argv-array form — cmd is an absolute path, args is a plain array.
  // D-13-10: argv sourced from the shared helper so this spawn and the SPA
  // clipboard fallback stay in lockstep (single source of truth).
  const sp = execa(cmd, [...buildGitnexusIndexClipboardString().argv], {
    cwd: repoAbsPath,
    timeout: SPAWN_TIMEOUT_MS,
  })
  if (onSubprocess) onSubprocess(sp)
  try {
    const result = await sp
    return { kind: 'ok', stdout: result.stdout }
  } catch (e: unknown) {
    const err = e as { timedOut?: boolean; exitCode?: number; stderr?: string; isCanceled?: boolean }
    if (err?.timedOut) return { kind: 'timeout' }
    return {
      kind: 'error',
      exitCode: err?.exitCode ?? -1,
      stderr: err?.stderr ?? '',
    }
  }
}

// ── Clipboard builders — CODEX MED-13 re-export ──────────────────────────────
//
// These builders live in packages/shared/src/clipboard.ts (Plan 01).
// Re-exported here so Plan 04 (Hono route) and Plan 06 (SPA) can import from
// either @agenticapps/dashboard-shared OR from this module without duplication.
//
// D-10-09: wiki-compile is CLIPBOARD-ONLY. The string builder is exported here;
//   this module contains ZERO wiki execution helpers — only the clipboard string (D-10-09 lock).
// CODEX MED-13: NO local function body — only re-export.
export {
  buildWikiCompileClipboardString,
  buildWorkflowUpdateClipboardString,
  buildClaudeMdHelpUrl,
  buildGitnexusInstallClipboardString,
} from '@agenticapps/dashboard-shared'
