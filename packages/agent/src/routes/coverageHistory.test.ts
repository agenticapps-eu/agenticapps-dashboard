import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverageHistoryResponseSchema } from '@agenticapps/dashboard-shared'

vi.mock('../lib/coverageScan.js', () => ({
  scanCoverage: vi.fn(),
  scanCoverageInternal: vi.fn(),
}))
vi.mock('../lib/registry.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/registry.js')>('../lib/registry.js')
  return { ...actual, readRegistry: vi.fn() }
})
vi.mock('../lib/snapshots/snapshotReader.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/snapshots/snapshotReader.js')>(
    '../lib/snapshots/snapshotReader.js',
  )
  return { ...actual, readDriftForRepo: vi.fn() }
})

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { clearCoverageHistoryCache } from '../lib/coverageHistoryCache.js'
import { scanCoverageInternal } from '../lib/coverageScan.js'
import { readRegistry } from '../lib/registry.js'
import { readDriftForRepo } from '../lib/snapshots/snapshotReader.js'

describe('GET /api/coverage/history', () => {
  let cleanup: () => void
  let token: string
  let authFile: string

  beforeEach(() => {
    vi.clearAllMocks()
    clearCoverageHistoryCache()
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
    vi.mocked(scanCoverageInternal).mockResolvedValue({
      response: {
        schemaVersion: 2,
        generatedAtIso: '2026-07-28T00:00:00.000Z',
        workflowHeadVersion: '3.0.0',
        rows: [
          {
            family: 'agenticapps',
            repo: 'dashboard',
            claudeMd: { kind: 'basic', state: 'fresh' },
            workflowVersion: {
              kind: 'workflow',
              state: 'fresh',
              installedVersion: '3.0.0',
              headVersion: '3.0.0',
            },
            understand: { kind: 'basic', state: 'missing' },
            overrideCount: 0,
            overrides: [],
          },
        ],
      },
      internalRows: [],
    })
    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] })
    vi.mocked(readDriftForRepo).mockResolvedValue({
      claudeMd: { direction: null, daysSince: null },
      workflowVersion: { direction: 'down', daysSince: 2 },
    })
  })

  afterEach(() => {
    cleanup()
    clearCoverageHistoryCache()
  })

  it('returns the strict version-2 two-cell response', async () => {
    const app = createApp({ authFile })
    const response = await app.request(
      'http://127.0.0.1/api/coverage/history?repoId=agenticapps/dashboard',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(CoverageHistoryResponseSchema.safeParse(body).success).toBe(true)
    expect(Object.keys((body as { cells: object }).cells)).toEqual([
      'claudeMd',
      'workflowVersion',
    ])
  })

  it('rejects an unknown repo id', async () => {
    const app = createApp({ authFile })
    const response = await app.request(
      'http://127.0.0.1/api/coverage/history?repoId=agenticapps/unknown',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(response.status).toBe(404)
  })

  it('requires bearer authentication', async () => {
    const app = createApp({ authFile })
    const response = await app.request(
      'http://127.0.0.1/api/coverage/history?repoId=agenticapps/dashboard',
    )
    expect(response.status).toBe(401)
  })
})
