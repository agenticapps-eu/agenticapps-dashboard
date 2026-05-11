/**
 * F-006: rotate-token CLI must coordinate with the running daemon.
 *
 * When server.json indicates a daemon is up, POST /api/auth/rotate so the
 * daemon's in-memory activeToken flips along with auth.json on disk.
 * When the daemon is unreachable, fall back to direct rotation but warn
 * the user that any running daemon needs a restart. When the daemon
 * actively refuses (4xx/5xx), do NOT fall back — that would create a
 * silent disk/memory divergence; surface the refusal as an error.
 */
import { join } from 'node:path'

import type { ServerInfo } from '@agenticapps/dashboard-shared'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { ensureAuthFile, readAuthFile, rotateToken as directRotateToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

import { rotateTokenSmart } from './token.js'

const FAKE_INFO: ServerInfo = {
  bindUrl: 'http://127.0.0.1:5193',
  pid: 99999,
  startedAt: '2026-05-11T08:00:00.000Z',
}

function notExpectedFetch(): never {
  throw new Error('fetchFn should not have been called in this test path')
}

describe('rotateTokenSmart (F-006)', () => {
  let cleanup: () => void
  let authFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    ensureAuthFile(authFile) // initializes auth.json with a fresh token
  })

  afterEach(() => cleanup())

  it('no daemon running → direct rotation (rotates auth.json, no daemon contact)', async () => {
    const before = readAuthFile(authFile).token

    const result = await rotateTokenSmart({
      authFile,
      readServerInfo: () => null,
      fetchFn: notExpectedFetch as unknown as typeof fetch,
    })

    expect(result.method).toBe('direct')
    expect(result.warning).toBeUndefined()
    expect(result.newToken).not.toBe(before)
    // Token format invariant (D-13): 8 groups of 8 hex separated by dashes.
    expect(result.newToken).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/)
    expect(readAuthFile(authFile).token).toBe(result.newToken)
  })

  it('daemon running + reachable → POSTs /api/auth/rotate; uses the daemon-rotated token', async () => {
    const calls: { url: string; method: string; auth: string | null }[] = []
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const auth = ((init?.headers as Record<string, string> | undefined) ?? {})['Authorization'] ?? null
      calls.push({ url, method, auth })
      // The real daemon's /api/auth/rotate handler calls rotateToken() which
      // writes auth.json and flips the in-memory ref. Simulate by mutating
      // the test's auth.json — D-15 guarantees the file is written BEFORE
      // the 204 response, so the CLI re-reading auth.json after this call
      // observes the new token.
      directRotateToken(authFile)
      return new Response(null, { status: 204 })
    }

    const before = readAuthFile(authFile).token

    const result = await rotateTokenSmart({
      authFile,
      readServerInfo: () => FAKE_INFO,
      fetchFn: fakeFetch,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('http://127.0.0.1:5193/api/auth/rotate')
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.auth).toBe(`Bearer ${before}`)

    expect(result.method).toBe('daemon')
    expect(result.warning).toBeUndefined()
    expect(result.newToken).not.toBe(before)
    expect(readAuthFile(authFile).token).toBe(result.newToken)
  })

  it('daemon listed but unreachable (network error) → falls back to direct, warns about restart', async () => {
    const fakeFetch: typeof fetch = async () => {
      const err: NodeJS.ErrnoException = new Error('connect ECONNREFUSED 127.0.0.1:5193')
      err.code = 'ECONNREFUSED'
      throw err
    }

    const before = readAuthFile(authFile).token

    const result = await rotateTokenSmart({
      authFile,
      readServerInfo: () => FAKE_INFO,
      fetchFn: fakeFetch,
    })

    expect(result.method).toBe('direct')
    expect(result.warning).toBeDefined()
    expect(result.warning).toMatch(/daemon/i)
    expect(result.warning).toMatch(/restart/i)
    expect(result.newToken).not.toBe(before)
    expect(readAuthFile(authFile).token).toBe(result.newToken)
  })

  it('daemon refuses with 401 → throws (no fallback, no disk/memory divergence)', async () => {
    const fakeFetch: typeof fetch = async () => new Response(null, { status: 401 })
    const before = readAuthFile(authFile).token

    await expect(
      rotateTokenSmart({
        authFile,
        readServerInfo: () => FAKE_INFO,
        fetchFn: fakeFetch,
      }),
    ).rejects.toThrow(/daemon.*401|401.*daemon/i)

    // Auth.json must be unchanged — we did NOT rotate, to avoid divergence.
    expect(readAuthFile(authFile).token).toBe(before)
  })

  it('daemon refuses with 5xx → throws (no fallback)', async () => {
    const fakeFetch: typeof fetch = async () => new Response('boom', { status: 503 })
    const before = readAuthFile(authFile).token

    await expect(
      rotateTokenSmart({
        authFile,
        readServerInfo: () => FAKE_INFO,
        fetchFn: fakeFetch,
      }),
    ).rejects.toThrow(/daemon.*503|503.*daemon/i)
    expect(readAuthFile(authFile).token).toBe(before)
  })
})
