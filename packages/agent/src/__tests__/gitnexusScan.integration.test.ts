/**
 * gitnexusScan.integration.test.ts — end-to-end integration tests using stub binary.
 *
 * Plan 13-02 (Wave 2) — 4 integration test cases.
 *
 * Strategy: uses _setGitnexusBinForTests() to inject the stub binary path,
 * so no real gitnexus process is spawned. The stub binary controls exit code,
 * delay, and stderr via env vars (see packages/agent/test-fixtures/stub-gitnexus.sh).
 *
 * Hermeticity (I-1 / Stage-2 review): makeTmpHome({ overrideHomeEnv: true })
 * sets process.env.HOME to a tmpdir for the test's lifetime so
 * derivedRepoId() (which reads os.homedir()) resolves there. Test repo dirs
 * are created under the tmp home — NEVER under the user's real ~/Sourcecode
 * tree. tmp.cleanup() restores HOME and rms the whole tree.
 *
 * Test cases:
 *   1. Happy path — stub exits 0 → GET polls until state='done'
 *   2. Subprocess error — stub exits 1 → GET shows state='error', no stderr leak (T-13-02-04)
 *   3. Global lock serialisation — 2 cross-family POSTs run sequentially (T-13-02-05)
 *   4. Family partial success — stub fails on 2nd invocation → completed=2, failed=1
 */
import { join, sep } from 'node:path'
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { _resetForTests, _setGitnexusBinForTests } from '../lib/gitnexusScan.js'
import type { RegistryFile } from '../lib/registry.js'

const FIXTURES_DIR = join(new URL('../../test-fixtures', import.meta.url).pathname)
const STUB_GITNEXUS = join(FIXTURES_DIR, 'stub-gitnexus.sh')

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Build a registry entry rooted under the per-test tmp HOME (NOT the user's
 * real home). The tmp HOME is what derivedRepoId() resolves against because
 * makeTmpHome({ overrideHomeEnv: true }) sets process.env.HOME for the test.
 */
function makeRegistryEntry(home: string, family: string, repo: string) {
  const root = `${home}${sep}Sourcecode${sep}${family}${sep}${repo}`
  return {
    id: `${family}-${repo}`,
    name: repo,
    root,
    client: null,
    addedAt: new Date().toISOString(),
    tags: [],
  }
}

function writeRegistry(registryFile: string, projects: RegistryFile['projects']): void {
  writeFileSync(registryFile, JSON.stringify({ version: 1, projects }, null, 2), 'utf8')
}

/**
 * Create {home}/Sourcecode/{family}/{repo} for execa cwd to exist. Lives
 * entirely inside the tmp HOME so cleanup() drops it with the rest of the tree.
 */
function createRepoDir(home: string, family: string, repo: string): string {
  const dir = `${home}${sep}Sourcecode${sep}${family}${sep}${repo}`
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Poll GET until state !== 'running' or timeout. */
async function pollUntilSettled(
  app: ReturnType<typeof createApp>,
  scanId: string,
  token: string,
  timeoutMs = 10_000,
  intervalMs = 50,
): Promise<{ state: string; error?: { code: string; message: string }; kind: string; completed?: number; failed?: number; perRepoResults?: unknown[] }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await app.request(`http://localhost/api/gitnexus/scan/${scanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 200) {
      const body = await res.json() as {
        ok: boolean
        job?: { state: string; error?: { code: string; message: string }; kind: string; completed?: number; failed?: number; perRepoResults?: unknown[] }
      }
      if (body.ok && body.job && body.job.state !== 'running') {
        return body.job
      }
    }
    await new Promise<void>((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Scan ${scanId} did not settle within ${timeoutMs}ms`)
}

// ── Shared test state ─────────────────────────────────────────────────────────

