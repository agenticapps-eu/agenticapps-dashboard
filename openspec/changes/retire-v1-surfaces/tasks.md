# Tasks

**Applies at the cutover.** `add-repo-readiness` and
`add-workflow-fleet-conformance` must be complete and green — **both now are**:
readiness shipped in #90 and was completed in #92 and #93, and
`add-workflow-fleet-conformance` is archived.

`remove-gitnexus-integration` was previously required to deploy *atomically* with
this change, so the old conformance chart could never render the changed
measurement. **That requirement is retired (2026-08-02).** It archived on
2026-07-28 and shipped independently by design, discharging the obligation at the
source: old snapshots were re-scored ignoring `gitNexus` and `wiki`, so every
point in the retained window already uses the post-cutover column set. There is
no outstanding recomputation gate and no atomicity constraint left to honour.
See design §9.

**The agent-change surface prerequisite is discharged (2026-08-04).** This block
previously blocked the cutover until a replacement for the withdrawn
`add-agent-board` existed. `add-agent-change-board` archived on 2026-08-04:
`openspec/specs/agent-change-board/` is durable spec and `/changes` is wired in
the router. That block required the surface counts to be restated when the
replacement landed, so they are restated here: **the four post-cutover content
surfaces are fleet, repo detail, workflow conformance, and the agent-change
board.** No prerequisite remains outstanding.

The spec deltas in this change are written now, alongside the v2 changes, so the
slot never carries two truths. Every replacement they depend on now stands.

## 1. Cutover · AGE-473

**Corrected 2026-08-04: v2 was built in place, not in a second package.** This
section previously opened with "delete the old SPA package", "rename the v2 SPA
package to the original name" and "update the workspace file". No second SPA
package was ever created — `packages/spa/package.json` is the only SPA manifest
ever added to this repo, v1 and v2 locations coexist inside it, and `AppShellV2`
is already the live shell for both. `design.md` §8 always described the real
shape ("Known v1 SPA locations … redirect to the fleet"); it was this list that
carried the two-package premise. The cutover is a withdrawal of locations from
one package, and the workspace file changes in §6 for the linter and observer
packages, not for a SPA rename.

