## Reviewer: gemini
_generated 2026-07-26T14:45:27Z · timeout 180s_

VERDICT: REQUEST-CHANGES

*   The "accepted cost" of retiring the GSD reader before all key repos are migrated seems high. This change will temporarily disable progress reporting for flagship projects (`cparx`, `claude-workflow`). The spec should consider a short-term fallback or feature flag to keep the GSD reader active until migrations are complete, preventing a total loss of visibility for those projects.
*   A scenario is missing for projects that are mid-migration, containing both `.planning/` and `openspec/` directories. The spec should explicitly state that the presence of `openspec/` takes precedence and the GSD reader will be ignored.
*   The hybrid read strategy is solid, but it introduces a potential consistency risk. What happens if the `openspec` CLI tool is at a newer version and produces output that the daemon's fallback tree-reader doesn't understand? The spec should acknowledge this and require that the two readers support the same feature set.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 19ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 18ms

## Reviewer: codex
_generated 2026-07-26T14:48:25Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The merged discovery spec still requires `.planning/config.json` as a marker, while tasks explicitly remove it. Modify the existing Registry CRUD requirement rather than only adding the OpenSpec marker.
- “No `openspec/`” is incorrectly treated as “workflow not installed.” GSD-only repositories may have the workflow skill installed and need a migration hint, not an install hint.
- Hybrid parity is not achievable as specified: OpenSpec supports schema-defined/nested task artifacts, while the fallback hardcodes top-level `tasks.md`; capability parsing also differs from counting raw header occurrences.
- CLI JSON cannot distinguish a missing task artifact from an empty one—both produce zero tasks. An explicit presence probe/data shape is required to satisfy “no task data.”
- The UI requires affected capabilities, but `openspec list --json` does not provide them and tasks do not specify tree extraction. The parity scenario also omits affected capabilities and archived history.
- Cards still require review finding counts, but removing the phase reader also removes their defined source and aggregation rules. Specify how findings are collected across open changes, or remove the field.
- CLI failure handling covers only a missing binary. Require bounded execution and fallback for timeout, non-zero exit, malformed JSON, incompatible versions, and oversized output.
- Allow-listing the entire `openspec/` tree exposes proposals, tasks, and review artifacts—which may contain customer data or secrets—through generic `/read`. Either document this exposure as accepted or constrain readable files and sizes.

## Reviewer: opencode
_generated 2026-07-26T14:49:33Z · timeout 180s_

I'll review this change against the specs it touches.

Let me check the canonical specs to verify the delta's claims and the security spine.
I have enough to render a verdict.

VERDICT: REQUEST-CHANGES

- **Auto-discovery vs. install-hint contradiction.** The new "OpenSpec Auto-Discovery Marker" requirement adds `openspec/` as a discovery marker, but the existing `Auto-discovery requires confirmation per match` scenario (under `Registry CRUD Surface` in project-registry) still names only `.claude/skills/agentic-apps-workflow/SKILL.md` and `.planning/config.json`. A repo with `.planning/config.json` (a GSD-only fleet member) is therefore still auto-discoverable/registrable, yet the MODIFIED `Per-Project Computed Status` and home install-hint scenario now key off `openspec/` presence. Result: you can register a project via the workflow marker, then the card tells you to "install the workflow." This directly collides with the "8 GSD-only repos go blank" accepted consequence (those repos are registrable today). Fix: MODIFY the existing auto-discovery scenario in one place rather than adding a parallel requirement, and state whether `.planning/config.json` remains a valid marker once the OpenSpec reader is the only progress reader.

- **Non-goal's premise is internally false.** "A new coverage-matrix column for OpenSpec. `workflowVersion >= 3.0.0` already implies it." Per `fleet-coverage`, `workflow-version` tracks the *installed skill version*. The accepted consequence name-lists GSD-only repos including `claude-workflow` itself — it runs workflow ≥ 3.0.0 yet has no `openspec/`. So workflow-version ≥ 3.0.0 does *not* imply OpenSpec layout. The non-goal justification is wrong; either a coverage column for OpenSpec layout is genuinely needed, or the justification must change.

- **New subprocess surface unspecified.** "Hybrid OpenSpec Read Strategy" spawns the `openspec` binary from PATH — a new execution surface comparable to the git subprocess that `filesystem-access-policy` explicitly scopes with a command allow-list. The delta is silent on: which binary / how located (PATH-trust assumption), whether args are passed via argv vs. shell, and what user-controlled values (project path, change name) are passed. Add an explicit subprocess/argv discipline requirement parallel to "Git Command Allow-List," or fix to an absolute, daemon-installed binary.

- **"Both paths MUST produce the same values" is unenforceable as written.** No canonical field list is pinned. As the CLI evolves its JSON shape and the tree reader drifts, this MUST has no testable invariant. Specify the exact value set (open changes, per-change task counts, capability counts, archive ordering) the two paths must agree on.

- **Archive ordering format unspecified.** The Change Progress Column scenario says "ordered by their date prefix" without stating the prefix format. The proposal text itself earlier concedes GSD phase dirs "cannot be ordered programmatically." If OpenSpec archive dirs are ever named with non-zero-padded dates (`2026-1-7` vs `2026-01-07`), lexicographic ≠ chronological. Pin ISO 8601 date prefix `YYYY-MM-DD-` (or state the canonical archive naming) so the MUST is testable.

- **Affected-capabilities derivation is undefined.** "Change Progress Column" requires rendering "the capabilities its spec deltas affect," but the change doesn't define how affected capabilities are derived from a change's `specs/` delta tree, nor the behavior when a change has no spec delta yet (only `tasks.md`). Add a scenario for a change with no spec delta.

- **Empty-state gap for progress column.** The dashboard spec's "Panels Degrade To Empty States" applies, and the Capability Panel requirement handles "no specs" explicitly, but the Change Progress Column requirement only handles "a change carrying no task list." It doesn't handle "no changes at all" (freshly-initialized `openspec/` with no `changes/`). Add a scenario.

- **Why `.planning` stays allow-listed is unstated.** The GSD reader is retired but `<root>/.planning` remains in the allow-list. The Discipline State Column and meta-observer apparently still read `.planning/skill-observations/`, which is the likely reason — but the change doesn't say so, leaving reviewers to infer it. Add a one-line rationale so a future change doesn't "clean up" an allow-list entry that's still load-bearing.

- **No PII / content-exposure regression** introduced; new reads stay within project root under realpath-checked allow-lists and prose content (specs, change deltas, archive) reads no worse than the existing `.planning` reads. No blocker here.

- **Schema delta absent.** `project-dashboard`'s "Schema Validation At Both Ends" is untouched, yet the wire shape changes substantially (open changes + task ratios + capability panel replace phase artifacts). Confirm the shared-schema package is covered by this change's tasks even if not by its spec delta; if the schema-test invariant belongs in spec, add a MODIFIED requirement.

