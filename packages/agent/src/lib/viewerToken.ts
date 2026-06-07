/**
 * viewerToken.ts — HMAC-bound per-repo scoped viewer tokens (Plan 14-02, D-14-03).
 *
 * SECURITY MODEL:
 * ── T-14-02-01 Spoofing    — HMAC-SHA256 over repoId with 256-bit secret; length-guard
 *                             + timingSafeEqual compare; uniform null on failure.
 * ── T-14-02-02 Tampering   — D-13-EXT-11 two-layer regex+refine applied to the DECODED
 *                             repoId before any FS use.
 * ── T-14-02-04 Disclosure  — 0600 atomic write + assertSecurePermissions refusal on loose modes.
 * ── T-14-02-05 Stale token — rotateViewerSecret hooked into rotateToken (D-14-03 rotation story).
 *
 * TOKEN FORMAT: `v1.<base64url(repoId)>.<hex hmac-sha256(secret, repoId)>`.
 *
 * Design notes:
 *   - Self-describing: verifyViewerToken recovers repoId from the token itself without external
 *     lookup — required because the upstream viewer's data fetches are root-absolute
 *     (/knowledge-graph.json?token=…) and carry no repoId in the path.
 *   - Deterministic: tokens survive daemon restarts (same secret → same token); no per-repo storage.
 *   - The repoId inside the token is not secret (it already appears in the viewer URL path);
 *     the HMAC binds it so a token for repo A cannot read repo B.
 *
 * Import note: this module does NOT import generateToken from auth.ts to avoid a circular
 * dependency (auth.ts will import this module at rotation). Use randomBytes locally instead.
 */
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import {
  lstatSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, basename } from 'node:path'

import { VIEWER_TOKEN_FILE } from '../constants.js'
import { atomicWriteFile } from './atomicWrite.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ViewerTokenFile {
  version: 1
  secret: string  // 32 random bytes, hex-encoded (64 chars)
  rotatedAt: string  // ISO-8601
}

// ── In-memory secret ref (auth.ts activeToken pattern) ───────────────────────

let activeViewerSecret = ''
// Path that populated activeViewerSecret. mint/verify serve from memory ONLY
// when asked about the same file; an explicit different filePath always reads
// that file. This keeps test isolation correct (tests pass tmp paths expecting
// file-based behaviour) while removing the per-request sync readFileSync from
// the production hot path (the daemon ensures the default file at startup).
let activeViewerSecretPath = ''

/**
 * Bundle B-1 (review): single secret-source resolution shared by mintViewerToken
 * and verifyViewerToken so both sides of the HMAC always agree on the secret.
 * Prefers the in-memory ref when it was populated from the SAME file; falls
 * back to reading filePath otherwise.
 */
function resolveSecret(filePath: string): string {
  if (activeViewerSecret && filePath === activeViewerSecretPath) {
    return activeViewerSecret
  }
  return readSecretFile(filePath).secret
}

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Assert mode 0600 on a regular file (not a symlink) — mirrors auth.ts assertSecurePermissions.
 * Uses lstat so a symlink pointing to an attacker-owned file is rejected.
 */
function assertSecurePermissions(filePath: string): void {
  const st = lstatSync(filePath)
  const home = homedir()
  const displayPath = filePath.startsWith(home + '/')
    ? '~' + filePath.slice(home.length)
    : filePath
  const name = basename(filePath)
  if (!st.isFile()) {
    throw new Error(
      `${name} is not a regular file (symlinks and special files are rejected); ` +
        `remove ${displayPath} and re-initialize.`,
    )
  }
  const mode = st.mode & 0o777
  if (mode !== 0o600) {
    const octal = mode.toString(8).padStart(3, '0')
    throw new Error(
      `${name} has insecure permissions (mode ${octal}); ` +
        `fix with \`chmod 600 ${displayPath}\` or rotate the token.`,
    )
  }
}

function ensureConfigDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  try {
    chmodSync(dir, 0o700)
  } catch {
    // fs may not support chmod (e.g. Windows); skip
  }
}

function readSecretFile(filePath: string): ViewerTokenFile {
  const raw = readFileSync(filePath, 'utf8')
  return JSON.parse(raw) as ViewerTokenFile
}

// ── D-13-EXT-11 repoId validation (replicated from shared schema) ─────────────

/**
 * Validate a decoded repoId against the same two-layer semantics as the shared
 * RepoTargetRe regex + refine in packages/shared/src/schemas/gitnexusScan.ts
 * (D-13-EXT-11 hardened pattern — Codex CRITICAL #1).
 *
 * Layer 1 — regex: `family/repo` where family is [a-z0-9-]+ and repo STARTS with [a-z0-9].
 * Layer 2 — refine: no `.` or `..` exact matches; no `..` substrings in repo segment.
 * Layer 3 — family allow-list: only agenticapps, factiv, neuroflash.
 */
const REPO_TARGET_RE = /^[a-z0-9\-]+\/[a-z0-9][a-z0-9\-_.]*$/
const KNOWN_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const

