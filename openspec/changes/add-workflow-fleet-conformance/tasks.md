# Tasks

Independent of the readiness work — different files, different repos scanned.
Can run early. Task block 4 is the security-sensitive one and gates on its own
review.

## 1. Scanner: spec versions and skill drift · AGE-467

- [ ] Read core section frontmatter, report the **maximum** (TDD)
- [ ] Test: differing section versions yield the maximum, not the first and not a mean
- [ ] Test: an unreleased changelog block that changes no section version moves nothing
- [ ] Read `implements_spec` from every skill of every host, including the extra locations one host uses
- [ ] Report primary, minimum, maximum, and the laggard skills by name and version
- [ ] Test: a host whose primary matches but whose other skills trail is reported as drifting
- [ ] Test: a drift-free host has equal minimum and maximum

## 2. Scanner: shared artefacts and byte identity · AGE-467

- [ ] Read the version markers from the change gate and the reviewer CLI (TDD)
- [ ] Hash each host copy against the core reference implementation
- [ ] Hash the conformance harnesses too
- [ ] Test: matching version marker + differing bytes reports **not identical**
- [ ] Test: the current fleet state (all four hosts identical) reports green — if it does not, the scanner is wrong, not the fleet
- [ ] Detect and report absent vendor provenance, independently of byte identity
- [ ] Read the machine-wide install location, report separately; state absence plainly
- [ ] Highest migration per host, labelled as offered rather than applied

## 3. Workflow endpoint

- [ ] `GET /api/v2/workflow` returning the matrix (TDD)
- [ ] Settled composition — a missing workflow repo is stated, not fatal
- [ ] Response through the existing outbound schema-validation wrapper
- [ ] Test: registered product repos never appear in the response

## 4. Harness runner — **security-gated** · AGE-469

- [ ] `POST /api/v2/workflow/harness` accepting a host and a harness identifier (TDD)
- [ ] Identifiers select from a **fixed internal command table**; no request value reaches an argv entry, cwd, or env var
- [ ] Root list is a fixed daemon-side constant; no request can extend it
- [ ] Canonicalise the script path, resolve symlinks, and **re-verify at spawn time** (TOCTOU)
- [ ] Spawn in its own process group, with a scratch cwd under the daemon's own directory
- [ ] Bounds on CPU time, memory, and captured output; bounded concurrency (one run per host, capped overall)
- [ ] Timeout and bound violations terminate the **whole process group**, not just the child
- [ ] Truncate captured output and strip absolute paths before storing or returning it
- [ ] Test: a path outside the known roots is refused and no process starts
- [ ] Test: a symlink inside a root pointing outside it is refused on the canonical path
- [ ] Test: an unknown host or harness identifier is refused
- [ ] Test: a harness that spawns children and then hangs leaves **no surviving descendant**
- [ ] Test: rendering, refreshing, and polling the surface start no process
- [ ] Test: stored and returned output contains no home-directory path
- [ ] Persist results with timestamp under the daemon's own directory, at the existing mode discipline
- [ ] Cache key covers **both** the tested artefact and the harness script
- [ ] Test: re-vendoring the artefact discards the result; re-vendoring the harness alone also discards it; an unchanged pair keeps it with a larger age
- [ ] Test: a completed non-passing run is cached; a timed-out or bounded-out run is not
- [ ] **Run `/cso` on this block and commit `SECURITY.md`** — the daemon runs foreign code here

## 5. Workflow surface · AGE-468

- [ ] Route `/workflow` (TDD)
- [ ] Block 1: core version, per-host primary, range, migration position; expandable laggard list
- [ ] Block 2: shared artefacts, byte identity, vendor provenance row, machine-wide row
- [ ] Block 3: per-host harness trigger, result with age, explicit no-current-result state
- [ ] Quiet when green — instrument panel, not scoreboard
- [ ] Test: the surface renders the two findings of the 2026-07-26 measurement without anyone filtering for them

## 6. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; per-package tests green
- [ ] Confirm by grep that no requirement or schema hardcodes a measured version number
- [ ] Design critique on `/workflow` at 1440×900, artifact committed
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT fix the laggard skills or add vendor headers — those live upstream (AGE-477, AGE-478)
- [ ] Do NOT add a migration ledger
- [ ] Do NOT write to any workflow repository
- [ ] Do NOT add a third spawning route
