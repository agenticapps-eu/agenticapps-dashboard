You are the independent Stage-3 code reviewer for the AgenticApps Dashboard
OpenSpec change `remove-gitnexus-integration`.

Work read-only. Do not edit files, commit, or run destructive commands.

Review the implementation against:

- `openspec/changes/remove-gitnexus-integration/proposal.md`
- its three delta specs and `tasks.md`
- `docs/decisions/0001-coverage-v2-history-compatibility.md`
- `MEASUREMENT.md`, `QA.md`, and `IMPECCABLE-AUDIT.md`

The repository has unrelated dirty changes. Restrict review to the removal
change: coverage/history/health schemas and compatibility parsers in shared;
coverage, snapshots, conformance, health, route registration, filesystem
allow-lists, and deleted GitNexus/Wiki modules in agent; coverage queries,
components, filters, actions, and responsive tests in SPA; and the associated
current specs/docs/evidence.

Inspect the actual working-tree diff and current files. Focus on correctness,
version-skew behavior, strict v2 shapes, legacy snapshot preservation,
full-window score continuity, route removal, accidental loss of Understand
Anything behavior, UI accessibility, security regressions, stale references,
and missing tests. Treat generated build output and historical archives as out
of scope.

Known verification:

- `openspec validate --all`: 19 passed
- root typecheck: passed
- shared: 24 files, 308 passed
- agent: 107 files, 1091 passed, 1 skipped
- SPA: 120 files, 1100 passed
- lint: zero errors (repository has pre-existing warnings)
- live desktop/mobile QA and viewer-link 200 are recorded in `QA.md`

Return:

1. `## Code quality`
2. Findings ordered by severity with exact file/line references and concrete
   fixes. Say `No findings` if there are none.
3. A short requirements-coverage assessment.
4. One final line exactly `VERDICT: APPROVE` or `VERDICT: REQUEST_CHANGES`.
