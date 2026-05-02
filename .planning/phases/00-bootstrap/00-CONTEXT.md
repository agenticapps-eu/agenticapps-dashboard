# Phase 0: Bootstrap - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

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

</domain>

<decisions>
## Implementation Decisions

### Toolchain

- **D-01:** Lint + format = **ESLint + Prettier** (user-selected over Biome recommendation). Use `@typescript-eslint`, `eslint-plugin-import`, and Prettier with a single root config; per-package overrides only when a package genuinely needs them.
- **D-02:** Test runner = **Vitest** for both SPA and agent. Vite-native for the SPA; works fine for Node packages too. Single test command across the workspace.
- **D-03:** TypeScript = strict mode in every package. Per-package `tsconfig.json` extends a root `tsconfig.base.json`. **No project references in v1** — keep build graph simple; revisit if incremental builds become slow.
- **D-04:** Workspace dependency strategy = **pnpm catalog** (centralized versions for shared deps like `zod`, `typescript`, `vitest`, ESLint plugins). Requires pnpm ≥ 9.5 (user has pnpm 9+).
- **D-05:** Node version pinning = **`.nvmrc` (Node 20 LTS) + `engines` field in root `package.json`**. CI sets up Node from `.nvmrc`.

### `packages/shared`

- **D-06:** `packages/shared` ships a single `HealthResponseSchema` (Zod) in Phase 0. The placeholder agent's `--version`/`--health` flag emits a payload that revalidates against this schema. A placeholder SPA fetch path parses the same payload. **Purpose:** prove the cross-package contract end-to-end before Phase 1 takes a hard dependency on it.

### `packages/agent` placeholder

- **D-07:** Placeholder agent in Phase 0 = minimal `commander` CLI stub with two commands wired:
  - `agentic-dashboard --version` → prints version + a `HealthResponseSchema`-shaped payload, exits 0.
  - `agentic-dashboard start` → prints "alpha placeholder, daemon lands in Phase 1", exits 0.
  No Hono server, no actual routes — those come in Phase 1.
- **D-08:** Published to npm as `@agenticapps/dashboard-agent@0.0.1-alpha.0` via a `release.yml` GitHub Actions workflow triggered on `v*` tag push. Manual version bumps; **no Changesets yet** — revisit at Phase 7 if multiple packages need to publish.

### `packages/spa` placeholder

- **D-09:** Placeholder SPA in Phase 0 = Vite + React + TS + Tailwind shell with a single route `/` showing "AgenticApps Dashboard — alpha" and the agent's reported version (fetched from a hardcoded local agent URL behind a feature toggle, falling back to a static "agent not running" empty state). Proves the SPA build + Tailwind + Zod parsing all work.

### CI

