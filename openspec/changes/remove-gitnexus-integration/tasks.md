# Tasks

## 1. Remove the daemon surface

- [ ] Delete `packages/agent/src/lib/gitnexusScan.ts`, `gitnexusFamilyScan.ts`, `lib/scanners/gitNexusScanner.ts`
- [ ] Delete `packages/agent/src/routes/gitnexusScan.ts` and unregister the routes
- [ ] Delete the scan test suites and `test-fixtures/stub-gitnexus*.sh`
- [ ] Confirm no remaining daemon path spawns the indexer

## 2. Remove the shared schema

- [ ] Delete `packages/shared/src/schemas/gitnexusScan.ts` and its tests
- [ ] Remove the code-graph column from the coverage schema
- [ ] Remove it from the barrel export; confirm both ends still typecheck

## 3. Remove the SPA surface

- [ ] Delete `InstallGitNexusButton`, `ScanPill`, and `lib/queries/gitnexusScan.ts`
- [ ] Strip the column from `CoverageRow`, `CoverageFamilySection`, `CoverageFamilySectionMobile`, `coverageColumnTooltips`, `CoverageEmptyState`, `CoveragePage`, `RefreshAllStaleButton`, `healthQueries`
- [ ] Update the shared column-width definition so remaining columns still align across sections
- [ ] Re-run the design critique on `/coverage` — the layout changes and the composite floor still applies

## 4. Remove the vendored skill

- [ ] Delete `.claude/skills/gitnexus/` from this repo
- [ ] Confirm nothing references it (CLAUDE.md's block was already removed on main)

## 5. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; per-package tests green (expect a large deletion in the test count)
- [ ] Conformance page renders with the reduced column set
- [ ] Coverage matrix renders correctly at both desktop and smallest breakpoint

> The 90-day trend is deliberately **not** checked for continuity here. See the
> descope note in `proposal.md`: the chart is withdrawn by `retire-v1-surfaces`,
> so the recomputation that would have kept it continuous has no consumer.
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT remove the machine-level MCP server registration or uninstall the tool
