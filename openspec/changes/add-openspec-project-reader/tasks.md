# Tasks

## 1. Allow-list (do first — everything else reads through it)

- [x] Add `openspec` to `ALLOWED_SUBDIRS` in `packages/agent/src/lib/paths.ts` (TDD)
- [x] Test: a read under `<root>/openspec/` resolves; `..` escape and symlink escape still rejected
- [x] Confirm `docs/legacy-planning` remains OUT of the allow-list — explicitly rejected, do not add
- [x] Confirm `.planning` stays allow-listed and leave a code comment naming why: `skill-observations/` (override-sentinel scanner, commitment route) and `config.json`
- [x] ~~Enforce a maximum file size on `/read`~~ — **already implemented.** `MAX_READ_BYTES` (5 MiB) has capped the route since it was written, returning 413 `file_too_large`. The spec was silent, the code was not; the change documents it rather than adding a second cap
- [x] Test: an oversized file under each of the three allow-listed directories is refused, not truncated
- [x] Test: a file exactly at the cap still reads 200 (boundary asserted both ways)
- [x] ~~Test: the size is checked before the file is read into memory~~ — **verified by inspection, not testable in-process.** `read.ts` checks `st.size` from `fh.stat()` before `Buffer.allocUnsafe`, and re-checks after the bounded read to catch concurrent growth. Asserting the ordering would require instrumenting the allocator
- [ ] Declare the CLI timeout and CLI output cap as named constants alongside `MAX_READ_BYTES` and `GIT_SUBPROCESS_TIMEOUT_MS` (size cap already declared)
- [x] ~~Test: an unparseable configured value for any bound falls back to the default~~ — **vacuous as built.** None of the three bounds is configurable; they are module constants, so there is no parse path and no way to disable one. The requirement's intent (finite, cannot be turned off) holds by construction

## 2. OpenSpec CLI invocation discipline (security — before the reader uses it)

- [ ] Resolve the binary once at daemon start to an absolute path; verify it is a regular executable file (TDD)
- [ ] Test: resolution failure at start means no spawn and no `PATH` lookup on any later request
- [ ] Test: a directory, a broken symlink, and a non-executable file each count as resolution failure
- [ ] Invoke via argv with no shell; argument vector drawn from a fixed table of `list --json` and `list --specs --json` (TDD)
- [ ] Test: a project root containing a space, a quote, and a shell metacharacter reads correctly
- [ ] Test: no code path builds an `openspec` argument vector from a project-derived string
- [ ] Bound the invocation: wall-clock timeout, max captured output, own process group (TDD)
- [ ] Test: a hung binary is killed by process group and the read falls back to the tree
- [ ] Test: non-zero exit, oversized output, unparseable JSON, and unrecognised JSON shape each fall back to the tree with no route error
- [ ] Test: a spawn failure (binary deleted or de-executabled after start) falls back to the tree with no route error
- [ ] Shape recognition is a required-subset check that ignores unknown fields (TDD)
- [ ] Test: JSON with extra unknown fields is recognised; JSON missing a consumed field falls back
- [ ] Pin the verified CLI surface in a code comment: `openspec` 1.6.0, `list --json` / `list --specs --json`

## 3. Hybrid reader

