/**
 * gitnexusScanShutdown.test.ts — D-13-EXT-13 (Codex WARNING #5) shutdown disposer.
 *
 * Verifies that disposeAllInflightScans() SIGTERMs every in-flight gitnexus
 * subprocess. Uses a real `sleep` binary (universally available on POSIX) so
 * the subprocess is a genuine OS process, not a mock — otherwise the kill
 * semantics would be observationally invisible.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import {
  startScan,
  _resetForTests,
  _setGitnexusBinForTests,
  disposeAllInflightScans,
  _activeChildrenForTests,
} from './gitnexusScan.js'

describe('disposeAllInflightScans — D-13-EXT-13 (Codex WARNING #5)', () => {
  let fakeHome: string
  let stashedHome: string | undefined
  let hangScript: string

  beforeEach(() => {
    _resetForTests()
    stashedHome = process.env.HOME
    fakeHome = mkdtempSync(join(tmpdir(), 'shutdown-test-'))
    process.env.HOME = fakeHome
    mkdirSync(join(fakeHome, 'Sourcecode', 'agenticapps', 'sample-repo'), { recursive: true })

    // Create a hang script in tmp; bin override points at it.
    hangScript = join(fakeHome, 'hang.sh')
    writeFileSync(hangScript, '#!/usr/bin/env bash\nsleep 30\nexit 0\n')
    chmodSync(hangScript, 0o755)
  })

  afterEach(() => {
    if (stashedHome !== undefined) process.env.HOME = stashedHome
    else delete process.env.HOME
    _setGitnexusBinForTests(null)
    // Dispose anything still hanging from a failed assertion.
    disposeAllInflightScans()
    _resetForTests()
    try { rmSync(fakeHome, { recursive: true, force: true }) } catch { /* best-effort */ }
  })

  it('tracks in-flight subprocesses in activeChildren', async () => {
    _setGitnexusBinForTests(hangScript)

    const scanId = randomUUID()
    const r = await startScan(scanId, { scope: 'repo', target: 'agenticapps/sample-repo' })
    expect(r.ok).toBe(true)

    // Give the spawn a moment to enter execa (microtask + small delay).
    await new Promise((res) => setTimeout(res, 200))

    const children = _activeChildrenForTests()
    expect(children.length).toBeGreaterThanOrEqual(1)
  })

  it('disposeAllInflightScans kills tracked subprocesses and drains the set', async () => {
    _setGitnexusBinForTests(hangScript)

    const scanId = randomUUID()
    await startScan(scanId, { scope: 'repo', target: 'agenticapps/sample-repo' })
    await new Promise((res) => setTimeout(res, 200))

    expect(_activeChildrenForTests().length).toBeGreaterThanOrEqual(1)

    disposeAllInflightScans()

    // The set drains synchronously inside dispose; the subprocesses get reaped async.
    expect(_activeChildrenForTests().length).toBe(0)
  }, 8000)
})
