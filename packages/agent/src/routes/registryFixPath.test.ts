/**
 * registryFixPath.test.ts — POST /api/admin/registry/fix-path
 *
 * Plan 12-02 Task 5 (RED first). THE Phase 12 threat surface — every
 * threat in the plan's <threat_model> gets an explicit test.
 *
 * Coverage matrix (mapping to threat_model rows):
 *   - T-12-AUTH (bearer) ........................ Test 1
 *   - invalid_request (Zod missing fields) ...... Test 2
 *   - invalid_request (Zod .strict extra keys) .. Test 3
 *   - T-12-PATH-TRAVERSAL system blocklist ...... Test 4
 *   - T-12-PATH-TRAVERSAL secret-dir blocklist .. Test 5
 *   - newPath_outside_family_roots (~/Documents). Test 6
 *   - T-12-PATH-TRAVERSAL ../.. escape .......... Test 7
 *   - T-12-SYMLINK-ESCAPE (planted symlink) ..... Test 8
 *   - project_not_found .......................... Test 9
 *   - happy path 200 + updated entry ............. Test 10
 *   - atomic write (file content matches) ........ Test 11
 *   - registry.json mode is 0o600 ................ Test 12
 *   - T-12-DOS rate-limit 429 + Retry-After ...... Test 13
 *   - T-12-CACHE-STALE cache invalidation ........ Test 14
 *   - T-12-INFO-DISCLOSURE (no FS leak in errors). Test 15
 *   - T-12-IDEMPOTENT-FAIL (twice = same state) .. Test 16
 *   - schema_drift via outbound() ................ Test 17
 */
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  statSync,
  readFileSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { COVERAGE_ROOTS } from '../lib/paths.js'
import { _resetForTests as resetRateLimiter } from '../lib/rateLimiter.js'
import {
  setConformanceCache,
  _resetConformanceCacheForTests,
  getConformanceCache,
} from '../lib/conformanceCache.js'
import {
  setCoverageCache,
  _resetCoverageCacheForTests,
  getCoverageCache,
} from '../lib/coverageCache.js'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

interface FixtureContext {
  cleanupHome: () => void
  cleanupFamily: () => void
  registryFile: string
  authFile: string
  token: string
  familyRootReal: string // realpath of the fixture's "agenticapps" family root
  projectId: string
  projectRoot: string
  newRealProjectPath: string // the canonical newPath to fix to
  originalCoverageRoots: typeof COVERAGE_ROOTS
}

/**
 * Build a complete sandbox: tmp home + tmp family root with two project
 * sub-dirs + a registry.json containing one stale project entry.
 *
 * NOTE: COVERAGE_ROOTS is `as const` — we mutate the agenticapps slot via
 * a cast so the route's family-root containment check resolves into the
 * sandbox. Restored in cleanup.
 */
async function buildFixture(): Promise<FixtureContext> {
  resetRateLimiter()
  _resetConformanceCacheForTests()
  _resetCoverageCacheForTests()

  const tmp = makeTmpHome()
  const registryFile = join(tmp.configDir, 'registry.json')
  const authFile = join(tmp.configDir, 'auth.json')
  const fresh = ensureAuthFile(authFile)
  setActiveToken(fresh.token)

  // Build an in-sandbox family root with two project dirs.
  const familyRoot = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-family-')))
  const projectRoot = join(familyRoot, 'stale-project')
  mkdirSync(projectRoot)
  const newRealProjectPath = join(familyRoot, 'corrected-project')
  mkdirSync(newRealProjectPath)

  // Stash original COVERAGE_ROOTS factory + point agenticapps at the sandbox.
  const originalAgenticappsRoot = COVERAGE_ROOTS.agenticapps
  ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).agenticapps = () =>
    familyRoot

  // Seed the registry with the stale project via direct fs write so we
  // bypass /register's validation (which would normalise the path).
  const seedRegistry = {
    version: 1,
    projects: [
      {
        id: 'stale-project',
        name: 'stale-project',
        root: projectRoot,
        client: null,
        addedAt: '2026-05-19T12:00:00.000Z',
        tags: [],
      },
    ],
  }
  const { writeFileSync, chmodSync } = await import('node:fs')
  writeFileSync(registryFile, JSON.stringify(seedRegistry, null, 2))
  chmodSync(registryFile, 0o600)

  const original = COVERAGE_ROOTS

  return {
    cleanupHome: tmp.cleanup,
    cleanupFamily: () => {
      ;(COVERAGE_ROOTS as unknown as Record<string, () => string>).agenticapps =
        originalAgenticappsRoot
      rmSync(familyRoot, { recursive: true, force: true })
    },
    registryFile,
    authFile,
    token: fresh.token,
    familyRootReal: familyRoot,
    projectId: 'stale-project',
    projectRoot,
    newRealProjectPath,
    originalCoverageRoots: original,
  }
}

