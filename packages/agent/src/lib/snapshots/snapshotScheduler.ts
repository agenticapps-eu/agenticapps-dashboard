/**
 * snapshotScheduler.ts — in-process setTimeout chain driving the daily snapshot.
 *
 * PD-11-01: reinterpretation of D-11-02. Phase 6's launchd plist sets
 * `KeepAlive=true` + `RunAtLoad=false`; adding `StartCalendarInterval` to a
 * KeepAlive plist would either spawn duplicate daemons or be silently ignored.
 * The daemon process IS the long-lived process launchd keeps alive, so the
 * scheduler runs INSIDE it — no plist modification.
 *
 * Pitfall 7: every setTimeout return value is `.unref()`'d so the timer never
 * keeps the test process (or the daemon) alive past its work.
 *
 * RESOLVED Q1: on boot, if today's `<UTC-date>.ndjson` is ABSENT the tick
 * fires immediately (idempotent backfill). If today's file already exists,
 * the next tick fires at the next 03:00-local boundary. This makes the
 * scheduler safe to invoke from any daemon-boot context.
 *
 * Error handling: writeDailySnapshot rejection is swallowed + logged via
 * agentError; the scheduler re-arms unconditionally.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { agentError } from '../logging.js'

import { isoDateFromDate, resolveSnapshotDir } from './snapshotPaths.js'
import { writeDailySnapshot } from './snapshotWriter.js'

export interface SchedulerOptions {
  /** Wall-clock factory — return a fresh Date on each call. Defaults to `() => new Date()`. */
  now?: () => Date
  /** Override snapshot dir for testability. */
  dir?: string
  /** Local hour (0–23) at which the daily tick fires. Defaults to 3 (= 03:00 local). */
  hourLocal?: number
}

/**
 * Start the in-process scheduler. Returns a disposer that clears the active
 * timer (intended to be registered with boot.ts's disposer registry so
 * gracefulShutdown drains it deterministically).
 */
export function startSnapshotScheduler(opts: SchedulerOptions = {}): () => void {
  const now = opts.now ?? ((): Date => new Date())
  const dir = opts.dir ?? resolveSnapshotDir()
  const hourLocal = opts.hourLocal ?? 3

  let activeTimer: NodeJS.Timeout | null = null

  function tick(): void {
    writeDailySnapshot({ now: now(), dir })
      .catch((err) => {
        agentError(
          `[snapshotScheduler] writeDailySnapshot failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
      .finally(() => scheduleNext())
  }

  function scheduleNext(): void {
    const current = now()
    const next = new Date(current)
    next.setHours(hourLocal, 0, 0, 0)
    if (next.getTime() <= current.getTime()) {
      // Anchor is in the past — push to tomorrow's anchor.
      next.setDate(next.getDate() + 1)
    }
    const msUntil = next.getTime() - current.getTime()
    activeTimer = setTimeout(tick, msUntil)
    activeTimer.unref()
  }

  // RESOLVED Q1: first-boot-fires-immediately IFF today's NDJSON is absent.
  const todayPath = join(dir, `${isoDateFromDate(now())}.ndjson`)
  if (!existsSync(todayPath)) {
    activeTimer = setTimeout(tick, 0)
    activeTimer.unref()
  } else {
    scheduleNext()
  }

  return (): void => {
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
  }
}
