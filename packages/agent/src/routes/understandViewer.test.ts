/**
 * understandViewer.test.ts — TDD tests for understandViewer route (Plan 14-05).
 *
 * Security families covered (from 14-VALIDATION.md):
 *   T-14-token     — viewer token gate on all 6 data endpoints
 *   T-14-traversal — path traversal guards in file-content.json (Task 2)
 *   T-14-leak      — FIX 2 sanitisation; no absolute paths in graph responses
 *   T-14-resolve   — valid token but unresolvable repoId → 404
 *
 * Test structure:
 *   Task 1 (RED/GREEN):  5 data endpoints + scoped token gate
 *   Task 2 (RED/GREEN):  file-content.json + 12 upstream guards
 *   Task 3 (RED/GREEN):  static viewer serving + app.ts mount order
 */

import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import {
  ensureViewerSecretFile,
  mintViewerToken,
  verifyViewerToken,
} from '../lib/viewerToken.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Build a minimal .understand-anything/knowledge-graph.json */
function makeGraphJson(nodes: Array<{ filePath: string; id?: string }>) {
  return JSON.stringify({
    nodes: nodes.map((n, i) => ({
      id: n.id ?? `node-${i}`,
      filePath: n.filePath,
      name: `Symbol${i}`,
      type: 'function',
    })),
    edges: [],
    metadata: { generatedAt: new Date().toISOString() },
  })
}

