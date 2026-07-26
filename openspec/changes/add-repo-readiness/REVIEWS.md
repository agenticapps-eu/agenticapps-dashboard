## Reviewer: gemini
_generated 2026-07-26T14:30:20Z · timeout 180s_

VERDICT: REQUEST-CHANGES

This is an exceptionally strong and well-considered spec. The design principles — especially the two-tier provenance, the detailed status vocabulary, and the rejection of a misleading aggregate score — are excellent. The requested changes are minor and intended to increase the system's flexibility to match the adaptability already demonstrated in the `workflow` check.

*   **Staleness calculation is too rigid.** The `stale` check for reviews and coverage relies on a hardcoded exclusion list for non-production code paths. This assumes all projects in the fleet share an identical directory structure for documentation, specs, and other non-code assets. This will incorrectly flag reviews as stale in repos that use different structures (e.g., `examples/`, `tests/fixtures/`, `scripts/`). This exclusion list should be configurable per-repo, likely within `.agenticapps/readiness.json`.
*   **Coverage data path is not configurable.** The coverage check assumes the summary artifact is always at `coverage/coverage-summary.json`. Different languages, frameworks, and testing tools generate this file at different locations. To maximize adoption of the derived (Tier A) signal, the path to this artifact should be configurable per-repo, allowing teams to opt-in without reconfiguring their CI.
*   **Ambiguity in artifact "timestamp".** The spec uses "timestamp" and "mtime" when describing how to evaluate if a review artifact is stale. This could be interpreted as the file's modification time on disk, which is non-deterministic across checkouts and in CI environments. This should be clarified to mean the `git` commit timestamp of the last commit that modified the artifact file, which is stable and authoritative.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 17ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: codex
_generated 2026-07-26T14:33:15Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The change never defines when a repo is actually “production-ready.” Six statuses are displayed, but whether `warn`, `stale`, `never`, or `na` blocks readiness is unspecified.
- Tier B can overwrite derived `fail` or `stale` security/coverage results with a self-declared `ok`. Require trusted evidence, timestamps and reviewed commit SHAs, or restrict which checks declarations may override.
- Filesystem `mtime` is not reliable review provenance: checkout, copying, or `touch` can make old evidence appear current. Compare reviewed commit ancestry and account for dirty/untracked production changes.
- Review checks inspect only artifact existence and age. A fresh review containing failed findings would become `ok`; artifact formats, verdict mapping, scope, and accepted paths are unspecified. Pen-test declarations also never expire.
- Evaluation errors have no distinct status. Allowing either `fail` or `never` with raw error text contradicts the promised vocabulary and makes sorting unreliable. Add a machine-readable error state and redact filesystem paths, secrets, and PII.
- The readiness-file schema is incomplete: supported version, field shapes, invalid-entry handling, timestamps, evidence paths, size limits, threshold range, and HTML/text sanitization are not specified.
- Coverage’s default `80` threshold remains only an open question, while override semantics conflict with per-check replacement. Exact boundaries and validation—especially whether exactly five points below is `warn`—must be normative.
- Auth/CORS inheritance appears only in proposal prose. The delta needs requirements for authorization, unknown repo IDs, rescan abuse/concurrency, symlink and traversal containment, and safe evidence-link resolution.
- The UI contract requires timestamps and source paths for every result, but `never`, `na`, synthetic errors, and multi-source workflow results may have neither. Define nullable fields and explicit rendering behavior.
- Default sorting ignores `stale` and `warn`, so a repo with stale security evidence can rank below a less dangerous repo merely because it has fewer `never` results.

## Reviewer: opencode
_generated 2026-07-26T14:34:05Z · timeout 180s_

## Review: add-repo-readiness

**VERDICT: REQUEST-CHANGES**

The design is coherent and the "no aggregate score / six honest cells" thesis is well-defended. The gaps below are addressable without re-architecting.

### Correctness / spec-vs-intent gaps

