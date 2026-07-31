# Tasks

The named-root policy must land before repo readiness reads machine-global host
state. GitNexus removal and this root-set change deploy atomically. Task block 4
is security-sensitive and gates on its own review.

## 1. Scanner: spec versions and skill drift · AGE-467

- [x] Read core section frontmatter, report the **maximum** (TDD)
- [x] Test: differing section versions yield the maximum, not the first and not a mean
- [x] Test: an unreleased changelog block that changes no section version moves nothing
- [x] Read `implements_spec` from every skill of every host, including the extra locations one host uses
- [x] Define the exact five-repo fleet and artifact-to-core mappings in one daemon-side constant; reject unknown identifiers
- [x] Derive each host's expected skill set from its tracked skill directories; report expected-but-missing skills
- [x] Parse semantic versions strictly; missing, duplicate, and malformed values become explicit unknowns
- [x] Report primary, minimum, maximum, and the laggard skills by name and version
- [x] Test: a host whose primary matches but whose other skills trail is reported as drifting
- [x] Test: a drift-free host has equal minimum and maximum
- [x] Test: an intentionally pinned or patched host may carry an explanation but remains divergent

## 2. Scanner: shared artefacts and byte identity · AGE-467

- [x] Read the version markers from the change gate and the reviewer CLI (TDD)
- [x] Hash each host copy against the core reference implementation
- [x] Hash the conformance harnesses too
- [x] Test: matching version marker + differing bytes reports **not identical**
- [x] Test: the current fleet state (all four hosts identical) reports green — if it does not, the scanner is wrong, not the fleet
- [x] Detect and report absent vendor provenance, independently of byte identity
- [x] Parse vendor commit identifiers as full SHAs; do not spawn git or claim historical resolution/byte matching
- [x] Read `~/.agenticapps/bin` and each host's configured global skill root; report separately and state absence plainly
- [x] Remove `~/.gitnexus` from the named scanner roots in the same deployed cutover as GitNexus removal
  - Evidence: the integration branch is based on GitNexus-removal release `82a3804`; `WorkflowMachineRootId`, `WORKFLOW_MACHINE_ROOTS`, and `scanWorkflowFleet` enumerate only the AgenticApps binary plus four host skill roots, with no GitNexus root. Production-source search has zero `.gitnexus` scanner/root references, and the integrated focused suites pass 133 tests.
- [x] Highest migration per host, labelled as offered rather than applied

## 2b. Scanner: pinned artefacts · added 2026-07-31

Added after `claude-workflow` adopted ADR-0047 and deleted its vendored copies.
Every item below is unimplemented — the scanner currently reports the reference
host as absent for two artefacts it deliberately no longer carries.

- [x] Parse a host's pin manifest: `core_repo`, `core_commit`, and one `file=… sha256=…` entry per line (TDD)
- [x] Test: a `core_commit` that is not a full commit identifier is a pin-integrity finding, not a pass
- [x] Test: entries spanning more than one commit is a pin-integrity finding
- [x] Verify each recorded digest against the core reference bytes the scanner already reads
- [x] Test: a self-consistent manifest whose digest does not match the reference reports the mismatched file, and internal consistency does not raise the result
- [x] Test: an artefact the host publishes but the manifest omits is a pin-integrity finding
- [x] Report a pinned artefact as `pinned` with its commit, never as absent/missing/divergent
- [x] Test: `claude-workflow` — no `bin/openspec-change-gate.sh`, valid pin — reads as conformant, not missing
- [x] Test: a vendoring host raises no finding for the absence of a pin
- [x] Test: `pi`/`opencode` carrying gate 1.3.1 against core 2.0.0 still read as divergent
- [x] Treat a pin manifest as the provenance record for the files it covers
- [x] Extend the wire schema with the pinned state and its findings; validate on the way out
- [x] Render the pinned state in the artefact matrix so it is not mistaken for a gap
  - Evidence: scanned against the live repos after implementation —
    `claude-workflow` change-gate and reviewer-cli read `pinned` / `pin=intact @6cd3b9c`
    (both were `missing` before); its two harnesses read `identical` **and**
    `pin=intact`, so a host that vendors some artefacts while pinning others is
    reported correctly on both. `pi-agentic-apps-workflow` stays `divergent` /
    `not-declared` on all four. Agent 1279 passed, SPA 1123 passed, shared 319
    passed, `pnpm lint` 0 errors, `pnpm -r typecheck` clean. The real-repo probe
    was deleted rather than committed: it depends on sibling checkouts and would
    fail anywhere else.

