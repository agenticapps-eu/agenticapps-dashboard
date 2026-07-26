# Phase 1: Daemon + Registry + Pairing - Research

**Researched:** 2026-05-03
**Domain:** Hono HTTP server + Node 20 CLI daemon + bearer-token auth + path allow-list + Tailscale integration
**Confidence:** HIGH (Hono middleware, Node APIs verified via npm registry + official docs), MEDIUM (Tailscale JSON shape), LOW (Tailscale MagicDNS field reliability across versions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Daemon lifecycle & CLI UX**
- D-01: `~/.agenticapps/dashboard/` initialized lazily on any subcommand. Dir mode `0700`, files mode `0600`. Refuse to start with exact spec remediation message if perms are looser.
- D-02: Foreground daemon logs to stdout/stderr only. No file mirror in Phase 1. Banner format matches spec verbatim.
- D-03: Empty registry boots happily and prints pair URL. Banner says "Registry: 0 projects".
- D-04: `list` and `status` default to pretty table; `--json` flag for scripting. Both formats go through Zod schema (`RegistryListResponse`, `StatusResponse` from `packages/shared/src/schemas/`).
- D-05: `stop` via (1) token + `POST /api/admin/shutdown`, fallback (2) pidfile + SIGTERM. SIGKILL only with `--force`.
- D-06: Schema-validation errors are NODE_ENV-gated. Dev shows 422 with full Zod issue tree. Prod shows 422 with `{ ok: false, error: 'invalid_request', requestId }`. Always log full Zod error server-side.
- D-07: Pidfile at `~/.agenticapps/dashboard/agent.pid` (mode `0600`). Stale detection via `process.kill(pid, 0)`. Refuse start if alive PID already running.

**Registry CRUD**
- D-08: `register --auto` marker: `.claude/skills/agentic-apps-workflow/SKILL.md` OR `.planning/config.json` (either is sufficient).
- D-09: Per-match Y/n inline. `--yes` accepts all silently; `--dry-run` prints without registering. Exit 0 even if nothing registered.
- D-10: Skip with notice on path collision, exit 0. Slug collision `-2`/`-3` suffix. Idempotent.
- D-11: `register --auto` scan depth = direct children only (depth=1).
- D-12: No auto-tagging in v1. Tags set explicitly via `tag` command.

**Token + rotation**
- D-13: Token = `crypto.randomBytes(32).toString('hex').match(/.{1,8}/g).join('-')`. 71 chars. URL-safe.
- D-14: Rotation triggers: (a) manual `rotate-token`, (b) auto on version upgrade (agentVersion mismatch), (c) auto at 30-day uptime.
- D-15: Mid-rotation race: in-flight requests complete with old token; new requests with old token return 401. Middleware reads in-memory `activeToken` ref captured at request entry.
- D-16: Schema-drift defense (INV-04): every response goes through `Schema.parse()` before send. Parse failure returns 500 `{ ok: false, error: 'schema_drift', requestId }`.

**Networking**
- D-17: `--bind tailscale` when `tailscale ip -4` errors — refuse with exact remediation message, exit 1. No silent fallback.
- D-18: CIDR enforcement (`100.64.0.0/10`) ON by default for tailscale or `0.0.0.0` bind. `--no-enforce-cidr` disables. Loopback bind does not apply CIDR. Rejected returns 403.
- D-19: Pair URL hostname: MagicDNS hostname from `tailscale status --json` via `Self.DNSName` (strip trailing dot); fall back to raw IP if MagicDNS not configured.
- D-20: `--bind 0.0.0.0` prints yellow startup banner warning. CIDR enforcement ON.

**Cross-cutting**
- D-21: Production SPA origin = `https://agenticapps-dashboard.pages.dev`. Dev origin = `http://localhost:5174`. Constants in `packages/agent/src/constants.ts`.
- D-22: No chokidar in Phase 1. Re-read `registry.json` per request.
- D-23: Path allow-list uses `fs.realpath()`. Rejects if realpath escapes allowed roots. Defends against planted symlinks.

### Claude's Discretion
- Exact Hono middleware ordering (logger then cors then bearerAuth then routes then errorHandler suggested).
- Internal module layout under `packages/agent/src/` (suggested: `cli/`, `server/`, `routes/`, `lib/auth.ts`, `lib/registry.ts`, `lib/paths.ts`, `lib/logging.ts`).
- Colorization library (kleur vs picocolors — pick lighter).
- Test layout: vitest unit + Hono `app.request()` in-process + subprocess CLI for 4 mandated TDD cases.
- Port-conflict handling on start (clear EADDRINUSE message, exit 1).
- Whether `--port` / `--bind` exposed as commander flags or env-var only — recommend flags with env fallback.
- Exact log message wording where not pinned by spec.

### Deferred Ideas (OUT OF SCOPE)
- chokidar-based registry/auth watching.
- `--detach` flag and pidfile-based supervision beyond stop fallback — Phase 6.
- `POST /api/projects/{id}/open` (spawning $EDITOR) — Phase 4.
- `/api/projects/{id}/overview`, `/agentlinter`, `/observations/recent`, `/integrations`, `/skills/local`, `/api/skills/global` — Phases 3 to 5.
- IPv6 Tailscale CIDR — IPv4-only in Phase 1.
- Token revocation list / multi-token pairing — Phase 7+.
- Custom domain `dashboard.agenticapps.eu` flip — Phase 6.
- Full schema-drift UX (SPA-side rendering) — Phase 2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAEMON-01 | `agentic-dashboard start` boots Hono server bound to `127.0.0.1:5193` by default | Hono `serve()` + `@hono/node-server` boot pattern (see Hono Boot section) |
| DAEMON-02 | `agentic-dashboard stop` gracefully shuts down | `POST /api/admin/shutdown` then `server.close()` + fallback SIGTERM via pidfile |
| DAEMON-03 | `agentic-dashboard status` reports daemon health | HTTP to `/health` + pidfile check; pretty table + `--json` |
| DAEMON-04 | Daemon refuses to start if `auth.json` permissions not `0600` | `fs.statSync().mode & 0o777` bitmask check |
| DAEMON-05 | Daemon prints one-click pair URL and token at startup | Token format verified URL-safe; banner format from spec |
| DAEMON-06 | `--bind tailscale` auto-detects Tailscale IP; graceful degradation | `execa` spawning `tailscale ip -4` + `tailscale status --json` parsing |
| AUTH-01 | All routes require `Authorization: Bearer <token>`; missing/invalid returns 401 | `bearerAuth({ verifyToken })` with in-memory ref |
| AUTH-02 | CORS allows only prod + dev origins; others get preflight rejected | `cors({ origin: [...] })` with exact 2-origin array |
| AUTH-03 | `rotate-token` invalidates current token immediately | Write `auth.json` first, flip in-memory ref atomically |
| AUTH-04 | Token auto-rotates after 30 days uptime | `(now - rotatedAt) > 30 days` check on `start` |
| AUTH-05 | Pair URL: SPA localStorage + redirect (daemon side = print URL) | Daemon prints URL; SPA storage is Phase 2 scope |
| REG-01 | `register <path>` adds project; collisions get `-2`/`-3` suffix | slug generation + registry CRUD |
| REG-02 | `register --auto <parent-dir>` scans for markers, confirms each match | depth=1 scan + D-08 markers |
| REG-03 | `unregister <id|path>` removes project | registry CRUD |
| REG-04 | `list` reports registered projects + status, marks unreachable roots | fs.access() check on root + pretty table + `--json` |
| REG-05 | `rename <id> <new-name>` and `tag <id> <tag...>` mutate registry only | registry CRUD |
| API-01 | `GET /health` returns `{ ok, daemonVersion, registryCount, paired }` | `HealthResponseSchemaV1` extends existing schema |
| API-02 | `GET /api/projects/{id}/read?path=...` rejects traversal paths; 422 | `fs.realpath()` allow-list check |
| API-03 | `GET /api/projects/{id}/git?cmd=...` only allows listed git subcommands | allow-list array check before `execa` spawn |
| INV-02 | Registry, auth, env files enforce mode `0600`; daemon refuses if looser | `fs.statSync().mode & 0o777` verified on macOS |
| INV-05 | No native dependencies in `packages/agent` | verified: all deps (hono, execa, commander, picocolors) are pure-JS |
</phase_requirements>

---

## Summary

Phase 1 transforms the placeholder commander stub into a real Node 20 daemon with a Hono HTTP server, a JSON-file project registry, bearer-token auth backed by a `0600` file, and Tailscale-aware network binding. The research confirms all required APIs exist in the Node 20 LTS standard library or in the soon-to-be-added pnpm catalog dependencies.

The most important finding is a **version compatibility issue**: the pnpm catalog specifies `zod: ^3.24.0` but `@hono/zod-validator@0.7.x` requires `^3.25.0`. The planner must update the catalog to `zod: ^3.25.0` as a Wave 0 task — this resolves to 3.25.76 (current) and is backward-compatible with existing schemas. Alternative: use `@hono/zod-validator@0.6.0` (supports zod `^3.19.1`), but 0.7.6 is preferred.

The second important finding is that `@hono/node-server` exposes `c.env.incoming.socket.remoteAddress` for client IP checking (D-18 CIDR enforcement). This is the only reliable way to get the raw IP without `X-Forwarded-For` header, which would be spoofable.

**Primary recommendation:** Use Hono 4.12.16 + @hono/node-server 2.0.1 + @hono/zod-validator 0.7.6 (after catalog bump to zod ^3.25.0) + execa 9.6.1 + picocolors 1.1.1. All pure-JS, no native deps, ESM-native.

---

## Project Constraints (from CLAUDE.md)

- **Read-only on project filesystems.** No daemon route writes to a registered project's files.
- **Path allow-list per project.** `/api/projects/{id}/read` only resolves under `<root>/.planning` or `<root>/.claude`. Reject `..`, absolute paths, or realpaths outside the allow-list.
- **Daemon writes confined to `~/.agenticapps/dashboard/`.** Registry, auth, env files mode `0600`; daemon refuses to start if permissions are looser.
- **No native dependencies in `packages/agent`.** No `keytar`, no FFI.
- **Bearer-token auth on every route.** CORS locked to `https://agenticapps-dashboard.pages.dev` (prod) and `http://localhost:5174` (dev).
- **Optional integrations stay optional.** Dashboard must function fully without Sentry, Linear, Infisical.
- **No Cloudflare Workers / Pages Functions in v1.** SPA is pure static.
- **TDD applies to every daemon route and CLI command.** The 4 mandated TDD cases from spec line 616 are non-negotiable.
- **Two-stage review** (gstack `/review` + `superpowers:requesting-code-review`) before merging Phase 1 PR.
- **`engines.node >= 20`**: every Node API used must be Node 20 LTS available.
- **ESM-only**: agent package is `"type": "module"`, no CJS interop.
- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes` all on.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | 4.12.16 | HTTP server + middleware | Ultralight, Web-standard Request/Response, runs on Node 20 via adapter |
| @hono/node-server | 2.0.1 | Node.js HTTP adapter for Hono | Official adapter; exposes `c.env.incoming` for raw socket access |
| @hono/zod-validator | 0.7.6 | Request validation middleware | Official Hono x Zod integration; auto-generates 422 on validation fail |
| execa | 9.6.1 | Subprocess spawning (git + tailscale) | Pure-ESM, no shell injection by default (uses argv array), Node >= 18.19 |
| commander | 14.0.3 | CLI command parsing | Already installed; existing stub uses it |
| zod | ^3.25.0 | Schema validation (shared + agent) | Already in catalog; bump from 3.24 to 3.25 required for @hono/zod-validator 0.7.x |
| picocolors | 1.1.1 | Terminal color for banner/warnings | 6.4KB unpacked vs kleur 20KB; has ESM export map |

[VERIFIED: npm registry — all versions confirmed 2026-05-03]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | Token generation via randomBytes | Token format generation (D-13); `crypto.randomUUID()` for requestIds |
| node:fs/promises | built-in | Registry + auth file I/O | All async file operations |
| node:fs | built-in | Sync stat for permission check | `statSync().mode & 0o777` at startup |
| node:path | built-in | Path resolution for allow-list | `path.resolve()` + `path.normalize()` |
| node:child_process | built-in | Pidfile process liveness check | `process.kill(pid, 0)` for stale pidfile detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| picocolors | kleur | kleur has richer chaining API but 3x larger; picocolors sufficient for banner/warn |
| execa 9 | node:child_process directly | execa provides promise API, no shell injection risk, worth the dep |
| @hono/zod-validator | manual zValidator inline | Manual is more flexible; @hono/zod-validator is the blessed integration |
| fs.realpath async | fs.realpathSync | Async preferred for route handlers; sync acceptable for startup checks |

### Installation

Add to `packages/agent/package.json` dependencies (not devDependencies):

```bash
# From repo root
pnpm --filter @agenticapps/dashboard-agent add hono @hono/node-server @hono/zod-validator execa picocolors
```

Update `pnpm-workspace.yaml` catalog section:
```yaml
zod: ^3.25.0   # was ^3.24.0 — required for @hono/zod-validator 0.7.x
```

Add to `noExternal` in `packages/agent/tsup.config.ts`:
```typescript
noExternal: [
  '@agenticapps/dashboard-shared', 'commander', 'zod',
  'hono', '@hono/node-server', '@hono/zod-validator', 'execa', 'picocolors',
],
```

**Version verification:**
- hono@4.12.16 — confirmed latest stable (dist-tags.latest) [VERIFIED: npm registry 2026-05-03]
- @hono/node-server@2.0.1 — confirmed latest stable [VERIFIED: npm registry 2026-05-03]
- @hono/zod-validator@0.7.6 — confirmed latest stable [VERIFIED: npm registry 2026-05-03]
- execa@9.6.1 — confirmed latest stable, ESM-only, Node >= 18.19 [VERIFIED: npm registry 2026-05-03]
- picocolors@1.1.1 — confirmed latest stable [VERIFIED: npm registry 2026-05-03]

---

## Architecture Patterns

### Recommended Project Structure

```
packages/agent/src/
├── cli.ts                 # existing entry — extend with new commands
├── version.ts             # existing AGENT_VERSION re-export
├── constants.ts           # NEW: PROD_ORIGIN, DEV_ORIGIN, DEFAULT_PORT, CONFIG_DIR
├── cli/
│   ├── start.ts           # start command action
│   ├── stop.ts            # stop command action
│   ├── status.ts          # status command action
│   ├── register.ts        # register / register --auto actions
│   ├── registry.ts        # unregister / list / rename / tag actions
│   └── token.ts           # rotate-token + pair command actions
├── server/
│   ├── app.ts             # Hono app factory: middleware + route mounting
│   ├── boot.ts            # serve() wrapper, banner printer, pidfile manager
│   └── __tests__/         # in-process route tests (app.request pattern)
│       ├── auth.test.ts   # MANDATORY TDD: token rotation, CORS reject, bearer reject
│       ├── paths.test.ts  # MANDATORY TDD: path allow-list rejects ..
│       └── health.test.ts # GET /health contract test
├── routes/
│   ├── health.ts          # GET /health
│   ├── admin.ts           # POST /api/admin/shutdown
│   ├── registry.ts        # GET /api/registry, POST /api/registry/register, POST /api/registry/unregister
│   ├── auth.ts            # POST /api/auth/rotate
│   ├── read.ts            # GET /api/projects/:id/read
│   └── git.ts             # GET /api/projects/:id/git
└── lib/
    ├── auth.ts            # token generation, auth.json read/write, rotation logic
    ├── registry.ts        # registry.json read/write, slug generation, CRUD
    ├── paths.ts           # allow-list checker with fs.realpath
    ├── logging.ts         # [agent] prefix logger, requestId generator
    └── tailscale.ts       # tailscale ip -4 + status --json parsing

packages/shared/src/schemas/
├── health.ts              # extend HealthResponseSchema (add daemonVersion, registryCount, paired)
├── registry.ts            # NEW: RegistryEntry, RegistryFile, RegistryListResponse, StatusResponse
├── auth.ts                # NEW: AuthFile schema
├── read.ts                # NEW: ReadResponse schema
├── git.ts                 # NEW: GitResponse schema
└── errors.ts              # NEW: ErrorResponseSchema (ok: false, error, requestId, issues?)
```

### Pattern 1: Hono App Factory with Middleware Ordering

**What:** Create the Hono app in a factory function to enable clean in-process testing. Middleware order is critical: logger must precede cors, which must precede bearerAuth.

**When to use:** Main server entry point and all route tests.

```typescript
// Source: https://hono.dev/docs/getting-started/nodejs
//         https://hono.dev/docs/middleware/builtin/bearer-auth
//         https://hono.dev/docs/middleware/builtin/cors
import { Hono } from 'hono'
import { serve, type HttpBindings } from '@hono/node-server'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono'
import { PROD_ORIGIN, DEV_ORIGIN } from '../constants.js'

type Variables = { requestId: string }
type Env = { Bindings: HttpBindings; Variables: Variables }

export function createApp(getActiveToken: () => string): Hono<Env> {
  const app = new Hono<Env>()

  // 1. Logger (must be first to capture all requests)
  app.use(logger())

  // 2. requestId injection
  app.use(async (c, next) => {
    c.set('requestId', crypto.randomUUID())
    await next()
  })

  // 3. CORS must precede bearerAuth so OPTIONS preflight succeeds without token
  app.use(cors({
    origin: [PROD_ORIGIN, DEV_ORIGIN],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: false,
  }))

  // 4. Bearer auth — all routes below require valid token
  app.use(bearerAuth({
    verifyToken: async (token) => token === getActiveToken(),
  }))

  // 5. Route mounts (app.route() calls here)

  // 6. Error handler (must be last)
  app.onError((err, c) => {
    const requestId = c.get('requestId') ?? 'unknown'
    if (err instanceof HTTPException) {
      return c.json({ ok: false, error: err.message, requestId }, err.status)
    }
    console.error(`[agent] unhandled error requestId=${requestId}`, err)
    return c.json({ ok: false, error: 'internal_server_error', requestId }, 500)
  })

  return app
}
```

### Pattern 2: serve() Boot and Graceful Shutdown

**What:** `serve()` from `@hono/node-server` returns a `ServerType` (Node http.Server). Store the reference for `server.close()`.

**When to use:** `start` command and `POST /api/admin/shutdown` handler.

```typescript
// Source: https://hono.dev/docs/getting-started/nodejs
//         @hono/node-server@2.0.1 types (ServerType, ServeOptions)
import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'

export function bootDaemon(
  app: ReturnType<typeof createApp>,
  host: string,
  port: number,
): ServerType {
  const server = serve(
    { fetch: app.fetch, hostname: host, port },
    (_info) => {
      // listeningListener: called once server is ready
      printBanner(host, port)
      writePidfile()
    }
  )

  process.on('SIGTERM', () => gracefulShutdown(server))
  process.on('SIGINT', () => gracefulShutdown(server))
  return server
}

function gracefulShutdown(server: ServerType): void {
  // server.close() stops accepting new connections; in-flight complete
  // Add 5s hard timeout to handle stuck keep-alive connections
  const killer = setTimeout(() => process.exit(0), 5000)
  server.close(() => {
    clearTimeout(killer)
    removePidfile()
    process.exit(0)
  })
}
```

### Pattern 3: Bearer Auth with In-Memory Token Ref (D-15 Race Window)

**What:** `bearerAuth({ verifyToken })` reads from a module-level ref, not re-reading auth.json per request. `rotate-token` writes auth.json first, then flips the in-memory ref.

**When to use:** Middleware setup in `app.ts` and `lib/auth.ts`.

```typescript
// Source: https://hono.dev/docs/middleware/builtin/bearer-auth
// verifyToken callback is called at request entry time.
// In-flight requests captured the old token value before the flip and complete normally.
// New requests presenting the old token after the flip receive 401.

let activeToken = ''   // initialized on startup from auth.json

export function setActiveToken(token: string): void {
  activeToken = token
}

export function getActiveToken(): string {
  return activeToken
}

// In app factory:
// app.use(bearerAuth({ verifyToken: async (token) => token === getActiveToken() }))
```

**Important:** Hono's bearerAuth validates the token string against the regex `[A-Za-z0-9._~+/-]+=*` before calling `verifyToken`. The 71-char hex-dash format passes this regex. [VERIFIED: manual test 2026-05-03]

### Pattern 4: CORS Pinned to Two Origins

**What:** Pass an array of exactly two allowed origins. Requests from other origins receive no CORS headers (preflight returns no `Access-Control-Allow-Origin`), causing browser CORS rejection.

**When to use:** App factory, after logger, before bearerAuth.

```typescript
// Source: https://hono.dev/docs/middleware/builtin/cors
// Non-matching origins get no Allow-Origin header on preflight or actual requests.
// Preflight OPTIONS requests are handled automatically.
app.use(cors({
  origin: ['https://agenticapps-dashboard.pages.dev', 'http://localhost:5174'],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
  credentials: false,  // token is in header, not cookie
}))
```

### Pattern 5: Path Allow-list with fs.realpath (D-23)

**What:** Resolve incoming path against project root, then realpath-check against allowed roots. Defends against `..` traversal and planted symlinks.

**When to use:** `GET /api/projects/:id/read` handler.

```typescript
// Source: https://nodejs.org/api/fs.html#fsrealpathpath-options-callback
// [VERIFIED: manual test — symlink escape detected correctly 2026-05-03]
import { realpath } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'

const ALLOWED_SUBDIRS = ['.planning', '.claude'] as const

export async function resolveAllowed(
  projectRoot: string,
  relativePath: string,
): Promise<string> {
  if (isAbsolute(relativePath)) {
    throw new PathViolation('absolute path not allowed')
  }

  // Pre-check: reject any '..' path component before realpath
  const parts = relativePath.split('/')
  if (parts.some(p => p === '..')) {
    throw new PathViolation('path traversal not allowed')
  }

  const allowedRoots = ALLOWED_SUBDIRS.map(d => resolve(projectRoot, d))
  const candidate = resolve(projectRoot, relativePath)

  // realpath resolves symlinks — catches planted symlinks escaping allowed roots
  let real: string
  try {
    real = await realpath(candidate)
  } catch {
    throw new PathViolation('path does not exist or is not accessible')
  }

  const isAllowed = allowedRoots.some(
    root => real === root || real.startsWith(root + '/')
  )
  if (!isAllowed) {
    throw new PathViolation('path outside allowed directories')
  }

  return real
}
```

**Bypass attempts confirmed caught [VERIFIED: manual test 2026-05-03]:**
- `..` component: caught by split-check before realpath
- Planted symlink (`.planning/escaped -> ../../etc/passwd`): caught by realpath check
- Absolute path: caught by `isAbsolute()` check
- Null bytes and URL-encoded separators: Node's realpath throws on null bytes; query params are decoded by Hono before reaching the handler, and Node uses only `/` as path separator on macOS/Linux.

### Pattern 6: Permission Check (D-01, INV-02)

**What:** `fs.statSync().mode & 0o777` bitmask on macOS/Linux.

**When to use:** Startup check in `lib/auth.ts` and lazy-init of config dir.

```typescript
// Source: Node.js fs docs
// [VERIFIED: manual test on macOS — bitmask correctly reads 0600 vs 0644 2026-05-03]
import { statSync, writeFileSync } from 'node:fs'

export function assertSecurePermissions(filePath: string): void {
  const mode = statSync(filePath).mode & 0o777
  if (mode !== 0o600) {
    const octal = mode.toString(8).padStart(3, '0')
    const name = filePath.split('/').pop()!
    throw new InsecurePermissionsError(
      `${name} has insecure permissions (mode ${octal}); ` +
      `fix with \`chmod 600 ${filePath}\` or run \`agentic-dashboard rotate-token\` to regenerate.`
    )
  }
}

export function writeSecure(filePath: string, content: string): void {
  writeFileSync(filePath, content, { mode: 0o600 })
}
```

**macOS/Linux parity:** `mode & 0o777` works identically on both. Windows is out of scope for v1.

### Pattern 7: CGNAT CIDR Check (D-18)

**What:** Fast in-memory IPv4 prefix matching for `100.64.0.0/10`, no dependencies. Client IP is read from the raw TCP socket, not from `X-Forwarded-For`.

**When to use:** Middleware after bearerAuth for Tailscale/0.0.0.0 binds.

```typescript
// [VERIFIED: manual test — boundary values correct 2026-05-03]
// c.env.incoming.socket.remoteAddress = raw TCP socket IP (HttpBindings pattern)
// Source: @hono/node-server types + https://hono.dev/docs/getting-started/nodejs

export function isTailscaleCIDR(ip: string): boolean {
  // Strip IPv6-mapped IPv4 prefix (::ffff:100.x.y.z on dual-stack Linux sockets)
  const clean = ip.replace(/^::ffff:/, '')
  const parts = clean.split('.').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return false
  const num = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  const base = ((100 << 24) | (64 << 16)) >>> 0   // 100.64.0.0
  const mask = (~((1 << (32 - 10)) - 1)) >>> 0     // /10 mask
  return (num & mask) === (base & mask)
}

// In CIDR middleware:
// const remoteAddress = c.env.incoming.socket.remoteAddress ?? ''
// if (!isTailscaleCIDR(remoteAddress)) return c.json({...}, 403)
```

**Boundary check confirmed [VERIFIED: manual test 2026-05-03]:**
- `100.64.0.1` returns true (in range)
- `100.127.255.255` returns true (in range)
- `100.128.0.0` returns false (just outside /10)
- `127.0.0.1` returns false
- `192.168.1.1` returns false

### Pattern 8: Token Generation (D-13)

```typescript
// Source: https://nodejs.org/api/crypto.html#cryptorandombytessize-callback
// [VERIFIED: 71-char output, URL-safe (encodeURIComponent produces identical string) 2026-05-03]
import { randomBytes } from 'node:crypto'

export function generateToken(): string {
  // 32 bytes = 256 bits entropy; hex-encoded = 64 chars; chunked into 8 groups of 8 with dashes = 71 chars
  // All characters are 0-9 a-f and '-' — passes Hono bearerAuth regex without encoding
  return randomBytes(32).toString('hex').match(/.{1,8}/g)!.join('-')
}
```

### Pattern 9: Tailscale Integration (D-17, D-19)

**What:** Spawn `tailscale ip -4` for IP, `tailscale status --json` for MagicDNS hostname. Use `execa` for structured subprocess execution without shell interpretation.

**When to use:** `--bind tailscale` path in `start` command.

```typescript
// execa uses argv array, not shell — no injection surface
// Source: execa@9 docs + Tailscale CLI docs + community JSON examples
import { execa } from 'execa'

export async function getTailscaleIP(): Promise<string> {
  // Throws ENOENT if binary absent; throws on non-zero exit if daemon not running
  const { stdout } = await execa('tailscale', ['ip', '-4'])
  const ip = stdout.trim()
  if (!ip) throw new Error('tailscale ip -4 returned empty output')
  return ip
}

export async function getTailscaleHostname(fallbackIp: string): Promise<string> {
  try {
    const { stdout } = await execa('tailscale', ['status', '--json'])
    const status = JSON.parse(stdout) as {
      Self?: { DNSName?: string; TailscaleIPs?: string[] }
    }
    // DNSName is FQDN with trailing dot (e.g. "devbox.tail-abc.ts.net.")
    const dnsName = status.Self?.DNSName?.replace(/\.$/, '')
    if (dnsName) return dnsName
  } catch {
    // Fall through to IP fallback (D-19)
  }
  return fallbackIp
}
```

**Tailscale absent vs not-running:**
- Binary absent: `execa` throws `{ code: 'ENOENT' }`. Catch and emit "Tailscale not detected" error.
- Binary present but daemon not running: non-zero exit code + stderr message. `execa` throws by default. Catch and emit same error.
- Both cases result in D-17 behavior: refuse with exact remediation message, exit 1.

### Pattern 10: Stale Pidfile Detection (D-07)

```typescript
// [VERIFIED: manual test on macOS 2026-05-03]
// ESRCH = no such process (stale pidfile — safe to start)
// EPERM = process exists but owned by different user (refuse: still alive)
// No error = process is alive (refuse: already running)

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false   // process does not exist
    if (code === 'EPERM') return true    // process exists, can't signal it
    return false
  }
}
```

### Pattern 11: In-Process Route Tests (app.request pattern)

```typescript
// Source: https://hono.dev/docs/guides/testing [VERIFIED: 2026-05-03]
// app.request() is the preferred pattern for fast in-process testing.
// Does NOT require a running server.

