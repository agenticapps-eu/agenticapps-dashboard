/**
 * Auth lib: token generation, auth.json I/O with permission enforcement, rotation logic.
 */
import { randomBytes } from 'node:crypto'
import {
  lstatSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, basename } from 'node:path'

import { AuthFileSchema, type AuthFile } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from '../version.js'
import {
  AUTH_FILE,
  CONFIG_DIR,
  TOKEN_ROTATION_DAYS,
  VIEWER_TOKEN_FILE,
} from '../constants.js'

import { atomicWriteFile } from './atomicWrite.js'
import { agentError } from './logging.js'
import { parseOrCorrupt } from './stateCorruption.js'
import { rotateViewerSecret } from './viewerToken.js'

export type { AuthFile }

export class InsecurePermissionsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsecurePermissionsError'
  }
}

// In-memory token ref — D-15 race-window pattern
let activeToken = ''

export function getActiveToken(): string {
  return activeToken
}

export function setActiveToken(token: string): void {
  activeToken = token
}

/**
 * Generate a 256-bit token (32 random bytes) as hex, chunked into 8 dash-separated
 * 8-char groups. 71 chars total. URL-safe. Passes Hono bearerAuth regex. (D-13)
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex').match(/.{1,8}/g)!.join('-')
}

/**
 * Assert that the given file has mode 0600 AND is a regular file (not a symlink).
 * Throws InsecurePermissionsError with the EXACT spec remediation message if
 * permissions are looser, or the path is a symlink/directory/etc.
 *
 * Uses lstat (not stat) so a symlink at filePath pointing to an attacker-owned
 * file with mode 0600 is rejected — without lstat, statSync would follow the
 * symlink and report the target's mode. (D-01, INV-02)
 */
export function assertSecurePermissions(filePath: string = AUTH_FILE): void {
  const st = lstatSync(filePath)
  const home = homedir()
  const displayPath = filePath.startsWith(home + '/')
    ? '~' + filePath.slice(home.length)
    : filePath
  const name = basename(filePath)
  if (!st.isFile()) {
    throw new InsecurePermissionsError(
      `${name} is not a regular file (symlinks and special files are rejected); ` +
        `remove ${displayPath} and run \`agentic-dashboard rotate-token\` to regenerate.`,
    )
  }
  const mode = st.mode & 0o777
  if (mode !== 0o600) {
    const octal = mode.toString(8).padStart(3, '0')
    throw new InsecurePermissionsError(
      `${name} has insecure permissions (mode ${octal}); ` +
        `fix with \`chmod 600 ${displayPath}\` or run \`agentic-dashboard rotate-token\` to regenerate.`,
    )
  }
}

function ensureConfigDir(dir: string = CONFIG_DIR): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  try {
    chmodSync(dir, 0o700)
  } catch {
    // fs may not support chmod (e.g. Windows); skip
  }
}

export function readAuthFile(filePath: string = AUTH_FILE): AuthFile {
  const raw = readFileSync(filePath, 'utf8')
  return parseOrCorrupt(AuthFileSchema, JSON.parse(raw), 'auth.json')
}

/**
 * Write auth.json atomically (tmp + rename) at mode 0600. Atomicity prevents
 * concurrent CLI mutations from corrupting the file mid-rotation, and the
 * tmp-then-rename closes the umask/truncation window where a fresh-or-truncated
 * file could briefly sit at the wrong mode (RESEARCH Pitfall 6).
 */
export function writeAuthFile(data: AuthFile, filePath: string = AUTH_FILE): void {
  const validated = AuthFileSchema.parse(data)
  ensureConfigDir(dirname(filePath))
  atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)
}

/**
 * Lazy-init entry point for auth. Creates ~/.agenticapps/dashboard/ (mode 0700)
 * and auth.json (mode 0600) with a fresh token if missing.
 * If existing file has wrong permissions, throws InsecurePermissionsError.
 * Sets the in-memory activeToken ref on success.
 */
export function ensureAuthFile(filePath: string = AUTH_FILE): AuthFile {
  ensureConfigDir(dirname(filePath))
  if (existsSync(filePath)) {
    assertSecurePermissions(filePath)
    const auth = readAuthFile(filePath)
    setActiveToken(auth.token)
    return auth
  }
  const fresh: AuthFile = {
    version: 1,
    token: generateToken(),
    rotatedAt: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
  }
  writeAuthFile(fresh, filePath)
  setActiveToken(fresh.token)
  return fresh
}

/**
 * D-15: write auth.json FIRST with new token, then flip in-memory ref.
 * In-flight requests that captured the old token complete normally.
 * New requests presenting the old token return 401.
 */
export function rotateToken(
  filePath: string = AUTH_FILE,
  viewerTokenFile: string = VIEWER_TOKEN_FILE,
): AuthFile {
  const next: AuthFile = {
    version: 1,
    token: generateToken(),
    rotatedAt: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
  }
  writeAuthFile(next, filePath) // write file FIRST
  setActiveToken(next.token) // then flip in-memory ref
  // D-14-03 rotation: viewer tokens rotate with the bearer token — single rotation
  // story. The viewer path is threaded (not hardcoded) so callers that pass a
  // custom authFile (every test) never touch the real ~/.agenticapps file.
  // Partial-failure ordering: the bearer rotation above has already committed
  // (file + in-memory ref), so a viewer-secret failure must not make rotateToken
  // appear failed — warn and continue.
  try {
    rotateViewerSecret(viewerTokenFile)
  } catch (err) {
    agentError(
      `viewer-secret rotation failed (bearer token rotated successfully): ${(err as Error).message}`,
    )
  }
  return next
}

/**
 * Returns true if the token should be auto-rotated (D-14):
 * - agentVersion mismatch (version upgrade)
 * - age > TOKEN_ROTATION_DAYS
 */
export function shouldAutoRotate(auth: AuthFile, now: Date = new Date()): boolean {
  if (auth.agentVersion !== AGENT_VERSION) return true
  const ageMs = now.getTime() - new Date(auth.rotatedAt).getTime()
  const thresholdMs = TOKEN_ROTATION_DAYS * 24 * 60 * 60 * 1000
  return ageMs > thresholdMs
}