/** Create a tmp project dir with .understand-anything/ dir and optional graph files. */
function makeTmpUnderstandProject(
  graphNodes: Array<{ filePath: string }> = [],
  opts: {
    includeMeta?: boolean
    includeDomain?: boolean
    includeDiff?: boolean
    includeConfig?: boolean
  } = {},
) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'understand-proj-')))
  const uaDir = join(root, '.understand-anything')
  mkdirSync(uaDir, { recursive: true })

  if (graphNodes.length > 0) {
    writeFileSync(join(uaDir, 'knowledge-graph.json'), makeGraphJson(graphNodes))
  }
  if (opts.includeMeta) {
    writeFileSync(
      join(uaDir, 'meta.json'),
      JSON.stringify({ version: '2.7.6', gitCommitHash: 'abc123', generatedAt: '2026-01-01' }),
    )
  }
  if (opts.includeDomain) {
    writeFileSync(
      join(uaDir, 'domain-graph.json'),
      makeGraphJson([{ filePath: `${root}/src/domain.ts` }]),
    )
  }
  if (opts.includeDiff) {
    writeFileSync(
      join(uaDir, 'diff-overlay.json'),
      JSON.stringify({ changes: [] }),
    )
  }
  if (opts.includeConfig) {
    writeFileSync(
      join(uaDir, 'config.json'),
      JSON.stringify({ autoUpdate: true, outputLanguage: 'de' }),
    )
  }

  return {
    root,
    uaDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

/** Create an app wired with the given registry + viewer secret */
function makeUnderstandApp(opts: {
  registryProjects?: Array<{ root: string }>
  repoIdForToken?: string
}) {
  const tmp = makeTmpHome()
  const authFile = join(tmp.configDir, 'auth.json')
  const registryFile = join(tmp.configDir, 'registry.json')
  const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')

  const fresh = ensureAuthFile(authFile)
  setActiveToken(fresh.token)

  // Bootstrap viewer secret
  ensureViewerSecretFile(viewerTokenFile)

  // Write registry
  const projects = opts.registryProjects ?? []
  writeFileSync(
    registryFile,
    JSON.stringify({ version: 1, projects: projects.map((p) => ({ ...p, id: p.root })) }),
  )

  // Mint token for specific repoId
  const repoIdForToken = opts.repoIdForToken ?? 'agenticapps/test-repo'
  const token = mintViewerToken(repoIdForToken, viewerTokenFile)

  const app = createApp({
    registryFile,
    authFile,
    viewerTokenFile,
    bindMode: 'loopback',
  })

  return {
    app,
    bearerToken: fresh.token,
    viewerToken: token,
    viewerTokenFile,
    cleanup: tmp.cleanup,
  }
}

// ── Task 1: Scoped-token data router + 5 read endpoints ──────────────────────

describe('understandViewer — Task 1: scoped-token data endpoints', () => {
  let proj: ReturnType<typeof makeTmpUnderstandProject>
  let ctx: ReturnType<typeof makeUnderstandApp>

  beforeEach(() => {
    proj = makeTmpUnderstandProject(
      [{ filePath: join('src', 'auth.ts') }],
      { includeMeta: true, includeDomain: true, includeDiff: true, includeConfig: true },
    )
    // repoId 'agenticapps/test-repo' bound to this project root via registry
    ctx = makeUnderstandApp({
      registryProjects: [{ root: proj.root }],
      repoIdForToken: 'agenticapps/test-repo',
    })
  })

  afterEach(() => {
    proj.cleanup()
    ctx.cleanup()
  })

  // ── Test 1: Token gate ────────────────────────────────────────────────────

  const dataEndpoints = [
    '/knowledge-graph.json',
    '/meta.json',
    '/config.json',
    '/domain-graph.json',
    '/diff-overlay.json',
    '/file-content.json',
  ]

  for (const endpoint of dataEndpoints) {
    it(`${endpoint} → 403 when no ?token= param`, async () => {
      const res = await ctx.app.request(`http://127.0.0.1:5193${endpoint}`)
      expect(res.status).toBe(403)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Forbidden: missing or invalid token')
    })

    it(`${endpoint} → 403 when ?token= is malformed`, async () => {
      const res = await ctx.app.request(
        `http://127.0.0.1:5193${endpoint}?token=not-a-valid-token`,
      )
      expect(res.status).toBe(403)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Forbidden: missing or invalid token')
    })

    it(`${endpoint} → 403 when ?token= minted under a different secret`, async () => {
      // Create a second viewer secret in a different file
      const tmp2 = makeTmpHome()
      const otherTokenFile = join(tmp2.configDir, 'other-viewer-token.json')
      ensureViewerSecretFile(otherTokenFile)
      const wrongToken = mintViewerToken('agenticapps/test-repo', otherTokenFile)
      tmp2.cleanup()

      const res = await ctx.app.request(
        `http://127.0.0.1:5193${endpoint}?token=${wrongToken}`,
      )
      expect(res.status).toBe(403)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Forbidden: missing or invalid token')
    })

    it(`${endpoint} → 403 when only Authorization: Bearer <main token> and no ?token=`, async () => {
      // The main bearer token must NOT be accepted as a viewer token
      const res = await ctx.app.request(`http://127.0.0.1:5193${endpoint}`, {
        headers: { Authorization: `Bearer ${ctx.bearerToken}` },
      })
      expect(res.status).toBe(403)
    })
  }

  // ── Test 2: Repo binding ──────────────────────────────────────────────────

  it('token for repo A serves repo A graph, not repo B when both exist', async () => {
    // Create two projects
    const projA = makeTmpUnderstandProject([{ filePath: 'src/a.ts' }])
    const projB = makeTmpUnderstandProject([{ filePath: 'src/b.ts' }])

    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')

    ensureAuthFile(authFile)
    ensureViewerSecretFile(viewerTokenFile)

    // Register both projects with stable IDs
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [
        { id: projA.root, root: projA.root, name: 'repo-a' },
        { id: projB.root, root: projB.root, name: 'repo-b' },
      ],
    }))

    // We need to derive repoIds — for this test we use a custom approach:
    // inject viewerTokenFile override via createApp opts
    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      // inject a custom repoRoot override via viewerRootOverride
      viewerRootOverrides: {
        'agenticapps/repo-a': projA.root,
        'agenticapps/repo-b': projB.root,
      },
      bindMode: 'loopback',
    })
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)

    // Mint token for repo-a specifically
    const tokenA = mintViewerToken('agenticapps/repo-a', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/knowledge-graph.json?token=${tokenA}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { nodes: Array<{ filePath: string }> }
    // Must contain 'a.ts', not 'b.ts'
    const paths = body.nodes.map((n) => n.filePath)
    expect(paths.some((p) => p.includes('a.ts'))).toBe(true)
    expect(paths.some((p) => p.includes('b.ts'))).toBe(false)

    projA.cleanup()
    projB.cleanup()
    tmp.cleanup()
  })

  // ── Test 3: FIX 2 sanitisation on knowledge-graph.json ───────────────────

  it('knowledge-graph.json: absolute-under-root paths are relativized (no leading slash)', async () => {
    const projFix2 = makeTmpUnderstandProject([
      { filePath: join(proj.root, 'src', 'auth.ts') }, // (a) absolute under root
    ])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projFix2.root, root: projFix2.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projFix2.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/knowledge-graph.json?token=${token}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { nodes: Array<{ filePath: string }> }

    // No path should start with '/' (absolute) or contain the project root
    for (const node of body.nodes) {
      expect(node.filePath).not.toMatch(/^\//)
      expect(node.filePath).not.toContain(projFix2.root)
      expect(node.filePath).not.toContain(homedir())
    }

    projFix2.cleanup()
    tmp.cleanup()
  })

  it('knowledge-graph.json: absolute-outside-root paths are reduced to basename', async () => {
    const outsidePath = '/etc/passwd'
    const projFix2 = makeTmpUnderstandProject([
      { filePath: outsidePath }, // (b) absolute but outside root
    ])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projFix2.root, root: projFix2.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projFix2.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/knowledge-graph.json?token=${token}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { nodes: Array<{ filePath: string }> }

    // The /etc/passwd node should become 'passwd' (basename only)
    const etcNode = body.nodes.find((n) => n.filePath === 'passwd')
    expect(etcNode).toBeDefined()
    // Raw serialized response must not contain '/etc'
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('/etc')

    projFix2.cleanup()
    tmp.cleanup()
  })

  it('knowledge-graph.json: already-relative paths are unchanged', async () => {
    const projFix2 = makeTmpUnderstandProject([
      { filePath: 'src/existing.ts' }, // (c) already relative
    ])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projFix2.root, root: projFix2.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projFix2.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/knowledge-graph.json?token=${token}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { nodes: Array<{ filePath: string }> }
    expect(body.nodes[0]?.filePath).toBe('src/existing.ts')

    projFix2.cleanup()
    tmp.cleanup()
  })

  // ── Test 4: knowledge-graph missing ──────────────────────────────────────

  it('knowledge-graph.json → 404 with exact upstream error string when file absent', async () => {
    const projEmpty = makeTmpUnderstandProject([]) // no graph file
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projEmpty.root, root: projEmpty.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projEmpty.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/knowledge-graph.json?token=${token}`,
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('No knowledge graph found. Run /understand first.')

    projEmpty.cleanup()
    tmp.cleanup()
  })

  // ── Test 5: meta / domain-graph / diff-overlay ───────────────────────────

  it('meta.json → 404 empty body when file absent', async () => {
    const projNoMeta = makeTmpUnderstandProject([])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projNoMeta.root, root: projNoMeta.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projNoMeta.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/meta.json?token=${token}`)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('')

    projNoMeta.cleanup()
    tmp.cleanup()
  })

  it('meta.json → 200 raw passthrough when file exists', async () => {
    const projMeta = makeTmpUnderstandProject([], { includeMeta: true })
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projMeta.root, root: projMeta.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projMeta.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/meta.json?token=${token}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { version: string }
    expect(body.version).toBe('2.7.6')

    projMeta.cleanup()
    tmp.cleanup()
  })

  it('domain-graph.json → FIX 2 applied (no absolute root in response)', async () => {
    const projDomain = makeTmpUnderstandProject([], { includeDomain: true })
    // domain-graph.json has a node with an absolute path inside the project root
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projDomain.root, root: projDomain.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projDomain.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/domain-graph.json?token=${token}`)
    expect(res.status).toBe(200)
    const raw = await res.text()
    // FIX 2 must have removed the absolute root prefix
    expect(raw).not.toContain(projDomain.root)

    projDomain.cleanup()
    tmp.cleanup()
  })

  it('diff-overlay.json → 404 empty body when file absent', async () => {
    const projNoDiff = makeTmpUnderstandProject([])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projNoDiff.root, root: projNoDiff.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projNoDiff.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/diff-overlay.json?token=${token}`)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('')

    projNoDiff.cleanup()
    tmp.cleanup()
  })

  // ── Test 6: config.json ───────────────────────────────────────────────────

  it('config.json → 200 file contents when file exists', async () => {
    const projCfg = makeTmpUnderstandProject([], { includeConfig: true })
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projCfg.root, root: projCfg.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projCfg.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/config.json?token=${token}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { autoUpdate: boolean; outputLanguage: string }
    expect(body.outputLanguage).toBe('de')

    projCfg.cleanup()
    tmp.cleanup()
  })

  it('config.json → 200 {"autoUpdate":false,"outputLanguage":"en"} when file absent', async () => {
    const projNoCfg = makeTmpUnderstandProject([])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projNoCfg.root, root: projNoCfg.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projNoCfg.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/config.json?token=${token}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { autoUpdate: boolean; outputLanguage: string }
    expect(body.autoUpdate).toBe(false)
    expect(body.outputLanguage).toBe('en')

    projNoCfg.cleanup()
    tmp.cleanup()
  })

  // ── Test 7: unresolvable repoId → 404 ───────────────────────────────────

  it('valid token whose repoId resolves to no existing root → 404', async () => {
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    // Empty registry — no projects
    writeFileSync(registryFile, JSON.stringify({ version: 1, projects: [] }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: {}, // no overrides — repoId won't resolve
      bindMode: 'loopback',
    })
    // Mint a valid token for a repoId that resolves nowhere
    const token = mintViewerToken('agenticapps/nonexistent-repo', viewerTokenFile)

    const res = await app.request(`http://127.0.0.1:5193/knowledge-graph.json?token=${token}`)
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    // No path detail in the error
    expect(body.error).not.toContain('/')
    expect(body.error).not.toContain(sep)

    tmp.cleanup()
  })
})