import { describe, it, expect } from 'vitest'
import { createApp, getActiveToken, setActiveToken } from '../server/app.js'

describe('CORS rejects wrong origin', () => {
  it('returns no CORS headers for unknown origin', async () => {
    setActiveToken('test-token')
    const app = createApp(getActiveToken)
    const res = await app.request('http://localhost:5193/health', {
      headers: new Headers({
        'Authorization': 'Bearer test-token',
        'Origin': 'https://evil.com',
      }),
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('bearer auth rejects invalid token', () => {
  it('returns 401 for wrong token', async () => {
    setActiveToken('correct-token')
    const app = createApp(getActiveToken)
    const res = await app.request('/health', {
      headers: new Headers({ 'Authorization': 'Bearer wrong-token' }),
    })
    expect(res.status).toBe(401)
  })
})
```

### Pattern 12: Commander Subcommand Extension

**What:** Add new commands to existing `program` instance in `cli.ts`.

**When to use:** All new CLI commands added in Phase 1.

```typescript
// Source: commander@14.0.3 docs
// [VERIFIED: variadic arguments + optional argument + option patterns work 2026-05-03]
program
  .command('register')
  .description('Add a project root')
  .argument('[path]', 'Project root directory')
  .option('--auto <parentDir>', 'Scan parent for AgenticApps projects')
  .option('--yes', 'Accept all matches without confirmation')
  .option('--dry-run', 'Print matches without registering')
  .action(async (path: string | undefined, opts) => {
    await import('./cli/register.js').then(m => m.runRegister(path, opts))
  })

program
  .command('tag')
  .description('Set tags on a registered project')
  .argument('<id>', 'Project ID')
  .argument('[tags...]', 'Tags to set (replaces existing tags)')
  .action(async (id: string, tags: string[]) => {
    await import('./cli/registry.js').then(m => m.runTag(id, tags))
  })
```

**Important D-05 implementation detail for `stop`:** The `stop` command needs to know the bound URL to call `POST /api/admin/shutdown`. This requires writing a `server.json` (mode `0600`) on daemon start containing `{ bindUrl, pid }`. See Open Questions #3.

### Anti-Patterns to Avoid

- **Registering bearerAuth before cors:** OPTIONS preflight requests carry no Authorization header. If bearerAuth runs first, all preflight requests fail with 401, breaking CORS. Always register `cors()` before `bearerAuth()`.
- **Using `token: '...'` option in bearerAuth instead of `verifyToken`:** The `token` option accepts a static string. For D-15 (mid-rotation race window), `verifyToken` is required — it reads from the in-memory ref at call time.
- **Using `X-Forwarded-For` for CIDR check:** Easily spoofed. Use `c.env.incoming.socket.remoteAddress` which is the actual TCP socket peer address.
- **Using `fs.realpath.native` instead of `fs.realpath`:** On macOS APFS (case-insensitive), the native implementation may behave unexpectedly. The JS implementation is consistent.
- **Passing unsanitized user input through shell:** Always use `execa('git', ['log', ...args])` with a fixed argv array, never `execa('sh', ['-c', userInput])`. execa's default behavior rejects shell metacharacters.
- **Re-reading `auth.json` on every request:** I/O overhead and TOCTOU race. Read once at startup; update in-memory ref on rotation.
- **Writing registry.json without setting mode:** `writeFileSync(path, data, { mode: 0o600 })` sets the mode only on file creation. If the file already exists, use `chmodSync(path, 0o600)` after write.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP server + routing | Custom http.createServer + manual routing | `hono` + `@hono/node-server` | Hono handles preflight, method matching, error bubbling, type-safe context |
| Request body validation | Manual JSON.parse + if-checks | `@hono/zod-validator` with `zValidator` | Generates typed validated data + automatic 422 with error details |
| CORS preflight | Manual OPTIONS handler | `hono/cors` middleware | Handles preflight automatically; varies the response header correctly |
| Bearer token extraction | Manual `Authorization` header parsing | `hono/bearer-auth` | Handles malformed headers, wrong scheme, missing header — all edge cases |
| Git subprocess | Node child_process with shell | `execa` with argv array | No shell injection surface; structured stdout/stderr; timeout support |
| Terminal colors | ANSI escape sequences inline | `picocolors` | Handles `NO_COLOR`, Windows, CI environments automatically |
| CGNAT CIDR check | npm cidr library | Inline bitwise (Pattern 7 above) | 7 lines, no dependency, zero overhead, covers the one range we need |

**Key insight:** The HTTP layer has dozens of edge cases (malformed headers, OPTIONS requests, vary headers, connection handling). Hono handles all of these correctly.

---

## Schema Changes Required

### HealthResponseSchema: Extension Strategy

The existing schema in `packages/shared/src/schemas/health.ts` must be extended. **Recommended approach: extend in place** (not rename to V0 + create V1). The Phase 0 `--version --json` command only uses the existing fields and remains backward-compatible when new fields are optional.

```typescript
// packages/shared/src/schemas/health.ts (updated for Phase 1)
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),              // kept from Phase 0
  message: z.string().optional(),   // kept from Phase 0
  // New in Phase 1 (optional for backward compat with Phase 0 --version --json):
  daemonVersion: z.string().optional(),
  registryCount: z.number().int().nonnegative().optional(),
  paired: z.boolean().optional(),
})
```

### New Schemas Required in packages/shared/src/schemas/

```typescript
// auth.ts
const AuthFileSchema = z.object({
  version: z.literal(1),
  token: z.string(),
  rotatedAt: z.string().datetime(),
  agentVersion: z.string(),
})

// registry.ts
const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  root: z.string(),
  client: z.string().nullable(),
  addedAt: z.string().datetime(),
  tags: z.array(z.string()),
})
const RegistryFileSchema = z.object({
  version: z.literal(1),
  projects: z.array(RegistryEntrySchema),
})
const RegistryListItemSchema = RegistryEntrySchema.extend({
  status: z.object({
    reachable: z.boolean(),
    currentPhase: z.string().nullable(),
    lastCommitAt: z.string().datetime().nullable(),
  }),
})
const RegistryListResponseSchema = z.array(RegistryListItemSchema)

// errors.ts (used by every error path — 401, 403, 422, 500, schema_drift)
const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  requestId: z.string(),
  issues: z.array(z.object({
    path: z.array(z.string()),
    message: z.string(),
  })).optional(),
})

