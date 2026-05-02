---
phase: 00-bootstrap
plan: 05
subsystem: docs
tags: [readme, cloudflare-pages, deploy-docs, bootstrap-reproducibility]

# Dependency graph
requires:
  - "Plan 00-01 — workspace structure (three packages, root scripts) referenced from README's Architecture + Development sections"
  - "Plan 00-02 — `npx @agenticapps/dashboard-agent` CLI install path referenced verbatim in README install snippet"
  - "Plan 00-03 — SPA build artifact at `packages/spa/dist` named in CF Pages publish-dir doc"
provides:
  - "Repo-root README.md with alpha notice + three-command install snippet + spec link (BOOT-05)"
  - "docs/deploy/cloudflare-pages-setup.md — reproducibility record for the human-only CF Pages dashboard configuration that BOOT-03 depends on"
  - "Documented split between preview Access policy and production Access policy (RESEARCH §Pitfall 7)"
  - "Triage table mapping the five most common CF Pages build failures to fixes"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs-only plan: zero source code, two markdown files. README under one screen (59 lines); deploy doc under 100 lines (81 lines). Length budget honored per CONTEXT §'Claude's Discretion'."
    - "Cross-reference the canonical RESEARCH.md and CONTEXT.md from the deploy doc rather than re-deriving values; eliminates drift between RESEARCH and the doc the human reads."
    - "Install-snippet verbatim copy from CONTEXT.md §'Specifics' — README and the binary's startup banner stay coherent during the placeholder period (Phase 0 publishes the agent; Phase 1 makes `register`/`start` real)."

key-files:
  created:
    - "docs/deploy/cloudflare-pages-setup.md"
  modified:
    - "README.md (placeholder replaced with full bootstrap docs)"

key-decisions:
  - "Custom domain `dashboard.agenticapps.eu` mentioned in README only as 'deferred to a later phase' — does NOT claim it is currently live. Production URL stays `agenticapps-dashboard.pages.dev` through v1 (matches PROJECT.md pre-flight notes + REQUIREMENTS.md Out of Scope). Acceptance criterion 'README does NOT claim agenticapps.eu is currently live' is satisfied by the explicit 'deferred' framing."
  - "License section in README states UNLICENSED + repo-private + 'MIT lands at Phase 8' — matches D-13 + Plan 04's `license: \"UNLICENSED\"` in package.json. Single source of truth for the license posture lives in PROJECT.md; README mirrors it accurately."
  - "Deploy doc duplicates RESEARCH.md §'Cloudflare Pages Configuration' verbatim rather than abstracting — operators reading this file should not need to chase a second link to learn the build command. Cross-link back to RESEARCH.md exists for traceability, but the doc is self-contained."
  - "Triage table covers the five most likely CF Pages failure modes: monorepo root mis-set, lockfile drift, Node version, missing Access policy, missing CSS — directly mapped from RESEARCH.md §'Common Pitfalls' Pitfalls 1, 2, and 7. Operators reset the project rarely; the triage table is the highest-value reference content in the doc."

requirements-completed: [BOOT-03, BOOT-05]
threat-refs: [T-00-13, T-00-14]

# Metrics
duration: ~3min
completed: 2026-05-02
---

# Phase 00 Plan 05: Bootstrap Docs Summary

**Repo-root README.md replaces the placeholder with a one-screen alpha-aware overview (architecture, three-command install, development gates, deployment links, license posture); `docs/deploy/cloudflare-pages-setup.md` captures the human-only CF Pages dashboard configuration so BOOT-03 is reproducible and the preview/production Access policy split (RESEARCH §Pitfall 7) is documented.**

## Performance

- **Duration:** ~3 min (start 2026-05-02T17:07:47Z, end 2026-05-02T17:10:16Z)
- **Tasks:** 2 (Task 1 README replacement + Task 2 deploy doc)
- **Files:** 1 created, 1 modified
- **Lines:** README 59 / deploy doc 81 (both well under the one-screen + 200-line ceilings)

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1 — Replace placeholder README.md with alpha bootstrap docs** — `60dfd1d` (feat)
2. **Task 2 — docs/deploy/cloudflare-pages-setup.md** — `dd55c65` (docs)

_Wave 3 parallel-execution context: Plan 00-04 (release.yml + agent publish metadata) ran in a sibling worktree against the same base commit `a60ea1c`. This plan modified only `README.md` and `docs/deploy/*` — no path overlap with Plan 04's `.github/workflows/release.yml` or `packages/agent/package.json`. Orchestrator will merge both worktrees cleanly._

## Acceptance Verification

### Task 1 (README.md)

