---
status: complete
phase: 00-bootstrap
source: [00-VERIFICATION.md]
started: 2026-05-02T19:25:00Z
updated: 2026-05-02T20:45:00Z
---

## Current Test

[all gates evaluated — Phase 0 acceptance ready for /gsd-verify-work 0]

## Tests

### 1. BOOT-03 — Cloudflare Pages preview deploy
expected: Push `feat/phase-0-bootstrap` to GitHub → CF Pages auto-builds → PR comment from `cloudflare-workers-and-pages` bot links to a preview URL → opening the URL prompts the CF Access email gate → after auth the SPA renders "AgenticApps Dashboard — alpha" + "Agent not running" empty state. Configuration steps documented in `docs/deploy/cloudflare-pages-setup.md`.
result: passed
notes: |
  - Preview URL `https://feat-phase-0-bootstrap.agenticapps-dashboard.pages.dev` returns 302 → `vlahovic2.cloudflareaccess.com/cdn-cgi/access/login/...` (email-OTP gate active).
  - HTML title "AgenticApps Dashboard — alpha"; Tailwind dark theme classes applied; React bundle mounts on `#root`.
  - CF Pages bot did NOT post a preview-URL comment on PR #1 — likely the GitHub App lacks PR-comment permission. Cosmetic; the deploy itself is healthy. Worth re-checking the GitHub App install before Phase 6.
  - Production URL (`agenticapps-dashboard.pages.dev`) is NOT yet Access-gated. Per phase order, "CF Access" is a Phase 6 deliverable — out of scope for BOOT-03 acceptance.
  - First push exposed a CI defect: `pnpm/action-setup@v6` errors when both workflow `version` input AND `packageManager` field are set. Fixed in commit `a5d1e33`.

### 2. BOOT-04 — npm publish via tag push
expected: Push tag `v0.0.1-alpha.0` → `.github/workflows/release.yml` runs green (install → lint → typecheck → test → build → publint → attw → `npm publish --provenance --access public --tag alpha`) → `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0` returns the package metadata with provenance attestation → `npx @agenticapps/dashboard-agent@0.0.1-alpha.0 --version` from a clean machine prints `0.0.1-alpha.0`.
result: passed (provenance deferred — see gaps)
notes: |
  Published as `0.0.1-alpha.3` (not `alpha.0`) and **without provenance attestation**. Tag-history reflects three real Phase 0 deliverable bugs caught in sequence:

  - `v0.0.1-alpha.0` — release workflow used `attw`'s default profile, which fails on `node10` resolution and warns on `CJSResolvesToESM`. Both intentional for an ESM-only CLI targeting `node >= 20` with only `exports.import`. Fix: `attw --profile esm-only` (commit `2ade1cc`).
  - `v0.0.1-alpha.1` — `NPM_TOKEN` was a publish-type token but the npm account has 2FA in "auth-and-writes" mode; npm rejected publish with `EOTP`. Fix: rotated to an automation-type token (manual user step).
  - `v0.0.1-alpha.2` — npm rejected provenance with `E422 "Unsupported GitHub Actions source repository visibility: \"private\""`. The dashboard repo is private during Phase 0; npm provenance requires a public source repo. Fix: dropped `--provenance` from `pnpm publish` and the matching `id-token: write` permission, plus `publishConfig.provenance: true` from `packages/agent/package.json` (commit `f4c9b58`).
  - `v0.0.1-alpha.3` — pipeline green; `release.yml` run `25260155290` completed in 57s. Manifest live at `registry.npmjs.org/@agenticapps/dashboard-agent` after ~5 min first-publish indexing lag. `npm view @agenticapps/dashboard-agent@0.0.1-alpha.3` returns `dist-tags { latest: 0.0.1-alpha.3, alpha: 0.0.1-alpha.3 }`, integrity `sha512-3xhkWdfNWpxK4...`, tarball 126.1 kB / 685.2 kB unpacked. `npx --yes @agenticapps/dashboard-agent@0.0.1-alpha.3 --version` from `/tmp/.npx-test` prints `0.0.1-alpha.3`.

  **Acceptance shape vs spec:**
  - Pipeline gates (lint/typecheck/test/build/publint/attw/publish) — passed.
  - Tag-triggered release — passed.
  - npm publish — passed (registry, manifest, tarball, dist-tags all healthy).
  - `npx --version` smoke — passed.
  - **Provenance attestation — DEFERRED.** Phase 0 publishes without `--provenance`. Re-enable in lockstep with `id-token: write` permission when the GitHub repo goes public. Tracked as gap below.

  **Orphan provenance signatures on Sigstore:** alpha.1 (logIndex 1429548572) and alpha.2 (logIndex 1429551699). Both attestations were signed before npm rejected the publish; transparency log is append-only, so they remain. No consumer can resolve them (no published artifact). Cosmetic.

### 3. BOOT-02 — GitHub branch protection
expected: GitHub repository settings have a branch protection rule on `main` that requires the `ci` status check to pass before merging. After merging this PR to `main`, GitHub Actions runs `ci.yml` against the `main` HEAD and the run is green.
result: passed
notes: |
  - Branch protection applied to `main` via `PUT /repos/.../branches/main/protection`: `required_status_checks.contexts=["ci"]`, `strict=true`, `enforce_admins=false`, `allow_force_pushes=false`, `allow_deletions=false`, no PR-review requirement (solo project).
  - PR #1 merged via merge commit at `21ab426`; CI ran on main HEAD (run `25259647857`) and completed green in 48s.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **Provenance attestation deferred** (BOOT-04) — the spec asked for `npm publish --provenance` but npm requires a public source repo. Phase 0 publishes without provenance until the repo's visibility is flipped. Reactivation: revert commit `f4c9b58` (re-add `--provenance` to `release.yml`, `id-token: write` permission, and `publishConfig.provenance: true`).
- **CF Pages bot PR comment** (BOOT-03) — the `cloudflare-workers-and-pages` GitHub App didn't post the preview-URL comment on PR #1. Deploy succeeded; manifest is healthy; this is purely a UX miss on PR review. Investigate the App install/permissions before Phase 6.
