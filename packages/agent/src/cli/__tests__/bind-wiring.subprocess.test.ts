/**
 * End-to-end bind wiring, exercising the real `runStart` -> `bootDaemon` path.
 *
 * These exist because unit coverage of the extracted classifiers was NOT enough.
 * Independent review found two defects that every unit test passed straight
 * through, both of which only appear once the pieces are wired together:
 *
 *   - `--bind ::1` and `--bind ::` built an unbracketed URL (`http://::1:5193`),
 *     which z.string().url() rejects, so writeServerInfo threw AFTER the
 *     listener was already accepting connections.
 *   - `--bind 0` was not a recognised literal, so it fell through to loopback
 *     (no CIDR middleware, no warning) and Node then resolved `0` to 0.0.0.0.
 *
 * A test that only calls classifyExplicitBind cannot see either one. These run
 * the actual CLI.
 */
import { spawnSync, spawn } from 'node:child_process'

import { describe, it, expect } from 'vitest'

import { makeIsolatedHome, cliBundle } from './__shared__/spawnAgent.js'

/** Start the daemon and resolve once it is listening, or reject with its output. */
async function startAndWait(args: string[], port: number) {
  const { home, cleanup } = makeIsolatedHome()
  const child = spawn('node', [cliBundle, 'start', ...args, '--port', String(port)], {
    env: { ...process.env, HOME: home, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let buf = ''
  try {
    await new Promise<void>((ready, fail) => {
      const onData = (chunk: Buffer): void => {
        buf += chunk.toString('utf8')
        if (buf.includes('Listening on')) ready()
      }
      child.stdout!.on('data', onData)
      child.stderr!.on('data', onData)
      child.once('exit', (code) =>
        fail(new Error(`exited (${code ?? 'null'}) before listening; output:\n${buf}`)),
      )
      setTimeout(() => fail(new Error(`did not start within 5s; output:\n${buf}`)), 5_000)
    })
    // Stay up briefly. The URL defect crashed the daemon AFTER it began
    // listening, so "reached Listening on" alone would not have caught it.
    await new Promise((r) => setTimeout(r, 1_200))
    return { buf, alive: child.exitCode === null && child.signalCode === null, child, cleanup }
  } catch (e) {
    child.kill('SIGKILL')
    cleanup()
    throw e
  }
}

async function stop(handle: { child: ReturnType<typeof spawn>; cleanup: () => void }) {
  handle.child.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 600))
  handle.cleanup()
}

describe('IPv6 binds start and stay up', () => {
  it('--bind ::1 survives startup bookkeeping', async () => {
    const h = await startAndWait(['--bind', '::1'], 5591)
    try {
      expect(h.alive, `daemon died after listening; output:\n${h.buf}`).toBe(true)
      // The URL must be bracketed wherever it is printed.
      expect(h.buf).toContain('http://[::1]:5591')
      expect(h.buf).not.toContain('http://::1:5591')
      // Loopback: no all-interfaces warning.
      expect(h.buf).not.toContain('WARNING: bound to')
    } finally {
      await stop(h)
    }
  }, 30_000)

  it('--bind :: starts enforced and warns, naming the address actually bound', async () => {
    const h = await startAndWait(['--bind', '::'], 5592)
    try {
      expect(h.alive, `daemon died after listening; output:\n${h.buf}`).toBe(true)
      expect(h.buf).toContain('WARNING: bound to ::')
      expect(h.buf).toContain('CIDR enforcement is ON.')
      expect(h.buf).toContain('http://[::]:5592')
    } finally {
      await stop(h)
    }
  }, 30_000)

  it('--bind ::0 is treated as the wildcard, not as a specific address', async () => {
    const h = await startAndWait(['--bind', '::0'], 5593)
    try {
      expect(h.alive, `daemon died after listening; output:\n${h.buf}`).toBe(true)
      // The defect: ::0 escaped the all-interfaces path, so no banner printed.
      expect(h.buf).toContain('WARNING: bound to ::0')
      expect(h.buf).toContain('CIDR enforcement is ON.')
    } finally {
      await stop(h)
    }
  }, 30_000)
})

describe('unsupported bind values are refused before the listener opens', () => {
  // The critical one: Node resolves `0` to 0.0.0.0, so the old fallthrough
  // bound every interface with no boundary and no banner.
  it.each(['0', '00', 'dev-box.lan'])('--bind %s exits non-zero and binds nothing', (bind) => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const r = spawnSync('node', [cliBundle, 'start', '--bind', bind, '--port', '5594'], {
        env: { ...process.env, HOME: home, NODE_ENV: 'production' },
        encoding: 'utf8',
        timeout: 8_000,
      })
      expect(r.status).not.toBe(0)
      const out = (r.stderr ?? '') + (r.stdout ?? '')
      expect(out).toContain('Unsupported --bind value')
      expect(out).not.toContain('Listening on')
    } finally {
      cleanup()
    }
  }, 20_000)

  it('--bind fd7a:115c:a1e0::1 fails fast while enforcement is on', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      const r = spawnSync(
        'node',
        [cliBundle, 'start', '--bind', 'fd7a:115c:a1e0::1', '--port', '5595'],
        { env: { ...process.env, HOME: home, NODE_ENV: 'production' }, encoding: 'utf8', timeout: 8_000 },
      )
      expect(r.status).not.toBe(0)
      const out = (r.stderr ?? '') + (r.stdout ?? '')
      expect(out).toContain('IPv4-only')
      expect(out).toContain('--no-enforce-cidr')
      expect(out).not.toContain('Listening on')
    } finally {
      cleanup()
    }
  }, 20_000)
})
