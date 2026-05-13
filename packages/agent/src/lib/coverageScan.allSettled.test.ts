/**
 * coverageScan.allSettled.test.ts — sync-throw isolation (Stage 2 review finding).
 *
 * Stage 2 found that the prior `Promise.allSettled([Promise.resolve(scanX(...))])`
 * pattern could not catch synchronous throws — the scanner ran inside the array
 * literal before Promise.resolve wrapped it. The fix wraps each call in an async
 * IIFE so a sync throw resolves to a rejected promise that allSettled catches.
 *
 * This test pins that behaviour: one scanner throws synchronously; the row must
 * still be returned with the affected column marked degraded.
 *
 * Lives in its own file because module-level vi.mock hoists for the whole file —
 * pulling this into coverageScan.test.ts would mock the wikiScanner for every
 * other test in that file.
 */
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./scanners/wikiScanner.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./scanners/wikiScanner.js')>()
  return {
    ...actual,
    scanWikiForFamily: () => {
      throw new Error('synthetic sync throw — wiki scanner crash')
    },
  }
})

import { scanCoverage } from './coverageScan.js'

describe('coverageScan — sync-throw isolation (Stage 2)', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('row is still returned when a scanner throws synchronously; affected column marked degraded', async () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-sync-throw-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    mkdirSync(join(root, 'agenticapps', 'repo-a', '.git'), { recursive: true })

    const result = await scanCoverage({ sourcecodeRootOverride: root })

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]!
    expect(row.wiki.degraded).toBe(true)
    expect(row.wiki.degradedReason).toMatch(/synthetic sync throw/)
    expect(row.wiki.state).toBe('missing')
    expect(row.degraded?.reason).toMatch(/wiki:/)
  })
})
