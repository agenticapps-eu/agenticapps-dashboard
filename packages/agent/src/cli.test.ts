import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { HealthResponseSchema } from '@agenticapps/dashboard-shared'
import { describe, it, expect } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const cliBundle = resolve(packageRoot, 'dist/cli.js')

describe('agentic-dashboard CLI (built dist/cli.js)', () => {
  it('exits 0 and prints version on --version', () => {
    const result = spawnSync('node', [cliBundle, '--version'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/0\.0\.1-alpha\.3/)
  })

  // NOTE: 'start' subprocess test removed from cli.test.ts (Plan 01-04).
  // The real boot test (boot → /health curl → SIGTERM) lives in
  // src/cli/__tests__/start.subprocess.test.ts which has full daemon lifecycle isolation.

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

  // The install-understand-viewer registration test that stood here was
  // inverted by `retire-v1-surfaces`: the command is withdrawn with the viewer
  // it installed. Its replacement — asserting the command is absent from this
  // same --help output — lives in `cli/viewerRetired.test.ts` alongside the
  // health-payload and module-absence checks it belongs with.
})