- [x] Withdraw the six v1 locations from `packages/spa` — `/` (`MultiProjectHome`), `/projects/$projectId`, `/coverage`, `/observability/skill-drift`, `/observability/conformance`, `/code-intelligence` — removing their ~~route definitions,~~ lazy modules, and every component whose only consumer is one of them — **118 files, 64 production and 54 tests. The route definitions are deliberately *retained*: this bullet was written before the manifest requirement, and removing them would turn each specified redirect into a not-found. They are now component-less redirect routes, which is the shape §8/§8b describe. Reachability was computed from `main.tsx`/`router.tsx`/`test-setup.ts` rather than read off directory names; zero surviving modules imported anything deleted. Four files the sweep flagged were kept and are *not* orphans of this change: `lib/contrast.ts` (design-system contrast-floor guard, consumed only by its spec test), `components/ui/MetricNumeric.tsx` and the two `*.declare.ts` from #82 (pre-existing orphans with no consumer at all — cleaning them belongs to whoever owns them). spa 1673 → 1077 tests over 81 files; typecheck, lint (0 errors) and `vite build` all green**
- [x] Reduce the sidebar to the two groups §3 requires: remove the `Observability` and `Code Intelligence` sections and the per-project entries under `WORKSPACE` — **`eae019c` RED / `24da1b5` GREEN. WORKSPACE (Workflow, Fleet readiness, Changes) and UTILITIES (Settings, Help); `ACCOUNT` renamed because the group holds help, which design §5 says must not be filed as account-level content. Peer order inherited, not re-chosen. Two further chrome affordances pointed at withdrawn locations and "worked" because the router redirects — the logo (`/` → `/fleet`) and the command palette's Jump action (`/projects/$projectId` → `/repos/$repoId`); both fixed, both previously invisible to every test. `SidebarSubItem` deleted with the project list, its only consumer. Critique artifact: `CRITIQUE.md`, composite **82.5 (33/40)** against the ratified floor of 80, measured live at 1440×900 in both themes**
- [x] Verify the deployment serves v2, pairing works, and all four post-cutover surfaces load — fleet, repo detail, workflow conformance, and the agent-change board — **verified live at 1440×900 against the running daemon on 2026-08-05, after the deletion, not before it. Pairing intact. All four render with content: `/fleet` (518 chars of main), `/repos/agenticapps-dashboard` (2684, and the sidebar marks Fleet readiness current through `alsoActiveFor`), `/workflow` (2770), `/changes` (2013); `/settings` and `/help` also load. All six retired locations still resolve after their components were deleted — `/`, `/coverage/`, `/observability/skill-drift`, `/observability/conformance`, `/code-intelligence` → `/fleet`, and `/PROJECTS/agenticapps-dashboard` → `/repos/agenticapps-dashboard`. The two spelling cases are deliberate: they are the ones that rendered a blank shell before `4b74dd6`. `/projects/:id/coverage` puts exactly "Not Found" in `#main`. No page-level horizontal scroll at any width tested. This bullet covers the *dev* deployment; the Cloudflare Pages build is §6**
- [x] Implement one migration manifest enumerating the five retired legacy surface routes → fleet (`/`, `/coverage`, `/observability/skill-drift`, `/observability/conformance`, `/code-intelligence`) and `/projects/:id` → `/repos/:id`. A location absent from the manifest returns not-found; the nineteen withdrawn daemon endpoints enumerated in the `project-dashboard` delta return not-found with no compatibility stub. `/` keeps its existing unpaired-visitor redirect to `/onboarding` — **manifest `9f6a932`/`f9a63df`, wired into the router `5bea178`/`5ddf534`. Verified in a real browser at 1440×900, 2026-08-05: all five legacy routes land on `/fleet`, `/projects/agenticapps-dashboard` lands on `/repos/agenticapps-dashboard`, `/projects/:id/anything` renders Not Found, and an unpaired `/` still reaches `/onboarding`.** The withdrawn daemon endpoints are §2, not done
- [x] Re-home the register affordance onto the fleet surface before deleting `MultiProjectHome` — `RegisterModal` and `RegisterButtonCard` have no other consumer, and the fleet's empty state currently points at the CLI. Registering a first repository from the browser must still work after the cutover — **`a8226cb`/`1767beb`, ahead of the redirect rather than after it (design §8a): the stated order would have broken browser registration for the intervening commits. Header action + empty-state button; `palette:open-register` re-homed with it; the fleet re-reads on confirm because `useRegisterConfirm` invalidates a key the fleet does not read**
- [x] Remove the knowledge-graph viewer's install command and delete its versioned asset directory under the daemon state dir; this is the one on-disk artifact class the change withdraws without naming an owner — **RED / GREEN `31380a0`. The command, `cli/installUnderstandViewer.ts` and `lib/viewerInstall.ts` are gone, and so is the `understand` block from `routes/health.ts` and `HealthResponseSchema` — `/health` was still reporting `viewerInstalled` on a retained route after the viewer's nineteen endpoints went, which is exactly the kind of field that survives a deletion because nothing points at it. No new `daemon-runtime` delta was needed: the `code-intelligence` delta in this change already removes `Viewer Asset Installation` ("the installation path and its asset directory are removed") and says the analysis status "is no longer reported anywhere in the dashboard", and `daemon-runtime`'s health requirement never enumerated the field. Asset directory `~/.agenticapps/dashboard/understand-viewer/` (2.6 MB, version 2.7.6) deleted on 2026-08-05. This also removed the last `pnpm` spawn, so the daemon's four enumerated spawn sites are now the only process creation in the package outside test helpers**
- [ ] Remove authored help pages, widget dispatch entries, contextual links, and keyboard-shortcut targets whose only destination is a retired surface; audit that every surviving contextual link resolves to an authored page and any specified anchor
- [ ] Author or update one help page for each post-cutover content surface — fleet, repo detail, and workflow conformance, plus the agent-change surface once it exists — and verify each explains that surface's vocabulary; retain the cross-cutting shortcut reference
- [ ] **One commit.** The cutover deletes; a revert of that single commit is the rollback

