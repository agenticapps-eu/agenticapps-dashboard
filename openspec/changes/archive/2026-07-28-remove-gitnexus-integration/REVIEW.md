# Stage-3 code review — remove-gitnexus-integration

## Code quality

Reviewer: Claude Code 2.1.220, read-only review of the scoped working-tree
implementation.

### First pass

The first pass requested changes because retained-behavior tests had been
removed too broadly. The implementation was amended to restore coverage for:

- bearer authentication, cache behavior, schema-drift responses, and token
  non-leakage;
- v1/v2 query parsing and exact first-issue paths;
- Understand viewer availability and scoped-token URL construction;
- coverage collapse state, fixed-column layout, mobile rendering, filters,
  search, overrides, keyboard access, workflow substates, and drift guards;
- conformance edge cases and snapshot filename, malformed-line,
  last-record-wins, transition, pruning-order, and recursive-directory behavior.

The same pass identified orphaned clipboard helpers, stale comments and prose,
an unreachable `unknown` UI state, and an unused scan parameter. Those were
removed or corrected before re-review.

### Fresh review

Claude found the implementation coherent with the proposal, delta specs, ADR,
measurement, QA, and verification artifacts. It confirmed:

- the current state vocabulary is exactly `fresh | stale | missing`;
- v1 compatibility and strict v2 schemas behave as specified;
- absent v1 Understand data is excluded from aggregates and filters;
- live and retained-history scoring use exactly CLAUDE.md and Workflow;
- GitNexus/Wiki product code, routes, actions, health fields, and columns are
  removed while Understand Anything remains intact;
- no correctness blocker or measurement discontinuity remains.

The final review noted only documentation/ledger hygiene: stale refresh-route
comments, empty ignored GitNexus skill directories, unchecked tasks, and
standalone Wiki utility scripts that were not in scope. The comments and task
ledger were corrected, the empty directories were removed, and the scripts are
now recorded explicitly as a non-goal.

VERDICT: APPROVE
