# Tasks

## 1. Lock the standalone contract

- [x] Confirm `retire-v1-surfaces` remains blocked while the agent-change replacement is deferred
- [x] Confirm this removal ships independently and v1 coverage, history, and conformance remain operational
- [x] Confirm `fix-coverage-scan-open-defects` remains withdrawn and absent from the active change set
- [x] Record in an ADR the live/history v2 compatibility, full-window re-score, and legacy-value normalisation decisions
- [x] Confirm no `daemon-runtime` delta is required: the ratified `/health` shape never included the implementation-only GitNexus field
- [x] Confirm no `filesystem-access-policy` delta is required: deleting Wiki compiler reads narrows the existing dedicated-scanner boundary
- [x] Fresh independent OpenSpec change review approves these amended artifacts before implementation

## 2. Remove the daemon integrations

- [x] Delete `packages/agent/src/lib/gitnexusScan.ts`, `gitnexusFamilyScan.ts`, and `lib/scanners/gitNexusScanner.ts`
- [x] Delete `packages/agent/src/routes/gitnexusScan.ts` and unregister its routes
- [x] Remove GitNexus dispatch and the now-empty refresh route from `packages/agent/src/routes/coverage.ts`
- [x] Remove the implementation-only `gitnexus` extension from `packages/agent/src/routes/health.ts`
- [x] Delete `packages/agent/src/lib/scanners/wikiScanner.ts`
- [x] Remove both scanners and both public fields from `packages/agent/src/lib/coverageScan.ts`
- [x] Remove `.wiki-compiler.json` and `.knowledge/wiki` from coverage-scanner filesystem access
- [x] Delete the GitNexus and Wiki scanner suites and GitNexus shell fixtures
- [x] Confirm no remaining daemon path spawns GitNexus or reads Wiki compiler state
- [x] Confirm shutdown terminates every active GitNexus child before the modules are removed
- [x] Test: removed scan, poll, and refresh routes return not-found after the cutover

## 3. Remove the shared wire surface

- [x] Delete `packages/shared/src/schemas/gitnexusScan.ts` and its tests
- [x] Remove `gitNexus`, `wiki`, the GitNexus install state, and the refresh-action contract from `packages/shared/src/schemas/coverage.ts`
- [x] Replace the current coverage enum with `fresh`, `stale`, and `missing`; retain the four-state vocabulary only inside version-1 compatibility and legacy-snapshot readers
- [x] Capture version-1 live coverage and history fixtures from the running pre-change daemon before product-code edits
- [x] Define tolerant version-1 and strict version-2 live coverage schemas; v1 validates literal version 1 and retained cells while tolerating discarded integration data, and v2 carries the three current matrix states
- [x] Define tolerant version-1 and strict version-2 history schemas; v1 validates literal version 1 and the two retained cells, and v2 contains exactly `claudeMd` and `workflowVersion`
- [x] Delete the GitNexus install and Wiki compile clipboard builders when their last consumers are removed
- [x] Remove deleted schemas and helpers from the shared barrel
- [x] Confirm daemon and SPA typecheck against the reduced strict schemas

## 4. Preserve truthful history and conformance

- [x] Write a failing test proving new snapshots contain only `claudeMd` and `workflowVersion`
- [x] Update the snapshot writer to stop emitting GitNexus and Wiki fields
- [x] Write a failing test proving old snapshot records with GitNexus and Wiki fields remain readable
- [x] Write a failing test proving retained `not-applicable` values normalise to `missing`
- [x] Update per-repo drift readers and cache types to expose only `claudeMd` and `workflowVersion`
- [x] Make the daemon coverage and history routes emit strict schema version 2
- [x] Make the current SPA accept live coverage and history versions 1 and 2, normalising valid v1 payloads by dropping retired fields, preserving supplied Understand, presenting an absent Understand cell as unavailable, and mapping retained `not-applicable` to `missing`
- [x] Exclude the version-1 Understand-unavailable presentation from freshness aggregates and filters
- [x] Test current-SPA/old-daemon, current-SPA/current-daemon, and stale-SPA/current-daemon schema-drift behavior for both routes
- [x] Test that the current SPA tolerates and ignores an old daemon's extra `/health.gitnexus` key
- [x] Update live conformance scoring to count exactly `claudeMd` and `workflowVersion`
- [x] Remove the live scorer's obsolete `not-applicable` exclusion branch
- [x] Update the fleet snapshot reader to re-score every retained historical day over those same two fields
- [x] Test that a mixed pre/post-writer history has no measurement-set discontinuity at the deployment date
- [x] Capture before/after score and tier distributions for the retained window in `MEASUREMENT.md`, separating column removal from legacy-value normalisation
- [x] Capture before/after drift-indicator changes caused by legacy-value normalisation in `MEASUREMENT.md`
- [x] Preserve filename validation, retention, last-record-wins, malformed-line tolerance, and drifted-repo exclusion unchanged
- [x] Do not rewrite or delete retained NDJSON snapshots