describe('gitnexusScan integration tests (stub binary)', () => {
  let cleanup: () => void
  let registryFile: string
  let authFile: string
  let token: string
  let app: ReturnType<typeof createApp>
  let tmpHome: string
  let tmpBinDir: string

  beforeEach(() => {
    _resetForTests()
    _setGitnexusBinForTests(STUB_GITNEXUS)

    // I-1: overrideHomeEnv:true makes process.env.HOME point at the tmp dir
    // so derivedRepoId() — which reads os.homedir() — resolves into the
    // sandbox. Repo dirs created under tmpHome are dropped by cleanup().
    const tmp = makeTmpHome({ overrideHomeEnv: true })
    cleanup = tmp.cleanup
    tmpHome = tmp.homeDir
    registryFile = join(tmp.configDir, 'registry.json')
    authFile = join(tmp.configDir, 'auth.json')
    tmpBinDir = mkdtempSync(join(tmpdir(), 'gitnexus-bin-'))

    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token
    app = createApp({ registryFile, authFile, bindMode: 'loopback' })
  })

  afterEach(() => {
    _resetForTests()
    _setGitnexusBinForTests(null)
    cleanup()  // also restores process.env.HOME
    rmSync(tmpBinDir, { recursive: true, force: true })
  })

  // ── I-1 hermeticity guard ─────────────────────────────────────────────────
  // Defensive: protects against future regressions of the makeTmpHome HOME
  // override or `homedir()` call-site changes that would route tests back
  // into the user's real ~/Sourcecode tree.
  it('I-1 guard: process.env.HOME is overridden to a tmpdir; homedir() resolves into the sandbox', () => {
    expect(tmpHome).toMatch(/agentic-test-/)
    expect(homedir()).toBe(tmpHome)
    expect(homedir().startsWith(tmpdir())).toBe(true)
  })

  // ── Test 1: Happy path ────────────────────────────────────────────────────

  it('Test 1: happy path — stub exits 0, GET polls until state=done', async () => {
    const repoName = `inttest-happy`
    createRepoDir(tmpHome, 'agenticapps', repoName)

    writeRegistry(registryFile, [makeRegistryEntry(tmpHome, 'agenticapps', repoName)])

    const postRes = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: `agenticapps/${repoName}` }),
    })

    expect(postRes.status).toBe(200)
    const postBody = await postRes.json() as { ok: boolean; scanId: string }
    expect(postBody.ok).toBe(true)

    const job = await pollUntilSettled(app, postBody.scanId, token)
    expect(job.state).toBe('done')
    expect(job.kind).toBe('repo')
  })

  // ── Test 2: Subprocess error — no stderr leak ─────────────────────────────

  it('Test 2: subprocess exit 1 → state=error, no raw stderr in response (T-13-02-04)', async () => {
    const secretProbe = 'fake-secret-path-leak-DO-NOT-SURFACE'

    // Create a stub that exits 1 with a known secret on stderr
    const failBin = join(tmpBinDir, 'gitnexus-fail.sh')
    writeFileSync(
      failBin,
      `#!/usr/bin/env bash\necho "${secretProbe}" >&2\nexit 1\n`,
      'utf8',
    )
    chmodSync(failBin, 0o755)
    _setGitnexusBinForTests(failBin)

    const repoName = `inttest-fail`
    createRepoDir(tmpHome, 'agenticapps', repoName)

    writeRegistry(registryFile, [makeRegistryEntry(tmpHome, 'agenticapps', repoName)])

    const postRes = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: `agenticapps/${repoName}` }),
    })

    expect(postRes.status).toBe(200)
    const postBody = await postRes.json() as { ok: boolean; scanId: string }

    const job = await pollUntilSettled(app, postBody.scanId, token) as {
      state: string
      error?: { code: string; message: string }
      kind: string
    }

    expect(job.state).toBe('error')
    expect(job.error?.code).toBe('SCAN_FAILED')

    // T-13-02-04: raw stderr secret must NOT appear in the GET response body
    const getRes = await app.request(`http://localhost/api/gitnexus/scan/${postBody.scanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const rawBody = await getRes.text()
    expect(rawBody).not.toContain(secretProbe)
  })

  // ── Test 3: Global lock serialisation (T-13-02-05) ────────────────────────

  it('Test 3: global lock serialises 2 cross-family scans — second waits for first', async () => {
    // Create a slow stub (300ms delay)
    const slowBin = join(tmpBinDir, 'gitnexus-slow.sh')
    writeFileSync(
      slowBin,
      `#!/usr/bin/env bash\npython3 -c "import time; time.sleep(0.3)"\nexit 0\n`,
      'utf8',
    )
    chmodSync(slowBin, 0o755)
    _setGitnexusBinForTests(slowBin)

    const repoA = `inttest-lock-a`
    const repoB = `inttest-lock-b`
    createRepoDir(tmpHome, 'agenticapps', repoA)
    createRepoDir(tmpHome, 'factiv', repoB)

    writeRegistry(registryFile, [
      makeRegistryEntry(tmpHome, 'agenticapps', repoA),
      makeRegistryEntry(tmpHome, 'factiv', repoB),
    ])

    const t0 = Date.now()

    // POST both concurrently
    const [postResA, postResB] = await Promise.all([
      app.request('http://localhost/api/gitnexus/scan', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ scope: 'repo', target: `agenticapps/${repoA}` }),
      }),
      app.request('http://localhost/api/gitnexus/scan', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ scope: 'repo', target: `factiv/${repoB}` }),
      }),
    ])

    expect(postResA.status).toBe(200)
    expect(postResB.status).toBe(200)

    const bodyA = await postResA.json() as { ok: boolean; scanId: string }
    const bodyB = await postResB.json() as { ok: boolean; scanId: string }

    // Wait for both to settle
    const [jobA, jobB] = await Promise.all([
      pollUntilSettled(app, bodyA.scanId, token, 15_000),
      pollUntilSettled(app, bodyB.scanId, token, 15_000),
    ])

    const elapsed = Date.now() - t0

    // Both should succeed
    expect(jobA.state).toBe('done')
    expect(jobB.state).toBe('done')

    // Serialised: should take >= 2 × stub delay (600ms total for two serial 300ms stubs)
    // Use a generous lower bound (500ms) to avoid CI flakiness while still proving serialisation
    expect(elapsed).toBeGreaterThan(500)
  })

  // ── Test 4: Family partial success ────────────────────────────────────────

  it('Test 4: family partial success — 3 repos, 2nd fails → completed=2, failed=1', async () => {
    // Create a per-invocation failing stub (fails on 2nd call)
    const counterFile = join(tmpBinDir, 'invocation.count')
    const failBin = join(tmpBinDir, 'gitnexus-failing.sh')
    writeFileSync(
      failBin,
      [
        '#!/usr/bin/env bash',
        `COUNTER_FILE="${counterFile}"`,
        'N=$(( $(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1 ))',
        'echo "$N" > "$COUNTER_FILE"',
        'if [ "$N" = "2" ]; then exit 1; fi',
        'exit 0',
      ].join('\n'),
      'utf8',
    )
    chmodSync(failBin, 0o755)
    _setGitnexusBinForTests(failBin)

    // 3 repos in agenticapps — alphabetical: alpha, beta, gamma
    const repoNames = ['inttest-fam-alpha', 'inttest-fam-beta', 'inttest-fam-gamma']
    for (const r of repoNames) {
      createRepoDir(tmpHome, 'agenticapps', r)
    }
    writeRegistry(registryFile, repoNames.map((r) => makeRegistryEntry(tmpHome, 'agenticapps', r)))

    const postRes = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'family', target: 'agenticapps' }),
    })

    expect(postRes.status).toBe(200)
    const postBody = await postRes.json() as { ok: boolean; scanId: string }
    const { scanId } = postBody

    // Poll until family scan settles
    const familyJob = await pollUntilSettled(app, scanId, token, 20_000)

    expect(familyJob.kind).toBe('family')
    expect(familyJob.state).toBe('done')   // family never reports 'error' (D-13-05)
    expect(familyJob.completed).toBe(2)
    expect(familyJob.failed).toBe(1)

    const results = familyJob.perRepoResults as Array<{ state: string; error?: { code: string } }>
    expect(results).toHaveLength(3)
    // 2nd entry in alphabetical order (beta) should be error
    expect(results[1]?.state).toBe('error')
    expect(results[1]?.error?.code).toBe('SCAN_FAILED')
  })
})
