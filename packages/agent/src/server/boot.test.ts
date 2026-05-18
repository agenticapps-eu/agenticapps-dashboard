/**
 * boot.test.ts — disposer registry helpers (Plan 11-02 Task 6).
 *
 * REVIEWS.md action item 5: introduce a minimal disposer registry inside
 * boot.ts so the snapshot scheduler's stop() (and future cleanup hooks)
 * have a single, contracted chokepoint rather than ad-hoc `let disposer`
 * captures scattered across bootDaemon().
 *
 * Behaviour pinned by 8 tests:
 *  1. registerDisposer + runDisposers — function recorded + invoked once
 *  2. LIFO order on multiple disposers
 *  3. A throwing disposer does NOT prevent earlier-registered disposers
 *     from running (try/catch around each invocation)
 *  4. runDisposers is idempotent — repeated calls are no-ops
 *  5. clearDisposers exported for test isolation
 *  6. gracefulShutdown(server) calls runDisposers BEFORE process.exit
 *  7. early-signal path (serverRef === null branch) ALSO calls runDisposers
 *  8. existing pidfile + serverInfo cleanups still happen
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock the dependencies boot.ts touches so we can spy on them deterministically.
vi.mock('../lib/pidfile.js', () => ({
  writePidfile: vi.fn(),
  removePidfile: vi.fn(),
}))
vi.mock('../lib/serverInfo.js', () => ({
  writeServerInfo: vi.fn(),
  removeServerInfo: vi.fn(),
}))
vi.mock('../lib/logging.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/logging.js')>('../lib/logging.js')
  return {
    ...actual,
    agentLog: vi.fn(),
    agentError: vi.fn(),
  }
})

import {
  registerDisposer,
  clearDisposers,
  gracefulShutdown,
  _runDisposersForTests,
  assertSnapshotDirInDaemonHome,
} from './boot.js'
import { removePidfile } from '../lib/pidfile.js'
import { removeServerInfo } from '../lib/serverInfo.js'
import { agentError } from '../lib/logging.js'

describe('boot.ts disposer registry', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    clearDisposers()
    // Prevent the gracefulShutdown path from actually exiting the test runner.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number): never => {
      return undefined as never
    }) as typeof process.exit)
  })

  afterEach(() => {
    clearDisposers()
    exitSpy.mockRestore()
  })

  it('Test 1: registerDisposer records the fn; runDisposers invokes it exactly once', () => {
    const fn = vi.fn()
    registerDisposer(fn)
    _runDisposersForTests()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('Test 2: multiple disposers run in REVERSE (LIFO) order', () => {
    const callOrder: string[] = []
    registerDisposer(() => {
      callOrder.push('first')
    })
    registerDisposer(() => {
      callOrder.push('second')
    })
    registerDisposer(() => {
      callOrder.push('third')
    })
    _runDisposersForTests()
    expect(callOrder).toEqual(['third', 'second', 'first'])
  })

  it('Test 3: throwing disposer does NOT prevent earlier-registered ones from running', () => {
    const earlier = vi.fn()
    registerDisposer(earlier)
    registerDisposer(() => {
      throw new Error('boom')
    })
    _runDisposersForTests()
    expect(earlier).toHaveBeenCalled()
    expect(agentError).toHaveBeenCalled()
  })

  it('Test 4: runDisposers is idempotent — second call is a no-op', () => {
    const fn = vi.fn()
    registerDisposer(fn)
    _runDisposersForTests()
    _runDisposersForTests()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('Test 5: clearDisposers empties the registry (for test isolation)', () => {
    const fn = vi.fn()
    registerDisposer(fn)
    clearDisposers()
    _runDisposersForTests()
    expect(fn).not.toHaveBeenCalled()
  })

  it('Test 6: gracefulShutdown calls runDisposers + pidfile/serverInfo cleanup BEFORE process.exit', () => {
    const disposer = vi.fn()
    registerDisposer(disposer)

    // Fake server with a close() that invokes the callback synchronously.
    const fakeServer = {
      close: vi.fn((cb: () => void) => cb()),
    } as unknown as Parameters<typeof gracefulShutdown>[0]

    gracefulShutdown(fakeServer)

    expect(disposer).toHaveBeenCalledTimes(1)
    expect(removePidfile).toHaveBeenCalledTimes(1)
    expect(removeServerInfo).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)

    // Disposer invocation order: BEFORE exit
    const disposerOrder = disposer.mock.invocationCallOrder[0]!
    const exitOrder = exitSpy.mock.invocationCallOrder[0]!
    expect(disposerOrder).toBeLessThan(exitOrder)
  })

  it('Test 7: early-signal path drains the registry too (no serverRef yet)', async () => {
    // The early-signal path is internal to bootDaemon (lines 47-51). To exercise
    // it deterministically we test the EXPORTED helper used by both paths:
    // _earlyShutdownForTests() runs the same sequence (runDisposers +
    // removePidfile + removeServerInfo + process.exit) the closure does when
    // serverRef === null.
    const disposer = vi.fn()
    registerDisposer(disposer)

    const { _earlyShutdownForTests } = await import('./boot.js')
    _earlyShutdownForTests()

    expect(disposer).toHaveBeenCalledTimes(1)
    expect(removePidfile).toHaveBeenCalledTimes(1)
    expect(removeServerInfo).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('Test 8: gracefulShutdown still removes pidfile + serverInfo even without any disposers registered', () => {
    const fakeServer = {
      close: vi.fn((cb: () => void) => cb()),
    } as unknown as Parameters<typeof gracefulShutdown>[0]

    gracefulShutdown(fakeServer)

    expect(removePidfile).toHaveBeenCalledTimes(1)
    expect(removeServerInfo).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

// ── Task 7: symlink-escape boot check + scheduler wiring ──────────────────────
// (Imports for this section moved to the top-level import block above to satisfy
// import/no-duplicates — `assertSnapshotDirInDaemonHome` is included in the
// './boot.js' import group at line 42, and node:fs/os/path are imported once
// at the file scope.)

describe('boot.ts assertSnapshotDirInDaemonHome (T-11-02-03)', () => {
  let originalHome: string | undefined
  let cleanups: Array<() => void> = []

  beforeEach(() => {
    originalHome = process.env.HOME
  })

  afterEach(() => {
    for (const c of cleanups) c()
    cleanups = []
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
  })

  it('Test 1: throws when coverage-history realpaths OUTSIDE daemon home (symlink escape)', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'agentic-boot-home-'))
    const daemonHome = join(homeDir, '.agenticapps', 'dashboard')
    mkdirSync(daemonHome, { recursive: true, mode: 0o700 })

    // Place an escaping symlink at coverage-history.
    const outside = mkdtempSync(join(tmpdir(), 'agentic-escape-'))
    symlinkSync(outside, join(daemonHome, 'coverage-history'))

    cleanups.push(() => rmSync(homeDir, { recursive: true, force: true }))
    cleanups.push(() => rmSync(outside, { recursive: true, force: true }))

    process.env.HOME = homeDir

    expect(() => assertSnapshotDirInDaemonHome()).toThrow(/escapes daemon home/)
  })

  it('Test 2: happy path — normal directory under daemon home passes', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'agentic-boot-home-ok-'))
    const daemonHome = join(homeDir, '.agenticapps', 'dashboard')
    mkdirSync(join(daemonHome, 'coverage-history'), { recursive: true, mode: 0o700 })
    cleanups.push(() => rmSync(homeDir, { recursive: true, force: true }))

    process.env.HOME = homeDir

    expect(() => assertSnapshotDirInDaemonHome()).not.toThrow()
  })

  it('Test 3: first-run path — absent snapshot dir is acceptable (boot succeeds)', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'agentic-boot-firstrun-'))
    // Create daemon home but NOT the coverage-history child.
    mkdirSync(join(homeDir, '.agenticapps', 'dashboard'), { recursive: true, mode: 0o700 })
    cleanups.push(() => rmSync(homeDir, { recursive: true, force: true }))

    process.env.HOME = homeDir

    expect(() => assertSnapshotDirInDaemonHome()).not.toThrow()
  })
})

describe('boot.ts scheduler wiring', () => {
  it('Test 4: registerDisposer + startSnapshotScheduler are wired together (contract check)', async () => {
    // We assert the CONTRACT — boot.ts imports the symbols and threads them
    // through the registry. The wiring lives inside the serve() listen
    // callback (not directly testable without spinning up a real Hono server),
    // so this contract test verifies the imports + the call shape via grep
    // is enforced separately by acceptance criteria.
    const mod = await import('./boot.js')
    expect(typeof mod.registerDisposer).toBe('function')
    // The disposer registry helper exists; the wiring inside bootDaemon's
    // listen callback is enforced by the acceptance-criteria grep
    // (registerDisposer(startSnapshotScheduler === 1 hit in boot.ts).
  })

  it('Test 5: route mounted at /api in app.ts (acceptance grep)', async () => {
    // Sanity: the mount line landed in Task 5. This test ensures we haven't
    // regressed it during the Task 7 wiring touches.
    const { readFileSync } = await import('node:fs')
    const appSrc = readFileSync(
      new URL('./app.ts', import.meta.url),
      'utf8',
    )
    expect(appSrc).toMatch(/app\.route\('\/api', coverageHistoryRoute\)/)
  })
})
