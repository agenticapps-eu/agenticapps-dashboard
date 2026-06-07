/**
 * viewerToken.test.ts — Plan 14-02, Task 2.
 *
 * HMAC-bound per-repo scoped viewer tokens with 0600 secret storage.
 *
 * Tests cover all 7 behaviours from the plan:
 *   1. ensureViewerSecretFile creates viewer-token.json at mode 0600
 *   2. ensureViewerSecretFile rejects loose permissions (0644) on existing file
 *   3. mintViewerToken / verifyViewerToken round-trip
 *   4. verifyViewerToken returns null for malformed/invalid tokens
 *   5. cross-repo token isolation (token for A does NOT verify as B)
 *   6. rotateViewerSecret invalidates old tokens
 *   7. timingSafeEqual usage (structural import check)
 *
 * All tests use a tmp dir override — no ~/.agenticapps writes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ensureViewerSecretFile,
  rotateViewerSecret,
  mintViewerToken,
  verifyViewerToken,
} from './viewerToken.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string
let secretFile: string

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'vt-test-'))
  secretFile = join(tmpDir, 'viewer-token.json')
}

function teardown(): void {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* best-effort */ }
}

// ── Test 1: ensureViewerSecretFile creates file at mode 0600 ─────────────────

describe('ensureViewerSecretFile', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('creates viewer-token.json with mode 0600 and correct shape', () => {
    const result = ensureViewerSecretFile(secretFile)
    const st = statSync(secretFile)
    expect((st.mode & 0o777)).toBe(0o600)
    expect(result.version).toBe(1)
    expect(result.secret).toMatch(/^[0-9a-f]{64}$/)  // 32 bytes hex
    expect(typeof result.rotatedAt).toBe('string')
    expect(result.rotatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO datetime
  })

  it('returns existing file without overwriting when already valid', () => {
    const first = ensureViewerSecretFile(secretFile)
    const second = ensureViewerSecretFile(secretFile)
    expect(second.secret).toBe(first.secret)  // same secret, not regenerated
  })

  // ── Test 2: loose permissions check ──────────────────────────────────────────

  it('throws when existing file has loose permissions (0644)', () => {
    // Create a 0644 file to simulate insecure permissions
    writeFileSync(secretFile, JSON.stringify({
      version: 1,
      secret: 'a'.repeat(64),
      rotatedAt: new Date().toISOString(),
    }))
    // Set loose permissions
    const { chmodSync } = require('node:fs')
    chmodSync(secretFile, 0o644)

    expect(() => ensureViewerSecretFile(secretFile)).toThrow()
  })
})

// ── Tests 3-6: mintViewerToken / verifyViewerToken ───────────────────────────