| Criterion | Evidence |
|-----------|----------|
| File exists at repo root | `test -f README.md` exit 0 |
| Contains literal `alpha` (BOOT-05) | `grep -qF "alpha" README.md` exit 0 — appears in the blockquote alpha notice |
| Contains 3 verbatim install commands | `grep -qF "npx @agenticapps/dashboard-agent register" && grep -qF "npx @agenticapps/dashboard-agent start" && grep -qF "click the printed pair URL"` — all 3 exit 0 |
| Markdown link to `docs/spec/dashboard-prompt.md` | `grep -qF "docs/spec/dashboard-prompt.md" README.md` exit 0 (line 53 — Documentation §Spec) |
| Markdown link to `.planning/ROADMAP.md` | `grep -qF ".planning/ROADMAP.md" README.md` exit 0 (line 54 — Documentation §Roadmap) |
| Markdown link to `docs/deploy/cloudflare-pages-setup.md` | `grep -qF "docs/deploy/cloudflare-pages-setup.md" README.md` exit 0 (line 47 — Deployment §SPA) |
| Mentions `agenticapps-dashboard.pages.dev` | `grep -qF "agenticapps-dashboard.pages.dev" README.md` exit 0 (line 47) |
| Does NOT claim `dashboard.agenticapps.eu` is currently live | Line 47 reads "Custom domain `dashboard.agenticapps.eu` is deferred to a later phase" — explicit deferred framing |
| Mentions UNLICENSED | `grep -qF "UNLICENSED" README.md` exit 0 (line 59 — License section) |
| Length under 200 lines | `wc -l README.md` → 59 lines |
| At least 5 h2 sections | `grep -c "^## " README.md` → 6 (Architecture, Install, Development, Deployment, Documentation, License) |

### Task 2 (docs/deploy/cloudflare-pages-setup.md)

| Criterion | Evidence |
|-----------|----------|
| File exists | `test -f docs/deploy/cloudflare-pages-setup.md` exit 0 |
| Contains project name `agenticapps-dashboard` | `grep -qF "agenticapps-dashboard"` exit 0 |
| Contains build command verbatim | `grep -qF "pnpm --filter @agenticapps/dashboard-spa build"` exit 0 |
| Contains publish dir verbatim | `grep -qF "packages/spa/dist"` exit 0 |
| Specifies root directory `/` (not `packages/spa`) | Build configuration table row: "Root directory: `/` (repo root, NOT `packages/spa`)" — guards RESEARCH Pitfall 1 |
| Both `NODE_VERSION` (20) AND `PNPM_VERSION` (10) env vars | Environment variables table — both rows present with explicit values |
| Both preview AND production Access policies as SEPARATE configs | Two H2 sections: "Cloudflare Access — preview deployments" and "Cloudflare Access — production deployment (separate!)" — `grep -c "Access" docs/deploy/cloudflare-pages-setup.md` returns 7 (≥4 required) |
| Triage table for build failures | 5-row triage table covering monorepo root, lockfile drift, NODE_VERSION, Access policy gap |
| Length under 200 lines | `wc -l` → 81 lines |
| References source RESEARCH.md | `grep -c "00-RESEARCH"` → 2 (one in body referencing Pitfall 1, one in Reference section) |
| All values trace to RESEARCH or CONTEXT | Build command + publish dir + env vars from RESEARCH §"Cloudflare Pages Configuration"; project name + URL from CONTEXT §"Code Context" §"Integration Points"; Access split from RESEARCH §Pitfall 7 |

## Files Created/Modified

**Created:**
- `docs/deploy/cloudflare-pages-setup.md` — 81 lines covering project identity, build configuration, environment variables, preview vs production CF Access policies, verification protocol, triage table, and cross-references to RESEARCH.md + CONTEXT.md.

**Modified:**
- `README.md` — placeholder one-line file replaced with 59-line bootstrap doc covering: alpha notice, project description, architecture summary (three packages), three-command install snippet (CONTEXT §"Specifics" verbatim), development gates, deployment links, documentation links, license posture.

## Decisions Made

- **Custom domain framing:** README mentions `dashboard.agenticapps.eu` only as "deferred to a later phase". The acceptance criterion "DOES NOT claim is currently live" is satisfied by the explicit deferred framing (rather than omission). This honors PROJECT.md and REQUIREMENTS.md Out-of-Scope listing without lying-by-omission to a fresh reader who might otherwise hit the unconfigured domain expecting it to work.
- **License posture:** README states "UNLICENSED (no LICENSE file)" + "private through Phase 6" + "MIT LICENSE lands at Phase 8". This matches D-13, Plan 04's `package.json` license field, and PROJECT.md key decisions. Single source of truth for the license posture lives in PROJECT.md; README mirrors accurately.
- **Deploy doc duplication over abstraction:** values from RESEARCH.md §"Cloudflare Pages Configuration" are restated in the deploy doc rather than referenced. Operators recreating the Pages project are doing it under pressure (after a reset); they should not need to chase a second file. Cross-link to RESEARCH.md exists for traceability, but the doc is self-contained.
- **Triage table scope:** five rows mapped directly from RESEARCH §"Common Pitfalls" Pitfalls 1, 2, and 7 plus two implied build-image failure modes. Higher coverage would dilute signal; lower coverage would miss the most-likely failures.

## Deviations from Plan

None — plan executed exactly as written.

Both tasks' `<action>` blocks specified the literal markdown content; both files were written verbatim from those specifications with no auto-fixes required. The only adjustments from a strict copy-paste:

