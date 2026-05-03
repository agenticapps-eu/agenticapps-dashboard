import { homedir } from 'node:os'
import { join } from 'node:path'

// D-21: hardcode pages.dev for v1; flip to dashboard.agenticapps.eu in Phase 6.
export const PROD_ORIGIN = 'https://agenticapps-dashboard.pages.dev'
export const DEV_ORIGIN = 'http://localhost:5174'
export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 5193
export const CONFIG_DIR = join(homedir(), '.agenticapps', 'dashboard')
export const AUTH_FILE = join(CONFIG_DIR, 'auth.json')
export const REGISTRY_FILE = join(CONFIG_DIR, 'registry.json')
export const PIDFILE = join(CONFIG_DIR, 'agent.pid')
export const SERVER_FILE = join(CONFIG_DIR, 'server.json')
export const TAILSCALE_CIDR_BASE = 0x64400000 >>> 0 // 100.64.0.0 as uint32
export const TAILSCALE_CIDR_PREFIX = 10
export const TOKEN_ROTATION_DAYS = 30
export const SHUTDOWN_TIMEOUT_MS = 5_000
export const TAILSCALE_SUBPROCESS_TIMEOUT_MS = 5_000
export const GIT_SUBPROCESS_TIMEOUT_MS = 5_000
export const CORS_MAX_AGE_SECONDS = 24 * 60 * 60
export const MAX_READ_BYTES = 5 * 1024 * 1024 // 5 MiB cap on /api/projects/:id/read
export const GIT_ALLOWED_CMDS = ['log', 'status', 'diff-stat', 'branch'] as const
export type GitAllowedCmd = (typeof GIT_ALLOWED_CMDS)[number]
