/**
 * understandViewer.ts — Hono implementation of the understand-anything viewer
 * serving contract (Plan 14-05, D-14-03 thru D-14-09).
 *
 * ARCHITECTURE (binding — from 14-RESEARCH.md Critical Q1):
 *   The viewer's data fetches are ROOT-ABSOLUTE (/${fileName}?token=…).
 *   The 6 data endpoints therefore MUST be registered at the top level of the
 *   Hono app (via understandDataRoute), NOT under /understand/…
 *
 *   understandViewerRoute -- serves the static viewer SPA at:
 *     /understand/{family}/{repo}/       -> index.html
 *     /understand/{family}/{repo}/...    -> static assets (no token required)
 *
 *   understandDataRoute — serves the 6 data endpoints at app root:
 *     /knowledge-graph.json?token=…
 *     /meta.json?token=…
 *     /config.json?token=…
 *     /domain-graph.json?token=…
 *     /diff-overlay.json?token=…
 *     /file-content.json?token=…
 *
 * SECURITY MODEL:
 *   T-14-05-01 — verifyViewerToken on every data route; bearer NOT accepted
 *   T-14-05-02 — 12-guard upstream readSourceFile suite in file-content handler
 *   T-14-05-03 — realpath containment for symlink escape prevention
 *   T-14-05-04 — FIX 2 sanitisation on both knowledge-graph + domain-graph
 *   T-14-05-05 — segment regex pre-validation + traversal handling for static serving
 *   T-14-05-06 — repoId validated inside verifyViewerToken (14-02)
 *   T-14-05-07 — static assets tokenless (no project data; D-14-04 ratified all-bind)
 *
 * D-14-04: NO bindMode check in this module — full Tailscale parity.
 *   DELIBERATE CONTRAST with D-13-11 (gitnexusScan.ts), which refuses non-loopback
 *   because gitnexus-scan spawns processes. These routes are read-only data serving
 *   only — the threat model accepts them on all bind modes (T-14-05-07).
 */