// read.ts
const ReadResponseSchema = z.object({
  content: z.string(),
  mtime: z.string().datetime(),
  sha256: z.string(),
})

// git.ts
const GitResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
})
```

---

## Common Pitfalls

### Pitfall 1: CORS Middleware Before Bearer Auth (Ordering Critical)
**What goes wrong:** All OPTIONS preflight requests return 401.
**Why it happens:** Preflight requests don't carry `Authorization` headers — they're checking if the browser should allow the actual request.
**How to avoid:** Always register `cors()` before `bearerAuth()` in the middleware chain.
**Warning signs:** CORS errors in browser console even though the token is correct.

### Pitfall 2: Zod Version Mismatch with @hono/zod-validator
**What goes wrong:** `@hono/zod-validator@0.7.x` peer-requires `zod ^3.25.0` but the pnpm catalog has `zod: ^3.24.0`. pnpm may install a duplicate zod instance, causing runtime failures where `ZodError instanceof ZodError` is false across instances.
**Why it happens:** pnpm catalog pinned to 3.24.0 before zod 3.25 was released.
**How to avoid:** Update catalog to `zod: ^3.25.0` as a Wave 0 task before installing @hono/zod-validator.
**Warning signs:** `zValidator` errors not caught by `app.onError`, type errors on Zod imports.

[VERIFIED: npm registry 2026-05-03 — @hono/zod-validator@0.7.6 peerDependencies: `{ zod: "^3.25.0 || ^4.0.0" }`]

### Pitfall 3: IPv6-Mapped IPv4 in remoteAddress
**What goes wrong:** On Linux with dual-stack sockets, `c.env.incoming.socket.remoteAddress` returns `::ffff:100.64.x.y` instead of `100.64.x.y`, failing the CIDR check.
**Why it happens:** Node's http.Server uses IPv6 dual-stack by default on Linux.
**How to avoid:** Strip the `::ffff:` prefix before passing to `isTailscaleCIDR()`. Pattern 7 already includes this.
**Warning signs:** CIDR middleware returns 403 for valid Tailscale clients on Linux.

### Pitfall 4: tsup noExternal Missing New Deps
**What goes wrong:** `hono`, `execa`, `picocolors` are not bundled into `dist/cli.js`, causing runtime `MODULE_NOT_FOUND` errors when installed via `npx`.
**Why it happens:** tsup's `noExternal` list must be updated when new runtime deps are added.
**How to avoid:** Add all runtime dependencies to `noExternal` in `tsup.config.ts`.
**Warning signs:** `npx @agenticapps/dashboard-agent start` fails with `Cannot find package 'hono'`.

### Pitfall 5: Trailing Dot in Tailscale DNSName
**What goes wrong:** `tailscale status --json` returns `Self.DNSName` with a trailing dot (FQDN format, e.g. `devbox.tail-abc.ts.net.`). Using this directly in the pair URL creates an invalid hostname.
**Why it happens:** FQDN convention in DNS always ends with a dot.
**How to avoid:** `dnsName.replace(/\.$/, '')` before constructing the pair URL.
**Warning signs:** Pair URL fails to load in browser due to malformed hostname.

[CITED: alexwlchan.net/notes/2026/map-of-tailscale-ips/ — trailing dot confirmed in real output]

### Pitfall 6: server.close() Hanging on Keep-Alive Connections
**What goes wrong:** `server.close()` stops accepting new connections but the callback fires only after ALL existing connections are closed — which may never happen with HTTP keep-alive.
**Why it happens:** HTTP keep-alive connections stay open between requests.
**How to avoid:** Add a 5-second hard timeout: if `server.close()` callback hasn't fired after 5s, call `process.exit(0)` anyway. See Pattern 2.
**Warning signs:** `stop` command hangs indefinitely.

### Pitfall 7: Commander --auto / [path] Argument Conflict
**What goes wrong:** `register --auto ~/Sourcecode` errors with "missing path argument".
**Why it happens:** If both the positional `[path]` argument and `--auto <parentDir>` option are defined, commander may not disambiguate correctly.
**How to avoid:** Define `register` with optional `[path]` argument and `--auto <parentDir>` option. In the action handler, check `opts.auto` first: if set, run auto-discovery against `opts.auto`; otherwise use the `path` argument.
**Warning signs:** Auto-discovery mode never triggers, or path argument always required.

### Pitfall 8: Midair Zod Parse + Schema Drift Response Loop
**What goes wrong:** D-16 response validation calls `Schema.parse()` before send. If the 500 `schema_drift` error response itself fails schema validation, you get infinite recursion.
**Why it happens:** The error response shape must be pre-validated at definition time, not at send time.
**How to avoid:** The `ErrorResponseSchema` is a simple shape. Only apply D-16 (`Schema.parse()`) to domain response schemas (health, registry list, read, git). Error responses are constructed directly without outbound parse.

---

## Tailscale Integration Details

### tailscale ip -4
- **When binary absent:** `execa` throws `{ code: 'ENOENT' }`. Catch and throw "Tailscale not detected" error.
- **When binary present but daemon not running:** exits with code 1, stderr: "failed to connect to local Tailscale daemon". `execa` throws by default. Catch the same way.
- **Output format:** single IPv4 address, newline-terminated. `stdout.trim()` gives the clean IP.

### tailscale status --json
- **Top-level fields confirmed:** `Self.DNSName`, `Self.TailscaleIPs`, `Self.Online`
  [CITED: alexwlchan.net/notes/2026/map-of-tailscale-ips/ — real output shown with these exact fields]
- **DNSName format:** FQDN with trailing dot, e.g. `devbox.tailfa84dd.ts.net.` — strip trailing dot before use.
- **MagicDNS detection (D-19):** Use presence of non-empty `Self.DNSName` as signal. If `DNSName` is empty string or absent, fall back to `Self.TailscaleIPs[0]` or the IP from `tailscale ip -4`.
- **`CurrentTailnet.MagicDNSEnabled` field:** [ASSUMED] — seen in some community JSON samples but not confirmed in official Tailscale docs. D-19's fallback rule (empty DNSName = fall back to IP) handles the case where this field is absent.

### git subcommands allow-list (API-03)
Allowed values: `log`, `status`, `diff-stat`, `branch`. These map to:
- `log` → `git log --oneline -20`
- `status` → `git status --short`
- `diff-stat` → `git diff --stat HEAD~1..HEAD`
- `branch` → `git branch --show-current`

Reject any `cmd` value not in the allow-list with 422 before spawning any subprocess.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json`

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (from pnpm catalog) |
| Config file | root `vitest.config.ts` (per Phase 0 pattern) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` |
| Full suite command | `pnpm test` (workspace-wide) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAEMON-01 | `start` boots Hono on 127.0.0.1:5193 | subprocess CLI | `pnpm --filter agent test -- cli.test.ts` | ❌ Wave 0 |
| DAEMON-02 | `stop` shuts down gracefully | subprocess CLI | `pnpm --filter agent test -- cli.test.ts` | ❌ Wave 0 |
| DAEMON-03 | `status` reports health | subprocess CLI | `pnpm --filter agent test -- cli.test.ts` | ❌ Wave 0 |
| DAEMON-04 | Refuse start on 0644 auth.json (MANDATORY TDD) | subprocess CLI | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| DAEMON-05 | Pair URL printed at startup | subprocess CLI | `pnpm --filter agent test -- cli.test.ts` | ❌ Wave 0 |
| DAEMON-06 | `--bind tailscale` degrades gracefully | unit with mocked execa | `pnpm --filter agent test -- lib/tailscale.test.ts` | ❌ Wave 0 |
| AUTH-01 | Missing/invalid token returns 401 (MANDATORY TDD) | in-process route | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | CORS rejects wrong origin (MANDATORY TDD) | in-process route | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-03 | rotate-token invalidates old token (MANDATORY TDD) | in-process route | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | 30-day auto-rotation trigger | unit | `pnpm --filter agent test -- lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-05 | Pair URL format correct (prints on start) | subprocess CLI | `pnpm --filter agent test -- cli.test.ts` | ❌ Wave 0 |
| REG-01 | `register <path>` adds project; slug collision handling | unit | `pnpm --filter agent test -- lib/registry.test.ts` | ❌ Wave 0 |
| REG-02 | `register --auto` scans depth=1, confirms matches | unit with mocked fs | `pnpm --filter agent test -- lib/registry.test.ts` | ❌ Wave 0 |
| REG-03 | `unregister` removes project | unit | `pnpm --filter agent test -- lib/registry.test.ts` | ❌ Wave 0 |
| REG-04 | `list` marks unreachable roots | unit | `pnpm --filter agent test -- lib/registry.test.ts` | ❌ Wave 0 |
| REG-05 | `rename` + `tag` mutate registry | unit | `pnpm --filter agent test -- lib/registry.test.ts` | ❌ Wave 0 |
| API-01 | GET /health returns correct schema | in-process route | `pnpm --filter agent test -- server/__tests__/health.test.ts` | ❌ Wave 0 |
| API-02 | `..` traversal returns 422 (MANDATORY TDD) | in-process route | `pnpm --filter agent test -- server/__tests__/paths.test.ts` | ❌ Wave 0 |
| API-03 | git cmd not in allow-list returns 422 | in-process route | `pnpm --filter agent test -- server/__tests__/git.test.ts` | ❌ Wave 0 |
| INV-02 | 0644 auth.json causes startup refusal | subprocess CLI | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| INV-05 | No native deps in dist/cli.js | static grep | `grep -qE 'keytar|ffi' dist/cli.js || echo OK` | ❌ Wave 0 |
| D-15 | Token rotation race: in-flight completes | in-process route | `pnpm --filter agent test -- server/__tests__/auth.test.ts` | ❌ Wave 0 |
| D-16 | Schema drift returns 500 | in-process route | `pnpm --filter agent test -- server/__tests__/health.test.ts` | ❌ Wave 0 |