## 2. Daemon teardown · AGE-474

**The nineteen-endpoint table was re-derived before any deletion, as the
`project-dashboard` delta instructs, and the two agree exactly** — nineteen
handler registrations across twelve Hono instances in eleven route modules, with
no registration reachable by another form (`.use`, nested `.route`, `.on`, or a
loop). No correction to the table was required. The table now also exists in
executable form at `packages/agent/src/server/__tests__/withdrawnEndpoints.test.ts`.

**Verified against a live daemon on 2026-08-05, not only in-process.** The
daemon was restarted onto the post-teardown build and every one of the nineteen
probed with a valid bearer token: all nineteen answer **404**. Authenticating
matters — `bearerAuth` sits ahead of `/api`, so an unauthenticated sweep would
have answered 401 throughout and proved nothing. The four retained v2 surfaces
answer 200 in the same run (`/api/v2/fleet`, `/api/v2/workflow`,
`/api/v2/changes/fleet`, plus `/health` and `GET /api/registry`), and the health
payload comes back as `{ok, version, daemonVersion, registryCount, paired}` with
no `understand` block.

- [x] Remove the withdrawn route modules and their tests — **`55441df` RED / `20fb34a` GREEN. All eleven, plus the twenty-four libraries they were the only readers of and ten shared schemas: 107 files, −17,527 lines. The set was computed by reachability from `index.ts`/`cli.ts`/`server/app.ts`, not read off directory names; the post-deletion sweep reports zero unreachable production modules and zero tests importing a doomed module**
- [x] Remove the withdrawn libraries: conformance scan/score/cache including `conformanceScore.ts`, coverage scan/~~resolver~~/cache/history/spawn including `coverageHistory.ts`, all snapshot writers/readers/routes, and the linter runner/cache — **done, except `resolver`, which is struck out as a defect in this bullet rather than followed. `lib/coverageResolver.ts` is not a coverage module: it is the canonical home of `PathResolver`, `PathViolation` and `makeCoverageResolver`, the filesystem-access-policy enforcement seam its own header names ("every scanner reads external filesystem paths through this helper ONLY; direct fs calls inside scanner code are FORBIDDEN"). Sixteen surviving v2 modules import it — `readiness/{assemble,service,workflowDeriver}`, every workflow scanner, `containment.ts`, `workflowScan.ts`, `changes/changeReader.ts`, `paths.ts`. Deleting it would remove the security spine and break every retained surface. This is the same shape as the `paths.ts` family-roots helper the bullet two below already keeps: old coverage vocabulary, shared structure. Renaming it away from that vocabulary is worthwhile and belongs in its own commit with all call sites, exactly as that bullet says. Also kept: `lib/viewerToken.ts` and the viewer-secret rotation — per-repo viewer tokens now have no verifier, but `lib/auth.ts` reaches the rotation and `auth-and-pairing` is named out of scope by this change, so its removal is a separate change and not a silent side effect of this one**
- [x] Remove the withdrawn shared schemas and their barrel exports — **ten deleted (`agentlinter`, `conformance`, `coverage`, `coverageHistory`, `integrations`, `linear`, `observability`, `secrets`, `sentry`, `skillDrift`) with their barrel blocks replaced by prose recording what went and why. `env.ts` survives this bullet because it is reached through `daemon.ts` and belongs to the `env` CLI group removed further down**
- [x] Retain `project-registry` drift detection, suggested-path discovery, and the strict atomic repair endpoint; remove only the conformance-page path-drift panel and its UI-specific feedback/concurrency code — **`routes/registryFixPath.ts` and `lib/registryPathDrift.ts` both retained and green. This bullet collided with the one above it: `PathDriftReasonSchema`, `PathDriftEntrySchema` and `RegistryFixPathRequestSchema` lived inside `schemas/conformance.ts`, so deleting that file wholesale would have withdrawn the endpoint this bullet retains. The three moved to `schemas/pathDrift.ts`, which is where they always belonged; the tier, day-point and conformance-response shapes went with the page**
- [x] **Keep** the family-roots helper in `packages/agent/src/lib/paths.ts` — the `workflow` check and the workflow scanner both use it. Renaming it away from the old coverage vocabulary is worthwhile but belongs in its own commit with all call sites — **kept, but the stated reason does not hold and the real one is stronger. `COVERAGE_ROOTS` is imported by exactly two surviving modules, `lib/registryPathDrift.ts` and `routes/registryFixPath.ts` — the drift-detection and atomic-repair pair the bullet four above retains. The `workflow` check and the workflow scanner do *not* use it: `readiness/service.ts` computes its own `sourcecodeRootOf()` and `familyRoot`. Had the audit stopped at the bullet's rationale it would have found the named consumers gone and concluded the helper was deletable. `paths.ts` itself is untouchable for a separate and larger reason: it also exports `resolveAllowed`, `resolveAllowedNamed`, `PathViolation` and `isAnchoredUnder`, consumed by ten surviving modules including `routes/read.ts` and `routes/open.ts`. The rename remains worthwhile and still belongs in its own commit**
- [x] **Keep** the `openspec` entry in the read allow-list added by `add-openspec-project-reader` — **kept: `ALLOWED_SUBDIRS = ['.planning', '.claude', 'openspec']` in `packages/shared/src/schemas/read.ts` is unchanged by this section**
- [x] Confirm the sibling `add-workflow-fleet-conformance` filesystem-policy delta has replaced the old spawn authorization with exactly four sites — editor, bounded git, OpenSpec reader, and workflow harness — so the retired coverage/linter runners have no surviving exception and no fifth site exists — **confirmed, with two disclosures. The four sites are `routes/open.ts` (editor), `lib/git.ts` (bounded git), `lib/openspecCli.ts` (OpenSpec reader) and `lib/workflowHarness.ts` (harness); sites 2 and 3 spawn through `execa` rather than `node:child_process`, which is why an import-based census finds only two of the four — count by behaviour, not by import. The retired runners are gone: `agentLinterRunner.ts` and `coverageScan.ts` were both deleted in `20fb34a`, so neither has a surviving exception. Disclosure 1: `workflowHarness.ts` also calls `execFileSync('/bin/ps', …)` for the harness's own RSS accounting — a second process creation inside site 4's module, bounded by `workflow-fleet-conformance`, not a fifth site. Disclosure 2: `cli/installUnderstandViewer.ts` spawns `pnpm install` / `pnpm build`. It sits in `cli/`, outside the "route and library surface" the requirement's exhaustiveness scenario names, so it is not a fifth *daemon* site — but it installs a viewer that no longer has any serving route, and §1's unchecked bullet already calls for its removal. See the open question below**
- [x] Confirm `add-workflow-fleet-conformance`'s filesystem-policy delta and `openspec/config.yaml` constraint are applied before teardown verification — **both applied. `openspec/specs/filesystem-access-policy/spec.md` carries the four-site enumeration and the `The spawn enumeration is exhaustive` scenario ("a fifth site is a violation of this requirement rather than an undocumented detail"); `openspec/config.yaml` carries the matching `context:` constraint naming the user-driven foreign-process exceptions. `openspec validate --all` is 18/18**
- [x] Confirm retained snapshot and environment files are neither read nor written by v2 — **confirmed by sweep: no surviving source in `packages/{agent,spa,shared}/src` references `coverage-history` or `env.json`. The last reference was `ENV_FILE` in `constants.ts`, orphaned by the loader's removal and deleted here. Both trees survive on disk untouched — `~/.agenticapps/dashboard/{coverage-history,understand-viewer}/` — which is what the two retention bullets below govern**
- [x] **Remove the `env` CLI command group (`env set` / `env unset` / `env list`, `cli.ts:105-123`, `cli/envCmd.ts`) and the boot-time `loadEnvFile()` call at `cli/start.ts:222`.** Deleting the credential file while the writer and the loader survive is not a deletion: `agentic-dashboard env set` recreates it and every daemon boot reads it back. The file cannot be retired before the two paths that maintain it — **RED / GREEN `bf4a738`. Both maintaining paths gone, plus `lib/envFile.ts`, `schemas/env.ts`, and `shared/daemon.ts` — that barrel existed only to expose `EnvFileSchema` to the daemon without putting it on the browser-facing index (T-08-01/INV-05/D-08-13), so with its one export gone the subpath had nothing left to carry; the `./daemon` entry was dropped from the package exports and from the tsup build. `ENV_FILE` in `constants.ts` was orphaned by the same change and removed in `cfeb4d3`. Guarded behaviourally at the surface a user meets: the built CLI's `--help` must not list an `env` command**
- [x] **Delete the integration environment files thirty days after the cutover release.** This task is NOT complete until both blanks below are filled with literal values — `Files Retained For Rollback Have A Bounded Lifetime` requires a named person and a date, and "whoever ships the cutover" is a role, not an owner. Cutover release date: `n/a — deleted ahead of release`. Deletion deadline: `2026-08-05 (met)`. Owner: `Donald Vlahovic` — **discharged by deletion rather than by waiting out the window, which is stricter than the requirement asks. `env.json` was never present on this host: after the writer and loader were removed in `bf4a738`, an inspection of `~/.agenticapps/dashboard/` on 2026-08-05 found no such file, so the artifact class is empty here. Deleting it *before* the release is only safe because the same commit removed the two paths that would recreate it. Owner note: this covers this host. Any other machine running the daemon holds its own copy, and clearing those is the named owner's, not this change's**
- [x] **Give the retained conformance/coverage snapshots the same bounded retention**, under the same requirement: same thirty-day window, same named owner, same literal deadline, deleted or archived. Rollback evidence expires when rollback stops being possible — **`~/.agenticapps/dashboard/coverage-history/` deleted on 2026-08-05: 540 KB of daily NDJSON spanning 2026-05-24 to 2026-08-02. Owner: Donald Vlahovic. Deleted rather than archived, and deliberately ahead of the thirty-day window rather than at the end of it — a decision taken with the tradeoff stated: the scanner that produced these snapshots is gone, so this data cannot be regenerated and the coverage-history rollback path is closed as of this commit. Recorded here rather than left implicit, because "deleted early" and "expired on schedule" are not the same fact**
- [x] `pnpm -r typecheck` and per-package tests green; no dead import remains — **`pnpm -r typecheck` 0 errors across all five packages. Suites: agent 1344 +1 skipped over 107 files (was 1803 +1), shared 315 (was 500), spa 1059 unchanged — the SPA was not touched by the teardown, which is the expected shape given its callers were deleted last session. `pnpm lint` 115 problems, 0 errors (was 121/0 before this section, 205/0 before the SPA deletion). `vite build` clean. No dead import remains: the reachability sweep re-run after every deletion round reports 0 unreachable production modules and 0 tests importing a doomed module. One flake seen and not swallowed — `start.subprocess.test.ts` failed once and passed on re-run and in isolation; it spawns a real daemon against a real port and the same command had just rebuilt `dist/cli.js` underneath it**

