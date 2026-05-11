/**
 * Plan 07-02 placeholder — 07-03 owns this file in its worktree.
 *
 * Vite's import-analysis statically resolves every `import('../widgets/X.stub.js')`
 * expression in HelpWidget.tsx at transform-time, BEFORE vi.mock takes effect.
 * Without these placeholder files the module fails to load and the test cannot
 * even start (Plan 07-02 Task 4 verification was blocked).
 *
 * R2 disjoint-set: 07-03 produces the canonical widget stubs. At merge-back
 * the orchestrator must resolve git conflicts on packages/spa/src/help/widgets/**
 * in favour of 07-03's branch (the richer implementations).
 *
 * @see .planning/phases/07-help-docs-v1-0/07-02-PLAN.md objective R2 resolution
 */
export default function RepoTopologyMapPlaceholder(): React.JSX.Element {
  return <div>RepoTopologyMap stub (Plan 07-02 placeholder; 07-03 ships canonical)</div>
}
