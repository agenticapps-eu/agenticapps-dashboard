# AgenticApps Pipeline Dashboard

> **Alpha — early release.** Phases 0–6 ship a complete, useful dashboard with zero third-party service dependencies. Don't run this against anything you care about yet.

## Status

**Phases 0, 1, and 2 shipped.** Phase 0 stood up the pnpm workspace + Cloudflare Pages preview deploy + npm placeholder. Phase 1 landed the local daemon (Hono on `127.0.0.1:5193`), registry, bearer-token auth, CLI surface, and path allow-list. Phase 2 ships the SPA shell + pair flow: 5 routes (`/`, `/onboarding`, `/pair`, `/settings`, `/help`), TanStack Router with Zod-validated search params, dark theme by default with system + light + tri-state toggle, manual-pair fallback at `/settings`, schema-drift inline panel state (INV-04 SPA-side), and 401 → re-pair banner UX (AUTH-04 SPA-side).

**Phase 3 (multi-project home) is the next work.**

A registry-based, multi-project dashboard that visualizes the running state of the AgenticApps Superpowers + GSD + gstack pipeline across every registered project — from any device, while keeping all data on your own machine.

## Architecture

- **`packages/spa`** — Vite + React + Tailwind static SPA, hosted on Cloudflare Pages, no data stored cloud-side.
- **`packages/agent`** — Node 20+ local daemon (Hono), reads `.planning/`, `.claude/`, `git log` per registered project. Loopback default; bearer-token auth; `0600` config files; no native dependencies.
- **`packages/shared`** — Zod schemas + TS types, single source of truth for daemon ↔ SPA wire shapes.

## Install (alpha)

```bash
npx @agenticapps/dashboard-agent register ~/Sourcecode/your-first-project
npx @agenticapps/dashboard-agent start
# click the printed pair URL
```

Phase 0 publishes `@agenticapps/dashboard-agent@0.0.1-alpha.0` as a placeholder: `--version` prints the version and `start` prints a friendly notice that the real daemon arrives in Phase 1. Use this to verify the install path works against your shell environment before the daemon ships.

## Development

This is a pnpm workspace. Requirements: Node 20+, pnpm 9.5+.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Per-package commands use `--filter`:

```bash
pnpm --filter @agenticapps/dashboard-spa dev      # SPA on http://localhost:5174
pnpm --filter @agenticapps/dashboard-agent build  # Build the CLI bundle
pnpm --filter @agenticapps/dashboard-agent test   # Run agent tests only
```

CI runs the same five gates (install + lint + typecheck + test + build) on push and pull request — see `.github/workflows/ci.yml`. Releases trigger on `v*` tag push — see `.github/workflows/release.yml`.

## Deployment

- **SPA** — Cloudflare Pages (`agenticapps-dashboard`), production URL `https://agenticapps-dashboard.pages.dev`. Custom domain `dashboard.agenticapps.eu` is deferred to a later phase. Setup: [`docs/deploy/cloudflare-pages-setup.md`](docs/deploy/cloudflare-pages-setup.md).
- **Agent** — npm scope `@agenticapps`. Published from a tagged release; consumed via `npx`.

## Documentation

- **Spec (binding):** [`docs/spec/dashboard-prompt.md`](docs/spec/dashboard-prompt.md) — the source of truth that drives every phase. When intuition disagrees with the spec, the spec wins.
- **Roadmap:** [`.planning/ROADMAP.md`](.planning/ROADMAP.md) — nine phases, Phases 0–6 are v1.
- **Requirements:** [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md) — every requirement traced to a phase.
- **Workflow:** [`.claude/skills/agenticapps-workflow/skill/SKILL.md`](.claude/skills/agenticapps-workflow/skill/SKILL.md) — Superpowers + GSD + gstack contract.

## License

Currently UNLICENSED (no LICENSE file). The repo is private through Phase 6; an MIT LICENSE lands at Phase 8 with the public-readiness flip.
