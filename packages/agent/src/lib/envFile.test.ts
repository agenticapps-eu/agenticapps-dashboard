/**
 * Tests for envFile.ts — boot-load merge (process.env wins), 0600 write,
 * symlink rejection, allow-list validation, readEnvFile null-when-absent.
 */
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  statSync,
  symlinkSync,
  chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { InsecurePermissionsError } from './auth.js'
import { loadEnvFile, writeEnvFile, readEnvFile } from './envFile.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): { dir: string; envPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'envfile-test-'))
  const envPath = join(dir, 'env.json')
  return { dir, envPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

function writeValidEnvJson(envPath: string, vars: Record<string, string> = {}): void {
  writeFileSync(envPath, JSON.stringify({ version: 1, vars }), { mode: 0o600 })
}

// ---------------------------------------------------------------------------
// loadEnvFile
// ---------------------------------------------------------------------------

describe('loadEnvFile', () => {
  // Save and restore process.env around each test
  let savedEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    savedEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore: remove keys added by tests, restore overwritten values
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, savedEnv)
  })

  it('returns silently when env.json is absent (optional — INV-03)', () => {
    const { envPath, cleanup } = makeTmpDir()
    cleanup() // remove dir so file definitely absent
    // Should not throw
    expect(() => loadEnvFile(envPath)).not.toThrow()
  })

  it('populates process.env from env.json when key is unset', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      delete process.env['SENTRY_AUTH_TOKEN']
      writeValidEnvJson(envPath, { SENTRY_AUTH_TOKEN: 'from-file' })
      loadEnvFile(envPath)
      expect(process.env['SENTRY_AUTH_TOKEN']).toBe('from-file')
    } finally {
      cleanup()
    }
  })

  it('leaves process.env key untouched when already set (D-08-12 / INFI-01)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      process.env['SENTRY_AUTH_TOKEN'] = 'from-process'
      writeValidEnvJson(envPath, { SENTRY_AUTH_TOKEN: 'from-file' })
      loadEnvFile(envPath)
      expect(process.env['SENTRY_AUTH_TOKEN']).toBe('from-process')
    } finally {
      cleanup()
    }
  })

  it('sets multiple keys independently — only unset keys are filled', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      process.env['LINEAR_API_KEY'] = 'already-set'
      delete process.env['INFISICAL_TOKEN']
      writeValidEnvJson(envPath, {
        LINEAR_API_KEY: 'from-file-linear',
        INFISICAL_TOKEN: 'from-file-infisical',
      })
      loadEnvFile(envPath)
      expect(process.env['LINEAR_API_KEY']).toBe('already-set')
      expect(process.env['INFISICAL_TOKEN']).toBe('from-file-infisical')
    } finally {
      cleanup()
    }
  })

  it('throws InsecurePermissionsError for mode 0644 (assertSecurePermissions reused)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeValidEnvJson(envPath, {})
      chmodSync(envPath, 0o644)
      expect(() => loadEnvFile(envPath)).toThrow(InsecurePermissionsError)
    } finally {
      cleanup()
    }
  })

  it('throws InsecurePermissionsError for a symlink (symlink rejection via lstat)', () => {
    const { dir, envPath, cleanup } = makeTmpDir()
    try {
      const real = join(dir, 'real-env.json')
      writeValidEnvJson(real, {})
      symlinkSync(real, envPath)
      expect(() => loadEnvFile(envPath)).toThrow(InsecurePermissionsError)
    } finally {
      cleanup()
    }
  })

  it('throws StateCorruptionError for corrupt JSON content', async () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeFileSync(envPath, 'not-valid-json', { mode: 0o600 })
      expect(() => loadEnvFile(envPath)).toThrow()
    } finally {
      cleanup()
    }
  })

  it('throws for an unknown key in vars (allow-list, D-08-13)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeFileSync(
        envPath,
        JSON.stringify({ version: 1, vars: { UNKNOWN_KEY: 'value' } }),
        { mode: 0o600 },
      )
      expect(() => loadEnvFile(envPath)).toThrow()
    } finally {
      cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// writeEnvFile
// ---------------------------------------------------------------------------

describe('writeEnvFile', () => {
  it('writes valid env.json at mode 0600', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeEnvFile({ version: 1, vars: { SENTRY_AUTH_TOKEN: 'tok' } }, envPath)
      const mode = statSync(envPath).mode & 0o777
      expect(mode).toBe(0o600)
    } finally {
      cleanup()
    }
  })

  it('round-trips content correctly', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      const data = { version: 1 as const, vars: { LINEAR_API_KEY: 'key123' } }
      writeEnvFile(data, envPath)
      const result = readEnvFile(envPath)
      expect(result).toEqual(data)
    } finally {
      cleanup()
    }
  })

  it('creates parent directory if absent (ensureConfigDir reuse)', () => {
    const outer = mkdtempSync(join(tmpdir(), 'envfile-parent-test-'))
    const envPath = join(outer, 'subdir', 'env.json')
    try {
      writeEnvFile({ version: 1, vars: {} }, envPath)
      const mode = statSync(envPath).mode & 0o777
      expect(mode).toBe(0o600)
    } finally {
      rmSync(outer, { recursive: true, force: true })
    }
  })

  it('rejects an unknown key in vars (allow-list enforcement at write time)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      expect(() =>
        writeEnvFile(
          // @ts-expect-error — deliberately invalid key for test
          { version: 1, vars: { UNKNOWN_SECRET: 'value' } },
          envPath,
        ),
      ).toThrow()
    } finally {
      cleanup()
    }
  })

  it('rejects wrong version (schema validation)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      expect(() =>
        writeEnvFile(
          // @ts-expect-error — deliberately invalid version
          { version: 2, vars: {} },
          envPath,
        ),
      ).toThrow()
    } finally {
      cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// readEnvFile
// ---------------------------------------------------------------------------

describe('readEnvFile', () => {
  it('returns null when file is absent', () => {
    const { envPath, cleanup } = makeTmpDir()
    cleanup() // ensure absent
    expect(readEnvFile(envPath)).toBeNull()
  })

  it('returns parsed EnvFile when file exists at 0600', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeValidEnvJson(envPath, { SENTRY_AUTH_TOKEN: 'tok' })
      const result = readEnvFile(envPath)
      expect(result).toEqual({ version: 1, vars: { SENTRY_AUTH_TOKEN: 'tok' } })
    } finally {
      cleanup()
    }
  })

  it('throws InsecurePermissionsError for mode 0644 (assertSecurePermissions reused)', () => {
    const { envPath, cleanup } = makeTmpDir()
    try {
      writeValidEnvJson(envPath, {})
      chmodSync(envPath, 0o644)
      expect(() => readEnvFile(envPath)).toThrow(InsecurePermissionsError)
    } finally {
      cleanup()
    }
  })
})
