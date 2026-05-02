# Phase 0: Bootstrap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 00-bootstrap
**Areas discussed:** Toolchain (lint/format), Release flow, `packages/shared` content, License timing

---

## Spec Open Questions — Status Summary

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| 1 | Repo visibility | ✅ Resolved pre-flight | Private until Phase 6 |
| 2 | License (MIT/AGPL/custom) | Locked in CONTEXT.md | Defer LICENSE to Phase 8; MIT then |
| 3 | Cloudflare Access policy | ✅ Resolved pre-flight | Email-only on production |
| 4 | Schema validation verbosity | Deferred to Phase 1 | Spec recommends NODE_ENV-gated |
| 5 | Meta-observer skill packaging | Deferred to Phase 4 | Spec recommends separate skill repo |
| 6 | AgentLinter v1 vs deferred | Already locked in spec | v1 (Phase 5) |
| 7 | Auto-discovery (`register --auto`) | Deferred to Phase 1 | Spec recommends v1 with confirmation |
| 8 | Daemon process model | Deferred to Phase 1 | Spec recommends foreground default |

---

## Bootstrap path (Pre-discussion)

**Background:** GSD planning state did not exist; `.planning/` was empty, so `/gsd-discuss-phase 0` could not run. User was presented with three bootstrap options.

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-derive from spec | Mechanically extract PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md from `docs/spec/dashboard-prompt.md` | ✓ |
| Run /gsd-new-project | Full interactive deep-dive interview | |
| Skip bootstrap, hand-write phase 00 CONTEXT only | Treat spec as de facto roadmap | |

**User's choice:** Hand-derive from spec.
**Notes:** Spec is comprehensive (730 lines, hand-off document); mechanical extraction preserves fidelity without redundant interview. Committed as `docs(planning): bootstrap GSD state from dashboard-prompt spec` (2cccdbb).

---

## Toolchain — Lint + format

| Option | Description | Selected |
|--------|-------------|----------|
| Biome (Recommended) | Single tool, ~10× faster, zero plugin config; narrower rule set than ESLint. | |
| ESLint + Prettier | Mature default, broadest rule coverage, every plugin available; heavier config + slower runs. | ✓ |

**User's choice:** ESLint + Prettier.
**Notes:** User overrode the recommendation. Implication: rule choice and plugin selection are now an explicit Phase 0 concern (not a decision the toolchain abstracts away). PLAN.md should call out: which `@typescript-eslint` rules, which import-order config, and whether to enable `eslint-plugin-react-hooks` for the SPA package.

---

## Release flow

| Option | Description | Selected |
|--------|-------------|----------|
| Manual publish on git tag (Recommended) | `release.yml` triggered on `v*` tag push, single package, manual version bumps. | ✓ |
| Changesets from day 1 | `.changeset/` per PR, auto-versioning, auto-changelog, auto-publish on merge. | |

**User's choice:** Manual publish on git tag (recommended).
**Notes:** Single package + alpha velocity; Changesets adds ceremony with no current payoff. Revisit if Phase 7 adds publishable packages or if cadence picks up.

---

## `packages/shared` content in Phase 0

| Option | Description | Selected |
|--------|-------------|----------|
| Trivial schema, exercised end-to-end (Recommended) | Define `HealthResponseSchema` (Zod) in `shared/`, parse in placeholder agent + placeholder SPA. Proves cross-package contract before Phase 1 depends on it. | ✓ |
| Empty stub | Just package boundary; schemas land in Phase 1. | |

**User's choice:** Trivial schema, exercised end-to-end (recommended).
**Notes:** This single Zod schema becomes a smoke test for the entire workspace contract. If `pnpm install`, TS workspace resolution, or Vite's handling of cross-package imports is broken, Phase 0 catches it — not Phase 1.

---

## LICENSE file in Phase 0

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 8 (Recommended) | No LICENSE while private; absence = all rights reserved. | ✓ |
| Add MIT LICENSE now | Save the Phase 8 step. Risk: pick a different license later, leave a misleading commit. | |
| Add private/proprietary marker | Explicit "All rights reserved — internal use only". | |

**User's choice:** Defer to Phase 8 (recommended).
**Notes:** Repo stays private through Phase 6. No LICENSE while private is the cleanest posture; MIT lands in Phase 8 with the public flip.

---

## Claude's Discretion (no question asked)

These were locked as recommended defaults without prompting because the choice is uncontroversial for this stack:

| Area | Decision | Rationale |
|------|----------|-----------|
| Test runner | Vitest | Vite-native for SPA; works for Node packages. Single test command. |
| pnpm workspace deps | pnpm catalog | Centralized versions; pnpm 9.5+ feature; user has pnpm 9+. |
| TS config | Per-package extending root `tsconfig.base.json`; **no project references** | Simple build graph; revisit if incremental builds become slow. |
| Node pinning | `.nvmrc` (Node 20 LTS) + `engines` field | Standard, works with CI. |
| CI structure | Single sequential job (`lint → typecheck → test → build`) | Small repo; split later if slow. |
| CF Pages deploy | Pages Git integration (set up pre-flight) | Already working from smoke test; no need to re-mechanize via GH Actions. |
| Commit hooks | None in Phase 0; husky/commitlint deferred to Phase 6 | Establish convention informally first; enforce after we know what rules matter. |
| Workspace package names | `@agenticapps/dashboard-{agent,spa,shared}` | Mirrors directory names; only `dashboard-agent` is published. |

---

## Deferred Ideas

- Project references in `tsconfig.json` — revisit during Phase 4/5 if incremental build times become painful.
- Changesets — revisit at Phase 7 if multiple packages need to publish.
- Splitting CI into parallel jobs — revisit if single sequential run exceeds ~3 min.
- LICENSE (MIT) — Phase 8.
- husky / commitlint enforcement — Phase 6 polish.
- Custom domain `dashboard.agenticapps.eu` — deferred per pre-flight; production URL stays `agenticapps-dashboard.pages.dev` through v1.

---

## Scope Creep Redirected

None. Discussion stayed within Phase 0's boundary.
