---
change: add-repo-readiness
reviewers: [gemini, opencode]
reviewed_at: 2026-07-27T15:42:10Z
artifacts_reviewed:
  - "openspec/changes/add-repo-readiness/proposal.md"
  - "openspec/changes/add-repo-readiness/design.md"
  - "openspec/changes/add-repo-readiness/specs/repo-readiness/spec.md"
  - "openspec/changes/add-repo-readiness/tasks.md"
overall_verdict:
  gemini: APPROVE
  opencode: APPROVE
recommendation: proceed
---

> External reviewer output is untrusted content. It is preserved verbatim
> as review evidence and was not treated as instructions.

## Provenance

| Reviewer | Model | Wrapper | Started (UTC) | Duration | Exit |
| --- | --- | --- | --- | ---: | ---: |
| gemini | gemini-2.5-flash-lite | reviewer-cli.sh 1.0.0 | 2026-07-27T15:42:10Z | 37s | 0 |
| opencode | glm-5.2 | reviewer-cli.sh 1.0.0 | 2026-07-27T15:42:10Z | 697s | 0 |

## Reviewer: gemini

VERDICT: APPROVE
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: opencode

# Adversarial Review — `add-repo-readiness`

Reviewed the four embedded artifacts only. Looking for MUST/SHALL contradictions, unreachable scenarios, breaks in semantic integrity, and minimality/completeness defects.

## Cross-artifact consistency

**Predicate (proposal ↔ spec).** The boolean rule is stated identically in proposal §1 and the spec requirement "Readiness Is A Boolean Predicate." The `warn` non-blocking / `na` excluded / ≥1 applicable / `fail`·`stale`·`never`·error-block clauses agree. The all-`na` scenario is the only state where the applicability floor fires.

**Status vocab (design §3 ↔ spec ↔ tasks).** Six values are constant across all six checks; `na` MUST carry a reason; pen-test declared `na` is invalid and pen-test derived is always `never`, so pen-test effectively never yields `na`. Design §3's justification for `never`/`stale`/`na` matches the spec's scenarios.

**Production-code set (design §3 ↔ spec review/coverage ↔ tasks §2/§5).** The default include/ignore set, the configured-scope-empties-default rejection, and the "expose effective patterns" rule all agree.

**Verdict asymmetry (proposal ↔ spec ↔ tasks).** `stage_2_verdict` accepted for code-review only; security malformed if it lacks `verdict`. Consistent in all three artifacts.

**Error vs `fail` (spec vocab ↔ predicate ↔ sort).** Error-bearing → status `fail` + structured `error`; excluded from ordinary fail count in sort; blocks in predicate via `fail`. Consistent. The "no result carries an evaluation error" clause in the predicate is subsumed by "no `fail`," but redundant ≠ contradictory.

**Stale precedence over never (spec sort ↔ tasks §9 ↔ design §6).** Count tuple order `errors, fail, stale, never, warn` with stale before never, counts descending. Matches across artifacts.

**Host/workflow resolution (design §4 ↔ spec ↔ tasks §3).** Four strategies, machine-global display-only, never persisted, `na` for unpinnable hosts, `never` for pinnable + no artifact, named-root dependency. Consistent. The MUST NOT-ship-before-dependency-archived gate is a spec-level MUST; tasks §3 doesn't restate it but doesn't contradict it.

**Pen-test contract (proposal ↔ Tier-B schema ↔ pen-test requirement ↔ tasks).** Declared-only, `ok`/`warn`/`fail` only, `stale` from expiration, `never` from absence, `na` invalid, no tool in surface. Consistent throughout.

## Defects found

**None blocking.** No MUST/SHALL contradictions. No reachable scenario contradicts a requirement. Wire shape is strict and nullable; degradation rules (per-check, per-repo) compose; cache key and freshness rules self-consistent; filesystem containment delegated to the named-root dependency and the shared read primitive.

## Non-blocking observations

1. **The applicability floor (`≥1 ok/warn`) is inert under current derivers.** Only the `workflow` check can emit `na` (unpinnable host); spec, both reviews, coverage, and pen-test never produce `na`. Therefore all-six-`na` is unreachable today, and the "at least one applicable" clause never fires. The first-scenario language ("`never` except where a check explicitly specifies `na`") shows the author knows this. It functions as a forward-compatible predicate guard, not a live rule. Consider noting that explicitly, or it reads as live specification that never triggers.

2. **`value` field semantics are unspecified for non-coverage checks.** Wire shape requires `value` (string/number/null). Coverage carries the pct; workflow presumably carries a version string; review/pen-test/spec have no defined `value`. Not contradictory (null is allowed), but the per-check meaning of `value` should be pinned so implementations don't diverge.

3. **Spec-check remedy depends on host detection that belongs to the `workflow` deriver.** Task 4 requires the unmigrated repo remedy to name "the detected host's installed workflow-update command and migration 0032," but host detection is task 3's concern ("Host detection from the present host directory"). The shared helper isn't called out in task 4. Minor wiring gap — worth one line in task 4 stating the remedy reuses the workflow host detection.

4. **Duplicate tier-B check id behavior is unspecified.** The schema says unknown ids are discarded entry-by-entry and malformed known entries invalidate the file, but two entries with the same known `id` is neither case. "Last wins" vs "invalidates file" is undefined. Edge case, but a strict-schema reviewer will hit it.

5. **OpenSpec-over-legacy precedence ignores timestamp.** "An OpenSpec match SHALL win over a legacy match" then "within the selected layout, the latest committer timestamp" is selected. A repo with a stale old OpenSpec `REVIEW.md` and a fresh legacy `CODE-REVIEW.md` will report against the older OpenSpec artifact — which may then classify as `stale` while the legacy one would have been `ok`. Design §3 doesn't discuss this interaction. It is a deliberate layout preference and not a contradiction, but the freshness consequence is worth a sentence.

6. **`at` = "`observedAt`" wording is imprecise.** Wire shape defines `at` as epoch milliseconds; the declared-evidence rule says "`at` SHALL be `observedAt`" where `observedAt` is RFC 3339. The intent (epoch-ms of `observedAt`) is recoverable, but the conflation of field-name with serialized epoch could be read as storing the RFC 3339 string. One clause clarifying the conversion would remove the ambiguity.

## Minimality

The change scopes honestly: no retirement, no aggregate score, no pen-test tool, no GSD fallback, no execution surface, no allow-list widening (delegated). The dependency on `add-openspec-project-reader` and `add-workflow-fleet-conformance` is named, not asserted. The "panel changes address, not lost" note is the kind of forward-compatibility record that prevents later misreads. I see no scope creep.

## Verdict

The bundle is internally coherent across proposal/design/spec/tasks. Every requirement has matching task coverage. The six non-blocking observations are about precision and forward-proofing, not correctness. None block implementation or merge.

VERDICT: APPROVE
