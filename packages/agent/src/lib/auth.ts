/**
 * Auth lib: token generation, auth.json I/O with permission enforcement, rotation logic.
 *
 * NOTE: AuthFileSchema is defined locally here because packages/shared Plan 01-01
 * runs in parallel. Plan 01-03 (Wave 2) will replace this with:
 *   import { AuthFileSchema, type AuthFile } from '@agenticapps/dashboard-shared'
 */
import { randomBytes } from 'node:crypto'
import {
  statSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
} from 'node:fs'
import { dirname, basename } from 'node:path'
import { z } from 'zod'
import { AGENT_VERSION } from '../version.js'
import { AUTH_FILE, CONFIG_DIR, TOKEN_ROTATION_DAYS } from '../constants.js'

// Local schema — will be replaced by shared import in Plan 01-03
const AuthFileSchema = z.object({
  version: z.literal(1),
  token: z.string().min(1),
  rotatedAt: z.string().datetime(),
  agentVersion: z.string().min(1),
})

export type AuthFile = z.infer<typeof AuthFileSchema>

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
 * Assert that the given file has mode 0600. Throws InsecurePermissionsError
 * with the EXACT spec remediation message if permissions are looser. (D-01, INV-02)
 */
export function assertSecurePermissions(filePath: string = AUTH_FILE): void {
  const mode = statSync(filePath).mode & 0o777
  if (mode !== 0o600) {
    const octal = mode.toString(8).padStart(3, '0')
    const name = basename(filePath)
    throw new InsecurePermissionsError(
      `${name} has insecure permissions (mode ${octal}); ` +
        `fix with \`chmod 600 ${filePath}\` or run \`agentic-dashboard rotate-token\` to regenerate.`,
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
  return AuthFileSchema.parse(JSON.parse(raw))
}

/**
 * Write auth.json. Always sets mode 0600 via both writeFileSync mode option
 * and an explicit chmodSync call to harden existing files (RESEARCH Pitfall 6).
 */
export function writeAuthFile(data: AuthFile, filePath: string = AUTH_FILE): void {
  const validated = AuthFileSchema.parse(data)
  ensureConfigDir(dirname(filePath))
  writeFileSync(filePath, JSON.stringify(validated, null, 2), { mode: 0o600 })
  chmodSync(filePath, 0o600)
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
export function rotateToken(filePath: string = AUTH_FILE): AuthFile {
  const next: AuthFile = {
    version: 1,
    token: generateToken(),
    rotatedAt: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
  }
  writeAuthFile(next, filePath) // write file FIRST
  setActiveToken(next.token) // then flip in-memory ref
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
