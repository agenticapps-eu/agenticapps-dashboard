import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { serve, type ServerType } from '@hono/node-server'
import type { Hono } from 'hono'

import { writePidfile, removePidfile } from '../lib/pidfile.js'
import { writeServerInfo, removeServerInfo } from '../lib/serverInfo.js'
import { agentLog, agentError } from '../lib/logging.js'
import { renderBanner, renderZeroBindWarning } from '../lib/banner.js'
import { listProjectsWithStatus } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'
import { resolveSnapshotDir } from '../lib/snapshots/snapshotPaths.js'
import { startSnapshotScheduler } from '../lib/snapshots/snapshotScheduler.js'
import { disposeAllInflightScans } from '../lib/gitnexusScan.js'
import { SHUTDOWN_TIMEOUT_MS } from '../constants.js'

import type { Env } from './app.js'

export interface BootOptions {
  app: Hono<Env>
  host: string
  port: number
  /** hostname:port for pair URL — may differ from bind host on tailscale */
  pairHostname: string
  bindMode: 'loopback' | 'tailscale' | '0.0.0.0'
  /** Whether CIDR enforcement is active — used to render accurate D-20 warning */
  enforceCIDR?: boolean
}

// ── Disposer registry (Plan 11-02 Task 6 — REVIEWS.md action item 5) ──────────
//
// Single chokepoint for resources that need explicit teardown on shutdown
// (e.g. the snapshot scheduler's stop()). Disposers run LIFO so the most
// recently-armed resource is the first one released. A throwing disposer
// does NOT prevent earlier-registered disposers from running — each is
// wrapped in try/catch and a failure is logged via agentError.
//
// runDisposers() is idempotent: it clears the registry after the first call
// so the kill-timer + happy-path branches of gracefulShutdown cannot
// double-invoke a disposer.

type Disposer = () => void | Promise<void>

let disposers: Disposer[] = []

export function registerDisposer(fn: Disposer): void {
  disposers.push(fn)
}

export function clearDisposers(): void {
  disposers = []
}

