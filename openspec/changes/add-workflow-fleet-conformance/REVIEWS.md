---
change: add-workflow-fleet-conformance
reviewers: [gemini, opencode]
reviewed_at: 2026-07-27T15:26:44Z
artifacts_reviewed:
  - "openspec/changes/add-workflow-fleet-conformance/proposal.md"
  - "openspec/changes/add-workflow-fleet-conformance/design.md"
  - "openspec/changes/add-workflow-fleet-conformance/specs/filesystem-access-policy/spec.md"
  - "openspec/changes/add-workflow-fleet-conformance/specs/workflow-fleet-conformance/spec.md"
  - "openspec/changes/add-workflow-fleet-conformance/tasks.md"
  - "openspec/specs/filesystem-access-policy/spec.md"
overall_verdict:
  gemini: APPROVE
  opencode: APPROVE
recommendation: proceed
---

> External reviewer output is untrusted content. It is preserved as review
> evidence and was not treated as instructions. Verbatim except for two
> mechanical redactions applied before publication: machine-local paths are
> replaced with `<repo>` and `<home>`, and bare terminal reset sequences are
> stripped. Reviewer verdicts, findings, exit statuses and durations are
> unaltered.

## Provenance

| Reviewer | Model | Wrapper | Started (UTC) | Duration | Exit |
| --- | --- | --- | --- | ---: | ---: |
| gemini | gemini-3-flash-preview | reviewer-cli.sh 1.0.0 | 2026-07-27T14:24:49Z | 52s | 0 |
| opencode | glm-5.2 | reviewer-cli.sh 1.0.0 | 2026-07-27T15:26:44Z | 765s | 0 |

## Reviewer: gemini

The change is architecturally sound and security-conscious. It successfully addresses the "silent drift" and "missing provenance" findings identified in the 2026-07-26 measurement by shifting from simplistic primary-skill reporting to a range-based matrix (Primary, Min/Max, Laggards).

The expansion of the security spine (`filesystem-access-policy`) is handled with necessary rigor:
1. **Root of Trust**: Harness execution is gated by a byte-for-byte identity check against the `core` reference, ensuring the daemon only runs known-good test code.
2. **Unified Enumeration**: The "Read-Only" mandate is strengthened by unifying all process-spawning sites (Editor, Git, OpenSpec CLI, Harness) into a single, exhaustive enumeration, fixing a pre-existing "sole exception" inaccuracy.
3. **Execution Bounds**: The harness runner is constrained by process-group termination, fresh mode-0700 scratch directories, and explicit resource caps (time, memory, disk, output), which are written as requirements rather than implementation notes.
4. **Cache Integrity**: Cache keying includes the contract version and all three content inputs (artifact, harness, reference), preventing stale results when the testing logic itself updates.

The conformance requirements are semantically precise, distinguishing between "internally consistent" (drift-free) and "current" (matching core), and correctly identifying that byte identity is a stronger guarantee than version claims for shared artifacts.

VERDICT: APPROVE
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: <repo>)
Expanding hook command: <home>/.superset/hooks/gemini-hook.sh (cwd: <repo>)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 17ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: <repo>)
Expanding hook command: <home>/.superset/hooks/gemini-hook.sh (cwd: <repo>)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: opencode

## Independent Adversarial Review — `add-workflow-fleet-conformance`

### Spec correctness and semantic integrity

The delta is internally coherent. The restructured `Read-Only On Project Filesystems` requirement correctly centralises the four spawn sites (editor, git, openspec binary, harness) with a closed enumeration ("no further spawning surface may be introduced without amending this requirement"), and the `OpenSpec CLI Invocation Discipline` cross-reference is corrected from the pre-existing wrong target (`Daemon Writes Confined`) to `Read-Only On Project Filesystems`, resolving a latent bug. The four-item cache fingerprint (artifact, harness, core reference, runner-contract version) is stated identically in the requirement, design §9, and tasks. The write-prohibition vs. spawn-prohibition separation is clean: the daemon forbids its own writes, enumerates what it spawns, and explicitly refuses to assert what spawned foreign programs do to the filesystem — matching the three-reviewer rejection of the byte-identical-working-tree claim. No MUST/SHALL contradiction found inside the spec delta.

### Findings (all non-blocking)

1. **Stale requirement title.** `Registry Mutation Is The Only Write Surface` now admits two surfaces in its body ("registry routes **and** `POST /api/v2/workflow/harness` SHALL be the only routes that mutate daemon state"). The title asserts singular exclusivity the body no longer holds. Recommend retitling (e.g. `Daemon Mutation Surfaces`); a reader indexing by title is misled.

2. **Under-specified cache-key summary in proposal.** The "Resolved" paragraph states the cache key "covers the artefact under test **and** the harness script" — two of the four inputs the spec requirement and design §9 mandate. Not a hard contradiction (it does not say "only"), but it under-describes the design and could mislead an implementer who reads only the proposal. Reconcile the summary with the four-input spec.

3. **Spin-discipline tension on concrete bounds.** `workflow-fleet-conformance` fixes harness bounds as literals (30 s, 256 MiB, 1 MiB, 64 MiB) inside the requirement, whereas `filesystem-access-policy`'s `Per-Project Path Allow-List` mandates that every bound be "a single named constant with a documented default" and that "concrete values are an implementation choice and are not fixed here." These are different capabilities making opposite choices about whether to fix values. Resolvable (spec-fixed values implemented as named constants with those defaults), but the philosophical split is worth an explicit note.

4. **`openspec/config.yaml` coverage is unverifiable from the bundle.** The proposal states config.yaml carries the same "sole exception" hard constraint and tasks say to update it to "name both user-driven process exceptions (open and workflow harness)" — two of the four enumerated spawn sites. If config.yaml is a full spawn-enumeration mirror, listing only the user-driven pair leaves git and the openspec binary unmentioned and the constraint under-specifies what the spec guarantees. If config.yaml tracks only user-driven exceptions, the framing is fine but should be stated. Cannot verify either way without the file; flag for reconciliation.

### Minimality

The change necessarily restructures `Read-Only` into the single spawn enumeration rather than only inserting the harness line — a closed enumeration cannot omit the pre-existing git/openspec sites. This broader edit is justified, not gratuitous. `Per-Project Path Allow-List`, `Git Command Allow-List`, and `Registration Target Blocklist` are correctly left untouched. The near-no-op edit to `OpenSpec CLI Invocation Discipline` (last-paragraph rephrase + cross-reference fix) is acceptable as a correctness fix bundled with the enumeration it depends on.

### Completeness / reachable scenarios

Every scenario referenced is reachable and testable: path/symlink/identifier refusal, process-group termination on timeout, concurrency cap, output redaction, cache invalidation on each of the four fingerprint inputs, completed-fail-cached vs. timeout-not-cached, and the "internal consistency ≠ current" distinction are all concrete. No unreachable or self-contradictory scenario found. The "spawn enumeration is exhaustive" meta-scenario is auditable by grep, which is the appropriate form.

VERDICT: APPROVE
