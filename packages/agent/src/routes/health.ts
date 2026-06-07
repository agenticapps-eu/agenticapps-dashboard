import { Hono } from 'hono'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from '../version.js'
import { readRegistry } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'
import { outbound } from '../server/middleware/errors.js'
import { detectGitNexusBinary } from '../lib/scanners/gitNexusScanner.js'
import {
  compareSemver,
  getInstalledViewerVersion,
  getNewestPluginCacheVersion,
} from '../lib/viewerInstall.js'
import type { Env } from '../server/app.js'

export const healthRoute = new Hono<Env>()

healthRoute.get('/', (c) => {
  const registryFile = c.get('registryFile') as string | undefined
  const bindMode = c.get('bindMode')
  const reg = readRegistry(registryFile)

  // Phase 13 D-13-11b: compute gitnexus composite
  // installed = stat-based probe (no shell-out, survives launchd minimal PATH per Phase 10.6 D-10.6-02)
  // canScan = installed && bindMode === 'loopback' (loopback-only refusal per D-13-11)
  const installed = detectGitNexusBinary()
  const canScan = installed && bindMode === 'loopback'

  // Phase 14 D-14-02: detect + hint, manual re-run — no auto-rebuild
  // Pure stat/readdir — no subprocess (Phase 10.6 detection-without-execution discipline)
  const viewerVersion = getInstalledViewerVersion()
  const pluginVersion = getNewestPluginCacheVersion()
  const viewerInstalled = viewerVersion !== null

  const payload: HealthResponse = {
    ok: true,
    version: AGENT_VERSION,
    daemonVersion: AGENT_VERSION,
    registryCount: reg.projects.length,
    paired: getActiveToken().length > 0,
    gitnexus: { installed, canScan },
    // Phase 14 D-14-02: detect + hint, manual re-run — no auto-rebuild
    // T-14-06-03 safety: understand block carries versions ONLY — no token material.
    // Per-repo viewer tokens travel in CoverageRow.understand.viewerToken (HMAC-bound).
    understand: {
      viewerInstalled,
      viewerVersion,
      pluginVersion,
      // Semver ordering, not inequality: an installed viewer NEWER than the
      // plugin cache (cache pruned/rolled back) must not prompt a downgrade.
      updateAvailable:
        viewerVersion !== null && pluginVersion !== null && compareSemver(pluginVersion, viewerVersion) > 0,
    },
  }
  // D-16: outbound parse before send (INV-04)
  return outbound(c, HealthResponseSchema.parse.bind(HealthResponseSchema), payload)
})