function validateRepoId(repoId: string): boolean {
  if (!REPO_TARGET_RE.test(repoId)) return false
  const slash = repoId.indexOf('/')
  if (slash < 0) return false
  const family = repoId.slice(0, slash)
  const repo = repoId.slice(slash + 1)
  // Layer 2 — refine
  if (repo === '.' || repo === '..') return false
  if (repo.includes('..')) return false
  // Layer 3 — family allow-list
  if (!(KNOWN_FAMILIES as readonly string[]).includes(family)) return false
  return true
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lazy-init entry point for the viewer secret. Creates viewer-token.json (mode 0600)
 * with a fresh 256-bit secret if missing. If the existing file has wrong permissions,
 * throws. Sets the in-memory activeViewerSecret ref on success.
 */
export function ensureViewerSecretFile(filePath: string = VIEWER_TOKEN_FILE): ViewerTokenFile {
  ensureConfigDir(dirname(filePath))
  if (existsSync(filePath)) {
    assertSecurePermissions(filePath)
    const data = readSecretFile(filePath)
    activeViewerSecret = data.secret
    activeViewerSecretPath = filePath
    return data
  }
  const fresh: ViewerTokenFile = {
    version: 1,
    secret: randomBytes(32).toString('hex'),
    rotatedAt: new Date().toISOString(),
  }
  atomicWriteFile(filePath, JSON.stringify(fresh, null, 2), 0o600)
  activeViewerSecret = fresh.secret
  activeViewerSecretPath = filePath
  return fresh
}

/**
 * Regenerate the viewer secret and update the file + in-memory ref.
 * D-14-03 rotation story: called by auth.ts rotateToken() so that bearer token
 * rotation also invalidates all outstanding viewer tokens (single rotation story).
 */
export function rotateViewerSecret(filePath: string = VIEWER_TOKEN_FILE): ViewerTokenFile {
  ensureConfigDir(dirname(filePath))
  const next: ViewerTokenFile = {
    version: 1,
    secret: randomBytes(32).toString('hex'),
    rotatedAt: new Date().toISOString(),
  }
  atomicWriteFile(filePath, JSON.stringify(next, null, 2), 0o600)
  activeViewerSecret = next.secret
  activeViewerSecretPath = filePath
  return next
}

/**
 * Mint a viewer token for a specific repo.
 *
 * Format: `v1.<base64url(repoId)>.<hex hmac-sha256(secret, repoId)>`
 *
 * The repoId is encoded as base64url so it can be safely passed in URLs
 * without encoding issues. The HMAC binds it to the secret, so a token
 * for repo A cannot be used to read repo B's data.
 *
 * Secret source (Bundle B-1): resolveSecret — in-memory activeViewerSecret when
 * it was populated from the SAME filePath (avoids per-call file I/O); reads
 * filePath otherwise. This matches the auth.ts pattern: secrets are loaded once
 * at startup and held in-memory; per-call file reads are unnecessary overhead.
 * verifyViewerToken uses the identical resolution so both sides always agree.
 */
export function mintViewerToken(repoId: string, filePath: string = VIEWER_TOKEN_FILE): string {
  const secret = resolveSecret(filePath)
  const repoB64 = Buffer.from(repoId).toString('base64url')
  const mac = createHmac('sha256', secret).update(repoId).digest('hex')
  return `v1.${repoB64}.${mac}`
}

/**
 * Verify a viewer token and return the repoId if valid, or null on ANY failure.
 *
 * Uniform null is intentional — no error details to prevent oracle behavior (T-14-02-01).
 *
 * Verification steps:
 *   1. Parse three segments split on '.'; require prefix 'v1'.
 *   2. Base64url-decode the repoId segment.
 *   3. Validate the decoded repoId with D-13-EXT-11 two-layer regex+refine semantics.
 *   4. Recompute HMAC and compare with length-guard + timingSafeEqual.
 *   5. Return repoId on success, null on any failure.
 */
export function verifyViewerToken(token: string, filePath: string = VIEWER_TOKEN_FILE): string | null {
  try {
    if (!token) return null

    // Step 1: parse structure
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [prefix, repoB64, mac] = parts
    if (prefix !== 'v1') return null
    if (!repoB64 || !mac) return null

    // Step 2: decode repoId
    let repoId: string
    try {
      repoId = Buffer.from(repoB64, 'base64url').toString('utf8')
    } catch {
      return null
    }
    if (!repoId) return null

    // Step 3: validate decoded repoId (D-13-EXT-11 two-layer guard)
    if (!validateRepoId(repoId)) return null

    // Step 4: HMAC comparison using timingSafeEqual (T-14-02-01 constant-time).
    // Secret source mirrors mintViewerToken (Bundle B-1): in-memory ref when it
    // was populated from this same file — no sync readFileSync on the hot path.
    const secret = resolveSecret(filePath)
    const expected = createHmac('sha256', secret).update(repoId).digest('hex')

    // Length guard before timingSafeEqual: Buffers must be same length to avoid
    // InvalidArgument errors from Node.js's timingSafeEqual.
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(mac, 'hex')
    if (expectedBuf.length !== providedBuf.length || expectedBuf.length === 0) return null
    if (!timingSafeEqual(expectedBuf, providedBuf)) return null

    // Step 5: valid
    return repoId
  } catch {
    // Uniform null on ANY failure — no error details to prevent oracle behavior
    return null
  }
}