let ctx: FixtureContext

beforeEach(async () => {
  ctx = await buildFixture()
})

afterEach(() => {
  ctx.cleanupFamily()
  ctx.cleanupHome()
  resetRateLimiter()
  _resetConformanceCacheForTests()
  _resetCoverageCacheForTests()
  vi.restoreAllMocks()
})

describe('POST /api/admin/registry/fix-path', () => {
  it('Test 1 [T-12-AUTH]: returns 401 without bearer token', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
      },
    )
    expect(res.status).toBe(401)
  })

  it('Test 2 [invalid_request]: returns 422 on missing body fields', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: 'only-id' }), // newPath missing
      },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_request')
  })

  it('Test 3 [invalid_request strict]: returns 422 on extra body fields (.strict)', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({
          id: ctx.projectId,
          newPath: ctx.newRealProjectPath,
          extraneous: 'should be rejected',
        }),
      },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_request')
  })

  it('Test 4 [T-12-PATH-TRAVERSAL system]: returns 422 newPath_blocked for /etc', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: '/etc' }),
      },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('newPath_blocked')
  })

  it('Test 5 [T-12-PATH-TRAVERSAL secret]: returns 422 newPath_blocked for ~/.ssh', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const sshPath = join(homedir(), '.ssh')
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: sshPath }),
      },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('newPath_blocked')
  })

  it('Test 6 [outside family roots]: returns 422 newPath_outside_family_roots for ~/Documents', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    // Use a clearly-outside path that exists on most systems but is not
    // under any family root. We use realpath of /tmp because /tmp is
    // canonicalisable and NOT in the blocklist (system blocklist excludes
    // /tmp specifically for test compat) AND not under a family root.
    const outside = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-outside-')))
    try {
      const res = await app.request(
        'http://127.0.0.1:5193/api/admin/registry/fix-path',
        {
          method: 'POST',
          headers: authHeaders(ctx.token),
          body: JSON.stringify({ id: ctx.projectId, newPath: outside }),
        },
      )
      expect(res.status).toBe(422)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('newPath_outside_family_roots')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('Test 7 [T-12-PATH-TRAVERSAL ..]: returns 422 newPath_outside_family_roots for ../.. escape', async () => {
    // The path string contains .. — after canonicaliseRoot (realpath +
    // resolve) the canonical form is outside the family root.
    const escape = join(ctx.familyRootReal, '..', '..', '..')
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: escape }),
      },
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    // Two acceptable failure modes: blocked by blocklist OR rejected by
    // family-root containment. Both are valid defences for ../.. escape.
    expect(['newPath_blocked', 'newPath_outside_family_roots']).toContain(body.error)
  })

  it('Test 8 [T-12-SYMLINK-ESCAPE]: returns 422 newPath_outside_family_roots for planted symlink', async () => {
    // Plant a symlink INSIDE the family root pointing to a path OUTSIDE
    // the family root. canonicaliseRoot (realpath) MUST follow the symlink
    // and the family-root containment check MUST reject post-realpath.
    const outsideTarget = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-escape-target-')))
    try {
      const symlinkPath = join(ctx.familyRootReal, 'planted-symlink')
      symlinkSync(outsideTarget, symlinkPath)

      const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
      const res = await app.request(
        'http://127.0.0.1:5193/api/admin/registry/fix-path',
        {
          method: 'POST',
          headers: authHeaders(ctx.token),
          body: JSON.stringify({ id: ctx.projectId, newPath: symlinkPath }),
        },
      )
      expect(res.status).toBe(422)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('newPath_outside_family_roots')
    } finally {
      rmSync(outsideTarget, { recursive: true, force: true })
    }
  })

  it('Test 9 [project_not_found]: returns 404 when id is not in the registry', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: 'no-such-project', newPath: ctx.newRealProjectPath }),
      },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('project_not_found')
  })

  it('Test 10 [happy path]: returns 200 + updated RegistryEntry with canonical root', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; root: string }
    expect(body.id).toBe(ctx.projectId)
    expect(body.root).toBe(realpathSync(ctx.newRealProjectPath))
  })

  it('Test 11 [atomic write]: registry.json content reflects the updated entry', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    await app.request('http://127.0.0.1:5193/api/admin/registry/fix-path', {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
    })
    const onDisk = JSON.parse(readFileSync(ctx.registryFile, 'utf8')) as {
      projects: Array<{ id: string; root: string }>
    }
    const entry = onDisk.projects.find((p) => p.id === ctx.projectId)
    expect(entry?.root).toBe(realpathSync(ctx.newRealProjectPath))
  })

  it('Test 12 [T-12-REGISTRY-CORRUPTION]: registry.json mode stays 0o600 after write', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    await app.request('http://127.0.0.1:5193/api/admin/registry/fix-path', {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
    })
    const mode = statSync(ctx.registryFile).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('Test 13 [T-12-DOS]: 11th request within 10s returns 429 with Retry-After', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    // Exhaust the 10-slot bucket (10 happy-path calls is the simplest path
    // — each one re-mutates the registry to the same canonical newPath,
    // which is idempotent per Test 16).
    for (let i = 0; i < 10; i++) {
      const res = await app.request(
        'http://127.0.0.1:5193/api/admin/registry/fix-path',
        {
          method: 'POST',
          headers: authHeaders(ctx.token),
          body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
        },
      )
      expect(res.status).not.toBe(429)
    }
    const res11 = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
      },
    )
    expect(res11.status).toBe(429)
    const body = (await res11.json()) as { error: string }
    expect(body.error).toBe('rate_limited')
    expect(res11.headers.get('Retry-After')).toBe('1')
  })

  it('Test 14 [T-12-CACHE-STALE]: invalidates conformanceCache + coverageCache on success', async () => {
    // Pre-populate both caches; happy-path call must clear both.
    setConformanceCache(
      {
        schemaVersion: 1,
        today: {
          asOf: '2026-05-19T12:00:00.000Z',
          fleet: 50,
          agenticapps: 50,
          factiv: 50,
          neuroflash: 50,
        },
        delta14d: { fleet: 0, agenticapps: 0, factiv: 0, neuroflash: 0 },
        series: [],
        drifted: [],
      },
      Date.now(),
    )
    setCoverageCache(
      {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'not-installed',
        workflowHeadVersion: null,
        rows: [],
      },
      Date.now(),
    )

    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    await app.request('http://127.0.0.1:5193/api/admin/registry/fix-path', {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
    })

    expect(getConformanceCache(Date.now())).toBeNull()
    expect(getCoverageCache(Date.now())).toBeNull()
  })

  it('Test 15 [T-12-INFO-DISCLOSURE]: error responses do NOT leak filesystem paths', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      {
        method: 'POST',
        headers: authHeaders(ctx.token),
        body: JSON.stringify({ id: ctx.projectId, newPath: '/etc' }),
      },
    )
    const body = (await res.json()) as Record<string, unknown>
    // Structured error code present.
    expect(body.error).toBe('newPath_blocked')
    // NO raw filesystem paths from the supplied newPath ("/etc") leak in
    // the response body as standalone values. We allow the blocked-reason
    // detail (which mentions "/etc" — that's the user-supplied input
    // surface, NOT a server internal). What we forbid is leaking server
    // implementation details like registry.json paths, tmp dirs, etc.
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('registry.json')
    expect(serialized).not.toContain('atomicWriteFile')
    expect(serialized).not.toContain('/.agenticapps/dashboard')
  })

  it('Test 16 [T-12-IDEMPOTENT-FAIL]: calling fix-path twice yields the same final state', async () => {
    const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
    const body = JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath })

    const res1 = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      { method: 'POST', headers: authHeaders(ctx.token), body },
    )
    expect(res1.status).toBe(200)
    const json1 = (await res1.json()) as { root: string }

    const res2 = await app.request(
      'http://127.0.0.1:5193/api/admin/registry/fix-path',
      { method: 'POST', headers: authHeaders(ctx.token), body },
    )
    expect(res2.status).toBe(200)
    const json2 = (await res2.json()) as { root: string }

    expect(json1.root).toBe(json2.root)
    // On-disk state is also stable.
    const onDisk = JSON.parse(readFileSync(ctx.registryFile, 'utf8')) as {
      projects: Array<{ id: string; root: string }>
    }
    expect(onDisk.projects.find((p) => p.id === ctx.projectId)?.root).toBe(json2.root)
  })

  it('Test 17 [schema_drift]: monkey-patched writeRegistry → 500 schema_drift', async () => {
    // Mock RegistryEntrySchema.parse to throw — simulates schema drift in
    // the route's output.
    const shared = await import('@agenticapps/dashboard-shared')
    const spy = vi
      .spyOn(shared.RegistryEntrySchema, 'parse')
      .mockImplementation(() => {
        throw new Error('synthetic schema drift')
      })

    try {
      const app = createApp({ registryFile: ctx.registryFile, authFile: ctx.authFile })
      const res = await app.request(
        'http://127.0.0.1:5193/api/admin/registry/fix-path',
        {
          method: 'POST',
          headers: authHeaders(ctx.token),
          body: JSON.stringify({ id: ctx.projectId, newPath: ctx.newRealProjectPath }),
        },
      )
      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('schema_drift')
    } finally {
      spy.mockRestore()
    }
  })
})
