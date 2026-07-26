---
phase: 00-bootstrap
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - .editorconfig
  - .gitattributes
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .gitignore
  - .nvmrc
  - README.md
  - docs/deploy/cloudflare-pages-setup.md
  - eslint.config.mjs
  - package.json
  - packages/agent/.npmignore
  - packages/agent/package.json
  - packages/agent/src/cli.test.ts
  - packages/agent/src/cli.ts
  - packages/agent/src/index.test.ts
  - packages/agent/src/index.ts
  - packages/agent/src/version.ts
  - packages/agent/tsconfig.json
  - packages/agent/tsup.config.ts
  - packages/agent/vitest.config.ts
  - packages/shared/package.json
  - packages/shared/src/index.ts
  - packages/shared/src/schemas/health.test.ts
  - packages/shared/src/schemas/health.ts
  - packages/shared/tsconfig.json
  - packages/shared/vitest.config.ts
  - packages/spa/.gitignore
  - packages/spa/index.html
  - packages/spa/package.json
  - packages/spa/src/App.test.tsx
  - packages/spa/src/App.tsx
  - packages/spa/src/index.ts
  - packages/spa/src/main.tsx
  - packages/spa/src/styles/global.css
  - packages/spa/src/test-setup.ts
  - packages/spa/src/vite-env.d.ts
  - packages/spa/tsconfig.json
  - packages/spa/vite.config.ts
  - packages/spa/vitest.config.ts
  - pnpm-workspace.yaml
  - prettier.config.mjs
  - tsconfig.base.json
  - vitest.config.ts
  - CLAUDE.md
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 0: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 44 (43 in scope + CLAUDE.md context)
**Status:** issues_found

## Summary

Phase 0 lands a clean, internally-consistent pnpm workspace skeleton: catalog-managed deps, Vitest 4 `test.projects`, three packages with disciplined `exports` shapes, a single shared Zod schema (`HealthResponseSchema`) parsed identically on the agent CLI side and the SPA fallback side, and a release workflow that does the right things (OIDC `id-token: write` only on `release.yml`, `--frozen-lockfile` everywhere, `--provenance --access public` on publish, `publint` + `attw` gates before npm). Tests exercise the *built* CLI artifact via `spawnSync` rather than the source — an excellent choice that catches tsup/banner/shebang regressions.

**Architectural-constraint compliance is strong for a bootstrap phase.** No daemon writes; no native deps in `packages/agent/` (only `commander` + bundled `zod` + the workspace shared package); no Phase 1 routes were prematurely wired, so bearer-token auth is correctly deferred; SPA fetches nothing yet, so the optional `VITE_AGENT_URL` SSRF/path-traversal surface flagged in the prompt does not exist here (this is the right outcome — the constraint was honored by *not* prematurely wiring it).

**No critical issues.** Four warnings, all about dependency-version sanity rather than logic bugs — the kind of things that bite Phase 1 onward if not addressed. Six info items cover dead deps, duplication between root and SPA, and minor contract-design concerns that should be resolved before Phase 1 reuses the schema.

The Phase 0 bar is "the install path works against your shell environment before the daemon ships," and the code meets that bar — but the catalog versions look like they were written from a hypothetical "near-future" snapshot rather than verified against npm registry, and that deserves a hard look before merging.

## Warnings

### WR-01: Catalog pins reference unreleased major versions of TypeScript and Vite

**File:** `pnpm-workspace.yaml:7`, `pnpm-workspace.yaml:30`
**Issue:** The catalog pins `typescript: ^6.0.0` and `vite: ^8.0.10`. As of this review, **TypeScript 6.x has not been released** (current stable is 5.x) and **Vite 8.x has not been released** (current stable is Vite 7). These constraints can only resolve if a pre-release was published or if the assumption is that 6.0 / 8.0 will exist by the time CI runs. If `pnpm install --frozen-lockfile` ever needs to re-resolve these (e.g., a new contributor on a fresh checkout against an updated `pnpm-workspace.yaml`), it will fail. Worse, if a 6.0.0-beta or 8.0.0-beta lands, the project will silently take it.

This is also load-bearing for `tsconfig.base.json:9` `"ignoreDeprecations": "6.0"` — the `"6.0"` value is only valid if the compiler actually understands it, which only TS 5.5+ does (and the literal `"6.0"` is the value to silence "deprecated in 5.x, removed in 6.x" warnings, intended to be parsed by 5.x). With `typescript: ^6.0.0` in the catalog, this combination is incoherent.

