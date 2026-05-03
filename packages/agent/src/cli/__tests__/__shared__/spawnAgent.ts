import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnSyncReturns,
} from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
// __dirname = packages/agent/src/cli/__tests__/__shared__/
// ../../../../ = packages/agent/
export const cliBundle = resolve(__dirname, '../../../../dist/cli.js')

/**
 * Create a mktemp-isolated HOME directory with the dashboard config dir pre-created.
 * Returns the home path and a cleanup function.
 * T-01-04-06: every subprocess test uses an isolated HOME — never touches ~/.agenticapps/dashboard
 */
export function makeIsolatedHome(): { home: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), 'agentic-cli-'))
  mkdirSync(join(home, '.agenticapps', 'dashboard'), { recursive: true, mode: 0o700 })
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) }
}

/**
 * Run the CLI synchronously (for non-server commands).
 * HOME is overridden to the isolated home to prevent any writes to the real ~/.agenticapps/dashboard.
 */
export function runAgent(
  args: string[],
  home: string,
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> {
  return spawnSync('node', [cliBundle, ...args], {
    env: { ...process.env, HOME: home, ...env },
    encoding: 'utf8',
    timeout: 15_000,
  })
}

/**
 * Spawn `start` in background; returns the child process and a Promise that resolves
 * once the daemon is listening (detected by "Listening on" in stdout/stderr).
 *
 * T-01-04-10: caller passes a random port to avoid collisions on parallel runs.
 */
export function startAgent(
  home: string,
  port: number,
  extraArgs: string[] = [],
): { child: ChildProcess; ready: Promise<void> } {
  const child = spawn('node', [cliBundle, 'start', '--port', String(port), ...extraArgs], {
    env: { ...process.env, HOME: home, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const ready = new Promise<void>((resolveReady, rejectReady) => {
    let buf = ''
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString('utf8')
      if (buf.includes('Listening on')) resolveReady()
    }
    child.stdout!.on('data', onData)
    child.stderr!.on('data', onData)
    child.once('exit', () =>
      rejectReady(new Error(`agent exited before listening; output:\n${buf}`)),
    )
    setTimeout(
      () => rejectReady(new Error(`agent did not start within 5s; output:\n${buf}`)),
      5_000,
    )
  })

  return { child, ready }
}
