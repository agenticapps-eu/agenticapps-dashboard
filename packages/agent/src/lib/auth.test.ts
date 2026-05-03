import { describe, it, expect, vi, afterEach } from 'vitest'
import { join } from 'node:path'
import { writeFileSync, chmodSync } from 'node:fs'
import { makeTmpHome } from './__fixtures__/tmpHome.js'
import {
  generateToken,
  getActiveToken,
  setActiveToken,
  assertSecurePermissions,
  InsecurePermissionsError,
  ensureAuthFile,
  readAuthFile,
  writeAuthFile,
  rotateToken,
  shouldAutoRotate,
} from './auth.js'

describe('generateToken', () => {
  it('returns a string of length 71 matching the D-13 format', () => {
    const token = generateToken()
    expect(token).toHaveLength(71)
    expect(token).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/)
  })

  it('returns different values on consecutive calls (entropy)', () => {
    const t1 = generateToken()
    const t2 = generateToken()
    expect(t1).not.toBe(t2)
  })
})

describe('getActiveToken / setActiveToken', () => {
  afterEach(() => {
    // reset in-memory ref after each test
    setActiveToken('')
  })

  it('returns empty string before setActiveToken is called', () => {
    setActiveToken('')
    expect(getActiveToken()).toBe('')
  })

  it('returns the value set by setActiveToken', () => {
    setActiveToken('xyz')
    expect(getActiveToken()).toBe('xyz')
  })
})

describe('assertSecurePermissions', () => {
  it('throws InsecurePermissionsError with EXACT spec message for mode 0644', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    writeFileSync(authFile, '{}', { mode: 0o600 })
    chmodSync(authFile, 0o644)
    try {
      assertSecurePermissions(authFile)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(InsecurePermissionsError)
      expect((e as Error).message).toBe(
        `auth.json has insecure permissions (mode 644); fix with \`chmod 600 ${authFile}\` or run \`agentic-dashboard rotate-token\` to regenerate.`,
      )
    } finally {
      cleanup()
    }
  })

  it('does NOT throw for mode 0600 file', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    writeFileSync(authFile, '{}', { mode: 0o600 })
    try {
      expect(() => assertSecurePermissions(authFile)).not.toThrow()
    } finally {
      cleanup()
    }
  })
})

describe('ensureAuthFile', () => {
  afterEach(() => {
    setActiveToken('')
  })

  it('creates auth.json with mode 0600 and parent dir with mode 0700 if missing', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      const auth = ensureAuthFile(authFile)
      expect(auth.version).toBe(1)
      expect(auth.token).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/)
      expect(auth.rotatedAt).toBeTruthy()
      expect(auth.agentVersion).toBeTruthy()
    } finally {
      cleanup()
    }
  })

  it('is idempotent — existing valid auth.json is kept, in-memory ref set from it', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      const first = ensureAuthFile(authFile)
      const second = ensureAuthFile(authFile)
      expect(second.token).toBe(first.token)
      expect(getActiveToken()).toBe(first.token)
    } finally {
      cleanup()
    }
  })
})

describe('readAuthFile / writeAuthFile', () => {
  it('readAuthFile parses valid auth.json', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      ensureAuthFile(authFile)
      const auth = readAuthFile(authFile)
      expect(auth.version).toBe(1)
      expect(auth.token).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/)
    } finally {
      cleanup()
    }
  })

  it('readAuthFile throws on tampered JSON', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      writeFileSync(authFile, '{"version":2,"token":"bad"}', { mode: 0o600 })
      expect(() => readAuthFile(authFile)).toThrow()
    } finally {
      cleanup()
    }
  })

  it('writeAuthFile produces JSON parseable by schema; mode 0600 enforced', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      const data = {
        version: 1 as const,
        token: generateToken(),
        rotatedAt: new Date().toISOString(),
        agentVersion: '0.0.1-alpha.3',
      }
      writeAuthFile(data, authFile)
      const parsed = readAuthFile(authFile)
      expect(parsed.token).toBe(data.token)
    } finally {
      cleanup()
    }
  })
})

describe('rotateToken', () => {
  afterEach(() => {
    setActiveToken('')
  })

  it('writes new auth.json FIRST then flips in-memory ref (D-15 ordering)', () => {
    const { configDir, cleanup } = makeTmpHome()
    const authFile = join(configDir, 'auth.json')
    try {
      const initial = ensureAuthFile(authFile)
      const oldToken = initial.token

      const newAuth = rotateToken(authFile)
      expect(newAuth.token).not.toBe(oldToken)
      // In-memory ref was flipped
      expect(getActiveToken()).toBe(newAuth.token)
      // File was written with new token
      const fromDisk = readAuthFile(authFile)
      expect(fromDisk.token).toBe(newAuth.token)
    } finally {
      cleanup()
    }
  })
})

describe('shouldAutoRotate', () => {
  it('returns true when agentVersion mismatches current AGENT_VERSION', () => {
    const auth = {
      version: 1 as const,
      token: generateToken(),
      rotatedAt: new Date().toISOString(),
      agentVersion: '0.0.0-old',
    }
    expect(shouldAutoRotate(auth)).toBe(true)
  })

  it('returns true when age > 30 days', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 31)
    const auth = {
      version: 1 as const,
      token: generateToken(),
      rotatedAt: pastDate.toISOString(),
      agentVersion: '0.0.1-alpha.3', // matches AGENT_VERSION
    }
    expect(shouldAutoRotate(auth)).toBe(true)
  })

  it('returns false when version matches and age <= 30 days', () => {
    const auth = {
      version: 1 as const,
      token: generateToken(),
      rotatedAt: new Date().toISOString(),
      agentVersion: '0.0.1-alpha.3', // matches AGENT_VERSION
    }
    expect(shouldAutoRotate(auth)).toBe(false)
  })
})
