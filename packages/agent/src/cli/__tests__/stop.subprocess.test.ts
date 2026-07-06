
import { describe, it, expect } from 'vitest'

import { makeIsolatedHome, startAgent, runAgent } from './__shared__/spawnAgent.js'

describe('stop subprocess', () => {
  it('boots agent, runs stop, asserts agent exits within 2s', async () => {
    // T-01-04-10: random port
    const port = 5250 + Math.floor(Math.random() * 30)
    const { home, cleanup } = makeIsolatedHome()
    const { child, ready } = startAgent(home, port)
    try {
      await ready

      // Run `stop` against the same HOME — it will POST /api/admin/shutdown
      const stopResult = runAgent(['stop'], home)
      expect(stopResult.status).toBe(0)

      // Wait for the daemon process to exit (max 2s)
      const exited = await Promise.race([
        new Promise<boolean>((res) => {
          child.once('exit', () => res(true))
        }),
        new Promise<boolean>((res) => setTimeout(() => res(false), 2000)),
      ])
      expect(exited).toBe(true)
    } finally {
      // Ensure child is dead even if test assertion fails
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 300))
      cleanup()
    }
  }, 30_000)

  it('stop is a no-op when no daemon is running (exits 0)', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const result = runAgent(['stop'], home)
      expect(result.status).toBe(0)
      expect(result.stdout + result.stderr).toContain('no daemon running')
    } finally {
      cleanup()
    }
  }, 15_000)
})