// ── Task 2: file-content.json with full 12-guard readSourceFile suite ────────

describe('understandViewer — Task 2: file-content.json guards', () => {
  let proj: ReturnType<typeof makeTmpUnderstandProject>
  let srcFile: string
  let ctx: { app: ReturnType<typeof createApp>; viewerToken: string; cleanup: () => void }

  beforeEach(() => {
    // Create a project with a real source file listed in the graph
    proj = makeTmpUnderstandProject([]) // start empty, add graph manually

    // Create the source file
    mkdirSync(join(proj.root, 'src'), { recursive: true })
    srcFile = join(proj.root, 'src', 'auth.ts')
    writeFileSync(srcFile, 'export function authenticate() { return true; }\n')

    // Write graph with the source file listed
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([{ filePath: join(proj.root, 'src', 'auth.ts') }]),
    )

    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: proj.root, root: proj.root, name: 'test' }],
    }))

    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)
    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': proj.root },
      bindMode: 'loopback',
    })

    ctx = { app, viewerToken: token, cleanup: tmp.cleanup }
  })

  afterEach(() => {
    proj.cleanup()
    ctx.cleanup()
  })

  // ── Test 1: basic path validation ─────────────────────────────────────────

  it('missing path param → 400 {"error":"Missing path"}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Missing path')
  })

  it('NUL byte in path → 400 {"error":"Invalid path"}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=${encodeURIComponent('src/\0evil.ts')}`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid path')
  })

  it('absolute path → 400 {"error":"Absolute paths are not allowed"}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=${encodeURIComponent('/etc/passwd')}`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Absolute paths are not allowed')
  })

  // ── Test 2: path traversal ────────────────────────────────────────────────

  it('normalize results "../" → 400 {"error":"Path must stay inside the project"}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=${encodeURIComponent('../etc/passwd')}`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Path must stay inside the project')
  })

  it('path normalizing to ".." → 400 {"error":"Path must stay inside the project"}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=..`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Path must stay inside the project')
  })

  it('encoded traversal %2e%2e%2f rejected', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=..%2f..%2fetc%2fpasswd`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Path must stay inside the project')
  })

  // ── Test 3: graph file absent ─────────────────────────────────────────────

  it('graph file absent → 404 {"error":"No knowledge graph found. Run /understand first."}', async () => {
    const projNoGraph = makeTmpUnderstandProject([]) // no graph file
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: projNoGraph.root, root: projNoGraph.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': projNoGraph.root },
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    const res = await app.request(
      `http://127.0.0.1:5193/file-content.json?token=${token}&path=src/auth.ts`,
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('No knowledge graph found. Run /understand first.')

    projNoGraph.cleanup()
    tmp.cleanup()
  })

  // ── Test 4: symlink escape blocked even when graph-listed ─────────────────

  it('graph-listed symlink pointing outside repo root → 400 (symlink escape blocked)', async () => {
    // Create a file outside the repo root
    const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'outside-')))
    const outsideFile = join(outsideDir, 'secret.txt')
    writeFileSync(outsideFile, 'secret content')

    // Create the symlink inside the project
    const symlinkPath = join(proj.root, 'src', 'symlink.ts')
    symlinkSync(outsideFile, symlinkPath)

    // Add the symlink to the graph (graph-listed path)
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([
        { filePath: join(proj.root, 'src', 'auth.ts') },
        { filePath: join(proj.root, 'src', 'symlink.ts') }, // graph-listed symlink
      ]),
    )

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/symlink.ts`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Path must stay inside the project')

    rmSync(outsideDir, { recursive: true, force: true })
  })

  // ── Test 5: file not in graph allow-list ──────────────────────────────────

  it('existing file NOT in graph → 404 {"error":"File is not in the knowledge graph"}', async () => {
    // Create a file that exists but is not in the graph
    const unlistedFile = join(proj.root, 'src', 'unlisted.ts')
    writeFileSync(unlistedFile, 'export const x = 1')

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/unlisted.ts`,
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('File is not in the knowledge graph')
  })

  it('dotfile existing but unlisted (.planning/x) → 404', async () => {
    mkdirSync(join(proj.root, '.planning'), { recursive: true })
    writeFileSync(join(proj.root, '.planning', 'x'), 'data')

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=.planning/x`,
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('File is not in the knowledge graph')
  })

  // ── Test 6: graph-listed but deleted / is-directory ──────────────────────

  it('graph-listed but deleted file → 404 {"error":"File not found"}', async () => {
    // Graph lists src/deleted.ts but the file does not exist
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([
        { filePath: 'src/auth.ts' },
        { filePath: 'src/deleted.ts' }, // listed but does not exist on disk
      ]),
    )

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/deleted.ts`,
    )
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('File not found')
  })

  it('graph-listed directory → 400 {"error":"Path is not a file"}', async () => {
    // Add 'src' directory itself to the graph
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([
        { filePath: 'src/auth.ts' },
        { filePath: 'src' }, // src is a directory
      ]),
    )

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Path is not a file')
  })

  // ── Test 7: size + binary guards ──────────────────────────────────────────

  it('graph-listed file > 1 MiB → 413 {"error":"File is too large to preview"}', async () => {
    const bigFile = join(proj.root, 'src', 'big.ts')
    // Write 1 MiB + 1 byte of text
    const content = 'x'.repeat(1024 * 1024 + 1)
    writeFileSync(bigFile, content)
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([{ filePath: 'src/auth.ts' }, { filePath: 'src/big.ts' }]),
    )

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/big.ts`,
    )
    expect(res.status).toBe(413)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('File is too large to preview')
  })

  it('graph-listed file containing NUL byte → 415 {"error":"Binary files cannot be previewed"}', async () => {
    const binFile = join(proj.root, 'src', 'binary.ts')
    writeFileSync(binFile, Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f, 0x72, 0x6c, 0x64]))
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([{ filePath: 'src/auth.ts' }, { filePath: 'src/binary.ts' }]),
    )

    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/binary.ts`,
    )
    expect(res.status).toBe(415)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Binary files cannot be previewed')
  })

  // ── Test 8: happy path + no cache staleness ───────────────────────────────

  it('happy path → 200 with {path, language, content, sizeBytes, lineCount}', async () => {
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/auth.ts`,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as {
      path: string
      language: string
      content: string
      sizeBytes: number
      lineCount: number
    }
    expect(body.path).toBe('src/auth.ts')
    expect(body.language).toBe('typescript')
    expect(body.content).toContain('authenticate')
    expect(body.sizeBytes).toBeGreaterThan(0)
    expect(body.lineCount).toBeGreaterThan(0)
  })

  it('no cache staleness: newly graph-listed file is served on second request', async () => {
    // First request: only src/auth.ts in graph
    const resFirst = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/new.ts`,
    )
    expect(resFirst.status).toBe(404) // not in graph yet

    // Add src/new.ts to the graph AND create the file
    const newFile = join(proj.root, 'src', 'new.ts')
    writeFileSync(newFile, 'export const newFn = () => {};\n')
    writeFileSync(
      join(proj.uaDir, 'knowledge-graph.json'),
      makeGraphJson([
        { filePath: join(proj.root, 'src', 'auth.ts') },
        { filePath: join(proj.root, 'src', 'new.ts') },
      ]),
    )

    // Second request: now the file IS in the graph (per-request parse, no stale cache)
    const resSecond = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=src/new.ts`,
    )
    expect(resSecond.status).toBe(200)
    const body = await resSecond.json() as { path: string }
    expect(body.path).toBe('src/new.ts')
  })

  it('error responses do not include filesystem paths (guard on body / content)', async () => {
    // Test with a traversal attempt — error body must not contain '/' beyond JSON structure
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/file-content.json?token=${ctx.viewerToken}&path=${encodeURIComponent('../etc/passwd')}`,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    // The error message itself must not contain filesystem paths
    expect(body.error).not.toContain(sep)
    expect(body.error).not.toContain(homedir())
    expect(body.error).not.toContain(proj.root)
  })
})

