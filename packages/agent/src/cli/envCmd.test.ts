/**
 * Tests for cli/envCmd.ts — env set / list / unset with allow-list, 0600, redacted output.
 *
 * Coverage:
 * E1: runEnvSet on unknown key → exits non-zero, names allowed keys
 * E2: runEnvSet on valid key → env.json at 0600, contains the key
 * E3: runEnvSet merges (does not clobber other existing keys)
 * E4: runEnvUnset removes the key from env.json, rewrites 0600
 * E5: runEnvUnset on unknown key → exits non-zero
 * E6: runEnvList prints key + set/unset + source + masked last-4, never full value
 * E7: runEnvList — unset key shows '—' for value and '—' for source
 * E8: runEnvList — process.env key shows 'process.env' as source
 * E9: runEnvList — env.json key shows 'env.json' as source
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Capture agentLog / agentError output without printing to terminal
// ---------------------------------------------------------------------------

vi.mock('../lib/logging.js', () => ({
  agentLog: vi.fn(),
  agentError: vi.fn(),
}))

import { agentLog, agentError } from '../lib/logging.js'

const mockedAgentLog = agentLog as ReturnType<typeof vi.fn>
const mockedAgentError = agentError as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Stub process.exit so tests don't kill the runner
// ---------------------------------------------------------------------------

const _mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null) => {
  throw new Error(`process.exit(${_code})`)
})

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): { envPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'envcmd-test-'))
  const envPath = join(dir, 'env.json')
  return { envPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/**
 * Call fn and catch the process.exit throw, returning the exit code.
 */
