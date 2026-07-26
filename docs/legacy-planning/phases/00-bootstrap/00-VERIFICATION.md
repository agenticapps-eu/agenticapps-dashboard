---
phase: 00-bootstrap
verified: 2026-05-02T19:25:00Z
status: human_needed
score: 5/5 locally-verifiable must-haves verified
overrides_applied: 0
human_verification:
  - test: "Push the phase branch to GitHub and verify Cloudflare Pages preview deploy"
    expected: "Within 60-90s of push, Cloudflare Pages bot comments on the PR with a preview URL of the form `<hash>.agenticapps-dashboard.pages.dev`. Visiting the URL from an incognito browser presents the CF Access email-OTP gate; after authenticating, the SPA loads and displays the brand line 'AgenticApps Dashboard — alpha' plus the Agent-not-running fallback row."
    why_human: "BOOT-03 success criterion requires live Cloudflare Pages infrastructure + CF Access email challenge — both external services that cannot be exercised programmatically from this verifier. Configuration is captured in `docs/deploy/cloudflare-pages-setup.md`; the actual deploy is a manual gate per `00-VALIDATION.md` §'Manual-Only Verifications'."
  - test: "Push the v0.0.1-alpha.0 git tag and verify npm publication"
    expected: "`git tag v0.0.1-alpha.0 && git push origin v0.0.1-alpha.0` triggers `.github/workflows/release.yml`. The workflow run succeeds end-to-end (install → lint → typecheck → test → build → publint → attw → publish with provenance). After completion, `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version` returns `0.0.1-alpha.0` and `npx @agenticapps/dashboard-agent@0.0.1-alpha.0 start` prints the alpha-placeholder message and exits 0."
    why_human: "BOOT-04 acceptance requires real npm registry publication, which depends on a user-driven tag push and the GitHub Actions runner reaching the registry with the `NPM_TOKEN` secret. The release workflow has been validated for shape (YAML parses, all required keys present, dry-run publish exits 0 with 'public access' confirmation), but the live publish event is the manual gate."
  - test: "Confirm GitHub branch protection requires the `ci` status check on `main`"
    expected: "GitHub repository Settings → Branches → main → Branch protection rule shows 'Require status checks to pass before merging' enabled with the `ci` check selected. After merging the phase branch, `main` HEAD shows a green `ci` status."
    why_human: "BOOT-02 success criterion (CI green on `main` head) requires GitHub UI configuration that lives outside the repository and a successful merge to `main` to produce a green status on the default branch. CI workflow itself has been verified locally green via the five-gate suite."
---

# Phase 0: Bootstrap Verification Report

**Phase Goal:** Stand up the pnpm workspace, three package skeletons (`packages/spa`, `packages/agent`, `packages/shared`), green CI, Cloudflare Pages preview deploy on a branch, and `@agenticapps/dashboard-agent@0.0.1-alpha.0` placeholder published to npm — README at root and CF Pages reproducibility doc complete.