**Fix:** Pin to actually-released versions. Likely intent (verify against `pnpm view` before changing):
```yaml
# pnpm-workspace.yaml
typescript: ^5.7.0   # latest 5.x at time of writing
vite: ^7.0.0         # latest 7.x at time of writing
```
And confirm `pnpm-lock.yaml` (committed in `0808baf`'s tree) actually resolved both — if the lockfile pins something like `5.7.2` and `7.x.y`, the catalog ranges are simply wrong but functional; if it pins a beta, that's a supply-chain issue. Run `pnpm why typescript` and `pnpm why vite` to confirm. If TS 6 / Vite 8 truly were intended, document it in `pnpm-workspace.yaml` with a comment matching the existing ESLint-9 rationale block.

### WR-02: React 18 runtime paired with React 19 type packages

**File:** `pnpm-workspace.yaml:26-29`
**Issue:** Runtime is pinned `react: ^18.3.1` and `react-dom: ^18.3.1`, but the type packages are `@types/react: ^19.2.14` and `@types/react-dom: ^19.2.3`. React 19 made non-trivial type changes (most notably: `children` is no longer implicit on `FC`, `JSX` namespace moved off the global, ref handling changed). Mixing R18 runtime + R19 types produces typecheck failures or — worse — false-positive types that compile but disagree with what React 18 actually accepts at runtime.

Today this happens to compile because `App.tsx` uses no FC, no children-receiving components, and no refs. Phase 2+ (real components, real refs) will hit this immediately.

**Fix:** Match the major. Either:
```yaml
# Option A — stay on React 18 (matches package.json runtime intent)
'@types/react': ^18.3.12
'@types/react-dom': ^18.3.1
```
Or upgrade runtime to React 19 to match the types (and bump `react` / `react-dom` catalog entries accordingly). Pick one; do not ship the mismatch.

### WR-03: SPA conflates "agent unreachable" with "agent reports unhealthy" in the fallback shape

**File:** `packages/spa/src/App.tsx:3-7`
**Issue:** The Phase 0 fallback constructs a `HealthResponse` with `ok: false, version: 'not running', message: 'Agent not running'`. The `version` field (`packages/shared/src/schemas/health.ts:5`) is `z.string()` with no format constraint, so the literal `'not running'` parses cleanly. But this means the wire schema cannot distinguish "we never reached the agent" from "agent is up and reporting `ok: false` for an internal reason" (e.g., daemon up but its downstream filesystem watcher is broken).

In Phase 1, when the SPA actually fetches, this conflation will leak: a network error and a 200-with-`ok:false` will both end up rendering the same string. The architectural contract says the SPA must surface schema drift immediately — but it should equally surface *transport state* immediately.

**Fix:** Treat reachability as state outside `HealthResponse`. Two-line refactor when Phase 1 wires the fetch — but cleanest to design now while no consumer exists:
```typescript
// packages/spa/src/App.tsx
type AgentStatus =
  | { kind: 'unreachable' }
  | { kind: 'healthy'; data: HealthResponse }
  | { kind: 'drift'; error: z.ZodError }

// Phase 0:
const status: AgentStatus = { kind: 'unreachable' }
```
The render path branches on `status.kind`; no fake-version string ever exists. This also keeps `HealthResponse` honest as "what the agent emitted" instead of "what the SPA wants to render in any state."

### WR-04: `cli.test.ts` silently runs `pnpm build` from `beforeAll` — non-hermetic and 60s timeout-bound

**File:** `packages/agent/src/cli.test.ts:13-20`
**Issue:** Each `vitest run` invocation rebuilds the bundle via `spawnSync('pnpm', ['build'], { stdio: 'inherit' })` inside `beforeAll`. Three problems:
1. **Hermeticity:** the test depends on `pnpm` being on `PATH`, on the workspace being installed, and on `tsup` being available. If a developer runs `pnpm --filter @agenticapps/dashboard-agent test` after deleting `node_modules`, the test fails for an unrelated reason (no `tsup`).
2. **Timeout fragility:** the 60s ceiling is fine on a warm machine; on a cold CI runner or constrained sandbox, tsup + dts emit can flirt with that ceiling. When it expires, vitest reports an opaque hook failure rather than a build error.
3. **Stdio mode `'inherit'`:** when the build *does* fail, the error message goes to the parent terminal, not the test report — fine locally, confusing in a CI log filter.

The test is correct in *what* it exercises (the published artifact, not the source). The mechanism just needs hardening.

**Fix:** Either run the build as a vitest `globalSetup` step (one build per `vitest` invocation, not per file) and capture stdout/stderr; or have the CI workflow run `pnpm --filter @agenticapps/dashboard-agent build` *before* `pnpm test --run` and have the test only assert the artifact exists. The CI workflow already runs `pnpm build` after `pnpm test --run` (`.github/workflows/ci.yml:39-43`) — flipping the order would let `cli.test.ts` skip the rebuild entirely:
```yaml
# .github/workflows/ci.yml
- name: Build
  run: pnpm build
- name: Test
  run: pnpm test --run
```
Then `cli.test.ts:13-20` becomes:
```typescript
beforeAll(() => {
  if (!existsSync(cliBundle)) {
    throw new Error(`dist/cli.js missing — run "pnpm --filter @agenticapps/dashboard-agent build" first`)
  }
})
```
This keeps the "test the built artifact" property without coupling the test to pnpm/tsup availability.

## Info

### IN-01: Unused dependencies declared in SPA package

**File:** `packages/spa/package.json:15-16`
**Issue:** `@tanstack/react-query` and `lucide-react` are listed as runtime deps but are never imported in `packages/spa/src/`. The Phase 0 plan documents these as "reserved for Phase 1+" so Wave 2 plans were parallelizable, which is reasonable. But shipping them in `package.json` with no import means:
- they hit the SPA bundle as transitive resolution candidates,
- they invite supply-chain risk for code that doesn't exist yet,
- the `lucide-react: ^1.14.0` pin in the catalog is also suspect — the published lucide-react package is in the `0.x` series (latest known: `0.460.x`); `^1.14.0` does not match any released version I'm aware of.
**Fix:** Either land the deps in the Phase 1 plan that first imports them (preferred — keeps "added when needed" hygiene), or keep them with a `// reserved for Phase 1` comment and verify `lucide-react` is a real version (`pnpm view lucide-react versions --json`).

### IN-02: `@types/node` hard-pinned in agent instead of via catalog

**File:** `packages/agent/package.json:48`
**Issue:** Every other devDep in the workspace uses `"catalog:"` for cross-package consistency, but `@types/node` is hard-pinned `^20.19.39` in the agent package. The shared package and SPA package don't declare `@types/node` at all (relying on transitive resolution), so a future drift here is plausible.
**Fix:** Add `@types/node: ^20.19.39` to the catalog in `pnpm-workspace.yaml`, replace the literal version with `"catalog:"`. If you don't want to put a node-specific type in a "cross-cutting" catalog section, that's fine — but at least centralize it in the catalog with a "Node-only" comment block.

### IN-03: ESLint react plugins duplicated between root and SPA package.json

**File:** `package.json:28-29`, `packages/spa/package.json:27-28`
**Issue:** `eslint-plugin-react` and `eslint-plugin-react-hooks` are listed as devDeps in both the root and `packages/spa/`. The actual import is at `eslint.config.mjs:4-5` (root). The SPA package never imports them directly. With pnpm hoisting they happen to resolve, but the duplication invites version drift if someone changes one and forgets the other.
**Fix:** Remove from `packages/spa/package.json`. The root devDep + catalog pin is the single source of truth.

### IN-04: `firstLine` typing relies on test-runtime tolerance, not the type system

**File:** `packages/agent/src/cli.test.ts:47-48`
**Issue:** `tsconfig.base.json:8` enables `noUncheckedIndexedAccess: true`, so `readFileSync(cliBundle, 'utf8').split('\n')[0]` is typed `string | undefined`. The `expect(firstLine).toBe(...)` matcher accepts `unknown`, so typecheck passes — but if the bundle is ever empty the assertion error message will be cryptic ("expected undefined to be '#!/usr/bin/env node'") instead of telling you the bundle is empty.
**Fix:** Narrow once at the top of the assertion:
```typescript
const contents = readFileSync(cliBundle, 'utf8')
expect(contents.length).toBeGreaterThan(0)
const [firstLine] = contents.split('\n')
expect(firstLine).toBe('#!/usr/bin/env node')
```

### IN-05: README claims `dashboard.agenticapps.eu` but production URL is the pages.dev subdomain

**File:** `README.md:47`
**Issue:** This file is internally consistent ("Custom domain `dashboard.agenticapps.eu` is deferred to a later phase. Production URL stays `*.pages.dev` through v1") but `CLAUDE.md` line "Static SPA deployed to Cloudflare Pages at `dashboard.agenticapps.eu`" and the architectural-constraint "CORS locked to `https://dashboard.agenticapps.eu`" still reference the deferred custom domain as if active. When Phase 1 starts wiring CORS allow-lists in the agent, this will need a "is the prod CORS origin `*.pages.dev` or the eu domain?" decision.
**Fix:** No change needed to Phase 0 code — this is a Phase 1 plan-input note. Surface the question via `/gsd-discuss-phase 1` before the plan locks the CORS origin string. (If you want one change now: extend the `README.md` Architecture bullet to say "CORS allow-list will be `agenticapps-dashboard.pages.dev` until the custom domain lands.")

### IN-06: Local `dist/cli.js` in `packages/agent/` is an executable artifact, not a source file (gitignored, but worth noting)

**File:** `packages/agent/.npmignore:1`, `packages/agent/package.json:27`
**Issue:** `bin.agentic-dashboard` points at `./dist/cli.js`, but `dist/` is in the root `.gitignore`. Until a contributor runs `pnpm --filter @agenticapps/dashboard-agent build`, the bin path is dangling. The `prepublishOnly: pnpm build` script saves npm publish, but `pnpm install` does not run that, so a fresh `npm link` or `pnpm link` against this package will fail until built.
**Fix:** Document in the README "after `pnpm install`, run `pnpm build` before `npm link`-ing the agent locally." Or add a `postinstall: pnpm --filter @agenticapps/dashboard-agent build` to the root package.json (with a guard to skip in CI). The former is simpler and keeps `pnpm install` fast; recommended.

---

## Architectural-constraint review (per CLAUDE.md "Hard architectural constraints")

| Constraint | Status | Evidence |
|---|---|---|
| Read-only on project filesystems | OK | No daemon code wired in Phase 0; no fs writes anywhere outside `dist/` build output. |
| Path allow-list per project | N/A | No daemon routes yet; revisit at Phase 1. |
| Daemon writes confined to `~/.agenticapps/dashboard/` with `0600` | N/A | No daemon code yet; revisit at Phase 1. |
| No native deps in `packages/agent/` | OK | `dependencies: {}` in agent package.json; bundled deps via `tsup noExternal: ['@agenticapps/dashboard-shared', 'commander', 'zod']` are all pure-JS. No keytar, no FFI. Confirmed. |
| Bearer-token auth on every route | N/A | No routes yet; the prompt asked whether scaffolding *weakens* this default — answer: no scaffolding was added in Phase 0 that touches auth surface. |
| Optional integrations stay optional | OK | No Sentry/Linear/Infisical wiring. |
| No Cloudflare Workers / Pages Functions in v1 | OK | `docs/deploy/cloudflare-pages-setup.md:8` confirms pure-static. No `functions/` or `_worker.js` anywhere. |
| SPA holds no user data | OK | `App.tsx` renders only the static fallback constant; no localStorage, no IndexedDB, no Service Worker. |
| `impeccable:critique` ≥ 90 | Out of scope for this review | Visual/design check, not a code-review concern. |

## Supply-chain review

| Item | Status | Notes |
|---|---|---|
| Pinned action versions | OK | `actions/checkout@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v4`. Major-version pins (CI standard); SHA-pinning would be stricter but is not required at this phase. |
| `--frozen-lockfile` on install | OK | Both `ci.yml:31` and `release.yml:33` use it. |
| OIDC `id-token: write` only where needed | OK | `release.yml:14` declares it; `ci.yml:9-10` only has `contents: read`. Correctly scoped. |
| `--provenance --access public` on publish | OK | `release.yml:57`. Good. |
| `publint` + `attw` before publish | OK | `release.yml:47-53`. Two-gate validation. |
| `prepublishOnly` runs build | OK | `packages/agent/package.json:43`. |
| `.npmignore` excludes source | OK | `packages/agent/.npmignore` keeps only `dist/` (via `files: ["dist"]` in package.json — `.npmignore` is belt-and-suspenders). |
| Lockfile committed | OK | `pnpm-lock.yaml` was added in the diff range (per `git diff --name-only`). |

## Phase 0 SSRF/path-traversal surface review

The prompt asked specifically about the SPA's optional `VITE_AGENT_URL` fetch path and any empty-state info-leak. **Both surfaces are absent in Phase 0**:

- `packages/spa/src/App.tsx:14-18`: explicit comment "Phase 0: no fetch wired. VITE_AGENT_URL feature toggle reserved for Phase 1+." `App.tsx` only reads from a hardcoded `FALLBACK` constant. `import.meta.env` is not accessed anywhere in the SPA source (`grep` confirmed).
- The empty-state copy ("Agent not running") is a static string — no path, hostname, port, or env fragment is rendered. No info leak.

When Phase 1 lands the fetch, the constraint to enforce will be: `URL` constructor with allowlisted host (`127.0.0.1:5193` or a configured Tailscale hostname), reject any `file:`, `gopher:`, etc. scheme, reject any URL whose host resolves to a non-loopback/non-Tailscale range. That belongs in the Phase 1 plan, not here.

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