- **Error-vs-`never` distinguishability is promised but not delivered.** The vocabulary requirement says an evaluation error "SHALL be distinguishable from one that has never run," yet the error-handling requirement maps errors to `fail` *or* `never` "carrying the error text." Distinguishability then lives only in the `summary` string, not in any structured field. Either add a dedicated status (or a `kind: error` sub-field) or weaken the "distinguishable" SHALL to "distinguishable by status *or* carry an explicit error marker." As written the two requirements contradict each other.
- **Machine-global host has no status-mapping scenario.** The workflow requirement gives ok/warn/fail scenarios only for repo-scoped hosts. For codex/opencode it says "report both values" but never says which status results when the per-repo scaffolder version and the machine-global `implements_spec` disagree. Add a scenario; otherwise two implementers will pick two answers.
- **Review artifact disambiguation is unspecified.** `code-review` and `security-review` both "search both layouts for their evidence artifacts," but nothing in the delta says *how a check knows which artifact is its own*. A `REVIEW.md` and a `SECURITY.md`/`SECURITY-AUDIT.md` need a matcher. Without it, the two checks risk counting each other's evidence. Add the filename/glob contract (or point at the existing conformance matcher) as a scenario.
- **"Last commit touching production code" is undefined.** The exclusion list (`docs/`, `.planning/`, `openspec/`, root `*.md`) is a positive exclude, but "production code" itself is never defined. Is `tests/`, `scripts/`, `*.config.ts`, root `package.json`, `Dockerfile` production? Add the inclusion rule or a scenario covering a borderline path (e.g., a `package.json` dependency bump).

### Missing scenarios

- **Malformed readiness entry** (valid JSON, supported `schemaVersion`, but a check entry has an invalid `status` value, or `na` with no reason, or missing required fields). The delta covers unknown check *identifier*, unsupported *schemaVersion*, and *unparseable* JSON — but not a *semantically invalid* entry. Is the whole file ignored, or just that entry? Decide and add a scenario.
- **Declared value overriding a *worse* derived value.** Tier B wins per check, so a repo can declare `pen-test: ok` (or `workflow: ok`) over a derived `never`/`fail` with nothing checking plausibility. Fine for a local file, but state the trust assumption explicitly ("declared values are trusted as author input") so nobody later adds validation that breaks the model — or decides no validation is a bug.
- **Rescan for an unknown / unregistered `:id`** and **concurrent rescan** of the same repo (cache invalidation race). Both are trivial but currently unaddressed.
- **Cache freshness vs git state.** Staleness is computed at derivation time and cached; rescan is the only invalidation trigger. A repo that receives new commits will show stale readiness until someone manually rescans. Add a scenario stating whether the cache is TTL-bounded, git-hook-invalidated, or explicitly rescan-only — this is a real UX correctness question.

### Security / PII

- **Security-spine claim is slightly overstated.** The rationale says "no new execution surface" and defers the widening to `add-workflow-fleet-conformance`, yet the `workflow` check here *consumes* machine-global paths (codex/opencode global skill dirs). If the read path for those globals is established by the *other* change, this delta genuinely only reuses it — but that dependency is asserted, not evidenced in the delta. Add one line pointing at the exact requirement in `add-workflow-fleet-conformance` that authorizes the machine-global read, or move the read into that change. Right now a reviewer cannot confirm the spine is untouched from this delta alone.
- **Machine-global value exposure.** Reporting that a value "applies to every project on this machine for that host" is fine locally, but confirm this never enters any exported/synced artifact. The product vows no data leaves the machine; the detail-page text should not be cached into anything that later gets exported. Low risk given the local-only model — worth one sentence, not a redesign.

### Minor

- **`readiness.json` schema is referenced but not specified.** `schemaVersion`, per-check entries, `threshold`, and the `na`-reason shape are all implied. If the full schema lives in another capability/spec, point at it; if not, the `schemaVersion`-handling requirement is enforcing conformance against a schema that doesn't exist in the spec set yet.
- **`spec` check reusing `never` for "OpenSpec not set up" strains the vocabulary** (never-run vs not-configured). Defensible per the stated intent (make the backlog visible), but consider whether `na` with reason "OpenSpec not adopted" would be more honest while still surfacing the backlog via the absence marker. Flagging, not blocking.
- **Tiebreaker "most recent change"** doesn't specify author-date vs commit-date or timezone normalization; trivial but worth a line.