**Verified:** 2026-05-02T19:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + Plan must_haves merged)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pnpm install` from a fresh clone resolves successfully against the root `pnpm-workspace.yaml` with `packages/spa`, `packages/agent`, `packages/shared` (ROADMAP SC#1, BOOT-01) | VERIFIED | `pnpm install --frozen-lockfile` exits 0; lockfile committed; all three package.json files present with `workspace:*` cross-references resolving correctly. |
| 2 | `pnpm install && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` all exit 0 from a clean tree | VERIFIED | Re-run during this verification: install (305ms) + lint + typecheck (3 packages) + test (12/12 across 4 files) + build (3 packages, SPA bundle 198kB JS / 7.5kB CSS, agent bundle 242kB ESM with shebang) all exit 0. |
| 3 | `HealthResponseSchema` lives in `@agenticapps/dashboard-shared` and is consumed by both `packages/agent` and `packages/spa` via `workspace:*` (D-06 cross-package contract) | VERIFIED | `packages/shared/src/schemas/health.ts` defines the Zod object; `packages/agent/src/cli.ts` line 2 imports it; `packages/spa/src/App.tsx` line 1 imports it; both `package.json` files declare `"@agenticapps/dashboard-shared": "workspace:*"`. |
| 4 | `agentic-dashboard --version` prints `0.0.1-alpha.0` and exits 0; `start` prints the alpha-placeholder message; `--version --json` emits `HealthResponseSchema`-valid JSON (BOOT-04 codepath, ROADMAP SC#3 codepath) | VERIFIED | Live invocation against built `dist/cli.js`: `--version` → `0.0.1-alpha.0`; `start` → "agentic-dashboard: alpha placeholder — daemon lands in Phase 1"; `--version --json` → `{"ok":true,"version":"0.0.1-alpha.0","message":"..."}` parses against the schema. First line of bundle is `#!/usr/bin/env node`. |
| 5 | `.github/workflows/ci.yml` runs all five gates (install/lint/typecheck/test/build) on `push` and `pull_request`; `.github/workflows/release.yml` triggers on `v*` tag with provenance + publint + attw + `--access public` (BOOT-02 codepath, BOOT-04 codepath) | VERIFIED | `ci.yml` parses, contains `pnpm/action-setup@v6` + `actions/setup-node@v4` + `--frozen-lockfile` + all five gate commands + `permissions: contents: read`. `release.yml` parses, contains `permissions: id-token: write` + `registry-url: 'https://registry.npmjs.org'` + `pnpm dlx publint` + `attw --pack` + `pnpm publish --provenance --access public --no-git-checks --tag alpha`. Dry-run publish exits 0 reporting "tag alpha and public access". |
| 6 | The placeholder agent bundle has zero runtime workspace deps (T-00-04 mitigation; INV-05 honored) | VERIFIED | `packages/agent/package.json` `dependencies: {}`; tsup config has `noExternal: ['@agenticapps/dashboard-shared', 'commander', 'zod']`; `grep -c "from\s*['\"]@agenticapps/dashboard-shared['\"]" dist/cli.js` returns 0 (workspace import inlined at build). |
| 7 | README at repo root opens with an "alpha" notice, the install snippet, and links to the spec (ROADMAP SC#5, BOOT-05) | VERIFIED | `README.md` line 3 has the alpha-notice blockquote; lines 16–18 contain the verbatim three-command install snippet from CONTEXT.md §"Specifics"; line 52 links to `docs/spec/dashboard-prompt.md`; line 53 links to `.planning/ROADMAP.md`; line 47 links to `docs/deploy/cloudflare-pages-setup.md`. 59 lines total (under one-screen ceiling). |
| 8 | CF Pages deployment is reproducible — `docs/deploy/cloudflare-pages-setup.md` documents project name, build command, publish dir, root directory pitfall, NODE_VERSION/PNPM_VERSION env vars, AND both preview + production Access policies as separate configurations (BOOT-03 reproducibility, RESEARCH Pitfall 7) | VERIFIED | File present at correct path. Contains `agenticapps-dashboard`, `pnpm --filter @agenticapps/dashboard-spa build`, `packages/spa/dist`, root-directory `/` callout with Pitfall 1 reference, `NODE_VERSION=20`, `PNPM_VERSION=10`, both "Cloudflare Access — preview deployments" and "Cloudflare Access — production deployment (separate!)" H2 sections, plus a 5-row triage table. 81 lines total. |

**Score:** 8/8 truths verified locally (5/5 plan must_haves + 3/3 supplementary truths from ROADMAP/spec coverage)

**Note:** Roadmap success criteria #2 (CF Pages preview live), #3 (`npm view ...` returns metadata), and #4 (CI green on `main`) require manual gates — see § Human Verification Required. Their *codepaths* (configured workflow YAML, agent CLI emitting correct payload, CF Pages config doc) are all verified above; only the live-event verification is deferred.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace declaration + pnpm catalog | VERIFIED | Contains `packages: ['packages/*']` and `catalog:` block with full Phase 0 stack (zod, vitest, eslint, react, vite, tailwindcss, commander, tsup-related). 42 lines. |
| `package.json` (root) | Five-gate scripts + Node ≥20 engine pin | VERIFIED | `engines.node === ">=20.0.0"`, `engines.pnpm === ">=9.5.0"`, `type: "module"`, all 5 gate scripts present (`lint`, `typecheck`, `test`, `build`, `format`). |
| `tsconfig.base.json` | Strict TypeScript baseline | VERIFIED | Contains `"strict": true`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, Node16 module/moduleResolution. |
| `.nvmrc` | Node 20 LTS pin | VERIFIED | File contents: `20\n`. |
| `eslint.config.mjs` | Flat config (typescript-eslint + prettier) | VERIFIED | Imports `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-react-hooks`. SPA + agent file globs in place. |
| `prettier.config.mjs` | Prettier defaults | VERIFIED | `singleQuote: true`, `semi: false`, `trailingComma: 'all'`, `printWidth: 100`. |
| `vitest.config.ts` (root) | `test.projects: ['packages/*']` | VERIFIED | Contains `projects: ['packages/*']` and v8 coverage config. |
| `.github/workflows/ci.yml` | CI pipeline (push + PR) | VERIFIED | All 5 gates + correct triggers + pinned action versions + `permissions: contents: read`. |
| `.github/workflows/release.yml` | Tag-triggered release with provenance | VERIFIED | `on: push: tags: ['v*']` + `permissions: id-token: write` + `registry-url` + `--frozen-lockfile` + 5 gates + publint + attw + `pnpm publish --provenance --access public --no-git-checks --tag alpha`. |
| `packages/shared/src/schemas/health.ts` | HealthResponseSchema (Zod) | VERIFIED | 9 lines, exports `HealthResponseSchema = z.object({ok, version, message?})` and inferred `HealthResponse` type. |
| `packages/shared/src/schemas/health.test.ts` | Schema unit tests | VERIFIED | Exists; 3 tests run (valid parse, missing-ok rejection, optional message). |
| `packages/agent/src/cli.ts` | commander CLI entry | VERIFIED | 35 lines; imports `Command` from commander + `HealthResponseSchema` from shared; pre-parses `--version --json` (Pitfall 5 mitigation); registers `start` subcommand. |
| `packages/agent/src/cli.test.ts` | Subprocess CLI tests using `spawnSync` | VERIFIED | 5 `it()` blocks; `spawnSync` used 6× (per SUMMARY); `execSync` not present. |
| `packages/agent/tsup.config.ts` | Bundle config inlining shared schema | VERIFIED | `noExternal: ['@agenticapps/dashboard-shared', 'commander', 'zod']`; banner injects shebang + `createRequire` shim (commander CJS interop fix per Plan 02 deviation #4). |
| `packages/agent/package.json` | bin + files + build script + publishConfig | VERIFIED | All Plan 02 fields present (`bin: agentic-dashboard → ./dist/cli.js`, `files: ['dist']`, `private: false`, `dependencies: {}`); Plan 04 metadata added (`keywords`, `homepage`, `bugs`, `repository.directory`, `license: UNLICENSED`, `publishConfig: {access: public, provenance: true, registry: ...}`). |
| `packages/spa/vite.config.ts` | Vite + React + Tailwind 4 plugin chain | VERIFIED | Imports `@vitejs/plugin-react` and `@tailwindcss/vite`; both invoked as plugins; dev port 5174 strict. |
| `packages/spa/src/App.tsx` | Single-route shell with brand line + AgentVersion panel | VERIFIED | Imports `HealthResponseSchema` from shared; module-level `HealthResponseSchema.parse(FALLBACK)` (schema-drift safety net); renders `<h1>AgenticApps Dashboard — alpha</h1>` + `<section role="status" data-testid="agent-version">` with version + status badge + optional message. |
| `packages/spa/src/App.test.tsx` | Renders without crashing in jsdom | VERIFIED | Exists; 3 `it()` blocks (heading, status region, schema parse). |
| `packages/spa/src/styles/global.css` | Tailwind 4 entrypoint via `@import` | VERIFIED | Contains `@import "tailwindcss"` (NOT v3 `@tailwind base/utilities` — Pitfall 6 mitigation); `@theme` block + html/body/#root height 100%. |
| `packages/spa/index.html` | Vite HTML entrypoint | VERIFIED | References `/src/main.tsx`. |
| `README.md` | Repo-root readme with alpha + install + spec link | VERIFIED | 59 lines; alpha notice + install snippet + 6 H2 sections + all required cross-links. |
| `docs/deploy/cloudflare-pages-setup.md` | Reproducible CF Pages dashboard config | VERIFIED | 81 lines; build config + env vars + both Access policies + triage table. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/agent/package.json` | `@agenticapps/dashboard-shared` | `workspace:*` dependency | WIRED | `grep` confirms `"@agenticapps/dashboard-shared": "workspace:*"` in agent devDependencies. Bundle inlines at build (T-00-04). |
| `packages/spa/package.json` | `@agenticapps/dashboard-shared` | `workspace:*` dependency | WIRED | `grep` confirms `"@agenticapps/dashboard-shared": "workspace:*"` in spa dependencies. |
| `packages/agent/src/cli.ts` | `@agenticapps/dashboard-shared` | `import { HealthResponseSchema, type HealthResponse }` | WIRED | Line 2; payload constructed and validated via `.parse()` before stdout emission (line 14). |
| `packages/spa/src/App.tsx` | `@agenticapps/dashboard-shared` | `import { HealthResponseSchema, type HealthResponse }` | WIRED | Line 1; `HealthResponseSchema.parse(FALLBACK)` at module scope (line 11) — schema-drift safety net. |
| `packages/agent/package.json` | `dist/cli.js` | `bin: { agentic-dashboard: "./dist/cli.js" }` | WIRED | npm registers `agentic-dashboard` to dist/cli.js on install; verified via dry-run tarball (9 files, 126.1 kB, includes dist/cli.js). |
| `packages/agent/dist/cli.js` | `node` runtime | shebang `#!/usr/bin/env node` | WIRED | First line of built bundle is `#!/usr/bin/env node`; tsup banner enforces this. |
| `.github/workflows/ci.yml` | pnpm scripts | `pnpm (install|lint|typecheck|test|build)` steps | WIRED | All 5 gate commands present in step order. |
| `.github/workflows/release.yml` | `secrets.NPM_TOKEN` | `NODE_AUTH_TOKEN` env after `registry-url` setup | WIRED | setup-node has `registry-url: 'https://registry.npmjs.org'` (Pitfall 3); publish step has `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. |
| `.github/workflows/release.yml` | `packages/agent/dist/cli.js` | `pnpm --filter @agenticapps/dashboard-agent build` then `pnpm publish` from `packages/agent` | WIRED | Build step + publish step both target the agent package; `prepublishOnly: pnpm build` is a belt-and-suspenders rebuild. |
| `README.md` | `docs/spec/dashboard-prompt.md` | markdown link | WIRED | Line 52 contains `[`docs/spec/dashboard-prompt.md`](docs/spec/dashboard-prompt.md)`. |
| `README.md` | `@agenticapps/dashboard-agent` | `npx @agenticapps/dashboard-agent` install snippet | WIRED | Lines 16–17 contain the verbatim install commands; references match what BOOT-04 ships. |
| `docs/deploy/cloudflare-pages-setup.md` | `packages/spa/dist` | publish dir directive | WIRED | Build configuration table cell exact match. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `packages/spa/src/App.tsx` | `health` | Module-level `fallbackParsed = HealthResponseSchema.parse(FALLBACK)` | Yes — static fallback IS the Phase 0 contract per CONTEXT D-09 (`VITE_AGENT_URL` toggle reserved for Phase 1+). The plan explicitly defines the empty-state render path as the goal-conformant path, and the fallback shape parses against the schema. | FLOWING (intentional static for Phase 0; live fetch is Phase 1 scope per ROADMAP) |
| `packages/agent/src/cli.ts` | `payload` | `AGENT_VERSION` constant + literal `ok: true` + literal message | Yes — the version is sourced from `version.ts` and parses against `HealthResponseSchema` before emission. CLI behavior verified live (`node dist/cli.js --version --json` returns valid JSON). | FLOWING |

The static-fallback render in App.tsx is NOT a hollow stub: D-09 in CONTEXT and the Phase 0 success criteria together specify that the SPA renders the empty state by default in Phase 0; live fetch is a Phase 1 deliverable. The schema parse at module scope ensures any drift in `@agenticapps/dashboard-shared` fails the SPA build, not the runtime.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Five-gate suite green from frozen lockfile | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` | All five exit 0; 12/12 tests across 4 files; 3 packages typecheck; SPA bundle 198kB / 7.5kB CSS; agent bundle 242kB ESM with shebang | PASS |
| Agent CLI emits version | `node packages/agent/dist/cli.js --version` | `0.0.1-alpha.0` (exit 0) | PASS |
| Agent CLI emits placeholder start banner | `node packages/agent/dist/cli.js start` | `agentic-dashboard: alpha placeholder — daemon lands in Phase 1` + register hint (exit 0) | PASS |
| Agent CLI emits HealthResponseSchema-valid JSON | `node packages/agent/dist/cli.js --version --json` | `{"ok":true,"version":"0.0.1-alpha.0","message":"alpha placeholder — daemon lands in Phase 1"}` parses against schema | PASS |
| Agent bundle has shebang as first line | `head -1 packages/agent/dist/cli.js` | `#!/usr/bin/env node` | PASS |
| Agent bundle inlines workspace import (T-00-04) | `grep -c "from\s*['\"]@agenticapps/dashboard-shared['\"]" packages/agent/dist/cli.js` | `0` (no runtime workspace import) | PASS |
| SPA build produces `index.html` containing brand line | `grep -c "AgenticApps Dashboard" packages/spa/dist/index.html` | `1` (matches `<title>AgenticApps Dashboard — alpha</title>`) | PASS |
| SPA build produces Tailwind utilities in CSS bundle | `find packages/spa/dist/assets -name 'index-*.css' -exec grep -l 'mx-auto' {} \;` | One file matches | PASS |
| Agent dry-run publish succeeds with public access | `pnpm publish --dry-run --no-git-checks --tag alpha` from `packages/agent/` | Exit 0; tarball: 9 files, 126.1 kB; "Publishing to https://registry.npmjs.org/ with tag alpha and public access (dry-run)" | PASS |
| Both workflow YAMLs parse | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); yaml.safe_load(open('.github/workflows/release.yml'))"` | Exit 0 | PASS |

All 10 spot-checks PASS.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BOOT-01 | 00-01, 00-03 | pnpm workspace skeleton with `packages/spa`, `packages/agent`, `packages/shared` and a single root lockfile | SATISFIED | All three packages present; `pnpm-workspace.yaml` declares them; root `pnpm-lock.yaml` (170 kB) committed; `pnpm install --frozen-lockfile` exits 0. |
| BOOT-02 | 00-01 | CI workflow runs lint + typecheck + test on push and PR; green on `main` head | SATISFIED (codepath) / NEEDS HUMAN (live `main` status) | `ci.yml` shape verified locally; all 5 gates exit 0 from frozen lockfile. Live "green on main" depends on a merge to main + branch protection — see human verification item 3. |
| BOOT-03 | 00-03, 00-05 | Cloudflare Pages preview deploy works on push to a branch; PR comment links to the preview URL | SATISFIED (codepath) / NEEDS HUMAN (live deploy) | SPA builds to `packages/spa/dist/` with `index.html` containing brand line + hashed JS/CSS bundles. CF Pages config documented in `docs/deploy/cloudflare-pages-setup.md` covering build command, publish dir, root directory, env vars, AND both preview + production Access policies separately. Live preview verification is human verification item 1. |
| BOOT-04 | 00-02, 00-04 | Placeholder agent package published to npm as `@agenticapps/dashboard-agent@0.0.1-alpha.0` | SATISFIED (codepath) / NEEDS HUMAN (live publish) | Agent CLI built and runtime-verified (`--version`, `start`, `--version --json` all behave correctly). `package.json` has full publish metadata including `publishConfig.{access:public, provenance:true}`. Dry-run publish exits 0. `release.yml` triggers on `v*` tag with provenance + publint + attw gates. Live publish is human verification item 2. |
| BOOT-05 | 00-05 | README at repo root with "alpha" notice, install snippet, and link to the spec | SATISFIED | `README.md` line 3 has alpha-notice blockquote; lines 16–18 contain three-command install snippet verbatim from CONTEXT.md; line 52 links to spec. 6 H2 sections, 59 lines (under one-screen ceiling). |

**Coverage:** 5/5 phase requirement IDs accounted for in plans; 5/5 satisfied to the extent verifiable locally; 3/5 (BOOT-02, BOOT-03, BOOT-04) have live-event verification deferred to manual gates.

**Orphans:** None. Every BOOT-* ID claimed by ROADMAP for Phase 0 appears in at least one plan's `requirements:` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/agent/src/cli.ts` | 30 | `console.log('agentic-dashboard: alpha placeholder — daemon lands in Phase 1')` | Info | INTENTIONAL per BOOT-04. The phase goal explicitly requires a *placeholder* binary that prints an alpha-placeholder message; this IS the goal, not a stub. The `alpha placeholder` string is verified by `cli.test.ts` Test 2 as the expected behavior. |
| `packages/spa/src/App.tsx` | 13–17 | Module-level `health = fallbackParsed` (no fetch) | Info | INTENTIONAL per CONTEXT D-09 and ROADMAP (Phase 1 wires the fetch). The static fallback is schema-validated at module scope; data-flow trace classifies as FLOWING for Phase 0 scope. |

No TODO/FIXME/XXX/HACK markers found in any phase source file. No stub returns, no empty handlers, no orphaned files. Both flagged items are the intentional Phase 0 placeholders that the spec calls for — not stubs that masquerade as completion.

### Human Verification Required

#### 1. Cloudflare Pages preview deploy + Access gate (BOOT-03)

**Test:** Push the phase branch to `origin`. Wait ~60–90 seconds for the Cloudflare Pages build, then open the resulting GitHub PR. Click the preview URL in the Cloudflare Pages bot's PR comment.

**Expected:**
- Cloudflare Pages bot comments on the PR within 1–2 minutes with a URL of the form `<hash>.agenticapps-dashboard.pages.dev`.
- Visiting the URL from an incognito browser presents the CF Access email-OTP gate.
- After authenticating, the SPA loads and displays the brand line "AgenticApps Dashboard — alpha" plus the `Agent not running` status row.

**Why human:** Requires live Cloudflare Pages infrastructure plus a CF Access email challenge — both external services that cannot be exercised programmatically from this verifier. Configuration is captured in `docs/deploy/cloudflare-pages-setup.md`; the actual deploy is the manual gate per `00-VALIDATION.md` §"Manual-Only Verifications" rows 1, 2, and 6.

#### 2. npm tag publish + registry verification (BOOT-04)

**Test:**
```bash
git tag v0.0.1-alpha.0
git push origin v0.0.1-alpha.0
# Wait for the Release workflow to complete on GitHub Actions
npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version dist.tarball
cd /tmp && npx --yes @agenticapps/dashboard-agent@0.0.1-alpha.0 start
```

**Expected:**
- `.github/workflows/release.yml` runs end-to-end (install → lint → typecheck → test → build → publint → attw → publish with provenance) and goes green.
- `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version` returns `0.0.1-alpha.0`.
- `npx @agenticapps/dashboard-agent@0.0.1-alpha.0 start` from a clean machine prints the alpha-placeholder message and exits 0.

**Why human:** Requires real npm registry publication, which depends on a user-driven tag push and the GitHub Actions runner reaching the registry with the `NPM_TOKEN` secret. Release workflow shape (YAML parse, all required keys, dry-run publish exits 0 reporting "tag alpha and public access") is verified locally; the live publish event is the manual gate per `00-VALIDATION.md` rows 3 and 4.

#### 3. GitHub branch protection + green CI on `main` (BOOT-02 completion)

**Test:** GitHub repository → Settings → Branches → main → Require status checks to pass before merging → Require `ci` status check. Then merge the phase branch and inspect the `main` HEAD commit's status.

**Expected:** Branch protection rule exists requiring `ci` status. After merging, `main` HEAD shows a green `ci` status check.

**Why human:** GitHub UI configuration that lives outside the repository, plus a successful merge to `main` to actually produce a green `ci` status on the default branch. The CI workflow itself has been verified locally green via the five-gate suite.

### Gaps Summary

No locally-verifiable gaps. All 8 must-haves verified, all 22 artifacts accounted for, all 12 key links wired, no anti-patterns flagged. The phase produces a clean, goal-shaped Phase 0 deliverable.

Three items remain outside the scope of automated verification:

1. **BOOT-03 live deploy** — depends on CF Pages + CF Access (external services).
2. **BOOT-04 live publish** — depends on user-driven `v0.0.1-alpha.0` tag push + npm registry response.
3. **BOOT-02 main-branch status** — depends on GitHub UI branch protection config + merge event.

These three items are explicitly enumerated as manual gates in `.planning/phases/00-bootstrap/00-VALIDATION.md` §"Manual-Only Verifications" and are surfaced as `human_verification` items above. The phase status is `human_needed` rather than `passed` because the developer must complete those gates before the phase can be considered fully accepted.

---

*Verified: 2026-05-02T19:25:00Z*
*Verifier: Claude (gsd-verifier)*