import {
  existsSync,
  statSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { join, normalize, relative, isAbsolute, basename, sep } from 'node:path'

import { Hono } from 'hono'
import type { Context } from 'hono'

import { verifyViewerToken } from '../lib/viewerToken.js'
import { resolveRepoRoot } from '../lib/repoRoot.js'
import { getInstalledViewerPath } from '../lib/viewerInstall.js'
import { readRegistry } from '../lib/registry.js'
import { REGISTRY_FILE } from '../constants.js'
import type { Env } from '../server/app.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SOURCE_FILE_BYTES = 1024 * 1024  // 1 MiB

/** Upstream error strings — replicated verbatim (must be byte-identical). */
const ERR_FORBIDDEN = 'Forbidden: missing or invalid token'
const ERR_NO_GRAPH = 'No knowledge graph found. Run /understand first.'
const ERR_MISSING_PATH = 'Missing path'
const ERR_INVALID_PATH = 'Invalid path'
const ERR_ABSOLUTE_PATH = 'Absolute paths are not allowed'
const ERR_OUTSIDE_PROJECT = 'Path must stay inside the project'
const ERR_NOT_IN_GRAPH = 'File is not in the knowledge graph'
const ERR_FILE_NOT_FOUND = 'File not found'
const ERR_NOT_A_FILE = 'Path is not a file'
const ERR_TOO_LARGE = 'File is too large to preview'
const ERR_BINARY = 'Binary files cannot be previewed'

/** Upstream extension -> language map (replicated from vite.config.ts detectLanguage). */
const EXT_LANGUAGE: Record<string, string> = {
  bash: 'bash',
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  go: 'go',
  h: 'c',
  hpp: 'cpp',
  html: 'markup',
  java: 'java',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  txt: 'text',
  yaml: 'yaml',
  yml: 'yaml',
}

function detectLanguage(filePath: string): string {
  const dotIdx = filePath.lastIndexOf('.')
  const ext = dotIdx >= 0 ? filePath.slice(dotIdx + 1).toLowerCase() : ''
  return EXT_LANGUAGE[ext] ?? 'text'
}

// ── Test seams ────────────────────────────────────────────────────────────────

/**
 * Test injection map: repoId -> absolute root path override.
 * When set, resolveUnderstandRoot() uses this map instead of registry + FS.
 * Follow the gitnexusScan.ts override convention — app.ts reads c.get('viewerRootOverrides').
 */
type RepoRootOverrides = Record<string, string>

// Viewer-dir test injection happens via the `viewerDirOverride` createApp option
// (read by getViewerRoot through c.get('viewerDirOverride')) — single seam, no
// module-level override.

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a repoId to its absolute .understand-anything directory path.
 * Returns null if the repoId cannot be resolved to an existing root.
 */
function resolveUnderstandRoot(
  repoId: string,
  registryFile: string | undefined,
  rootOverrides?: RepoRootOverrides,
): { root: string; uaDir: string } | null {
  // Test seam: override map takes precedence
  if (rootOverrides && repoId in rootOverrides) {
    const overrideRoot = rootOverrides[repoId]!
    return { root: overrideRoot, uaDir: join(overrideRoot, '.understand-anything') }
  }

  // Registry-first + FS fallback (D-14-09, resolveRepoRoot)
  let projects: ReadonlyArray<{ root: string }> = []
  try {
    const reg = readRegistry(registryFile ?? REGISTRY_FILE)
    projects = reg.projects
  } catch {
    // Registry unreadable — fall through to FS fallback
  }

  const root = resolveRepoRoot(repoId, projects)
  if (!root) return null

  return { root, uaDir: join(root, '.understand-anything') }
}

/**
 * FIX 2 sanitisation — replicated from upstream vite.config.ts (lines 322-333).
 * Applied to BOTH knowledge-graph.json and domain-graph.json (RESEARCH Pitfall 5).
 *
 * filePath transformation:
 *   (a) absolute + starts with projectRoot -> relativized, leading sep stripped
 *   (b) absolute + outside root -> basename only
 *   (c) already relative -> unchanged
 */
function sanitiseGraphNodes(
  raw: { nodes?: Array<Record<string, unknown>>; [key: string]: unknown },
  projectRoot: string,
): { nodes?: Array<Record<string, unknown>>; [key: string]: unknown } {
  if (!Array.isArray(raw.nodes)) return raw
  return {
    ...raw,
    nodes: raw.nodes.map((node) => {
      if (typeof node.filePath !== 'string') return node
      const abs = node.filePath
      const rel = abs.startsWith(projectRoot)
        ? abs.slice(projectRoot.length).replace(/^[/\\]/, '')  // strip leading sep
        : isAbsolute(abs)
          ? basename(abs)  // absolute but outside root — basename only
          : abs            // already relative — keep as-is
      return { ...node, filePath: rel }
    }),
  }
}

/**
 * normalizeGraphPath — replicated from upstream vite.config.ts (lines 34-53).
 * Returns normalized unix-style path, or null if invalid/outside root.
 */
function normalizeGraphPath(filePath: string, projectRoot: string): string | null {
  const rawPath = isAbsolute(filePath)
    ? filePath.startsWith(projectRoot)
      ? relative(projectRoot, filePath)
      : null
    : filePath
  if (rawPath === null) return null
  const normalized = normalize(rawPath)
  if (
    !normalized ||
    normalized === '.' ||
    normalized.includes('\0') ||
    normalized === '..' ||
    normalized.startsWith(`..${sep}`) ||
    isAbsolute(normalized)
  ) {
    return null
  }
  return normalized.split(sep).join('/')
}

/**
 * Module-level allow-list cache keyed by graph file path (Phase 14 review fix —
 * Bundle D). Re-reading + re-parsing a ~143 kB graph on every file-content
 * request is avoidable: the parsed Set is cached and invalidated when the graph
 * file's mtimeMs changes (a fresh /understand run rewrites the file).
 */
const graphSetCache = new Map<string, { mtimeMs: number; set: Set<string> }>()

/**
 * graphFilePathSet — parse graph JSON and build the normalized allow-list Set.
 * Cached per graph file path; invalidated on mtimeMs change (see graphSetCache).
 */
function graphFilePathSet(graphFile: string, projectRoot: string): Set<string> {
  let mtimeMs: number
  try {
    mtimeMs = statSync(graphFile).mtimeMs
  } catch {
    // Unstattable graph → empty allow-list (do not cache the failure)
    return new Set<string>()
  }

  const cached = graphSetCache.get(graphFile)
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.set
  }

  const allowed = new Set<string>()
  try {
    const raw = JSON.parse(readFileSync(graphFile, 'utf-8')) as {
      nodes?: Array<Record<string, unknown>>
    }
    for (const node of raw.nodes ?? []) {
      if (typeof node.filePath !== 'string') continue
      const normalized = normalizeGraphPath(node.filePath, projectRoot)
      if (normalized) allowed.add(normalized)
    }
  } catch {
    // Malformed graph → empty allow-list; cache it (keyed to this mtime) so a
    // broken file does not trigger a re-parse storm; a rewrite bumps the mtime.
    graphSetCache.set(graphFile, { mtimeMs, set: allowed })
    return allowed
  }
  graphSetCache.set(graphFile, { mtimeMs, set: allowed })
  return allowed
}

