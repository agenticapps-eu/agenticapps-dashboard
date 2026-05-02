# Cloudflare Pages — Manual Setup

> **Status:** Pre-flight steps already completed by the user (per `.planning/phases/00-bootstrap/00-CONTEXT.md` §"Code Context"). This document is the reproducibility record — if the Pages project is ever reset or recreated, these are the exact steps to restore it.

## Project

- **Cloudflare Pages project name:** `agenticapps-dashboard`
- **Production URL:** `https://agenticapps-dashboard.pages.dev`
- **Custom domain (`dashboard.agenticapps.eu`):** deferred. Production URL stays `*.pages.dev` through v1.
- **Git integration:** connected to GitHub repo `agenticapps-eu/agenticapps-dashboard`. Push to any branch triggers a preview deploy; push to `main` triggers a production deploy.

## Build configuration

Set in **Cloudflare Pages dashboard → Project → Settings → Builds & deployments → Build configurations**:

| Setting | Value |
|---|---|
| Build command | `pnpm --filter @agenticapps/dashboard-spa build` |
| Build output directory | `packages/spa/dist` |
| Root directory | `/` (repo root, NOT `packages/spa`) |

The root directory MUST stay at `/`. pnpm needs to resolve the workspace root to follow `workspace:*` references. Setting root directory to `packages/spa` would break `@agenticapps/dashboard-shared` resolution. (See `.planning/phases/00-bootstrap/00-RESEARCH.md` §"Common Pitfalls" Pitfall 1.)

## Environment variables

Set in **Settings → Environment variables → Production AND Preview** (apply to both):

| Variable | Value | Why |
|---|---|---|
| `NODE_VERSION` | `20` | Override CF Pages build image default; matches `.nvmrc`. |
| `PNPM_VERSION` | `10` | Match local pnpm version; ensures catalog feature is available (catalog requires pnpm >= 9.5; we run 10). |

CF Pages v3 build image defaults to Node 22 / pnpm 10.11.1. Setting these explicitly is belt-and-suspenders against build-image upgrades that change defaults.

## Cloudflare Access — preview deployments

CF Access policies set on a Pages project via **Settings → Enable access policy** protect **only preview deployments** by default. To gate preview URLs:

1. Pages project → Settings → "Enable access policy"
2. Toggle on
3. Configure: **Email-only**, allow your own email address
4. Apply

This covers `<hash>.agenticapps-dashboard.pages.dev` and `<branch>.agenticapps-dashboard.pages.dev`.

## Cloudflare Access — production deployment (separate!)

The production URL `agenticapps-dashboard.pages.dev` is NOT covered by the preview policy above. (See RESEARCH §Pitfall 7.) Configure separately:

1. Cloudflare Zero Trust → Access → Applications → Add application
2. **Self-hosted application**, hostname `agenticapps-dashboard.pages.dev`
3. Policy: **Allow**, **Email**, set to your own email address
4. Save

After both policies are in place, an unauthenticated browser visit to either preview or production URL should show the CF Access email-OTP gate.

## Verification (run after any CF dashboard change)

1. Push a feature branch:
   ```bash
   git push origin feat/cf-pages-smoke-test
   ```
2. Wait ~60 seconds for CF Pages build.
3. Open the PR for the feature branch on GitHub. The "Cloudflare Pages" bot should comment with the preview URL within 1-2 minutes.
4. Click the preview URL. You should hit the CF Access email gate. After authenticating, the SPA should load and show "AgenticApps Dashboard - alpha".

## Triage when builds fail

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module '@agenticapps/dashboard-shared'` | Root directory is set to `packages/spa` instead of `/` | Reset root directory to `/` in build config |
| `pnpm-workspace.yaml not found` | Same as above | Same fix |
| `ERR_PNPM_FROZEN_LOCKFILE` | Lockfile out of date with `pnpm-workspace.yaml` (catalog drift) | Run `pnpm install` locally and commit the updated lockfile |
| Build fails with Node module errors | Build image using older Node version | Confirm `NODE_VERSION=20` env var is set on BOTH Production and Preview environments |
| Preview URL returns 200 but no CF Access prompt | Preview Access policy not enabled | Settings → Enable access policy → toggle on |

## Reference

- Source-of-truth research: [`../../.planning/phases/00-bootstrap/00-RESEARCH.md`](../../.planning/phases/00-bootstrap/00-RESEARCH.md) §"Cloudflare Pages Configuration"
- Cloudflare Pages docs: <https://developers.cloudflare.com/pages/configuration/preview-deployments/>
- Decision: [`../../.planning/phases/00-bootstrap/00-CONTEXT.md`](../../.planning/phases/00-bootstrap/00-CONTEXT.md) D-11 (no `cloudflare/pages-action` in v1)
