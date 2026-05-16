/**
 * snapshotScheduler.test.ts — in-process setTimeout chain (PD-11-01).
 *
 * Plan 11-02 Task 4 (RED first).
 *
 * Key invariants:
 *   - Pitfall 7: scheduler timer is .unref()'d so it never holds the event loop
 *     (would otherwise keep the test process alive past the run).
 *   - RESOLVED Q1: first-boot-fires-immediately IFF <today-UTC>.ndjson is absent.
 *     If today's file already exists, the next tick fires at 03:00 instead.
 *   - PD-11-01: NO setInterval, NO launchd plist extension. Single-shot
 *     setTimeout chain that re-arms inside the tick.
 *   - Errors thrown by writeDailySnapshot are swallowed + logged via agentError;
 *     the scheduler MUST re-arm after a rejected tick.
 *   - Returned disposer clearTimeout's the active timer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('./snapshotWriter.js', () => ({
  writeDailySnapshot: vi.fn().mockResolvedValue({ written: 0, path: '<test>' }),
}))

vi.mock('../logging.js', async () => {
  const actual = await vi.importActual<typeof import('../logging.js')>('../logging.js')
  return {
    ...actual,
    agentError: vi.fn(),
  }
})

import { startSnapshotScheduler } from './snapshotScheduler.js'
import { writeDailySnapshot } from './snapshotWriter.js'
import { agentError } from '../logging.js'

describe('snapshotScheduler', () => {
  let dir: string

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(writeDailySnapshot).mockResolvedValue({ written: 0, path: '<test>' })
    dir = mkdtempSync(join(tmpdir(), 'agentic-sched-'))
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(dir, { recursive: true, force: true })
  })

  it('Test 1: schedules first timer when today is BEFORE 03:00 — fires at next 03:00', () => {
    // Force "today's file exists" path so we go through scheduleNext() instead of
    // first-boot-fires-immediately. Use a known wall-clock with today at 01:00 local.
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    const fakeNow = new Date('2026-05-16T01:00:00.000Z')
    vi.setSystemTime(fakeNow)

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    // Delay is "ms until next 03:00 local of today" — tz-dependent in absolute
    // terms but always > 0 and ≤ 24h.
    const [, delay] = setTimeoutSpy.mock.calls[0]!
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThanOrEqual(24 * 60 * 60 * 1000)

    stop()
  })

  it('Test 2: first tick fires writeDailySnapshot, then re-arms with another setTimeout', async () => {
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    // Run ONLY the next pending timer (the initial scheduled tick). Using
    // advanceTimersByTimeAsync(24h) would cascade through the re-arm too,
    // doubling the writeDailySnapshot call count.
    const initialCalls = setTimeoutSpy.mock.calls.length
    await vi.runOnlyPendingTimersAsync()

    expect(writeDailySnapshot).toHaveBeenCalledTimes(1)
    // Re-armed for the next day (initial + at least one re-arm).
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(initialCalls)

    stop()
  })

  it('Test 3: writeDailySnapshot rejection is swallowed + logged + scheduler re-arms', async () => {
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    vi.mocked(writeDailySnapshot).mockRejectedValueOnce(new Error('boom'))

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    await vi.runOnlyPendingTimersAsync()

    // Logged
    expect(agentError).toHaveBeenCalled()
    // Re-armed despite the rejection
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2)

    stop()
  })

  it('Test 4: disposer clearTimeouts the active timer', () => {
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    const clearSpy = vi.spyOn(global, 'clearTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    stop()

    expect(clearSpy).toHaveBeenCalled()
  })

  it('Test 5: scheduler timer is .unref()`d (Pitfall 7)', () => {
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    // The simplest way to assert .unref() runs: scaffold a setTimeout spy that
    // returns a real Timeout, then assert .unref was called on it.
    const realSetTimeout = global.setTimeout
    const unrefSpy = vi.fn()
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: () => void, ms: number) => {
        const t = realSetTimeout(fn, ms) as unknown as { unref: () => void }
        t.unref = unrefSpy
        return t as unknown as NodeJS.Timeout
      }) as unknown as typeof setTimeout)

    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    expect(unrefSpy).toHaveBeenCalled()

    setTimeoutSpy.mockRestore()
    stop()
  })

  it('Test 6: first-boot-fires-immediately when today.ndjson is ABSENT (RESOLVED Q1)', async () => {
    // No file in dir; today is 2026-05-16.
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    // First setTimeout call should have delay 0 (fire immediately).
    const [, firstDelay] = setTimeoutSpy.mock.calls[0]!
    expect(firstDelay).toBe(0)

    await vi.runOnlyPendingTimersAsync()
    expect(writeDailySnapshot).toHaveBeenCalledTimes(1)

    stop()
  })

  it('Test 7: first-boot-DOES-NOT-fire-immediately when today.ndjson EXISTS (idempotent guard)', () => {
    writeFileSync(join(dir, '2026-05-16.ndjson'), '{}\n')
    vi.setSystemTime(new Date('2026-05-16T01:00:00.000Z'))

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const stop = startSnapshotScheduler({ now: () => new Date(), dir, hourLocal: 3 })

    const [, firstDelay] = setTimeoutSpy.mock.calls[0]!
    expect(firstDelay).toBeGreaterThan(0)
    // writeDailySnapshot was NOT called synchronously
    expect(writeDailySnapshot).not.toHaveBeenCalled()

    stop()
  })
})
