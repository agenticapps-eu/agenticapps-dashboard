# Tasks

**Applies last.** M2, M3 and M4 must be complete and green before the cutover.
The spec deltas in this change are written now, alongside the v2 changes, so the
slot never carries two truths — but nothing here is applied until the
replacements stand.

## 1. Cutover · AGE-473

- [ ] Delete the old SPA package
- [ ] Rename the v2 SPA package to the original name and package identifier
- [ ] Update the workspace file, the build config, and the deploy build command
- [ ] Verify the deployment serves v2, pairing works, and all four surfaces load
- [ ] **One commit.** The cutover deletes; a revert of that single commit is the rollback

## 2. Daemon teardown · AGE-474

- [ ] Remove the withdrawn route modules and their tests
- [ ] Remove the withdrawn libraries: conformance scan/score/cache, coverage scan/resolver/cache/history/spawn, linter runner and cache, snapshot writers
- [ ] Remove the withdrawn shared schemas and their barrel exports
- [ ] **Keep** the family-roots helper in `packages/agent/src/lib/paths.ts` — the `workflow` check and the workflow scanner both use it. Renaming it away from the old coverage vocabulary is worthwhile but belongs in its own commit with all call sites
- [ ] **Keep** the `openspec` entry in the read allow-list added by `add-openspec-project-reader`
- [ ] Confirm the two remaining spawning routes are the editor route and the harness runner, and no others
- [ ] `pnpm -r typecheck` and per-package tests green; no dead import remains

## 3. Fold the spec deltas

- [ ] Apply this change's deltas into `openspec/specs/`
- [ ] Confirm `code-intelligence`, `fleet-coverage`, `fleet-conformance`, `skills-and-linting`, `optional-integrations` are gone
- [ ] Confirm `project-dashboard` retains exactly `Schema Validation At Both Ends`, `Hybrid OpenSpec Read Strategy`, `Register A Project From The Home Page`, `Keyboard Shortcuts`
- [ ] Re-count requirements and record the actual figure — do not restate a number from a proposal
- [ ] `openspec validate --all` green

## 4. Append the supersession note

- [ ] Append a dated supersession section to `openspec/CAPABILITY-MAP.md` recording the withdrawal, the three new capabilities, and the resulting count
- [ ] **Do not edit** the ratified capability table, the exclusions, or the GAP resolutions. Append only

## 5. Quality thresholds · AGE-476

- [ ] Re-measure `pnpm lint` before starting — the figures in the issue come from a session handoff, not a fresh run
- [ ] Drive lint to zero errors and zero warnings; enforce with a zero-warning flag in CI
- [ ] Raise the design critique floor in `CLAUDE.md`, and **correct `README.md`**: it states a floor superseded in June 2026 and links to a CI workflow file that does not exist. See the backlog entry
- [ ] Record the SPA source-file count against the target
- [ ] Confirm no horizontal scrolling on any surface at the reference width
- [ ] Four design-critique artifacts, one per surface

## 6. Unhook the unused packages · AGE-475

- [ ] Remove the linter and observer packages from the workspace file
- [ ] Move them to their own repositories or an archive directory — **do not delete**; both contain work with standalone value
- [ ] Not a blocker for anything else; may happen any time after the cutover

## 7. Verify

- [ ] `openspec validate --all` green
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
