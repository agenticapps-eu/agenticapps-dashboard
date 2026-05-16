import { serve, type ServerType } from '@hono/node-server'
import type { Hono } from 'hono'

import { writePidfile, removePidfile } from '../lib/pidfile.js'
import { writeServerInfo, removeServerInfo } from '../lib/serverInfo.js'
import { agentLog, agentError } from '../lib/logging.js'
import { renderBanner, renderZeroBindWarning } from '../lib/banner.js'
import { listProjectsWithStatus } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'
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
