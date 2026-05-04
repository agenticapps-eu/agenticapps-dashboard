import { spawn, type ChildProcess } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
/** Touched (not semantically modified) to trigger HMR. */
const SCRATCH_FILE = resolve(__dirname, '..', 'styles', 'global.css')

let proc: ChildProcess | undefined

afterAll(() => {
  proc?.kill('SIGTERM')
})

/** Wait for a stdout line matching `pattern` within `timeoutMs` or reject. */
function waitForStdout(p: ChildProcess, pattern: RegExp, timeoutMs: number): Promise<string> {
  return new Promise((resolveFn, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${pattern}`))
    }, timeoutMs)
    const onData = (chunk: Buffer): void => {
      const s = chunk.toString()
      if (pattern.test(s)) {
        clearTimeout(timer)
        p.stdout?.off('data', onData)
        resolveFn(s)
      }
    }
    p.stdout?.on('data', onData)
  })
}

describe('SPA-01: dev server hot-reload', () => {
  it('boots within 30s, listens on 5174, and HMR-updates within 2000ms of edit (warmed)', async () => {
    proc = spawn('pnpm', ['--filter', '@agenticapps/dashboard-spa', 'dev'], {
      stdio: 'pipe',
      cwd: resolve(__dirname, '../../../..'), // repo root
    })
    // 1) Wait for "Local:" listening line — boot ceiling 30s
    await waitForStdout(proc, /Local:\s+http:\/\/localhost:5174/i, 30_000)

    // 2) Warm the dev server — Pitfall 9 — so esbuild prebundle finishes
    const warmRes = await fetch('http://localhost:5174/').catch(() => null)
    expect(warmRes?.status).toBe(200)

    // 3) Touch the file & assert HMR within 2000ms
    const original = readFileSync(SCRATCH_FILE, 'utf-8')
    const start = Date.now()
    writeFileSync(SCRATCH_FILE, original + `\n/* hmr-trigger ${Date.now()} */\n`)
    try {
      await waitForStdout(proc, /hmr update|page reload/i, 2_000)
      expect(Date.now() - start).toBeLessThan(2_000)
    } finally {
      writeFileSync(SCRATCH_FILE, original) // ALWAYS restore — even on failure
    }
  }, 60_000) // total per-it timeout
})
