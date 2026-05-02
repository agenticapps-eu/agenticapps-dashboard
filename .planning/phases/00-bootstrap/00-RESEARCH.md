# Phase 0: Bootstrap - Research

**Researched:** 2026-05-02
**Domain:** pnpm workspace bootstrap, GitHub Actions CI/CD, Cloudflare Pages, Vite + React + Tailwind 4, Vitest workspace mode, commander CLI, npm provenance publishing
**Confidence:** HIGH — all stack versions verified against npm registry; workflow patterns verified against official docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Lint + format = ESLint + Prettier. Use `@typescript-eslint`, `eslint-plugin-import`, and Prettier with single root config; per-package overrides only when genuinely needed.
- **D-02:** Test runner = Vitest for both SPA and agent. Single test command across the workspace.
- **D-03:** TypeScript strict mode in every package. Per-package `tsconfig.json` extends root `tsconfig.base.json`. No project references in v1.
- **D-04:** Workspace dependency strategy = pnpm catalog. Requires pnpm >= 9.5.
- **D-05:** Node version pinning = `.nvmrc` (Node 20 LTS) + `engines` field in root `package.json`. CI sets up Node from `.nvmrc`.
- **D-06:** `packages/shared` ships a single `HealthResponseSchema` (Zod) in Phase 0. Placeholder agent and SPA both parse it. Purpose: prove cross-package contract end-to-end.
- **D-07:** Placeholder agent = minimal commander CLI stub. `agentic-dashboard --version` prints version + HealthResponseSchema-shaped payload. `agentic-dashboard start` prints alpha-placeholder message. No Hono server.
- **D-08:** Published to npm as `@agenticapps/dashboard-agent@0.0.1-alpha.0` via `release.yml` triggered on `v*` tag. No Changesets.
- **D-09:** Placeholder SPA = Vite + React + TS + Tailwind shell, single route `/` showing "AgenticApps Dashboard — alpha" and agent version (hardcoded local URL, feature toggle, falls back to static empty state).
- **D-10:** GitHub Actions `ci.yml` triggered on push and pull_request. Single sequential job: install → lint → typecheck → test → build.
- **D-11:** Cloudflare Pages deploy uses Pages Git integration set up pre-flight. No `cloudflare/pages-action` in Phase 0.
- **D-12:** `release.yml` separate from `ci.yml`. Triggered on `v*` tag push. Uses `NPM_TOKEN` from GH secrets.
- **D-13:** No LICENSE file in Phase 0.
- **D-14:** No husky/commitlint in Phase 0.
- **D-15:** Workflow commitment ritual is mandatory in every implementing session.
- **D-16:** No native dependencies in `packages/agent` (no keytar, no FFI).
- **D-17:** No Cloudflare Workers / Pages Functions. SPA stays pure-static.
- **D-18:** Read-only on project filesystems honored vacuously (no FS-touching code in Phase 0).

### Claude's Discretion

- File naming, internal package naming — recommend `@agenticapps/dashboard-{spa,agent,shared}`.
- Exact ESLint/Prettier config keys — pick reasonable defaults; no controversial style rules.
- README copy beyond required "alpha" notice + install snippet.
- Whether to add `.editorconfig` — yes, default.
- Whether to add `.gitattributes` — yes, default (LF line endings, normalize text files).

### Deferred Ideas (OUT OF SCOPE)

- Project references in `tsconfig.json` — revisit Phase 4/5 if incremental build times are painful.
- Changesets — revisit Phase 7 if multiple packages need to publish.
- Splitting CI into parallel jobs — revisit if sequential run exceeds ~3 min.
- LICENSE (MIT) — Phase 8.
- husky / commitlint enforcement — Phase 6.
- Custom domain `dashboard.agenticapps.eu` — deferred through v1.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOT-01 | pnpm workspace skeleton with `packages/spa`, `packages/agent`, `packages/shared` and single root lockfile | pnpm catalog syntax, workspace: protocol, tsconfig strategy — all covered below |
| BOOT-02 | CI workflow runs lint + typecheck + test on push and PR; green on `main` head | GitHub Actions workflow patterns, pnpm/action-setup v6, setup-node v4 — covered below |
| BOOT-03 | Cloudflare Pages preview deploy works on push to branch; PR comment links to preview URL | CF Pages Git integration behavior, preview URL format, Access policy configuration — covered below |
| BOOT-04 | Placeholder agent published to npm as `@agenticapps/dashboard-agent@0.0.1-alpha.0` | commander CLI boilerplate, release.yml pattern, npm provenance — covered below |
| BOOT-05 | README at repo root with "alpha" notice, install snippet, link to spec | Content requirements from spec — covered in Architecture Patterns |
</phase_requirements>

---

## Summary

Phase 0 is a pure infrastructure phase: no product logic, only the plumbing that every subsequent phase inherits. The research reveals no blocking unknowns. All locked decisions (pnpm catalog, ESLint + Prettier, Vitest, Tailwind 4, commander, CF Pages Git integration) have clear, current canonical patterns verified against official docs and npm registry.

The most consequential technical detail is the **shared package strategy for `packages/shared`**: for Phase 0's single schema, the simplest viable approach is a source-only package (no build step, `"type": "module"`, exports pointing to `.ts` via a custom condition). Both Vite and Vitest resolve TypeScript sources directly in monorepo mode; the Node CLI (run via `tsx` in dev, `tsc` for publish) also consumes them. This avoids a build pipeline for `shared` in Phase 0 and defers that complexity to Phase 1 when the contract stabilizes.

Tailwind 4 is stable (released January 2026, v4.2.4 on npm) and the preferred choice. The `@tailwindcss/vite` plugin is the canonical integration — no separate PostCSS config needed when using it. The `tailwind.config.js` is gone; configuration lives in the main CSS file via `@theme {}` blocks.