- Replaced em-dashes (`—`) and en-dashes (`–`) inside code-fence-adjacent text with ASCII hyphens in the deploy doc body (per Task 2 notes "Use ASCII (no smart quotes) so CI tooling never trips on encoding"). The plan's `<action>` block used a mix of em-dashes and ASCII; the executed file standardizes on ASCII for the body text. README keeps the em-dashes from the plan literal because (a) those appear in the spec's brand line "AgenticApps Dashboard — alpha" which the deploy doc's verification step references, and (b) README is not parsed by CI tooling. No semantic changes.

## Issues Encountered

- **Worktree branch was based on stale commit `5d736bc`** instead of the expected base `a60ea1c43da6f23a6d55ea5e1b1fbcb0caecea72` (Plans 01-03 complete, Plan 04 in flight in a parallel worktree). Resolved with `git reset --hard a60ea1c43da6f23a6d55ea5e1b1fbcb0caecea72` per the worktree-branch-check protocol; all `.planning/` files restored before any task work began.

## Manual-only verification (deferred to phase verify-work)

Per `.planning/phases/00-bootstrap/00-VALIDATION.md` §"Manual-Only Verifications", the actual end-to-end CF Pages deploy verification is a manual step that runs at `/gsd-verify-work 0`, not inside this plan:

1. After phase merge → push the phase branch to origin.
2. Wait ~60s for CF Pages build.
3. Open the PR on GitHub → confirm "Cloudflare Pages" bot comment contains a `<hash>.agenticapps-dashboard.pages.dev` URL within 1-2 minutes.
4. Click the preview URL → confirm CF Access email-OTP gate appears.
5. Authenticate → confirm SPA loads and shows brand line + AgentVersion fallback.

This plan only delivers the documentation that makes those manual steps reproducible; it does not exercise the CF Pages pipeline.

## Next Plan Readiness

Plan 05 is the last plan in Phase 0. After this plan and Plan 04 land:

- **Wave-3 merge:** Orchestrator merges both Wave-3 worktrees (00-04 and 00-05) into the phase branch. Path-overlap check: 00-04 touches `.github/workflows/release.yml` + `packages/agent/package.json`; 00-05 touches `README.md` + `docs/deploy/cloudflare-pages-setup.md`. No overlap.
- **Phase verify-work (`/gsd-verify-work 0`):** runs the full 5-gate suite from a clean tree (`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`); pushes the phase branch and walks the manual-only verifications listed in 00-VALIDATION.md (CF Pages preview deploy, PR comment, npm metadata after `release.yml` runs on a `v0.0.1-alpha.0` tag, branch protection in GH UI, production CF Access email gate).
- **Phase 1 readiness:** README's install snippet currently references `register` and `start` commands. Plan 02 ships `start` as a placeholder; `register` is intentionally not yet implemented (lands in Phase 1 per the binary's own startup hint). README and binary stay coherent — neither claims `register` works in Phase 0.

**Concerns / blockers:** None. Both files validate against all stated acceptance criteria; no architectural changes; no scope creep.

## Self-Check: PASSED

**Files claimed in this SUMMARY exist on disk:**
- `README.md` — FOUND (59 lines, contains `alpha`, `@agenticapps/dashboard-agent`, both install commands, spec link, ROADMAP link, deploy-doc link, `agenticapps-dashboard.pages.dev`, `UNLICENSED`)
- `docs/deploy/cloudflare-pages-setup.md` — FOUND (81 lines, contains project name, build command, publish dir, NODE_VERSION, PNPM_VERSION, Email-only, preview, production, triage table, RESEARCH cross-link)

**Commit hashes claimed in this SUMMARY exist in git history:**
- `60dfd1d` feat(00-05): replace placeholder README with alpha bootstrap docs — FOUND
- `dd55c65` docs(00-05): document Cloudflare Pages manual setup steps — FOUND

**Plan-level `<verify>` commands re-run from the plan-end commit:**
- Task 1: `test -f README.md && grep -qF "alpha" README.md && grep -qF "@agenticapps/dashboard-agent" README.md && grep -qF "npx @agenticapps/dashboard-agent register" README.md && grep -qF "npx @agenticapps/dashboard-agent start" README.md && grep -qF "docs/spec/dashboard-prompt.md" README.md && grep -qF ".planning/ROADMAP.md" README.md && grep -qF "agenticapps-dashboard.pages.dev" README.md && grep -qF "docs/deploy/cloudflare-pages-setup.md" README.md && [ "$(wc -l < README.md)" -lt 200 ]` — exits 0
- Task 2: `test -f docs/deploy/cloudflare-pages-setup.md && grep -qF "agenticapps-dashboard" ... && grep -qF "pnpm --filter @agenticapps/dashboard-spa build" ... && grep -qF "packages/spa/dist" ... && grep -qF "NODE_VERSION" ... && grep -qF "PNPM_VERSION" ... && grep -qF "Email-only" ... && grep -qF "preview" ... && grep -qF "production" ... && [ "$(wc -l < docs/deploy/cloudflare-pages-setup.md)" -lt 200 ]` — exits 0

---
*Phase: 00-bootstrap*
*Plan: 05*
*Completed: 2026-05-02*
