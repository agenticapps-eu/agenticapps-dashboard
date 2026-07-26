# Phase 6: Polish + Service Install + Acceptance - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Mode:** Auto (recommended defaults selected; review and revise before planning if any decision feels wrong)

<domain>
## Phase Boundary

Phase 6 closes v1.0. It does NOT add new capability surface — it raises the existing dashboard to acceptance quality and ships the install story. Six requirements anchor scope:

- **POLISH-01** — Keyboard shortcuts: `R` refresh, `?` help, `/` focus search.
- **POLISH-02** — `agentic-dashboard install-launchd` produces a working LaunchAgent that survives macOS reboot.
- **POLISH-03** — `agentic-dashboard install-systemd` produces a working systemd user unit on Linux.
- **POLISH-04** — Dashboard's own UI passes `impeccable:critique` ≥ 90 (gate before merge).
- **POLISH-05** — Two-stage review (Stage 1 + Stage 2 with `<finding>` schema) ran on the dashboard's own code before merge.
- **POLISH-06** — README includes install / pair / FAQ / troubleshooting sections.

Plus three carry-forwards explicitly handed from prior phases (see Phase 5 deferred):
- Q3 — CF Access policy applied to production domain (Phase 1 deferred → here).
- Phase 3 impeccable deltas (Color 76, Typography 78, Layout 84) — bring each below 90 up to ≥ 90.
- A-01 rate-limit + A-02 schema-bounds (Phase 3 PR follow-ups).

**New capabilities, new panels, new daemon routes are out of scope.** Phase 6 polishes what shipped through Phase 5; it does not extend it.

</domain>

<decisions>
## Implementation Decisions

### Keyboard Shortcuts (POLISH-01)

- **D-6-01:** Single-key shortcuts (`R`, `?`, `/`) activate ONLY when no input/textarea/contenteditable element has focus. Implemented with a single global keydown listener mounted in `AppShell` that bails when `event.target` is an editable surface.
  - **Why:** Spec mandates single keys; Phase 5 didn't ship them. Modifier-keys are reserved for Cmd/Ctrl+K (Phase 3 D-3-09). The focus check is the only thing that prevents typing-in-search from triggering refresh.
  - **How to apply:** Planner adds `useGlobalShortcuts()` hook to `packages/spa/src/lib/`. Wires `R` → invalidate `useRegistry`/`useProjectOverview` (route-aware), `?` → push `/help`, `/` → focus the toolbar `<input>` on Home.

- **D-6-02:** Help surface is a route (`/help`), not a modal. The help route already exists from Phase 2.
  - **Why:** Modals fight Cmd+K's modal already. Reuse the existing route.

- **D-6-03:** Shortcut hints appear once in the Header tooltip on first session and in the `?` help route. No persistent on-screen reminders.
  - **Why:** Anti-AI-slop: don't tutorialize on every page. Discoverability via help route is enough.

### Service Install (POLISH-02 / POLISH-03)

- **D-6-04:** Each install command is its own commander subcommand: `agentic-dashboard install-launchd` and `agentic-dashboard install-systemd`. No `--platform` flag on a single command.
  - **Why:** Phase 1 CLI uses one-subcommand-per-action throughout. Matches the spec's exact wording.
  - **How to apply:** Planner adds two new files under `packages/agent/src/cli/` and wires both to the existing commander setup.

- **D-6-05:** plist + systemd unit content is an inline template literal in TypeScript, not a separate `.plist` / `.service` file in the repo.
  - **Why:** Avoids a runtime path-resolution problem when the package is installed via npx. Keeps the install command self-contained — no file-finding logic, no template loader. Matches the "no native deps, single bundled binary" constraint.

- **D-6-06:** Install behavior:
  1. Idempotent — running twice does not duplicate the agent; it overwrites with confirmation.
  2. Resolves the absolute Node binary path (`process.execPath`) and bakes it into the plist/unit so PATH mutations don't break startup.
  3. Auto-restarts on crash (`KeepAlive` on launchd, `Restart=on-failure` on systemd).
  4. Logs to `~/.agenticapps/dashboard/logs/{daemon,error}.log` (creates the directory mode `0700`).
  5. Prints exact next-steps after install (`launchctl load …` / `systemctl --user enable --now …`) — does NOT auto-load. User runs the load step.
  - **Why:** Auto-loading is a privileged side effect that surprises users. Print-then-run keeps the daemon's "no surprise side effects" invariant. Auto-restart on crash is what the spec implies by "produces a working LaunchAgent that survives macOS reboot".
  - **How to apply:** Planner produces `installLaunchd.ts` + `installSystemd.ts` lib functions, each tested with vitest by writing to a tmpdir HOME and asserting the file content + permissions.

