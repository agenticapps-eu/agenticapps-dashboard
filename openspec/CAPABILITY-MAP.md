# Capability map — agenticapps-dashboard

**Status:** ✅ RATIFIED 2026-07-26 — 12 capabilities, as proposed.

Derived from `docs/spec/dashboard-prompt.md` (binding), the v1.1/v1.2 requirement
archives, `docs/legacy-planning/ROADMAP.md`, and the shipped route/schema surface
under `packages/`.

**Principle:** capabilities are *product capabilities*, not phases. 21 phases merge
into 12 capabilities. Phase numbers are deliberately not mirrored.

## Proposed capabilities

| # | `specs/<capability>/` | What it owns | Merged from phases |
|---|---|---|---|
| 1 | `project-registry` | Registry as source of truth: register (CLI + SPA), unregister, rename, tag, ID generation + collision suffixes, reachability, path-drift detection and repair | 1 (REG-*), 3 (register modal), 12 (RPD-*) |
| 2 | `daemon-runtime` | Local daemon lifecycle: Hono server, start/stop/status, bind modes (loopback / Tailscale / 0.0.0.0), CIDR enforcement, `/health`, caching cadences, launchd/systemd install, CLI surface | 1 (DAEMON-*), 6 |
| 3 | `auth-and-pairing` | Bearer token on every route, `auth.json` 0600 + startup permission refusal, rotation (manual / version / 30d), CORS origin lock, pair URL + SPA pair flow, re-pair on unreachable | 1 (AUTH-*), 2 (SPA-*) |
| 4 | `filesystem-access-policy` | **The security spine.** Read-only on project filesystems, `/read` allow-list under `.planning/`+`.claude/`, `..`/absolute/realpath rejection, named allowed roots for fleet scanners, 0600/0700 mode discipline, git-command allow-list, the single `/open` `$EDITOR` exception | 1 (API-*), cross-cutting INV-01/INV-02 |
| 5 | `project-dashboard` | Viewing a registered project's pipeline state: multi-project home cards (filter/search/sort/freshness), and the single-project three-column view — phase progress, execution timeline, review + security + verification status, commitment block, hook firings, observations | 3 (HOME-*), 4 (DISC-*, PHASE-*) |
| 6 | `skills-and-linting` | Installed skills (global `~/.claude/skills/` + project-local), AgentLinter subprocess + 1h cache + Position Risk, cross-repo skill-drift matrix | 5, 11 (SKD-*) |
| 7 | `fleet-coverage` | Coverage matrix across `~/Sourcecode/{agenticapps,factiv,neuroflash}`: per-repo columns, 4-state freshness, family grouping + aggregates, filters/search, override chips, daily NDJSON history + drift badges, scoped refresh actions | 10, 10.6, 11 (TRD-*) |
| 8 | `fleet-conformance` | Conformance scoring (equal-weight per cell, tiers 90/70), family cards, 90-day fleet trend chart, path-drift panel | 12, 12.1 |
| 9 | `code-intelligence` | Third-party code-intelligence tools surfaced in the dashboard: GitNexus scoped scan actions (daemon-spawned, job-polled), Understand-Anything daemon-hosted viewer + its six data endpoints, the Code Intelligence page | 13, 14, 14.1 |
| 10 | `optional-integrations` | Sentry / Linear / Infisical panels and the **works-fully-without-them** contract, `env.json` (0600) management, integration + observability + secrets health detection | 8 |
| 11 | `help-docs` | `/help` MDX docs system: anchor pages, stub pages, `HelpLayout`, `HelpWidget` lazy dispatch, `HelpHook`, keyboard-shortcut reference | 7 |
| 12 | `design-system` | Product-facing UI contract: design tokens, WCAG contrast invariant (CI-enforced), sticky page headers, Toast primitive, responsive breakpoints, app shell + sidebar IA | 5.1, 6.1, 11.1, 11.2 |

## Deliberate exclusions

**The IMPECCABLE composite-score gate is NOT a capability.** The `≥ 80` floor, the
`<N>-IMPECCABLE.md` artifact, and the per-phase critique ritual are *process*
(how work is verified), not product behavior. They stay in `CLAUDE.md` /
`docs/WORKFLOW.md`. Only the *outcomes* the gate protects — tokens, contrast
ratios, responsive behavior — become requirements, in `design-system`.

Phase 0 (bootstrap) and Phase 9 (open-source readiness) contribute no product
capability. Phase 0 is repo scaffolding; Phase 9 is unstarted and becomes an
active change, not a spec.

## Ratification decisions (2026-07-26)