### The 4 Mandatory TDD Cases (spec line 616)

These tests must be written first (RED / failing) before any implementation. Each is a named describe block:

1. **`token-rotation-invalidates-old-token`** — `rotateToken()` changes `activeToken`; old bearer returns 401. File: `server/__tests__/auth.test.ts`
2. **`cors-rejects-wrong-origin`** — OPTIONS preflight from `https://evil.com` gets no `Access-Control-Allow-Origin` header. File: `server/__tests__/auth.test.ts`
3. **`path-allow-list-rejects-traversal`** — `GET /api/projects/:id/read?path=../../etc/passwd` returns 422. File: `server/__tests__/paths.test.ts`
4. **`permissions-check-refuses-0644`** — `assertSecurePermissions()` throws (or daemon subprocess refuses start) when `auth.json` has mode 0644. File: `server/__tests__/auth.test.ts`

### Sampling Rate
- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test`
- **Per wave merge:** `pnpm test` (all packages)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

The following test files do not exist and must be created before any implementation wave:

- [ ] `packages/agent/src/server/__tests__/auth.test.ts` — covers AUTH-01, AUTH-02, AUTH-03, DAEMON-04, INV-02, D-15 (4 mandatory TDD cases live here)
- [ ] `packages/agent/src/server/__tests__/paths.test.ts` — covers API-02 (mandatory TDD case)
- [ ] `packages/agent/src/server/__tests__/health.test.ts` — covers API-01, D-16
- [ ] `packages/agent/src/server/__tests__/git.test.ts` — covers API-03
- [ ] `packages/agent/src/lib/auth.test.ts` — covers AUTH-04, AUTH-05, token generation, permission check
- [ ] `packages/agent/src/lib/registry.test.ts` — covers REG-01 through REG-05
- [ ] `packages/agent/src/lib/tailscale.test.ts` — covers DAEMON-06 with mocked execa
- [ ] `packages/agent/src/lib/paths.test.ts` — unit tests for `resolveAllowed()` pure function
- [ ] `packages/shared/src/schemas/registry.test.ts` — schema parse/validation tests for new schemas

Framework install is not needed — vitest is already in the catalog and installed.

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Static bearer token; `hono/bearer-auth` middleware |
| V3 Session Management | no | No sessions; stateless bearer, token-per-device |
| V4 Access Control | yes | Path allow-list per project; CORS origin lock |
| V5 Input Validation | yes | Zod schemas via `@hono/zod-validator` on all route inputs |
| V6 Cryptography | yes | `crypto.randomBytes(32)` — never hand-roll PRNG |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bearer token leakage from `auth.json` | Information Disclosure | Mode `0600` enforced at startup (D-01, INV-02) |
| CORS bypass from non-browser clients | Elevation of Privilege | CORS is browser-only; bearer token is the real auth gate (defense in depth) |
| Path traversal (`../../etc/passwd`) | Tampering | Pre-check for `..` components + `fs.realpath()` allow-list check (D-23) |
| Planted symlink escape (`.planning/evil -> /etc`) | Tampering | `fs.realpath()` resolves through symlinks; realpath check rejects escape (D-23) |
| Mode-0644 token file takeover | Information Disclosure | Daemon refuses to start; exact remediation message printed (D-01) |
| Tailscale CIDR spoofing via injected header | Spoofing | Using `c.env.incoming.socket.remoteAddress` (raw TCP), not `X-Forwarded-For` |
| Mid-rotation request hijack | Spoofing | `verifyToken` reads in-memory ref atomically per request; in-flight complete normally (D-15) |
| Git subcommand injection | Tampering | Allow-list check before `execa` spawn; `execa` uses argv array, not shell |
| Process kill via crafted pidfile | Denial of Service | Pidfile only used for liveness check via `process.kill(pid, 0)`; SIGTERM only sent to known PID |
| EADDRINUSE port squatting | Denial of Service | Pidfile liveness check first; clear EADDRINUSE error message, exit 1 |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All daemon code | yes | v24.15.0 (exceeds 20 minimum) | — |
| pnpm | Workspace management | yes | 10.33.2 | — |
| git | `GET /api/projects/:id/git` | yes | system git | — |
| tailscale | `--bind tailscale` mode | no (not found on this machine) | — | D-17: refuse start with remediation message |
| hono, @hono/node-server, etc. | Phase 1 server code | no (not yet installed) | — | Wave 0 install task |

**Missing dependencies with fallback:**
- `tailscale`: binary absent on this machine. This is expected — the dev machine used for research is not Donald's production box. Daemon gracefully refuses `--bind tailscale` with remediation message per D-17. Loopback `--bind 127.0.0.1` (default) works without Tailscale.

**Missing dependencies that block Wave 0 (must install before writing route code):**
- `hono@4.12.16`, `@hono/node-server@2.0.1`, `@hono/zod-validator@0.7.6`, `execa@9.6.1`, `picocolors@1.1.1` — Wave 0 install task.
- Catalog update to `zod: ^3.25.0` must come before `pnpm install` to avoid peer dep conflicts.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express + separate cors npm package | Hono + built-in cors middleware | ~2022 | Hono is Web-standard; works on edge runtimes too |
| `request` or `got` for HTTP in Node | `fetch` (Node 18+) or `execa` for subprocesses | Node 18 | Built-in fetch for HTTP; execa for subprocess |
| `uuid` npm package for UUIDs | `crypto.randomUUID()` (Node 15+) | Node 15 | No dependency for UUID v4 generation |
| chalk for terminal colors | `picocolors` or `kleur` | 2021 to 2022 | chalk 5 is 40KB+ unpacked ESM; picocolors is 6KB and zero-config |
| Zod v3 as the sole version | Zod v4.x is now current stable | 2025 | Stay on v3.25 for Phase 1 to align with @hono/zod-validator; v4 has breaking API changes |

**Deprecated/outdated:**
- `zod: ^3.24.0` in pnpm catalog: must bump to `^3.25.0` for @hono/zod-validator 0.7.x compatibility.

---

## Open Questions

1. **HealthResponseSchema extension strategy**
   - What we know: existing Phase 0 tests check for `version` field; spec adds `daemonVersion`, `registryCount`, `paired`.
   - What's unclear: should `--version --json` be updated to populate new fields?
   - Recommendation: Make new fields optional in the schema. `--version --json` stays backward-compatible (omits the new fields). Daemon `GET /health` populates all fields.

2. **requestId: global crypto.randomUUID() availability**
   - What we know: `crypto.randomUUID()` is a Node 15+ global. No import needed in Node 20.
   - Recommendation: Use `crypto.randomUUID()` directly in middleware. Confirmed available in Node 20 LTS.

3. **`stop` command: where is the bound URL stored?**
   - What we know: D-05 says `stop` reads token from `auth.json`, then POSTs to bound URL. The bound URL is not stored in `auth.json`.
   - What's unclear: where should the bound URL be persisted so `stop` can find it?
   - Recommendation: Write `~/.agenticapps/dashboard/server.json` (mode `0600`) on `start`, containing `{ bindUrl, pid }`. The `stop` command reads this. The `status` command uses it too. Remove on graceful shutdown.

4. **Zod v4 migration timing**
   - What we know: Zod v4.4.2 is current stable; v3.25.76 is latest v3. @hono/zod-validator supports both.
   - Recommendation: Stay on Zod v3 for Phase 1 (bump catalog to `^3.25.0`). Zod v4 has breaking API changes; migrating is unnecessary risk for this phase. Document as potential Phase 6 polish task.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tailscale status --json` `Self.DNSName` field is stable across Tailscale v1.x | Tailscale Integration | Low — D-19 fallback to raw IP handles absent/empty DNSName gracefully |
