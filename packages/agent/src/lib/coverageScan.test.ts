import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CoverageResponseSchema } from '@agenticapps/dashboard-shared'

import { scanCoverage, scanCoverageInternal } from './coverageScan.js'

function fixture(families: Record<string, string[]>) {
  const root = mkdtempSync(join(tmpdir(), 'coverage-scan-test-'))
  for (const [family, repos] of Object.entries(families)) {
    for (const repo of repos) {
      const repoPath = join(root, family, repo)
      mkdirSync(join(repoPath, '.git'), { recursive: true })
      writeFileSync(join(repoPath, '.git', 'HEAD'), 'ref: refs/heads/main')
    }
  }
  mkdirSync(join(root, 'state'), { recursive: true })
  return {
    root,
    opts: {
      sourcecodeRootOverride: root,
      migrationsDirOverride: join(root, 'missing-migrations'),
      registryFileOverride: join(root, 'state', 'registry.json'),
      viewerTokenFileOverride: join(root, 'state', 'viewer-token.json'),
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

describe('scanCoverage', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
    cleanups.length = 0
  })

  it('emits strict version 2 rows with only retained columns', async () => {
    const test = fixture({ agenticapps: ['b-repo', 'a-repo'], factiv: ['f-repo'] })
    cleanups.push(test.cleanup)

    const result = await scanCoverage(test.opts)

    expect(result.schemaVersion).toBe(2)
    expect(result.rows.map((row) => row.repo)).toEqual(['a-repo', 'b-repo', 'f-repo'])
    expect(CoverageResponseSchema.safeParse(result).success).toBe(true)
    for (const row of result.rows) {
      expect(row).toHaveProperty('claudeMd')
      expect(row).toHaveProperty('workflowVersion')
      expect(row).toHaveProperty('understand')
      expect(row).not.toHaveProperty('gitNexus')
      expect(row).not.toHaveProperty('wiki')
      expect(row).not.toHaveProperty('absPath')
    }
  })

  it('keeps absolute paths daemon-internal', async () => {
    const test = fixture({ agenticapps: ['repo'] })
    cleanups.push(test.cleanup)

    const { response, internalRows } = await scanCoverageInternal(test.opts)

    expect(internalRows[0]?.absPath).toBe(join(test.root, 'agenticapps', 'repo'))
    expect(response.rows[0]).not.toHaveProperty('absPath')
  })

  it('returns a valid empty response when no repos are discovered', async () => {
    const test = fixture({})
    cleanups.push(test.cleanup)

    const result = await scanCoverage(test.opts)

    expect(result.rows).toEqual([])
    expect(CoverageResponseSchema.safeParse(result).success).toBe(true)
  })
})
