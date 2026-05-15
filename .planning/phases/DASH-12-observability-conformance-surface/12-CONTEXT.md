# Phase 12: Observability Conformance Surface — Context

**Gathered:** 2026-05-15
**Status:** Pre-discuss — captured from hand-off prompt; `/gsd-discuss-phase 12` has NOT yet been run. Decisions below marked **(open)** are inputs to that step, not commitments.
**Mode:** Bootstrap-only this session (Phase 0 of the hand-off prompt). No code changes. Two artifacts written: `12-CONTEXT.md` (this file) + `12-RESEARCH.md` (brainstormed alternatives).

<domain>
## Phase Boundary

Ship a top-level **Observability** surface in the dashboard SPA that reads each registered project's `.observability/baseline.json` (per `agenticapps-workflow-core` spec §10.9) and renders three views:

1. **Project list** — table of every registered project with stacks, gap counts (high / medium / low), last-scan timestamp, status pill (Conformant / Drift Detected / Stale / Not Set Up).
2. **Per-project detail** — sparkline of `high_confidence_gaps` over time, per-checklist stacked bar (C1–C4), module-roots list, latest `.scan-report.md` excerpt, deep-link actions ("Run scan-apply" → clipboard; "View .scan-report.md" → slideover; "Open help: scan/apply" → `HelpHook`).
3. **Conformance trend** — fleet-level line chart of total `high_confidence_gaps` across all registered projects over the past 90 days + "Top contributors to drift this week" list.

Data source: each project's local `.observability/baseline.json`, read **only** by the daemon (filesystem boundary stays where Phase 1 put it). No network calls to ingest project data. Projects without baselines render `Not Set Up` with a one-click link to the `/help/operations/migration-runbook#migration-0003` help page.

**In scope (v1):**
- New daemon route returning Zod-validated baseline data per project (route shape decision **open** — see D-12-02).
- New daemon helper to walk `git log` of `.observability/baseline.json` for sparkline + trend history.
- New shared schemas at `packages/shared/src/schemas/observability-baseline.ts` (`BaselineSchema`, `BaselineHistoryResponseSchema`, `BaselineListResponseSchema`).
- New SPA route `/observability` (project list) + `/observability/$projectId` (detail) + `/observability/trend` (fleet trend), mounted under the existing `_appshell` per Phase 10's pattern.
- New sidebar entry under the existing **Observability** section (introduced in Phase 10 via D-10-08) — added as a *second* item alongside whatever Phase 11 lands. **Single-item sections were acceptable in v1.0; Phase 12 graduates the section to 2–3 items.**
- Reuse of existing `HelpHook` component (`packages/spa/src/help/components/HelpHook.tsx`) — already migrated and TanStack-Router-native.
- Reuse of existing help MDX renderer for `.scan-report.md` slideover content.
- TDD on every new schema, scanner, route, hook, and panel.
- Two-stage review + `/cso` (path-allow-list extension is a constraint change) + `/qa` (live dashboard walkthrough with fx-signal-agent + cparx fixtures) + `impeccable:critique` (composite ≥ 87 floor per D-10.5-02).

**Out of scope (v1 — deferred):**
- Running the scan from the dashboard. The "Run scan-apply" action is **clipboard-only** (matches D-10-09 precedent). Triggering scans from the dashboard would couple to Claude Code's CLI surface.
- Authoring/editing `policy.md`. Read-only surface; direct-edit instructions only.
- Live error/event ingestion (no Sentry replacement). This phase surfaces *conformance metadata*, not live observability events.
- Per-module-root gap counts inline in the per-project view's "module roots" list. The spec stores `module_roots[]` as `{stack, path}` only — per-module gap totals live in `.scan-report.md`, not `baseline.json`. v1 renders module roots without gap annotations; gap details appear in the rendered scan-report below.
- Cross-project policy-hash drift comparison (could land in v1.1 — "your fleet's policy.md hashes diverged").
- Live filesystem watcher for baseline files. Polling matches Phase 10's 30s memo + 5s refresh pattern.
- Side-panel mode for `HelpHook`. Existing component navigates in v1.0; side-panel is v1.1+ (not blocking Phase 12).

</domain>

<repo-state>
## Repo state observations at the time of context capture

These are NOT decisions; they are facts that inform decisions.