describe('mintViewerToken / verifyViewerToken', () => {
  beforeEach(() => {
    setup()
    ensureViewerSecretFile(secretFile)
  })
  afterEach(teardown)

  // Test 3: round-trip
  it('round-trips: verifyViewerToken returns the original repoId', () => {
    const repoId = 'agenticapps/claude-workflow'
    const token = mintViewerToken(repoId, secretFile)
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[0-9a-f]{64}$/)
    const recovered = verifyViewerToken(token, secretFile)
    expect(recovered).toBe(repoId)
  })

  it('round-trips: verifyViewerToken works with all known families', () => {
    for (const family of ['agenticapps', 'factiv', 'neuroflash']) {
      const repoId = `${family}/test-repo`
      const token = mintViewerToken(repoId, secretFile)
      expect(verifyViewerToken(token, secretFile)).toBe(repoId)
    }
  })

  // Test 4: malformed/invalid tokens → null
  it('returns null for token with wrong HMAC (different secret)', () => {
    // Mint with current secret, then rotate so the secret changes
    const repoId = 'agenticapps/my-repo'
    const oldToken = mintViewerToken(repoId, secretFile)
    rotateViewerSecret(secretFile)
    // Old token now has wrong HMAC for the new secret
    expect(verifyViewerToken(oldToken, secretFile)).toBeNull()
  })

  it('returns null for tampered repoId segment (HMAC mismatch)', () => {
    const repoId = 'agenticapps/real-repo'
    const token = mintViewerToken(repoId, secretFile)
    // Tamper the middle segment (repoId base64)
    const parts = token.split('.')
    // Replace with a different repoId's base64
    const tamperedB64 = Buffer.from('agenticapps/evil-repo').toString('base64url')
    const tampered = `${parts[0]}.${tamperedB64}.${parts[2]}`
    expect(verifyViewerToken(tampered, secretFile)).toBeNull()
  })

  it('returns null for malformed structure: missing dots', () => {
    expect(verifyViewerToken('notavalidtoken', secretFile)).toBeNull()
    expect(verifyViewerToken('v1.abc', secretFile)).toBeNull()
  })

  it('returns null for wrong prefix (not v1)', () => {
    const repoId = 'agenticapps/my-repo'
    const token = mintViewerToken(repoId, secretFile)
    const parts = token.split('.')
    const badPrefix = `v2.${parts[1]}.${parts[2]}`
    expect(verifyViewerToken(badPrefix, secretFile)).toBeNull()
  })

  it('returns null for repoId with path traversal (..)', () => {
    // Construct a token where the decoded repoId contains '..'
    // Since mintViewerToken won't mint an invalid repoId, we build manually
    const evilRepoId = 'agenticapps/..'
    // Can't mint through normal path; craft manually
    const fakeB64 = Buffer.from(evilRepoId).toString('base64url')
    const { createHmac } = require('node:crypto')
    const { readFileSync } = require('node:fs')
    const raw = JSON.parse(readFileSync(secretFile, 'utf8'))
    const mac = createHmac('sha256', raw.secret).update(evilRepoId).digest('hex')
    const craftedToken = `v1.${fakeB64}.${mac}`
    expect(verifyViewerToken(craftedToken, secretFile)).toBeNull()
  })

  it('returns null for repoId with unknown family', () => {
    const evilRepoId = 'evil/repo'
    const { createHmac } = require('node:crypto')
    const { readFileSync } = require('node:fs')
    const raw = JSON.parse(readFileSync(secretFile, 'utf8'))
    const mac = createHmac('sha256', raw.secret).update(evilRepoId).digest('hex')
    const craftedToken = `v1.${Buffer.from(evilRepoId).toString('base64url')}.${mac}`
    expect(verifyViewerToken(craftedToken, secretFile)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(verifyViewerToken('', secretFile)).toBeNull()
  })

  // Test 5: cross-repo token isolation
  it('token minted for repo A does NOT verify as repo B (HMAC binding)', () => {
    const tokenA = mintViewerToken('agenticapps/repo-a', secretFile)
    // verifyViewerToken should only return the correct repoId
    const result = verifyViewerToken(tokenA, secretFile)
    expect(result).toBe('agenticapps/repo-a')
    expect(result).not.toBe('agenticapps/repo-b')
    // A token can't be crafted for repo-b using repo-a's HMAC
    const parts = tokenA.split('.')
    const repoBB64 = Buffer.from('agenticapps/repo-b').toString('base64url')
    const crossToken = `v1.${repoBB64}.${parts[2]}`
    expect(verifyViewerToken(crossToken, secretFile)).toBeNull()
  })

  // Test 6: rotation invalidates previous tokens
  it('rotateViewerSecret invalidates previously minted tokens', () => {
    const repoId = 'agenticapps/my-repo'
    const oldToken = mintViewerToken(repoId, secretFile)
    expect(verifyViewerToken(oldToken, secretFile)).toBe(repoId) // valid before rotate
    rotateViewerSecret(secretFile)
    expect(verifyViewerToken(oldToken, secretFile)).toBeNull() // invalid after rotate
  })

  it('after rotation, new tokens verify correctly', () => {
    rotateViewerSecret(secretFile)
    const repoId = 'neuroflash/backend'
    const newToken = mintViewerToken(repoId, secretFile)
    expect(verifyViewerToken(newToken, secretFile)).toBe(repoId)
  })
})

// ── Test 7: timingSafeEqual import (structural check) ────────────────────────

describe('viewerToken.ts — timingSafeEqual structural import', () => {
  it('module source contains timingSafeEqual import from node:crypto', async () => {
    // Structural compliance check: the module must import timingSafeEqual from
    // node:crypto for constant-time MAC comparison (T-14-02-01).
    const { readFileSync } = await import('node:fs')
    const moduleSource = readFileSync(
      new URL('./viewerToken.ts', import.meta.url).pathname.replace('.js', '.ts'),
      'utf8',
    )
    expect(moduleSource).toContain('timingSafeEqual')
    expect(moduleSource).toContain('node:crypto')
  })
})
