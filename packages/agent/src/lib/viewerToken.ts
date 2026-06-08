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
 * ── CSO item 2 Replay  — exp (8h TTL) + jti nonce in the signed payload; verify
 *                         rejects at/after exp. Bounds replay of a leaked token.
 *
 * TOKEN FORMAT (v2): `v2.<base64url(payloadJson)>.<hex hmac-sha256(secret, payloadB64)>`
 *   payloadJson = {"repoId":"<family/repo>","exp":<ms-epoch>,"jti":"<hex>"}
 *   The HMAC is computed over the base64url payload SEGMENT (the exact transmitted
 *   bytes), so verification needs no canonical re-serialization of the JSON.
 *
 * v1 (`v1.<base64url(repoId)>.<hmac(repoId)>`, deterministic, no expiry) is RETIRED:
 *   verifyViewerToken rejects the v1 prefix. Tokens are re-minted on every coverage
 *   scan, so no persisted v1 token outlives the format change.
 *
 * Design notes:
 *   - Self-describing: verifyViewerToken recovers repoId from the token itself without external
 *     lookup — required because the upstream viewer's data fetches are root-absolute
 *     (/knowledge-graph.json?token=…) and carry no repoId in the path.
 *   - NON-deterministic (v2): exp + jti make each mint unique. Determinism was dropped
 *     deliberately (CSO item 2); the SPA always holds a fresh token from the latest scan.
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

/**
 * Bundle B-2 (review): typed error thrown by mintViewerToken when the repoId
 * does not conform to the D-13-EXT-11 family/repo rules. Verification would
 * uniformly reject such a token, so minting one would only produce a dead
 * viewer link — fail loudly at mint time instead.
 */
export class InvalidRepoIdError extends Error {
  constructor(repoId: string) {
    super(
      `mintViewerToken: repoId does not conform to family/repo slug rules ` +
        `(D-13-EXT-11): ${JSON.stringify(repoId)}`,
    )
    this.name = 'InvalidRepoIdError'
  }
}

// ── Token lifetime (CSO item 2) ──────────────────────────────────────────────

/**
 * Default viewer-token lifetime: 8 hours. Long enough to outlast any single
 * viewing session (the token is frozen into the viewer tab at open time and
 * reused for every data fetch there), short enough to bound replay of a leaked
 * or bookmarked token. The dashboard re-mints a fresh token on each coverage
 * scan, so live links always carry a current token. (User-ratified 2026-06-08.)
 */
export const VIEWER_TOKEN_TTL_MS = 8 * 60 * 60 * 1000

interface MintOpts {
  /** Override "now" (ms epoch) — test seam. Defaults to Date.now(). */
  now?: number
  /** Override the TTL (ms) — test seam. Defaults to VIEWER_TOKEN_TTL_MS. */
  ttlMs?: number
}

interface VerifyOpts {
  /** Override "now" (ms epoch) for the expiry check — test seam. */
  now?: number
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
 * Format (v2): `v2.<base64url(payloadJson)>.<hex hmac-sha256(secret, payloadB64)>`
 *   payloadJson = {"repoId","exp","jti"}
 *
 * exp = now + ttl (default 8h, CSO item 2); jti is a 96-bit random nonce so each
 * mint is unique. The HMAC is taken over the base64url payload segment so verify
 * needs no canonical JSON re-serialization. The HMAC binds the whole payload to
 * the secret, so a token for repo A cannot be used to read repo B's data, and an
 * expired or tampered payload cannot be re-signed without the secret.
 *
 * Secret source (Bundle B-1): resolveSecret — in-memory activeViewerSecret when
 * it was populated from the SAME filePath (avoids per-call file I/O); reads
 * filePath otherwise. verifyViewerToken uses the identical resolution so both
 * sides always agree.
 */
export function mintViewerToken(
  repoId: string,
  filePath: string = VIEWER_TOKEN_FILE,
  opts: MintOpts = {},
): string {
  // Bundle B-2: same validation as verify time — never mint a token that
  // verifyViewerToken would reject (dead viewer links).
  if (!validateRepoId(repoId)) throw new InvalidRepoIdError(repoId)
  const secret = resolveSecret(filePath)
  const now = opts.now ?? Date.now()
  const exp = now + (opts.ttlMs ?? VIEWER_TOKEN_TTL_MS)
  const jti = randomBytes(12).toString('hex')
  const payloadB64 = Buffer.from(JSON.stringify({ repoId, exp, jti })).toString('base64url')
  const mac = createHmac('sha256', secret).update(payloadB64).digest('hex')
  return `v2.${payloadB64}.${mac}`
}

/**
 * Verify a viewer token and return the repoId if valid, or null on ANY failure.
 *
 * Uniform null is intentional — no error details to prevent oracle behavior (T-14-02-01).
 *
 * Verification steps (v2):
 *   1. Parse three segments split on '.'; require prefix 'v2'.
 *   2. Recompute HMAC over the payload SEGMENT and compare (length-guard + timingSafeEqual)
 *      BEFORE trusting any payload bytes — authenticate, then parse.
 *   3. Base64url-decode + JSON-parse the (now integrity-checked) payload.
 *   4. Validate repoId with D-13-EXT-11 two-layer regex+refine semantics.
 *   5. Enforce expiry: exp is mandatory and must be strictly in the future (CSO item 2).
 *   6. Return repoId on success, null on any failure.
 */
export function verifyViewerToken(
  token: string,
  filePath: string = VIEWER_TOKEN_FILE,
  opts: VerifyOpts = {},
): string | null {
  try {
    if (!token) return null

    // Step 1: parse structure
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [prefix, payloadB64, mac] = parts
    if (prefix !== 'v2') return null
    if (!payloadB64 || !mac) return null

    // Step 2: HMAC over the exact transmitted payload segment, constant-time
    // (T-14-02-01). Authenticate before parsing attacker-supplied JSON.
    // Secret source mirrors mintViewerToken (Bundle B-1): in-memory ref when it
    // was populated from this same file — no sync readFileSync on the hot path.
    const secret = resolveSecret(filePath)
    const expected = createHmac('sha256', secret).update(payloadB64).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(mac, 'hex')
    if (expectedBuf.length !== providedBuf.length || expectedBuf.length === 0) return null
    if (!timingSafeEqual(expectedBuf, providedBuf)) return null

    // Step 3: decode + parse the integrity-checked payload
    let payload: unknown
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    } catch {
      return null
    }
    if (typeof payload !== 'object' || payload === null) return null
    const { repoId, exp } = payload as { repoId?: unknown; exp?: unknown }

    // Step 4: validate repoId shape (D-13-EXT-11 two-layer guard)
    if (typeof repoId !== 'string' || !validateRepoId(repoId)) return null

    // Step 5: expiry (CSO item 2) — exp mandatory; reject at/after exp.
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null
    const now = opts.now ?? Date.now()
    if (exp <= now) return null

    // Step 6: valid
    return repoId
  } catch {
    // Uniform null on ANY failure — no error details to prevent oracle behavior
    return null
  }
}