- **D-10:** GitHub Actions, single workflow `ci.yml` triggered on `push` and `pull_request`. Single sequential job: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`. Split into parallel jobs **only if** one of these gets slow enough to feel painful.
- **D-11:** Cloudflare Pages deploy uses the **Pages Git integration set up pre-flight** (push triggers deploy automatically; CF Pages handles preview URLs and PR comments). Build command + publish dir are the only things we configure on the CF Pages dashboard side. We do **not** add `cloudflare/pages-action` to GH Actions in Phase 0 — switch later only if we need GH-Actions-level control over deploys.
- **D-12:** Release workflow `release.yml` separate from `ci.yml`. Triggered on `v*` tag push. Uses `NPM_TOKEN` from GH secrets. Runs the same lint/test gates as `ci.yml` before publishing.

### Repo policy

- **D-13:** **No LICENSE file in Phase 0** — repo stays private through Phase 6; absence-of-license = all rights reserved by default, which matches the desired posture. MIT lands in Phase 8 when the public-readiness criteria are met.
- **D-14:** **No husky/commitlint in Phase 0.** Commit messages will follow Conventional Commits informally (the spec already implies this). Enforcement via `lint-staged` + `husky` lands in Phase 6 polish, after the workflow has been used enough to know what rules matter.
- **D-15:** **Workflow commitment ritual is mandatory** in every implementing session, including Phase 0 itself. Every Phase 0 plan execution starts with the commitment block. (This is binding from the global AgenticApps workflow contract; recorded here so it can't be quietly skipped during the bootstrap "I'm just doing config" phase.)

### Scope boundaries (from spec, locked)

- **D-16:** No native dependencies in `packages/agent`. No `keytar`, no FFI. (INV-05.)
- **D-17:** No Cloudflare Workers / Pages Functions. SPA stays pure-static through v1. (Spec §"Anti-features".)
- **D-18:** Read-only on project filesystems will be enforced from Phase 1 onward. Phase 0 has no FS-touching code, so the invariant is honored vacuously. (INV-01.)

### Claude's Discretion

- File naming, internal package naming (e.g. `@agenticapps/dashboard-spa` vs `@agenticapps/dashboard-web`) — recommend `@agenticapps/dashboard-{spa,agent,shared}` for clarity.
- Exact ESLint/Prettier config keys — pick reasonable defaults aligned with the chosen toolchain; no controversial style rules.
- README copy beyond the required "alpha" notice + install snippet — keep to one screen.
- Whether to add `.editorconfig` — yes, default.
- Whether to add a basic `.gitattributes` — yes, default (LF line endings, normalize text files).

### Folded Todos

None — fresh project, no prior todos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)
- `docs/spec/dashboard-prompt.md` — full project spec; treat as binding. Phase 0 sections: §"Phase 0 — Repo bootstrap + deployment skeleton", §"Tech stack", §"Repo", §"Acceptance criteria" items 1–14, §"Constraints I want preserved", §"Anti-features".

### Project-level planning artifacts
- `.planning/PROJECT.md` — project vision, core value, hard constraints, key decisions.
- `.planning/REQUIREMENTS.md` — REQ-IDs for Phase 0 are BOOT-01..05; cross-cutting invariants INV-01..05.
- `.planning/ROADMAP.md` — Phase 0 success criteria (1–5) and 9-phase ordering.
- `CLAUDE.md` — repo state, target architecture, hard architectural constraints, project-specific workflow deltas.

### Workflow contract
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format, gate-to-skill map, rationalization table, 13 red flags.
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (pre-phase brainstorming, per-plan TDD/UI preview, post-phase `/review` + `/cso` + `/qa`).

### External docs
- pnpm workspaces: https://pnpm.io/workspaces (and https://pnpm.io/catalogs for catalog feature)
- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- npm publishing with GH Actions + `NPM_TOKEN`: https://docs.npmjs.com/generating-provenance-statements
- Vitest: https://vitest.dev/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — fresh repo. Only `README.md` (placeholder), `.gitignore`, `CLAUDE.md`, `docs/spec/dashboard-prompt.md`, and `.claude/skills/agenticapps-workflow/` exist.

### Established Patterns
None to honor — Phase 0 *establishes* the patterns. Every choice here sets precedent.

### Integration Points
- CF Pages project `agenticapps-dashboard` is connected to the GitHub repo and triggers on push (smoke-tested pre-flight).
- npm scope `@agenticapps` claimed; `NPM_TOKEN` in GH Actions secrets.
- GH Actions secrets present: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NPM_TOKEN`.

</code_context>

<specifics>
## Specific Ideas

- README's three-command install snippet should match the spec exactly:
  ```
  npx @agenticapps/dashboard-agent register ~/Sourcecode/your-first-project
  npx @agenticapps/dashboard-agent start
  # click the printed pair URL
  ```
  Even though `register` and `start` are not implemented in Phase 0, the placeholder `start` should print a message hinting at this future flow so README and binary stay coherent.
- Workspace package names: `@agenticapps/dashboard-agent`, `@agenticapps/dashboard-spa`, `@agenticapps/dashboard-shared`. Only `@agenticapps/dashboard-agent` is published in v1; the others stay `"private": true`.

</specifics>

<deferred>
## Deferred Ideas

### From spec open questions (revisit at the noted phase)
- **Q2 License (MIT vs AGPL vs custom)** → Phase 8. Recommendation in spec is MIT. Locked decision: defer file creation, pick MIT in Phase 8.
- **Q4 Schema validation verbosity (verbose dev / vague prod)** → Phase 1. Spec recommends `NODE_ENV`-gated verbosity. Accept at Phase 1 discuss.
- **Q5 Meta-observer skill packaging (in-repo vs separate)** → Phase 4 (left column needs the JSONL it produces). Spec recommends separate skill repo; document JSONL schema in `packages/shared/src/schemas/observation.ts`.
- **Q6 AgentLinter integration** → already locked in spec for Phase 5 (v1).
- **Q7 Auto-discovery (`register --auto`)** → Phase 1. Spec recommends v1 with explicit confirmation per match. Accept at Phase 1 discuss.
- **Q8 Daemon process model (foreground default)** → Phase 1. Spec recommends foreground by default. Accept at Phase 1 discuss.

### Toolchain reconsiderations
- Project references in `tsconfig.json` if incremental build times become painful — revisit during Phase 4 or 5 once we have ~3000+ LOC across packages.
- Changesets if Phase 7 introduces additional publishable packages.
- Splitting CI into parallel jobs (lint || typecheck || test || build) if the single sequential run exceeds ~3 minutes.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 00-bootstrap*
*Context gathered: 2026-05-02*