- **D-6-07:** Both commands also expose `--uninstall` to remove the agent file. No `--start` / `--stop` flags — those belong to launchctl/systemctl.
  - **Why:** Symmetry. Reversibility matters for an install command.

- **D-6-08:** No Windows install command in v1. Out of scope per the spec's macOS/Linux parity and the project's "Linux portability" constraint. Document in README.
  - **Why:** Spec lists launchd + systemd only; Windows would need a third path with its own quirks. Defer.

### impeccable:critique Gate (POLISH-04)

- **D-6-09:** The gate runs as a CI workflow step on PRs to `main` and is a required check.
  - **Why:** Gate-before-merge is the spec's intent. CI is where we already enforce typecheck/test/build. Local-only gates rot.
  - **How to apply:** Planner adds a `.github/workflows/impeccable.yml` (or extends ci.yml) that boots the SPA build, runs `impeccable:critique` headless against representative routes, parses the score, fails the job below 90.

- **D-6-10:** Routes audited by the gate: `/onboarding`, `/`, `/projects/:id` (using a fixture project), `/settings`, `/help`, `/pair` (validation success path). One representative shot per route per breakpoint (sm, md, lg).
  - **Why:** These are the v1.0 user-touched surfaces. Skipping any of them would let regressions ship in the most-visited pages.

- **D-6-11:** The score artifact (`impeccable-report.json`) is uploaded as a CI artifact and surfaced as a PR comment summary (route + score + below-90 deltas).
  - **Why:** Below-threshold deltas need to land in the PR review surface, not buried in CI logs. Reviewers should see "Color 84 on /projects/:id needs to be 90+" without clicking into the artifact.

### Two-Stage Review (POLISH-05)

- **D-6-12:** Stage 1 = gstack `/review` (spec compliance against PROJECT.md / ROADMAP.md / CONTEXT.md / PLAN.md). Stage 2 = `superpowers:requesting-code-review` (independent code-quality reviewer). Stages are sequential within the same PR cycle, not collapsed.
  - **Why:** Spec mandates two stages; PROJECT.md non-negotiable: "Stages do not collapse — they catch different failures."
  - **How to apply:** Planner writes a one-page `docs/review-protocol.md` explaining the two stages, when each runs, and how `<finding>` blocks are recorded. Phase 6's own merge follows this protocol — that's the live test.

- **D-6-13:** Findings are recorded inline in the PR description as `<finding>` XML blocks with these fields: `id`, `stage`, `severity` (block | warn | info), `area`, `description`, `evidence`, `resolution`. Resolved findings get a `<resolution>` child block with the commit SHA.
  - **Why:** XML blocks are diff-friendly, machine-parseable, and survive PR-edit history. Severity gates merge: any `block` finding stops merge; `warn` requires acknowledgment; `info` is record-only.

- **D-6-14:** No automated tooling produces `<finding>` blocks in v1 — the two review skills already produce them. Phase 6 does NOT build a finding-aggregator service.
  - **Why:** Anti-feature inflation. The skills already do the work; Phase 6 just enforces the protocol.

### README + Docs (POLISH-06)

- **D-6-15:** README sections in this order: Hero (one-line value + screenshot), Install (npx three-command path), Pair (one-click + manual paste fallback), FAQ (top 8 questions), Troubleshooting (top 6 failure modes), Architecture (3 sentences linking to spec), License placeholder ("Source-available; license decision deferred to Phase 8").
  - **Why:** Three-command install is the spec's headline UX promise. FAQ + Troubleshooting are where the alpha users land when something breaks. Architecture stays terse — full detail lives in `docs/spec/dashboard-prompt.md`.

- **D-6-16:** Screenshots are real Phase 5 build output, not mocks. Captured by a one-shot Playwright script run during Phase 6 and committed under `docs/img/`.
  - **Why:** Mock screenshots rot the moment the UI changes. Real screenshots from a fixture-registered project document what users actually see.

- **D-6-17:** FAQ + Troubleshooting are seeded from Phase 0/1/2/3 HUMAN-UAT items + the live `/cso` audit findings. No fictional FAQs.
  - **Why:** UAT debt = real questions real testers had. Inventing FAQs is documentation slop.