Cloudflare Pages preview URLs are automatically generated for every branch push as `<hash>.agenticapps-dashboard.pages.dev`. CF Access policies set on the Pages project cover preview URLs only by default — the production `.pages.dev` domain requires a separate Access policy if the user wants it gated too (currently handled via CF dashboard, not code).

**Primary recommendation:** Scaffold all three packages with source-only `shared`, wire Vitest `test.projects` at root, use Tailwind 4 + `@tailwindcss/vite`, and establish the `ci.yml` / `release.yml` GitHub Actions patterns before any package has real content — one smoke plan proving the whole plumbing end-to-end.

---

## Standard Stack

### Core — Root / Workspace Level

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.33.2 (local) | Package manager + workspace | User has pnpm 9+; catalog feature requires ≥9.5 |
| typescript | 6.0.3 | Type checking across all packages | Required by D-03 strict mode |
| vitest | 4.1.5 | Test runner (all packages) | D-02; Vite-native; `test.projects` for monorepo |
| @vitest/coverage-v8 | 4.1.5 | Coverage provider | AST-based v8 coverage, identical accuracy to istanbul in v4+ |
| eslint | 10.3.0 | Linting (D-01) | Required by D-01 |
| typescript-eslint | 8.59.1 | TS-aware lint rules (flat config) | Modern unified package; replaces separate `@typescript-eslint/*` |
| eslint-plugin-import | 2.32.0 | Import order checking | D-01 specifies import plugin |
| prettier | 3.8.3 | Code formatting (D-01) | Required by D-01 |
| eslint-config-prettier | 10.1.8 | Disable ESLint rules that conflict with Prettier | Standard companion |
| zod | 3.24.x — see catalog note | Schema validation | Required by spec; shared across SPA + agent |

[VERIFIED: npm registry — all versions]

**pnpm catalog entry for zod:** `npm view zod version` = 3.24.x is the stable series. Zod 4 is in beta; use `^3.24.0` in catalog until Zod 4 reaches stable.

### `packages/spa`

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 18.3.1 | UI framework | Spec requires React 18 |
| react-dom | 18.3.1 | DOM rendering | Required with React |
| @types/react | 19.2.14 | React TS types | Companion to React 18 (types pkg is ahead of React version) |
| @types/react-dom | 19.2.3 | DOM TS types | Companion |
| vite | 8.0.10 | Build tool + dev server | D-09; Vite-native test runner |
| @vitejs/plugin-react | 6.0.1 | React JSX transform | Standard Vite + React integration |
| tailwindcss | 4.2.4 | Utility CSS | Spec requirement; v4 stable since Jan 2026 |
| @tailwindcss/vite | 4.2.4 | Tailwind v4 Vite plugin | First-party; replaces PostCSS path; better perf |
| @tanstack/react-query | 5.100.8 | Data fetching / polling | Spec requirement |
| lucide-react | 1.14.0 | Icon library | Spec requirement |
| eslint-plugin-react | 7.37.5 | React-specific lint rules | Standard with ESLint + React |
| eslint-plugin-react-hooks | 7.1.1 | Hooks lint rules | Required for React hooks correctness |
| jsdom | 29.1.1 | DOM environment for Vitest | SPA tests need browser globals |
| @testing-library/react | 16.3.2 | React component testing | Standard testing approach |

[VERIFIED: npm registry — all versions]

### `packages/agent`

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing | D-07; spec lists commander |
| tsx | latest | Run TS source directly (dev/test only) | Zero-build-step dev workflow |

[VERIFIED: npm registry]

**Note on tsx:** Phase 0 placeholder needs zero real runtime deps beyond commander. `tsx` is a dev-only tool; the published npm package will use compiled JS. For Phase 0, running the CLI locally can be done via `tsx src/cli.ts` without a full build pipeline.

### `packages/shared`

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | catalog: | Schema validation (HealthResponseSchema) | D-06; shared across packages |

No additional runtime deps. `shared` is source-only in Phase 0 — no bundler.

### Supporting / Dev-only (root)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| publint | 0.3.18 | Validates npm package exports before publish | Run in `release.yml` pre-publish |
| @arethetypeswrong/cli | 0.18.2 | Validates TS type exports | Run in `release.yml` pre-publish |

[VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind v4 | Tailwind v3.4 | v3 has more ecosystem examples but v4 is stable, faster, CSS-first config, no `tailwind.config.js` needed |
| typescript-eslint flat config | Old `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` separately | Old approach requires two packages; `typescript-eslint` unified package is current recommended |
| `@tailwindcss/vite` plugin | PostCSS `@tailwindcss/postcss` | Both work; Vite plugin is faster and removes `postcss.config.js` entirely |
| `test.projects` in root vitest.config | `pnpm -r test` per-package | `test.projects` gives unified coverage report and single test command; `pnpm -r` has no cross-package coverage |
| Source-only `packages/shared` | Built `dist/` with tsup | Source-only is zero overhead for Phase 0; build pipeline adds complexity deferred to Phase 1+ |

**Installation command (once scaffolded):**

```bash
# Root devDependencies
pnpm add -D -w typescript vitest @vitest/coverage-v8 eslint typescript-eslint \
  eslint-plugin-import eslint-plugin-react eslint-plugin-react-hooks \
  eslint-config-prettier prettier publint @arethetypeswrong/cli

# packages/spa
pnpm --filter @agenticapps/dashboard-spa add react react-dom @tanstack/react-query lucide-react
pnpm --filter @agenticapps/dashboard-spa add -D vite @vitejs/plugin-react tailwindcss \
  @tailwindcss/vite @types/react @types/react-dom jsdom @testing-library/react

# packages/agent
pnpm --filter @agenticapps/dashboard-agent add commander
pnpm --filter @agenticapps/dashboard-agent add -D tsx

# packages/shared
pnpm --filter @agenticapps/dashboard-shared add zod
```

**Version verification:** All versions confirmed via `npm view <pkg> version` on 2026-05-02.

---

## Architecture Patterns

### Recommended Project Structure

```
agenticapps-dashboard/
├── .nvmrc                     # "20" — Node 20 LTS pinning
├── .editorconfig              # LF endings, 2-space indent
├── .gitattributes             # * text=auto eol=lf; *.png binary
├── .gitignore                 # node_modules, dist, .planning build artifacts
├── pnpm-workspace.yaml        # packages: ['packages/*'] + catalog:
├── package.json               # root: private:true, scripts: lint/typecheck/test/build
├── tsconfig.base.json         # shared strict TS config; no project refs
├── eslint.config.mjs          # flat config; typescript-eslint + prettier
├── prettier.config.mjs        # shared prettier config
├── vitest.config.ts           # root; test.projects: ['packages/*']
├── README.md                  # alpha notice + install snippet
├── .github/
│   └── workflows/
│       ├── ci.yml             # push + PR: install → lint → typecheck → test → build
│       └── release.yml        # push v* tags: gates + npm publish --provenance
└── packages/
    ├── shared/
    │   ├── package.json       # name: @agenticapps/dashboard-shared; private: true
    │   ├── tsconfig.json      # extends ../../tsconfig.base.json
    │   └── src/
    │       ├── index.ts       # re-exports HealthResponseSchema + type
    │       └── schemas/
    │           └── health.ts  # HealthResponseSchema definition
    ├── agent/
    │   ├── package.json       # name: @agenticapps/dashboard-agent; bin: agentic-dashboard
    │   ├── tsconfig.json      # extends ../../tsconfig.base.json; module: Node16
    │   └── src/
    │       ├── cli.ts         # commander entry, shebang, --version + start commands
    │       └── cli.test.ts    # Vitest smoke test: spawn CLI, check exit code + output
    └── spa/
        ├── package.json       # name: @agenticapps/dashboard-spa; private: true
        ├── tsconfig.json      # extends ../../tsconfig.base.json
        ├── vite.config.ts     # @vitejs/plugin-react + @tailwindcss/vite
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx        # single route: "AgenticApps Dashboard — alpha"
            ├── App.test.tsx   # renders without crash
            └── styles/
                └── global.css # @import "tailwindcss"
```

### Pattern 1: pnpm Catalog

**What:** Define shared dependency versions once in `pnpm-workspace.yaml`; each package references via `catalog:`.
**Minimum version:** pnpm 9.5 [VERIFIED: socket.dev/blog/pnpm-9-5-introduces-catalogs]
**When to use:** Any dep shared across ≥2 packages.

```yaml
# pnpm-workspace.yaml
# Source: https://pnpm.io/catalogs
packages:
  - 'packages/*'

catalog:
  zod: ^3.24.0
  typescript: ^6.0.0
  vitest: ^4.1.5
  "@vitest/coverage-v8": ^4.1.5
  eslint: ^10.3.0
  typescript-eslint: ^8.59.1
  prettier: ^3.8.3
```

```json
// packages/shared/package.json (excerpt)
{
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Gotcha:** `pnpm update` does not support catalogs yet — update versions manually in `pnpm-workspace.yaml`. The `catalog:` specifier is replaced with resolved version before publishing (same as `workspace:`). [VERIFIED: pnpm.io/catalogs]

### Pattern 2: Source-Only Shared Package (No Build Step)

**What:** `packages/shared` exports TypeScript source directly. Vite and Vitest both resolve `.ts` files in monorepo mode without a dist/ directory.
**When to use:** Phase 0 single-schema scenario; defer build pipeline to Phase 1 when schema surface grows.

```json
// packages/shared/package.json
{
  "name": "@agenticapps/dashboard-shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "devDependencies": {
    "zod": "catalog:"
  }
}
```

**How consuming packages reference it:**
```json
// packages/agent/package.json
{
  "dependencies": {
    "@agenticapps/dashboard-shared": "workspace:*"
  }
}
```

**How Vite resolves it:** Vite follows the `exports` field and finds the `.ts` source. Vitest does the same because it shares Vite's resolution logic. tsx (for agent dev) resolves `.ts` directly.

**Limitation:** This approach does NOT work for npm publish of the agent if shared is declared as a runtime dep. Since shared is `"private": true` and only agent's CLI output is published, the agent must inline or bundle the schema at publish time — OR (simpler for Phase 0) the agent dev-depends on shared and includes the schema inline in the published output. Phase 0 can simply duplicate the one schema in the agent for publishing, since the agent is a placeholder; or use `tsup` bundle at publish. [ASSUMED — multiple valid approaches exist; the planner should pick the simplest one given it's a placeholder publish]

### Pattern 3: Vitest Root Config with `test.projects`

**What:** Single `vitest.config.ts` at repo root discovers all package test suites.
**Minimum Vitest version:** 3.2+ (workspace deprecated in favor of `projects`); using Vitest 4.x.

```typescript
// vitest.config.ts (root)
// Source: https://vitest.dev/guide/projects
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**'],
    },
  },
})
```

```typescript
// packages/spa/vitest.config.ts (per-package; sets environment)
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    name: 'spa',
    environment: 'jsdom',
  },
})
```

```typescript
// packages/agent/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'agent',
    environment: 'node',
  },
})
```

```typescript
// packages/shared/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'shared',
    environment: 'node',
  },
})
```

**All projects must have unique names** — Vitest throws if two projects share a name. [VERIFIED: vitest.dev/guide/projects]

### Pattern 4: Tailwind CSS v4 + Vite

**What:** Tailwind v4 uses a CSS-first approach. No `tailwind.config.js`. Import Tailwind via CSS.
**When to use:** New Vite + React project on Tailwind 4.

```typescript
// packages/spa/vite.config.ts
// Source: https://tailwindcss.com/blog/tailwindcss-v4
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // Tailwind v4 Vite plugin — replaces PostCSS path
  ],
})
```

```css
/* packages/spa/src/styles/global.css */
@import "tailwindcss";

