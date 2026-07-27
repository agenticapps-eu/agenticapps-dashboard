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
- [x] Declare the CLI timeout and CLI output cap as named constants alongside `MAX_READ_BYTES` and `GIT_SUBPROCESS_TIMEOUT_MS` (size cap already declared)
- [x] ~~Test: an unparseable configured value for any bound falls back to the default~~ — **vacuous as built.** None of the three bounds is configurable; they are module constants, so there is no parse path and no way to disable one. The requirement's intent (finite, cannot be turned off) holds by construction

## 2. OpenSpec CLI invocation discipline (security — before the reader uses it)

- [x] `resolveOpenspecBinary()` resolves to an absolute regular executable, or null (TDD). **Wiring it into daemon start lands with the reader in group 3** — the resolver has no consumer until then
- [x] Test: a null binary reports `unavailable` with no spawn; resolution is a pure function called once by the caller, not per request
- [x] Test: a directory, a broken symlink, a non-executable file, and an empty PATH each resolve to null
- [x] Invoke via argv with no shell; argument vector drawn from a fixed table of `list --json` and `list --specs --json` (TDD)
- [x] Test: a project root named `a b'c $HOME; rm -rf . & d` reads correctly
- [x] Test: argv is recorded from the child and asserted equal to the fixed table; the vector is a module constant with no interpolation
- [x] Bound the invocation: wall-clock timeout, max captured output, own process group (TDD)
- [x] Test: a hung binary is killed by process group and falls back — `sleep 30` settles in ~300ms rather than hanging
- [x] Test: non-zero exit, oversized output, unparseable JSON, and unrecognised JSON shape each fall back with no route error
- [x] Test: a spawn failure (binary deleted after resolution) falls back — `reject:false` resolves with a null exit code, which is not an exit status
- [x] Shape recognition is a required-subset check that ignores unknown fields (TDD)
- [x] Test: JSON with extra unknown fields is recognised; JSON missing a consumed field falls back
- [x] Pin the verified CLI surface in a code comment: `openspec` 1.6.0, `list --json` / `list --specs --json`

## 3. Hybrid reader

- [x] Tree reader: open changes = non-dot dirs under `openspec/changes/` excluding `archive/`, with no artifact required
- [x] Test: a change dir holding only `tasks.md`, and one holding only `proposal.md`, are both listed
- [x] The change set is enumerated from the tree on both paths; the CLI supplies counts, never the set (TDD)
- [x] Test: a change the CLI does not report is still listed when the binary is available
- [x] Tree reader: task ratio = `- [x]` versus `- [ ]` count in each change's `tasks.md`
- [x] Tree reader: report task-artifact presence as its own value, distinct from a zero count (TDD)
- [x] Tree reader: capabilities = dirs under `openspec/specs/`, requirement count = `### Requirement:` occurrences
- [x] Tree reader: affected capabilities = dir names under a change's own `specs/`; empty when absent
- [x] Tree reader: archived changes from `openspec/changes/archive/`, sorted by zero-padded ISO `YYYY-MM-DD-` prefix
- [x] Test: an archive dir not matching the ISO prefix sorts after all matching ones, no chronological claim
- [x] CLI reader: use `openspec list --json` and `openspec list --specs --json` when the binary resolves
- [x] Archive, affected capabilities, and task-artifact presence always read from the tree on both paths — the CLI reports none of them
- [x] Test: CLI path and tree path produce identical values for the whole pinned five-field set on one conformant fixture
- [x] Test: a non-conformant change (task artifact the tree reader cannot locate) prefers the CLI and is not a parity failure
- [x] Test: absent binary degrades to the tree path with no route error
- [x] Verified against this repo, not only fixtures: 12 capabilities summing to 100 requirements, 21 archived entries with zero non-ISO names, tree and CLI agreeing on all 9 open changes

## 4. Registry and discovery

- [x] Status reports the three conditions `migrated` / `needs-migration` / `no-workflow` (TDD)
- [x] Reachability takes precedence: an unreachable root reports `unreachable`, never `no-workflow` (TDD)
- [x] Test: workflow skill present + no `openspec/` reports `needs-migration`, not `no-workflow`
- [x] Test: a project with both `.planning/` and `openspec/` reports `migrated` and reads nothing from `.planning/phases/`
- [x] Status reports open-change and capability counts; remove phase number and phase status from the computed shape
- [x] `register --auto` markers become exactly `openspec/` and the workflow-skill `SKILL.md`
- [x] Remove `.planning/config.json` from the discovery markers (TDD)
- [x] Test: a GSD-only project is not offered by `--auto`, and an already-registered one stays in the registry
- [x] Extend the shared registry schema; both ends validate

## 5. Retire the GSD reader

