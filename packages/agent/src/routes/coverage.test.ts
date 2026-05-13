/**
 * Test scaffold for coverage.ts route — GET /api/coverage + POST /api/coverage/refresh.
 * Plans 03+04 implement; Plan 01 provides it.todo placeholders + 2 GENUINELY FAILING RED tests.
 *
 * Security contracts:
 * - CODEX HIGH-1: absPath NEVER appears in GET /api/coverage response body
 * - CODEX HIGH-5: POST with action='wiki-compile' must return 400 (D-10-09 — clipboard-only)
 * - AGREED-3: POST refresh uses discoverRepos() + realpath canonicalisation (NOT a full scanCoverage() re-run)
 */

import { describe, it, expect } from 'vitest'

describe('GET /api/coverage', () => {
  it.todo('returns 401 without Authorization header')
  it.todo('returns cached CoverageResponse on second call within TTL (cache hit)')
  it.todo('returns schema-valid CoverageResponse on cache miss')
  it.todo(
    'POST refresh uses synchronous discoverRepos() + realpath canonicalisation to resolve absPath, NOT a full scanCoverage() re-run (AGREED-3 + CODEX HIGH-3 TOCTOU)'
  )

  // GENUINELY-FAILING — CODEX HIGH-1 RED test
  // Fails at dynamic import until Plans 03+04 implement the route and wire it into app.ts.
  it('GET /api/coverage response NEVER contains absPath (CODEX HIGH-1)', async () => {
    const { createApp } = await import('../server/app.js')
    const app = createApp({ authFile: '/tmp/test-auth-coverage.json' })
    const res = await app.request('/api/coverage', {
      headers: { Authorization: 'Bearer xyz' },
    })
    const text = await res.text()
    expect(text).not.toMatch(/absPath/)
  })
})

describe('POST /api/coverage/refresh', () => {
  it.todo("routes to spawnGitNexusAnalyze and returns CoverageRefreshResponse with REQUIRED updatedRow on kind='ok' (CODEX HIGH-5)")

  // GENUINELY-FAILING — CODEX HIGH-5 + D-10-09 RED test
  // Fails at dynamic import until Plan 04 implements the route with schema rejection.
  it('POST /api/coverage/refresh with action=wiki-compile returns 400 (CODEX HIGH-5 + D-10-09)', async () => {
    const { createApp } = await import('../server/app.js')
    const app = createApp({ authFile: '/tmp/test-auth-coverage.json' })
    const res = await app.request('/api/coverage/refresh', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xyz',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ family: 'agenticapps', repo: 'foo', action: 'wiki-compile' }),
    })
    expect(res.status).toBe(400)
  })
})