// ── Scoped-token middleware ────────────────────────────────────────────────────

/**
 * Verify ?token= viewer token and inject repoId into context.
 * Returns 403 if token is missing, malformed, wrong-secret, or the bearer token.
 * The main bearer token is NOT accepted here (T-14-05-01).
 *
 * Note: This function is called per-endpoint handler, NOT as middleware on the
 * data router, so each handler remains individually testable. The pattern follows
 * the functional style of gitnexusScan.ts.
 */
function verifyToken(
  token: string | undefined,
  viewerTokenFile: string | undefined,
): string | null {
  if (!token) return null
  return verifyViewerToken(token, viewerTokenFile)
}

// ── Data router (6 endpoints at app root) ────────────────────────────────────

export const understandDataRoute = new Hono<Env>()

/**
 * Generic data endpoint handler factory.
 * Shared logic: token verification -> repo root resolution -> file serving.
 */
function makeDataHandler(fileName: string, opts: {
  isGraph?: boolean     // apply FIX 2 sanitisation
  missWith404EmptyBody?: boolean  // 404 empty body (meta/domain/diff)
  isConfig?: boolean    // config special: 200 default fallback
  isFileContent?: boolean  // file-content: special 12-guard handler
}) {
  return async (c: Context<Env>) => {
    const registryFile = c.get('registryFile') as string | undefined
    const viewerTokenFile = c.get('viewerTokenFile') as string | undefined
    const rootOverrides = c.get('viewerRootOverrides') as RepoRootOverrides | undefined

    // Data responses are token-bearing URLs — they must never be disk-cached.
    // Applied to every c.json/c.body response from this handler (raw Response
    // constructions below set the header explicitly).
    c.header('Cache-Control', 'no-store')

    // Token gate (T-14-05-01)
    const token = c.req.query('token')
    const repoId = verifyToken(token, viewerTokenFile)
    if (!repoId) {
      return c.json({ error: ERR_FORBIDDEN }, 403)
    }

    // Repo resolution (D-14-09)
    const resolved = resolveUnderstandRoot(repoId, registryFile, rootOverrides)
    if (!resolved) {
      // Unresolvable repoId — same 404 shape as missing graph but no path detail (T-14-05-06)
      return c.json({ error: 'Repository not found or not registered' }, 404)
    }

    const { root, uaDir } = resolved

    if (opts.isFileContent) {
      return handleFileContent(c, root, uaDir, viewerTokenFile)
    }

    const filePath = join(uaDir, fileName)

    if (opts.isConfig) {
      // config.json: file OR 200 default
      if (existsSync(filePath)) {
        try {
          const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
          return c.json(raw, 200)
        } catch {
          return c.json({ error: 'Failed to read config file' }, 500)
        }
      }
      return c.json({ autoUpdate: false, outputLanguage: 'en' }, 200)
    }

    if (!existsSync(filePath)) {
      if (opts.missWith404EmptyBody) {
        return new Response(null, {
          status: 404,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
      // knowledge-graph miss: upstream JSON error
      return c.json({ error: ERR_NO_GRAPH }, 404)
    }

    // File exists — serve it
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
        nodes?: Array<Record<string, unknown>>
        [key: string]: unknown
      }
      if (opts.isGraph) {
        const sanitised = sanitiseGraphNodes(raw, root)
        return c.json(sanitised, 200)
      }
      return c.json(raw, 200)
    } catch {
      return c.json({ error: 'Failed to read graph file' }, 500)
    }
  }
}

/**
 * file-content.json handler — implements all 12 upstream readSourceFile() guards.
 * D-14-05: "All upstream guards are replicated IN ORDER with exact status codes."
 *
 * Guards (in order — per upstream vite.config.ts readSourceFile()):
 *   1. Missing path param -> 400 "Missing path"
 *   2. NUL byte in path -> 400 "Invalid path"
 *   3. Absolute path -> 400 "Absolute paths are not allowed"
 *   4. normalize -> ".." or starts with "../" -> 400 "Path must stay inside the project"
 *   5. normalize -> "." -> 400 "Path must stay inside the project"
 *   6. relative(root, abs) escapes root -> 400 "Path must stay inside the project"
 *   7. graph allow-list membership check -> 404 "File is not in the knowledge graph"
 *   8. statSync fails (file not found) -> 404 "File not found"
 *   9. !stat.isFile() (directory) -> 400 "Path is not a file"
 *  10. stat.size > 1 MiB -> 413 "File is too large to preview"
 *  11. Buffer.includes(0) (binary) -> 415 "Binary files cannot be previewed"
 *  12. symlink realpath escape (T-14-05-03) -> 400 "Path must stay inside the project"
 *
 * Note: actual evaluation order is membership (guard 7) -> statSync (guard 8)
 * -> realpath containment (guard 12) -> isFile (guard 9) -> size (guard 10)
 * -> binary (guard 11). Realpath runs after stat because it requires the file
 * to exist; a graph-listed symlink pointing outside the root still fails guard
 * 12 before any byte is served (T-14-05-03), so the threat-model property
 * "symlink to outside must fail even if graph-listed" holds.
 */
async function handleFileContent(
  c: Context<Env>,
  projectRoot: string,
  uaDir: string,
  _viewerTokenFile: string | undefined,
): Promise<Response> {
  // Guard 1: Missing path param
  const requestedPath = c.req.query('path') ?? ''
  if (!requestedPath) {
    return c.json({ error: ERR_MISSING_PATH }, 400)
  }

  // Guard 2: NUL byte in path
  if (requestedPath.includes('\0')) {
    return c.json({ error: ERR_INVALID_PATH }, 400)
  }

  // Guard 3: Absolute path
  if (isAbsolute(requestedPath)) {
    return c.json({ error: ERR_ABSOLUTE_PATH }, 400)
  }

  // Guards 4+5: normalize and check for traversal
  const normalizedPath = normalize(requestedPath)
  if (
    normalizedPath === '.' ||
    normalizedPath.startsWith(`..${sep}`) ||
    normalizedPath === '..' ||
    isAbsolute(normalizedPath)
  ) {
    return c.json({ error: ERR_OUTSIDE_PROJECT }, 400)
  }

  // Guard 6: relative(root, abs) containment check
  const graphFile = join(uaDir, 'knowledge-graph.json')
  if (!existsSync(graphFile)) {
    return c.json({ error: ERR_NO_GRAPH }, 404)
  }

  const absoluteFile = join(projectRoot, normalizedPath)
  const relativeToRoot = relative(projectRoot, absoluteFile)
  if (
    !relativeToRoot ||
    relativeToRoot.startsWith(`..${sep}`) ||
    relativeToRoot === '..' ||
    isAbsolute(relativeToRoot)
  ) {
    return c.json({ error: ERR_OUTSIDE_PROJECT }, 400)
  }

  // Safe relative path (unix-style, matches upstream safeRelativePath)
  const safeRelativePath = relativeToRoot.split(sep).join('/')

  // Guard 7 will come AFTER guard 12 (symlink check) for existing files.
  // But we need to build the allow-list first to do the membership check.
  // We check graph membership BEFORE stat (per upstream order for non-existent files).
  // However, for symlinks pointing outside, we MUST detect them even when graph-listed.
  // Order of operations:
  //   a) Check graph membership
  //   b) statSync the file (catches not-found)
  //   c) realpath containment (catches symlink escape)
  //   d) isFile check
  //   e) size check
  //   f) binary check

  // Build graph allow-list — served from the mtime-keyed graphSetCache
  // (Phase 14 review fix, Bundle D): the parsed Set is reused across requests
  // and invalidated when the graph file's mtimeMs changes (a fresh /understand
  // run rewrites the file).
  const allowed = graphFilePathSet(graphFile, projectRoot)

  if (!allowed.has(safeRelativePath)) {
    return c.json({ error: ERR_NOT_IN_GRAPH }, 404)
  }

  // Guard 8: stat the file
  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(absoluteFile)
  } catch {
    return c.json({ error: ERR_FILE_NOT_FOUND }, 404)
  }

  // Guard 12: realpath containment for existing files (T-14-05-03 symlink escape)
  try {
    const realFile = realpathSync(absoluteFile)
    const realRoot = realpathSync(projectRoot)
    const realRootWithSep = realRoot.endsWith(sep) ? realRoot : realRoot + sep
    if (realFile !== realRoot && !realFile.startsWith(realRootWithSep)) {
      return c.json({ error: ERR_OUTSIDE_PROJECT }, 400)
    }
  } catch {
    // If realpath fails (e.g. broken symlink), treat as outside
    return c.json({ error: ERR_OUTSIDE_PROJECT }, 400)
  }

  // Guard 9: must be a file
  if (!stat.isFile()) {
    return c.json({ error: ERR_NOT_A_FILE }, 400)
  }

  // Guard 10: size cap (1 MiB)
  if (stat.size > MAX_SOURCE_FILE_BYTES) {
    return c.json({ error: ERR_TOO_LARGE }, 413)
  }

  // Guard 11: binary detection (NUL byte scan)
  const buffer = readFileSync(absoluteFile)
  if (buffer.includes(0)) {
    return c.json({ error: ERR_BINARY }, 415)
  }

  const content = buffer.toString('utf8')
  return c.json({
    path: safeRelativePath,
    language: detectLanguage(relativeToRoot),
    content,
    sizeBytes: buffer.byteLength,
    lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
  }, 200)
}