- [ ] Tree reader: open changes = non-dot dirs under `openspec/changes/` excluding `archive/`, with no artifact required
- [ ] Test: a change dir holding only `tasks.md`, and one holding only `proposal.md`, are both listed
- [ ] The change set is enumerated from the tree on both paths; the CLI supplies counts, never the set (TDD)
- [ ] Test: a change the CLI does not report is still listed when the binary is available
- [ ] Tree reader: task ratio = `- [x]` versus `- [ ]` count in each change's `tasks.md`
- [ ] Tree reader: report task-artifact presence as its own value, distinct from a zero count (TDD)
- [ ] Tree reader: capabilities = dirs under `openspec/specs/`, requirement count = `### Requirement:` occurrences
- [ ] Tree reader: affected capabilities = dir names under a change's own `specs/`; empty when absent
- [ ] Tree reader: archived changes from `openspec/changes/archive/`, sorted by zero-padded ISO `YYYY-MM-DD-` prefix
- [ ] Test: an archive dir not matching the ISO prefix sorts after all matching ones, no chronological claim
- [ ] CLI reader: use `openspec list --json` and `openspec list --specs --json` when the binary resolves
- [ ] Archive, affected capabilities, and task-artifact presence always read from the tree on both paths — the CLI reports none of them
- [ ] Test: CLI path and tree path produce identical values for the whole pinned five-field set on one conformant fixture
- [ ] Test: a non-conformant change (task artifact the tree reader cannot locate) prefers the CLI and is not a parity failure
- [ ] Test: absent binary degrades to the tree path with no route error

## 4. Registry and discovery

- [ ] Status reports the three conditions `migrated` / `needs-migration` / `no-workflow` (TDD)
- [ ] Reachability takes precedence: an unreachable root reports `unreachable`, never `no-workflow` (TDD)
- [ ] Test: workflow skill present + no `openspec/` reports `needs-migration`, not `no-workflow`
- [ ] Test: a project with both `.planning/` and `openspec/` reports `migrated` and reads nothing from `.planning/phases/`
- [ ] Status reports open-change and capability counts; remove phase number and phase status from the computed shape
- [ ] `register --auto` markers become exactly `openspec/` and the workflow-skill `SKILL.md`
- [ ] Remove `.planning/config.json` from the discovery markers (TDD)
- [ ] Test: a GSD-only project is not offered by `--auto`, and an already-registered one stays in the registry
- [ ] Extend the shared registry schema; both ends validate

## 5. Retire the GSD reader

- [ ] Delete `findCurrentPhase()` and the `.planning/phases/` parsing in `projectOverview.ts`
- [ ] Delete phase-artifact reading in `phaseDetail.ts`
- [ ] Remove phase fields from the shared schemas
- [ ] Remove `.planning/config.json` from the discovery markers in `discover.ts` / `registry.ts`
- [ ] Confirm no daemon path reads `.planning/phases/` afterwards
- [ ] Leave `overrideSentinelScanner` and `routes/commitment.ts` alone — they read `.planning/skill-observations/`, a different path

## 6. Surfaces

- [ ] Home card: open-change count plus per-change task ratios (the ratified card shape)
- [ ] Home card: remove review finding counts — the field's source is deleted with the phase reader
- [ ] Home card: render a migration hint for `needs-migration`, an install hint only for `no-workflow`
- [ ] Single-project centre column: Change Progress, with affected capabilities per change
- [ ] Single-project view for a `needs-migration` project: informational migration state, header context still renders
- [ ] A change with no task artifact is still listed, with a no-task-list state in place of its ratio
- [ ] Single-project: new Capability panel — capabilities with requirement counts
- [ ] Empty states: no `openspec/`; `openspec/` with no specs; `openspec/` with no open changes; a change with no spec delta
- [ ] Run the design critique on both changed routes; composite floor ≥ 80 still applies

## 7. Verify

- [ ] Fixtures: OpenSpec-only, openspec-with-no-specs, openspec-with-no-changes, both-trees (mid-migration), GSD-only (expect blank), neither
- [ ] Shared-schema package covered by tests for the new wire shape — `Schema Validation At Both Ends` already binds it, so no spec delta, but the test must exist
- [ ] Verify this repo's own row renders correctly — it is the first migrated project
- [ ] Spot-check one other migrated repo and one GSD-only repo to confirm the accepted blank state looks deliberate, not broken
- [ ] `openspec validate --all` green; `pnpm lint` green; per-package tests green
- [ ] Security review of the allow-list change AND the CLI invocation discipline against `filesystem-access-policy`
- [ ] Two-stage review
