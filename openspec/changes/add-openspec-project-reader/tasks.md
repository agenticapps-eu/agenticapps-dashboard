# Tasks

## 1. Allow-list (do first — everything else reads through it)

- [ ] Add `openspec` to `ALLOWED_SUBDIRS` in `packages/agent/src/lib/paths.ts` (TDD)
- [ ] Test: a read under `<root>/openspec/` resolves; `..` escape and symlink escape still rejected
- [ ] Confirm `docs/legacy-planning` remains OUT of the allow-list — explicitly rejected, do not add

## 2. Hybrid reader

- [ ] Tree reader: open changes = dirs under `openspec/changes/` excluding `archive/`
- [ ] Tree reader: task ratio = `- [x]` versus `- [ ]` count in each change's `tasks.md`
- [ ] Tree reader: capabilities = dirs under `openspec/specs/`, requirement count = `### Requirement:` occurrences
- [ ] Tree reader: archived changes from `openspec/changes/archive/`, ordered by date prefix
- [ ] CLI reader: use `openspec list --json` and `openspec list --specs --json` when the binary resolves
- [ ] Archive always read from the tree — the CLI does not expose it
- [ ] Test: CLI path and tree path produce identical values for the same fixture project
- [ ] Test: absent binary degrades to the tree path with no route error

## 3. Registry and discovery

- [ ] Status reports `openspec/` presence, open-change count, capability count (TDD)
- [ ] Remove phase number and phase status from the computed status shape
- [ ] `register --auto` accepts an `openspec/` marker
- [ ] Extend the shared registry schema; both ends validate

## 4. Retire the GSD reader

- [ ] Delete `findCurrentPhase()` and the `.planning/phases/` parsing in `projectOverview.ts`
- [ ] Delete phase-artifact reading in `phaseDetail.ts`
- [ ] Remove phase fields from the shared schemas
- [ ] Remove `.planning/config.json` from the discovery markers
- [ ] Confirm no daemon path reads `.planning/phases/` afterwards
- [ ] Leave `overrideSentinelScanner` alone unless it breaks — it reads a different `.planning` path for coverage

## 5. Surfaces

- [ ] Home card: open-change count plus per-change task ratios (the ratified card shape)
- [ ] Single-project centre column: Change Progress
- [ ] Single-project: new Capability panel — capabilities with requirement counts
- [ ] Empty states for "no openspec/" and "openspec/ but no specs yet"
- [ ] Run the design critique on both changed routes; composite floor ≥ 80 still applies

## 6. Verify

- [ ] Fixtures: OpenSpec-only, openspec-with-no-specs, GSD-only (expect blank), neither
- [ ] Verify this repo's own row renders correctly — it is the first migrated project
- [ ] Spot-check one other migrated repo and one GSD-only repo to confirm the accepted blank state looks deliberate, not broken
- [ ] `openspec validate --all` green; `pnpm lint` green; per-package tests green
- [ ] Security review of the allow-list change against `filesystem-access-policy`
- [ ] Two-stage review
