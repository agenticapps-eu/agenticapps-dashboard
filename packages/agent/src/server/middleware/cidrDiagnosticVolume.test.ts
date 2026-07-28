/**
 * Refusal-diagnostic volume — RED tests.
 *
 * Both independent reviewers flagged the same thing: the refusal path wrote one
 * synchronous stderr line per refused request, before authentication. On a
 * 0.0.0.0 or :: bind that write rate is attacker-controlled, which means
 * unbounded growth of an unrotated log, event-loop blocking on a regular-file
 * fd, and a class-dependent write sitting on the response path.
 *
 * The fix must not cost the spec property that justified the diagnostic in the
 * first place: "Diagnostics SHALL record the classification and the existing
 * per-request requestId". So this is not a plain counter — each class still
 * emits one fully correlated line per window, and the repeats collapse into a
 * summary instead of disappearing.
 */
import { Hono } from 'hono'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { HttpBindings } from '@hono/node-server'

import { cidrMiddleware } from './cidr.js'

type TestEnv = { Bindings: HttpBindings; Variables: { requestId: string } }

function makeApp(logWindowMs?: number) {
  let n = 0
  const app = new Hono<TestEnv>()
  app.use(async (c, next) => {
    n += 1
    c.set('requestId', `req-${n}`)
    await next()
  })
  app.use(cidrMiddleware(logWindowMs === undefined ? undefined : { logWindowMs }))
  app.get('/probe', (c) => c.json({ ok: true }, 200))
  return app
}

function withSocket(remoteAddress: string) {
  return { incoming: { socket: { remoteAddress } } } as unknown as Record<string, unknown>
}

describe('refusal diagnostics are rate limited', () => {
  let stderr: ReturnType<typeof vi.spyOn>
  let lines: string[]

  beforeEach(() => {
    lines = []
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      lines.push(String(chunk))
      return true
    })
  })

  afterEach(() => stderr.mockRestore())

  it('writes one correlated line for a burst from the same class, not one per request', async () => {
    const app = makeApp()
    for (let i = 0; i < 50; i += 1) {
      const res = await app.request('/probe', {}, withSocket('8.8.8.8'))
      expect(res.status).toBe(403)
    }
    const refusalLines = lines.filter((l) => l.includes('cidr_refusal '))
    expect(refusalLines).toHaveLength(1)
    // The spec property survives: the line that IS written stays correlated.
    expect(refusalLines[0]).toContain('class=outside-range')
    expect(refusalLines[0]).toContain('req-1')
  })

  it('still distinguishes every class within one window', async () => {
    const app = makeApp()
    for (let i = 0; i < 10; i += 1) {
      await app.request('/probe', {}, withSocket('8.8.8.8'))
      await app.request('/probe', {}, withSocket('fd7a:115c:a1e0::1'))
      await app.request('/probe', {}, {} as unknown as Record<string, unknown>)
    }
    const joined = lines.join('')
    expect(joined).toContain('class=outside-range')
    expect(joined).toContain('class=unsupported-family')
    expect(joined).toContain('class=address-unavailable')
    // One correlated line per class, not one per request.
    expect(lines.filter((l) => l.includes('cidr_refusal '))).toHaveLength(3)
  })

  it('reports the suppressed volume rather than silently dropping it', async () => {
    const app = makeApp(50)
    for (let i = 0; i < 20; i += 1) await app.request('/probe', {}, withSocket('8.8.8.8'))
    await new Promise((r) => setTimeout(r, 60))
    // Next refusal rolls the window and flushes the previous one.
    await app.request('/probe', {}, withSocket('8.8.8.8'))

    const summary = lines.find((l) => l.includes('cidr_refusal_summary'))
    expect(summary, `expected a summary line, got:\n${lines.join('')}`).toBeDefined()
    expect(summary).toContain('class=outside-range')
    expect(summary).toContain('refused=20')
  })

  it('emits a fresh correlated line once the window rolls', async () => {
    const app = makeApp(50)
    await app.request('/probe', {}, withSocket('8.8.8.8'))
    await new Promise((r) => setTimeout(r, 60))
    await app.request('/probe', {}, withSocket('8.8.8.8'))
    expect(lines.filter((l) => l.includes('cidr_refusal '))).toHaveLength(2)
  })

  it('never records the client address, in any line', async () => {
    const app = makeApp(50)
    for (let i = 0; i < 5; i += 1) await app.request('/probe', {}, withSocket('::ffff:8.8.8.8'))
    await new Promise((r) => setTimeout(r, 60))
    await app.request('/probe', {}, withSocket('::ffff:8.8.8.8'))
    const joined = lines.join('')
    expect(joined).not.toContain('8.8.8.8')
    expect(joined).not.toContain('::ffff')
  })

  it('keeps rate-limit state per app instance, not globally', async () => {
    const a = makeApp()
    const b = makeApp()
    await a.request('/probe', {}, withSocket('8.8.8.8'))
    await b.request('/probe', {}, withSocket('8.8.8.8'))
    // Two independent daemons must each get their own diagnostic.
    expect(lines.filter((l) => l.includes('cidr_refusal '))).toHaveLength(2)
  })

  it('does not write anything for admitted peers', async () => {
    const app = makeApp()
    for (let i = 0; i < 5; i += 1) {
      const res = await app.request('/probe', {}, withSocket('100.64.5.5'))
      expect(res.status).toBe(200)
    }
    expect(lines.filter((l) => l.includes('cidr_refusal'))).toHaveLength(0)
  })
})