| A2 | `CurrentTailnet.MagicDNSEnabled` field exists in `tailscale status --json` output | Tailscale Integration | Low — D-19 uses `Self.DNSName` presence, not this field |
| A3 | tsup bundling of `hono` and `execa` into a single ESM bundle works without issues | Standard Stack | Medium — both are ESM-native; bundling may trigger dynamic import issues. Mitigated by subprocess CLI tests against the dist bundle |
| A4 | `@hono/node-server` `serve()` options use `hostname` (not `host`) for bind address | Architecture Patterns | Low — verified by reading @hono/node-server@2.0.1 source code |
| A5 | Updating `zod` from `^3.24.0` to `^3.25.0` in catalog is non-breaking for existing schemas | Schema Changes | Low — zod 3.25 is a minor release; no breaking schema API changes per changelog |

**If the table above were empty:** all claims would be verified or cited — no user confirmation needed. The assumptions above are all low risk with mitigations in place.

---

## Sources

### Primary (HIGH confidence)
- npm registry — hono@4.12.16, @hono/node-server@2.0.1, @hono/zod-validator@0.7.6, execa@9.6.1, picocolors@1.1.1, commander@14.0.3, kleur@4.1.5, zod versions — versions, exports, peer dependencies confirmed 2026-05-03
- Node.js manual test verification — token format, CGNAT CIDR check, fs.stat mode bits, process.kill semantics, fs.realpath symlink detection, server.close() pattern, commander variadic args — all verified via `node --input-type=module` on Node v24.15.0 (superset of Node 20 LTS)
- https://hono.dev/docs/getting-started/nodejs — serve() + HttpBindings + c.env.incoming
- https://hono.dev/docs/middleware/builtin/bearer-auth — bearerAuth options, verifyToken callback, token regex
- https://hono.dev/docs/middleware/builtin/cors — cors() origin array, preflight handling
- https://hono.dev/docs/guides/testing — app.request() in-process test pattern
- https://hono.dev/docs/api/routing — route groups, param syntax
- https://hono.dev/docs/api/exception — HTTPException, app.onError
- https://hono.dev/docs/middleware/builtin/logger — logger() usage
- docs/spec/dashboard-prompt.md lines 100–241, 290–384, 576–616, 686–712 — binding spec