- [x] Delete ~~`findCurrentPhase()`~~ `findLatestPhaseDir()` and the `.planning/phases/` parsing in `projectOverview.ts` — also `parseReviewFile`, `parseVerification`, and the phase-status heuristic. `readOverview` keeps only `tdd` / `branch` / `markers`
- [x] Delete phase-artifact reading in `phaseDetail.ts` — the five parsers go, the three `.planning/skill-observations/` readers stay
- [x] Remove phase fields from the shared schemas — `ProjectOverviewSchema` drops five fields and becomes `.strict()`; `phaseDetail.ts` and `security.ts` are deleted outright
- [x] ~~Remove `.planning/config.json` from the discovery markers in `discover.ts` / `registry.ts`~~ — **done in group 4**, where the marker set was already narrowed to `openspec/` plus the workflow skill. Duplicated here in error
- [x] **Also deleted, not on the original list: `routes/phaseProgress.ts` and `routes/security.ts`.** Both read the phase dir via `findLatestPhaseDir`, and both served the `Phase Progress Column` requirement this change REMOVES. Their SPA consumers — the five centre-column panels, `usePhaseProgress`, `useSecurity` — go with them
- [x] ~~Confirm no daemon path reads `.planning/phases/` afterwards~~ — **restated, because as written it contradicts the task below it.** `overrideSentinelScanner.ts` does read `.planning/phases/<slug>/multi-ai-review-skipped`. The enforceable invariant is that *exactly one sanctioned reader remains*, asserted by name in `gsdReaderRetired.test.ts`, so a new one cannot appear silently
- [x] Leave `overrideSentinelScanner` and `routes/commitment.ts` alone — ~~they read `.planning/skill-observations/`, a different path~~ **only `routes/commitment.ts` does.** `overrideSentinelScanner` reads `.planning/phases/`; it survives because it serves `fleet-coverage`'s `Review-Override Visibility`, which `retire-v1-surfaces` removes. Retiring it here would be foreign scope

## 6. Surfaces

- [x] Home card: open-change count plus per-change task ratios (the ratified card shape)
- [x] Home card: remove review finding counts — the field's source is deleted with the phase reader
- [x] Home card: render a migration hint for `needs-migration`, an install hint only for `no-workflow`
- [x] Single-project centre column: Change Progress, with affected capabilities per change — served by a new `GET /api/projects/:id/openspec` route; the registry list keeps its summary rather than carrying detail on every home card
- [x] Single-project view for a `needs-migration` project: informational migration state, header context still renders. The notice keeps the panel titled "Change Progress" so the column's slot identity stays stable, and the two OpenSpec panels do not mount at all rather than mounting into permanent empty states
- [x] A change with no task artifact is still listed, with a no-task-list state in place of its ratio
- [x] Single-project: new Capability panel — capabilities with requirement counts. Renders nothing when the tree is absent: Change Progress says "Not on OpenSpec" directly above it
- [x] Empty states: no `openspec/`; `openspec/` with no specs; `openspec/` with no open changes; a change with no spec delta
- [x] Run the design critique on both changed routes; composite floor ≥ 80 still applies — **`IMPECCABLE.md`, composite 56 → 92**. Gate was `impeccable:critique` not `/design-shotgun` (design contract already in place), user-approved. It caught a P0 that defeated this change's own data contract: the progress track was painted at 1.05:1 and invisible, so a 0% fill rendered identically to no bar

## 7. Verify

- [x] Fixtures: OpenSpec-only, openspec-with-no-specs, openspec-with-no-changes, both-trees (mid-migration), GSD-only (expect blank), neither — the condition matrix lives in `projectCondition.test.ts`, the tree shapes in `openspecReader.test.ts`; the openspec-with-no-specs shape was the one gap and is now covered
- [x] Shared-schema package covered by tests for the new wire shape — `schemas/openspec.test.ts`; `OpenspecChangeDetailSchema` extends the card's `OpenChangeSummarySchema` rather than redeclaring it
- [x] Verify this repo's own row renders correctly — it is the first migrated project. 9 open changes, 12 capabilities, 21 archived all date-prefixed; matches `openspec list` exactly
- [x] Spot-check one other migrated repo and one GSD-only repo — `fx-signal-agent` (10 changes / 12 caps / 10 archived) and `cparx` (`present:false` → the migration notice, header and neighbouring columns still rendering)
- [x] `openspec validate --all` green (21/21); `pnpm lint` green (0 errors, 231 pre-existing warnings); shared 382 · agent 1237 (+1 skipped) · spa 1260; `pnpm -r typecheck` 0 errors
- [x] Security review of the allow-list change AND the CLI invocation discipline against `filesystem-access-policy` — **`SECURITY.md`**. One HIGH, fixed: both call sites resolved the `openspec` binary by walking `PATH` **on the request path**, which the spec forbids twice; a planted binary would have been picked up within one 5s poll with no restart. Now a resolve-once accessor, RED tests first
- [x] Two-stage review — **`REVIEW.md`**. Stage 1 (gstack `/review`: two specialists + adversarial pass) and Stage 2 (independent context) did not collapse. 39 Stage-1 findings; Stage 2 returned **REQUEST-CHANGES** on two blocking items, both closed: the archive clause was implemented at the wire and rendered nowhere, and the `needs-migration` scenario asserted branch/last-commit context the view never rendered. The review also caught a spec delta stating three false facts about which readers touch `.planning`, one archive away from becoming durable truth. No fresh Stage-2 pass was obtained against the fixed tree