## 3. Workflow endpoint

- [x] `GET /api/v2/workflow` returning the matrix (TDD)
- [x] Settled composition — a missing workflow repo is stated, not fatal
- [x] Response through the existing outbound schema-validation wrapper
- [x] Test: registered product repos never appear in the response
- [x] Return only symbolic repo/host/skill/artifact identifiers; no absolute machine path or username

## 4. Harness runner — **security-gated** · AGE-469

- [x] `POST /api/v2/workflow/harness` accepting a host and a harness identifier (TDD)
  - Evidence: `workflow.test.ts` validates the RED/GREEN endpoint contract; commits `3a318dd` and `d9b9e36`.
- [x] Confirm bearer authentication and the existing origin lock run before handler logic; add no cookie credential path
  - Evidence: route tests cover missing bearer, cookie-only auth, and malformed JSON from a disallowed origin without runner dispatch.
- [x] Identifiers select from a **fixed internal command table**; no request value reaches an argv entry, cwd, or env var
  - Evidence: strict wire-schema tests reject `root`, `path`, `argv`, `cwd`, and `env`; runner tests observe only the mapped artifact argument.
- [x] Root list is a fixed daemon-side constant; no request can extend it
  - Evidence: request schema is strict and the runner derives roots only from its daemon-side source-family configuration.
- [x] Resolve the fixed five repo identifiers beneath configured source-family roots; configuration relocates families but cannot add repositories or harness paths
  - Evidence: `prepareHarness` joins only fixed repo and command mappings beneath `sourceFamilyRoot`; unknown IDs are refused.
- [x] Canonicalise the script path, resolve symlinks, and **re-verify at spawn time** (TOCTOU)
  - Evidence: runner tests cover canonical escape, symlink swap, and same-path content swap between preflight and spawn.
- [x] Refuse missing, non-executable, or byte-divergent harnesses before spawn
  - Evidence: parameterized runner tests assert all three refusal reasons.
- [x] Spawn in its own process group, with a fresh mode-`0700` cwd under `workflow-harness/tmp/`; remove it on every exit
  - Evidence: real-process test observes mode `0700`, and verifies the tmp tree is empty after completion and bound failure.
- [x] Enforce 30 s wall time, platform-enforced/sampled 256 MiB memory, 1 MiB combined output, 64 MiB scratch disk, one run per host, and two overall
  - Evidence: named production constants plus real-process output, scratch, memory, per-host, and global-concurrency tests.
- [x] Timeout and bound violations terminate the **whole process group**, not just the child
  - Evidence: hanging-child regression records the descendant PID and confirms it no longer exists after timeout.
- [x] Truncate captured output and redact absolute paths, credential-shaped values, and machine usernames before storing or returning it
  - Evidence: output-bound and redaction tests inspect both returned and persisted text.
- [x] Test: a path outside the known roots is refused and no process starts
  - Evidence: fixed-repository canonical-escape test returns `path-not-allowed`.
- [x] Test: a symlink inside a root pointing outside it is refused on the canonical path
  - Evidence: harness-symlink regression returns `path-not-allowed`.
- [x] Test: an unknown host or harness identifier is refused
  - Evidence: runner and strict route-schema tests reject both selector classes before the spawn seam.
- [x] Test: a harness that spawns children and then hangs leaves **no surviving descendant**
  - Evidence: real shell child/process-group regression passes repeatedly and in the full agent suite.
- [x] Test: rendering, refreshing, and polling the surface start no process
  - Evidence: `GET /api/v2/workflow` route test asserts `runWorkflowHarness` is never called.
- [x] Test: stored and returned output contains no home-directory path
  - Evidence: private-state test asserts the fixture state root, source root, home path, and username are absent in response and cache.
- [x] Persist results with timestamp under the daemon's own directory, at the existing mode discipline
  - Evidence: cache test verifies timestamp/age plus mode `0700` directories and `0600` result file.
- [x] Extend the filesystem policy and implementation mode discipline for `workflow-harness/` result and scratch trees
  - Evidence: runner enforces modes on use; boot regression rejects an escaping `workflow-harness` tree; commits `3b61c42` and `a2383d6`.