- **Branch cut from `main` at `78b6b6f`** (Phase 10.6 — three-state GitNexus detection). Working tree clean. 5 open PRs (#30/#31/#32/#33 dashboard + #3 workflow-core) on detached branches; main is unchanged.
- **Phase 11 is queued, not started.** Per `session-handoff.md` (2026-05-15) Phase 11 = "Coverage trends (Candidate A) + Cross-repo skill drift (Candidate B)" combined as v1.1 close-out. Discuss/plan/execute cycle has not started; Phase 11 will populate the **Observability** sidebar section with a second item (Coverage Trends) and possibly a third (Skill Drift). Phase 12 (this phase) adds a 4th item or a 3rd, depending on Phase 11 IA outcomes.
- **No `redesign` branch exists.** The hand-off prompt says "ships on top of the redesigned dashboard." Search of local and origin branches returned no candidates. Phase 12 will follow the **current** design system + tokens (post Phase 10.5 / Phase 10.6 impeccable polish + v1.0.1 tertiary contrast bump). If a redesign lands later, Phase 12's impeccable critique gate will re-run on top of it.
- **Daemon route name collision.** `/api/projects/:id/observability` **already exists** at `packages/agent/src/routes/observability.ts` and serves `ObservabilityResponseSchema` for **Phase 5 HEALTH-03 (Sentry / Spotlight / Sentry-CLI detection)**, *not* spec §10.9 baseline. Phase 12 MUST NOT collide on path. Candidate: `/api/projects/:id/observability/baseline` (and `.../baseline/history`, `.../baseline/scan-report`). See D-12-02 (open).
- **Path allow-list extension.** Current Phase 1 constraint: `/api/projects/:id/read` resolves only under `<root>/.planning` or `<root>/.claude`. Phase 12 needs to read `<root>/.observability/baseline.json` AND `<root>/.scan-report.md`. **This is a constraint extension that requires `/cso` review.** Recommended shape: dedicated typed endpoint that bypasses `/read`'s allow-list with its own narrower allow-list (specifically `.observability/baseline.json` + `.scan-report.md`, no glob/traversal). See D-12-03 (open).
- **No chart library installed.** `packages/spa/package.json` carries no recharts, visx, chart.js, d3, nivo, tremor, victory. Sparkline + trend chart introduces a new dependency. Bundle-size implications + Phase 7 lazy-route convention apply. See D-12-04 (open).
- **HelpHook already migrated.** `packages/spa/src/help/components/HelpHook.tsx` exists (TanStack-Router-native — earlier draft used `react-router-dom`; the migrated copy is already correct). Test exists at `packages/spa/src/help/components/HelpHook.test.tsx`. Topic format: dot-separated → `/help/<section>/<page>[#anchor]`. Phase 12 hooks `topic="observability.scan"`, `topic="observability.apply"`, `topic="operations.migration-runbook#migration-0003"`.
- **Help docs Observability anchor pages.** `packages/spa/src/help/pages/observability.overview.lazy.tsx` already exists. Per the v1.0 help-docs outline + the hand-off, the `/help/observability/scan` and `/help/observability/apply` pages need to land in either Phase 11 or Phase 12's plan. Hand-off says v1.1 of help docs. **(open)** — D-12-08.
- **Registry shape verified.** `~/.agenticapps/dashboard/registry.json` is `{ version: 1, projects: [{ id, name, root, client, addedAt, tags }] }`. Phase 12's scanner reads `root` then resolves `<root>/.observability/baseline.json`.
- **Baseline shape correction vs. hand-off.** Hand-off Zod sketch nests `high_confidence_gaps_by_checklist` inside `counts`. **Spec §10.9.2 places it at the top level** of the baseline object, alongside `counts`, `module_roots`, `policy_hash`, etc. Phase 12 schema follows the **spec**, not the hand-off sketch.
- **Test fixtures.** fx-signal-agent (registered as `fx-signal-agent`, root `/Users/donald/Sourcecode/fx-signal-agent` per registry — actual current path is `~/Sourcecode/factiv/fx-signal-agent` post family-reorg) and cparx (registered, similar drift). The registry root paths are stale. Phase 12 should NOT silently auto-correct registry entries — that's a separate hygiene task. Phase 12 reads what the registry says; mis-pathed projects render as `Not Set Up`. **(open)** — D-12-09 whether to add a "registry root path drifted" status pill.

</repo-state>

<open-decisions>
## Decisions open for /gsd-discuss-phase 12

Carry-overs from the hand-off (3) + repo-state observations (6). Numbered D-12-NN to keep continuity with prior phases.

- **D-12-01 (open): GSD phase number — Phase 12 vs Phase 11.5 vs wait-for-Phase-11.**
  - Recommendation: **Phase 12**, sequenced after Phase 11 merges but cut/planned in parallel as the hand-off instructs. Phase 11 introduces Coverage Trends (snapshot history pattern) that Phase 12's sparkline can mirror — sharing the daemon-side snapshot infra would save work. If Phase 12 ships first, Phase 11 inherits the pattern instead.
  - Alternatives in 12-RESEARCH.md.

- **D-12-02 (open): Daemon route shape — extend existing `/observability` vs new sibling routes.**
  - Recommendation: **new sibling routes** — `/api/projects/:id/observability/baseline`, `/api/projects/:id/observability/baseline/history?days=90`, `/api/projects/:id/observability/scan-report` — leaves Phase 5's `/api/projects/:id/observability` (HEALTH-03 Sentry/Spotlight/CLI panel) untouched. Avoids breaking change on Phase 5 contract.
  - Alternatives in 12-RESEARCH.md.

- **D-12-03 (open): Path allow-list extension — sub-route with narrow allow-list vs widening `/read`.**
  - Recommendation: **dedicated typed endpoints** (per D-12-02). The new endpoints read only `.observability/baseline.json` + `.scan-report.md` and return Zod-validated payloads — they never expose raw filesystem access. `/read` keeps its `.planning`/`.claude` allow-list unchanged. `/cso` audits the new path resolution for traversal safety.
  - Alternatives in 12-RESEARCH.md.

- **D-12-04 (open): Chart library — hand-rolled SVG vs ultra-light dep vs full chart lib.**
  - From the hand-off: "Use whatever the redesign already uses; don't introduce a new chart library." Since no redesign branch exists AND no chart lib is currently installed, this decision is forced now.
  - Recommendation: **hand-rolled SVG sparkline + hand-rolled SVG stacked bar** for v1 (zero new dependency; <50 LOC per primitive; fits the design system's token-driven aesthetic). Fleet trend chart needs more — recommendation TBD pending design-shotgun.
  - Alternatives in 12-RESEARCH.md.

- **D-12-05 (open): Status pill thresholds.**
  - Hand-off defaults: Conformant (gaps=0 AND scan <7d), Drift Detected (gaps>0), Stale (scan >14d), Not Set Up (no baseline file).
  - Recommendation: **accept hand-off defaults for v1**; surface threshold tuning as a Phase 12.1 follow-up only if user feedback during `/qa` flags them.
  - Alternatives in 12-RESEARCH.md.

- **D-12-06 (open): Run-scan UX — clipboard vs terminal launch.**
  - Hand-off acknowledges runtime constraint (SPA + local daemon = browser context, no terminal launcher). Phase 10 precedent (D-10-09) is **clipboard only** for similar headless-unavailable commands.
  - Recommendation: **clipboard-only**, matching D-10-09. The command composed client-side from registry root + selected confidence level. No daemon endpoint for command composition (the SPA already knows the root).
  - Alternatives in 12-RESEARCH.md.

- **D-12-07 (open): `.scan-report.md` rendering — full render vs executive summary.**
  - Hand-off recommends full render via existing help-docs MDX renderer.
  - Recommendation: **full render in a slideover panel**, reusing the MDX renderer + lucide-react `X` close button. Slideover keeps user in dashboard context. The slideover content area is virtualizable if `.scan-report.md` is very large; defer that optimization until evidence of large reports.
  - Alternatives in 12-RESEARCH.md.

- **D-12-08 (open): Help-page authoring — `/help/observability/scan` + `/help/observability/apply` + `/help/operations/migration-runbook#migration-0003`.**
  - Recommendation: **Phase 12 ships the deep-link wiring even if target pages are stubs (`ComingSoonRoute`)**. Help-doc authoring is a separate workstream (the hand-off references v1.1 help docs). HelpHooks resolve to stub pages until the help docs ship. This matches Phase 7's lazy-route + ComingSoon pattern.
  - Alternatives in 12-RESEARCH.md.

- **D-12-09 (open): Registry root-path drift status pill.**
  - Observation: registry entries reference paths that no longer exist post family-reorg. A project whose registered `root` is missing from disk currently would render as `Not Set Up`. That's misleading — the project is registered, just mis-pathed.
  - Recommendation: **add a `Registry Drift` status pill state** distinct from `Not Set Up`. Daemon reports `root_exists: boolean` per project; SPA renders the appropriate pill. Cheap to compute, surfaces a real hygiene issue.
  - Alternatives in 12-RESEARCH.md.

</open-decisions>

<references>
## References

- **Spec §10.9** — `~/Sourcecode/agenticapps/agenticapps-workflow-core/spec/10-observability.md` (verified present, 21k, spec_version 0.3.0). The canonical contract for baseline-file shape, delta scan, CI integration.
- **Hand-off prompt** — pasted in session 2026-05-15. Contains 5 internal phases + 3 open questions. Phase 12 treats these 5 as plans inside one GSD phase, not 5 GSD phases.
- **Phase 1 CONSTRAINTS** — `CLAUDE.md` "Hard architectural constraints" section. Phase 12 extends the path allow-list; the extension is a constraint change subject to `/cso` review.
- **Phase 5 ObservabilityHealth route** — `packages/agent/src/routes/observability.ts`. Phase 12 does NOT modify this route; Phase 12 adds sibling routes per D-12-02.
- **Phase 10 D-10-08** — Observability section was introduced in the sidebar IA. Phase 12 graduates that section to 2–3 entries.
- **Phase 10.5 IMPECCABLE-02** — composite floor ≥ 87 for frontend-touching phases. Phase 12 must pass.
- **HelpHook component** — `packages/spa/src/help/components/HelpHook.tsx`. Reused as-is.
- **Help docs anchor scaffold** — `packages/spa/src/help/pages/observability.overview.lazy.tsx`. Phase 12 either lands the `observability.scan` + `observability.apply` MDX pages or stubs them via `ComingSoonRoute`.
- **fx-signal-agent fixture** — `~/Sourcecode/factiv/fx-signal-agent/.scan-report.md` (concrete example of underlying data shape — registry path drift means this fixture is currently unreachable via the dashboard's registered root; tests use a copy committed under `packages/agent/test-fixtures/` per D-12-XX).

</references>

<verification-targets>
## Verification targets (1:1 evidence per must_have)

To be enumerated in `/gsd-plan-phase 12` → `12-VERIFICATION.md`. Sketch:

- **MUST-1** Baseline schema parses fx-signal-agent + cparx fixtures without error. Evidence: vitest assertion logs.
- **MUST-2** Status pill rules pass all four states (Conformant / Drift / Stale / Not Set Up) on parameterised fixtures. Evidence: vitest table-test output.
- **MUST-3** Daemon's new routes return 200 + matching Zod-validated payload for fixtures; 404 for unknown project ID; 403 for missing bearer; reject path traversal in URL params. Evidence: integration test logs + curl probes.
- **MUST-4** Path allow-list extension does NOT regress `/read`'s existing allow-list. Evidence: existing read.test.ts still green.
- **MUST-5** SPA renders all three views with mock data; sparkline handles 1-point + 90-point datasets without overflow. Evidence: `/browse` screenshots in commit messages.
- **MUST-6** "Run scan-apply" copies the correct command for the registered project root + selected confidence. Evidence: clipboard mock assertion + manual `/browse` test.
- **MUST-7** A11y — keyboard navigable; pill colors paired with text/icon (color isn't the only signal); axe-core scan reports zero violations on each view. Evidence: axe-core test output + screen-reader script.
- **MUST-8** `impeccable critique` composite ≥ 87 on all three views at 1440×900. Evidence: `12-IMPECCABLE.md` artifact.

</verification-targets>

<next-steps>
## Next steps (NOT executed in this turn)

1. **Merge 5 open PRs** (#30/#31/#32/#33 dashboard, #3 workflow-core) — they're documentation + a tertiary-contrast token bump and don't block this branch, but landing them first keeps main stable.
2. **Run `/gsd-discuss-phase 12`** — resolves D-12-01..D-12-09 above (and any new ones surfaced) via AskUserQuestion. Output: appended decisions section + `12-DISCUSSION-LOG.md`.
3. **Run `/gsd-plan-phase 12`** — produces `12-PLAN.md` with 5 internal plans (matching hand-off phases 1–5), `12-RESEARCH.md` extension (technical realities of each gray-area decision), `12-UI-SPEC.md` (locked via `/gsd-ui-phase 12` + `gstack:/design-shotgun`), and `12-REVIEWS.md` (cross-AI peer review per ADR-0018 + the workflow's `/gsd-review` gate).
4. **Execute via `/gsd-execute-phase 12`** — wave-based, TDD-strict, two-stage review + `/cso` + `/qa` + impeccable critique post-execution.

</next-steps>
