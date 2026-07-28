# Tasks

**Applies in the atomic cutover.** `add-repo-readiness`,
`add-workflow-fleet-conformance`, and `add-agent-board` must be complete and
green. `remove-gitnexus-integration` MUST be folded before this change; its code
removal may be prepared earlier, but it and this retirement MUST deploy
atomically so the old conformance chart never renders the changed measurement.
The spec deltas in this change are written now, alongside the v2 changes, so the
slot never carries two truths — but nothing here is applied until the
replacements stand.

## 1. Cutover · AGE-473

- [ ] Delete the old SPA package
- [ ] Rename the v2 SPA package to the original name and package identifier
- [ ] Update the workspace file, the build config, and the deploy build command
- [ ] Verify the deployment serves v2, pairing works, and all four surfaces load
- [ ] Implement one migration manifest enumerating the four retired legacy surface routes → fleet, `/projects/:id` → `/repos/:id`, and every removed daemon API; unknown locations and APIs listed there return not-found
- [ ] Remove authored help pages, widget dispatch entries, contextual links, and keyboard-shortcut targets whose only destination is a retired surface; audit that every surviving contextual link resolves to an authored page and any specified anchor
- [ ] Author or update one help page for each post-cutover content surface — fleet, repo detail, workflow conformance, and agent board — and verify each explains that surface's vocabulary; retain the cross-cutting shortcut reference
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