## 5. Remove the SPA surface

- [x] Write a failing desktop test asserting the GitNexus and Wiki headers, cells, and actions are absent
- [x] Write a failing smallest-breakpoint test asserting the same integrations are absent from mobile rows
- [x] Delete `InstallGitNexusButton`, `ScanPill`, `RefreshAllStaleButton`, and `lib/queries/gitnexusScan.ts`
- [x] Strip both columns and all GitNexus/Wiki actions from `CoverageRow`, `CoverageFamilySection`, `CoverageFamilySectionMobile`, `CoverageEmptyState`, `CoveragePage`, and health queries
- [x] Remove GitNexus and Wiki tooltip and width definitions
- [x] Preserve the Understand viewer/copy action, construct its command SPA-side, and never round-trip it through the daemon
- [x] Preserve the review-override expander, filters, and every other remaining action
- [x] Remove the `not-applicable` filter chip and legend entry and define how stale URL filter values degrade
- [x] Update the shared column-width definition so remaining columns align across family sections
- [x] Preserve accessible touch targets for every remaining mobile control
- [x] Re-run the design critique on `/coverage`

## 6. Remove the vendored skill and update current truth

- [x] Delete `.claude/skills/gitnexus/` from this repo
- [x] Confirm nothing in the repository references the vendored skill
- [x] Update the `code-intelligence` Purpose to describe only Understand Anything and remove its scheduled-removal banner
- [x] Update the `fleet-coverage` Purpose to name the post-removal matrix and history fields
- [x] Update the `fleet-conformance` Purpose to describe the two-field score
- [x] Sweep authored `/help` content and remove GitNexus/Wiki column, scan, polling, install, and compile instructions
- [x] Sweep every other capability spec for `not-applicable`, GitNexus/Wiki coverage columns, and `/api/gitnexus/*`; confirm no stale product prose remains
- [x] Append a dated supersession note to `openspec/CAPABILITY-MAP.md`; do not rewrite its ratified table or decisions
- [x] Update the live capability summary in `CLAUDE.md` from GitNexus “deprecated” to removed
- [x] Do NOT remove the machine-level MCP server registration or uninstall GitNexus

## 7. Verify

- [x] `openspec validate --all` green
- [x] Targeted RED/GREEN tests recorded for schemas, skew, history, scoring, desktop, and mobile behavior
- [x] `pnpm lint` green; shared, agent, and SPA tests green
- [x] Coverage matrix renders correctly at desktop and smallest breakpoint
- [x] Independent Understand Anything viewer and routes pass unchanged
- [x] Repository search finds no non-dashboard consumer of the removed GitNexus API; document the breaking route removal
- [x] Fresh independent stage-3 code review approves the implementation
- [x] QA report and screenshots record the local live surface with neither removed column

## Completion evidence

- Section 1: `proposal.md`, `REVIEWS.md`, and
  `docs/decisions/0001-coverage-v2-history-compatibility.md`.
- Section 2: removed agent modules/routes in the working-tree diff; route,
  health, scan, shutdown, resolver, and full agent suites; live 404 checks in
  `QA.md`.
- Section 3: strict/current and tolerant/compatibility schemas in
  `packages/shared`; captured fixtures in `packages/shared/src/test-fixtures`;
  shared, agent, SPA, and root typecheck results in `VERIFICATION.md`.
- Section 4: snapshot writer/reader, history, compatibility, and conformance
  regression suites; retained-window results in `MEASUREMENT.md`; no retained
  NDJSON files were rewritten or deleted.
- Section 5: desktop, smallest-breakpoint, user-journey, touch-target, and
  viewer-link evidence in `QA.md`, `IMPECCABLE-AUDIT.md`, and `evidence/`.
- Section 6: repository search and current-truth updates in `CLAUDE.md`,
  `PRODUCT.md`, the three main specs, and `openspec/CAPABILITY-MAP.md`; the
  ignored repo-local GitNexus skill directories are absent, while machine-level
  registration remains untouched.
- Section 7: `VERIFICATION.md`, `QA.md`, `IMPECCABLE-AUDIT.md`, and `REVIEW.md`.