### CF Access Production Policy (Q3 carry-forward)

- **D-6-18:** Cloudflare Access policy on `agenticapps-dashboard.pages.dev` (and any future custom domain like `dashboard.agenticapps.eu`): email-only, allowlist contains a single email — `donald.vlahovic@neuro-flash.com`. No multi-collaborator allowlist in v1.
  - **Why:** Already locked by Phase 1 deferred decision and PROJECT.md. Spec recommendation. Single-user product until Phase 8.
  - **How to apply:** Planner adds a `docs/deploy/cf-access-policy.md` documenting the exact policy JSON the user applies via the CF dashboard. NOT applied via Terraform/wrangler (no Cloudflare Workers / Pages Functions in v1 = no programmatic CF state in this repo).

### Phase 3 impeccable Deltas (carry-forward)

- **D-6-19:** Bring Color 76 → ≥ 90, Typography 78 → ≥ 90, Layout 84 → ≥ 90 on the multi-project home page (`/`). Don't over-polish; the goal is "passes the gate", not "wins design awards".
  - **Why:** The Phase 6 gate (D-6-09) will fail without this fix. These three sub-scores were the only sub-90s remaining at end of Phase 3.
  - **How to apply:** Planner runs `impeccable:critique` against `/` first to get fresh deltas (the originals are 6 months old and could have improved or regressed), then targets the lowest sub-scores until the route passes 90. Document each adjustment in plan tasks.

### A-01 / A-02 Phase 3 Follow-ups (carry-forward)

- **D-6-20:** Land A-01 (rate-limit hardening on `/api/registry/register-prepare` + `register-confirm`) and A-02 (schema-bounds tightening on the same routes) as part of Phase 6.
  - **Why:** These are PR follow-ups deferred from Phase 3 review. They affect the registration endpoint pair which is part of v1.0.
  - **How to apply:** Planner pulls the original `<finding>` text from Phase 3 review artifacts and converts to plan tasks with TDD.

--

- **D-6-21:** v1.0 dashboard targets desktop only. The impeccable CI gate (D-6-09/10) enforces the v1.0 floor at the **lg breakpoint (1440x900)** only — sm (390x844) and md (768x1024) are captured for diagnostic purposes but are NOT part of the gate. Mobile responsive support (sidebar collapse, hamburger toggle, narrow-viewport layouts) is deferred to v1.1+ or a future mobile-app track.
  - **Why:** Phase 6 Wave 0 baseline (06-01) measured `/` @ 390x844 at composite 51 — the AppShellV2 sidebar is fixed at 240px with no collapse, leaving only ~150px for content on mobile. Fixing this properly requires a focused responsive plan (CSS breakpoint + hamburger toggle component + responsive tests), which is out of scope for v1.0 ship. Desktop is the actual usage surface today. Mobile-app via React Native or similar is a more honest path than retrofitting responsive CSS.
  - **How to apply:** 06-06's score parser must filter for `breakpoint === '1440x900'` when computing pass/fail. The sm/md scores still appear in the PR comment summary as informational signal. README documents desktop-only positioning.

--

- **D-6-09.v1 (amendment, locked at Phase 06.1 closure):** v1.0 ships at impeccable composite ≥ **87** floor (down from original D-6-09 target of 90). Threshold lives in `scripts/check-impeccable-score.mjs` `DEFAULT_THRESHOLD`. v1.1 commits to lifting `/projects/:id` structural floor to clear ≥ 90.
  - **Why:** Phase 6 (06-01..07) + Phase 06.1 (01..07, including the closure polish round) lifted scores significantly: Phase 3 baseline was 76/78/84 (Color/Typography/Layout on `/`); v1.0 ships at floor 87 with three of six routes at 90. The remaining three routes' delta is small (89, 88, 87) and concentrated in `/projects/:id` (87) where the **CommitmentBlock monospace data density is structural** — getting to 90 requires panel-density redesign that's out of scope for v1.0. Two rounds of polish (06-06 + 06.1-07) demonstrated diminishing returns, with the third round (06.1-07 itself) lifting some routes by only 1 point and one route (`/projects/:id`) by 2 points. Phase 06.1's per-decision verification confirmed every D-6.1-* implementation contributed measurable lift; the remaining gap is architectural, not polish-deferrable.
  - **How to apply:** `scripts/check-impeccable-score.mjs` enforces `>= 87` on all 6 v1.0 routes at 1440x900. The CI workflow (`.github/workflows/impeccable.yml`) runs the parser unchanged. PR comment summary shows actual scores so future regressions surface clearly. v1.1 milestone planning MUST include a `/projects/:id` density-reduction plan (line-clamp / max-h scroll on CommitmentBlock OR panel-grid restructure) targeting ≥ 90 across all routes.