// ── Register the 6 data endpoints ────────────────────────────────────────────

understandDataRoute.get('/knowledge-graph.json', makeDataHandler('knowledge-graph.json', { isGraph: true }))
understandDataRoute.get('/meta.json', makeDataHandler('meta.json', { missWith404EmptyBody: true }))
understandDataRoute.get('/config.json', makeDataHandler('config.json', { isConfig: true }))
understandDataRoute.get('/domain-graph.json', makeDataHandler('domain-graph.json', { isGraph: true, missWith404EmptyBody: true }))
understandDataRoute.get('/diff-overlay.json', makeDataHandler('diff-overlay.json', { missWith404EmptyBody: true }))
understandDataRoute.get('/file-content.json', makeDataHandler('file-content.json', { isFileContent: true }))

// ── Static viewer router ──────────────────────────────────────────────────────

export const understandViewerRoute = new Hono<Env>()

/**
 * Validate a URL path segment for use in viewer routes.
 *
 * Family segments: lowercase alphanumeric + hyphens.
 * Repo segments: starts with [a-z0-9], followed by [a-z0-9-_.].
 * Rejects '.' and '..' outright — no traversal possible via URL.
 *
 * Mirrors D-13-EXT-11 two-layer regex (reused from viewerToken.ts).
 */