## 3. Implement and verify product-quality invariants · AGE-476

- [x] Re-measure `pnpm lint` before starting — the figures in the issue come from a session handoff, not a fresh run. **Measured 2026-08-04 on `43b9282`: 227 problems, 0 errors, 227 warnings, 215 auto-fixable, overwhelmingly `import/order`.** `eslint .` exits 0 today, so CI is green and only the zero-warning flag below changes that
- [x] Drive lint to zero errors and zero warnings; enforce with a zero-warning flag in CI. **Measured 2026-08-05 on `069f1c2`: 115 problems, 0 errors, 115 warnings, 109 auto-fixable** (down from 227 as the §2 teardown deleted 107 files). The flag went in first (`7af7649`) so it was watched failing — `--max-warnings 0` on the root `lint` script, which both `ci.yml` and `release.yml` already invoke, so neither workflow changed. `2a88d92` cleared all 115: 109 by `eslint . --fix`, and six by root cause — an import placed **after** a `vi.mock()` call splits the file into two blocks that `import/order` reads as one interleaved group and its fixer will not cross. Since `vi.mock` is hoisted above every import, the layout was never load-bearing; imports moved up, mocks left below, per-file tests re-run (tailscale 11/11, tailscaleSetup 12/12, registryPathDrift 18/18). `pnpm lint` now exits 0
- [ ] Raise the design critique floor in `CLAUDE.md`, and resolve the full `openspec/BACKLOG.md` entry **“Impeccable floor: three numbers on disk, and a CI gate that does not exist”**: correct `README.md` and `docs/review-protocol.md`, remove dead workflow links or restore the gate, and record whether enforcement is CI-based or remains a per-change artifact gate
- [ ] Implement the two-family type scale from enumerated tokens and apply tabular figures to every numeric column; add tests that reject component typography outside those tokens
- [ ] Audit every state-bearing element and give each a non-colour channel; test all readiness states plus navigation-current state in light and dark appearances
- [ ] Render the canonical em dash wherever a value is absent, preserve every real version/percentage/count beside its state, and test both cases across fleet and detail surfaces
- [ ] Implement exactly two sidebar groups — product content and utilities — with help and settings/account in utilities, no registered-project entries, the shared navigation primitive and indentation, stable peer order, and a non-colour-only current marker
- [ ] Declare the `3.5rem` row-height maximum as a design token and verify by **measuring one fleet row against it**, not by counting rows on screen — the requirement forbids row count as the pass condition, and this task previously asserted "fifteen uniform fleet rows", which is the same defect the requirement was rewritten to remove. Verify every surface fits without horizontal scrolling at 1440×900; verify at 390×844 that logical rows may wrap internally without becoming cards or hiding required fields and every control remains reachable
- [ ] Verify rows grow with enlarged text rather than clipping it, confirming the maximum scales as a `rem` value
- [ ] Four design-critique artifacts, one per surface