| Gap | Decision |
|---|---|
| GAP-01 | **Keep `code-intelligence` as one capability.** Not split. |
| GAP-02 | **Keep `project-dashboard` merged.** Not split. |
| GAP-03 | **ObservabilityHealth stays in `optional-integrations`.** Confirmed as proposed. |
| GAP-04 | **Superseded — remove GitNexus from the dashboard entirely.** First decided as "mark deprecated", then revisited when the stated premise was found false (see below). Staged as `openspec/changes/remove-gitnexus-integration/`. |
| GAP-05 | **Stage `add-openspec-project-reader` as an active change only.** Unimplemented; no reader is rewritten in this PR. |

## Open questions — resolved at ratification

> [GAP-01: **Is `code-intelligence` one capability or two?** GitNexus scan actions
> (daemon spawns a binary, returns a job id, SPA short-polls) and Understand-Anything
> (daemon hosts a prebuilt static viewer + re-implements six read endpoints) are
> mechanically very different. Phase 14's CONTEXT explicitly framed itself as "the
> way GitNexus was integrated in Phase 13" and both land in one sidebar section,
> which argues for one. Splitting into `gitnexus-integration` +
> `understand-anything-integration` would be more honest about the mechanics.
> **My recommendation: keep as one** — the user-facing capability is "see and refresh
> code intelligence for a repo", and the sidebar section is the product boundary.]

> [GAP-02: **Does `project-dashboard` merge too much?** It covers both the
> multi-project home (Phase 3) and the single-project three-column view (Phase 4).
> They share the overview data model and the read-only projection, but they are two
> distinct surfaces with different polling and different panels. **My recommendation:
> keep merged** — splitting yields two specs that would cross-reference on nearly
> every requirement.]

> [GAP-03: **Where does ObservabilityHealth belong?** `observability.ts` (Phase 5)
> greps `package.json` / CI files for Spotlight / Sentry SDK / sentry-cli. It is
> *detection of third-party tooling*, which fits `optional-integrations`, but it is
> also a *health panel*, which fits `skills-and-linting`. I placed it in
> `optional-integrations`. Confirm or move.]

> [GAP-04 — **RESOLVED 2026-07-26: remove GitNexus from the dashboard entirely.**
>
> **Correction to the original framing.** This gap was first written on the claim
> that GitNexus was "a feature whose upstream the fleet has dropped". That claim
> was false. Migration `0032` removed GitNexus from the AgenticApps *workflow
> scaffold* only — the reindex hook, install scripts, and CLAUDE.md block. The
> tool itself is still installed (v1.6.4), still registered as an MCP server in
> `~/.claude.json`, and its index registry is live. "Removed from the workflow"
> is not "removed from the fleet", and the first round of this decision was taken
> on that conflation.
>
> On the corrected facts the feature is 1,541 LOC of working product code (plus
> 2,578 LOC of tests) against a tool still in daily use. Removal is therefore a
> deliberate product choice — the dashboard should not carry a fleet-wide surface
> for a tool the workflow no longer provisions — and **not** a mechanical
> consequence of the migration.
>
> **Scope:** dashboard product code and tests, the code-graph coverage column,
> and this repo's vendored `.claude/skills/gitnexus/`. Explicitly **out of
> scope:** the machine-level MCP registration and the tool itself, which stay
> available outside the dashboard.
>
> **Knock-on, decided:** conformance is an equal-weight score over the tracked
> columns, so dropping one changes every score and would put a step in the 90-day
> trend — a fake improvement if the removed column was mostly non-green. Daily
> snapshots store per-column states inline, so history is **recomputed** over the
> reduced column set rather than left discontinuous. Specified as a requirement,
> not an implementation note.
>
> Staged as `openspec/changes/remove-gitnexus-integration/`.
> `fix-coverage-scan-open-defects` was withdrawn — its two defects are in code
> this change deletes.]

> [GAP-05: **The dashboard reads `.planning/` — which the fleet is now migrating
> away from.** This repo's core value proposition (phase columns, discipline
> scoring, coverage `workflowVersion` column, `register --auto`'s
> `.planning/config.json` marker) parses a layout that OpenSpec replaces. This
> repo's own `.planning/` just moved to `docs/legacy-planning/`, so the dashboard
> can no longer read its own project row. This is the single largest product
> consequence of the fleet migration. **It is out of scope for this PR** — I will
> stage it as an active change (`add-openspec-project-reader`) rather than
> silently rewrite the readers.]

## Traceability

Reconstructed specs are **current truth, post-supersession**. Where a later phase
superseded an earlier decision (e.g. IMPECCABLE floor 87 → 80 via D-10.5-03; Phase 13
removing the page-header `IndexGitNexusButton`), only the final state is recorded.
The supersession history stays in `docs/legacy-planning/`.