function runDisposers(): void {
  const toRun = [...disposers].reverse()
  disposers = []
  for (const fn of toRun) {
    try {
      const result = fn()
      // Best-effort: we do NOT await async disposers because shutdown is on a
      // timeout — the killer setTimeout calls process.exit(0) regardless.
      // Async disposers MUST be best-effort cleanup only.
      if (result instanceof Promise) {
        result.catch((err) =>
          agentError(
            `[disposer] async disposer failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        )
      }
    } catch (err) {
      agentError(
        `[disposer] disposer threw: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}

/** Test-only export — direct access to runDisposers for boot.test.ts. */
export function _runDisposersForTests(): void {
  runDisposers()
}

// ── Symlink-escape boot check (Plan 11-02 Task 7 — T-11-02-03) ────────────────
//
// The daemon writes coverage-history NDJSON snapshots under
// ~/.agenticapps/dashboard/coverage-history/ (D-11-13). If that directory has
// been replaced by a symlink that resolves OUTSIDE ~/.agenticapps/dashboard/,
// every subsequent snapshot would be written to attacker-controlled storage.
//
// Defence: at boot, realpathSync() the snapshot dir parent + the snapshot dir
// itself and refuse to start if the realpath escapes the daemon home. Mirrors
// auth.ts's "refuse to start if X" idiom for INV-02 enforcement.
//
// If the snapshot dir doesn't exist yet (first-run), there is no symlink to
// check — boot proceeds normally and snapshotWriter.mkdir() will create it
// with mode 0o700 on the first tick.
export function assertSnapshotDirInDaemonHome(): void {
  const expected = join(homedir(), '.agenticapps', 'dashboard')
  let expectedReal: string
  try {
    expectedReal = realpathSync(expected)
  } catch {
    // Daemon home doesn't exist yet — first-run + auth.ts hasn't lazy-created
    // it. Nothing to check; auth path will create + chmod it.
    return
  }
  const snapshotDir = resolveSnapshotDir()
  if (!existsSync(snapshotDir)) return
  const real = realpathSync(snapshotDir)
  if (real !== expectedReal && !real.startsWith(expectedReal + '/')) {
    throw new Error(
      `[boot] coverage-history dir escapes daemon home: ${real} (expected under ${expectedReal})`,
    )
  }
}

/**
 * Test-only export — exercises the early-signal path (the closure body when
 * `serverRef === null` inside bootDaemon). Calls the same sequence the
 * inline closure runs: runDisposers → removePidfile → removeServerInfo →
 * process.exit(0).
 */
export function _earlyShutdownForTests(): void {
  runDisposers()
  removePidfile()
  removeServerInfo()
  process.exit(0)
}

/**
 * Start the Hono server, write pidfile + server.json, print the banner.
 * Returns the ServerType so the caller can pass it to gracefulShutdown.
 *
 * SIGTERM and SIGINT are wired to gracefulShutdown automatically.
 */
export async function bootDaemon(opts: BootOptions): Promise<ServerType> {
  // Symlink-escape defence — refuse to start if the snapshot dir realpath
  // escapes the daemon home (T-11-02-03). Runs BEFORE any state write or
  // signal-handler attach so a bad symlink fails fast at process start.
  assertSnapshotDirInDaemonHome()

  const projects = await listProjectsWithStatus()
  const bindUrl = `http://${opts.host}:${opts.port}`

  // Wire signal handlers BEFORE serve() so a Ctrl-C between the listen-callback
  // (which writes the pidfile + server.json) and a later handler-attach call
  // cannot leak state files. The shutdown closure captures `server` via the
  // mutable `serverRef` so an early signal — before serve resolves — exits
  // cleanly without dereferencing undefined.
  let serverRef: ServerType | null = null
  let stopping = false
  const shutdown = (): void => {
    if (stopping) return
    stopping = true
    if (serverRef) {
      gracefulShutdown(serverRef)
    } else {
      // Signal arrived before serve() returned: drain the disposer registry
      // so anything armed pre-listen (none today, but the contract holds for
      // future hooks) gets a chance to tear down before exit.
      runDisposers()
      removePidfile()
      removeServerInfo()
      process.exit(0)
    }
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  const server = serve(
    { fetch: opts.app.fetch, hostname: opts.host, port: opts.port },
    () => {
      // Print zero-bind warning before main banner (D-20)
      if (opts.bindMode === '0.0.0.0') {
        process.stdout.write(renderZeroBindWarning(opts.enforceCIDR ?? true))
      }

      process.stdout.write(
        renderBanner({
          bindUrl,
          pairHostname: opts.pairHostname,
          token: getActiveToken(),
          registryCount: projects.length,
          projectNames: projects.map((p) => p.name),
        }),
      )

      writePidfile()
      writeServerInfo({ bindUrl, pid: process.pid, startedAt: new Date().toISOString() })

      // Plan 11-02 Task 7 — wire the in-process snapshot scheduler (PD-11-01)
      // and register its disposer with the Task 6 disposer registry so
      // gracefulShutdown drains it on every shutdown branch.
      registerDisposer(startSnapshotScheduler())

      // D-13-EXT-13 (Codex WARNING #5) — Cancel in-flight gitnexus subprocesses
      // on shutdown so a daemon SIGTERM does not leave orphaned `gitnexus
      // analyze` processes holding ~/.gitnexus/registry.json locks. Idempotent
      // via Set.clear() so happy-path + kill-timer branches are both safe.
      registerDisposer(() => disposeAllInflightScans())
    },
  )

  serverRef = server

  return server
}

/**
 * Gracefully close the server, drain the disposer registry, clean up pidfile +
 * server.json. SHUTDOWN_TIMEOUT_MS hard timeout prevents keep-alive hangs
 * (RESEARCH Pitfall 6, T-01-03-08).
 *
 * runDisposers() is called on BOTH the happy-path close-callback AND the
 * kill-timer fallback, so a slow-to-close server cannot leak armed timers.
 * It is idempotent — repeat calls are no-ops — so either branch firing is safe.
 */
export function gracefulShutdown(server: ServerType): void {
  const killer = setTimeout(() => {
    agentError(
      `shutdown timed out after ${SHUTDOWN_TIMEOUT_MS / 1000}s, forcing exit`,
    )
    runDisposers()
    removePidfile()
    removeServerInfo()
    process.exit(0)
  }, SHUTDOWN_TIMEOUT_MS)

  agentLog('shutting down…')
  server.close(() => {
    clearTimeout(killer)
    runDisposers()
    removePidfile()
    removeServerInfo()
    process.exit(0)
  })
}
