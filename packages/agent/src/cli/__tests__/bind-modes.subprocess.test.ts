import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync, spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeIsolatedHome, cliBundle } from './__shared__/spawnAgent.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

beforeAll(() => {
  const r = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('build failed')
}, 60_000)

describe('--bind tailscale (Tailscale absent on this dev machine)', () => {
  it('exits 1 with EXACT spec remediation message (D-17)', () => {
    const { home, cleanup } = makeIsolatedHome()
    try {
      // tailscale is not installed on this CI/dev machine — process.env.PATH has no tailscale binary.
      // getTailscaleIP() will throw TailscaleNotDetectedError (ENOENT or non-zero exit),
      // and runStart() will agentError(e.message) + process.exit(1).
      const r = spawnSync('node', [cliBundle, 'start', '--bind', 'tailscale'], {
        env: { ...process.env, HOME: home, NODE_ENV: 'production' },
        encoding: 'utf8',
        timeout: 8_000,
      })
      expect(r.status).not.toBe(0)
      const combined = (r.stderr ?? '') + (r.stdout ?? '')
      expect(combined).toContain(
        'Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.',
      )
    } finally {
      cleanup()
    }
  }, 15_000)
})

describe('--bind 0.0.0.0', () => {
  it('boots and prints WARNING banner before Listening on (D-20)', async () => {
    const port = 5293 + Math.floor(Math.random() * 100)
    const { home, cleanup } = makeIsolatedHome()
    const child = spawn('node', [cliBundle, 'start', '--bind', '0.0.0.0', '--port', String(port)], {
      env: { ...process.env, HOME: home, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let buf = ''
    try {
      await new Promise<void>((resolveReady, rejectReady) => {
        const onData = (chunk: Buffer): void => {
          buf += chunk.toString('utf8')
          if (buf.includes('Listening on')) resolveReady()
        }
        child.stdout!.on('data', onData)
        child.stderr!.on('data', onData)
        child.once('exit', (code) =>
          rejectReady(new Error(`agent exited (${code ?? 'null'}) before ready; output:\n${buf}`)),
        )
        setTimeout(() => rejectReady(new Error(`did not start within 5s; output:\n${buf}`)), 5_000)
      })
      expect(buf).toContain('WARNING: bound to 0.0.0.0')
    } finally {
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 600))
      cleanup()
    }
  }, 30_000)

  it('--bind 0.0.0.0 --no-enforce-cidr boots without CIDR enforcement notice', async () => {
    const port = 5393 + Math.floor(Math.random() * 100)
    const { home, cleanup } = makeIsolatedHome()
    const child = spawn(
      'node',
      [cliBundle, 'start', '--bind', '0.0.0.0', '--no-enforce-cidr', '--port', String(port)],
      {
        env: { ...process.env, HOME: home, NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let buf = ''
    try {
      await new Promise<void>((resolveReady, rejectReady) => {
        const onData = (chunk: Buffer): void => {
          buf += chunk.toString('utf8')
          if (buf.includes('Listening on')) resolveReady()
        }
        child.stdout!.on('data', onData)
        child.stderr!.on('data', onData)
        child.once('exit', (code) =>
          rejectReady(new Error(`agent exited (${code ?? 'null'}) before ready; output:\n${buf}`)),
        )
        setTimeout(() => rejectReady(new Error(`did not start within 5s; output:\n${buf}`)), 5_000)
      })
      // Should not mention CIDR enforcement is ON
      expect(buf).not.toContain('CIDR enforcement is ON')
    } finally {
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 600))
      cleanup()
    }
  }, 30_000)
})
