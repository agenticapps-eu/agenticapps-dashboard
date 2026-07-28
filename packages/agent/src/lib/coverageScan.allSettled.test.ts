import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./scanners/claudeMdScanner.js', () => ({
  scanClaudeMd: () => {
    throw new Error('synthetic CLAUDE.md scanner crash')
  },
}))

import { scanCoverage } from './coverageScan.js'

describe('coverage scanner isolation', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
    cleanups.length = 0
  })

  it('returns a degraded row after a retained scanner throws synchronously', async () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-sync-throw-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    mkdirSync(join(root, 'agenticapps', 'repo-a', '.git'), { recursive: true })
    mkdirSync(join(root, 'state'), { recursive: true })

    const result = await scanCoverage({
      sourcecodeRootOverride: root,
      registryFileOverride: join(root, 'state', 'registry.json'),
      viewerTokenFileOverride: join(root, 'state', 'viewer-token.json'),
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.claudeMd).toMatchObject({
      state: 'missing',
      degraded: true,
    })
    expect(result.rows[0]?.degraded?.reason).toMatch(/claudeMd:/)
  })
})
