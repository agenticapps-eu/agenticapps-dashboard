# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo is at **Phase 0 / bootstrap**. There is no `package.json`, no source code, and no build/test/lint commands yet — only:

- `README.md` (placeholder)
- `docs/spec/dashboard-prompt.md` — **the spec that drives all phases. Read it before doing anything substantive.**
- `.claude/skills/agenticapps-workflow/` — the workflow skill (Superpowers + GSD + gstack contract)

The first real work is Phase 0: stand up the pnpm workspace, Cloudflare Pages preview deploy, and `@agenticapps/dashboard-agent` placeholder package per `docs/spec/dashboard-prompt.md` §"Phase 0".

When the spec disagrees with intuition, the spec wins. When the spec is silent, surface the question via `/gsd-discuss-phase` rather than guessing.

## Architecture (target — most does not exist yet)

Three-package pnpm workspace, two deployment targets, one local daemon:

- `packages/shared/` — Zod schemas + TS types. **Single source of truth** for all daemon ↔ SPA wire shapes. Both ends validate against the same schema; mismatch surfaces as "schema drift" in the SPA.
- `packages/spa/` — Vite + React 18 + TS + Tailwind + TanStack Query. Static SPA deployed to Cloudflare Pages at `dashboard.agenticapps.eu`. **Holds no user data**; only renders what the local daemon serves.
- `packages/agent/` — Node 20+ + Hono + TS. Local daemon at `127.0.0.1:5193`, single binary `agentic-dashboard`. Reads `.planning/`, `.claude/`, and `git log` per registered project; reads `~/.claude/skills/` globally.

Runtime topology: SPA in browser → bearer-token HTTP → local daemon → filesystem reads. The SPA can also point at a Tailscale hostname for remote-device access. **No cloud-side data storage.**

## Hard architectural constraints

These are non-negotiable and must survive every refactor. Source: spec §"Constraints I want preserved" and §"Anti-features".

- **Read-only on project filesystems.** No daemon route writes to a registered project's files. Sole exception: `POST /api/projects/{id}/open` spawns `$EDITOR` (user-driven, per click).
- **Path allow-list per project.** `/api/projects/{id}/read` only resolves under `<root>/.planning` or `<root>/.claude`. Reject `..`, absolute paths, or realpaths outside the allow-list.
- **Daemon writes confined to `~/.agenticapps/dashboard/`.** Registry, auth, env files are mode `0600`; daemon refuses to start if permissions are looser.
- **No native dependencies in `packages/agent/`.** Keeps `npx @agenticapps/dashboard-agent` portable. No `keytar`, no FFI. A `0600` file in `$HOME` is the auth-token store.
- **Bearer-token auth on every route.** CORS locked to `https://dashboard.agenticapps.eu` (prod) and `http://localhost:5174` (dev).
- **Optional integrations stay optional.** Sentry, Linear, Infisical panels show "configure to enable" empty states when env vars are unset. The dashboard must function fully without any of them — Phases 0–6 ship with zero third-party service dependencies.
- **No Cloudflare Workers / Pages Functions in v1.** SPA is pure static.
- **The dashboard's own UI must pass `impeccable:critique` ≥ 90.** Anti-AI-slop self-test is part of acceptance.

If a proposed change violates any of the above, stop and surface the conflict — don't quietly relax the constraint.

## Workflow (project-specific additions)

The global `~/.claude/CLAUDE.md` already mandates the AgenticApps workflow (Superpowers + GSD + gstack with enforced hooks). On top of that, for this repo:

- Every phase follows GSD: `/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N` → verify. Do not skip discuss/plan even for "obvious" bootstrap work — the spec lists Phase 0 questions to surface.
- Workflow commitment ritual is mandatory at the start of any implementing session.
- TDD applies to every panel, every daemon route, and the bootstrap config (CI workflow, pnpm config) — not just feature code.
- Two-stage review (gstack `/review` + `superpowers:requesting-code-review`) before merging any phase. Stages do not collapse.
- Phases 7+ (Sentry / Linear / Infisical integrations) are **explicitly held** until the corresponding upstream tooling is set up. Don't preemptively wire them in.

## Phase order (from the spec)

`Phase 0` repo bootstrap & Cloudflare Pages skeleton → `Phase 1` daemon + registry + pairing → `Phase 2` SPA shell + pair flow → `Phase 3` multi-project home → `Phase 4` single-project Discipline + Phase columns → `Phase 5` Skills + Health column (incl. AgentLinter) → `Phase 6` polish, `install-launchd`, impeccable critique gate, CF Access. Phases 0–6 ship a complete dashboard. Phase 7+ are additive.

## Common commands

None yet — `package.json`, lockfile, and CI workflow are all Phase 0 deliverables. Once Phase 0 lands, prefer per-package pnpm filters (e.g. `pnpm --filter @agenticapps/dashboard-spa dev`) and update this section accordingly.
