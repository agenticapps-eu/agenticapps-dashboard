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

- [ ] Withdraw the six v1 locations from `packages/spa` — `/` (`MultiProjectHome`), `/projects/$projectId`, `/coverage`, `/observability/skill-drift`, `/observability/conformance`, `/code-intelligence` — removing their route definitions, lazy modules, and every component whose only consumer is one of them
- [ ] Reduce the sidebar to the two groups §3 requires: remove the `Observability` and `Code Intelligence` sections and the per-project entries under `WORKSPACE`
- [ ] Verify the deployment serves v2, pairing works, and all four post-cutover surfaces load — fleet, repo detail, workflow conformance, and the agent-change board
- [ ] Implement one migration manifest enumerating the five retired legacy surface routes → fleet (`/`, `/coverage`, `/observability/skill-drift`, `/observability/conformance`, `/code-intelligence`), `/projects/:id` → `/repos/:id`, and every removed daemon API; unknown locations and APIs listed there return not-found. `/` keeps its existing unpaired-visitor redirect to `/onboarding`
- [ ] Remove authored help pages, widget dispatch entries, contextual links, and keyboard-shortcut targets whose only destination is a retired surface; audit that every surviving contextual link resolves to an authored page and any specified anchor
- [ ] Author or update one help page for each post-cutover content surface — fleet, repo detail, and workflow conformance, plus the agent-change surface once it exists — and verify each explains that surface's vocabulary; retain the cross-cutting shortcut reference
- [ ] **One commit.** The cutover deletes; a revert of that single commit is the rollback

## 2. Daemon teardown · AGE-474

- [ ] Remove the withdrawn route modules and their tests
- [ ] Remove the withdrawn libraries: conformance scan/score/cache including `conformanceScore.ts`, coverage scan/resolver/cache/history/spawn including `coverageHistory.ts`, all snapshot writers/readers/routes, and the linter runner/cache
- [ ] Remove the withdrawn shared schemas and their barrel exports
- [ ] Retain `project-registry` drift detection, suggested-path discovery, and the strict atomic repair endpoint; remove only the conformance-page path-drift panel and its UI-specific feedback/concurrency code
- [ ] **Keep** the family-roots helper in `packages/agent/src/lib/paths.ts` — the `workflow` check and the workflow scanner both use it. Renaming it away from the old coverage vocabulary is worthwhile but belongs in its own commit with all call sites
- [ ] **Keep** the `openspec` entry in the read allow-list added by `add-openspec-project-reader`
- [ ] Confirm the sibling `add-workflow-fleet-conformance` filesystem-policy delta has replaced the old spawn authorization with exactly four sites — editor, bounded git, OpenSpec reader, and workflow harness — so the retired coverage/linter runners have no surviving exception and no fifth site exists
- [ ] Confirm `add-workflow-fleet-conformance`'s filesystem-policy delta and `openspec/config.yaml` constraint are applied before teardown verification
- [ ] Confirm retained snapshot and environment files are neither read nor written by v2; record deletion or archival as separate cleanup
- [ ] `pnpm -r typecheck` and per-package tests green; no dead import remains

## 3. Implement and verify product-quality invariants · AGE-476

- [ ] Re-measure `pnpm lint` before starting — the figures in the issue come from a session handoff, not a fresh run
- [ ] Drive lint to zero errors and zero warnings; enforce with a zero-warning flag in CI
- [ ] Raise the design critique floor in `CLAUDE.md`, and resolve the full `openspec/BACKLOG.md` entry **“Impeccable floor: three numbers on disk, and a CI gate that does not exist”**: correct `README.md` and `docs/review-protocol.md`, remove dead workflow links or restore the gate, and record whether enforcement is CI-based or remains a per-change artifact gate
- [ ] Implement the two-family type scale from enumerated tokens and apply tabular figures to every numeric column; add tests that reject component typography outside those tokens
- [ ] Audit every state-bearing element and give each a non-colour channel; test all readiness states plus navigation-current state in light and dark appearances
- [ ] Render the canonical em dash wherever a value is absent, preserve every real version/percentage/count beside its state, and test both cases across fleet and detail surfaces
- [ ] Implement exactly two sidebar groups — product content and utilities — with help and settings/account in utilities, no registered-project entries, the shared navigation primitive and indentation, stable peer order, and a non-colour-only current marker
- [ ] Verify fifteen uniform fleet rows and every surface without horizontal scrolling at 1440×900; verify at 390×844 that logical rows may wrap internally without becoming cards or hiding required fields and every control remains reachable
- [ ] Four design-critique artifacts, one per surface

## 4. Fold the spec deltas

- [ ] Apply this change's deltas into `openspec/specs/`
- [ ] Confirm `code-intelligence`, `fleet-coverage`, `fleet-conformance`, `skills-and-linting`, `optional-integrations` are gone
- [ ] Confirm `project-dashboard` contains the four retained requirements plus `Retired Locations Have An Explicit Transition` and `Optional Integrations Never Become Load-Bearing`
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