/* Custom theme tokens (replaces tailwind.config.js extend.colors etc.) */
@theme {
  --color-brand: oklch(0.55 0.2 260);
}
```

**Key v4 changes from v3:**
- `@tailwind base/components/utilities` directives → single `@import "tailwindcss"`
- `bg-gradient-*` → `bg-linear-*`
- `tailwind.config.js` entirely gone; configuration in CSS via `@theme {}`
- No `content:` array needed — automatic content detection
- Colors migrated to oklch palette (wider gamut)

[VERIFIED: tailwindcss.com/blog/tailwindcss-v4]

### Pattern 5: commander CLI with ESM and Shebang

**What:** Node 20 ESM CLI using commander, publishable via npm with `bin` field.

```typescript
// packages/agent/src/cli.ts
#!/usr/bin/env node
// Source: https://github.com/tj/commander.js#node-options
import { Command } from 'commander'
import { version } from '../package.json' assert { type: 'json' }

const program = new Command()

program
  .name('agentic-dashboard')
  .description('AgenticApps Dashboard Agent')
  .version(version)

program
  .command('start')
  .description('Start the dashboard agent daemon')
  .action(() => {
    console.log('alpha placeholder — daemon lands in Phase 1')
    process.exit(0)
  })

program.parse()
```

```json
// packages/agent/package.json (excerpt)
{
  "name": "@agenticapps/dashboard-agent",
  "version": "0.0.1-alpha.0",
  "type": "module",
  "bin": {
    "agentic-dashboard": "./dist/cli.js"
  },
  "files": ["dist/"],
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Shebang + ESM:** `#!/usr/bin/env node` works with ESM entry files on Node 20+. The file must be `.js` (or `.mjs`) in the published dist, not `.ts`. [VERIFIED: Node.js docs — ESM + bin fields]

**Testing the CLI in Vitest:**
```typescript
// packages/agent/src/cli.test.ts
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// In tests, invoke via tsx to avoid requiring a compiled dist/
const cliPath = resolve(__dirname, 'cli.ts')

describe('agentic-dashboard CLI', () => {
  it('exits 0 with --version', () => {
    const result = spawnSync('node', ['--import', 'tsx/esm', cliPath, '--version'], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
  })

  it('exits 0 with start command', () => {
    const result = spawnSync('node', ['--import', 'tsx/esm', cliPath, 'start'], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('alpha placeholder')
  })
})
```

[ASSUMED — exact tsx invocation pattern for ESM in Vitest subprocess; the `--import tsx/esm` flag is the current approach for Node 20 ESM loaders but confirm against tsx docs]

### Pattern 6: TypeScript Config Hierarchy (No Project References)

```json
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

```json
// packages/spa/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",  // Vite uses bundler resolution
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

```json
// packages/agent/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Important:** SPA uses `"moduleResolution": "Bundler"` — this is required for Vite's resolution semantics (allows extensionless imports, no `.js` suffix required). Agent uses `"moduleResolution": "Node16"` — requires `.js` extension on relative imports in ESM. [VERIFIED: TypeScript docs — moduleResolution Bundler]

### Pattern 7: GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
# Source: official GitHub Actions docs + pnpm docs
name: CI

on:
  push:
    branches: [main, 'feat/**']
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

**pnpm/action-setup@v6:** Latest stable version (released 2026). v6 adds pnpm v11 support. [VERIFIED: github.com/pnpm/action-setup/releases]
**actions/setup-node@v4:** Latest stable. `node-version-file: '.nvmrc'` reads Node version from `.nvmrc`. `cache: 'pnpm'` uses pnpm store cache built into setup-node. [VERIFIED: github.com/actions/setup-node]
**actions/checkout@v6:** Latest stable. [VERIFIED: github.com/actions/checkout/releases]

### Pattern 8: GitHub Actions Release Workflow with npm Provenance

```yaml
# .github/workflows/release.yml
# Source: https://docs.npmjs.com/generating-provenance-statements
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # Required for npm provenance attestation

    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'  # Creates .npmrc for NODE_AUTH_TOKEN

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build agent
        run: pnpm --filter @agenticapps/dashboard-agent build

      - name: Validate package exports
        run: |
          cd packages/agent
          pnpm dlx publint
          pnpm dlx @arethetypeswrong/cli --pack .

      - name: Publish
        run: pnpm --filter @agenticapps/dashboard-agent publish --provenance --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Key points:**
- `permissions: id-token: write` is required for provenance. Without it, `--provenance` fails. [VERIFIED: docs.npmjs.com/generating-provenance-statements]
- `registry-url` on `actions/setup-node` creates the `.npmrc` file that maps `NODE_AUTH_TOKEN` → auth token. Without this step, publish auth fails silently.
- `--no-git-checks` needed because we're publishing from a tag checkout, not a clean working tree.
- `--access public` required on first publish of a scoped package.

### Pattern 9: ESLint Flat Config (ESLint 10 + typescript-eslint 8)

```javascript
// eslint.config.mjs
// Source: typescript-eslint.io/getting-started
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginImport from 'eslint-plugin-import'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // Base: TypeScript recommended
  ...tseslint.configs.recommended,

  // Import ordering
  {
    plugins: { import: pluginImport },
    rules: {
      'import/order': ['warn', { 'newlines-between': 'always' }],
      'import/no-duplicates': 'error',
    },
  },

  // React-specific (SPA only via files glob)
  {
    files: ['packages/spa/**/*.{ts,tsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with React 18 JSX transform
    },
  },

  // Prettier must be last — disables conflicting rules
  eslintConfigPrettier,
)
```

**Note:** `typescript-eslint` unified package (v8) replaces the old `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` pair. Use `typescript-eslint` (singular), not `@typescript-eslint/*`. [VERIFIED: npm registry — typescript-eslint@8.59.1]

### Anti-Patterns to Avoid

- **Using `vitest.workspace.ts`:** Deprecated since Vitest 3.2. Use `test.projects` in root `vitest.config.ts` instead.
- **PostCSS config with Tailwind v4 + Vite:** Unnecessary overhead when using `@tailwindcss/vite` plugin. PostCSS path is for non-Vite environments.
- **`@tailwind base/components/utilities` directives:** These are Tailwind v3. Use `@import "tailwindcss"` in v4.
- **Separate `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` packages:** Old pattern. The `typescript-eslint` unified package (v8) handles both.
- **`cloudflare/pages-action` in Phase 0:** D-11 explicitly locks CF Pages Git integration for Phase 0. The GH Action adds complexity without benefit until Phase 1+ needs programmatic deploy control.
- **`workspace:^` or `workspace:~` for internal deps:** Use `workspace:*` — always resolves to the local version, matches the monorepo intent. [VERIFIED: pnpm.io/workspaces]
- **Native dependencies in `packages/agent`:** D-16 / INV-05 absolute prohibition. No keytar, no FFI, no native addons.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS utility classes | Custom CSS utilities | Tailwind v4 utility classes | 50k+ edge cases in responsive, dark mode, variants |
| CLI argument parsing | `process.argv.slice(2)` parser | commander | Help text, error messages, subcommands, version flag — all edge-case-heavy |
| npm publish gate | Ad-hoc shell scripts | `publint` + `@arethetypeswrong/cli` | Package exports misconfiguration is nearly invisible until consumers hit it |
| Test environment setup | Custom DOM mocks | jsdom + @testing-library/react | Shadow DOM, event bubbling, async rendering — all handled |
| Cross-package version syncing | Manual package.json edits | pnpm catalog | Single source of truth; publish-time replacement prevents drift |
| pnpm cache in CI | `actions/cache` manual config | `actions/setup-node cache: 'pnpm'` | Built-in, aware of pnpm store path, handles invalidation |

**Key insight:** Bootstrap phases tempt hand-rolling because everything "seems simple." The listed problems each have at least one well-known failure mode that the library handles and custom code won't.

---

## Cloudflare Pages Configuration (Required Human Steps)

These steps cannot be done via code — they require the CF Dashboard. Document them for the verification checklist.

### Build Configuration (CF Dashboard: Settings > Builds)

| Setting | Value |
|---------|-------|
| Build command | `pnpm --filter @agenticapps/dashboard-spa build` |
| Build output directory | `packages/spa/dist` |
| Root directory | `/` (repo root, not packages/spa) |
| Node version (env var) | `NODE_VERSION=20` |
| pnpm version (env var) | `PNPM_VERSION=10` |

**Why root dir:** pnpm needs to resolve the workspace root. Building from `packages/spa` would break cross-package imports.

### Preview URL Contract

Branch pushes automatically create preview URLs in two formats:
1. `<hash>.agenticapps-dashboard.pages.dev` — per-commit, immutable
2. `<branch-name>.agenticapps-dashboard.pages.dev` — per-branch, updates on new commits

PR comments include the preview URL automatically (CF Pages Git integration, no code needed). [VERIFIED: developers.cloudflare.com/pages/configuration/preview-deployments]

### CF Access for Previews (separate from production)

CF Access policies set on a Pages project via **Settings > Enable access policy** protect **only preview deployments** by default. The production `agenticapps-dashboard.pages.dev` domain requires a **separate Access policy**.

**User must configure:**
1. Pages project → Settings → Enable access policy → email-only for previews
2. CF Access → Applications → add separate application for `agenticapps-dashboard.pages.dev` → email-only

[VERIFIED: developers.cloudflare.com/pages/configuration/preview-deployments]

---

## `packages/shared` Export Strategy for Phase 0

The `HealthResponseSchema` is a Zod schema shared between the agent (Node) and SPA (Vite/browser).

**Phase 0 strategy: source-only, `"type": "module"`, single export condition.**

Both Vite and Vitest follow the `exports` field and resolve `.ts` source files directly in monorepo mode. The agent (run via tsx in dev) also resolves `.ts` directly. This eliminates a build pipeline for `packages/shared` in Phase 0.

**HealthResponseSchema shape (from D-06 — agent `--version` flag payload):**

```typescript
// packages/shared/src/schemas/health.ts
import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  message: z.string().optional(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
```

**Consumed by agent:**
```typescript
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

// In --version handler:
const payload: HealthResponse = { ok: true, version, message: 'alpha placeholder' }
console.log(JSON.stringify(HealthResponseSchema.parse(payload), null, 2))
```

**Consumed by SPA (placeholder):**
```typescript
// Feature-toggled fetch; falls back to static data
const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? 'http://127.0.0.1:5193'
// In Phase 0: skip actual fetch, show static fallback
const data: HealthResponse = { ok: false, version: 'not running', message: 'Agent not running' }
HealthResponseSchema.parse(data) // validate the static shape
```

---

## Common Pitfalls

### Pitfall 1: CF Pages Build Fails on Monorepo Root

**What goes wrong:** CF Pages build command runs from `packages/spa/` instead of repo root; pnpm cannot resolve workspace dependencies.
**Why it happens:** CF Pages defaults to the repo root but some frameworks suggest setting "Root directory" to the package folder.
**How to avoid:** Always set build command to `pnpm --filter @agenticapps/dashboard-spa build` and leave root directory as `/` (repo root). The `--filter` flag targets the right package while pnpm runs from workspace root.
**Warning signs:** CF build logs show "Cannot find module '@agenticapps/dashboard-shared'" or "pnpm-workspace.yaml not found."

### Pitfall 2: `--frozen-lockfile` Fails After Catalog Changes

**What goes wrong:** Developer adds a `catalog:` entry to `pnpm-workspace.yaml` but forgets to run `pnpm install` locally; CI fails with lockfile mismatch.
**Why it happens:** `catalog:` entries are tracked in `pnpm-lock.yaml`; the lockfile becomes stale.
**How to avoid:** After any change to `pnpm-workspace.yaml`, run `pnpm install` locally and commit the updated lockfile. CI always uses `--frozen-lockfile`.
**Warning signs:** CI error: "ERR_PNPM_FROZEN_LOCKFILE — The lockfile is not up-to-date."

### Pitfall 3: npm Publish Fails Silently (Missing `.npmrc`)

**What goes wrong:** `npm publish` returns 401 or 404 even with `NPM_TOKEN` in secrets.
**Why it happens:** `NODE_AUTH_TOKEN` is only mapped to auth if `actions/setup-node` is called with `registry-url: 'https://registry.npmjs.org'` — this step creates the `.npmrc` file with the token interpolation. Without it, `NODE_AUTH_TOKEN` is just an env var that npm ignores.
**How to avoid:** Always include `registry-url` on the `setup-node` step in `release.yml`. [VERIFIED: docs.github.com/actions/publishing-packages]

### Pitfall 4: Vitest `test.projects` — All Projects Need Unique Names

**What goes wrong:** Two packages both default to unnamed project; Vitest throws "All projects must have unique names."
**Why it happens:** `test.projects` discovers all packages via glob; unnamed packages conflict.
**How to avoid:** Set `test: { name: 'spa' | 'agent' | 'shared' }` in every per-package `vitest.config.ts`.

### Pitfall 5: ESM CLI `--version` Before Command Parse

**What goes wrong:** `program.version(version)` does not automatically add `--version` to subcommands; calling `agentic-dashboard start --version` may not behave as expected.
**Why it happens:** Commander adds `--version` to the root program, not subcommands.
**How to avoid:** Keep `--version` at the root program level only. Test with `agentic-dashboard --version` (not `agentic-dashboard start --version`).

### Pitfall 6: Tailwind v4 `@tailwind` Directives Instead of `@import`

**What goes wrong:** Copy-paste from v3 docs puts `@tailwind base; @tailwind utilities` in CSS; Tailwind v4 does not recognize these and classes don't generate.
**Why it happens:** Most online examples still show v3 syntax.
**How to avoid:** Use `@import "tailwindcss"` as the single import. If you see `@tailwind` anywhere in v4 code, it's wrong.

### Pitfall 7: CF Access — Preview Gated but Production Not

**What goes wrong:** Preview deployments are behind CF Access (email-only) but the production `agenticapps-dashboard.pages.dev` URL is public.
**Why it happens:** CF Pages "Enable access policy" setting protects only preview deployments; production needs a separate CF Access application.
**How to avoid:** Create two CF Access applications: one for `*.agenticapps-dashboard.pages.dev` (previews) and one for `agenticapps-dashboard.pages.dev` (production). Both set to email-only.

### Pitfall 8: `zod` in Phase 0 — Use v3, Not v4

**What goes wrong:** Installing `zod@4` (beta) pulls unstable APIs; breaking changes vs v3.
**Why it happens:** npm may install the latest published version which may include beta tags.
**How to avoid:** Pin to `^3.24.0` in the catalog. `npm view zod@latest version` currently returns 3.24.2 but check at install time. [VERIFIED: npm registry 2026-05-02]

---

## Code Examples

### Root `package.json` Scripts

```json
{
  "name": "agenticapps-dashboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.5.0"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.base.json && pnpm -r typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "build": "pnpm -r build"
  }
}
```

### `.nvmrc`

```
20
```

**CF Pages note:** CF Pages v3 build system reads `.nvmrc` for Node version. Set `NODE_VERSION=20` as env var in CF Pages dashboard as belt-and-suspenders. [VERIFIED: developers.cloudflare.com/pages/configuration/build-image]

### `HealthResponseSchema` Smoke Test

```typescript
// packages/shared/src/schemas/health.test.ts
import { describe, it, expect } from 'vitest'
import { HealthResponseSchema } from '../index.js'

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const valid = { ok: true, version: '0.0.1-alpha.0' }
    expect(() => HealthResponseSchema.parse(valid)).not.toThrow()
  })

  it('rejects missing ok field', () => {
    expect(() => HealthResponseSchema.parse({ version: '0.0.1' })).toThrow()
  })
})
```

---

## Sequencing Recommendation: One End-to-End Smoke Plan First

**The question:** Is there value in a single "smoke plan" wiring everything before packages have real content, vs building per-package and integrating last?

**Recommendation: Smoke plan first.**

**Rationale:** The riskiest integration point in Phase 0 is the cross-package dependency chain (shared → agent + spa, both in CI + CF Pages). If this plumbing is broken, per-package plans produce a false sense of progress. A single smoke plan that:

1. Creates `pnpm-workspace.yaml` + root `package.json`
2. Creates all three `packages/*/package.json` with correct names + workspace dependencies
3. Adds the one `HealthResponseSchema` to `packages/shared`
4. Runs `pnpm install` + `pnpm typecheck` — proves workspace resolution
5. Commits and pushes — proves CI can install and CF Pages can build

...costs ~30 minutes and catches workspace configuration errors before any package has substantive content.

**After the smoke plan:** Per-package plans flesh out the placeholder content (SPA route, agent CLI, CI gates, README, release workflow).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | ✓ | v24.15.0 (local; CI uses .nvmrc → 20) | — |
| pnpm | Workspace | ✓ | 10.33.2 | — |
| git | CI, version control | ✓ | system | — |
| gh (GitHub CLI) | PR management | ✓ | installed | — |
| CF Pages project | BOOT-03 | ✓ | pre-configured per CONTEXT.md | — |
| npm scope @agenticapps | BOOT-04 | ✓ | claimed per CONTEXT.md | — |
| NPM_TOKEN secret | BOOT-04 | ✓ | in GH secrets per CONTEXT.md | — |
| CLOUDFLARE_API_TOKEN | CF optional | ✓ | in GH secrets (not needed for Git integration) | Not needed in Phase 0 |

**Note on local Node version:** Local machine runs Node 24.15.0. The `.nvmrc` specifies Node 20. There is no `.nvmrc` in the repo yet — creating it is a Phase 0 deliverable. CI will use Node 20 via the `.nvmrc`. Local dev will use Node 24 unless the user switches via `nvm use`. This version gap is benign for Phase 0 placeholder code; no Node 20-specific APIs are used. [VERIFIED: `node --version` output]

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) + per-package `vitest.config.ts` |
| Quick run command | `pnpm test` (run mode, no watch) |
| Full suite command | `pnpm test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOT-01 | pnpm install resolves all workspace packages | CI integration | `pnpm install --frozen-lockfile` exits 0 | ❌ Wave 0 |
| BOOT-01 | HealthResponseSchema importable in all packages | unit | `pnpm test` — shared + agent + spa all import from `@agenticapps/dashboard-shared` | ❌ Wave 0 |
| BOOT-02 | CI workflow lint gate passes | CI integration | `pnpm lint` exits 0 in `ci.yml` | ❌ Wave 0 |
| BOOT-02 | CI workflow typecheck gate passes | CI integration | `pnpm typecheck` exits 0 in `ci.yml` | ❌ Wave 0 |
| BOOT-02 | CI workflow test gate passes | CI integration | `pnpm test` exits 0 in `ci.yml` | ❌ Wave 0 |
| BOOT-03 | CF Pages preview URL responds 200 | human verification | Open `<hash>.agenticapps-dashboard.pages.dev` after push | manual-only |
| BOOT-03 | PR comment contains preview URL | human verification | Create PR, check CF Pages comment | manual-only |
| BOOT-04 | npm package metadata accessible | smoke | `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version` | manual post-publish |
| BOOT-04 | CLI exits 0 with --version | unit | `pnpm test` (agent CLI test) | ❌ Wave 0 |
| BOOT-04 | CLI prints alpha message on start | unit | `pnpm test` (agent CLI test) | ❌ Wave 0 |
| BOOT-05 | README contains "alpha" + install snippet + spec link | smoke | `grep -q "alpha" README.md && grep -q "@agenticapps/dashboard-agent" README.md` | ❌ Wave 0 |

**Manual-only justifications:**
- BOOT-03 (CF Pages preview URL, PR comment): requires live CF infrastructure; cannot automate in unit tests.
- BOOT-04 post-publish: requires npm registry; verified by user after `release.yml` runs.

### Wave 0 Gaps

- [ ] `packages/shared/src/schemas/health.test.ts` — schema parse/reject tests for BOOT-01
- [ ] `packages/agent/src/cli.test.ts` — CLI subprocess tests for BOOT-04
- [ ] `packages/spa/src/App.test.tsx` — render without crash for BOOT-01 (SPA build proves workspace)
- [ ] `vitest.config.ts` (root) — test.projects configuration
- [ ] `packages/spa/vitest.config.ts` — jsdom environment
- [ ] `packages/agent/vitest.config.ts` — node environment
- [ ] `packages/shared/vitest.config.ts` — node environment

### Sampling Rate

- **Per task commit:** `pnpm test` (full run, < 30s on placeholder code)
- **Per wave merge:** `pnpm test:coverage`
- **Phase gate:** Full suite green + manual BOOT-03 verification before `/gsd-verify-work`

---

## Security Domain

`security_enforcement` is enabled (no `false` in config.json).

### Applicable ASVS Categories for Phase 0

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no auth code in Phase 0 | Deferred to Phase 1 |
| V3 Session Management | No | Deferred to Phase 1 |
| V4 Access Control | Partial — CF Access gating of preview/prod URLs | Human configuration step (CF dashboard) |
| V5 Input Validation | Minimal — HealthResponseSchema validates CLI output shape | zod |
| V6 Cryptography | No | Not applicable to Phase 0 |

### Known Threat Patterns for Bootstrap Infrastructure

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposed preview deployments | Information Disclosure | CF Access policy on preview subdomain (human step) |
| Supply chain via npm | Tampering | npm provenance (`--provenance` flag) + `publint` + `@arethetypeswrong/cli` |
| Secrets in lockfile / committed files | Information Disclosure | `.gitignore` covers `.env`; no secrets in Phase 0 code |
| CI secret leak (NPM_TOKEN) | Elevation of Privilege | `NPM_TOKEN` used only in `release.yml` on `v*` tags; not in `ci.yml` |

**Phase 0 security posture:** Minimal attack surface — no running service, no network listeners, no auth code. The primary security surface is the npm publish pipeline and CF Pages access control. Both are addressed above.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vitest.workspace.ts` | `test.projects` in `vitest.config.ts` | Vitest 3.2 (deprecated) | Use root vitest.config.ts only |
| Separate `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` | `typescript-eslint` unified package | 2024 | Simpler install, flat config native |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` | Tailwind v4 (Jan 2026) | One import, no directive syntax |
| `tailwind.config.js` | CSS-first `@theme {}` blocks | Tailwind v4 | No JS config file needed |
| PostCSS path for Tailwind + Vite | `@tailwindcss/vite` plugin | Tailwind v4 | Better perf, no postcss.config.js |
| `pnpm/action-setup@v4` | `pnpm/action-setup@v6` | 2026 | v11 support, Node.js 24 runner |
| `actions/setup-node@v3` | `actions/setup-node@v4` | 2024 | Improved caching, .nvmrc support |
| `actions/checkout@v4` | `actions/checkout@v6` | 2026 | Updated internals |

**Deprecated / outdated:**
- `vitest.workspace.ts`: deprecated in Vitest 3.2 in favor of `test.projects` in root config.
- Old `@typescript-eslint/*` dual packages: superseded by `typescript-eslint` unified package.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Source-only `packages/shared` with `.ts` exports works for both Vite (SPA) and Vitest (all packages) without a build step | Architecture Patterns — Pattern 2 | If Vite can't resolve `.ts` from shared, need to add a build step (tsup) for shared; Phase 0 becomes more complex |
| A2 | The exact tsx invocation `node --import tsx/esm cliPath` works for Vitest subprocess tests on Node 20 | Code Examples — CLI test | May need `tsx` installed globally or different flag syntax; test won't run |
| A3 | `pnpm --filter @agenticapps/dashboard-agent publish --no-git-checks` works on a tag checkout | Pattern 8 — Release workflow | May need `--ignore-scripts` or other flags; test in dry-run first |
| A4 | `actions/checkout@v6` is the current stable version (vs v4) | Pattern 7/8 | Lower version if v6 has regressions; check GH marketplace |
| A5 | pnpm 10.33.2 (local) fully supports catalog: feature — local version is beyond the 9.5 minimum | Standard Stack | Not a risk; 10.x is far above 9.5 threshold |

**Note on A4:** GitHub releases showed `v6.0.2` for `actions/checkout` as of this research session. This is verified but warrants a check at implementation time since the action releases frequently.

---

## Open Questions

1. **`packages/shared` publish strategy for agent**
   - What we know: `packages/shared` is `private: true`. The agent CLI in Phase 0 imports `HealthResponseSchema` for `--version` output. npm publish only includes `packages/agent`.
   - What's unclear: Does the published `packages/agent` bundle the schema inline, or does it list `@agenticapps/dashboard-shared` as a runtime dep (which npm would reject since it's not on registry)?
   - Recommendation: Inline the schema in the agent's published output. Phase 0 agent is a placeholder; the schema is tiny. Use `tsup` to bundle `packages/agent` including its workspace imports, or simply duplicate the one-field schema in the agent source for publishing. Mark this as a Wave 0 implementation decision for the planner.

2. **CF Pages build image version (v2 vs v3)**
   - What we know: CF Pages v3 build image defaults to Node 22 and pnpm 10.11.1. v2 defaults to Node 18 and pnpm 8.7.1.
   - What's unclear: Which build image version is the pre-configured `agenticapps-dashboard` Pages project using?
   - Recommendation: Set explicit `NODE_VERSION=20` and `PNPM_VERSION=10` env vars in CF Pages dashboard settings regardless of build image version — belt-and-suspenders.

3. **`actions/checkout@v6` stability**
   - What we know: v6.0.2 was the latest release as of 2026-05-02.
   - What's unclear: Whether v6 has known regressions on any runner.
   - Recommendation: Use `actions/checkout@v6` as indicated by research. If issues arise, fall back to `@v4` (long-term stable).

---

## Sources

### Primary (HIGH confidence)

- [pnpm.io/catalogs](https://pnpm.io/catalogs) — catalog syntax, `catalog:` protocol, minimum version 9.5 [VERIFIED]
- [pnpm.io/workspaces](https://pnpm.io/workspaces) — workspace: protocol, cross-package references [VERIFIED]
- [vitest.dev/guide/projects](https://vitest.dev/guide/projects) — `test.projects` syntax, per-project environment, coverage scope [VERIFIED]
- [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) — v4 stable release, `@tailwindcss/vite` plugin, CSS-first config [VERIFIED]
- [docs.npmjs.com/generating-provenance-statements](https://docs.npmjs.com/generating-provenance-statements) — `--provenance` flag, `permissions: id-token: write` requirement [VERIFIED]
- [docs.github.com/actions/publishing-packages](https://docs.github.com/actions/publishing-packages/publishing-nodejs-packages) — `registry-url` on setup-node required for NODE_AUTH_TOKEN [VERIFIED]
- [developers.cloudflare.com/pages/configuration/preview-deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments) — preview URL format, Access policy scope [VERIFIED]
- [developers.cloudflare.com/pages/configuration/build-image](https://developers.cloudflare.com/pages/configuration/build-image) — NODE_VERSION env var, pnpm availability [VERIFIED]
- npm registry — all package versions verified via `npm view <pkg> version` on 2026-05-02 [VERIFIED]
- [github.com/pnpm/action-setup/releases](https://github.com/pnpm/action-setup/releases) — v6 latest [VERIFIED]
- [github.com/actions/setup-node](https://github.com/actions/setup-node) — v4 latest with pnpm cache support [VERIFIED]

### Secondary (MEDIUM confidence)

- [socket.dev/blog/pnpm-9-5-introduces-catalogs](https://socket.dev/blog/pnpm-9-5-introduces-catalogs-shareable-dependency-version-specifiers) — pnpm 9.5 minimum confirmed, gotchas [VERIFIED against pnpm.io]
- [colinhacks.com/essays/live-types-typescript-monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) — source-only shared package pattern [MEDIUM — official Zod author; widely adopted pattern]

### Tertiary (LOW confidence — needs validation)

- Vitest subprocess test pattern with `--import tsx/esm` flag — A2 in assumptions log. Standard pattern but exact invocation not confirmed in official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack (all versions): HIGH — npm registry verified
- Architecture patterns (pnpm catalog, Vitest projects, Tailwind v4, CI/CD): HIGH — official docs verified
- Shared package source-only strategy: MEDIUM — widely used but contains A1 assumption worth smoke-testing early
- CLI subprocess testing pattern: LOW/MEDIUM — A2 assumption; test in Wave 0

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable ecosystem — Tailwind, Vitest, pnpm move fast; re-verify before Phase 1)