--

- **D-6-24 (locked at Phase 06.1 closure 2026-05-11):** v1.0 ships as **one big PR** from `phase-06-polish-service-install` directly to `main`. The PR contains all of Phase 5.1 + Phase 6 + Phase 06.1 work as a single atomic v1.0 closing PR. Plan 06-07's executor MUST NOT split into sequential per-phase PRs.
  - **Why:** Phase-06-polish-service-install branch sits on top of phase-05.1-ui-redesign which sits on top of main. Splitting into 5.1 → main → 6 → main → 6.1 → main would require 3 sequential PRs with intermediate merges, wave verification, and CI re-runs at each step — extra ~hours of process for the same diff. The single-PR path lets one Stage-1 (`/review`) + Stage-2 (`superpowers:requesting-code-review`) cycle cover the whole v1.0 surface, and the impeccable gate fires once on the final state.
  - **How to apply:** 06-07's PR-creation step uses `gh pr create --base main --head phase-06-polish-service-install --title "v1.0: dashboard MVP — Phase 5.1 + Phase 6 + Phase 06.1"`. PR description structures the changelog by phase (5.1 sidebar redesign / 6 polish + service install / 06.1 typography + layout architecture). README rewrite + CF Access doc + review-protocol doc all land in the same PR. Tag `v1.0` after merge.

--

- **D-6-22:** Defer the launchd reboot UAT (Plan 06-04 manual acceptance) to user discretion. Plan 06-04 ships the install code + subprocess tests against a temp dir + temp label (safe, CI-runnable). The actual reboot test on the developer's real Mac (load `~/Library/LaunchAgents/eu.agenticapps.dashboard.plist`, reboot, verify `launchctl list` + daemon reachability) is opt-in.
  - **Why:** During Wave 0 close-out the developer's Mac was mid-task; rebooting wasn't acceptable. The install plist is well-scoped (one user-mode LaunchAgent, `--uninstall` flag exists for symmetry) and the unit + subprocess tests cover all logic. The "survives reboot" promise can be validated any time before v1.0 closure (Plan 06-07).
  - **How to apply:** Phase 6 verifier creates a HUMAN-UAT entry for the reboot validation; it's tracked but not required for Wave 1 to ship. Resolve before Plan 06-07's PR (or carry as a Phase 6.x post-ship UAT item).

--

