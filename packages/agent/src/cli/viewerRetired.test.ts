/**
 * viewerRetired.test.ts — the knowledge-graph viewer's install path is retired.
 *
 * The `code-intelligence` delta withdraws `Viewer Asset Installation` outright:
 * "Exists only to install assets for the viewer withdrawn above … The
 * installation path and its asset directory are removed." Its sibling
 * `Knowledge-Graph Analysis Status` says the status "is no longer reported
 * anywhere in the dashboard", which is what takes the `understand` block out of
 * the health payload.
 *
 * That block is the half worth guarding. The viewer's nineteen serving
 * endpoints went in the teardown, but `/health` kept reporting whether a viewer
 * was installed — a live field on a retained route describing a feature with no
 * remaining surface, and the kind of thing that survives a deletion precisely
 * because nothing points at it.
 */
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliBundle = resolve(__dirname, '../../dist/cli.js')
const SRC_ROOT = resolve(__dirname, '..')

describe('the knowledge-graph viewer install path is retired', () => {
  let cleanup: () => void
  let authFile: string
  let token: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
  })

  afterEach(() => cleanup())

  it('registers no install-understand-viewer command on the CLI', () => {
    const result = spawnSync('node', [cliBundle, '--help'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).not.toMatch(/install-understand-viewer/)
  })

  it('reports no viewer install state on /health', async () => {
    const app = createApp({ authFile })
    const response = await app.request('http://127.0.0.1/health', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('understand')
    expect(JSON.stringify(body)).not.toMatch(/viewerInstalled|viewerVersion|pluginVersion/)
  })

  it('has removed the install command and its helper module entirely', () => {
    for (const gone of ['cli/installUnderstandViewer.ts', 'lib/viewerInstall.ts']) {
      expect(() => statSync(join(SRC_ROOT, gone))).toThrow()
    }
  })
})