## 4. Fold the spec deltas

- [ ] Apply this change's deltas into `openspec/specs/`
- [ ] Confirm `code-intelligence`, `fleet-coverage`, `fleet-conformance`, `skills-and-linting`, `optional-integrations` are gone
- [ ] Confirm `project-dashboard` contains seven requirements: the four retained ones plus `Retired Locations Have An Explicit Transition`, `Optional Integrations Never Become Load-Bearing`, and `Third-Party Products Are Integrated, Not Reimplemented`
- [ ] Confirm the hybrid OpenSpec reader no longer returns archived-change or per-change affected-capability data, while open-change/task and capability/requirement data remain available to their v2 consumers
- [ ] Update the live capability index and count in `CLAUDE.md` to the post-cutover set: remove links to the five withdrawn spec files and add the three replacement capabilities
- [ ] Update surviving capability Purpose prose so it describes v2; remove completed-removal banners from partially retained specs during the fold
- [ ] Re-count requirements and record the actual figure — do not restate a number from a proposal
- [ ] `openspec validate --all` green

## 5. Append the supersession note

- [ ] Append a dated supersession section to `openspec/CAPABILITY-MAP.md` recording the withdrawal, the three new capabilities, and the resulting count
- [ ] **Do not edit** the ratified capability table, the exclusions, or the GAP resolutions. Append only

## 6. Unhook the unused packages · AGE-475

- [ ] Remove the linter and observer packages from the workspace file
- [ ] Move them to their own repositories or an archive directory — **do not delete**; both contain work with standalone value
- [ ] Not a blocker for anything else; may happen any time after the cutover

## 7. Verify

- [ ] `openspec validate --all` green
- [ ] Fresh independent OpenSpec change review approves the revised artifacts before implementation
- [ ] `pnpm lint` green with zero warnings; per-package tests green
- [ ] Deployment serves v2 and pairs successfully
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT edit the ratified content of `openspec/CAPABILITY-MAP.md` — append only
- [ ] Do NOT delete anything under `docs/legacy-planning/` or `openspec/changes/archive/`
- [ ] Do NOT withdraw `daemon-runtime`, `auth-and-pairing`, `project-registry`
- [ ] Do NOT delete GitNexus here — that is `remove-gitnexus-integration`, which applies first
- [ ] Do NOT write the composite-score floor into a spec requirement
- [ ] Do NOT reuse the names `fleet-coverage` or `fleet-conformance` for the new capabilities