// ── Task 3: Static viewer serving + app.ts mount order ───────────────────────

describe('understandViewer — Task 3: static viewer serving', () => {
  let viewerDir: string
  let viewerCleanup: () => void

  beforeEach(() => {
    // Create a fake viewer installation
    viewerDir = realpathSync(mkdtempSync(join(tmpdir(), 'understand-viewer-')))
    const versionDir = join(viewerDir, '2.7.6')
    const assetsDir = join(versionDir, 'assets')
    mkdirSync(assetsDir, { recursive: true })
    writeFileSync(join(versionDir, 'index.html'), '<!DOCTYPE html><html><head></head><body>Viewer SPA</body></html>')
    writeFileSync(join(assetsDir, 'app.js'), 'console.log("viewer app")')
    viewerCleanup = () => rmSync(viewerDir, { recursive: true, force: true })
  })

  afterEach(() => viewerCleanup())

  function makeViewerApp(opts: { viewerInstalled?: boolean } = {}) {
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({ version: 1, projects: [] }))

    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)
    const appOpts: import('../server/app.js').CreateAppOptions = {
      registryFile,
      authFile,
      viewerTokenFile,
      bindMode: 'loopback',
    }
    if (opts.viewerInstalled !== false) {
      appOpts.viewerDirOverride = viewerDir
    }
    const app = createApp(appOpts)

    return { app, bearerToken: authFresh.token, viewerToken: token, cleanup: tmp.cleanup }
  }

  // ── Test 1: No-trailing-slash redirect ────────────────────────────────────

  it('GET /understand/{family}/{repo} → 301/302 redirect to /understand/{family}/{repo}/', async () => {
    const ctx = makeViewerApp()
    const token = ctx.viewerToken
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo?token=${token}`,
      { redirect: 'manual' },
    )
    expect([301, 302]).toContain(res.status)
    const location = res.headers.get('Location')
    expect(location).toMatch(/\/understand\/agenticapps\/test-repo\//)
    // token= query string must survive the redirect
    expect(location).toContain(`token=${token}`)
    ctx.cleanup()
  })

  // ── Test 2: Viewer index.html served ─────────────────────────────────────

  it('GET /understand/{family}/{repo}/ with viewer installed → 200 text/html', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo/`,
    )
    expect(res.status).toBe(200)
    const ct = res.headers.get('Content-Type') ?? ''
    expect(ct).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Viewer SPA')
    ctx.cleanup()
  })

  // ── Test 3: Asset serving + traversal blocked ─────────────────────────────

  it('GET /understand/f/r/assets/app.js → 200 with chunk body', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo/assets/app.js`,
    )
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('viewer app')
    ctx.cleanup()
  })

  it('traversal attempt /understand/f/r/../../../etc/passwd → not file content from outside', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo/../../../etc/passwd`,
    )
    // Must be 404 or redirect, never serve the actual /etc/passwd.
    // 401 is also acceptable: Hono normalizes the path, which escapes /understand/*
    // and hits bearerAuth (the route does not match, so no /etc/passwd data is served).
    expect([404, 401, 301, 302, 400]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.text()
      expect(body).not.toContain('root:')
    }
    ctx.cleanup()
  })

  it('percent-encoded traversal attempt → not file content from outside', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo/%2e%2e%2f%2e%2e%2fetc%2fpasswd`,
    )
    // 401 is also acceptable (same reason as above: Hono URL normalization
    // causes the path to miss /understand/* routes).
    expect([404, 401, 301, 302, 400]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.text()
      expect(body).not.toContain('root:')
    }
    ctx.cleanup()
  })

  // ── Test 4: Viewer not installed → 503 ───────────────────────────────────

  it('viewer NOT installed → 503 with install hint', async () => {
    const ctx = makeViewerApp({ viewerInstalled: false })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/agenticapps/test-repo/`,
    )
    expect(res.status).toBe(503)
    const body = await res.text()
    expect(body).toContain('agentic-dashboard install-understand-viewer')
    ctx.cleanup()
  })

  // ── Test 5: Mount order integration ──────────────────────────────────────

  it('data endpoint reachable without bearer token; /api/* still bearer-gated', async () => {
    // Create a project with a graph
    const proj = makeTmpUnderstandProject([])
    const tmp = makeTmpHome()
    const authFile = join(tmp.configDir, 'auth.json')
    const registryFile = join(tmp.configDir, 'registry.json')
    const viewerTokenFile = join(tmp.configDir, 'viewer-token.json')
    const authFresh = ensureAuthFile(authFile)
    setActiveToken(authFresh.token)
    ensureViewerSecretFile(viewerTokenFile)
    writeFileSync(registryFile, JSON.stringify({
      version: 1,
      projects: [{ id: proj.root, root: proj.root, name: 'test' }],
    }))

    const app = createApp({
      registryFile,
      authFile,
      viewerTokenFile,
      viewerRootOverrides: { 'agenticapps/test-repo': proj.root },
      viewerDirOverride: viewerDir,
      bindMode: 'loopback',
    })
    const token = mintViewerToken('agenticapps/test-repo', viewerTokenFile)

    // 1. Data endpoint reachable with viewer token (no bearer)
    const dataRes = await app.request(
      `http://127.0.0.1:5193/config.json?token=${token}`,
    )
    // Should be 200 (config.json returns default even without .understand-anything/config.json)
    expect(dataRes.status).toBe(200)

    // 2. /api/registry without bearer → 401
    const apiRes = await app.request(`http://127.0.0.1:5193/api/registry`)
    expect(apiRes.status).toBe(401)

    proj.cleanup()
    tmp.cleanup()
  })

  // ── Test 6: Invalid segment validation ───────────────────────────────────

  it('invalid family segment (uppercase) → 404', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/AgenticApps/test-repo/`,
    )
    expect(res.status).toBe(404)
    ctx.cleanup()
  })

  it('segment with ".." → 404 or 401 (Hono normalizes, never serves external file)', async () => {
    const ctx = makeViewerApp({ viewerInstalled: true })
    const res = await ctx.app.request(
      `http://127.0.0.1:5193/understand/../../../etc/passwd`,
    )
    // 401 acceptable: Hono path normalization escapes the /understand/* prefix
    // so bearerAuth intercepts. The key invariant is that /etc/passwd is never served.
    expect([404, 401, 400]).toContain(res.status)
    ctx.cleanup()
  })
})
