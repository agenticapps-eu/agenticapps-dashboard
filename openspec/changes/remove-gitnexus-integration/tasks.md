# Tasks

## 1. Conformance history first (do this before removing the column)

- [ ] Confirm daily snapshots carry every per-column state inline for the full retention window
- [ ] Make the fleet snapshot reader score each day over the *current* tracked column set, not the set recorded that day (TDD)
- [ ] Test: a 90-day window spanning the cutover renders no step
- [ ] Test: removing a predominantly non-green column raises historical scores uniformly, not just after the cutover
- [ ] Confirm stored snapshots are read-only in this path — never rewritten or pruned by the recompute

## 2. Remove the daemon surface

- [ ] Delete `packages/agent/src/lib/gitnexusScan.ts`, `gitnexusFamilyScan.ts`, `lib/scanners/gitNexusScanner.ts`
- [ ] Delete `packages/agent/src/routes/gitnexusScan.ts` and unregister the routes
- [ ] Delete the scan test suites and `test-fixtures/stub-gitnexus*.sh`
- [ ] Confirm no remaining daemon path spawns the indexer

## 3. Remove the shared schema

- [ ] Delete `packages/shared/src/schemas/gitnexusScan.ts` and its tests
- [ ] Remove the code-graph column from the coverage schema
- [ ] Remove it from the barrel export; confirm both ends still typecheck

## 4. Remove the SPA surface

- [ ] Delete `InstallGitNexusButton`, `ScanPill`, and `lib/queries/gitnexusScan.ts`
- [ ] Strip the column from `CoverageRow`, `CoverageFamilySection`, `CoverageFamilySectionMobile`, `coverageColumnTooltips`, `CoverageEmptyState`, `CoveragePage`, `RefreshAllStaleButton`, `healthQueries`
- [ ] Update the shared column-width definition so remaining columns still align across sections
- [ ] Re-run the design critique on `/coverage` — the layout changes and the composite floor still applies

## 5. Remove the vendored skill

- [ ] Delete `.claude/skills/gitnexus/` from this repo
- [ ] Confirm nothing references it (CLAUDE.md's block was already removed on main)

## 6. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; per-package tests green (expect a large deletion in the test count)
- [ ] Conformance page renders with the reduced column set and a continuous 90-day trend
- [ ] Coverage matrix renders correctly at both desktop and smallest breakpoint
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT remove the machine-level MCP server registration or uninstall the tool
