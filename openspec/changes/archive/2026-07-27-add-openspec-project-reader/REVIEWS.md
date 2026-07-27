# Review record

> **These sections are a point-in-time snapshot, not the change's current
> status.** Both round-2 verdicts below are `REQUEST-CHANGES`, and both were
> answered: every finding is resolved in `proposal.md` §"Review round 2,
> 2026-07-26 — resolved", which maps each one to the requirement or scenario that
> closes it. Two were settled by measurement (the CLI surface against openspec
> 1.6.0; the archive prefix against all 21 archived directories).
>
> Round 1's reviews are preserved in this file's git history. The verdicts are
> left as written rather than edited to `APPROVED` — a review record that gets
> rewritten once its findings are addressed is not evidence of anything.

## Reviewer: gemini
_generated 2026-07-26T15:36:51Z · timeout 240s_

VERDICT: REQUEST-CHANGES
*   **Unbounded file reads introduce DoS vector.** The `OpenSpec CLI Invocation Discipline` correctly adds a size cap on captured output from the `openspec` binary. However, the `/read` endpoint itself has no specified size limit. An authenticated user with commit access to a repository could add a multi-gigabyte file to the `openspec/` directory and use the API to force the daemon into excessive memory and network consumption, creating a denial-of-service vector. The `Per-Project Path Allow-List` should be amended to include a file size limit.
*   **CLI version skew is only half-handled.** The fallback logic handles a *newer* CLI producing an unrecognized JSON shape. It does not address an *older* CLI producing a valid shape that is missing fields the daemon now considers mandatory, which could lead to silent misrepresentation of project state. The `OpenSpec CLI Invocation Discipline` should require a minimum CLI version check.
*   **The single-project view for `needs-migration` state is undefined.** The spec correctly defines the card view for a GSD-only project. It is silent on what the single-project view should render when a user clicks on that card. This view should be explicitly specified as an informational state, not just a blank page, to guide the user on the required migration.
*   **Task-artifact presence reporting is ambiguous.** The spec says "The reported shape carries task-artifact presence as its own value," which is good. However, the corresponding scenario for the `Change Progress Column` says a change with no task artifact is reported as "having no task data rather than as zero progress." This could be interpreted as omitting the change entirely. The requirement should be more precise, stating that the change is still rendered but with an explicit "No task list found" state in place of the progress ratio.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: opencode
_generated 2026-07-26T15:41:57Z · timeout 240s_

VERDICT: REQUEST-CHANGES

- **Parity table includes "task-artifact presence" but the CLI cannot produce it.** The Requirement: Change Progress Column states "the CLI reports zero for both" [absent vs empty `tasks.md`], so the CLI path has no value for presence without re-reading the tree. Parity Requirement: Hybrid OpenSpec Read Strategy pins "task-artifact presence | open change" as a field the two paths MUST agree on. Either the CLI path must fall back to the tree for this one field (not stated), or the parity claim is unachievable. Resolve the contradiction explicitly.

- **Spawn errors are not in the fallback enumeration.** OpenSpec CLI Invocation Discipline's bounds list is "timeout, non-zero exit, output exceeding the cap, unparseable JSON, or JSON whose shape the daemon does not recognise." A binary that was resolved at daemon start and is later uninstalled, replaced, or loses the executable bit raises a spawn error (ENOENT/EACCES), which is neither non-zero exit nor any listed case. Add spawn failure to the fall-back conditions or add a scenario for "binary present at start, missing at invocation."

- **Archive format pinning is aspirational, not enforced.** Archive ordering pins a `YYYY-MM-DD-` zero-padded ISO prefix, but nothing in this change modifies the archive script that produces those names. If the existing archive (21 GSD-era phases) does not match the prefix, the "non-matching directories ordered after all matching ones" rule sorts the entire legacy archive *after* new date-prefixed ones — chronologically inverted. State whether existing archived directories already conform, or add a migration/rename step, or define legacy handling that preserves chronological order.

- **Shape recognition strictness is undefined.** "Validates the JSON … against the shape it knows, and treats anything else as absent" — the scenarios don't define whether the check is "required fields present" (forward-compatible) or "exact field set" (breaks on every CLI bump that adds a field). A too-strict check silently degrades the CLI path to the tree on every upstream version bump, defeating the CLI's stated purpose. Pin the recognition rule (e.g., required-subset, ignore-unknown-fields).

- **The CLI argv table is an unverified assumption.** The closed subcommand table is `list --json` and `list --specs --json`; no scenario verifies these subcommand/flag names exist against a real `openspec` binary. If the real CLI uses a different surface (e.g., `openspec changes list --json`), the CLI path is dead on arrival and the change's hybrid rationale collapses to tree-only. Add a precondition citing the actual CLI version/surface this table was validated against.

- **"Same content class as `.planning/`" is asserted, not argued, for the security acceptance.** OpenSpec `REVIEWS.md` files contain multi-AI adversarial reviewer prose (this very change's reviews are the evidence), which is arguably a broader sensitivity surface than GSD-era per-phase artifacts. The exposure is *accepted*, but the justification rests on a class-equivalence claim that is never demonstrated. Either add a sentence characterising the content (reviewer prose, design notes, task deltas) and conclude equivalence explicitly, or mark it as an accepted residual risk rather than "no new class of content."

- **Motivation table vs. spec inconsistency on last-activity.** The "Why" table lists last activity moving from "a git subprocess" (GSD) to "`lastModified`, given" (OpenSpec), implying git is no longer used. Per-Project Computed Status still requires "the last commit timestamp on the current branch," which is a git subprocess. Clarify that last-commit remains git-derived and `lastModified` is per-change (not project-level last activity), or update the table.

- **No scenario for a resolved binary that is not a regular executable file.** Resolution requires "an absolute path to an existing regular executable file" but no scenario covers the binary being a directory, a broken symlink, or present-but-not-executable at resolution time. Add a scenario or fold these into the resolution-failure case.

- **Change validity is undefined.** The tree path enumerates "open changes" but "conformant change directory" is only defined for the parity scope, not for what counts as an open change at all (e.g., a directory under `changes/` missing `proposal.md`, or a `changes/<slug>/` with only `tasks.md`). Add a minimal invariant for what makes a directory an open change, or state that the CLI is the source of truth for the change set on the CLI path.

