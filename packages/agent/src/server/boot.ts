import { serve, type ServerType } from '@hono/node-server'
import type { Hono } from 'hono'

import { writePidfile, removePidfile } from '../lib/pidfile.js'
import { writeServerInfo, removeServerInfo } from '../lib/serverInfo.js'
import { agentLog, agentError } from '../lib/logging.js'
import { renderBanner, renderZeroBindWarning } from '../lib/banner.js'
import { listProjectsWithStatus } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'

import type { Env } from './app.js'

export interface BootOptions {
  app: Hono<Env>
  host: string
  port: number
  /** hostname:port for pair URL — may differ from bind host on tailscale */
  pairHostname: string
  bindMode: 'loopback' | 'tailscale' | '0.0.0.0'
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

  const server = serve(
    { fetch: opts.app.fetch, hostname: opts.host, port: opts.port },
    () => {
      // Print zero-bind warning before main banner (D-20)
      if (opts.bindMode === '0.0.0.0') {
        process.stdout.write(renderZeroBindWarning())
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

  const shutdown = (): void => {
    gracefulShutdown(server)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return server
}

/**
 * Gracefully close the server, clean up pidfile + server.json.
 * 5s hard timeout prevents keep-alive hangs (RESEARCH Pitfall 6, T-01-03-08).
 */
export function gracefulShutdown(server: ServerType): void {
  const killer = setTimeout(() => {
    agentError('shutdown timed out after 5s, forcing exit')
    removePidfile()
    removeServerInfo()
    process.exit(0)
  }, 5000)

  agentLog('shutting down…')
  server.close(() => {
    clearTimeout(killer)
    removePidfile()
    removeServerInfo()
    process.exit(0)
  })
}