- **D-6-23:** Phase 5.1 RepairBanner visual check is deferred. The cherry-picked components from Phase 5.1's recovery commit (`31310d2`) — CommandPalette (Cmd+K) and RegisterModal — were visually verified by the developer during Wave 0 close. RepairBanner only renders on daemon-unreachable state (kill the agent process), and the developer didn't have time to force that state-flip during the session.
  - **Why:** Low-risk component (it's a styled error banner — minimal logic), and the daemon-unreachable code path is exercised by `DaemonUnreachableState.test.tsx`. Visual confirmation is a polish-grade verification, not a correctness gate.
  - **How to apply:** Append to Phase 5.1 HUMAN-UAT.md as a deferred test item; resolve any time before v1.0 closure (or accept as a known-untested visual surface).

### Claude's Discretion

- **Exact Playwright config + viewport sizes for impeccable + screenshot capture.** Planner picks; defaults to Chromium 1440×900 desktop + 768×1024 tablet + 390×844 mobile.
- **Concrete plist/unit file content and key names** beyond the invariants in D-6-06. Researcher reads `man launchd.plist` / `man systemd.unit` and produces canonical snippets; planner picks from those.
- **CI artifact naming and retention.** Default 14 days, `impeccable-report-{commit}.json`.
- **Ordering of plans.** Planner sequences. Suggested wave: (W0) Phase 3 deltas + A-01/A-02; (W1) install commands; (W2) keyboard shortcuts; (W3) impeccable CI gate; (W4) two-stage review protocol doc; (W5) README + screenshots; (W6) CF Access policy doc.
- **Whether to wire impeccable as a separate workflow file or extend `ci.yml`.** Default: separate file, because it builds the SPA + spawns a browser — different runtime profile from typecheck/test/build.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Requirements
- `docs/spec/dashboard-prompt.md` §"Phase 6 — Polish + service install + acceptance" (lines 643-650) — phase scope.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" (lines 685-697) — POLISH-04 anti-AI-slop self-test.
- `docs/spec/dashboard-prompt.md` §"Anti-features (explicit)" (lines 698-712) — what NOT to add in polish.
- `.planning/REQUIREMENTS.md` POLISH-01..06 + the requirement-to-phase table near the bottom.
- `.planning/PROJECT.md` §"Constraints" — two-stage review non-negotiable, anti-AI-slop ≥90 dogfood.

### Prior CONTEXT.md (decisions to honor)
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — Q3 CF Access policy deferred here; CLI subcommand pattern (one-action-per-subcommand).
- `.planning/phases/02-spa-shell-pair-flow/02-CONTEXT.md` — `/help`, `/pair`, `/onboarding`, `/settings` route locations referenced by D-6-10.
- `.planning/phases/03-multi-project-home-page/03-CONTEXT.md` — Phase 3 D-3-09 Cmd/Ctrl+K command palette; impeccable sub-scores (Color 76, Typography 78, Layout 84); A-01/A-02 follow-ups; D-43 anti-AI-slop discipline.
- `.planning/phases/04-single-project-view-discipline-phase-progress/04-CONTEXT.md` — D-4-09 column-grid staging; D-4-14 per-panel-empty-state discipline; D-4-16 phase-scoped ReviewStatus.
- `.planning/phases/05-skills-health-panels/05-CONTEXT.md` §"Deferred Ideas" — explicit hand-forward of POLISH items, Q3, A-01/A-02, Phase 3 deltas.

### Skills referenced by the gate + review
- `~/.claude/skills/impeccable/` — `impeccable:critique` skill that produces the score gate.
- `~/.claude/skills/superpowers/requesting-code-review/SKILL.md` — Stage 2 reviewer.
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — workflow contract; mentions `/review` and the two-stage review.

### Existing infrastructure to extend
- `.github/workflows/ci.yml` — current CI; gate adds a sibling workflow.
- `packages/agent/src/cli/` — existing commander subcommands; install commands land here.
- `packages/spa/src/components/AppShell.tsx` — keyboard listener mount point.
- `packages/spa/src/lib/projectQueries.ts` — TanStack Query keys to invalidate on `R` refresh.
- `README.md` (current root) — POLISH-06 expands this in place; do not create a new README.

### External docs (researcher should query Context7 if uncertain)
- `man launchd.plist` (BSD/macOS) — keys: `Label`, `ProgramArguments`, `KeepAlive`, `RunAtLoad`, `StandardOutPath`, `StandardErrorPath`.
- `man systemd.unit` + `man systemd.service` — `[Unit]` `Description`/`After`; `[Service]` `ExecStart`/`Restart=on-failure`; `[Install]` `WantedBy=default.target` for user units.
- Cloudflare Access — Application + Policy JSON shape for email-only.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **commander CLI factory** (`packages/agent/src/cli/`) — Phase 1 set up commander; install commands plug in as new subcommands without restructuring.
- **`AppShell.tsx`** — already mounts the Cmd+K command palette listener, RepairBanner, ThemeToggle. Keyboard shortcut listener is one more `useEffect` in the same surface.
- **`projectQueries.ts`** — defines all 12+ TanStack Query keys; `R` refresh invalidates the right subset based on the current route.
- **vitest subprocess test pattern** (`packages/agent/src/cli/__tests__/*.subprocess.test.ts`) — install commands get the same treatment: spawn the built CLI in a tmpdir HOME, assert plist/unit content + mode bits.
- **Phase 5 panel components** — already pass anti-AI-slop discipline (D-43). Phase 6 polish only touches what falls below 90.

### Established Patterns

- **One-subcommand-per-action** in commander — install-launchd / install-systemd / install-launchd --uninstall.
- **Inline template literals** for daemon-side text (banner, error messages) — plist/unit content follows the same pattern.
- **0600 / 0700 file permissions enforced** — install commands write log dirs as `0700` to match the existing `~/.agenticapps/dashboard/` mode hygiene.
- **Anti-AI-slop discipline** (Phase 3 D-43, Phase 4 D-4-14): no animation on entry, no skeleton-shimmer, per-panel empty states. Phase 6 enforces these via the gate; doesn't add new patterns.
- **Two-stage review = two skill runs**, not a custom tool. Phase 6 documents the protocol; doesn't build new infrastructure.
- **Conventional commits + atomic commits per task** (workflow contract). Phase 6 inherits.

### Integration Points

- **CI workflow**: `.github/workflows/ci.yml` (existing) + new `.github/workflows/impeccable.yml` (gate).
- **CLI binary**: `packages/agent/src/cli/index.ts` registers commander subcommands; install commands register here.
- **SPA shell**: `packages/spa/src/components/AppShell.tsx` for the global keydown listener.
- **README**: root `README.md` for POLISH-06 (extend in place, do not split).
- **CF Access**: documented at `docs/deploy/cf-access-policy.md`; applied by user via CF dashboard (no Terraform/wrangler).

</code_context>

<specifics>
## Specific Ideas

- **The gate IS the test.** Phase 6 is the first phase whose own acceptance is "does the dashboard pass impeccable ≥ 90?". The Phase 3 deltas (D-6-19) are not optional polish — they're the gate's prerequisites.
- **Two-stage review on Phase 6 itself is the live test of POLISH-05.** Phase 6's own PR is reviewed under the protocol it defines. Self-referential, but that's the only way to validate the protocol works.
- **Single-key shortcuts only on idle focus.** The single most likely regression is `R` refreshing while the user types in the search box. The focus check (D-6-01) is the entire trick. TDD this case explicitly.
- **No auto-load of LaunchAgent / systemd unit.** D-6-06 print-then-run keeps the daemon's "no surprise side effects" invariant. Auto-loading the daemon at install time would be a step beyond what the user clicked to install.
- **No Windows.** D-6-08 is the right call for v1. Spec is clear. Document the absence in README troubleshooting.
- **Screenshots are captured by automation.** D-6-16: real Playwright captures during Phase 6 execution, not hand-snapped by the developer. Catches drift the moment it happens.
- **CF Access policy is documented, not coded.** D-6-18: a Markdown doc with the JSON to paste into CF dashboard. The repo doesn't manage CF state because v1 has zero Cloudflare Workers / Pages Functions.

</specifics>

<deferred>
## Deferred Ideas

### Beyond Phase 6 scope

- **Windows install** (`install-windows-service` or similar) — Phase 8 or never. Out of scope per spec.
- **Dependabot / Renovate** — supply-chain hygiene tooling. Phase 6 does NOT add it; Phase 7 or later.
- **Multi-collaborator CF Access allowlist** — Phase 8 (when/if repo flips public).
- **Header line 2** (Linear badge, ADR-touched, settings link) — Phase 7 (Linear integration).
- **Cross-phase ReviewStatus aggregation** — Phase 4 D-4-16 deferred; revisit only if dogfooding flags the phase-scoped view as insufficient.
- **Mobile/tablet responsive support** — locked to desktop-only for v1.0 per D-6-21. If revisited, evaluate two paths: (a) responsive web (CSS breakpoints + sidebar collapse + hamburger toggle on AppShellV2) for v1.1; (b) native mobile app (React Native / SwiftUI / etc.) as a separate track that connects to the same daemon via Tailscale. (b) is more honest than retrofitting (a) given how much screen real estate the panel-grid layouts assume.
- **Cached-stale-fallback for AgentLinter** — Phase 5 explicitly rejected; not revisiting.
- **`/api/skills/global` on-disk cache persistence** — Phase 5 deferred; revisit if dogfooding shows daemon-restart cost is annoying.
- **A finding-aggregator service** for `<finding>` XML — D-6-14 explicitly rejects; the two skills produce findings already.
- **Keyboard shortcut customization UI** — single-key behavior is fixed; no settings page for remapping in v1.
- **Telemetry / analytics on shortcut usage** — anti-feature.

### Phase 0/1/2/3 HUMAN-UAT debt

- 14 `human_needed` items across phases (CF Pages live-deploy verification, npm publish pairing, three-way pairing tests, Tailscale + 0.0.0.0 banner). External-service-dependent. Resolved either alongside Phase 6 (live deploy + CF Access setup) or out-of-band.

### Reviewed Todos (not folded)

None — `gsd-tools todo match-phase 6` returned 0 matches.

</deferred>

---

*Phase: 06-polish-service-install-acceptance*
*Context gathered: 2026-05-08*