const FAMILY_RE = /^[a-z0-9][a-z0-9-]*$/
const REPO_RE = /^[a-z0-9][a-z0-9\-_.]*$/

function isValidFamily(segment: string): boolean {
  return FAMILY_RE.test(segment)
}

function isValidRepo(segment: string): boolean {
  if (segment === '.' || segment === '..') return false
  if (segment.includes('..')) return false
  return REPO_RE.test(segment)
}

/**
 * Resolve the installed viewer root path for static serving.
 * Uses the test override if set (via viewerDirOverride createApp option).
 */
function getViewerRoot(
  c: Context<Env>,
): string | null {
  const override = c.get('viewerDirOverride') as string | undefined
  if (override) {
    return getInstalledViewerPath(override)
  }
  return getInstalledViewerPath()
}

/**
 * Serve static viewer files from the installed viewer directory.
 * Uses readFileSync + explicit MIME map to bypass serveStatic's CWD-relative
 * constraint — more reliable in test environments where process.cwd() differs
 * from the worktree root (RESEARCH Pitfall 2).
 *
 * MIME map covers all assets the upstream viewer bundle emits.
 */
const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function getMime(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

/**
 * Cache-Control for static viewer files:
 *   - assets/… chunks are content-hashed by Vite → long-lived immutable cache.
 *   - index.html and other shell files must revalidate so a viewer update
 *     (install-understand-viewer + daemon restart) is picked up immediately.
 */
function staticCacheControl(assetPath: string): string {
  const isHashedAsset =
    assetPath.startsWith('assets/') || assetPath.startsWith(`assets${sep}`)
  return isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
}

/**
 * Serve a static asset from the viewer dist directory.
 * Performs explicit realpath containment check (T-14-05-05).
 */
function serveViewerAsset(viewerRoot: string, assetPath: string): Response {
  const candidate = join(viewerRoot, assetPath)

  // Containment check: resolve canonical paths and verify containment
  let realRoot: string
  let realCandidate: string
  try {
    realRoot = realpathSync(viewerRoot)
    realCandidate = realpathSync(candidate)
  } catch {
    return new Response(null, { status: 404 })
  }

  const rootWithSep = realRoot.endsWith(sep) ? realRoot : realRoot + sep
  if (realCandidate !== realRoot && !realCandidate.startsWith(rootWithSep)) {
    return new Response(null, { status: 404 })
  }

  try {
    const st = statSync(realCandidate)
    if (!st.isFile()) return new Response(null, { status: 404 })
    const content = readFileSync(realCandidate)
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': getMime(assetPath),
        'Cache-Control': staticCacheControl(assetPath),
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

// ── Static routes ─────────────────────────────────────────────────────────────

/**
 * Redirect /understand/{family}/{repo} (no trailing slash) to
 * /understand/{family}/{repo}/ preserving the query string (?token= survives).
 *
 * Required because the viewer bundle is built with --base=./ — the index.html
 * must be served at a trailing-slash URL so ./assets/… chunk URLs resolve correctly.
 */
understandViewerRoute.get('/:family/:repo', async (c) => {
  const family = c.req.param('family')
  const repo = c.req.param('repo')

  // Segment validation (T-14-05-05)
  if (!isValidFamily(family) || !isValidRepo(repo)) {
    return new Response(null, { status: 404 })
  }

  // Build redirect URL preserving query string
  const url = new URL(c.req.url)
  url.pathname = `/understand/${family}/${repo}/`
  return Response.redirect(url.toString(), 302)
})

/**
 * Serve /understand/{family}/{repo}/ -> index.html
 * and /understand/{family}/{repo}/assets/… -> static chunks.
 *
 * Static assets carry NO token requirement: the viewer bundle contains zero
 * project data; data flows through the token-gated 6 endpoints only.
 * (T-14-05-07 — D-14-04 ratified)
 */
understandViewerRoute.get('/:family/:repo/*', async (c) => {
  const family = c.req.param('family')
  const repo = c.req.param('repo')

  // Segment validation (T-14-05-05)
  if (!isValidFamily(family) || !isValidRepo(repo)) {
    return new Response(null, { status: 404 })
  }

  // Viewer install check
  const viewerRoot = getViewerRoot(c)
  if (!viewerRoot) {
    return new Response(
      JSON.stringify({
        error:
          'Understand-anything viewer not installed. Run: agentic-dashboard install-understand-viewer',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    )
  }

  // Extract the sub-path after /understand/{family}/{repo}/
  const url = new URL(c.req.url)
  const prefix = `/understand/${family}/${repo}/`
  const rawSubPath = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : ''

  // Serve index.html for root or empty sub-path (SPA entry point)
  if (!rawSubPath) {
    return serveViewerAsset(viewerRoot, 'index.html')
  }

  // Normalize and validate the sub-path (T-14-05-05: traversal prevention)
  const normalizedSubPath = normalize(rawSubPath)
  if (
    normalizedSubPath === '..' ||
    normalizedSubPath.startsWith(`..${sep}`) ||
    isAbsolute(normalizedSubPath)
  ) {
    return new Response(null, { status: 404 })
  }

  return serveViewerAsset(viewerRoot, normalizedSubPath)
})
