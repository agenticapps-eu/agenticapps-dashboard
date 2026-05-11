# Phase 6: Polish + Service Install + Acceptance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 06-polish-service-install-acceptance
**Mode:** `--auto` (recommended defaults selected without interactive prompts)
**Areas discussed:** Keyboard Shortcuts, Service Install (launchd/systemd), impeccable Critique Gate, Two-Stage Review, README + Docs, CF Access Production Policy, Phase 3 impeccable Deltas, A-01/A-02 Phase 3 Follow-ups

---

## Keyboard Shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Single keys, focus-aware | `R`/`?`/`/` global; gated on no editable focus | ✓ |
| Modifier-keyed | `Cmd+R` / `Cmd+/` etc. | |
| Mode-toggle (Vim-style) | Press `i` to enter insert mode | |

**User's choice:** Auto-selected option 1 — matches spec literally and keeps Cmd+K (Phase 3) as the only modifier shortcut.
**Notes:** Focus check is the single regression-prevention trick; planner must TDD the "typing in search shouldn't refresh" case.

## Service Install (launchd / systemd)

| Option | Description | Selected |
|--------|-------------|----------|
| Two subcommands, inline templates, no auto-load | `install-launchd` / `install-systemd`, plist/unit as TS template literals, prints next-step | ✓ |
| Single `install-service --platform` flag | One subcommand with auto-detect or `--platform` | |
| Standalone bash scripts in `bin/` | Not driven through the daemon CLI | |

**User's choice:** Auto-selected option 1 — matches Phase 1's one-subcommand-per-action pattern; inline templates avoid path-resolution under npx; print-then-load preserves "no surprise side effects" invariant.
**Notes:** Both commands accept `--uninstall`; logs go to `~/.agenticapps/dashboard/logs/{daemon,error}.log` (mode `0700`); `process.execPath` baked in to survive PATH changes.

## impeccable Critique Gate

| Option | Description | Selected |
|--------|-------------|----------|
| CI workflow, required check, ≥90 hard gate | Runs on PR; below-90 blocks merge | ✓ |
| Pre-commit hook (local) | Runs in dev; advisory-only on CI | |
| Manual `pnpm impeccable` | No automation, just a script | |

**User's choice:** Auto-selected option 1 — local-only gates rot; spec demands the gate pass before merge.
**Notes:** Routes audited: `/onboarding`, `/`, `/projects/:id`, `/settings`, `/help`, `/pair` × three breakpoints. Below-90 deltas surface as a PR comment, not just CI logs.

## Two-Stage Review

| Option | Description | Selected |
|--------|-------------|----------|
| Two-skill, document-only protocol | gstack `/review` + `superpowers:requesting-code-review`; `<finding>` XML in PR description | ✓ |
| Custom finding-aggregator service | New tool/CLI that ingests both skill outputs | |
| Single-stage review | Collapse the stages — one reviewer | |

**User's choice:** Auto-selected option 1 — PROJECT.md non-negotiable: "Stages do not collapse." Skills already produce findings; Phase 6 documents the protocol, doesn't build new infra.
**Notes:** `<finding>` schema fields: `id`, `stage`, `severity` (block/warn/info), `area`, `description`, `evidence`, `resolution`. Severity gates merge.

## README + Docs

| Option | Description | Selected |
|--------|-------------|----------|
| Six sections + automated screenshots | Hero / Install / Pair / FAQ / Troubleshooting / Architecture; Playwright captures real UI | ✓ |
| Minimal README + standalone docs site | Defer most content to a `docs/` tree | |
| Hand-snapped screenshots | Developer-captured | |

**User's choice:** Auto-selected option 1 — three-command install is the spec's headline UX promise; FAQ + Troubleshooting seeded from real UAT items; automated screenshots prevent rot.
**Notes:** License placeholder = "Source-available; license decision deferred to Phase 8". Architecture stays at 3 sentences, links to spec.

## CF Access Production Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Email-only, single-user allowlist | `donald.vlahovic@neuro-flash.com` only; documented in `docs/deploy/cf-access-policy.md` | ✓ |
| Multi-collaborator allowlist | Add a small set of trusted emails | |
| Public access (drop CF Access) | Skip until Phase 8 public flip | |

**User's choice:** Auto-selected option 1 — already locked by Phase 1 deferred Q3 + PROJECT.md + spec recommendation.
**Notes:** Documented as a Markdown file with JSON to paste into the CF dashboard; no Terraform/wrangler in this repo (no CF Workers/Functions in v1).

## Phase 3 impeccable Deltas

| Option | Description | Selected |
|--------|-------------|----------|
| Bring each below-90 sub-score up to ≥90 | Color, Typography, Layout on `/` route | ✓ |
| Comprehensive design system overhaul | Refactor tokens; raise everything to 95+ | |
| Skip — re-audit may show they've improved | Trust drift might have helped | |

**User's choice:** Auto-selected option 1 — gate's prerequisite; over-polish wastes the phase's session budget.
**Notes:** Re-run impeccable first to get fresh deltas (the originals are 6 months old).

## A-01 / A-02 Phase 3 Follow-ups

| Option | Description | Selected |
|--------|-------------|----------|
| Land both as Phase 6 plan tasks | A-01 rate-limit + A-02 schema-bounds on `/register-prepare` + `/register-confirm` | ✓ |
| Defer to Phase 7 | Roll into integrations work | |
| Drop — accept current state | Revisit only if exploited | |

**User's choice:** Auto-selected option 1 — these are PR follow-ups deferred from Phase 3; v1.0 ships with them closed.
**Notes:** Planner pulls original `<finding>` text from Phase 3 review artifacts.

---

## Claude's Discretion

- Exact Playwright config + viewport sizes for impeccable.
- Concrete plist/unit content (researcher reads `man launchd.plist` / `man systemd.unit`).
- CI artifact naming + retention.
- Plan-wave ordering.
- Separate impeccable workflow file vs extending `ci.yml`.

## Deferred Ideas

See `06-CONTEXT.md` `<deferred>` section for the full list. Highlights:
- Windows install — Phase 8 or never.
- Dependabot/Renovate — Phase 7+.
- Header line 2, cross-phase ReviewStatus aggregation — Phase 7.
- Multi-collaborator CF Access allowlist — Phase 8.