### Secondary (MEDIUM confidence)
- alexwlchan.net/notes/2026/map-of-tailscale-ips/ — confirms `Self.DNSName` and `Self.TailscaleIPs` in tailscale status --json output; trailing dot format confirmed
- https://tailscale.com/kb/1080/cli — confirms `tailscale ip -4` output format (single IPv4 address)
- @hono/node-server@2.0.1 source (server.ts, types.ts) — ServerType union, serve() return type, HttpBindings.incoming definition

### Tertiary (LOW confidence)
- `CurrentTailnet.MagicDNSEnabled` field in tailscale status --json — seen in community examples but not in official Tailscale CLI docs; marked [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via npm registry
- Architecture patterns: HIGH — all Node APIs verified via manual test; Hono APIs via official docs
- Path allow-list: HIGH — verified via manual fs.realpath symlink test on macOS
- Permission check: HIGH — verified via manual chmod + statSync test on macOS
- Token format: HIGH — verified URL-safe, length 71, passes bearerAuth regex
- CIDR check: HIGH — verified boundary values manually
- Tailscale JSON DNSName: MEDIUM — confirmed in community examples, not official docs
- Tailscale CurrentTailnet fields: LOW — assumed, D-19 fallback handles gracefully

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (Hono and Tailscale move quickly; re-verify if planning takes more than 30 days)