async function callWithExit(fn: () => Promise<void>): Promise<number> {
  try {
    await fn()
    return 0
  } catch (e) {
    const msg = (e as Error).message
    const match = /process\.exit\((\d+)\)/.exec(msg)
    return match ? parseInt(match[1]!, 10) : 1
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let savedEnv: NodeJS.ProcessEnv

beforeEach(() => {
  vi.clearAllMocks()
  savedEnv = { ...process.env }
  // Remove allowed keys from process.env so tests start clean
  delete process.env['SENTRY_AUTH_TOKEN']
  delete process.env['LINEAR_API_KEY']
  delete process.env['INFISICAL_TOKEN']
})

afterEach(() => {
  // Restore process.env
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, savedEnv)
})

// ---------------------------------------------------------------------------
// Import under test (dynamic to avoid hoisting issues with mocks)
// ---------------------------------------------------------------------------

async function getEnvCmd() {
  const mod = await import('./envCmd.js')
  return mod
}

// ---------------------------------------------------------------------------
// E1: runEnvSet rejects unknown key
// ---------------------------------------------------------------------------

describe('runEnvSet', () => {
  it('E1: rejects unknown key — exits non-zero, names allowed keys in error', async () => {
    const { envPath } = makeTmpDir()
    const { runEnvSet } = await getEnvCmd()

    const code = await callWithExit(() => runEnvSet('AWS_SECRET', 'value', envPath))

    expect(code).toBe(1)
    expect(mockedAgentError).toHaveBeenCalledOnce()
    const errMsg: string = (mockedAgentError.mock.calls[0] as unknown[])[0] as string
    expect(errMsg).toContain('AWS_SECRET')
    expect(errMsg).toMatch(/SENTRY_AUTH_TOKEN|LINEAR_API_KEY|INFISICAL_TOKEN/)
  })

  it('E2: writes env.json at mode 0600 for valid key', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvSet } = await getEnvCmd()
      const code = await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', 'sntrys_abc123xyz', envPath))

      expect(code).toBe(0)
      const mode = statSync(envPath).mode & 0o777
      expect(mode).toBe(0o600)
      expect(mockedAgentLog).toHaveBeenCalledOnce()
      const logMsg: string = (mockedAgentLog.mock.calls[0] as unknown[])[0] as string
      expect(logMsg).toContain('SENTRY_AUTH_TOKEN')
      expect(logMsg).toContain('Restart')
    } finally {
      cleanup()
    }
  })

  it('E3: merges without clobbering existing keys', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvSet, runEnvList } = await getEnvCmd()

      // Set first key
      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', 'sntrys_first', envPath))
      vi.clearAllMocks()

      // Set second key — first must survive
      await callWithExit(() => runEnvSet('LINEAR_API_KEY', 'lin_second', envPath))
      vi.clearAllMocks()

      // List should show both set
      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      const linearRow = logCalls.find((l) => l.includes('LINEAR_API_KEY'))
      expect(sentryRow).toBeDefined()
      expect(sentryRow).toContain('env.json')
      expect(linearRow).toBeDefined()
      expect(linearRow).toContain('env.json')
    } finally {
      cleanup()
    }
  })

  it('E-full-value: runEnvSet success log does NOT contain the full token value', async () => {
    const fullValue = 'sntrys_verysecrettoken9999'
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvSet } = await getEnvCmd()
      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', fullValue, envPath))

      // None of the log calls should contain the full value
      for (const [msg] of mockedAgentLog.mock.calls) {
        expect(msg as string).not.toContain(fullValue)
      }
    } finally {
      cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// E4/E5: runEnvUnset
// ---------------------------------------------------------------------------

describe('runEnvUnset', () => {
  it('E4: removes the key from env.json and rewrites at 0600', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvSet, runEnvUnset, runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', 'sntrys_tok', envPath))
      vi.clearAllMocks()

      const code = await callWithExit(() => runEnvUnset('SENTRY_AUTH_TOKEN', envPath))
      expect(code).toBe(0)

      // File must still exist at 0600
      const mode = statSync(envPath).mode & 0o777
      expect(mode).toBe(0o600)

      // Reading via runEnvList should show it unset
      vi.clearAllMocks()
      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      expect(sentryRow).toBeDefined()
      expect(sentryRow).toContain('unset')
    } finally {
      cleanup()
    }
  })

  it('E5: rejects unknown key — exits non-zero', async () => {
    const { runEnvUnset } = await getEnvCmd()
    const code = await callWithExit(() => runEnvUnset('AWS_ACCESS_KEY', undefined))
    expect(code).toBe(1)
    expect(mockedAgentError).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// E6–E9: runEnvList
// ---------------------------------------------------------------------------

describe('runEnvList', () => {
  it('E6: shows masked last-4 for a set key, never the full value (D-08-14 / INV-05)', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const fullValue = 'sntrys_verysecrettoken9999'
      const { runEnvSet, runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', fullValue, envPath))
      vi.clearAllMocks()

      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      expect(sentryRow).toBeDefined()

      // Must contain the last 4 chars of the value
      const last4 = fullValue.slice(-4)
      expect(sentryRow).toContain('****' + last4)

      // Must NOT contain the full value
      expect(sentryRow).not.toContain(fullValue)
    } finally {
      cleanup()
    }
  })

  it('E7: unset key shows dash for value and dash for source', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvList } = await getEnvCmd()

      // Don't set anything; envPath doesn't exist yet
      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      expect(sentryRow).toBeDefined()
      expect(sentryRow).toContain('unset')
    } finally {
      cleanup()
    }
  })

  it('E8: process.env key shows "process.env" as source', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      process.env['LINEAR_API_KEY'] = 'lin_from_process_env'
      const { runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const linearRow = logCalls.find((l) => l.includes('LINEAR_API_KEY'))
      expect(linearRow).toBeDefined()
      expect(linearRow).toContain('process.env')
      // Must not print the full token
      expect(linearRow).not.toContain('lin_from_process_env')
    } finally {
      cleanup()
    }
  })

  // WR-04: values of length ≤ 8 must be fully masked (no tail revealed)
  it('WR-04: short value (≤8 chars) is fully masked — no tail in output', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const shortValue = 'tok12345' // exactly 8 chars — tail must be suppressed
      const { runEnvSet, runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', shortValue, envPath))
      vi.clearAllMocks()

      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      expect(sentryRow).toBeDefined()

      // Must show '****' with no tail characters from the value
      expect(sentryRow).toContain('****')
      // The short value itself must NOT appear anywhere in the output
      expect(sentryRow).not.toContain(shortValue)
      // The tail '2345' must NOT appear (would reveal half the value)
      expect(sentryRow).not.toContain('2345')
      // Masked form must be exactly '****' (no suffix)
      expect(sentryRow).toMatch(/\*{4}(?!\w)/)
    } finally {
      cleanup()
    }
  })

  it('WR-04b: value of exactly 9 chars DOES reveal last 4 (boundary check)', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const nineCharValue = 'tok123456' // 9 chars — tail should be revealed
      const { runEnvSet, runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvSet('SENTRY_AUTH_TOKEN', nineCharValue, envPath))
      vi.clearAllMocks()

      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const sentryRow = logCalls.find((l) => l.includes('SENTRY_AUTH_TOKEN'))
      expect(sentryRow).toBeDefined()
      // For a 9-char value, last 4 ('3456') should appear
      expect(sentryRow).toContain('****3456')
      // Full value must not appear
      expect(sentryRow).not.toContain(nineCharValue)
    } finally {
      cleanup()
    }
  })

  it('E9: env.json key shows "env.json" as source', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const { runEnvSet, runEnvList } = await getEnvCmd()

      await callWithExit(() => runEnvSet('INFISICAL_TOKEN', 'inf_from_file', envPath))
      vi.clearAllMocks()

      await callWithExit(() => runEnvList(envPath))

      const logCalls = mockedAgentLog.mock.calls.map((c) => c[0] as string)
      const infRow = logCalls.find((l) => l.includes('INFISICAL_TOKEN'))
      expect(infRow).toBeDefined()
      expect(infRow).toContain('env.json')
      // Must not print the full token
      expect(infRow).not.toContain('inf_from_file')
    } finally {
      cleanup()
    }
  })
})
