---
phase: 03-multi-project-home-page
date: 2026-05-05
mode: daily
critical: 0
high: 0
medium: 0
low: 2
---

# Phase 3 Security Audit (`/cso`)

Diff-scoped audit against `phase-03-multi-project-home` (71 commits ahead of `main`).

## Architectural constraints (CLAUDE.md)

| ID | Constraint | Result | Where |
|---|---|---|---|
| C1 | Read-only on registered project filesystems | PASS | `projectOverview.ts` reads `.git`/`.planning`/`.claude/skills` markers + `.planning/phases/<latest>/*.md` only |
| C2 | Path allow-list on `/api/projects/:id/read` rejects `..` and absolute paths | PASS | `read.ts` not modified in phase 3; `assertRegistrationAllowed` extends defense in depth at registration |
| C3 | Daemon writes confined to `~/.agenticapps/dashboard/` mode 0600 | PASS | `atomicWriteFile` + `ensureConfigDir 0o700`; observed registry.json `0600` and config dir `0700` on disk |
| C4 | No native deps in `packages/agent/` | PASS | `packages/agent/package.json` unchanged in phase 3 diff |
| C5 | Bearer-token auth on every route + CORS locked | PASS | `app.ts:91` `bearerAuth` with `timingSafeEqual` covers all 4 new routes; CORS at `app.ts:77` to PROD_ORIGIN + DEV_ORIGIN, `credentials: false` |
| C6 | No Cloudflare Workers/Functions in v1 | PASS | SPA is pure static; daemon is local-only Hono on `127.0.0.1:5193` |

## Threat model verification

| Threat | Status | Evidence |
|---|---|---|
| T-03-04-01 confused-deputy register | MITIGATED | D-09 prepare/confirm — `registry.ts:116-241`. SPA cannot register a path the user did not preview |
| T-03-04-02 nonce replay | MITIGATED | `registerNonces.ts:33-40` — `consumeNonce` deletes unconditionally before TTL check; second confirm returns 410 |
| T-03-04-03 nonce TTL bypass | MITIGATED | Server-side `entry.expiresAt < Date.now()` at `registerNonces.ts:38` + 60s sweep |
| TOCTOU path swap between prepare and confirm | MITIGATED | `register-confirm` re-runs `assertRegistrationAllowed` and `addProject` re-canonicalises via `realpathSync` — symlink swap to `/etc` is caught at confirm time |
| Log injection in BLOCKED event | MITIGATED | `registerLog.ts:14-15` sanitises newline before `console.error` |
| Shell injection via user paths | MITIGATED | `execa` argv arrays at `projectOverview.ts:154,176` and `registry.ts:315`; user root passes as `cwd` option, not shell arg |
| Rate-limit evasion on `/register-prepare` | MITIGATED | Sliding 10s window cap 10 keyed on `tokenHashOf(token)` first 8 hex |
| XSS via registry `name` / `tags` rendered in cards | MITIGATED | `ProjectCard.tsx:168,172` use JSX text interpolation; no raw-HTML escape hatches in production SPA code |

## Findings

**0 critical / 0 high / 0 medium under the daily 8/10 confidence gate.**

## Notes below the gate (advisory)

### A-01 — No rate limit on `/:id/rename`, `/:id/tags`, `/register-confirm`

Confidence 5/10. Token compromise is the precondition — once a leaked bearer is in play, rate-limiting registry mutations is no longer the security boundary. Discarded under hard-exclusion #3 (resource exhaustion) and #6 (missing hardening). Daemon is local-only by default; no remote attack surface unless `--bind tailscale` or `--bind 0.0.0.0`.

If pursued: mirror the `/register-prepare` token-bucket on the three other write routes for consistency. ~6 lines per route.

### A-02 — `RenameRequestSchema` and `TagsRequestSchema` lack max-length / count bounds

Confidence 4/10. Same DoS class — discarded under hard-exclusion #3. No filesystem write keyed on the value, no raw-HTML render path, no SQL. Worst case a token holder writes a 10MB name into `registry.json`; daemon refuses to start next time via the read-back validate in `atomicWriteFile`.

If pursued: `.max(200)` on name strings and `.max(20)` on tag array length / `.max(50)` per tag in `packages/shared/src/schemas/registry.ts`.

## Supply chain

`pnpm audit --prod` → `No known vulnerabilities found`. Phase 3 added zero new direct deps to `packages/agent/`. Lockfile tracked.

## Disclaimer

This is an AI-assisted scan. Catches common vulnerability patterns, not a substitute for a professional audit. Phases 7+ that introduce remote write surfaces (CF Access, Sentry, Linear, Infisical) should re-run `/cso` against their own diffs.
