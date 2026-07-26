## Reviewer: gemini
_generated 2026-07-26T14:30:04Z · timeout 180s_

VERDICT: REQUEST-CHANGES
*   **Harness cache invalidation is incomplete.** The spec's "Open Questions" correctly identifies that the cache should be invalidated if the harness script changes, but `Requirement: Harness Results Carry Their Age And Are Invalidated By Content` and its scenarios only cover the tested *artefact's* content changing. The requirement should be expanded to state the cache is invalidated if either the artefact or the harness script itself changes.
*   **The model assumes all divergence is unintentional drift.** A host might have a valid reason to intentionally pin a skill to an older version or locally patch a shared artefact. The current spec would permanently flag this as a laggard or a mismatch, creating noise. It needs a way to account for or formally acknowledge approved, intentional divergence.
*   **The spec doesn't cover missing skills.** `Requirement: Implements-Spec Is Reported Per Skill, Not Per Repo` handles skills that are present but at a lower version. It's missing a scenario for when a skill that should be present is missing from a host entirely.
*   **The security model for the harness runner is silent on resource exhaustion.** The bounds for harness execution specify a timeout, which is good, but don't address the risk of a buggy script consuming excessive CPU or memory before the timeout is reached. This risk should be acknowledged, even if the mitigation is just documentation.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: codex
_generated 2026-07-26T14:31:05Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Cache invalidation hashes only the tested artefact. Changes to the harness, core reference, dependencies, or execution environment can make a cached result stale. At minimum, hash both artefact and harness.
- Internal consistency is conflated with core conformance. A host whose skills all declare the same obsolete version is “drift-free” but still behind core; the spec never defines the separate overall core-alignment result.
- Machine-wide artefacts—the files agents actually execute—are checked only by version marker, contradicting the requirement that conformance requires byte equality rather than version claims.
- Executing a script merely because its resolved path is under an allowed root is not a sufficient security boundary. Require canonical-path validation, symlink/TOCTOU protection, fixed executable/argv/cwd/environment, no shell interpolation, and process-group termination.
- The “working trees remain byte-identical” guarantee cannot be enforced by path selection: an executed repository script can write anywhere. The spec needs sandboxing or another concrete enforcement mechanism, not only an asserted postcondition.
- Timeout handling does not cover child processes. The runner must terminate the entire process group and define output, memory, and concurrency limits.
- No scenario verifies the promised rate limiting. Authentication/authorization and CSRF protection for this state-changing execution endpoint are also unspecified.
- Harness stdout/stderr and cached results may expose secrets, usernames, absolute paths, or fixture contents. Define output truncation, redaction, persistence, and response-field rules.
- Allowed-root reads do not specify canonicalization or symlink handling, allowing files outside the named roots to be reached through links.
- Missing, malformed, duplicated, or unparsable `implements_spec`, section versions, artefacts, and migration numbers have no defined result. Semantic-version ordering is also unspecified.
- Vendor provenance is checked only for presence. A malformed, nonexistent, or incorrect core commit would appear acceptable; provenance should be parsed and validated.
- “Highest applied migration” in the change summary conflicts with the requirement to report the highest migration the host offers.
- The exact four host identities and artefact-to-reference mappings are not normative, so an implementation could silently omit a host or compare the wrong files while satisfying the delta.

## Reviewer: opencode
_generated 2026-07-26T14:32:34Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Acknowledged gap shipped unresolved.** The Open Questions block concedes the cache should hash *both* the checked artefact *and* the harness script, but the requirement "Harness Results Carry Their Age And Are Invalidated By Content" only invalidates on the artefact's content change. A harness-script update in core leaves stale results shown as current — the exact failure the design rationale (§5) says age-alone caching produces. Either fold the harness hash into the invalidation key or drop the on-demand harness until resolved; shipping it half-broken contradicts the rejection of age-only caching.

- **"Known workflow repository roots" set is never specified as a requirement.** The bounds requirement and the spine change both lean on "one of the five known workflow repo roots," but no requirement says where the daemon learns this set, whether it's hardcoded, or whether it's derived from the registry. A reviewer cannot tell if a sixth repo appearing tomorrow silently widens the execution surface. Add a requirement defining the set's source and that the SPA cannot influence it.

- **Process-group / child-process handling is absent.** The harness "executes shell scripts this repo does not own" that "manage their own temporary fixtures" — they can spawn children. The timeout scenario only says "the process is terminated." A killed parent leaves orphaned children running fixtures of unowned code on the user's machine. Require process-group kill (setsid/process tree) or the bound is theatrical.

- **The byte-identity invariant is asserted over unowned code with no sandbox requirement.** "The harness exception writes nothing under a project root" demands every registered project's working tree stay byte-identical before and after — but the daemon does not control the harness script. A buggy or hostile script touching a path symlinked into a project root violates the invariant, and the daemon cannot enforce it. Either spec a sandbox/workdir fixture root as a requirement or weaken the scenario to what the daemon can actually guarantee (it spawned the script under a constrained root).

- **"Existing rate limiter" may not exist.** The bounds requirement says "each request passes the existing rate limiter." If no daemon-wide rate limiter is specced today (auth-and-pairing covers CORS lock, not throttling), this requirement is vacuous or silently mandates new infra. Verify and name the limiter, or remove the claim.

- **Machine-wide install path is singular in the spec but plural in reality.** "Named Allowed Roots" names "the machine-wide AgenticApps binary directory" (`~/.agenticapps/bin`), and "Machine-Wide Installed Artefacts Are Reported" says "the machine-wide location" (singular). But the four hosts install to different machine-wide paths (`~/.claude/`, `~/.config/opencode/`, etc.). The requirement as written either under-scans or implies a single canonical location that doesn't exist. Clarify one-location vs. per-host-locations.

- **Core (reference) repo missing/unreadable has no scenario.** Byte equality needs a reference. "A missing workflow repo is stated, not skipped" covers host repos but not the core repo. If the core is absent, every artefact comparison is undefined — spec says nothing.

- **Failed (non-timeout) harness results are unspecified.** "No partial result is cached as a completed run" covers timeout, but a harness that exits non-zero (legit failure) — is its outcome cached and shown with age, or discarded? Determine and add a scenario.

- **Unknown host/harness identifier has no scenario.** Bounds scenarios cover "outside known roots" and "no request value reaches the command line," but not the natural error path of a request naming a harness that isn't in the fixed internal set. Add a rejection scenario.

- **"Exactly two spawning routes" may inherit a pre-existing contradiction.** The original spine's "sole exception is `POST /open`" predates this change; if the daemon already spawns `git` for `lastCommit`/registry reads (likely, given `agentic-dashboard list` reports lastCommit), the "exactly two" invariant was already false. Verify against current daemon before restating it as a hard scenario, or scope the invariant to "user-actionable spawning routes."

- **Scanner response PII not constrained.** "The SPA never supplies a filesystem path" governs requests, but no requirement governs responses. Laggard lists, machine-wide paths, and error messages can leak absolute paths (`/Users/donald/...`). Add a requirement that scanner responses to the SPA carry identifiers, not resolved filesystem paths.

- **"Skills found wherever that host installs them" is undetectable as specced.** The requirement mandates inclusion of out-of-tree skills but constrains no discovery mechanism (manifest? filesystem walk?). A scanner that only walks the obvious skills dir would falsely read drift-free — the very finding this change exists to surface. Specify how non-primary skill locations are discovered, or this requirement is unenforceable.