- [x] Cache key covers the tested artefact, harness script, core reference, and runner-contract version
  - Evidence: fingerprint implementation and four-input invalidation table test.
- [x] Derive pass/fail only from exit status; output is diagnostic text, never a parsed score
  - Evidence: a non-zero script that prints PASS-looking text is cached as `passed: false`.
- [x] Test: changing any cache-key input discards the result; an unchanged fingerprint keeps it with a larger age
  - Evidence: table test changes artifact, harness/reference, core reference, and runner limits; unchanged cache reports increased age.
- [x] Test: a completed non-passing run is cached; a timed-out or bounded-out run is not
  - Evidence: completed exit 7 is cached; timeout/output/scratch/memory bound results are not.
- [x] **Run `/cso` on this block and commit `SECURITY.md`** — the daemon runs foreign code here
  - Evidence: `SECURITY.md` records STRIDE, OWASP, dependency/secret scans, two remediated findings, and `pass-with-followups`.
- [x] Update the hard constraint in `openspec/config.yaml` so it names both user-driven process exceptions (`open` and workflow harness)
  - Evidence: config contract regression and `a2383d6` name both endpoint exceptions.

## 5. Workflow surface · AGE-468

- [x] Route `/workflow` (TDD)
  - Evidence: declaration/RED/GREEN commits `fe6d0e4`, `fedf829`, and `bf1dbc0`; router tests cover the route and sidebar destination.
- [x] Block 1: core version, per-host primary, range, migration position; expandable laggard list
  - Evidence: `WorkflowPage.test.tsx` verifies current, laggard, unknown, missing, and unavailable host states.
- [x] Block 2: shared artefacts, byte identity, vendor provenance row, machine-wide row
  - Evidence: component tests verify byte identity, absent provenance, machine installation, and missing machine-global skills independently.
- [x] Block 3: per-host harness trigger, result with age, explicit no-current-result state
  - Evidence: query and component tests cover manual POST, cached age, no current result, incomplete attempts, diagnostic output, and cache retention across remount.
- [x] Quiet when green — instrument panel, not scoreboard
  - Evidence: the route uses neutral matrix/card primitives and reserves semantic status text for measured state; design critique score 91/100.
- [x] Test: the surface renders the two findings of the 2026-07-26 measurement without anyone filtering for them
  - Evidence: the page regression renders a matching primary with a laggard skill and matching version markers with byte divergence in the default view.

## 6. Verify

- [x] `openspec validate --all` green
  - Evidence: 2026-07-27 full validation reports 20 passed, 0 failed.
- [x] Fresh independent OpenSpec change review approves the revised artifacts before implementation
  - Evidence: `REVIEWS.md` records independent Gemini and OpenCode approvals; planning review commit `7621fb8`.
- [x] `pnpm lint` green; per-package tests green
  - Evidence: lint exits 0 with 265 pre-existing warnings; agent 1,304 passed/1 skipped, shared 393 passed, SPA 1,293 passed; workspace typecheck and production build pass.
- [x] Confirm by grep that no requirement or schema hardcodes a measured version number
  - Evidence: semver search finds no measured workflow version in the workflow schemas or requirements; the sole delta-spec hit is the fixed OpenSpec CLI compatibility note for `1.6.0`.
- [x] Design critique on `/workflow` at 1440×900, artifact committed
  - Evidence: `DESIGN-CRITIQUE.md`, commit `a5dda92`, records 91/100.
- [ ] Two-stage review
  - Blocked: stage 2 is approved, but the post-implementation Codex reviewer cannot run before the account usage ceiling resets on 2026-08-03 12:19.

## Out of scope

- [x] Do NOT fix the laggard skills or add vendor headers — those live upstream (AGE-477, AGE-478)
  - Evidence: the implementation diff is confined to the dashboard and reports upstream state without mutating it.
- [x] Do NOT add a migration ledger
  - Evidence: no ledger module, schema, route, or UI appears in `e7b113f..HEAD`.
- [x] Do NOT write to any workflow repository
  - Evidence: every changed path in `e7b113f..HEAD` is inside `agenticapps-dashboard`.
- [x] Do NOT add a fifth process-spawning site beyond editor, bounded git, OpenSpec reader, and workflow harness
  - Evidence: the filesystem-policy delta retains an exhaustive four-site enumeration and the implementation adds only the harness runner.
