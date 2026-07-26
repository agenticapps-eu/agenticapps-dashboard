# Phase 0: Bootstrap -

**Archived from GSD phase `00-bootstrap`. Completed 2026-05-03.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/00-bootstrap/` — that tree, not this file, is the authoritative record.

## Why

Phase 0 stands up the pnpm workspace, Cloudflare Pages preview deploy, npm placeholder package, README, and green CI — establishing the contracts every subsequent phase inherits. No daemon code, no SPA routes, no business logic. Just infrastructure and the cross-package wire-up that proves the workspace works end-to-end.

**In scope:**
- pnpm workspaces (`packages/spa`, `packages/agent`, `packages/shared`) with single root lockfile
- Lint, format, typecheck, test toolchain wired across all three packages
- One trivial Zod schema in `shared/` exercised by both placeholder SPA and placeholder agent
- CI workflow (lint + typecheck + test + build) on push and PR, status check enforced on `main`
- Cloudflare Pages preview deploy on every branch push (uses CF Pages Git integration set up pre-flight)
- `@agenticapps/dashboard-agent@0.0.1-alpha.0` published to npm via tag-triggered workflow
- Repo-root README with "alpha" notice, three-command install snippet, link to spec

**Out of scope (belongs in later phases):**
- Real daemon endpoints, registry CRUD, auth, pairing → Phase 1
- Real SPA routes, components, pair flow → Phase 2
- Anything beyond the placeholder schema in `shared/` → Phase 1+
- LICENSE file → Phase 8
- husky/commitlint enforcement → Phase 6
- Custom domain `dashboard.agenticapps.eu` → deferred per pre-flight (production URL stays `agenticapps-dashboard.pages.dev`)

## Capabilities affected

- _(none — repo scaffolding; contributed no product capability)_

## What shipped

**00-01**

**pnpm workspace with three package skeletons + HealthResponseSchema (Zod) single-source-of-truth + ESLint 9 / typescript-eslint 8 / Prettier 3 / TypeScript 6 strict / Vitest 4 with per-project naming + CI workflow running five gates on push and pull_request.**

**00-02**

**Placeholder `@agenticapps/dashboard-agent` CLI: commander-based ESM CLI with `--version`, `--version --json`, and `start` commands; tsup bundles `@agenticapps/dashboard-shared` + `commander` + `zod` into a self-contained ESM artifact (zero runtime workspace deps, T-00-04 mitigated). Subprocess + bundle-integrity test suite runs against the built `dist/cli.js`. Dry-run publish succeeds with `--tag alpha`.**

**00-03**

**Placeholder `@agenticapps/dashboard-spa` — Vite + React 18 + TypeScript + Tailwind 4 single-route shell rendering "AgenticApps Dashboard — alpha" + AgentVersion empty-state row that re-validates `HealthResponseSchema` from `@agenticapps/dashboard-shared` at module load.**

**00-04**

**Tag-triggered .github/workflows/release.yml runs five gates + publint + attw before publishing @agenticapps/dashboard-agent to npm with --provenance --access public --tag alpha; agent package.json gains full npm metadata (keywords, homepage, bugs, repository, license, publishConfig).**

**00-05**

**Repo-root README.md replaces the placeholder with a one-screen alpha-aware overview (architecture, three-command install, development gates, deployment links, license posture); `docs/deploy/cloudflare-pages-setup.md` captures the human-only CF Pages dashboard configuration so BOOT-03 is reproducible and the preview/production Access policy split (RESEARCH §Pitfall 7) is documented.**

## Gates recorded

- verification — `00-VERIFICATION.md`
- code review — `00-REVIEW.md`
- human UAT — `00-HUMAN-UAT.md`
- validation — `00-VALIDATION.md`
