import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { HealthResponseSchema } from '@agenticapps/dashboard-shared'
import { describe, it, expect, beforeAll } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const cliBundle = resolve(packageRoot, 'dist/cli.js')

beforeAll(() => {
  // Build the bundle once before all tests so we exercise the published artifact.
  // Uses spawnSync with an argv array — no shell interpretation, no injection surface (T-00-07).
  const build = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
  if (build.status !== 0) {
    throw new Error(`pnpm build failed with status ${build.status}`)
  }
}, 60_000)

describe('agentic-dashboard CLI (built dist/cli.js)', () => {
  it('exits 0 and prints version on --version', () => {
    const result = spawnSync('node', [cliBundle, '--version'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/0\.0\.1-alpha\.3/)
  })

  it('exits 0 on start (daemon boot wired in Plan 01-04)', () => {
    const result = spawnSync('node', [cliBundle, 'start'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
  })

  it('emits HealthResponseSchema-valid JSON on --version --json', () => {
    const result = spawnSync('node', [cliBundle, '--version', '--json'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(() => HealthResponseSchema.parse(parsed)).not.toThrow()
    expect(parsed.ok).toBe(true)
    expect(parsed.version).toBe('0.0.1-alpha.3')
    expect(typeof parsed.message).toBe('string')
  })

  it('has a node shebang on the first line', () => {
    const firstLine = readFileSync(cliBundle, 'utf8').split('\n')[0]
    expect(firstLine).toBe('#!/usr/bin/env node')
  })

  it('inlined the @agenticapps/dashboard-shared import (no runtime workspace dep)', () => {
    const contents = readFileSync(cliBundle, 'utf8')
    expect(contents).not.toMatch(/from\s+['"]@agenticapps\/dashboard-shared['"]/)
  })
})
